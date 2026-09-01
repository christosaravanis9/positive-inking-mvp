import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnManaged, terminateManaged, chromiumLaunchOptions } from "../scripts/lib/devStack.mjs";

/**
 * The browser-journey leg of `npm run validate:local`. Reuses the same
 * real-server + real-Vite + fake-Anthropic-double architecture as
 * asyncStateRace.mjs (which already proves no-duplicate-submit,
 * no-stale-mutation, and no-dead-backend at the Story/Discovery boundary --
 * this script does not re-derive those, they run earlier in the same
 * validate:local pipeline). What this script covers instead is the ground
 * asyncStateRace.mjs never reaches:
 *
 *  1. Story -> Discovery -> Screen 7 actually renders Association
 *     candidates from a schema-valid fixture response.
 *  2. Selecting a candidate and confirming advances the journey past
 *     Screen 7 -- proving ElementsDiscovery's confirm() pipeline and the
 *     Association fixture's schema compatibility end-to-end, not just in
 *     isolation.
 *  3. A second, independent run proves the same no-stale-mutation /
 *     no-dead-backend guarantee specifically for the Screen 7 boundary
 *     (a delayed Association response, unmounted mid-flight).
 *  4. POST /api/blueprint is reachable on the real live server and returns
 *     a valid Blueprint for a representative payload.
 *
 * It does not click through the remaining screens (creative control,
 * composition, artistic direction, avoidances, placement, design
 * confirmation) one at a time -- route-level and engine-level tests
 * already cover each of those individually, and scripting six more
 * screens' worth of selectors here would be a lot of brittle surface for
 * marginal additional confidence over what's already covered elsewhere.
 *
 * Run: node test-integration/localValidationJourney.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SERVER_PORT = 8787;
const WEB_PORT = 5184;
const TOTAL_MODEL_BUDGET_MS = 5000;

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log(`  PASS: ${description}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${description}`);
  }
}

function waitForLine(child, matcher, label, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
    function onData(chunk) {
      const text = chunk.toString();
      process.stdout.write(`[${label}] ${text}`);
      const match = text.match(matcher);
      if (match) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(match);
      }
    }
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => process.stderr.write(`[${label}:err] ${chunk}`));
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function freshPage(browser) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  page.on("pageerror", (err) => console.log("  [pageerror]", err.message));
  await page.goto(`http://localhost:${WEB_PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  await page.click("button:text-is('Discover my tattoo')");
  await page.waitForTimeout(150);
  await page.click("button.option-chip >> nth=0"); // viewpoint
  await page.waitForTimeout(150);
  return page;
}

async function submitStory(page, storyText) {
  await page.fill("textarea", storyText);
  await page.click("button:text-is('Continue')");
}

async function currentHeading(page) {
  return page.locator("h1, h2").first().textContent().catch(() => "(none)");
}

/**
 * Full-mode journey order after Discovery succeeds: MeaningReflection
 * ("Here is what we heard.") -> IntentionConfirmation ("Your tattoo is
 * about...") -> Screen 7. Both intermediate screens are pure client-side
 * confirmations (no model call), so this only needs UI interaction, not
 * further fixture wiring.
 */
async function advanceThroughReflectionAndIntention(page) {
  await page.waitForSelector("text=Here is what we heard.", { timeout: 10000 });
  // Discovery's own key_themes seed MeaningReflection's selection by default
  // (Story.tsx patches selected_themes from the Discovery result before this
  // screen mounts) -- Continue is already enabled; no chip click needed.
  await page.click("button:text-is('Continue')");
  await page.waitForSelector("text=Your tattoo is about...", { timeout: 10000 });
  await page.click("button:text-is('Continue')");
}

async function scenario1_screen7RendersCandidatesAndConfirms(browser) {
  console.log("\n--- Journey 1: Story -> Discovery -> Screen 7 renders candidates -> confirm advances the journey ---");
  const page = await freshPage(browser);
  await submitStory(page, "A tattoo to remember a childhood dog named Scout.");
  await page.waitForTimeout(300);
  await advanceThroughReflectionAndIntention(page);
  await page.waitForTimeout(500); // Association fetch on mount

  const heading = await currentHeading(page);
  check(heading.includes("Let us find what could represent it"), `reached Screen 7 (heading: "${heading}")`);

  const chipCount = await page.locator(".option-chip").locator("input[type=checkbox]").count();
  check(chipCount >= 1, `Screen 7 rendered at least one Association candidate (actual: ${chipCount})`);

  if (chipCount > 0) {
    await page.locator(".option-chip").nth(0).locator("input[type=checkbox]").click();
    await page.waitForTimeout(150);
    await page.click("button:text-is('Continue')");
    await page.waitForTimeout(500);
    const nextHeading = await currentHeading(page);
    check(
      !nextHeading.includes("Let us find what could represent it"),
      `confirming a candidate advanced past Screen 7 (heading now: "${nextHeading}")`,
    );
  }

  await page.close();
}

async function scenario2_screen7NoStaleMutation(browser) {
  console.log("\n--- Journey 2: Association request delayed past navigation-away -- no stale mutation, no dead backend ---");
  const page = await freshPage(browser);
  // The delay marker travels through fakeAnthropic's Discovery response into
  // statement_of_intention, so it reaches the Association call Screen 7
  // fires on mount -- Discovery itself resolves immediately.
  await submitStory(page, "__TEST_DELAY_4000__ A tattoo to remember a childhood dog named Scout.");
  await page.waitForTimeout(300);
  await advanceThroughReflectionAndIntention(page);
  await page.waitForTimeout(300);

  const heading = await currentHeading(page);
  check(heading.includes("Let us find what could represent it"), `reached Screen 7 while Association is still in flight (heading: "${heading}")`);

  // Simulate navigating away mid-request, same technique as asyncStateRace.mjs scenario 4.
  await page.evaluate(() => {
    const raw = localStorage.getItem("positive-inking:journey-state:v1");
    const state = JSON.parse(raw);
    state.ui.manualPathActive = true;
    localStorage.setItem("positive-inking:journey-state:v1", JSON.stringify(state));
  });
  await page.reload();
  await page.waitForTimeout(4500); // let the original in-flight Association request's delay elapse

  const headingAfter = await currentHeading(page);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")));
  check(!headingAfter.includes("Let us find what could represent it"), "no stale navigation back onto Screen 7 after the delayed response resolved");
  check(state.project.visual_elements.length === 0, "the late Association response never mutated visual_elements after navigating away");

  const healthRes = await fetch(`http://localhost:${SERVER_PORT}/api/health`);
  check(healthRes.ok, "backend still reachable after the delayed request resolved in the background (no dead backend)");

  await page.close();
}

async function scenario3_blueprintRouteReachable(browser) {
  console.log("\n--- Journey 3: POST /api/blueprint is reachable on the real live server ---");
  const context = await browser.newContext();
  const res = await context.request.post(`http://localhost:${SERVER_PORT}/api/blueprint`, {
    data: {
      journey_mode: "full",
      significance_claimed: false,
      themes_surfaced: true,
      statement_user_authored: false,
      interpretation_confidence: "standard",
      any_required_reference_missing: false,
      has_unresolved_contradiction: false,
      confirmed_project_summary: "Story/why: A tattoo to remember a childhood dog named Scout.\nThemes: loyalty, companionship",
    },
  });
  check(res.ok(), `POST /api/blueprint responded OK (actual status: ${res.status()})`);
  if (res.ok()) {
    const body = await res.json();
    check(typeof body?.data?.readiness === "string", "response body contains a Blueprint with a readiness field");
  }
  await context.close();
}

async function main() {
  console.log("=== Starting fake Anthropic double ===");
  const fakeAnthropic = spawnManaged("fake-anthropic", "node", [path.join(repoRoot, "test-integration", "fakeAnthropic.mjs"), "0"], { cwd: repoRoot });
  const [, fakePortStr] = await waitForLine(fakeAnthropic, /FAKE_ANTHROPIC_LISTENING (\d+)/, "fake-anthropic");
  const fakePort = fakePortStr;

  console.log("=== Starting REAL server ===");
  const server = spawnManaged("server", "npx", ["tsx", "src/index.ts"], {
    cwd: path.join(repoRoot, "server"),
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      ANTHROPIC_API_KEY: "test-key-for-local-validation-journey",
      ANTHROPIC_API_URL: `http://127.0.0.1:${fakePort}/v1/messages`,
      MODEL_TIMEOUT_DISCOVERY_MS: String(TOTAL_MODEL_BUDGET_MS),
      MODEL_TIMEOUT_ASSOCIATION_MS: String(TOTAL_MODEL_BUDGET_MS),
    },
  });
  server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[server:err] ${d}`));
  await waitForHttp(`http://localhost:${SERVER_PORT}/api/health`);

  console.log("=== Starting REAL Vite dev server ===");
  const web = spawnManaged("web", "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], {
    cwd: path.join(repoRoot, "web"),
    env: { ...process.env },
  });
  web.stdout.on("data", (d) => process.stdout.write(`[web] ${d}`));
  web.stderr.on("data", (d) => process.stderr.write(`[web:err] ${d}`));
  await waitForHttp(`http://localhost:${WEB_PORT}/`);

  const browser = await chromium.launch(chromiumLaunchOptions());

  try {
    await scenario1_screen7RendersCandidatesAndConfirms(browser);
    await scenario2_screen7NoStaleMutation(browser);
    await scenario3_blueprintRouteReachable(browser);
  } finally {
    await browser.close();
    await Promise.all([terminateManaged(server), terminateManaged(web), terminateManaged(fakeAnthropic)]);
  }

  console.log(`\n=== ${failures === 0 ? "ALL JOURNEYS PASSED" : `${failures} CHECK(S) FAILED`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

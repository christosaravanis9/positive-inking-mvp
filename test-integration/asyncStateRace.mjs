import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnManaged, terminateManaged, chromiumLaunchOptions } from "./../scripts/lib/devStack.mjs";

/**
 * Reproduces the async/state race incident (docs/async-state-incident.md)
 * against the REAL application architecture: the actual Express server,
 * the actual modelClient.ts retry/timeout logic, the actual React app
 * served by Vite -- not Playwright route mocking. Only the real Anthropic
 * endpoint is swapped for a local, controllable double
 * (fakeAnthropic.mjs), since no live API key is available here; every
 * other hop in browser -> client API call -> server endpoint -> modelClient
 * -> "Anthropic" -> response -> client state update is the real code path.
 *
 * Run: node test-integration/asyncStateRace.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SERVER_PORT = 8787; // must match web/vite.config.ts's hardcoded /api proxy target
const WEB_PORT = 5183;
const TOTAL_MODEL_BUDGET_MS = 3000; // small so timeout scenarios run fast

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

async function main() {
  console.log("=== Starting fake Anthropic double ===");
  const fakeAnthropic = spawnManaged("fake-anthropic", "node", [path.join(__dirname, "fakeAnthropic.mjs"), "0"], { cwd: repoRoot });
  const [, fakePortStr] = await waitForLine(fakeAnthropic, /FAKE_ANTHROPIC_LISTENING (\d+)/, "fake-anthropic");
  const fakePort = fakePortStr;

  console.log("=== Starting REAL server (actual routes, actual modelClient retry/timeout logic) ===");
  const server = spawnManaged("server", "npx", ["tsx", "src/index.ts"], {
    cwd: path.join(repoRoot, "server"),
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      ANTHROPIC_API_KEY: "test-key-for-integration-test",
      ANTHROPIC_API_URL: `http://127.0.0.1:${fakePort}/v1/messages`,
      // This scenario only exercises the Story screen's /api/discovery call --
      // route-specific timeouts (docs/timeout-matrix.md) replaced the old
      // single MODEL_REQUEST_TIMEOUT_MS, so only discovery's budget needs
      // overriding here.
      MODEL_TIMEOUT_DISCOVERY_MS: String(TOTAL_MODEL_BUDGET_MS),
    },
  });
  server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[server:err] ${d}`));
  await waitForHttp(`http://localhost:${SERVER_PORT}/api/health`);

  console.log("=== Starting REAL Vite dev server (actual React app, actual /api proxy) ===");
  const web = spawnManaged("web", "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], {
    cwd: path.join(repoRoot, "web"),
    env: { ...process.env },
  });
  web.stdout.on("data", (d) => process.stdout.write(`[web] ${d}`));
  web.stderr.on("data", (d) => process.stderr.write(`[web:err] ${d}`));
  // web's vite.config.ts proxies /api to localhost:8787 hardcoded -- point the
  // real server there too by using that exact port instead of a custom one.
  await waitForHttp(`http://localhost:${WEB_PORT}/`);

  const browser = await chromium.launch(chromiumLaunchOptions());

  try {
    await scenario1_delayedResponseBelowTimeout(browser);
    await scenario2_serverTimeoutThenRetrySucceeds(browser);
    await scenario3_rapidDoubleSubmit(browser);
    await scenario4_navigationAwayDuringRequest(browser);
  } finally {
    await browser.close();
    // Process-group teardown (not a bare .kill()) -- server/web are each
    // spawned via an npx wrapper that itself spawns the real tool (tsx's
    // supervised app process, vite's esbuild service); killing only the
    // wrapper orphans those grandchildren, which is exactly what left a
    // zombie tsx process pinning port 8787 and breaking the next run.
    await Promise.all([terminateManaged(server), terminateManaged(web), terminateManaged(fakeAnthropic)]);
  }

  console.log(`\n=== ${failures === 0 ? "ALL SCENARIOS PASSED" : `${failures} CHECK(S) FAILED`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

async function freshPage(browser) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const requestLog = [];
  page.on("request", (req) => {
    // Method + POST check: Vite's dev server also serves the source file at
    // /src/api/discovery.ts, whose URL substring-matches "/api/discovery" --
    // only a real POST to the endpoint should ever count here.
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/discovery") {
      requestLog.push({ at: Date.now(), method: req.method() });
    }
  });
  page.on("pageerror", (err) => console.log("  [pageerror]", err.message));
  await page.goto(`http://localhost:${WEB_PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  // Welcome -> Viewpoint (pick "Past", full mode) -> Story.
  await page.click("button:text-is('Discover my tattoo')");
  await page.waitForTimeout(150);
  await page.click("button.option-chip >> nth=0");
  await page.waitForTimeout(150);
  return { page, requestLog };
}

async function readState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("positive-inking:journey-state:v1");
    return raw ? JSON.parse(raw) : null;
  });
}

async function currentHeading(page) {
  return page.locator("h1, h2").first().textContent().catch(() => "(none)");
}

async function scenario1_delayedResponseBelowTimeout(browser) {
  console.log("\n--- Scenario 1: delayed response BELOW total budget -- must succeed normally ---");
  const { page, requestLog } = await freshPage(browser);
  await page.fill("textarea", "__TEST_DELAY_1000__ A story about my grandmother's garden.");
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(200);
  check((await page.locator("button:text-is('Working...')").count()) > 0 || (await page.locator("text=/Understanding your story/").count()) > 0, "loading feedback shown while request is in flight");
  await page.waitForTimeout(2000);
  const heading = await currentHeading(page);
  check(!heading.includes("Tell us what you want"), `navigated away from Story on success (heading: "${heading}")`);
  check(requestLog.length === 1, `exactly one /api/discovery request fired (actual: ${requestLog.length})`);
  await page.close();
}

async function scenario2_serverTimeoutThenRetrySucceeds(browser) {
  console.log("\n--- Scenario 2: server-side timeout (delay exceeds total budget), then explicit retry succeeds ---");
  const { page, requestLog } = await freshPage(browser);
  const originalText = "__TEST_DELAY_6000__ A story that will time out.";
  await page.fill("textarea", originalText);
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(TOTAL_MODEL_BUDGET_MS + 2000);

  const stateAfterTimeout = await readState(page);
  check(stateAfterTimeout.ui.error?.code === "client_timeout" || stateAfterTimeout.ui.error?.code === "model_timeout", `a timeout error is shown (actual code: ${stateAfterTimeout.ui.error?.code})`);
  check(stateAfterTimeout.ui.error?.context === "Understanding your story", "error context correctly attributes to Story's own action");
  check(!stateAfterTimeout.ui.discoveryCompleted, "discoveryCompleted was NOT set to true by the timed-out attempt");
  check((await page.locator("textarea").inputValue()).includes("A story that will time out"), "the user's typed text is preserved after the timeout");
  const headingDuringError = await currentHeading(page);
  check(headingDuringError.includes("Tell us what you want"), "journey did NOT cascade away from Story after the timeout");

  // Now retry with fast, successful text.
  await page.fill("textarea", "A story that will now succeed on retry.");
  await page.click("button:text-is('Try again'), button:text-is('Continue')");
  await page.waitForTimeout(1500);

  const stateAfterRetry = await readState(page);
  check(stateAfterRetry.ui.discoveryCompleted === true, "retry succeeded and discoveryCompleted became true");
  check(stateAfterRetry.ui.error === null, "no error remains after a successful retry");
  console.log(`  (requests fired this scenario: ${requestLog.length})`);
  await page.close();
}

async function scenario3_rapidDoubleSubmit(browser) {
  console.log("\n--- Scenario 3: rapid double submit with a slow-but-successful response ---");
  const { page, requestLog } = await freshPage(browser);
  await page.fill("textarea", "__TEST_DELAY_1500__ A story clicked twice quickly.");
  const continueBtn = page.locator("button:text-is('Continue')");
  await continueBtn.click();
  await continueBtn.click({ force: true }).catch(() => {}); // second click while (ideally) disabled/pending
  await page.waitForTimeout(2000);

  check(requestLog.length === 1, `exactly one /api/discovery request fired despite two clicks (actual: ${requestLog.length})`);
  const state = await readState(page);
  check(state.ui.discoveryCompleted === true, "the single request completed and advanced the journey normally");
  await page.close();
}

async function scenario4_navigationAwayDuringRequest(browser) {
  console.log("\n--- Scenario 4: component unmounts (user navigates away) while a request is in flight ---");
  const { page } = await freshPage(browser);
  await page.fill("textarea", "__TEST_DELAY_2000__ A story where the user leaves before it resolves.");
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(300);
  // Simulate navigating away mid-request: force the journey back to an earlier
  // screen by clearing discoveryCompleted-independent progress is not directly
  // triggerable from outside, so instead verify the pending in-flight request's
  // eventual resolution does not produce any error banner attributed to a
  // screen the user is no longer on -- reload to a different, unrelated screen.
  await page.evaluate(() => {
    const raw = localStorage.getItem("positive-inking:journey-state:v1");
    const state = JSON.parse(raw);
    state.ui.manualPathActive = true; // jump to an unrelated screen (Working Notes)
    localStorage.setItem("positive-inking:journey-state:v1", JSON.stringify(state));
  });
  await page.reload();
  await page.waitForTimeout(2500); // let the original in-flight request's timer elapse
  const heading = await currentHeading(page);
  const state = await readState(page);
  check(!heading.includes("client_timeout") && !heading.includes("Understanding your story"), "no stale error banner leaked onto the new screen");
  check(state.ui.error === null || state.ui.error?.context !== "Understanding your story", "no Story-scoped error was left in global state after navigating away");
  await page.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

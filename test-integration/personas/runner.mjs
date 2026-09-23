import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnManaged, terminateManaged, chromiumLaunchOptions } from "../../scripts/lib/devStack.mjs";

/**
 * Synthetic-persona testing harness for the intake journey (2026-09-23,
 * live-requested). Formalizes the pattern already used for one-off live-
 * browser verification throughout this project's history (real server +
 * real Vite + a fake-Anthropic double, no real ANTHROPIC_API_KEY needed)
 * into something repeatable and checked into the repo, instead of a
 * throwaway script written fresh each time and deleted after use.
 *
 * A persona (see personas/*.mjs) declares WHAT a synthetic client does at
 * each decision point -- literal text answers, Screen 7 behaviour
 * (Keep/Build-upon/reroll), whether it engages the meaning-depth-gate
 * follow-up. This runner is the HOW: it drives a real Chromium instance
 * through the full journey (Welcome -> ... -> Blueprint) for one persona,
 * using the exact same UI a real client uses (no localStorage shortcuts,
 * no direct API calls bypassing the browser, except for the final Blueprint
 * state read-back), and produces a structured report.
 *
 * Known, deliberate limitation (stated plainly, matching this project's
 * own established discipline for fake-double verification): the fake
 * Anthropic double returns pre-authored fixture prose, branching only on
 * literal markers in the request text (`__TEST_THIN__`) or which tool/
 * instruction shape was sent -- never genuine model judgement. It can
 * prove the APP correctly branches on whatever the model returns (the
 * meaning-depth gate fires when told to, a reroll reaches the right
 * endpoint, an edit is echoed back) but it cannot prove the REAL model
 * would judge any given persona's story the same way. That gap is real
 * production/real-model verification's job, not this harness's.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const reportsDir = path.join(__dirname, "reports");
const screenshotsDir = path.join(__dirname, "screenshots");

// vite.config.ts hardcodes its /api proxy target to localhost:8787 -- this
// MUST match, or every API call from the browser 404s through the proxy.
const SERVER_PORT = 8787;
const WEB_PORT = 5173;
const MODEL_BUDGET_MS = 8000;

// Known, hardcoded fixture text from fakeAnthropic.mjs's associationInput()
// default (initial-fetch) response -- this harness controls and knows this
// fixture completely, so mode detection is exact-text matching against it,
// not a general NLP heuristic. See that file's own "Mode A/B/C" comments.
const MODE_MARKERS = {
  literal_object: "a specific object tied to a shared memory",
  pure_abstraction: "a new mark made by overlapping the outlines of both your initials",
  illustrative_sequence: "Three small linked panels, no border between them",
};

function waitForLine(child, matcher, label, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
    function onData(chunk) {
      const text = chunk.toString();
      const match = text.match(matcher);
      if (match) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(match);
      }
    }
    child.stdout.on("data", onData);
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function startStack() {
  const fakeAnthropic = spawnManaged("fake-anthropic", "node", [path.join(repoRoot, "test-integration", "fakeAnthropic.mjs"), "0"], {
    cwd: repoRoot,
  });
  const [, fakePortStr] = await waitForLine(fakeAnthropic, /FAKE_ANTHROPIC_LISTENING (\d+)/, "fake-anthropic");

  const server = spawnManaged("server", "npx", ["tsx", "src/index.ts"], {
    cwd: path.join(repoRoot, "server"),
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      ANTHROPIC_API_KEY: "test-key-for-persona-harness",
      ANTHROPIC_API_URL: `http://127.0.0.1:${fakePortStr}/v1/messages`,
      MODEL_TIMEOUT_DISCOVERY_MS: String(MODEL_BUDGET_MS),
      MODEL_TIMEOUT_ASSOCIATION_MS: String(MODEL_BUDGET_MS),
      MODEL_TIMEOUT_AVOIDANCE_MS: String(MODEL_BUDGET_MS),
      MODEL_TIMEOUT_STYLE_REFERENCE_MS: String(MODEL_BUDGET_MS),
      MODEL_TIMEOUT_BLUEPRINT_MS: String(MODEL_BUDGET_MS),
    },
  });
  await waitForHttp(`http://localhost:${SERVER_PORT}/api/health`);

  const web = spawnManaged("web", "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], {
    cwd: path.join(repoRoot, "web"),
    env: { ...process.env },
  });
  await waitForHttp(`http://localhost:${WEB_PORT}/`);

  return { fakeAnthropic, server, web };
}

export async function stopStack({ fakeAnthropic, server, web }) {
  await Promise.all([terminateManaged(server), terminateManaged(web), terminateManaged(fakeAnthropic)]);
}

async function currentHeading(page) {
  return page.locator("h1, h2").first().textContent().catch(() => "(none)");
}

async function gotoWelcomeAndStart(page) {
  await page.goto(`http://localhost:${WEB_PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  await page.check("input[type=checkbox]");
  await page.click("button:text-is('Discover my tattoo')");
  await page.waitForTimeout(150);
}

async function pickViewpoint(page, index) {
  await page.locator("button.option-chip").nth(index).click();
  await page.waitForTimeout(150);
}

async function submitStoryAndMaybeDepthGate(page, persona, report) {
  await page.fill("textarea", persona.storyText);
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(500);

  const shareBtn = page.locator("button:text-is('Share it')");
  const gateFired = (await shareBtn.count()) > 0;
  report.depthGateFired = gateFired;

  if (gateFired) {
    if (persona.depthAnswer) {
      await page.fill("input[placeholder='Or say it in your own words']", persona.depthAnswer);
      report.depthAnswerGiven = persona.depthAnswer;
      await page.click("button:text-is('Share it')");
    } else {
      report.depthAnswerGiven = null;
      await page.click("button:text-is('Continue')");
    }
    await page.waitForTimeout(500);
  }
}

async function advanceReflectionAndIntention(page) {
  await page.waitForSelector("text=Here is what we heard.", { timeout: 10000 });
  await page.click("button:text-is('Continue')");
  await page.waitForSelector("text=Statement of Inspiration", { timeout: 10000 });
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(300);
}

function detectModes(cardFirstLines) {
  const seen = [];
  for (const [mode, marker] of Object.entries(MODE_MARKERS)) {
    if (cardFirstLines.some((line) => line.includes(marker))) seen.push(mode);
  }
  return seen;
}

async function driveScreen7(page, persona, report) {
  await page.waitForSelector("text=Let us find what could represent it.", { timeout: 15000 });
  await page.waitForTimeout(700); // let the Association fetch resolve

  const cardTexts = await page.locator(".ledger-candidate").allInnerTexts();
  const firstLines = cardTexts.map((t) => t.split("\n")[0]);
  report.candidatesVisible = firstLines;
  report.associationModesSeen = detectModes(firstLines);

  const s7 = persona.screen7 ?? {};

  // The needs_client_specific_detail candidate ("a specific object tied to
  // a shared memory") -- Keep it and answer its follow-up with the
  // persona's own (possibly fragment/"no") text, to exercise
  // DETAIL_SEPARATOR / the Section 4 composition fix.
  if (s7.detailAnswer !== undefined && s7.detailAnswer !== null) {
    const targetCard = page.locator(".ledger-candidate", { hasText: MODE_MARKERS.literal_object });
    if ((await targetCard.count()) > 0) {
      await targetCard.first().locator("button.ledger-decision-keep").click();
      await page.waitForTimeout(150);
      await targetCard.first().locator('input.ledger-lined-input[placeholder="Optional"]').fill(s7.detailAnswer);
      await page.waitForTimeout(100);
      report.detailAnswerGiven = s7.detailAnswer;
    } else {
      report.detailAnswerGiven = "(target candidate not found)";
    }
  }

  // Plain Keep/Build-upon-without-edit on other candidates, by description prefix.
  for (const prefix of s7.keepMatchers ?? []) {
    const card = page.locator(".ledger-candidate", { hasText: prefix });
    if ((await card.count()) > 0) {
      await card.first().locator("button.ledger-decision-keep").click();
      await page.waitForTimeout(100);
    }
  }

  // Free (reserve-pool) rerolls on a slot, repeated until either the
  // requested count is reached or the reserve pool is genuinely exhausted
  // (the "No more free alternatives" banner appears) -- whichever first.
  let freeRerollCount = 0;
  let hitExhaustion = false;
  if (s7.freeRerollSlot !== undefined && s7.freeRerollCount > 0) {
    for (let i = 0; i < s7.freeRerollCount; i++) {
      const card = page.locator(".ledger-candidate").nth(s7.freeRerollSlot);
      await card.locator("button:has-text('Not this one')").click();
      await page.waitForTimeout(150);
      const exhausted = (await card.locator("text=No more free alternatives").count()) > 0;
      if (exhausted) {
        hitExhaustion = true;
        break;
      }
      await card.locator("button:text-is('Show me something else')").click();
      await page.waitForTimeout(200);
      freeRerollCount++;
    }
  }
  report.freeRerolls = freeRerollCount;
  report.reservePoolExhausted = hitExhaustion;

  // Paid (real per-slot model call) reroll -- a typed reason.
  let paidRerollCount = 0;
  if (s7.paidRerollSlot !== undefined && s7.paidRerollReason) {
    const card = page.locator(".ledger-candidate").nth(s7.paidRerollSlot);
    // If the why-box isn't already open (e.g. exhaustion wasn't hit via
    // free rerolls first), open it.
    if ((await card.locator('input[placeholder^="e.g."]').count()) === 0) {
      await card.locator("button:has-text('Not this one')").click();
      await page.waitForTimeout(150);
    }
    await card.locator('input[placeholder^="e.g."]').fill(s7.paidRerollReason);
    await page.waitForTimeout(100);
    await card.locator("button:text-is('Show me something else')").click();
    await page.waitForTimeout(1500); // real (fake-double) model round trip
    paidRerollCount = 1;
  }
  report.paidRerolls = paidRerollCount;

  // Build-upon with a genuine edit -- confirms the model's (fixture's)
  // response is built from the client's own edit, not a fresh alternative.
  // Resolved by POSITION (not by re-matching description text), because
  // refinement replaces the slot's description in place -- a hasText
  // locator built from the pre-refine text stops matching anything the
  // instant the new description lands, which just hangs until timeout.
  if (s7.buildUpon) {
    const { matchDescriptionPrefix, editText } = s7.buildUpon;
    const allCards = page.locator(".ledger-candidate");
    const cardCount = await allCards.count();
    let slotIndex = -1;
    for (let i = 0; i < cardCount; i++) {
      const text = await allCards.nth(i).innerText();
      if (text.includes(matchDescriptionPrefix)) {
        slotIndex = i;
        break;
      }
    }
    if (slotIndex === -1) {
      report.buildUponEditText = editText;
      report.buildUponResultText = "(target candidate not found)";
      report.buildUponEditRespected = false;
    } else {
      const card = allCards.nth(slotIndex);
      await card.locator("button:has-text('Build upon')").click();
      await page.waitForTimeout(150);
      const textarea = card.locator("textarea.ledger-lined-textarea");
      await textarea.fill(editText);
      await page.waitForTimeout(100);
      await card.locator("button:text-is('Refine this idea')").click();
      await page.waitForTimeout(1500);
      const refinedText = await card.locator(".ledger-candidate-body strong").first().textContent();
      report.buildUponEditText = editText;
      report.buildUponResultText = refinedText;
      report.buildUponEditRespected = Boolean(refinedText && refinedText.startsWith(editText));
    }
  }

  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(400);
}

async function clickThroughCreativeControl(page) {
  await page.waitForSelector("text=Who should shape the final design?", { timeout: 10000 });
  await page.locator("button.option-chip-card").first().click();
  await page.waitForTimeout(200);
}

async function clickThroughRoughScale(page) {
  await page.waitForSelector("text=Roughly how big, and roughly where?", { timeout: 10000 });
  await page.locator("button.option-chip", { hasText: "arm" }).first().click();
  await page.waitForTimeout(100);
  await page.locator("button.option-chip", { hasText: "Medium" }).first().click();
  await page.waitForTimeout(150);
  // A blocking suitability consideration is possible (scale vs. element
  // count/control) -- resolve it if it appears, rather than assuming it never does.
  const blockingBanner = page.locator(".error-banner");
  if ((await blockingBanner.count()) > 0) {
    await blockingBanner.locator("button.option-chip").first().click();
    await page.waitForTimeout(150);
  }
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(200);
}

/** Generic driver for the two engine-adaptive, multi-question chip screens (Composition, Artistic direction) -- clicks the first available option-chip repeatedly (a real, valid answer every time, just not tailored per-persona, since these two screens are outside this harness's v1 scope) until no more chips remain to answer on this screen. */
async function clickChipsUntilSettled(page, maxClicks = 12) {
  for (let i = 0; i < maxClicks; i++) {
    const chip = page.locator(".option-chip").first();
    if ((await chip.count()) === 0) break;
    await chip.click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

async function clickThroughCompositionBackground(page) {
  await page.waitForTimeout(200);
  await clickChipsUntilSettled(page);
}

async function clickThroughStyleReference(page) {
  await page.waitForSelector("text=Is there a particular style, medium, or tradition in mind?", { timeout: 10000 });
  await page.click("button:text-is('Nothing in particular')");
  await page.waitForTimeout(200);
}

async function clickThroughArtisticDirection(page) {
  await page.waitForTimeout(200);
  await clickChipsUntilSettled(page);
}

async function clickThroughAvoidances(page) {
  await page.waitForSelector("text=Is there anything you definitely do not want?", { timeout: 10000 });
  await page.waitForTimeout(600); // suggestion fetch
  await page.click("button:text-is('Nothing specifically')");
  await page.waitForTimeout(200);
}

async function clickThroughPlacement(page) {
  await page.waitForSelector("text=Where exactly will it live?", { timeout: 10000 });
  await page.click("button:text-is('Continue')");
  await page.waitForTimeout(300);
}

async function buildBlueprint(page, report) {
  await page.waitForSelector("text=Ready to build your Blueprint", { timeout: 10000 });
  await page.waitForTimeout(200);
  const buildBtn = page.locator("button:text-is('Build my Blueprint')");
  await buildBtn.waitFor({ state: "visible", timeout: 10000 });
  const disabled = await buildBtn.isDisabled();
  report.buildButtonDisabledAtDesignConfirmation = disabled;
  if (disabled) {
    report.blueprintReached = false;
    return;
  }
  await buildBtn.click();
  await page.waitForSelector("text=Readiness", { timeout: 15000 });
  await page.waitForTimeout(300);
  report.blueprintReached = true;
}

/**
 * Runs one persona end to end against an already-running stack (see
 * startStack/stopStack above) and returns a structured report. Does not
 * throw on an assertion mismatch -- callers (index.mjs) decide pass/fail
 * from the report, so one persona's failure doesn't abort the batch.
 */
export async function runPersona(browser, persona) {
  const report = {
    persona: persona.id,
    label: persona.label,
    startedAt: new Date().toISOString(),
    consoleErrors: [],
    pageErrors: [],
    screensReached: [],
    depthGateFired: null,
    associationModesSeen: [],
    freeRerolls: 0,
    paidRerolls: 0,
  };

  const page = await browser.newPage({ viewport: { width: 480, height: 1100 } });
  page.on("console", (msg) => {
    // The dev server has no favicon.ico configured, so a real browser always
    // requests and 404s on it once per session -- a Chromium built-in, not
    // anything caused by (or worth flagging against) the app itself.
    if (msg.type() === "error" && !msg.location()?.url?.endsWith("/favicon.ico")) {
      report.consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => report.pageErrors.push(err.message));

  try {
    await gotoWelcomeAndStart(page);
    report.screensReached.push("welcome");

    await pickViewpoint(page, persona.viewpointChipIndex ?? 0);
    report.screensReached.push("viewpoint");

    await submitStoryAndMaybeDepthGate(page, persona, report);
    report.screensReached.push("story");

    await advanceReflectionAndIntention(page);
    report.screensReached.push("meaning_reflection", "intention_confirmation");

    await driveScreen7(page, persona, report);
    report.screensReached.push("elements_discovery");

    await clickThroughCreativeControl(page);
    report.screensReached.push("creative_control");

    await clickThroughRoughScale(page);
    report.screensReached.push("rough_scale");

    await clickThroughCompositionBackground(page);
    report.screensReached.push("composition_background");

    await clickThroughStyleReference(page);
    report.screensReached.push("style_reference");

    await clickThroughArtisticDirection(page);
    report.screensReached.push("artistic_direction");

    await clickThroughAvoidances(page);
    report.screensReached.push("avoidances");

    await clickThroughPlacement(page);
    report.screensReached.push("placement");

    await buildBlueprint(page, report);
    report.screensReached.push("design_confirmation");
    if (report.blueprintReached) report.screensReached.push("blueprint");

    // Read back the final composed detail description (DETAIL_SEPARATOR /
    // "In your own words:" fix), regardless of which screen we're now on --
    // visual_elements is stable project state from here.
    const projectState = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("positive-inking:journey-state:v1");
        return raw ? JSON.parse(raw).project : null;
      } catch {
        return null;
      }
    });
    if (projectState && (persona.screen7?.detailAnswer !== undefined && persona.screen7?.detailAnswer !== null)) {
      const el = (projectState.visual_elements ?? []).find((e) => e.description?.startsWith(MODE_MARKERS.literal_object));
      report.detailComposedDescription = el?.description ?? "(not found among visual_elements)";
      report.detailCompositionClean = Boolean(
        el?.description?.includes("In your own words:") && !el.description.includes(" — specifically, "),
      );
    }

    if (report.blueprintReached) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const shotPath = path.join(screenshotsDir, `${persona.id}-blueprint.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      report.blueprintScreenshot = shotPath;
    } else {
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const shotPath = path.join(screenshotsDir, `${persona.id}-final-state.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      report.finalScreenshot = shotPath;
    }
  } catch (err) {
    report.error = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    try {
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const shotPath = path.join(screenshotsDir, `${persona.id}-error-state.png`);
      await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
      report.errorScreenshot = shotPath;
    } catch {}
  } finally {
    report.finishedAt = new Date().toISOString();
    await page.close().catch(() => {});
  }

  return report;
}

export function evaluatePersona(persona, report) {
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

  check("no fatal error during run", !report.error, report.error ?? "ran to completion");
  check("reached Blueprint", report.blueprintReached === true, `screensReached: ${report.screensReached.join(" -> ")}`);
  check("no console errors", report.consoleErrors.length === 0, report.consoleErrors.join(" | ") || "none");
  check("no uncaught page errors", report.pageErrors.length === 0, report.pageErrors.join(" | ") || "none");

  if (persona.expectDepthGate !== undefined) {
    check(
      `depth gate ${persona.expectDepthGate ? "fired" : "did not fire"} as expected`,
      report.depthGateFired === persona.expectDepthGate,
      `expected ${persona.expectDepthGate}, got ${report.depthGateFired}`,
    );
  }

  if (persona.screen7?.detailAnswer !== undefined && persona.screen7?.detailAnswer !== null) {
    check(
      "Section 4 detail composition is clean (DETAIL_SEPARATOR fix)",
      report.detailCompositionClean === true,
      report.detailComposedDescription ?? "(no composed description captured)",
    );
  }

  if (persona.expectMinFreeRerolls !== undefined) {
    check(
      `at least ${persona.expectMinFreeRerolls} free reroll(s)`,
      report.freeRerolls >= persona.expectMinFreeRerolls,
      `actual: ${report.freeRerolls}`,
    );
  }

  if (persona.expectReservePoolExhausted) {
    check("reserve pool was actually exhausted", report.reservePoolExhausted === true, `actual: ${report.reservePoolExhausted}`);
    check("a paid reroll followed exhaustion", report.paidRerolls >= 1, `actual: ${report.paidRerolls}`);
  }

  if (persona.screen7?.buildUpon) {
    check("Build-upon edit was respected in the result", report.buildUponEditRespected === true, report.buildUponResultText ?? "(none)");
  }

  if (persona.expectAssociationModes) {
    for (const mode of persona.expectAssociationModes) {
      check(`Association mode "${mode}" appeared`, report.associationModesSeen.includes(mode), report.associationModesSeen.join(", "));
    }
  }

  return checks;
}

export function writeReport(persona, report, checks) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const allPass = checks.every((c) => c.pass);
  const lines = [];
  lines.push(`# Persona report: ${persona.label} (${persona.id})`);
  lines.push("");
  lines.push(`Run: ${report.startedAt} -> ${report.finishedAt}`);
  lines.push(`Overall: ${allPass ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push("## Screens reached");
  lines.push(report.screensReached.join(" -> ") || "(none)");
  lines.push("");
  lines.push("## Key signals");
  lines.push(`- Depth gate fired: ${report.depthGateFired}`);
  if (report.depthAnswerGiven !== undefined) lines.push(`- Depth-exercise answer given: ${JSON.stringify(report.depthAnswerGiven)}`);
  lines.push(`- Association modes seen: ${report.associationModesSeen.join(", ") || "(none)"}`);
  lines.push(`- Candidates visible (first line each): ${JSON.stringify(report.candidatesVisible, null, 2)}`);
  lines.push(`- Free rerolls: ${report.freeRerolls}`);
  lines.push(`- Reserve pool exhausted: ${report.reservePoolExhausted}`);
  lines.push(`- Paid rerolls: ${report.paidRerolls}`);
  if (report.detailAnswerGiven !== undefined) lines.push(`- Detail-answer given: ${JSON.stringify(report.detailAnswerGiven)}`);
  if (report.detailComposedDescription !== undefined) lines.push(`- Composed description: ${JSON.stringify(report.detailComposedDescription)}`);
  if (report.buildUponEditText !== undefined) {
    lines.push(`- Build-upon edit: ${JSON.stringify(report.buildUponEditText)}`);
    lines.push(`- Build-upon result: ${JSON.stringify(report.buildUponResultText)}`);
  }
  lines.push(`- Console errors: ${report.consoleErrors.length}`);
  lines.push(`- Uncaught page errors: ${report.pageErrors.length}`);
  if (report.error) lines.push(`- FATAL ERROR: ${report.error}`);
  lines.push("");
  lines.push("## Assertions");
  for (const c of checks) {
    lines.push(`- [${c.pass ? "PASS" : "FAIL"}] ${c.name} -- ${c.detail}`);
  }
  lines.push("");
  if (report.blueprintScreenshot) lines.push(`Blueprint screenshot: ${report.blueprintScreenshot}`);
  if (report.finalScreenshot) lines.push(`Final-state screenshot (did not reach Blueprint): ${report.finalScreenshot}`);
  if (report.errorScreenshot) lines.push(`Error-state screenshot: ${report.errorScreenshot}`);

  const md = lines.join("\n") + "\n";
  const reportPath = path.join(reportsDir, `${persona.id}.md`);
  fs.writeFileSync(reportPath, md, "utf8");
  fs.writeFileSync(path.join(reportsDir, `${persona.id}.json`), JSON.stringify({ persona, report, checks }, null, 2), "utf8");
  return { reportPath, allPass };
}

export async function main(personas) {
  const stack = await startStack();
  const browser = await chromium.launch(chromiumLaunchOptions());
  const results = [];
  try {
    for (const persona of personas) {
      console.log(`\n=== Running persona: ${persona.label} (${persona.id}) ===`);
      const report = await runPersona(browser, persona);
      const checks = evaluatePersona(persona, report);
      const { reportPath, allPass } = writeReport(persona, report, checks);
      console.log(`  ${allPass ? "PASS" : "FAIL"} -- report: ${reportPath}`);
      for (const c of checks) {
        if (!c.pass) console.log(`    FAIL: ${c.name} -- ${c.detail}`);
      }
      results.push({ persona: persona.id, allPass, checks });
    }
  } finally {
    await browser.close();
    await stopStack(stack);
  }

  console.log("\n=== SUMMARY ===");
  let anyFail = false;
  for (const r of results) {
    console.log(`  ${r.allPass ? "PASS" : "FAIL"}  ${r.persona}`);
    if (!r.allPass) anyFail = true;
  }
  return anyFail ? 1 : 0;
}

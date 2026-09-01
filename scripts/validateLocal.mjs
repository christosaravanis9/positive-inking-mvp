#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  PORTS,
  checkPortFree,
  startStack,
  waitForHttp,
} from "./lib/devStack.mjs";

/**
 * `npm run validate:local` -- one command that runs the complete local
 * diagnostic (environment, build/test, a real stack boot, real Anthropic
 * latency measurements, and a browser journey) and prints a compact
 * PASS/FAIL/BLOCKED report, so you are never the one manually pulling,
 * starting three terminals, clicking through a journey, and reporting
 * individual infrastructure failures one at a time.
 *
 * Every subprocess's full output goes to a timestamped log file (path
 * printed at the end); the terminal only ever sees short progress lines
 * and the final report.
 */

const LOG_DIR = path.join(REPO_ROOT, "logs");
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_PATH = path.join(LOG_DIR, `validate-local-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });

function logVerbose(text) {
  logStream.write(text.endsWith("\n") ? text : text + "\n");
}

function progress(text) {
  console.log(text);
  logVerbose(`[progress] ${text}`);
}

/** One row of the final report. status: "PASS" | "FAIL" | "BLOCKED" | "SKIP". */
const rows = [];
const warnings = [];

function record(name, status, detail = "") {
  rows.push({ name, status, detail });
  logVerbose(`[result] ${name}: ${status}${detail ? ` (${detail})` : ""}`);
}

/** Runs a workspace npm script, capturing output to the log file, returning { ok, elapsedMs, output }. */
function runCommand(label, args, options = {}) {
  const start = Date.now();
  logVerbose(`\n=== ${label} ===\n$ npm ${args.join(" ")}`);
  const result = spawnSync("npm", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 5 * 60 * 1000,
    env: { ...process.env, ...options.env },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  logVerbose(output);
  const elapsedMs = Date.now() - start;
  const ok = result.status === 0 && !result.error;
  if (result.error) logVerbose(`[spawn error] ${result.error.message}`);
  return { ok, elapsedMs, output };
}

function fmtSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// ENVIRONMENT
// ---------------------------------------------------------------------------

function readEnvFile() {
  const envPath = path.join(REPO_ROOT, "server", ".env");
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, "utf8");
  const vars = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

async function runEnvironmentSection() {
  progress("\n[1/5] Environment...");

  const nodeMajor = Number(process.version.slice(1).split(".")[0]);
  record("Node version", nodeMajor >= 20 ? "PASS" : "FAIL", `${process.version}${nodeMajor >= 20 ? "" : " -- Node 20+ required"}`);

  const depsPresent =
    fs.existsSync(path.join(REPO_ROOT, "node_modules", "vitest")) &&
    fs.existsSync(path.join(REPO_ROOT, "node_modules", "vite")) &&
    fs.existsSync(path.join(REPO_ROOT, "node_modules", "express")) &&
    fs.existsSync(path.join(REPO_ROOT, "node_modules", "playwright"));
  record("Dependencies installed", depsPresent ? "PASS" : "FAIL", depsPresent ? "" : "run npm install");

  const envVars = readEnvFile();
  record("server/.env exists", envVars ? "PASS" : "FAIL", envVars ? "" : "copy .env.example to server/.env");

  const apiKeyPresent = Boolean(envVars?.ANTHROPIC_API_KEY?.trim());
  record("ANTHROPIC_API_KEY present", apiKeyPresent ? "PASS" : "BLOCKED", apiKeyPresent ? "value not printed" : "not set -- live API diagnostics will be skipped");

  const model = envVars?.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5-20250929 (default)";
  record("Configured model", "PASS", model);

  let timeoutMatrixDetail = "engine build required to read defaults";
  try {
    const { MODEL_ROUTE_TIMEOUT_DEFAULTS_MS } = await import("@positive-inking/engine");
    const overridden = Object.entries(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS).map(([route, def]) => {
      const envKey = `MODEL_TIMEOUT_${route.toUpperCase()}_MS`;
      const value = envVars?.[envKey] ? Number(envVars[envKey]) : def;
      return `${route}=${value}ms${envVars?.[envKey] ? " (overridden)" : ""}`;
    });
    timeoutMatrixDetail = overridden.join(", ");
    record("Timeout matrix", "PASS", timeoutMatrixDetail);
  } catch (err) {
    record("Timeout matrix", "FAIL", `could not read engine timeout config -- ${err.message}`);
  }

  for (const [label, port] of Object.entries(PORTS)) {
    const status = await checkPortFree(port);
    record(
      `Port ${port} free`,
      status.free ? "PASS" : "FAIL",
      status.free ? "" : `held by ${status.pid ? `PID ${status.pid}${status.command ? ` (${status.command})` : ""}` : "an unknown process"}`,
    );
  }

  return { apiKeyPresent, portsFree: rows.filter((r) => r.name.startsWith("Port ")).every((r) => r.status === "PASS") };
}

// ---------------------------------------------------------------------------
// BUILD / TEST
// ---------------------------------------------------------------------------

function runBuildTestSection() {
  progress("\n[2/5] Build, typecheck, and tests...");

  const engineBuild = runCommand("Engine build", ["run", "build", "-w", "engine"]);
  record("Engine build", engineBuild.ok ? "PASS" : "FAIL", fmtSeconds(engineBuild.elapsedMs));
  if (!engineBuild.ok) {
    record("Typecheck", "BLOCKED", "engine build failed");
    record("Unit tests", "BLOCKED", "engine build failed");
    record("Integration tests", "BLOCKED", "engine build failed");
    record("Dev-server reliability", "BLOCKED", "engine build failed");
    return { engineOk: false };
  }

  const typecheck = runCommand("Typecheck", ["run", "typecheck"]);
  record("Typecheck", typecheck.ok ? "PASS" : "FAIL", fmtSeconds(typecheck.elapsedMs));

  const unitTests = runCommand("Unit tests", ["test"]);
  record("Unit tests", unitTests.ok ? "PASS" : "FAIL", fmtSeconds(unitTests.elapsedMs));

  progress("      Running integration tests (real server, real Vite, fake Anthropic double)...");
  const integration = runCommand("Integration tests", ["run", "test:integration"], { timeoutMs: 3 * 60 * 1000 });
  record("Integration tests", integration.ok ? "PASS" : "FAIL", fmtSeconds(integration.elapsedMs));

  progress("      Running dev-server reliability test (stress-edits engine/src against a live npm run dev)...");
  const devReliability = runCommand("Dev-server reliability", ["run", "test:dev-reliability"], { timeoutMs: 3 * 60 * 1000 });
  record("Dev-server reliability", devReliability.ok ? "PASS" : "FAIL", fmtSeconds(devReliability.elapsedMs));

  return { engineOk: true };
}

// ---------------------------------------------------------------------------
// LOCAL STACK
// ---------------------------------------------------------------------------

async function checkApiRoutesRespond() {
  const routes = [
    "/api/discovery",
    "/api/provenance",
    "/api/associations",
    "/api/blueprint",
    "/api/avoidances",
    "/api/style-reference",
  ];
  let okCount = 0;
  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:${PORTS.server}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      });
      // A mounted route rejects an empty body with 400 bad_request; anything
      // that responds at all (never a connection failure) proves it's wired up.
      if (res.status < 500) okCount += 1;
      logVerbose(`[api-route-check] ${route} -> ${res.status}`);
    } catch (err) {
      logVerbose(`[api-route-check] ${route} -> unreachable (${err.message})`);
    }
  }
  return { okCount, total: routes.length };
}

async function runLocalStackSection(engineOk) {
  progress("\n[3/5] Local stack (real engine watch + server + web)...");

  if (!engineOk) {
    record("Dev stack startup", "BLOCKED", "engine build failed earlier");
    record(`Server :${PORTS.server}`, "BLOCKED", "");
    record(`Web :${PORTS.web}`, "BLOCKED", "");
    record("API routes respond", "BLOCKED", "");
    record("Clean shutdown", "BLOCKED", "");
    return;
  }

  let stack;
  try {
    stack = await startStack({ onLog: (label, text) => logVerbose(`[${label}] ${text}`) });
  } catch (err) {
    record("Dev stack startup", "FAIL", err.message);
    record(`Server :${PORTS.server}`, "BLOCKED", "");
    record(`Web :${PORTS.web}`, "BLOCKED", "");
    record("API routes respond", "BLOCKED", "");
    record("Clean shutdown", "BLOCKED", "");
    return;
  }

  const { readiness, stop } = stack;
  record("Dev stack startup", readiness.engine.up && readiness.server.up && readiness.web.up ? "PASS" : "FAIL");
  record(`Server :${PORTS.server}`, readiness.server.up ? "PASS" : "FAIL");
  record(`Web :${PORTS.web}`, readiness.web.up ? "PASS" : "FAIL");

  if (readiness.server.up && readiness.web.up) {
    const webResponds = await waitForHttp(`http://localhost:${PORTS.web}/`, { timeoutMs: 5000 });
    record("Browser-facing app responds", webResponds ? "PASS" : "FAIL");

    const apiCheck = await checkApiRoutesRespond();
    record("API routes respond", apiCheck.okCount === apiCheck.total ? "PASS" : "FAIL", `${apiCheck.okCount}/${apiCheck.total}`);
  } else {
    record("Browser-facing app responds", "BLOCKED", "stack did not come up");
    record("API routes respond", "BLOCKED", "stack did not come up");
  }

  await stop();
  await new Promise((r) => setTimeout(r, 500));
  const [serverFree, webFree] = await Promise.all([checkPortFree(PORTS.server), checkPortFree(PORTS.web)]);
  record("Clean shutdown", serverFree.free && webFree.free ? "PASS" : "FAIL", serverFree.free && webFree.free ? "" : "a port is still held after teardown");
}

// ---------------------------------------------------------------------------
// REAL MODEL DIAGNOSTICS
// ---------------------------------------------------------------------------

function runLiveDiagnosticsSection(apiKeyPresent) {
  progress("\n[4/5] Real Anthropic API latency diagnostics (Discovery, Association, Blueprint)...");

  if (!apiKeyPresent) {
    record("Discovery live API", "BLOCKED", "ANTHROPIC_API_KEY not set");
    record("Association live API", "BLOCKED", "ANTHROPIC_API_KEY not set");
    record("Blueprint live API", "BLOCKED", "ANTHROPIC_API_KEY not set");
    return { model: null, results: [] };
  }

  progress("      This makes 3 real Anthropic calls; each may take up to 120s...");
  const diag = spawnSync("npm", ["run", "diagnose-model", "-w", "server"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 6 * 60 * 1000,
    env: process.env,
  });
  logVerbose(`\n=== Real model diagnostics ===\n${diag.stdout ?? ""}${diag.stderr ?? ""}`);

  const lines = (diag.stdout ?? "").split("\n");
  let model = null;
  const results = [];
  for (const line of lines) {
    if (line.startsWith("DIAGNOSTIC_MODEL ")) {
      model = JSON.parse(line.slice("DIAGNOSTIC_MODEL ".length)).model;
    } else if (line.startsWith("DIAGNOSTIC_BLOCKED ")) {
      const reason = JSON.parse(line.slice("DIAGNOSTIC_BLOCKED ".length)).reason;
      record("Discovery live API", "BLOCKED", reason);
      record("Association live API", "BLOCKED", reason);
      record("Blueprint live API", "BLOCKED", reason);
      return { model, results };
    } else if (line.startsWith("DIAGNOSTIC_RESULT ")) {
      results.push(JSON.parse(line.slice("DIAGNOSTIC_RESULT ".length)));
    }
  }

  const label = { discovery: "Discovery live API", association: "Association live API", blueprint: "Blueprint live API" };
  for (const stage of ["discovery", "association", "blueprint"]) {
    const result = results.find((r) => r.stage === stage);
    if (!result) {
      record(label[stage], "FAIL", "no diagnostic result returned (see log)");
      continue;
    }
    const status = result.outcome === "success" ? "PASS" : "FAIL";
    record(label[stage], status, `${fmtSeconds(result.elapsedMs)}${status === "FAIL" ? ` -- ${result.outcome}` : ""}`);
    if (result.outcome === "success" && result.elapsedMs > result.productionBudgetMs) {
      warnings.push(
        `${label[stage].replace(" live API", "")} exceeded its production budget by ${fmtSeconds(result.elapsedMs - result.productionBudgetMs)}.`,
      );
    }
  }

  return { model, results };
}

// ---------------------------------------------------------------------------
// END-TO-END BROWSER JOURNEY
// ---------------------------------------------------------------------------

function runBrowserJourneySection(engineOk) {
  progress("\n[5/5] Browser journey (real server, real Vite, real engine, fake model responses)...");

  if (!engineOk) {
    record("Browser journey", "BLOCKED", "engine build failed earlier");
    return;
  }

  const result = spawnSync("node", [path.join(REPO_ROOT, "test-integration", "localValidationJourney.mjs")], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 3 * 60 * 1000,
  });
  logVerbose(`\n=== Browser journey ===\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  record("Browser journey", result.status === 0 ? "PASS" : "FAIL", result.status === 0 ? "" : "see log for which check failed");
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------

function printReport(model) {
  console.log("\nPOSITIVE INKING LOCAL VALIDATION\n");
  const nameWidth = Math.max(...rows.map((r) => r.name.length)) + 2;
  for (const row of rows) {
    const detail = row.detail ? `  ${row.detail}` : "";
    console.log(`${row.name.padEnd(nameWidth)}${row.status.padEnd(9)}${detail}`);
  }

  if (model) {
    console.log(`\nConfigured model: ${model}`);
  }

  console.log("\nLatency targets:");
  console.log("Discovery production budget: 16s");
  console.log("Association production budget: 30s");
  console.log("Blueprint production budget: 30s");

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(w);
  }

  const hasFail = rows.some((r) => r.status === "FAIL") || warnings.length > 0;
  const hasBlocked = rows.some((r) => r.status === "BLOCKED");
  let overall;
  let overallReason = "";
  if (hasFail) {
    overall = "FAIL";
    if (warnings.length > 0 && !rows.some((r) => r.status === "FAIL")) {
      overallReason = " — Association latency requires a product/architecture decision.";
    }
  } else if (hasBlocked) {
    overall = "BLOCKED";
    overallReason = " — see BLOCKED rows above for what this machine is missing.";
  } else {
    overall = "PASS";
  }

  console.log(`\nOVERALL: ${overall}${overallReason}`);
  console.log(`\nFull log: ${LOG_PATH}`);
}

async function main() {
  logVerbose(`Positive Inking local validation started at ${new Date().toISOString()}`);

  const { apiKeyPresent } = await runEnvironmentSection();
  const { engineOk } = runBuildTestSection();
  await runLocalStackSection(engineOk);
  const { model } = runLiveDiagnosticsSection(apiKeyPresent);
  runBrowserJourneySection(engineOk);

  printReport(model);
  logStream.end();

  const hasFail = rows.some((r) => r.status === "FAIL") || warnings.length > 0;
  process.exitCode = hasFail ? 1 : 0;
}

main().catch((err) => {
  logVerbose(`[fatal] ${err.stack ?? err.message}`);
  console.error("\nvalidate:local crashed:", err.message);
  console.error(`See ${LOG_PATH} for detail.`);
  process.exitCode = 1;
});

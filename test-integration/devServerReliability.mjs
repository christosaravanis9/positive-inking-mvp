import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

/**
 * DEV SERVER INVARIANT (see docs/dev-server-reliability.md): a normal
 * source change in engine/src must never leave the backend dead. This runs
 * the REAL `npm run dev` (all three processes: engine's tsc --watch,
 * server's tsx watch, web's vite) and repeatedly edits engine source files
 * while asserting the server's health endpoint recovers after each burst.
 *
 * This is a verification script, not a production wrapper -- it does not
 * add any restart-on-crash logic to the app's own dev tooling. It only
 * checks that the dev command, as shipped, keeps the backend reachable
 * across the exact edit pattern that used to crash it (tsx watching raw
 * engine TypeScript source through the workspace symlink).
 *
 * Run: node test-integration/devServerReliability.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const HEALTH_URL = "http://localhost:8787/api/health";
const ENGINE_FILES = [
  "visualRanking.ts",
  "screenFlow.ts",
  "budget.ts",
  "artisticDimensions.ts",
  "composition.ts",
  "newIdea.ts",
  "discoveryRouting.ts",
  "signals.ts",
  "readiness.ts",
  "fidelity.ts",
].map((f) => path.join(repoRoot, "engine", "src", f));

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log(`  PASS: ${description}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${description}`);
  }
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function burstEditEngineFiles(round) {
  return Promise.all(
    ENGINE_FILES.map(
      (file) =>
        new Promise((resolve, reject) => {
          fs.appendFile(file, `// dev-reliability-stress-test round ${round}\n`, (err) => (err ? reject(err) : resolve()));
        }),
    ),
  );
}

function revertEngineFiles() {
  try {
    execSync("git checkout -- " + ENGINE_FILES.map((f) => `"${f}"`).join(" "), { cwd: repoRoot, stdio: "pipe" });
  } catch (err) {
    console.log("  (cleanup) could not git-revert engine files:", err.message);
  }
}

function killTree(pid) {
  try {
    // Negative PID targets the whole process group (dev.sh's child processes
    // all share the group of the spawned npm process below).
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

async function main() {
  console.log("=== Reverting any stray edits to the stress-test engine files first ===");
  revertEngineFiles();

  console.log("=== Starting REAL `npm run dev` (engine watch-build + server tsx watch + web vite) ===");
  const devProcess = spawn("npm", ["run", "dev"], {
    cwd: repoRoot,
    env: { ...process.env, ANTHROPIC_API_KEY: "test-key-for-dev-reliability-test" },
    detached: true, // own process group, so killTree can take down every descendant
  });
  devProcess.stdout.on("data", (d) => process.stdout.write(`[dev] ${d}`));
  devProcess.stderr.on("data", (d) => process.stderr.write(`[dev:err] ${d}`));

  try {
    const initiallyUp = await waitForHealth(30000);
    check(initiallyUp, "server comes up initially");
    if (!initiallyUp) throw new Error("server never started -- aborting further checks");

    for (let round = 1; round <= 4; round += 1) {
      console.log(`\n--- Round ${round}: parallel burst edit across ${ENGINE_FILES.length} engine source files ---`);
      await burstEditEngineFiles(round);
      // Give the watch-build + restart cycle a moment to actually begin before polling.
      await new Promise((r) => setTimeout(r, 500));
      const recovered = await waitForHealth(20000);
      check(recovered, `server is reachable again after burst edit round ${round} (DEV SERVER INVARIANT)`);
      if (!recovered) {
        console.log("  Server did not recover -- this is the exact failure the async-state-report described.");
      }
    }

    // One more edit, then confirm no duplicate/zombie tsx child processes accumulated.
    await burstEditEngineFiles("final");
    await new Promise((r) => setTimeout(r, 3000));
    const finalUp = await waitForHealth(15000);
    check(finalUp, "server still reachable after the full stress sequence");

    // Count only the actual Node process running the app (tsx's ESM loader is
    // injected via --import), not the intermediate "sh -c" wrapper shells that
    // also contain the literal string "tsx watch src/index.ts" in their command
    // line and would otherwise double-count a single real instance.
    let tsxChildCount = 0;
    try {
      const psOutput = execSync("ps -ef | grep -c '[t]sx/dist/loader.mjs'", { encoding: "utf8" }).trim();
      tsxChildCount = Number(psOutput);
    } catch {
      tsxChildCount = 0;
    }
    check(tsxChildCount <= 1, `no duplicate/leaked tsx app processes (found: ${tsxChildCount})`);
  } finally {
    console.log("\n=== Tearing down dev processes ===");
    if (devProcess.pid) killTree(devProcess.pid);
    await new Promise((r) => setTimeout(r, 1000));
    revertEngineFiles();
  }

  console.log(`\n=== ${failures === 0 ? "DEV SERVER INVARIANT HOLDS" : `${failures} CHECK(S) FAILED`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

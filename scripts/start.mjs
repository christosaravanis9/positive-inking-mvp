#!/usr/bin/env node
import {
  startStack,
  terminateAll,
  PortConflictError,
  PORTS,
  REPO_ROOT,
  gitInfo,
  validateEnvBeforeStart,
  readStackMarker,
  writeStackMarker,
  clearStackMarker,
  isOwnedByThisRepo,
  terminatePidGroup,
  checkPortFree,
} from "./lib/devStack.mjs";

/**
 * `npm run start` -- the single command meant to close out tonight's actual
 * bottleneck: port conflicts, stale git pulls, and not knowing whether the
 * running code matches what's pushed. It wraps the same startStack() that
 * `npm run dev` already uses (dev.mjs is untouched and still works exactly
 * as before), adding everything that turned tonight's session into lost
 * time instead of forward progress:
 *
 *   - reclaims a stale copy of THIS project's own processes automatically
 *     (never touches anything it can't prove belongs to this repo)
 *   - fails fast, before spawning anything, if server/.env or the API key
 *     is missing
 *   - prints a success banner that's genuinely hard to miss or misread
 *
 * The git commit/branch identifier that tonight was missing lives in the
 * running app itself (web/vite.config.ts + Journey.tsx), not here -- this
 * script's job is just to get the stack up reliably.
 */

const LABEL_WIDTH = 6;
function printLine(label, text) {
  const prefix = `[${label}]`.padEnd(LABEL_WIDTH + 2);
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    process.stdout.write(`${prefix} ${line}\n`);
  }
}

/** Kills any PIDs recorded by a previous `npm run start` that are still alive AND still provably this repo's own processes. This is what makes "start the stack, don't stop it cleanly, start again" recover without manual intervention -- the engine watcher holds no port, so port-conflict detection alone would miss it. */
async function reclaimStaleMarkedProcesses() {
  const marker = readStackMarker();
  if (!marker?.pids) return;

  const stalePids = Object.entries(marker.pids).filter(([, pid]) => isOwnedByThisRepo(pid));
  if (stalePids.length === 0) {
    clearStackMarker();
    return;
  }

  console.log(`A previous "npm run start" (commit ${marker.commit ?? "unknown"}, started ${marker.startedAt ?? "unknown time"}) left processes running:`);
  for (const [label, pid] of stalePids) {
    console.log(`  reclaiming ${label} (PID ${pid}) -- confirmed it's this repo's own process (cwd matches), stopping it...`);
    await terminatePidGroup(pid);
  }
  clearStackMarker();
}

/** Same reclaim logic, but for a port that's occupied by this repo's own process even though it wasn't (or couldn't be) recorded in the marker -- e.g. the marker was deleted by hand. Anything NOT provably ours still fails clearly, same as today. */
async function reclaimStalePort(port) {
  const status = await checkPortFree(port);
  if (status.free) return;
  if (!status.pid || !isOwnedByThisRepo(status.pid)) return; // let preflightPorts report it normally
  console.log(`Port ${port} is held by PID ${status.pid} (${status.command ?? "unknown"}) -- confirmed it's this repo's own process (cwd matches), reclaiming it...`);
  await terminatePidGroup(status.pid);
}

async function main() {
  console.log("Starting Positive Inking (full stack)...\n");

  const envCheck = validateEnvBeforeStart();
  if (!envCheck.ok) {
    console.error(`✗ ${envCheck.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ server/.env present, ANTHROPIC_API_KEY set (value not printed)");

  await reclaimStaleMarkedProcesses();
  await reclaimStalePort(PORTS.server);
  await reclaimStalePort(PORTS.web);

  let stack;
  try {
    stack = await startStack({ onLog: printLine });
  } catch (err) {
    if (err instanceof PortConflictError) {
      console.error(`\n✗ ${err.message}`);
      console.error(`  This does not look like this project's own process (its working directory doesn't match this repo), so it was left alone.`);
      console.error(`  Free it yourself first, e.g.: kill ${err.owner?.pid ?? "<pid>"}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const { readiness, children, stop } = stack;

  if (!readiness.engine.up || !readiness.server.up || !readiness.web.up || readiness.diedEarly) {
    console.error("\n✗ Dev stack failed to start cleanly:");
    if (readiness.diedEarly) {
      console.error(`  - ${readiness.diedEarly.label} exited early (code ${readiness.diedEarly.code}, signal ${readiness.diedEarly.signal})`);
    }
    if (!readiness.engine.up) console.error(`  - engine watcher did not come up${readiness.engine.sawCompileError ? " (TypeScript compile error -- see output above)" : ""}`);
    if (!readiness.server.up) console.error(`  - server did not respond on http://localhost:${PORTS.server}/api/health`);
    if (!readiness.web.up) console.error(`  - web did not respond on http://localhost:${PORTS.web}/`);
    console.error("\n  Full output is above. Everything has been shut down.");
    process.exitCode = 1;
    return;
  }

  const { commit, branch } = gitInfo();
  writeStackMarker({
    pids: { engine: children.engine.pid, server: children.server.pid, web: children.web.pid },
    commit,
    branch,
  });

  const url = `http://localhost:${PORTS.web}`;
  const banner = [
    "",
    "=".repeat(60),
    "  POSITIVE INKING IS RUNNING",
    "=".repeat(60),
    "",
    `  Open this in your browser:`,
    "",
    `      ${url}`,
    "",
    `  Running commit:  ${commit} on branch ${branch}`,
    `  engine  watching (rebuilds on every engine/src change)`,
    `  server  http://localhost:${PORTS.server}`,
    `  web     ${url}`,
    "",
    `  Stop with Ctrl+C here, or from another terminal: npm run stop`,
    "=".repeat(60),
    "",
  ].join("\n");
  console.log(banner);

  let shuttingDown = false;

  for (const [label, child] of Object.entries(children)) {
    child.once("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`\n✗ ${label} exited unexpectedly (code ${code}, signal ${signal}) -- shutting down the rest of the stack.`);
      shuttingDown = true;
      clearStackMarker();
      terminateAll(Object.values(children)).then(() => process.exit(1));
    });
  }

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal} -- shutting down engine, server, and web...`);
    await stop();
    clearStackMarker();
    console.log("Clean shutdown complete.");
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

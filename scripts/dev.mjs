#!/usr/bin/env node
import { startStack, terminateAll, PortConflictError, PORTS } from "./lib/devStack.mjs";

/**
 * `npm run dev` -- the single command that brings up the whole local
 * stack (engine watch-build, server, web) reliably: fails fast and names
 * the exact PID if a port is already taken, forwards every child's output
 * live with a clear prefix, and guarantees Ctrl+C tears the entire process
 * tree down (no orphaned tsx/esbuild/vite processes, no held ports) so the
 * very next `npm run dev` just works.
 */

const LABEL_WIDTH = 6;
function printLine(label, text) {
  const prefix = `[${label}]`.padEnd(LABEL_WIDTH + 2);
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    process.stdout.write(`${prefix} ${line}\n`);
  }
}

async function main() {
  console.log("Starting Positive Inking local dev stack...\n");

  let stack;
  try {
    stack = await startStack({ onLog: printLine });
  } catch (err) {
    if (err instanceof PortConflictError) {
      console.error(`\n✗ ${err.message}`);
      console.error(`  Free it first, e.g.: kill ${err.owner?.pid ?? "<pid>"}`);
      console.error(`  (or, if it's an old copy of this project's own server/web, that's almost certainly what's running there)`);
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

  console.log("\n✓ Dev stack is up:");
  console.log(`  engine  watching (rebuilds engine/dist on every engine/src change)`);
  console.log(`  server  http://localhost:${PORTS.server}`);
  console.log(`  web     http://localhost:${PORTS.web}`);
  console.log("\nOpen http://localhost:5173 -- Ctrl+C to stop the whole stack.\n");

  let shuttingDown = false;

  for (const [label, child] of Object.entries(children)) {
    child.once("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`\n✗ ${label} exited unexpectedly (code ${code}, signal ${signal}) -- shutting down the rest of the stack.`);
      shuttingDown = true;
      terminateAll(Object.values(children)).then(() => process.exit(1));
    });
  }

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal} -- shutting down engine, server, and web...`);
    await stop();
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

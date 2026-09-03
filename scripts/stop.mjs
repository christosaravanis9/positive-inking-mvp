#!/usr/bin/env node
import {
  PORTS,
  readStackMarker,
  clearStackMarker,
  isOwnedByThisRepo,
  isPidAlive,
  terminatePidGroup,
  checkPortFree,
} from "./lib/devStack.mjs";

/**
 * `npm run stop` -- stops ONLY this project's own processes, without the
 * user having to find and kill PIDs by hand. Two sources of truth, both
 * used, because either one alone can miss something:
 *
 *   1. The marker file `npm run start` wrote (has the engine watcher's PID,
 *      which holds no port and so can't be found by port lookup alone).
 *   2. A live port check for :8787 and :5173, in case the marker is stale,
 *      missing, or the stack was started some other way (`npm run dev`).
 *
 * Anything that isn't provably this repo's own process (working directory
 * doesn't match) is left alone and reported, never killed.
 */

async function stopFromMarker() {
  const marker = readStackMarker();
  if (!marker?.pids) return { found: false };

  console.log(`Found a running stack from "npm run start" (commit ${marker.commit ?? "unknown"}, started ${marker.startedAt ?? "unknown time"}):`);
  let stoppedAny = false;
  for (const [label, pid] of Object.entries(marker.pids)) {
    if (!isPidAlive(pid)) {
      console.log(`  ${label} (PID ${pid}) -- already stopped`);
      continue;
    }
    if (!isOwnedByThisRepo(pid)) {
      console.log(`  ${label} (PID ${pid}) -- alive, but its working directory no longer matches this repo; leaving it alone`);
      continue;
    }
    console.log(`  stopping ${label} (PID ${pid})...`);
    await terminatePidGroup(pid);
    stoppedAny = true;
  }
  clearStackMarker();
  return { found: true, stoppedAny };
}

async function stopStrayPort(port) {
  const status = await checkPortFree(port);
  if (status.free) return;
  if (!status.pid) {
    console.log(`Port ${port} is still occupied but its owner couldn't be identified (lsof unavailable) -- leaving it alone.`);
    return;
  }
  if (!isOwnedByThisRepo(status.pid)) {
    console.log(`Port ${port} is held by PID ${status.pid} (${status.command ?? "unknown"}), which is not this repo's own process -- leaving it alone.`);
    return;
  }
  console.log(`Port ${port} is still held by PID ${status.pid} (${status.command ?? "unknown"}), confirmed this repo's own process -- stopping it...`);
  await terminatePidGroup(status.pid);
}

async function main() {
  const { found } = await stopFromMarker();
  if (!found) console.log("No record of a stack started with \"npm run start\" -- checking known ports directly...");

  await stopStrayPort(PORTS.server);
  await stopStrayPort(PORTS.web);

  const [serverFree, webFree] = await Promise.all([checkPortFree(PORTS.server), checkPortFree(PORTS.web)]);
  if (serverFree.free && webFree.free) {
    console.log("\n✓ Stopped. Ports 8787 and 5173 are free.");
  } else {
    console.log("\nSome ports are still occupied by processes that aren't this project's own -- see above.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

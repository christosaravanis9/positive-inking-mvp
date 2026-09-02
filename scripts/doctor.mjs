#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  REPO_ROOT,
  PORTS,
  checkPortFree,
  isOwnedByThisRepo,
  isPidAlive,
  readServerEnvFile,
  readLastKnownGood,
  readStackMarker,
} from "./lib/devStack.mjs";

/**
 * `npm run doctor` -- one command that answers "why is this behaving
 * strangely" before you burn time debugging against the wrong assumption.
 * Read-only: it never kills a process, never mutates git state (it does
 * attempt a best-effort `git fetch` so "behind origin" reflects reality,
 * not just whatever was last fetched -- but a failed/offline fetch just
 * degrades that one line, it never blocks the report).
 */

function run(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function reportGit() {
  console.log("GIT");
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const head = run(["rev-parse", "--short", "HEAD"]) ?? "unknown";
  const dirty = run(["status", "--porcelain"]);
  console.log(`  branch:        ${branch}`);
  console.log(`  HEAD:          ${head}${dirty ? " (uncommitted changes present)" : ""}`);

  const upstream = run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (!upstream) {
    console.log(`  upstream:      none configured -- can't tell if this is behind origin`);
    return;
  }

  const fetch = spawnSync("git", ["fetch", "--quiet", "origin", branch], { cwd: REPO_ROOT, encoding: "utf8", timeout: 15000 });
  const fetchOk = fetch.status === 0 && !fetch.error;
  if (!fetchOk) {
    console.log(`  upstream:      ${upstream} -- could not fetch (offline?); comparing against last-known remote state`);
  }

  const counts = run(["rev-list", "--left-right", "--count", `HEAD...${upstream}`]);
  if (!counts) {
    console.log(`  vs ${upstream}: could not compare`);
    return;
  }
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  if (ahead === 0 && behind === 0) {
    console.log(`  vs ${upstream}: up to date${fetchOk ? "" : " (as of last fetch)"}`);
  } else {
    console.log(
      `  vs ${upstream}: ${ahead} commit(s) ahead, ${behind} commit(s) behind${fetchOk ? "" : " (as of last fetch, not live)"}${
        behind > 0 ? " -- you are looking at OLD code, pull before debugging further" : ""
      }`,
    );
  }
}

async function reportPorts() {
  console.log("\nPORTS");
  for (const [label, port] of Object.entries(PORTS)) {
    const status = await checkPortFree(port);
    if (status.free) {
      console.log(`  ${label} :${port}   free`);
      continue;
    }
    const owned = status.pid ? isOwnedByThisRepo(status.pid) : false;
    const who = status.pid ? `PID ${status.pid}${status.command ? ` (${status.command})` : ""}` : "unknown process";
    console.log(`  ${label} :${port}   occupied by ${who}${owned ? " -- this repo's own process" : status.pid ? " -- NOT this repo (unrelated)" : ""}`);
  }
}

function reportEnv() {
  console.log("\nENVIRONMENT");
  const vars = readServerEnvFile();
  if (!vars) {
    console.log("  server/.env:          missing");
    console.log("  ANTHROPIC_API_KEY:    n/a");
    return;
  }
  console.log("  server/.env:          present");
  console.log(`  ANTHROPIC_API_KEY:    ${vars.ANTHROPIC_API_KEY?.trim() ? "set (value not printed)" : "MISSING"}`);
}

function reportLastKnownGood() {
  console.log("\nLAST KNOWN GOOD (from npm run validate:local)");
  const lkg = readLastKnownGood();
  const head = run(["rev-parse", "--short", "HEAD"]) ?? "unknown";
  if (!lkg) {
    console.log("  no record -- npm run validate:local has never fully passed on this checkout");
    return;
  }
  console.log(`  last full pass:       commit ${lkg.commit} on ${lkg.branch}, at ${lkg.validatedAt}`);
  console.log(`  current HEAD:         ${head}`);
  console.log(head === lkg.commit ? "  match -- HEAD is the last commit that fully validated" : "  DIFFERENT -- HEAD has moved since the last full validation pass");
}

function reportRunningStack() {
  console.log("\nRUNNING STACK (from npm run start)");
  const marker = readStackMarker();
  if (!marker?.pids) {
    console.log("  no record of a stack started with npm run start");
    return;
  }
  const alive = Object.entries(marker.pids).filter(([, pid]) => isPidAlive(pid));
  console.log(`  started:              commit ${marker.commit} on ${marker.branch}, at ${marker.startedAt}`);
  console.log(`  still running:        ${alive.length > 0 ? alive.map(([label]) => label).join(", ") : "none (all stopped)"}`);
}

async function main() {
  console.log("POSITIVE INKING DOCTOR\n");
  reportGit();
  await reportPorts();
  reportEnv();
  reportLastKnownGood();
  reportRunningStack();
  console.log("");
}

main();

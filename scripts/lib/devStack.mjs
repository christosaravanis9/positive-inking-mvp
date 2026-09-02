import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The one shared implementation of "how to start/stop the local dev stack"
 * -- used by both scripts/dev.mjs (interactive) and scripts/validateLocal.mjs
 * (programmatic). Before this module, only npm run dev's `concurrently`
 * invocation knew how to start the stack, and nothing owned clean teardown
 * -- which is exactly why orphaned tsx/esbuild processes and stuck ports
 * kept surviving Ctrl+C. Every process here is spawned with its own
 * detached process group (the same technique already proven in
 * test-integration/devServerReliability.mjs's killTree) so a single
 * SIGTERM-then-SIGKILL to -pid takes down that tool's entire subtree
 * (npm's own child, tsx's supervised app process, esbuild's shared
 * service, vite) -- not just the immediate child.
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PORTS = { server: 8787, web: 5173 };

/** Where `npm run start` records the PIDs it launched, so `npm run stop` and `npm run doctor` can find them without the user hunting PIDs by hand. Git-ignored -- purely a runtime marker. */
export const STACK_MARKER_PATH = path.join(REPO_ROOT, ".dev-stack.json");

/** Where `npm run validate:local` records the last commit that passed a full validation run, so `npm run doctor` can tell you if you've drifted from it. Git-ignored -- purely a runtime marker. */
export const LAST_KNOWN_GOOD_PATH = path.join(REPO_ROOT, ".last-known-good-commit.json");

export class PortConflictError extends Error {
  constructor(port, owner) {
    const detail = owner?.pid
      ? `PID ${owner.pid}${owner.command ? ` (${owner.command})` : ""}`
      : "an unknown process (lsof unavailable -- could not identify it)";
    super(`Port ${port} is already in use by ${detail}.`);
    this.name = "PortConflictError";
    this.port = port;
    this.owner = owner;
  }
}

/** Resolves a listening PID + command name for `port` via lsof, when available. */
function findPortOwnerViaLsof(port) {
  try {
    const out = execFileSync("lsof", ["-t", "-i", `:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pid = out.trim().split("\n").filter(Boolean)[0];
    if (!pid) return null;
    let command = "";
    try {
      command = execFileSync("ps", ["-p", pid, "-o", "comm="], { encoding: "utf8" }).trim();
    } catch {
      // ps failed -- still report the PID, just without a command name.
    }
    return { pid, command };
  } catch (err) {
    if (err.code === "ENOENT") return "lsof_missing";
    // lsof exits non-zero (typically 1) with no output when nothing is listening.
    return null;
  }
}

/** Fallback when lsof itself isn't installed: a raw TCP connect attempt, which detects occupancy but never a PID. */
function isPortOpenRaw(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

/** Returns { free: true } or { free: false, pid?, command? } -- never throws. */
export async function checkPortFree(port) {
  const owner = findPortOwnerViaLsof(port);
  if (owner === null) return { free: true };
  if (owner === "lsof_missing") {
    const open = await isPortOpenRaw(port);
    return open ? { free: false } : { free: true };
  }
  return { free: false, pid: owner.pid, command: owner.command };
}

/**
 * Throws PortConflictError (naming the exact PID/command where available)
 * for the first port still occupied after a short settle window. A process
 * that was just SIGKILLed (e.g. the previous `npm run dev`, or an
 * integration test's own teardown) can take a brief moment for the OS to
 * actually release the socket -- observed directly running
 * validate:local's LOCAL STACK section immediately after the dev-server-
 * reliability test's teardown, which otherwise reported a false conflict
 * against a PID that had, in fact, already exited. This is exactly the
 * "restarting npm run dev immediately afterwards must work" requirement,
 * so a real, currently-listening process is still reported precisely --
 * only a port that clears within the settle window is treated as a
 * transient teardown race rather than a genuine conflict.
 */
export async function preflightPorts(ports = [PORTS.server, PORTS.web], { retries = 4, retryDelayMs = 400 } = {}) {
  for (const port of ports) {
    let status = await checkPortFree(port);
    for (let attempt = 0; !status.free && attempt < retries; attempt += 1) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      status = await checkPortFree(port);
    }
    if (!status.free) throw new PortConflictError(port, status);
  }
}

/** Spawns `command args` as its own detached process group, so terminateManaged can take down its entire subtree. */
export function spawnManaged(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    ...options,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.label = label;
  return child;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone */
    }
  }
}

/** True if `pid` is currently alive (signal 0 is a no-op existence probe, never actually sent). */
export function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * True only if `pid` is both alive AND its working directory is this repo
 * (or a path inside it, e.g. a workspace package -- `npm run dev -w engine`
 * chdirs into engine/). This is the check that lets start/stop distinguish
 * "a stale copy of this project's own processes" (safe to auto-kill) from
 * "some unrelated process that happens to be squatting the port" (never
 * touched -- reported by PID/command instead, same as today).
 */
export function isOwnedByThisRepo(pid) {
  if (!isPidAlive(pid)) return false;
  try {
    const out = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const cwdLine = out.split("\n").find((line) => line.startsWith("n"));
    const cwd = cwdLine ? cwdLine.slice(1) : null;
    return Boolean(cwd && path.resolve(cwd).startsWith(REPO_ROOT));
  } catch {
    // lsof missing or the PID vanished between isPidAlive and this call --
    // either way we can't prove ownership, so never auto-kill.
    return false;
  }
}

/** Waits up to timeoutMs for `pid` to no longer exist, polling every 100ms. */
async function waitForPidExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isPidAlive(pid);
}

/** Same SIGTERM-then-SIGKILL escalation as terminateManaged, but for a bare PID recorded from a previous process (e.g. read back from the stack marker file) rather than a live child handle. */
export async function terminatePidGroup(pid, { graceMs = 3000 } = {}) {
  if (!isPidAlive(pid)) return;
  killGroup(pid, "SIGTERM");
  const exited = await waitForPidExit(pid, graceMs);
  if (!exited) {
    killGroup(pid, "SIGKILL");
    await waitForPidExit(pid, 2000);
  }
}

/**
 * SIGTERM the whole process group, wait a grace period, SIGKILL if it's
 * still alive. Always signals the group -- even when the directly-tracked
 * child (e.g. the `npm` process for "npm run dev -w engine") has already
 * exited -- because a grandchild it spawned (e.g. `tsc --watch`, which
 * retains the same process-group id) can survive as an orphan. Observed
 * directly: a crash-triggered shutdown where the tracked npm process had
 * already died left tsc running, un-killed, because an earlier version of
 * this function skipped signaling the group entirely once the tracked
 * child's own exit had already fired.
 */
export async function terminateManaged(child, { graceMs = 3000 } = {}) {
  if (!child?.pid) return;
  killGroup(child.pid, "SIGTERM");
  if (child.exitCode !== null || child.signalCode !== null) {
    // The tracked child is already gone -- give any surviving group member
    // a moment to react to the SIGTERM just sent, then make sure with SIGKILL.
    await new Promise((r) => setTimeout(r, 300));
    killGroup(child.pid, "SIGKILL");
    return;
  }
  const exited = await waitForExit(child, graceMs);
  if (!exited) {
    killGroup(child.pid, "SIGKILL");
    await waitForExit(child, 2000);
  }
}

export async function terminateAll(children) {
  await Promise.all(children.filter(Boolean).map((c) => terminateManaged(c)));
}

/**
 * Playwright launch options for Chromium. Never hardcodes this sandbox's
 * own browser path -- on a real developer machine (e.g. the Mac this is
 * meant to run on), Playwright resolves its normally-installed browser
 * automatically as long as `npx playwright install chromium` has been run
 * once. Only the pre-provisioned sandbox path here needs an explicit
 * override, and it's detected rather than assumed.
 */
export function chromiumLaunchOptions() {
  const sandboxPath = "/opt/pw-browsers/chromium";
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
  if (fs.existsSync(sandboxPath)) return { executablePath: sandboxPath };
  return {};
}

/** Polls a URL until it responds (any status < 500 counts as "up"), or timeoutMs elapses. */
export async function waitForHttp(url, { timeoutMs = 20000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/** Current commit (short hash) and branch name -- used both for the always-visible dev-app build identifier and for `npm run doctor`. Never throws: a repo in a detached/weird state just reports "unknown" rather than crashing the caller. */
export function gitInfo() {
  const run = (args) => {
    try {
      return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  };
  const commit = run(["rev-parse", "--short", "HEAD"]) ?? "unknown";
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const dirty = run(["status", "--porcelain"]);
  return { commit, branch, dirty: Boolean(dirty && dirty.length > 0) };
}

/** Parses server/.env the same simple way validateLocal.mjs does. Returns null if the file doesn't exist. */
export function readServerEnvFile() {
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

/**
 * Fail-fast environment check for `npm run start`: confirms server/.env
 * exists and ANTHROPIC_API_KEY is non-empty, without ever reading the value
 * into a log or return value that could get printed. Returns
 * { ok: true } or { ok: false, reason: string }.
 */
export function validateEnvBeforeStart() {
  const envPath = path.join(REPO_ROOT, "server", ".env");
  const vars = readServerEnvFile();
  if (!vars) return { ok: false, reason: `server/.env is missing. Copy server/.env.example to ${envPath} and set ANTHROPIC_API_KEY.` };
  if (!vars.ANTHROPIC_API_KEY?.trim()) return { ok: false, reason: "ANTHROPIC_API_KEY is not set in server/.env." };
  return { ok: true };
}

/** Reads the stack marker file (PIDs from the last `npm run start`), or null if there isn't one / it's unreadable. */
export function readStackMarker() {
  try {
    return JSON.parse(fs.readFileSync(STACK_MARKER_PATH, "utf8"));
  } catch {
    return null;
  }
}

/** Records the PIDs `npm run start` just launched, so a later `npm run stop` (possibly in a different terminal) or `npm run doctor` can find them. */
export function writeStackMarker({ pids, commit, branch }) {
  fs.writeFileSync(STACK_MARKER_PATH, JSON.stringify({ pids, commit, branch, startedAt: new Date().toISOString() }, null, 2));
}

/** Removes the stack marker file, if present. Safe to call even when it's already gone. */
export function clearStackMarker() {
  try {
    fs.unlinkSync(STACK_MARKER_PATH);
  } catch {
    /* already gone */
  }
}

/** Records the commit `npm run validate:local` just fully validated, for `npm run doctor` to compare HEAD against. */
export function writeLastKnownGood({ commit, branch }) {
  fs.writeFileSync(LAST_KNOWN_GOOD_PATH, JSON.stringify({ commit, branch, validatedAt: new Date().toISOString() }, null, 2));
}

/** Reads the last-known-good marker, or null if `npm run validate:local` has never fully passed on this checkout. */
export function readLastKnownGood() {
  try {
    return JSON.parse(fs.readFileSync(LAST_KNOWN_GOOD_PATH, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Starts engine watch-build, server, and web as three independently
 * managed process groups. Builds engine synchronously first (so server's
 * first start always resolves @positive-inking/engine to real dist output
 * -- see docs/dev-server-reliability.md for why that matters), then
 * preflights both ports, then spawns and waits for each to become ready.
 *
 * onLog(label, chunk) is called for every line of stdout/stderr from every
 * child, if provided -- callers decide whether to forward it live (dev.mjs)
 * or buffer it to a log file (validateLocal.mjs).
 */
export async function startStack({ env = process.env, onLog, readinessTimeoutMs = 30000 } = {}) {
  execFileSync("npm", ["run", "build", "-w", "engine"], { cwd: REPO_ROOT, env, stdio: onLog ? "pipe" : "inherit" });

  await preflightPorts([PORTS.server, PORTS.web]);

  const children = {
    engine: spawnManaged("engine", "npm", ["run", "dev", "-w", "engine"], { env }),
    server: spawnManaged("server", "npm", ["run", "dev", "-w", "server"], { env }),
    web: spawnManaged("web", "npm", ["run", "dev", "-w", "web"], { env }),
  };

  const engineSawError = { value: false };
  for (const [label, child] of Object.entries(children)) {
    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      if (label === "engine" && /error TS/.test(text)) engineSawError.value = true;
      onLog?.(label, text);
    });
    child.stderr.on("data", (buf) => onLog?.(label, buf.toString()));
  }

  const stop = () => terminateAll(Object.values(children));

  // Any child dying unexpectedly during startup invalidates the whole
  // stack -- a partially-up combination is more confusing than a clear
  // failure, so tear everything else down rather than leaving it running.
  let diedEarly = null;
  const earlyExitHandlers = Object.entries(children).map(([label, child]) => {
    const handler = (code, signal) => {
      diedEarly = diedEarly ?? { label, code, signal };
    };
    child.once("exit", handler);
    return { child, handler };
  });

  await new Promise((r) => setTimeout(r, 300)); // let each process past its immediate-crash window

  const [serverUp, webUp] = await Promise.all([
    waitForHttp(`http://localhost:${PORTS.server}/api/health`, { timeoutMs: readinessTimeoutMs }),
    waitForHttp(`http://localhost:${PORTS.web}/`, { timeoutMs: readinessTimeoutMs }),
  ]);
  const engineUp = children.engine.exitCode === null && children.engine.signalCode === null;

  for (const { child, handler } of earlyExitHandlers) child.removeListener("exit", handler);

  const readiness = {
    engine: { up: engineUp && !engineSawError.value, sawCompileError: engineSawError.value },
    server: { up: serverUp },
    web: { up: webUp },
    diedEarly,
  };

  if (!readiness.engine.up || !readiness.server.up || !readiness.web.up || diedEarly) {
    await stop();
    return { children, readiness, stop: async () => {} };
  }

  return { children, readiness, stop };
}

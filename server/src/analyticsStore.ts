import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Anonymous usage analytics (privacy notice's "Anonymous usage analytics"
 * section): the smallest reasonable store given this app has no database
 * and no user accounts -- one append-only JSON-lines file, one line per
 * validated event (server/src/routes/analytics.ts is what validates them;
 * this module only ever appends whatever it's given, verbatim, and reads
 * nothing back -- there is deliberately no query/dashboard endpoint here,
 * out of scope for this pass). Resolved relative to this file, not
 * process.cwd(), so it lands in the same place whether the server is
 * started from the repo root or from server/ itself.
 */
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "analytics-events.jsonl");

let dirEnsured = false;

async function ensureDataDir(): Promise<void> {
  if (dirEnsured) return;
  await mkdir(DATA_DIR, { recursive: true });
  dirEnsured = true;
}

export async function appendAnalyticsEvent(event: Record<string, unknown>): Promise<void> {
  await ensureDataDir();
  await appendFile(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
}

/** Test/diagnostic-only accessor -- never used by the route itself. */
export function analyticsEventsFilePath(): string {
  return EVENTS_FILE;
}

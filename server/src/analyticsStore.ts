import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseClient } from "./supabaseClient.js";

/**
 * Anonymous usage analytics (privacy notice's "Anonymous usage analytics"
 * section): server/src/routes/analytics.ts validates every event (schema
 * has no free-text field at all); this module only ever persists whatever
 * it's given, verbatim, and reads nothing back -- there is deliberately no
 * query/dashboard endpoint here, out of scope for this pass.
 *
 * Two storage backends, chosen per call by whether Supabase is configured
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY both set):
 *  - Configured (intended for production/Render): a row insert into the
 *    `analytics_events` Postgres table (schema: docs/supabase-schema.sql).
 *    Render's free tier has an ephemeral filesystem -- anything written to
 *    disk is lost on every restart/redeploy, so the local-file store below
 *    cannot be used there.
 *  - Not configured (local dev, and any environment without Supabase set
 *    up): falls back to the original append-only JSON-lines file, one line
 *    per event, resolved relative to this file rather than process.cwd()
 *    so it lands in the same place whether the server is started from the
 *    repo root or from server/ itself.
 */
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "analytics-events.jsonl");
const ANALYTICS_TABLE = "analytics_events";

let dirEnsured = false;

async function ensureDataDir(): Promise<void> {
  if (dirEnsured) return;
  await mkdir(DATA_DIR, { recursive: true });
  dirEnsured = true;
}

export async function appendAnalyticsEvent(event: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from(ANALYTICS_TABLE).insert(event);
    if (error) throw new Error(error.message);
    return;
  }

  await ensureDataDir();
  await appendFile(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
}

/** Test/diagnostic-only accessor -- never used by the route itself. */
export function analyticsEventsFilePath(): string {
  return EVENTS_FILE;
}

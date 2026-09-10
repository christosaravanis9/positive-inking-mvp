import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInitialDeviceRosterState,
  reconcileCatalogChange,
  reviewDeviceRoster,
  deviceById,
  DEFAULT_ROSTER_CONFIG,
  type DeviceRosterState,
  type DevicePerformanceStats,
  type DeviceDefinition,
} from "@positive-inking/engine";
import { getSupabaseClient } from "./supabaseClient.js";

/**
 * Persistence and the periodic-review trigger for the "6 artists"
 * device-rotation system (docs/PROJECT_STATUS.md session log has the full
 * design/rationale; engine/src/deviceRoster.ts has the actual decision
 * logic -- pure and fully tested there, this module's only job is getting
 * real state in and out of storage and knowing WHEN to call it).
 *
 * Two things live here, genuinely different in shape from
 * analyticsStore.ts's append-only design:
 *  - The roster itself: one evolving document (current active/reserve
 *    device ids, the review counter, an audit trail), read-then-written,
 *    not appended.
 *  - Aggregated per-device stats: computed FROM the same underlying
 *    device_impression/device_outcome events analyticsStore.ts already
 *    persists (reusing that one events table/file, not a second one),
 *    which analyticsStore.ts's own "reads nothing back" design deliberately
 *    never needed before this.
 *
 * Same two-backend split as analyticsStore.ts: Supabase when configured
 * (production/Render), a local JSON file otherwise (dev).
 *
 * KNOWN SCALING LIMIT, stated plainly rather than glossed over:
 * aggregateDeviceStats() below reads every device_impression/device_outcome
 * event ever recorded and reduces it in Node on every review -- fine at
 * this project's current volume (a review triggers every
 * DEFAULT_ROSTER_CONFIG.reviewThresholdEvents outcomes, a small number),
 * but this does not scale indefinitely. Once real volume grows, the right
 * fix is a genuine SQL aggregation (a Postgres view or an RPC function
 * doing GROUP BY server-side) instead of fetching every row -- not
 * something to build ahead of actually needing it.
 */

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const ROSTER_STATE_FILE = path.join(DATA_DIR, "device-roster-state.json");
const EVENTS_FILE = path.join(DATA_DIR, "analytics-events.jsonl");
const ROSTER_STATE_TABLE = "device_roster_state";
const ANALYTICS_TABLE = "analytics_events";
const ROSTER_ROW_ID = 1; // single-row document -- there is exactly one roster, not one per anything

let dirEnsured = false;
async function ensureDataDir(): Promise<void> {
  if (dirEnsured) return;
  await mkdir(DATA_DIR, { recursive: true });
  dirEnsured = true;
}

export async function getDeviceRosterState(): Promise<DeviceRosterState> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from(ROSTER_STATE_TABLE).select("state").eq("id", ROSTER_ROW_ID).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.state) return reconcileCatalogChange(data.state as DeviceRosterState);
    const fresh = reconcileCatalogChange(createInitialDeviceRosterState());
    await saveDeviceRosterState(fresh);
    return fresh;
  }

  await ensureDataDir();
  try {
    const raw = await readFile(ROSTER_STATE_FILE, "utf8");
    return reconcileCatalogChange(JSON.parse(raw) as DeviceRosterState);
  } catch {
    const fresh = reconcileCatalogChange(createInitialDeviceRosterState());
    await saveDeviceRosterState(fresh);
    return fresh;
  }
}

export async function saveDeviceRosterState(state: DeviceRosterState): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from(ROSTER_STATE_TABLE).upsert({ id: ROSTER_ROW_ID, state });
    if (error) throw new Error(error.message);
    return;
  }

  await ensureDataDir();
  await writeFile(ROSTER_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

/** The device definitions (id + prompt text) the Association route should actually build its DEVICE VOCABULARY prompt section from right now. */
export async function getActiveDeviceRoster(): Promise<{ active: DeviceDefinition[]; reserve: DeviceDefinition[] }> {
  const state = await getDeviceRosterState();
  return { active: state.activeDeviceIds.map(deviceById), reserve: state.reserveDeviceIds.map(deviceById) };
}

function emptyStats(deviceId: string): DevicePerformanceStats {
  return { deviceId, impressions: 0, keepCount: 0, buildUponCount: 0, notThisOneBlankCount: 0, notThisOneWithReasonCount: 0 };
}

/** See the scaling-limit note in this file's top comment. */
async function aggregateDeviceStats(): Promise<Record<string, DevicePerformanceStats>> {
  const stats: Record<string, DevicePerformanceStats> = {};
  const get = (id: string) => (stats[id] ??= emptyStats(id));

  const supabase = getSupabaseClient();
  let rows: Array<Record<string, unknown>>;
  if (supabase) {
    const { data, error } = await supabase
      .from(ANALYTICS_TABLE)
      .select("event, device_id, decision, had_refinement_input")
      .in("event", ["device_impression", "device_outcome"]);
    if (error) throw new Error(error.message);
    rows = data ?? [];
  } else {
    await ensureDataDir();
    let raw: string;
    try {
      raw = await readFile(EVENTS_FILE, "utf8");
    } catch {
      raw = "";
    }
    rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((e) => e.event === "device_impression" || e.event === "device_outcome");
  }

  for (const row of rows) {
    const deviceId = row.device_id as string | undefined;
    if (!deviceId) continue;
    const s = get(deviceId);
    if (row.event === "device_impression") {
      s.impressions += 1;
    } else if (row.event === "device_outcome") {
      if (row.decision === "keep") s.keepCount += 1;
      else if (row.decision === "build_upon") s.buildUponCount += 1;
      else if (row.decision === "not_this_one") {
        if (row.had_refinement_input) s.notThisOneWithReasonCount += 1;
        else s.notThisOneBlankCount += 1;
      }
    }
  }

  return stats;
}

/**
 * Called once per device_outcome event (see routes/analytics.ts). Cheap in
 * the common case (a read, an increment, a write) -- only pays the real
 * aggregation cost on the review itself, which happens at most once every
 * reviewThresholdEvents outcomes. Errors are caught and logged, never
 * thrown -- this must never turn into a user-facing failure for an
 * analytics call that already responded 202 before this runs.
 */
export async function maybeReviewDeviceRoster(): Promise<void> {
  try {
    const current = await getDeviceRosterState();
    const incremented: DeviceRosterState = { ...current, eventsSinceLastReview: current.eventsSinceLastReview + 1 };

    if (incremented.eventsSinceLastReview < DEFAULT_ROSTER_CONFIG.reviewThresholdEvents) {
      await saveDeviceRosterState(incremented);
      return;
    }

    const statsByDevice = await aggregateDeviceStats();
    const { roster, swap } = reviewDeviceRoster(incremented, statsByDevice, DEFAULT_ROSTER_CONFIG, new Date().toISOString());
    await saveDeviceRosterState(roster);
    if (swap) {
      // eslint-disable-next-line no-console -- matches modelTiming.ts's own convention of a structured, greppable single-line log for this kind of event; never candidate/story content, only device ids and scores.
      console.log(`[device-roster] event=swap ${JSON.stringify(swap)}`);
    }
  } catch (err) {
    console.error("[device-roster] review failed:", err instanceof Error ? err.message : err);
  }
}

/** Test/diagnostic-only accessors -- never used by the route itself. */
export function deviceRosterStateFilePath(): string {
  return ROSTER_STATE_FILE;
}

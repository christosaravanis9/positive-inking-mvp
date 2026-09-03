/**
 * §22 — first-party, local-only instrumentation. No third-party analytics
 * service is contacted; everything here reads and writes this browser's own
 * localStorage. The event shape (name/at/project_id/metadata) is deliberately
 * stable and generic so a future analytics backend could be added later by
 * changing only logTelemetryEvent's implementation -- every call site in the
 * app stays untouched.
 *
 * Architectural separation from decision logic: nothing in engine/ or in any
 * screen's routing/eligibility code ever reads from this module. Events are
 * fired alongside a decision, never consulted to make one -- the same
 * one-directional relationship instrumentation should always have with the
 * thing it's measuring.
 */

export type TelemetryEventName =
  /** §22: journey started / completion-rate numerator's denominator. */
  | "journey_started"
  /** §22: a Blueprint was actually built -- completion-rate numerator. Metadata carries journey_mode and elapsed_ms for time-by-mode. */
  | "journey_completed"
  /** §22: clarification frequency. */
  | "clarification_shown"
  /** §9.6/§9.7 correction screen -- meaning edits (kept/removed/edited a surfaced item). */
  | "meaning_edit"
  /** §11 -- personal-vs-generic selection. Metadata carries source_category and is_personal. */
  | "visual_candidate_selected"
  /** §14 -- a user-authored idea (not a system suggestion) was added. */
  | "user_authored_idea_added"
  /** §10 -- provenance yield: what a provenance pass surfaced. */
  | "provenance_captured"
  /** §12.5 -- no-background rate. Metadata carries the chosen background value. */
  | "composition_background_confirmed"
  /** §12.10/§15 -- a reference (style example or design reference) was requested/attached. */
  | "reference_requested"
  /** §4 -- Blueprint saved to a file. */
  | "blueprint_saved"
  /** §4 -- Blueprint copied to the clipboard. */
  | "blueprint_copied"
  /** Sites migration spec §7 -- the Blueprint's print/save-as-PDF path (window.print()) was opened. */
  | "blueprint_print_opened";

export interface TelemetryEvent {
  name: TelemetryEventName;
  at: string;
  project_id: string;
  metadata: Record<string, unknown>;
}

const STORAGE_KEY = "positive-inking:telemetry:v1";
/** Local-only log, not a database -- capped so a long-running dev session can't grow localStorage without bound. */
const MAX_EVENTS = 500;

function readAll(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(events: TelemetryEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Storage unavailable or full -- instrumentation is never allowed to break the journey.
  }
}

export function logTelemetryEvent(name: TelemetryEventName, projectId: string, metadata: Record<string, unknown> = {}): void {
  const event: TelemetryEvent = { name, at: new Date().toISOString(), project_id: projectId, metadata };
  writeAll([...readAll(), event]);
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return readAll();
}

export function clearTelemetryEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

/** True only the first time this project_id fires journey_started -- keeps the completion-rate denominator from double-counting reloads of the same project. */
export function hasJourneyStarted(projectId: string): boolean {
  return readAll().some((e) => e.name === "journey_started" && e.project_id === projectId);
}

/** Milliseconds since this project's journey_started event, or null if none was ever recorded. */
export function elapsedSinceJourneyStarted(projectId: string): number | null {
  const started = readAll().find((e) => e.name === "journey_started" && e.project_id === projectId);
  if (!started) return null;
  return Date.now() - new Date(started.at).getTime();
}

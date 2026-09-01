import { createInitialJourneyState, type JourneyState } from "./state";

/**
 * §16.1 — "raw_story and story_transcript are written to local storage
 * before any network request... A user returning after a crash resumes at
 * the last completed screen with all confirmations intact." This persists
 * the whole journey (not just the story) so any confirmed answer survives a
 * reload, not only story text.
 *
 * Failure modes are all non-fatal by design: private browsing, storage
 * quota, or a corrupted/old-shaped record all fall back to a fresh journey
 * rather than crashing the app.
 */
const STORAGE_KEY = "positive-inking:journey-state:v1";

export function loadPersistedState(): JourneyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialJourneyState();
    const parsed = JSON.parse(raw) as JourneyState;
    if (!parsed || typeof parsed !== "object" || !parsed.project || !parsed.ui) {
      return createInitialJourneyState();
    }
    // In-flight request state cannot survive a reload -- nothing is actually
    // loading, and a stale error from before the reload is meaningless noise.
    return { ...parsed, ui: { ...parsed.ui, loading: false, error: null } };
  } catch {
    return createInitialJourneyState();
  }
}

export function savePersistedState(state: JourneyState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable (private browsing). The journey
    // still works in-memory for this session; it just won't survive a reload.
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

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
    return { ...parsed, project: normalizeProjectShape(parsed.project), ui: { ...parsed.ui, loading: false, error: null } };
  } catch {
    return createInitialJourneyState();
  }
}

/**
 * Root-caused a real production crash (2026-09-24): `visual_style_preference`
 * (singular, a string|null) was renamed to `visual_style_preferences`
 * (plural, an array) on 2026-09-23, but a returning client's browser can
 * still hold a pre-rename record in localStorage -- it passes the top-level
 * shape check above (still has `.project`/`.ui`), so it was never falling
 * back to a fresh journey, just silently carrying the old field forward.
 * `VisualStylePreference.tsx` then read `visual_style_preferences` as
 * `undefined` and called `.includes()` on it during render, an uncaught
 * exception with no error boundary anywhere in the app to catch it --
 * exactly the blank-screen report. This coerces any pre-rename or otherwise
 * malformed value to a safe empty array (== unanswered, matching this
 * field's own documented default) rather than trusting the persisted
 * shape -- the same "never trust an old record's exact shape" principle
 * the top-level check above already applies, just carried one level
 * deeper for a field whose type actually changed under it. Add here, not
 * generically for every field, since this is the one field a schema change
 * has actually broken so far; broaden if another rename does the same.
 */
function normalizeProjectShape(project: JourneyState["project"]): JourneyState["project"] {
  return { ...project, visual_style_preferences: Array.isArray(project.visual_style_preferences) ? project.visual_style_preferences : [] };
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

import { describe, it, expect, beforeEach } from "vitest";
import { loadPersistedState, savePersistedState } from "./persistence";
import { createInitialJourneyState } from "./state";

const STORAGE_KEY = "positive-inking:journey-state:v1";

/**
 * Root-caused a real production crash (2026-09-24): `visual_style_preference`
 * (singular) was renamed to `visual_style_preferences` (plural array) on
 * 2026-09-23, but a returning client's browser can still hold a pre-rename
 * record. loadPersistedState() passed that record through unchanged (it
 * still has `.project`/`.ui`, so the top-level shape check never rejected
 * it), leaving `visual_style_preferences` `undefined` -- VisualStylePreference.tsx
 * then called `.includes()` on it during render and crashed with no error
 * boundary to catch it. See persistence.ts's normalizeProjectShape().
 */
describe("loadPersistedState -- normalizes a pre-rename record instead of crashing downstream", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("coerces a missing visual_style_preferences (the exact pre-rename shape) to an empty array", () => {
    const fresh = createInitialJourneyState();
    const preRenameBlob = { ...fresh, project: { ...fresh.project, visual_style_preference: "not_sure" } as unknown };
    // Delete the new field entirely, matching a genuine old-shaped record --
    // not just setting it to undefined (JSON.stringify would drop that key
    // anyway, which is exactly the real-world shape being reproduced here).
    delete (preRenameBlob.project as Record<string, unknown>).visual_style_preferences;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preRenameBlob));

    const loaded = loadPersistedState();
    expect(Array.isArray(loaded.project.visual_style_preferences)).toBe(true);
    expect(loaded.project.visual_style_preferences).toEqual([]);
  });

  it("coerces a malformed (non-array) visual_style_preferences to an empty array", () => {
    const fresh = createInitialJourneyState();
    const corrupted = { ...fresh, project: { ...fresh.project, visual_style_preferences: "not_sure" as unknown } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrupted));

    const loaded = loadPersistedState();
    expect(loaded.project.visual_style_preferences).toEqual([]);
  });

  it("leaves a genuinely valid visual_style_preferences array untouched", () => {
    const fresh = createInitialJourneyState();
    const valid = { ...fresh, project: { ...fresh.project, visual_style_preferences: ["illustrative", "framed"] as const } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));

    const loaded = loadPersistedState();
    expect(loaded.project.visual_style_preferences).toEqual(["illustrative", "framed"]);
  });

  it("round-trips a freshly-saved journey with no normalization needed", () => {
    const fresh = createInitialJourneyState();
    savePersistedState(fresh);

    const loaded = loadPersistedState();
    expect(loaded.project.visual_style_preferences).toEqual([]);
  });
});

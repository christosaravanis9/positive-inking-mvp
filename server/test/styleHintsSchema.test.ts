import { describe, it, expect } from "vitest";
import { toStyleHints } from "../src/schemas/styleHints.js";

/**
 * server/src/schemas/styleHints.ts's own leniency: a missing/null/blank
 * hint for one lane is a tracking gap, not a reason to fail the whole call
 * -- the client falls back to that one lane's static description (see
 * VisualStylePreference.tsx), same philosophy as association.ts's optional
 * fields. Only a genuinely unusable shape (not an object at all) returns
 * null.
 */

function goodHints(overrides: Record<string, unknown> = {}) {
  return {
    abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
    illustrative: "The actual kitchen table, drawn plainly as it was.",
    typography: "Her own handwriting, not an invented phrase.",
    framed: "A few small beats showing how the choice unfolded.",
    narrative_collage: "The apron and the table, brought together in one piece.",
    ...overrides,
  };
}

describe("toStyleHints", () => {
  it("returns every lane's hint unchanged when the batch is fully valid", () => {
    const hints = toStyleHints(goodHints());
    expect(hints).toEqual(goodHints());
  });

  it("drops just the one lane whose hint is missing entirely, keeping every other lane's hint", () => {
    const raw = goodHints();
    delete (raw as Record<string, unknown>).typography;
    const hints = toStyleHints(raw);
    expect(hints?.typography).toBeUndefined();
    expect(hints?.abstract_symbolic).toBe(goodHints().abstract_symbolic);
    expect(hints?.framed).toBe(goodHints().framed);
  });

  it("coerces an explicit null hint to undefined for that one lane, same lenient pattern as association.ts's optional fields", () => {
    const hints = toStyleHints(goodHints({ narrative_collage: null }));
    expect(hints?.narrative_collage).toBeUndefined();
    expect(hints?.abstract_symbolic).toBe(goodHints().abstract_symbolic);
  });

  it("treats a blank/whitespace-only hint the same as a missing one", () => {
    const hints = toStyleHints(goodHints({ framed: "   " }));
    expect(hints?.framed).toBeUndefined();
  });

  it("trims surrounding whitespace from a real hint", () => {
    const hints = toStyleHints(goodHints({ typography: "  Her own words.  " }));
    expect(hints?.typography).toBe("Her own words.");
  });

  it("returns an object with every lane undefined (never an error) when every lane is missing", () => {
    const hints = toStyleHints({});
    expect(hints).toEqual({});
  });

  it("returns null only when the raw shape itself is unusable, not an object at all", () => {
    expect(toStyleHints(null)).toBeNull();
    expect(toStyleHints("not an object")).toBeNull();
    expect(toStyleHints(42)).toBeNull();
    expect(toStyleHints(["not", "an", "object"])).toBeNull();
    expect(toStyleHints(undefined)).toBeNull();
  });

  it("ignores an extra, unrecognised field rather than failing on it", () => {
    const hints = toStyleHints(goodHints({ not_sure: "should never be requested, ignored if present anyway" }));
    expect(hints).toEqual(goodHints());
    expect((hints as Record<string, unknown>).not_sure).toBeUndefined();
  });

  /**
   * 2026-09-24 production incident regression: root-caused server-side
   * normalization gaps that would have let a malformed style-hints response
   * either poison the whole call or leak a shape the client didn't expect.
   * Old lane names (illustrative_narrative/comic_strip/montage_collage,
   * pre-2026-09-23 rename), missing lanes, and extra unknown keys together
   * in one response must never crash or fail the whole call -- each current
   * lane is validated independently.
   */
  it("drops old (pre-rename) lane names entirely -- never read as a fallback source for the current lane name", () => {
    const hints = toStyleHints({
      abstract_symbolic: "Still current, unaffected.",
      illustrative_narrative: "Old name -- must never populate 'illustrative'.",
      comic_strip: "Old name -- must never populate 'framed'.",
      montage_collage: "Old name -- must never populate 'narrative_collage'.",
      typography: "Still current, unaffected.",
    });
    expect(hints).toEqual({
      abstract_symbolic: "Still current, unaffected.",
      typography: "Still current, unaffected.",
    });
    expect(hints?.illustrative).toBeUndefined();
    expect(hints?.framed).toBeUndefined();
    expect(hints?.narrative_collage).toBeUndefined();
  });

  it("per-lane salvage: one lane with a malformed type (e.g. a nested object) is dropped alone, not the whole call", () => {
    const hints = toStyleHints({
      ...goodHints(),
      illustrative: { subtitle: "a nested object, not a string" },
    });
    expect(hints).not.toBeNull();
    expect(hints?.illustrative).toBeUndefined();
    expect(hints?.abstract_symbolic).toBe(goodHints().abstract_symbolic);
    expect(hints?.typography).toBe(goodHints().typography);
    expect(hints?.framed).toBe(goodHints().framed);
    expect(hints?.narrative_collage).toBe(goodHints().narrative_collage);
  });

  it("per-lane salvage: a numeric value for one lane is dropped alone, not the whole call", () => {
    const hints = toStyleHints({ ...goodHints(), typography: 42 });
    expect(hints?.typography).toBeUndefined();
    expect(hints?.abstract_symbolic).toBe(goodHints().abstract_symbolic);
  });

  it("old names, missing lanes, and an extra unknown key together still salvage every valid current lane", () => {
    const hints = toStyleHints({
      illustrative_narrative: "old",
      comic_strip: "old",
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      some_future_key: "junk",
      // typography, framed, narrative_collage all absent under their current names.
    });
    expect(hints).toEqual({ abstract_symbolic: "Like a single object standing in for the freedom you're building toward." });
  });
});

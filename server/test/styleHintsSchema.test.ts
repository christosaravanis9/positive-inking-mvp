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
    illustrative_narrative: "The actual kitchen table, drawn plainly as it was.",
    typography: "Her own handwriting, not an invented phrase.",
    comic_strip: "A few small beats showing how the choice unfolded.",
    montage_collage: "The apron and the table, brought together in one piece.",
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
    expect(hints?.comic_strip).toBe(goodHints().comic_strip);
  });

  it("coerces an explicit null hint to undefined for that one lane, same lenient pattern as association.ts's optional fields", () => {
    const hints = toStyleHints(goodHints({ montage_collage: null }));
    expect(hints?.montage_collage).toBeUndefined();
    expect(hints?.abstract_symbolic).toBe(goodHints().abstract_symbolic);
  });

  it("treats a blank/whitespace-only hint the same as a missing one", () => {
    const hints = toStyleHints(goodHints({ comic_strip: "   " }));
    expect(hints?.comic_strip).toBeUndefined();
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
  });

  it("ignores an extra, unrecognised field rather than failing on it", () => {
    const hints = toStyleHints(goodHints({ not_sure: "should never be requested, ignored if present anyway" }));
    expect(hints).toEqual(goodHints());
    expect((hints as Record<string, unknown>).not_sure).toBeUndefined();
  });
});

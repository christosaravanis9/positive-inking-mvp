import { describe, it, expect } from "vitest";
import { deriveConceptShape, placeDisambiguationRequired } from "../src/signals.js";

const base = {
  element_count: 1,
  place_role: "none" as const,
  spatial_language_present: false,
  has_text_or_handwriting: false,
  has_likeness: false,
  text_is_primary: false,
  likeness_is_primary: false,
};

describe("deriveConceptShape (§12.3)", () => {
  it("single element -> single_emblem", () => {
    expect(deriveConceptShape({ ...base, element_count: 1 })).toBe("single_emblem");
  });

  it("two elements -> paired_elements", () => {
    expect(deriveConceptShape({ ...base, element_count: 2 })).toBe("paired_elements");
  });

  it("three or more elements, place not setting -> multi_element", () => {
    expect(deriveConceptShape({ ...base, element_count: 3 })).toBe("multi_element");
    expect(deriveConceptShape({ ...base, element_count: 5 })).toBe("multi_element");
  });

  it("place_role setting -> narrative_scene regardless of count", () => {
    expect(
      deriveConceptShape({ ...base, element_count: 3, place_role: "setting" }),
    ).toBe("narrative_scene");
  });

  it("spatial language present -> narrative_scene even with place_role none", () => {
    expect(
      deriveConceptShape({ ...base, element_count: 2, spatial_language_present: true }),
    ).toBe("narrative_scene");
  });

  it("place_role subject derives shape from element count, not narrative_scene", () => {
    // "A grandmother's kitchen" as subject, single element -> single_emblem.
    expect(
      deriveConceptShape({ ...base, element_count: 1, place_role: "subject" }),
    ).toBe("single_emblem");
  });

  it("text as primary element -> text_led, overriding count rules", () => {
    expect(
      deriveConceptShape({ ...base, element_count: 3, text_is_primary: true }),
    ).toBe("text_led");
  });

  it("likeness as primary element -> portrait_led, overriding count rules", () => {
    expect(
      deriveConceptShape({ ...base, element_count: 2, likeness_is_primary: true }),
    ).toBe("portrait_led");
  });

  it("text_is_primary wins over narrative_scene conditions", () => {
    expect(
      deriveConceptShape({
        ...base,
        element_count: 4,
        place_role: "setting",
        text_is_primary: true,
      }),
    ).toBe("text_led");
  });
});

describe("placeDisambiguationRequired (§12.2)", () => {
  it("required only when place_role is ambiguous", () => {
    expect(placeDisambiguationRequired("ambiguous")).toBe(true);
    expect(placeDisambiguationRequired("subject")).toBe(false);
    expect(placeDisambiguationRequired("setting")).toBe(false);
    expect(placeDisambiguationRequired("none")).toBe(false);
  });
});

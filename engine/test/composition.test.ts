import { describe, it, expect } from "vitest";
import {
  evaluateDensity,
  evaluateNegativeSpace,
  evaluateReadingDirection,
  evaluateContainmentVsWrap,
  evaluateBackgroundSource,
  evaluatePlaceDisambiguation,
  explicitCompositionConfirmationRequired,
  getCompositionOptionPool,
  COMPOSITION_POOLS,
} from "../src/composition.js";
import type { ConceptShape } from "../src/types.js";

describe("composition eligibility (§12.5)", () => {
  it("density: single isolated element with no background is skipped", () => {
    const decision = evaluateDensity({ element_count: 1, composition_background: "none" });
    expect(decision.eligible).toBe(false);
  });

  it("density: two or more elements makes it eligible", () => {
    expect(evaluateDensity({ element_count: 2, composition_background: "none" }).eligible).toBe(true);
  });

  it("density: a background alone makes it eligible even with one element", () => {
    expect(evaluateDensity({ element_count: 1, composition_background: "subtle" }).eligible).toBe(true);
  });

  it("negative space: skipped for small single-element work", () => {
    expect(evaluateNegativeSpace({ concept_shape: "single_emblem", size_class: "small" }).eligible).toBe(false);
  });

  it("negative space: eligible for multi_element regardless of size", () => {
    expect(evaluateNegativeSpace({ concept_shape: "multi_element", size_class: "small" }).eligible).toBe(true);
  });

  it("negative space: eligible for large/sleeve scale regardless of shape", () => {
    expect(evaluateNegativeSpace({ concept_shape: "single_emblem", size_class: "large" }).eligible).toBe(true);
  });

  it("reading direction: eligible with 3+ elements, text present, or narrative_scene; otherwise inferred", () => {
    expect(evaluateReadingDirection({ element_count: 3, has_text_or_handwriting: false, concept_shape: "multi_element" }).eligible).toBe(true);
    expect(evaluateReadingDirection({ element_count: 2, has_text_or_handwriting: true, concept_shape: "text_led" }).eligible).toBe(true);
    expect(evaluateReadingDirection({ element_count: 1, has_text_or_handwriting: false, concept_shape: "narrative_scene" }).eligible).toBe(true);
    expect(evaluateReadingDirection({ element_count: 2, has_text_or_handwriting: false, concept_shape: "paired_elements" }).eligible).toBe(false);
  });

  it("a single text/signature element has no real reading-direction decision to make, so it is not asked (refined per §25 journey trace)", () => {
    expect(evaluateReadingDirection({ element_count: 1, has_text_or_handwriting: true, concept_shape: "text_led" }).eligible).toBe(false);
  });

  it("containment vs wrap: skipped for small/medium contained work", () => {
    expect(evaluateContainmentVsWrap({ size_class: "medium", connects_to_other_work: false }).eligible).toBe(false);
  });

  it("containment vs wrap: eligible for large/sleeve, or when connecting to other work", () => {
    expect(evaluateContainmentVsWrap({ size_class: "large", connects_to_other_work: false }).eligible).toBe(true);
    expect(evaluateContainmentVsWrap({ size_class: "small", connects_to_other_work: true }).eligible).toBe(true);
  });

  it("background source: always skipped when no background chosen", () => {
    expect(evaluateBackgroundSource("none").eligible).toBe(false);
  });

  it("background source: eligible when a background is present", () => {
    expect(evaluateBackgroundSource("subtle").eligible).toBe(true);
    expect(evaluateBackgroundSource("immersive").eligible).toBe(true);
  });

  it("place disambiguation: mandatory only when ambiguous", () => {
    expect(evaluatePlaceDisambiguation("ambiguous")).toMatchObject({ eligible: true, mandatory: true });
    expect(evaluatePlaceDisambiguation("subject").eligible).toBe(false);
  });

  it("explicit composition confirmation requires at least two signals", () => {
    const none = explicitCompositionConfirmationRequired({
      large_placement: false,
      multiple_visual_elements: false,
      sleeve_or_panel: false,
      strong_visual_presence: false,
      mentions_flow_scene_journey_environment: false,
      must_connect_to_existing_or_future_work: false,
    });
    expect(none).toBe(false);

    const one = explicitCompositionConfirmationRequired({
      large_placement: true,
      multiple_visual_elements: false,
      sleeve_or_panel: false,
      strong_visual_presence: false,
      mentions_flow_scene_journey_environment: false,
      must_connect_to_existing_or_future_work: false,
    });
    expect(one).toBe(false);

    const two = explicitCompositionConfirmationRequired({
      large_placement: true,
      multiple_visual_elements: true,
      sleeve_or_panel: false,
      strong_visual_presence: false,
      mentions_flow_scene_journey_environment: false,
      must_connect_to_existing_or_future_work: false,
    });
    expect(two).toBe(true);
  });
});

describe("composition option pools (§12.6)", () => {
  const shapes = Object.keys(COMPOSITION_POOLS) as ConceptShape[];

  it("every pool contains exactly one no-background option (AC 27)", () => {
    for (const shape of shapes) {
      const noBackgroundCount = COMPOSITION_POOLS[shape].filter((o) => o.noBackground).length;
      expect(noBackgroundCount).toBe(1);
    }
  });

  it("Something else is always appended and cannot be confused with a real pool entry", () => {
    for (const shape of shapes) {
      const pool = getCompositionOptionPool(shape);
      expect(pool.at(-1)?.label).toBe("Something else");
    }
  });

  it("different concept shapes overlap by no more than one option, excluding no-background and Something else (AC 26)", () => {
    function realLabels(shape: ConceptShape): Set<string> {
      return new Set(COMPOSITION_POOLS[shape].filter((o) => !o.noBackground).map((o) => o.label));
    }
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        const a = realLabels(shapes[i]!);
        const b = realLabels(shapes[j]!);
        const overlap = [...a].filter((label) => b.has(label));
        expect(overlap.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

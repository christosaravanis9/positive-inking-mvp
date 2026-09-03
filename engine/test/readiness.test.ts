import { describe, it, expect } from "vitest";
import { computeReadiness, referenceRequirementFor, describeReadinessComponents, type ReadinessComponentInputs } from "../src/readiness.js";

describe("computeReadiness (§13.4, §9.7)", () => {
  it("a low-confidence interpretation can never reach blueprint_ready (AC 16)", () => {
    expect(
      computeReadiness({ interpretationConfidence: "low", anyRequiredReferenceMissing: false, hasUnresolvedContradiction: false }),
    ).toBe("artist_consultation_recommended");
  });

  it("standard confidence with a missing required reference needs references", () => {
    expect(
      computeReadiness({ interpretationConfidence: "standard", anyRequiredReferenceMissing: true, hasUnresolvedContradiction: false }),
    ).toBe("references_needed");
  });

  it("standard confidence with an unresolved contradiction needs refinement", () => {
    expect(
      computeReadiness({ interpretationConfidence: "standard", anyRequiredReferenceMissing: false, hasUnresolvedContradiction: true }),
    ).toBe("needs_refinement");
  });

  it("everything clear reaches blueprint_ready", () => {
    expect(
      computeReadiness({ interpretationConfidence: "standard", anyRequiredReferenceMissing: false, hasUnresolvedContradiction: false }),
    ).toBe("blueprint_ready");
  });

  it("the Blueprint may be complete while references remain outstanding (§13.4) -- references_needed is distinct from needs_refinement", () => {
    const withMissingRef = computeReadiness({ interpretationConfidence: "standard", anyRequiredReferenceMissing: true, hasUnresolvedContradiction: false });
    expect(withMissingRef).not.toBe("needs_refinement");
  });
});

describe("referenceRequirementFor (§13.4)", () => {
  it("matches the table", () => {
    expect(referenceRequirementFor("exact_handwriting_or_signature")).toBe("required");
    expect(referenceRequirementFor("exact_personal_drawing")).toBe("required");
    expect(referenceRequirementFor("recognisable_person_or_hand")).toBe("strongly_recommended");
    expect(referenceRequirementFor("specific_machine_object_or_vehicle")).toBe("strongly_recommended");
    expect(referenceRequirementFor("actual_place_or_building")).toBe("recommended");
    expect(referenceRequirementFor("interpretive_symbol")).toBe("optional");
    expect(referenceRequirementFor("abstract_atmosphere")).toBe("not_required");
  });
});

function baseInputs(overrides: Partial<ReadinessComponentInputs> = {}): ReadinessComponentInputs {
  return {
    meaningCaptured: true,
    hasUnresolvedPrimaryImagery: false,
    otherContradictions: [],
    referenceRequirementExists: false,
    missingReferenceDescriptions: [],
    creativeControlSet: true,
    readiness: "blueprint_ready",
    ...overrides,
  };
}

function componentById(inputs: ReadinessComponentInputs, id: string) {
  return describeReadinessComponents(inputs).find((c) => c.id === id);
}

describe("describeReadinessComponents", () => {
  it("returns all five components, in a fixed order, when a readiness state is given (post-Blueprint)", () => {
    const components = describeReadinessComponents(baseInputs());
    expect(components.map((c) => c.id)).toEqual(["meaning", "visual_direction", "references", "artist_discussion", "final_artwork"]);
  });

  it("omits final_artwork when readiness is null (pre-Blueprint, Screen 13) -- only four components are relevant there", () => {
    const components = describeReadinessComponents(baseInputs({ readiness: null }));
    expect(components.map((c) => c.id)).toEqual(["meaning", "visual_direction", "references", "artist_discussion"]);
  });

  describe("meaning", () => {
    it("is confirmed when the caller reports meaning captured", () => {
      expect(componentById(baseInputs({ meaningCaptured: true }), "meaning")).toEqual({ id: "meaning", status: "confirmed", detail: [] });
    });

    it("is not_yet_captured otherwise -- not an unconditional label (Sites migration spec §4.3 defect 4)", () => {
      expect(componentById(baseInputs({ meaningCaptured: false }), "meaning")).toEqual({ id: "meaning", status: "not_yet_captured", detail: [] });
    });
  });

  describe("visual_direction", () => {
    it("is clear when there is no unresolved primary imagery and no other contradiction", () => {
      expect(componentById(baseInputs(), "visual_direction")).toEqual({ id: "visual_direction", status: "clear", detail: [] });
    });

    it("is open_decisions and names unresolved primary imagery specifically", () => {
      const component = componentById(baseInputs({ hasUnresolvedPrimaryImagery: true }), "visual_direction")!;
      expect(component.status).toBe("open_decisions");
      expect(component.detail).toEqual(["One or more primary visual elements are still an open decision for the client, not yet a concrete idea."]);
    });

    it("is open_decisions and names the actual contradiction and its resolutions -- not a generic restatement", () => {
      const component = componentById(
        baseInputs({
          otherContradictions: [
            { description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo", "switch to an interpretive rendering"] },
          ],
        }),
        "visual_direction",
      )!;
      expect(component.status).toBe("open_decisions");
      expect(component.detail).toHaveLength(1);
      expect(component.detail[0]).toContain("An exact artefact is specified with no uploaded reference.");
      expect(component.detail[0]).toContain("Upload a reference photo");
      expect(component.detail[0]).toContain("switch to an interpretive rendering");
    });

    it("names a contradiction with no resolutions attached without inventing one", () => {
      const component = componentById(
        baseInputs({ otherContradictions: [{ description: "Two incompatible placements were both confirmed.", resolutions: [] }] }),
        "visual_direction",
      )!;
      expect(component.detail).toEqual(["Two incompatible placements were both confirmed."]);
    });

    it("names both the primary-imagery reason and every contradiction when all signals are present", () => {
      const component = componentById(
        baseInputs({
          hasUnresolvedPrimaryImagery: true,
          otherContradictions: [
            { description: "First contradiction.", resolutions: [] },
            { description: "Second contradiction.", resolutions: [] },
          ],
        }),
        "visual_direction",
      )!;
      expect(component.detail).toHaveLength(3);
    });
  });

  describe("references", () => {
    it("is not_required when the checklist has no required/strongly_recommended entry -- not 'Available to provide' for a concept that never needed one (Sites migration spec §4.3 defect 1)", () => {
      expect(componentById(baseInputs({ referenceRequirementExists: false }), "references")).toEqual({
        id: "references",
        status: "not_required",
        detail: [],
      });
    });

    it("is available when required references exist and none are missing", () => {
      expect(componentById(baseInputs({ referenceRequirementExists: true, missingReferenceDescriptions: [] }), "references")).toEqual({
        id: "references",
        status: "available",
        detail: [],
      });
    });

    it("is still_needed and names the actual missing references when some are outstanding", () => {
      const component = componentById(
        baseInputs({ referenceRequirementExists: true, missingReferenceDescriptions: ["a photo of the handwriting", "a photo of the tattoo it commemorates"] }),
        "references",
      )!;
      expect(component.status).toBe("still_needed");
      expect(component.detail).toEqual(["a photo of the handwriting", "a photo of the tattoo it commemorates"]);
    });
  });

  describe("artist_discussion", () => {
    it("is ready when creative_control has been set", () => {
      expect(componentById(baseInputs({ creativeControlSet: true }), "artist_discussion")).toEqual({
        id: "artist_discussion",
        status: "ready",
        detail: [],
      });
    });

    it("is not_yet_captured otherwise -- not an unconditional label (Sites migration spec §4.3 defect 4)", () => {
      expect(componentById(baseInputs({ creativeControlSet: false }), "artist_discussion")).toEqual({
        id: "artist_discussion",
        status: "not_yet_captured",
        detail: [],
      });
    });
  });

  describe("final_artwork", () => {
    it("is not_yet_begun_brief_ready when the overall readiness is blueprint_ready", () => {
      expect(componentById(baseInputs({ readiness: "blueprint_ready" }), "final_artwork")).toEqual({
        id: "final_artwork",
        status: "not_yet_begun_brief_ready",
        detail: [],
      });
    });

    it("is not_yet_begun_pending_items for every other readiness state -- never implies artwork itself is ready to begin (Sites migration spec §4.3 defect 5)", () => {
      for (const readiness of ["references_needed", "needs_refinement", "artist_consultation_recommended"] as const) {
        expect(componentById(baseInputs({ readiness }), "final_artwork")).toEqual({
          id: "final_artwork",
          status: "not_yet_begun_pending_items",
          detail: [],
        });
      }
    });

    it("is absent entirely when readiness is null", () => {
      expect(componentById(baseInputs({ readiness: null }), "final_artwork")).toBeUndefined();
    });
  });
});

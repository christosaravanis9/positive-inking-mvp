import { describe, it, expect } from "vitest";
import { computeReadiness, referenceRequirementFor, describeReadinessReason } from "../src/readiness.js";

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

describe("describeReadinessReason", () => {
  it("gives a fixed reason for artist_consultation_recommended", () => {
    const reasons = describeReadinessReason({
      readiness: "artist_consultation_recommended",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: false,
      hasOtherContradiction: false,
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/low-confidence/);
  });

  it("names the actual missing references for references_needed", () => {
    const reasons = describeReadinessReason({
      readiness: "references_needed",
      missingReferenceDescriptions: ["a photo of the handwriting", "a photo of the tattoo it commemorates"],
      hasUnresolvedPrimaryImagery: false,
      hasOtherContradiction: false,
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("a photo of the handwriting");
    expect(reasons[0]).toContain("a photo of the tattoo it commemorates");
  });

  it("falls back to a generic line for references_needed if no descriptions were passed", () => {
    const reasons = describeReadinessReason({
      readiness: "references_needed",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: false,
      hasOtherContradiction: false,
    });
    expect(reasons).toEqual(["A required reference is still outstanding."]);
  });

  it("names unresolved primary imagery for needs_refinement", () => {
    const reasons = describeReadinessReason({
      readiness: "needs_refinement",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: true,
      hasOtherContradiction: false,
    });
    expect(reasons).toEqual(["One or more primary visual elements are still an open decision for the client, not yet a concrete idea."]);
  });

  it("names the other contradiction for needs_refinement", () => {
    const reasons = describeReadinessReason({
      readiness: "needs_refinement",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: false,
      hasOtherContradiction: true,
    });
    expect(reasons).toEqual(["A noted contradiction in the design is still unresolved."]);
  });

  it("names both when both signals are present for needs_refinement", () => {
    const reasons = describeReadinessReason({
      readiness: "needs_refinement",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: true,
      hasOtherContradiction: true,
    });
    expect(reasons).toHaveLength(2);
  });

  it("falls back to a generic line for needs_refinement when neither specific signal is set", () => {
    const reasons = describeReadinessReason({
      readiness: "needs_refinement",
      missingReferenceDescriptions: [],
      hasUnresolvedPrimaryImagery: false,
      hasOtherContradiction: false,
    });
    expect(reasons).toEqual(["Some details are still unresolved and need refining before this design is final."]);
  });

  it("returns no reasons for blueprint_ready and concept_visual_ready", () => {
    for (const readiness of ["blueprint_ready", "concept_visual_ready"] as const) {
      expect(
        describeReadinessReason({ readiness, missingReferenceDescriptions: [], hasUnresolvedPrimaryImagery: false, hasOtherContradiction: false }),
      ).toEqual([]);
    }
  });
});

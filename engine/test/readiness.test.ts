import { describe, it, expect } from "vitest";
import { computeReadiness, referenceRequirementFor } from "../src/readiness.js";

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

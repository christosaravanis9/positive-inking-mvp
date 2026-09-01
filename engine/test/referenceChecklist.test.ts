import { describe, it, expect } from "vitest";
import {
  classifyReferenceFeatureKind,
  buildReferenceChecklist,
  isReferenceEntrySatisfied,
  anyRequiredReferenceMissing,
  type ReferenceChecklistEntry,
} from "../src/referenceChecklist.js";
import type { ConsentRecord, VisualElement } from "../src/types.js";

function element(overrides: Partial<VisualElement> = {}): VisualElement {
  return {
    id: "el-1",
    description: "A signature",
    personal_meaning: "Grandfather's signature",
    source_category: "personal_artefact",
    hierarchy: "primary",
    fidelity: "exact",
    colour_role: "none",
    reference_required: true,
    reference_status: "to_upload",
    origin: "user_added",
    user_selected: true,
    ...overrides,
  };
}

function consentRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    reference_id: "el-1",
    material_type: "signature",
    subject_relationship: "deceased",
    attestation_given: false,
    attestation_text: "",
    attested_at: null,
    copyright_flag: false,
    flag_resolution: null,
    ...overrides,
  };
}

describe("classifyReferenceFeatureKind (§13.4/§15 bridge)", () => {
  it("signature and handwriting map to exact_handwriting_or_signature", () => {
    expect(classifyReferenceFeatureKind("signature", "exact", "personal_artefact")).toBe("exact_handwriting_or_signature");
    expect(classifyReferenceFeatureKind("handwriting", "interpretive", "personal_artefact")).toBe("exact_handwriting_or_signature");
  });

  it("likeness maps to recognisable_person_or_hand", () => {
    expect(classifyReferenceFeatureKind("likeness", "closely_based_on", "personal_person")).toBe("recognisable_person_or_hand");
  });

  it("own drawing with exact fidelity maps to exact_personal_drawing; otherwise interpretive_symbol", () => {
    expect(classifyReferenceFeatureKind("drawing", "exact", "personal_artefact")).toBe("exact_personal_drawing");
    expect(classifyReferenceFeatureKind("drawing", "interpretive", "personal_artefact")).toBe("interpretive_symbol");
  });

  it("falls back to source_category when no material_type is chosen yet", () => {
    expect(classifyReferenceFeatureKind(null, "interpretive", "personal_place")).toBe("actual_place_or_building");
    expect(classifyReferenceFeatureKind(null, "interpretive", "personal_person")).toBe("recognisable_person_or_hand");
    expect(classifyReferenceFeatureKind(null, "open", "artistic_symbol")).toBe("abstract_atmosphere");
  });
});

describe("buildReferenceChecklist", () => {
  it("includes elements that require a reference or carry high fidelity", () => {
    const checklist = buildReferenceChecklist([element()], [consentRecord()]);
    expect(checklist).toHaveLength(1);
    expect(checklist[0]).toMatchObject({
      element_id: "el-1",
      requirement: "required",
      status: "to_upload",
      material_type: "signature",
      subject_relationship: "deceased",
      attestation_given: false,
    });
  });

  it("excludes elements with no reference need and non-exact fidelity", () => {
    const checklist = buildReferenceChecklist(
      [element({ id: "el-2", reference_required: false, fidelity: "interpretive" })],
      [],
    );
    expect(checklist).toHaveLength(0);
  });
});

describe("isReferenceEntrySatisfied / anyRequiredReferenceMissing (AC 49)", () => {
  const base: ReferenceChecklistEntry = {
    element_id: "el-1",
    description: "A signature",
    requirement: "required",
    status: "available",
    material_type: "signature",
    subject_relationship: "self",
    attestation_given: false,
    copyright_flag: false,
    flag_resolution: null,
  };

  it("own material never needs attestation -- satisfied once the file is available", () => {
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "self", attestation_given: false })).toBe(true);
  });

  it("a living third party's material is NOT satisfied without attestation, even with the file available (AC 49)", () => {
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "living_other", attestation_given: false })).toBe(false);
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "living_other", attestation_given: true })).toBe(true);
  });

  it("a child's material follows the same rule as a living third party", () => {
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "child", attestation_given: false })).toBe(false);
  });

  it("a deceased person's material needs the single light-touch attestation too (§15.5)", () => {
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "deceased", attestation_given: false })).toBe(false);
    expect(isReferenceEntrySatisfied({ ...base, subject_relationship: "deceased", attestation_given: true })).toBe(true);
  });

  it("a missing file is never satisfied regardless of attestation", () => {
    expect(isReferenceEntrySatisfied({ ...base, status: "to_upload", subject_relationship: "self" })).toBe(false);
  });

  it("optional and not_required entries are always satisfied", () => {
    expect(isReferenceEntrySatisfied({ ...base, requirement: "optional", status: "to_upload" })).toBe(true);
    expect(isReferenceEntrySatisfied({ ...base, requirement: "not_required", status: "to_upload" })).toBe(true);
  });

  it("anyRequiredReferenceMissing is true if any required/strongly-recommended entry is unsatisfied", () => {
    const checklist: ReferenceChecklistEntry[] = [
      { ...base, requirement: "recommended", status: "to_upload" }, // not required/strongly_recommended -> ignored
      { ...base, requirement: "required", status: "available", subject_relationship: "living_other", attestation_given: false },
    ];
    expect(anyRequiredReferenceMissing(checklist)).toBe(true);
  });

  it("anyRequiredReferenceMissing is false once every required/strongly-recommended entry is satisfied", () => {
    const checklist: ReferenceChecklistEntry[] = [
      { ...base, requirement: "required", status: "available", subject_relationship: "self" },
      { ...base, requirement: "strongly_recommended", status: "available", subject_relationship: "living_other", attestation_given: true },
    ];
    expect(anyRequiredReferenceMissing(checklist)).toBe(false);
  });
});

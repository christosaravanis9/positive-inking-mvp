/**
 * §13.4 reference readiness + §15 consent, bridged into one deterministic
 * checklist. §13.4 defines requirement levels for seven named *feature
 * kinds*; §15.2 defines attestation handling for seven *material
 * categories*; the Association Engine and Screen 7 UI produce a
 * `source_category` (§7's element record) and a user-chosen `material_type`
 * (§15.3). None of these three vocabularies line up one-to-one, so
 * `classifyReferenceFeatureKind` below is this project's own bridge between
 * them — a judgement call, not a verbatim spec table, documented here so
 * it's easy to revisit.
 *
 * AC 49 ("no third-party likeness, handwriting or signature reaches the
 * Blueprint without a recorded attestation") is enforced by
 * `isReferenceEntrySatisfied`: a required or strongly-recommended reference
 * on third-party material is not satisfied merely by having a file attached
 * — it also needs attestation_given, unless the subject is the user
 * themselves (§15.2: "The user's own material -- No attestation").
 */

import type { ConsentRecord, ElementFidelity, VisualElement } from "./types.js";
import { referenceRequirementFor, type ReferenceFeatureKind, type ReferenceRequirementLevel } from "./readiness.js";

export function classifyReferenceFeatureKind(
  materialType: ConsentRecord["material_type"] | null,
  fidelity: ElementFidelity,
  sourceCategory: string,
): ReferenceFeatureKind {
  if (materialType === "signature" || materialType === "handwriting") return "exact_handwriting_or_signature";
  if (materialType === "likeness") return "recognisable_person_or_hand";
  if (materialType === "drawing" || materialType === "own_material") {
    return fidelity === "exact" ? "exact_personal_drawing" : "interpretive_symbol";
  }
  if (materialType === "artwork" || materialType === "tattoo_design") {
    return fidelity === "exact" ? "specific_machine_object_or_vehicle" : "interpretive_symbol";
  }
  // No material_type chosen yet (or n/a) -- fall back to what the element's
  // own classification already tells us.
  if (sourceCategory === "personal_place") return "actual_place_or_building";
  if (sourceCategory === "personal_person") return "recognisable_person_or_hand";
  if (fidelity === "exact") return "specific_machine_object_or_vehicle";
  if (fidelity === "interpretive" || fidelity === "open") return "abstract_atmosphere";
  return "interpretive_symbol";
}

export interface ReferenceChecklistEntry {
  element_id: string;
  description: string;
  requirement: ReferenceRequirementLevel;
  status: VisualElement["reference_status"];
  material_type: ConsentRecord["material_type"] | null;
  subject_relationship: ConsentRecord["subject_relationship"] | null;
  attestation_given: boolean;
  copyright_flag: boolean;
  flag_resolution: ConsentRecord["flag_resolution"] | null;
}

export function buildReferenceChecklist(
  elements: VisualElement[],
  consentRecords: ConsentRecord[],
): ReferenceChecklistEntry[] {
  return elements
    .filter((e) => e.reference_required || e.fidelity === "exact" || e.fidelity === "closely_based_on")
    .map((element) => {
      const record = consentRecords.find((r) => r.reference_id === element.id);
      const featureKind = classifyReferenceFeatureKind(record?.material_type ?? null, element.fidelity, element.source_category);
      return {
        element_id: element.id,
        description: element.description,
        requirement: referenceRequirementFor(featureKind),
        status: element.reference_status,
        material_type: record?.material_type ?? null,
        subject_relationship: record?.subject_relationship ?? null,
        attestation_given: record?.attestation_given ?? false,
        copyright_flag: record?.copyright_flag ?? false,
        flag_resolution: record?.flag_resolution ?? null,
      };
    });
}

/** §15.2: attestation is required for a living third party's or a child's material; the user's own material never needs it, and deceased-person flows use a lighter single attestation (§15.5) that this same flag covers. */
function requiresAttestation(subjectRelationship: ConsentRecord["subject_relationship"] | null): boolean {
  return subjectRelationship === "living_other" || subjectRelationship === "child" || subjectRelationship === "deceased";
}

/** AC 49 lives here: a required/strongly-recommended third-party reference is not satisfied by a file alone. */
export function isReferenceEntrySatisfied(entry: ReferenceChecklistEntry): boolean {
  if (entry.requirement === "not_required" || entry.requirement === "optional") return true;
  if (entry.status !== "available") return false;
  if (requiresAttestation(entry.subject_relationship) && !entry.attestation_given) return false;
  return true;
}

export function anyRequiredReferenceMissing(checklist: ReferenceChecklistEntry[]): boolean {
  return checklist.some(
    (entry) => (entry.requirement === "required" || entry.requirement === "strongly_recommended") && !isReferenceEntrySatisfied(entry),
  );
}

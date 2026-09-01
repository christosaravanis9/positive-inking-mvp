/**
 * §13.4 readiness states and §9.7's constraint that a low-confidence
 * interpretation can never reach blueprint_ready. This is a genuinely
 * deterministic decision once the inputs are known — reference status and
 * interpretation confidence are facts about the project, not something
 * requiring model judgement to weigh against each other.
 *
 * V3.0 lists five readiness states but does not give an explicit precedence
 * rule for combining "low confidence", "a required reference is missing"
 * and "an unresolved contradiction" into one of them. The ordering below
 * (confidence floor first, then references, then contradictions) is my
 * synthesis, not a literal spec quote — flagged so it's easy to revisit.
 * `concept_visual_ready` is never returned here: it only applies to the
 * optional internal concept-image prototype (§4), which is out of this
 * MVP's scope.
 */

import type { InterpretationConfidence, ReadinessState } from "./types.js";

export interface ReadinessInputs {
  interpretationConfidence: InterpretationConfidence;
  anyRequiredReferenceMissing: boolean;
  hasUnresolvedContradiction: boolean;
}

export function computeReadiness(inputs: ReadinessInputs): ReadinessState {
  if (inputs.interpretationConfidence === "low") {
    return "artist_consultation_recommended";
  }
  if (inputs.anyRequiredReferenceMissing) {
    return "references_needed";
  }
  if (inputs.hasUnresolvedContradiction) {
    return "needs_refinement";
  }
  return "blueprint_ready";
}

/** §13.4 — what reference status a feature kind requires. */
export type ReferenceRequirementLevel = "required" | "strongly_recommended" | "recommended" | "optional" | "not_required";

export type ReferenceFeatureKind =
  | "exact_handwriting_or_signature"
  | "exact_personal_drawing"
  | "recognisable_person_or_hand"
  | "specific_machine_object_or_vehicle"
  | "actual_place_or_building"
  | "interpretive_symbol"
  | "abstract_atmosphere";

const REFERENCE_REQUIREMENT_TABLE: Record<ReferenceFeatureKind, ReferenceRequirementLevel> = {
  exact_handwriting_or_signature: "required",
  exact_personal_drawing: "required",
  recognisable_person_or_hand: "strongly_recommended",
  specific_machine_object_or_vehicle: "strongly_recommended",
  actual_place_or_building: "recommended",
  interpretive_symbol: "optional",
  abstract_atmosphere: "not_required",
};

export function referenceRequirementFor(kind: ReferenceFeatureKind): ReferenceRequirementLevel {
  return REFERENCE_REQUIREMENT_TABLE[kind];
}

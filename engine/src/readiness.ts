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

import type { ContradictionRecord, InterpretationConfidence, ReadinessState } from "./types.js";

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

export interface ReadinessReasonInputs {
  readiness: ReadinessState;
  /** Descriptions of the specific checklist entries that made anyRequiredReferenceMissing true -- the caller already has these building its own reference checklist section, so this never re-derives them. */
  missingReferenceDescriptions: string[];
  /** The two signals DesignConfirmation ORs together into hasUnresolvedContradiction before this ever reaches computeReadiness -- split back out here so a "needs_refinement" reason can name which one actually applies, rather than reaching for the generic case every time. */
  hasUnresolvedPrimaryImagery: boolean;
  /**
   * The Association Engine's own contradictions_noticed, passed through in
   * full (not flattened to a bare description) -- a live-test report
   * correctly pointed out that "A noted contradiction in the design is
   * still unresolved" gives no way to act on it. Each record's own
   * resolutions (the model's own "one or two resolutions" per §11 rule 7)
   * become the reason's "what to do about it," never a newly-invented
   * suggestion.
   */
  otherContradictions: ContradictionRecord[];
}

/**
 * §13.4's five readiness states name a state, not why the project is in it.
 * Every reason returned here comes from facts the caller already computed
 * for its own purposes (the reference checklist, hasUnresolvedPrimaryImagery,
 * the Association Engine's own contradictions_noticed) -- this only phrases
 * them, it never re-derives or invents a new signal, and it never reads the
 * model-written Design considerations prose (that section may say something
 * related in its own words; this is a separate, deterministic explanation of
 * the readiness *state* specifically, not a summary of that section).
 */
export function describeReadinessReason(inputs: ReadinessReasonInputs): string[] {
  switch (inputs.readiness) {
    case "artist_consultation_recommended":
      return [
        "The interpretation behind this Blueprint is still low-confidence — worth confirming the details with an artist before treating it as final.",
      ];
    case "references_needed":
      return inputs.missingReferenceDescriptions.length > 0
        ? [`Still needed before this design is final: ${inputs.missingReferenceDescriptions.join("; ")}.`]
        : ["A required reference is still outstanding."];
    case "needs_refinement": {
      const reasons: string[] = [];
      if (inputs.hasUnresolvedPrimaryImagery) {
        reasons.push("One or more primary visual elements are still an open decision for the client, not yet a concrete idea.");
      }
      for (const contradiction of inputs.otherContradictions) {
        const nextSteps =
          contradiction.resolutions.length > 0
            ? ` Possible next step${contradiction.resolutions.length > 1 ? "s" : ""}: ${contradiction.resolutions.join(", or ")}.`
            : "";
        reasons.push(`${contradiction.description}${nextSteps}`);
      }
      return reasons.length > 0 ? reasons : ["Some details are still unresolved and need refining before this design is final."];
    }
    case "blueprint_ready":
    case "concept_visual_ready":
    default:
      return [];
  }
}

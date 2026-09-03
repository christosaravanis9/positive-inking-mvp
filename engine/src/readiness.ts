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

/**
 * One line per unresolved item feeding "needs_refinement" -- the Association
 * Engine's own contradictions_noticed (full record, not flattened, so each
 * one's own resolutions become the "what to do about it," never a
 * newly-invented suggestion -- a live-test report correctly pointed out that
 * "A noted contradiction in the design is still unresolved" alone gives no
 * way to act on it) plus a fixed line naming unresolved primary imagery when
 * that's the (also-possible) cause. Shared by the Visual direction
 * component's "open_decisions" detail below -- this is the one place that
 * phrasing is generated, so Screen 13's "Open decisions" row and the
 * Blueprint's Visual direction component can never drift apart.
 */
function unresolvedVisualDirectionDetail(hasUnresolvedPrimaryImagery: boolean, otherContradictions: ContradictionRecord[]): string[] {
  const reasons: string[] = [];
  if (hasUnresolvedPrimaryImagery) {
    reasons.push("One or more primary visual elements are still an open decision for the client, not yet a concrete idea.");
  }
  for (const contradiction of otherContradictions) {
    const nextSteps =
      contradiction.resolutions.length > 0
        ? ` Possible next step${contradiction.resolutions.length > 1 ? "s" : ""}: ${contradiction.resolutions.join(", or ")}.`
        : "";
    reasons.push(`${contradiction.description}${nextSteps}`);
  }
  return reasons;
}

export type MeaningStatus = "confirmed" | "not_yet_captured";
export type VisualDirectionStatus = "clear" | "open_decisions";
export type ReferencesStatus = "not_required" | "available" | "still_needed";
export type ArtistDiscussionStatus = "ready" | "not_yet_captured";
/**
 * Never "ready to begin" -- this build produces no final artwork (Sites
 * migration spec §4.3 defect 5: "Final artwork readiness means 'ready to
 * begin artwork.' No artwork is produced or verified by this build," and
 * the same is true here). Both states say plainly that artwork has not
 * begun; they differ only in whether the Blueprint itself -- the brief an
 * artist would work from -- is ready to hand off.
 */
export type FinalArtworkStatus = "not_yet_begun_brief_ready" | "not_yet_begun_pending_items";

export type ReadinessComponentId = "meaning" | "visual_direction" | "references" | "artist_discussion" | "final_artwork";

export interface ReadinessComponent {
  id: ReadinessComponentId;
  status: MeaningStatus | VisualDirectionStatus | ReferencesStatus | ArtistDiscussionStatus | FinalArtworkStatus;
  /** Factual detail lines naming *which* thing is unresolved/missing -- never invented, always a name or description the caller already has. Empty when the status needs no elaboration. */
  detail: string[];
}

export interface ReadinessComponentInputs {
  /** Whether the project's own meaning/why has been captured -- caller already knows this: journey_mode "full" means a non-empty statement_of_intention, any other mode means a non-empty attraction_origin. Never re-derived here, since what counts as "captured" depends on which of those two fields that journey mode actually populates. */
  meaningCaptured: boolean;
  /** Same signal describeReadinessReason's needs_refinement case used -- split out so the reason can name which one actually applies. */
  hasUnresolvedPrimaryImagery: boolean;
  /** The Association Engine's own contradictions_noticed, passed through in full -- see unresolvedVisualDirectionDetail above. */
  otherContradictions: ContradictionRecord[];
  /** True if the reference checklist has at least one required/strongly_recommended entry -- distinguishes "nothing to provide because none of this needs a reference" from "everything needed has been provided," which a single missing-count could not (Sites migration spec §4.3 defect 1: "Intentional absence of exact references is mislabeled... Blueprint displays 'References: Available to provide' rather than 'Not required'"). */
  referenceRequirementExists: boolean;
  /** Descriptions of the specific checklist entries still missing -- the caller already has these building its own reference checklist section, so this never re-derives them. */
  missingReferenceDescriptions: string[];
  /** project.creative_control !== "" -- Screens 7-13 are shared across every journey mode (§7), and Screen 9 (creative_control) is mandatory in all of them, so this is genuinely evidence-backed, not a presentation label (Sites migration spec §4.3 defect 4). */
  creativeControlSet: boolean;
  /**
   * The already-computed overall readiness state, or null when none exists
   * yet (Screen 13, before the Blueprint is built). The "final_artwork"
   * component is only meaningful once a Blueprint exists to describe --
   * omitted entirely when this is null, which is what makes only four of
   * the five components "relevant pre-Blueprint."
   */
  readiness: ReadinessState | null;
}

/**
 * §13.4's readiness states name a state, not why the project is in it, and
 * the Sites migration spec's Blueprint §12 ("Readiness") specifies five
 * named, independently-statused components rather than one sentence.
 * Every status/detail here comes from facts the caller already computed
 * for its own purposes (the reference checklist, hasUnresolvedPrimaryImagery,
 * the Association Engine's own contradictions_noticed, creative_control) --
 * this only classifies and phrases them, it never re-derives or invents a
 * new signal, and it never reads the model-written Design considerations
 * prose. The five component *labels* match Sites §4.2's naming; the
 * *status logic* corrects every defect §4.3 lists as specific to that
 * build, not ported as-is.
 */
export function describeReadinessComponents(inputs: ReadinessComponentInputs): ReadinessComponent[] {
  const components: ReadinessComponent[] = [
    {
      id: "meaning",
      status: inputs.meaningCaptured ? "confirmed" : "not_yet_captured",
      detail: [],
    },
    (() => {
      const open = inputs.hasUnresolvedPrimaryImagery || inputs.otherContradictions.length > 0;
      return {
        id: "visual_direction" as const,
        status: open ? ("open_decisions" as const) : ("clear" as const),
        detail: open ? unresolvedVisualDirectionDetail(inputs.hasUnresolvedPrimaryImagery, inputs.otherContradictions) : [],
      };
    })(),
    (() => {
      if (!inputs.referenceRequirementExists) return { id: "references" as const, status: "not_required" as const, detail: [] };
      if (inputs.missingReferenceDescriptions.length > 0) {
        return { id: "references" as const, status: "still_needed" as const, detail: inputs.missingReferenceDescriptions };
      }
      return { id: "references" as const, status: "available" as const, detail: [] };
    })(),
    {
      id: "artist_discussion",
      status: inputs.creativeControlSet ? "ready" : "not_yet_captured",
      detail: [],
    },
  ];

  if (inputs.readiness !== null) {
    components.push({
      id: "final_artwork",
      status: inputs.readiness === "blueprint_ready" ? "not_yet_begun_brief_ready" : "not_yet_begun_pending_items",
      detail: [],
    });
  }

  return components;
}

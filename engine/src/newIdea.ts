/**
 * §14 — new-idea loop bounds and recomputation. The route (§3.6, "This has
 * given me another idea...") is never removed; this module only governs
 * where it leads.
 */

import type { JourneyMode, SizeClass } from "./types.js";

export type IdeaIterationBehavior = "full" | "full_with_scope_reflection" | "demoted_to_notes";

/**
 * §5's experience-target table gives four named bands (2-4 min, 3-5 min,
 * 5-7 min, 6-10 min) keyed to project descriptions ("attraction/expert",
 * "simple quick path", "personal/multi-element", "large/immersive/style-
 * specific") rather than to element_count/size_class directly. This is this
 * project's own mapping from the concept signals already on hand onto those
 * bands (using each band's midpoint in minutes) -- a synthesis, not a
 * verbatim table, kept in one place so it's a one-line recalibration.
 */
export function targetMinutesForJourney(journeyMode: JourneyMode, elementCount: number, sizeClass: SizeClass | ""): number {
  if (journeyMode === "attraction" || journeyMode === "expert") return 3;
  if (sizeClass === "large" || sizeClass === "sleeve_or_panel" || elementCount >= 4) return 8;
  if (elementCount >= 2) return 6;
  return 4;
}

/**
 * `iterationNumber` is 1-indexed (the first new idea is iteration 1).
 * `elapsedOverTargetRatio` is elapsed time divided by the target band for
 * the project type; demotion also triggers once that exceeds 1.5 (more
 * than 50% over target), independent of iteration count.
 *
 * `hasRealVisualElement` guards the core invariant this loop must never
 * violate: a client always has SOME path to get at least one real visual
 * element and proceed past Screen 7, no matter how long the journey has
 * taken or how many iterations have occurred. Both demotion triggers
 * (iteration count, elapsed-time ratio) are monotonically increasing and
 * never reset within a journey -- without this guard, a client who starts
 * out with zero candidates selected and zero confirmed elements could
 * cross either threshold and then have EVERY subsequent "Add idea"
 * permanently demoted to artist_notes, with no way back and no path
 * forward at all. The anti-thrash protection this function implements
 * exists to bound back-and-forth AFTER something real already exists, not
 * to block the first one -- so demotion is only ever allowed once
 * `hasRealVisualElement` is true.
 */
export function classifyIdeaIteration(
  iterationNumber: number,
  elapsedOverTargetRatio: number,
  hasRealVisualElement: boolean,
): IdeaIterationBehavior {
  if ((iterationNumber >= 6 || elapsedOverTargetRatio > 1.5) && hasRealVisualElement) return "demoted_to_notes";
  if (iterationNumber >= 4) return "full_with_scope_reflection";
  return "full";
}

/** §14.1 — what a new idea invalidates. Nothing not listed here is ever re-asked "for consistency's sake". */
export interface RecomputationTriggers {
  concept_shape_changed: boolean;
  element_count_crossed_one_to_many: boolean;
  likeness_or_place_introduced: boolean;
  background_was_none_now_scenic: boolean;
}

export interface PriorAnswerState {
  density_previously_skipped: boolean;
  realism_previously_skipped_or_defaulted: boolean;
}

export interface InvalidatedQuestions {
  composition_type: boolean;
  density: boolean;
  realism: boolean;
  /** Never silently overridden — if true, this must be re-asked, not defaulted. */
  background_decision: boolean;
}

export function computeInvalidatedQuestions(
  triggers: RecomputationTriggers,
  prior: PriorAnswerState,
): InvalidatedQuestions {
  return {
    composition_type: triggers.concept_shape_changed,
    density: triggers.element_count_crossed_one_to_many && prior.density_previously_skipped,
    realism: triggers.likeness_or_place_introduced && prior.realism_previously_skipped_or_defaulted,
    background_decision: triggers.background_was_none_now_scenic,
  };
}

/** §14.1 rule 3: re-ask only invalidated questions, once each per idea iteration. */
export function canReaskThisIteration(questionKey: string, alreadyReaskedThisIteration: readonly string[]): boolean {
  return !alreadyReaskedThisIteration.includes(questionKey);
}

/**
 * §14.2 — never infer replacement. This is the one function permitted to
 * report that a new idea might displace a confirmed primary element, and it
 * only ever returns a question to ask, never a decision to act on. There is
 * deliberately no corresponding function anywhere in this engine that
 * removes a confirmed element automatically.
 */
export function elementReplacementQuestionRequired(newIdeaAppearsToDisplaceConfirmedPrimary: boolean): boolean {
  return newIdeaAppearsToDisplaceConfirmedPrimary;
}

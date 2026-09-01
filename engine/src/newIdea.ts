/**
 * §14 — new-idea loop bounds and recomputation. The route (§3.6, "This has
 * given me another idea...") is never removed; this module only governs
 * where it leads.
 */

export type IdeaIterationBehavior = "full" | "full_with_scope_reflection" | "demoted_to_notes";

/**
 * `iterationNumber` is 1-indexed (the first new idea is iteration 1).
 * `elapsedOverTargetRatio` is elapsed time divided by the target band for
 * the project type; demotion also triggers once that exceeds 1.5 (more
 * than 50% over target), independent of iteration count.
 */
export function classifyIdeaIteration(iterationNumber: number, elapsedOverTargetRatio: number): IdeaIterationBehavior {
  if (iterationNumber >= 6 || elapsedOverTargetRatio > 1.5) return "demoted_to_notes";
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

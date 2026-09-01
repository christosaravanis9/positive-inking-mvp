/**
 * §12.12 — dynamic avoidance generation. The suggestion *content* is the
 * model's job (project-specific risks); the deterministic part is the
 * sourcing quota and the two fixed options that must always be present.
 */

export interface AvoidanceSourceQuota {
  inverse_of_confirmed_artistic_direction: number;
  composition_risks: number;
  placement_or_longevity_risks: number;
  element_specific_risks: number;
}

/** Uses the upper bound of each stated range (1–2 -> 2), landing at the top of the overall 5–7 target. */
export function computeAvoidanceSourceQuota(): AvoidanceSourceQuota {
  return {
    inverse_of_confirmed_artistic_direction: 2,
    composition_risks: 2,
    placement_or_longevity_risks: 1,
    element_specific_risks: 2,
  };
}

export const AVOID_LIST_FIXED_OPTIONS = ["Something else", "Nothing specifically"] as const;

/** §12.12 — 5 to 7 generated suggestions, excluding the two fixed options. */
export function isValidAvoidanceSuggestionCount(generatedSuggestionCount: number): boolean {
  return generatedSuggestionCount >= 5 && generatedSuggestionCount <= 7;
}

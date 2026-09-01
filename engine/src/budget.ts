/**
 * §12.4 — question budget. Governs discretionary questions only. Mandatory
 * questions (composition type, internal background, place disambiguation
 * when ambiguous, fidelity treatment when exact-fidelity material is
 * present) are never counted here and never traded against it.
 */

import type { CreativeControl } from "./types.js";

export interface QuestionBudget {
  discretionary_composition: number;
  discretionary_artistic: number;
  advanced_controls: "offered" | "on_request" | "suppressed";
}

const BUDGET_TABLE: Record<CreativeControl, QuestionBudget> = {
  client_led: { discretionary_composition: 3, discretionary_artistic: 6, advanced_controls: "offered" },
  collaborative: { discretionary_composition: 2, discretionary_artistic: 4, advanced_controls: "on_request" },
  artist_led: { discretionary_composition: 2, discretionary_artistic: 2, advanced_controls: "on_request" },
  surrendered: { discretionary_composition: 1, discretionary_artistic: 1, advanced_controls: "suppressed" },
};

export interface QuestionBudgetInput {
  creative_control: CreativeControl;
  user_is_tattoo_literate: boolean;
  /**
   * The literacy +2 artistic bonus applies only where the user did not skip
   * discovery, or has opened advanced controls — i.e. only where they asked
   * for more control, never where they asked for less (§12.4).
   */
  literacy_bonus_eligible: boolean;
}

export function computeQuestionBudget(input: QuestionBudgetInput): QuestionBudget {
  const base = BUDGET_TABLE[input.creative_control];
  const literacyBonus = input.user_is_tattoo_literate && input.literacy_bonus_eligible ? 2 : 0;
  return {
    ...base,
    discretionary_artistic: base.discretionary_artistic + literacyBonus,
  };
}

/** The budget is a ceiling, not a target (§12.4) — this only ever says "no more than", never "ask this many". */
export function withinCompositionBudget(spent: number, budget: QuestionBudget): boolean {
  return spent < budget.discretionary_composition;
}

export function withinArtisticBudget(spent: number, budget: QuestionBudget): boolean {
  return spent < budget.discretionary_artistic;
}

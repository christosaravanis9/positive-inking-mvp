/**
 * §12.5 sequencing. The individual eligibility rules live in composition.ts;
 * this module orders them into one pass, exactly like artisticDimensions.ts
 * does for §12.8 — mandatory questions first (place disambiguation must
 * settle before a composition pool can even be chosen, per §12.2), then
 * discretionary ones up to the composition budget, stopping at the first
 * question that still needs an answer.
 */

import type { ConceptShape, PlaceRole, SizeClass } from "./types.js";
import type { QuestionBudget } from "./budget.js";
import {
  evaluateDensity,
  evaluateNegativeSpace,
  evaluateReadingDirection,
  evaluateContainmentVsWrap,
  evaluateBackgroundSource,
} from "./composition.js";

export type CompositionQuestionKey =
  | "place_disambiguation"
  | "composition_type"
  | "internal_background"
  | "density"
  | "negative_space"
  | "reading_direction"
  | "containment_vs_wrap"
  | "background_source";

const ORDER: CompositionQuestionKey[] = [
  "place_disambiguation",
  "composition_type",
  "internal_background",
  "density",
  "negative_space",
  "reading_direction",
  "containment_vs_wrap",
  "background_source",
];

const MANDATORY: ReadonlySet<CompositionQuestionKey> = new Set(["composition_type", "internal_background"]);

export type CompositionQuestionStatus = "asked" | "confirmed" | "skipped" | "pending" | "not_applicable";

export interface CompositionQuestionValue {
  key: CompositionQuestionKey;
  status: CompositionQuestionStatus;
  mandatory: boolean;
  value: string | null;
  reason: string;
}

export interface CompositionFlowContext {
  concept_shape: ConceptShape;
  place_role: PlaceRole;
  element_count: number;
  size_class: SizeClass;
  connects_to_other_work: boolean;
  has_text_or_handwriting: boolean;
  /** The current composition_background value, "undecided" until internal_background is answered. */
  composition_background: "none" | "subtle" | "immersive" | "undecided";
  already_answered: Partial<Record<CompositionQuestionKey, string>>;
  priorBudgetSpent: number;
  budget: QuestionBudget;
}

export interface CompositionFlowResult {
  questions: CompositionQuestionValue[];
  nextToAsk: CompositionQuestionKey | null;
  budgetSpent: number;
}

export function evaluateCompositionFlow(ctx: CompositionFlowContext): CompositionFlowResult {
  const questions: CompositionQuestionValue[] = [];
  let budgetSpent = ctx.priorBudgetSpent;
  let nextToAsk: CompositionQuestionKey | null = null;
  let stopped = false;

  for (const key of ORDER) {
    if (ctx.already_answered[key] !== undefined) {
      questions.push({ key, status: "confirmed", mandatory: MANDATORY.has(key), value: ctx.already_answered[key]!, reason: "Confirmed by the user." });
      continue;
    }

    if (stopped) {
      questions.push({ key, status: "pending", mandatory: MANDATORY.has(key), value: null, reason: "Waiting on an earlier answer in this pass." });
      continue;
    }

    if (key === "place_disambiguation") {
      if (ctx.place_role !== "ambiguous") {
        questions.push({ key, status: "not_applicable", mandatory: false, value: null, reason: "place_role is already resolved." });
        continue;
      }
      questions.push({ key, status: "asked", mandatory: true, value: null, reason: "place_role is ambiguous — must resolve before composition options are generated (§12.2)." });
      nextToAsk = key;
      stopped = true;
      continue;
    }

    if (key === "composition_type" || key === "internal_background") {
      questions.push({ key, status: "asked", mandatory: true, value: null, reason: "Always asked (§12.5)." });
      nextToAsk = key;
      stopped = true;
      continue;
    }

    const eligibility =
      key === "density"
        ? evaluateDensity({ element_count: ctx.element_count, composition_background: ctx.composition_background })
        : key === "negative_space"
          ? evaluateNegativeSpace({ concept_shape: ctx.concept_shape, size_class: ctx.size_class })
          : key === "reading_direction"
            ? evaluateReadingDirection({ element_count: ctx.element_count, has_text_or_handwriting: ctx.has_text_or_handwriting, concept_shape: ctx.concept_shape })
            : key === "containment_vs_wrap"
              ? evaluateContainmentVsWrap({ size_class: ctx.size_class, connects_to_other_work: ctx.connects_to_other_work })
              : evaluateBackgroundSource(ctx.composition_background);

    if (!eligibility.eligible) {
      questions.push({ key, status: "not_applicable", mandatory: false, value: null, reason: eligibility.reason });
      continue;
    }

    if (budgetSpent < ctx.budget.discretionary_composition) {
      questions.push({ key, status: "asked", mandatory: false, value: null, reason: eligibility.reason });
      budgetSpent += 1;
      nextToAsk = key;
      stopped = true;
      continue;
    }

    questions.push({ key, status: "skipped", mandatory: false, value: null, reason: "Discretionary composition budget exhausted." });
  }

  return { questions, nextToAsk, budgetSpent };
}

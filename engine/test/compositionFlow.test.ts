import { describe, it, expect } from "vitest";
import { evaluateCompositionFlow } from "../src/compositionFlow.js";
import { computeQuestionBudget } from "../src/budget.js";

function baseCtx(overrides: Partial<Parameters<typeof evaluateCompositionFlow>[0]> = {}) {
  return {
    concept_shape: "single_emblem" as const,
    place_role: "none" as const,
    element_count: 1,
    size_class: "small" as const,
    connects_to_other_work: false,
    has_text_or_handwriting: false,
    composition_background: "undecided" as const,
    already_answered: {},
    priorBudgetSpent: 0,
    budget: computeQuestionBudget({ creative_control: "collaborative", user_is_tattoo_literate: false, literacy_bonus_eligible: false }),
    ...overrides,
  };
}

describe("evaluateCompositionFlow (§12.5, §12.2)", () => {
  it("place disambiguation is asked first, before composition_type, when ambiguous", () => {
    const result = evaluateCompositionFlow(baseCtx({ place_role: "ambiguous" }));
    expect(result.nextToAsk).toBe("place_disambiguation");
  });

  it("skips disambiguation entirely when place_role is already resolved, going straight to composition_type", () => {
    const result = evaluateCompositionFlow(baseCtx({ place_role: "subject" }));
    expect(result.nextToAsk).toBe("composition_type");
    const disambiguation = result.questions.find((q) => q.key === "place_disambiguation")!;
    expect(disambiguation.status).toBe("not_applicable");
  });

  it("composition_type and internal_background are always mandatory and never counted against budget", () => {
    const result = evaluateCompositionFlow(
      baseCtx({
        already_answered: { composition_type: "isolated", internal_background: "none" },
        priorBudgetSpent: 0,
      }),
    );
    expect(result.budgetSpent).toBe(0);
    const compType = result.questions.find((q) => q.key === "composition_type")!;
    expect(compType.mandatory).toBe(true);
  });

  it("density is skipped for a single isolated element with no background (AC matches §12.5 example)", () => {
    const result = evaluateCompositionFlow(
      baseCtx({
        already_answered: { composition_type: "isolated", internal_background: "none" },
        composition_background: "none",
        element_count: 1,
      }),
    );
    const density = result.questions.find((q) => q.key === "density")!;
    expect(density.status).toBe("not_applicable");
  });

  it("never exceeds the discretionary composition budget (AC 8)", () => {
    const tightBudget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    const result = evaluateCompositionFlow(
      baseCtx({
        concept_shape: "multi_element",
        element_count: 4,
        size_class: "large",
        connects_to_other_work: true,
        has_text_or_handwriting: true,
        composition_background: "immersive",
        already_answered: { composition_type: "collage", internal_background: "immersive" },
        budget: tightBudget,
      }),
    );
    const askedDiscretionary = result.questions.filter((q) => q.status === "asked" && !q.mandatory);
    expect(askedDiscretionary.length).toBeLessThanOrEqual(tightBudget.discretionary_composition);
  });
});

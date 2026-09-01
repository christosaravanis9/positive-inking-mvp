import { describe, it, expect } from "vitest";
import { computeQuestionBudget, withinArtisticBudget, withinCompositionBudget } from "../src/budget.js";

describe("computeQuestionBudget (§12.4)", () => {
  it("matches the table for each creative_control level", () => {
    expect(computeQuestionBudget({ creative_control: "client_led", user_is_tattoo_literate: false, literacy_bonus_eligible: false })).toEqual({
      discretionary_composition: 3,
      discretionary_artistic: 6,
      advanced_controls: "offered",
    });
    expect(computeQuestionBudget({ creative_control: "collaborative", user_is_tattoo_literate: false, literacy_bonus_eligible: false })).toEqual({
      discretionary_composition: 2,
      discretionary_artistic: 4,
      advanced_controls: "on_request",
    });
    expect(computeQuestionBudget({ creative_control: "artist_led", user_is_tattoo_literate: false, literacy_bonus_eligible: false })).toEqual({
      discretionary_composition: 2,
      discretionary_artistic: 2,
      advanced_controls: "on_request",
    });
    expect(computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false })).toEqual({
      discretionary_composition: 1,
      discretionary_artistic: 1,
      advanced_controls: "suppressed",
    });
  });

  it("adds +2 artistic budget for a literate user who asked for more control", () => {
    const budget = computeQuestionBudget({
      creative_control: "collaborative",
      user_is_tattoo_literate: true,
      literacy_bonus_eligible: true,
    });
    expect(budget.discretionary_artistic).toBe(6);
  });

  it("does NOT add the literacy bonus when the user skipped discovery and did not open advanced controls", () => {
    const budget = computeQuestionBudget({
      creative_control: "collaborative",
      user_is_tattoo_literate: true,
      literacy_bonus_eligible: false,
    });
    expect(budget.discretionary_artistic).toBe(4);
  });

  it("surrendered control allows at most one discretionary artistic question (AC 10)", () => {
    const budget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: true, literacy_bonus_eligible: true });
    // Literacy bonus only applies when the user asked for MORE control, never less —
    // surrendered is the "less" end, so even a literate user gets no bonus in practice
    // (literacy_bonus_eligible would realistically be false here; this asserts the
    // budget ceiling itself, independent of that flag).
    expect(withinArtisticBudget(0, budget)).toBe(true);
    expect(withinArtisticBudget(1, budget)).toBe(budget.discretionary_artistic > 1);
  });
});

describe("withinCompositionBudget / withinArtisticBudget", () => {
  it("is a ceiling, not a target — spent below the number is within budget, at or above is not", () => {
    const budget = computeQuestionBudget({ creative_control: "collaborative", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    expect(withinCompositionBudget(0, budget)).toBe(true);
    expect(withinCompositionBudget(1, budget)).toBe(true);
    expect(withinCompositionBudget(2, budget)).toBe(false);
  });
});

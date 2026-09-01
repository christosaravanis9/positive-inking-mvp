import { describe, it, expect } from "vitest";
import { computeBlueprintSectionEligibility } from "../src/blueprintSections.js";

describe("computeBlueprintSectionEligibility (§17.2, AC 21)", () => {
  it("full mode includes everything regardless of the other flags", () => {
    const result = computeBlueprintSectionEligibility({
      journeyMode: "full",
      significanceClaimed: false,
      themesSurfaced: false,
      statementUserAuthored: false,
    });
    expect(result).toEqual({
      storySection: "story",
      includeYourWhy: true,
      includeWhatMattersMost: true,
      includeStatementOfInspiration: true,
    });
  });

  it("attraction mode with nothing claimed omits Your Why, What matters most, and Statement of inspiration entirely", () => {
    const result = computeBlueprintSectionEligibility({
      journeyMode: "attraction",
      significanceClaimed: false,
      themesSurfaced: false,
      statementUserAuthored: false,
    });
    expect(result.storySection).toBe("why_this_image");
    expect(result.includeYourWhy).toBe(false);
    expect(result.includeWhatMattersMost).toBe(false);
    expect(result.includeStatementOfInspiration).toBe(false);
  });

  it("attraction mode includes Your Why only when significance was actually claimed by the user", () => {
    const result = computeBlueprintSectionEligibility({
      journeyMode: "attraction",
      significanceClaimed: true,
      themesSurfaced: false,
      statementUserAuthored: false,
    });
    expect(result.includeYourWhy).toBe(true);
  });

  it("expert mode behaves like attraction mode for section eligibility", () => {
    const result = computeBlueprintSectionEligibility({
      journeyMode: "expert",
      significanceClaimed: false,
      themesSurfaced: true,
      statementUserAuthored: false,
    });
    expect(result.storySection).toBe("why_this_image");
    expect(result.includeWhatMattersMost).toBe(true);
  });

  it("statement of inspiration is never model-generated in attraction/expert -- only included if the user authored it", () => {
    const notAuthored = computeBlueprintSectionEligibility({
      journeyMode: "attraction",
      significanceClaimed: true,
      themesSurfaced: true,
      statementUserAuthored: false,
    });
    expect(notAuthored.includeStatementOfInspiration).toBe(false);

    const authored = computeBlueprintSectionEligibility({
      journeyMode: "attraction",
      significanceClaimed: true,
      themesSurfaced: true,
      statementUserAuthored: true,
    });
    expect(authored.includeStatementOfInspiration).toBe(true);
  });
});

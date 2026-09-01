import { describe, it, expect } from "vitest";
import { computeAvoidanceSourceQuota, isValidAvoidanceSuggestionCount, AVOID_LIST_FIXED_OPTIONS } from "../src/avoidance.js";

describe("avoidance quota (§12.12)", () => {
  it("sums to a total within the 5-7 target band", () => {
    const quota = computeAvoidanceSourceQuota();
    const total = Object.values(quota).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(5);
    expect(total).toBeLessThanOrEqual(7);
  });

  it("always includes both fixed options", () => {
    expect(AVOID_LIST_FIXED_OPTIONS).toContain("Something else");
    expect(AVOID_LIST_FIXED_OPTIONS).toContain("Nothing specifically");
  });

  it("validates the generated suggestion count is within 5-7", () => {
    expect(isValidAvoidanceSuggestionCount(4)).toBe(false);
    expect(isValidAvoidanceSuggestionCount(5)).toBe(true);
    expect(isValidAvoidanceSuggestionCount(7)).toBe(true);
    expect(isValidAvoidanceSuggestionCount(8)).toBe(false);
  });
});

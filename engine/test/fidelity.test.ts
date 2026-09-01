import { describe, it, expect } from "vitest";
import { fidelityTreatmentRequired } from "../src/fidelity.js";

describe("fidelityTreatmentRequired (§12.9)", () => {
  it("required for handwriting, signature, or drawing with exact fidelity", () => {
    expect(fidelityTreatmentRequired(true, "handwriting")).toBe(true);
    expect(fidelityTreatmentRequired(true, "signature")).toBe(true);
    expect(fidelityTreatmentRequired(true, "drawing")).toBe(true);
  });

  it("not required for other element kinds even with exact fidelity", () => {
    expect(fidelityTreatmentRequired(true, "other")).toBe(false);
  });

  it("not required when there is no exact-fidelity element", () => {
    expect(fidelityTreatmentRequired(false, "handwriting")).toBe(false);
  });

  it("has no creative_control parameter at all -- structurally exempt from control-level suppression (§12.8 exemption, AC 40)", () => {
    expect(fidelityTreatmentRequired.length).toBe(2);
  });
});

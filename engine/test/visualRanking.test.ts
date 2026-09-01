import { describe, it, expect } from "vitest";
import { rankVisualCandidates, isPersonalSourceCategory, type RankableCandidate } from "../src/visualRanking.js";

function candidate(overrides: Partial<RankableCandidate> & { source_category: string }): RankableCandidate {
  return {
    personal_relevance: 0,
    story_relevance: 0,
    visual_potential: 0,
    originality: 0,
    genericity: 0,
    reference_availability: 0,
    ...overrides,
  };
}

describe("rankVisualCandidates (§11)", () => {
  it("personal material beats generic tattoo imagery even with lower raw visual appeal (AC 13)", () => {
    const personal = candidate({
      source_category: "personal_memory",
      personal_relevance: 8,
      story_relevance: 7,
      originality: 5,
      genericity: 2,
      visual_potential: 3, // deliberately low
      reference_availability: 4,
    });
    const generic = candidate({
      source_category: "tattoo_reference",
      personal_relevance: 0,
      story_relevance: 0,
      originality: 1,
      genericity: 9, // deliberately high genericity
      visual_potential: 9, // deliberately high raw visual appeal
      reference_availability: 9,
    });

    const ranked = rankVisualCandidates([generic, personal]);
    expect(ranked[0]).toBe(personal);
  });

  it("originality outweighs generic visual appeal on its own", () => {
    const original = candidate({ source_category: "artistic_reference", originality: 9, visual_potential: 2 });
    const genericButFlashy = candidate({ source_category: "artistic_symbol", originality: 0, genericity: 8, visual_potential: 9 });
    const ranked = rankVisualCandidates([genericButFlashy, original]);
    expect(ranked[0]).toBe(original);
  });

  it("never mutates the input array, and is stable for equal scores", () => {
    const a = candidate({ source_category: "artistic_symbol" });
    const b = candidate({ source_category: "artistic_symbol" });
    const input = [a, b];
    const ranked = rankVisualCandidates(input);
    expect(input).toEqual([a, b]); // unchanged
    expect(ranked).toEqual([a, b]); // stable order preserved for a tie
    expect(ranked).not.toBe(input); // new array
  });

  describe("floor rule (§3.2)", () => {
    it("promotes new_materialisation to first rank when no personal-category candidate exists", () => {
      const newMaterial = candidate({ source_category: "new_materialisation", personal_relevance: 1, story_relevance: 1 });
      const publicSymbol = candidate({ source_category: "artistic_symbol", visual_potential: 10, originality: 10 });
      const ranked = rankVisualCandidates([publicSymbol, newMaterial]);
      expect(ranked[0]).toBe(newMaterial);
    });

    it("does NOT promote new_materialisation when real personal material is present -- the floor only applies to its absence", () => {
      const newMaterial = candidate({ source_category: "new_materialisation", personal_relevance: 1 });
      const personal = candidate({ source_category: "personal_artefact", personal_relevance: 9, story_relevance: 9, originality: 8 });
      const ranked = rankVisualCandidates([newMaterial, personal]);
      expect(ranked[0]).toBe(personal);
    });
  });

  describe("isPersonalSourceCategory (§22 instrumentation reuses this, never a second hand-maintained list)", () => {
    it("classifies the four personal categories as personal", () => {
      expect(isPersonalSourceCategory("personal_artefact")).toBe(true);
      expect(isPersonalSourceCategory("personal_memory")).toBe(true);
      expect(isPersonalSourceCategory("personal_place")).toBe(true);
      expect(isPersonalSourceCategory("personal_person")).toBe(true);
    });

    it("classifies generic/new/public categories as not personal", () => {
      expect(isPersonalSourceCategory("new_materialisation")).toBe(false);
      expect(isPersonalSourceCategory("public_artefact")).toBe(false);
      expect(isPersonalSourceCategory("artistic_symbol")).toBe(false);
      expect(isPersonalSourceCategory("artistic_reference")).toBe(false);
      expect(isPersonalSourceCategory("tattoo_reference")).toBe(false);
    });
  });

  describe("scope limit -- this function only ever sees what it's given", () => {
    it("would rank a user-authored-shaped candidate like any other IF it were ever passed in -- the real guarantee is architectural: the UI never calls this on the addedIdeas array, which this test documents rather than asserts", () => {
      const userAuthored = candidate({ source_category: "artistic_symbol", genericity: 10 });
      const ranked = rankVisualCandidates([userAuthored]);
      // This function has no origin field to distinguish "user-authored" from
      // "system-generated" -- it can only rank what's in the array. The
      // non-downranking guarantee for user-authored ideas holds because
      // ElementsDiscovery.tsx never puts addedIdeas through this function at
      // all, the same architectural pattern as the suppression scope limit.
      expect(ranked).toEqual([userAuthored]);
    });
  });
});

import { describe, it, expect } from "vitest";
import { parseAssociationResult } from "../src/schemas/association.js";

/**
 * Real, live-tested bug (2026-09-09): a real /api/associations batch fetch
 * (9-12 candidates) intermittently 502'd with ZERO candidates because one
 * malformed candidate's follow_up_prompt failed a whole-array zod parse.
 * Two distinct real failure shapes, both covered here: an explicit JSON
 * `null` where the schema only accepted a string or absence, and a
 * genuinely missing value where resolution_state required one.
 */

function goodCandidate(overrides: Record<string, unknown> = {}) {
  return {
    description: "A small compass rose",
    personal_meaning: "Marks the direction she always pointed you toward",
    source_category: "personal_artefact",
    resolution_state: "concrete",
    personal_relevance: 8,
    story_relevance: 8,
    visual_potential: 7,
    originality: 6,
    genericity: 2,
    reference_availability: 5,
    ...overrides,
  };
}

const BASE_RESPONSE_FIELDS = {
  place_role: "none",
  place_role_reasoning: "No place named in the story.",
  spatial_language_present: false,
  has_text_or_handwriting: false,
  has_likeness: false,
  text_is_primary: false,
  likeness_is_primary: false,
  primary_element_type: "object",
  contradictions_noticed: [],
};

describe("parseAssociationResult", () => {
  it("returns every candidate unchanged when the batch is fully valid", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate(), goodCandidate({ description: "Second" })],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.data?.visual_candidates).toHaveLength(2);
    expect(result.droppedCandidates).toHaveLength(0);
  });

  it("coerces an explicit null follow_up_prompt to undefined -- the first real failure shape (concrete candidate, model emitted null anyway)", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate({ follow_up_prompt: null })],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.droppedCandidates).toHaveLength(0);
    expect(result.data?.visual_candidates[0]?.follow_up_prompt).toBeUndefined();
  });

  it("drops a candidate genuinely missing follow_up_prompt when resolution_state requires it -- the second real failure shape", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate({ description: "Good" }), goodCandidate({ description: "Bad", resolution_state: "needs_client_specific_detail" })],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.data?.visual_candidates).toHaveLength(1);
    expect(result.data?.visual_candidates[0]?.description).toBe("Good");
    expect(result.droppedCandidates).toHaveLength(1);
    expect(result.droppedCandidates[0]).toMatchObject({ index: 1, resolutionState: "needs_client_specific_detail" });
    expect(result.droppedCandidates[0]!.issues).toContain("follow_up_prompt");
  });

  it("a null follow_up_prompt on a candidate that DOES need one still gets dropped -- null never satisfies the refine() requirement either", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate({ resolution_state: "needs_client_specific_detail", follow_up_prompt: null })],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.data).toBeNull();
    expect(result.droppedCandidates).toHaveLength(1);
  });

  it("reports the correct original index for a dropped candidate even when it isn't the first or last", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate(), goodCandidate({ resolution_state: "needs_client_specific_detail" }), goodCandidate(), goodCandidate()],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.droppedCandidates[0]?.index).toBe(1);
    expect(result.data?.visual_candidates).toHaveLength(3);
  });

  it("returns data: null once every candidate is malformed -- 'only fail when zero survive'", () => {
    const result = parseAssociationResult({
      visual_candidates: [
        goodCandidate({ resolution_state: "needs_client_specific_detail" }),
        goodCandidate({ resolution_state: "needs_client_specific_detail" }),
      ],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.data).toBeNull();
    expect(result.droppedCandidates).toHaveLength(2);
  });

  it("still fails the whole request when a non-candidate field is malformed, even with otherwise-valid candidates -- scope stays narrow to candidates only", () => {
    const result = parseAssociationResult({
      visual_candidates: [goodCandidate()],
      ...BASE_RESPONSE_FIELDS,
      place_role: "not_a_real_enum_value",
    });

    expect(result.data).toBeNull();
    expect(result.droppedCandidates).toHaveLength(0); // the candidate itself was fine
  });

  it("never includes the dropped candidate's own description/personal_meaning text in the reported issue -- only structural detail", () => {
    const result = parseAssociationResult({
      visual_candidates: [
        goodCandidate({ description: "A very specific real story detail", resolution_state: "needs_client_specific_detail" }),
      ],
      ...BASE_RESPONSE_FIELDS,
    });

    expect(result.droppedCandidates[0]!.issues).not.toContain("A very specific real story detail");
  });

  it("handles a missing/non-array visual_candidates gracefully as zero candidates, not a crash", () => {
    const result = parseAssociationResult({ ...BASE_RESPONSE_FIELDS });
    expect(result.data).toBeNull();
    expect(result.droppedCandidates).toHaveLength(0);
  });
});

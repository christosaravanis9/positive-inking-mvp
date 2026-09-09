import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

process.env.ANTHROPIC_API_KEY = "test-key";

vi.mock("../src/modelClient.js", () => ({
  callModelForStructuredOutput: vi.fn(),
}));

const { callModelForStructuredOutput } = await import("../src/modelClient.js");
const { createApp } = await import("../src/app.js");

/**
 * Regression coverage for the real, live-tested bug (2026-09-09): a single
 * malformed candidate's follow_up_prompt among 9-12 otherwise-good ones
 * previously failed the WHOLE batch with a 502 and zero candidates. Fixed
 * two ways, both needed (server/src/schemas/association.ts): (1) a null
 * follow_up_prompt on a candidate that doesn't need one is now coerced to
 * undefined instead of failing type validation; (2) a genuinely missing
 * follow_up_prompt on a candidate that DOES need one is now dropped from
 * the batch individually instead of failing the whole request.
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

beforeEach(() => {
  vi.mocked(callModelForStructuredOutput).mockReset();
});

const VALID_REQUEST_BODY = { confirmed_meaning_or_provenance: "A memorial for a childhood dog named Scout." };

describe("POST /api/associations -- per-candidate salvage (live-tested bug, 2026-09-09)", () => {
  it("coerces an explicit null follow_up_prompt (on a candidate that doesn't need one) to undefined instead of failing the whole batch", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        visual_candidates: [goodCandidate({ description: "Candidate A", follow_up_prompt: null }), goodCandidate({ description: "Candidate B" })],
        ...BASE_RESPONSE_FIELDS,
      },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    expect(response.status).toBe(200);
    expect(response.body.data.visual_candidates).toHaveLength(2);
    expect(response.body.data.visual_candidates[0].description).toBe("Candidate A");
    expect(response.body.data.visual_candidates[0].follow_up_prompt).toBeUndefined();
  });

  it("drops just the one candidate genuinely missing follow_up_prompt when resolution_state requires it, keeping every other good candidate", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        visual_candidates: [
          goodCandidate({ description: "Candidate A" }),
          goodCandidate({ description: "Candidate B", resolution_state: "needs_client_specific_detail" }), // missing follow_up_prompt
          goodCandidate({ description: "Candidate C" }),
        ],
        ...BASE_RESPONSE_FIELDS,
      },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    expect(response.status).toBe(200);
    const descriptions = response.body.data.visual_candidates.map((c: { description: string }) => c.description);
    expect(descriptions).toEqual(["Candidate A", "Candidate C"]);
  });

  it("logs a [model-timing] line for every dropped candidate, without ever including the candidate's own description/personal_meaning text", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        visual_candidates: [
          goodCandidate({ description: "A very specific real story detail that must never be logged", resolution_state: "needs_client_specific_detail" }),
        ],
        ...BASE_RESPONSE_FIELDS,
      },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    // Zero candidates survived (the only one was malformed) -- whole request fails.
    expect(response.status).toBe(502);
    const droppedLine = logSpy.mock.calls.map((c) => c[0] as string).find((line) => line.includes("candidate_dropped"));
    expect(droppedLine).toBeDefined();
    expect(droppedLine).toContain("[model-timing]");
    expect(droppedLine).toContain("stage=association");
    expect(droppedLine).toContain("candidate_index=0");
    expect(droppedLine).toContain("resolution_state=needs_client_specific_detail");
    expect(droppedLine).not.toContain("A very specific real story detail");

    logSpy.mockRestore();
  });

  it("still fails the whole request (502) when every candidate is malformed", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        visual_candidates: [goodCandidate({ resolution_state: "needs_client_specific_detail" }), goodCandidate({ resolution_state: "needs_client_specific_detail" })],
        ...BASE_RESPONSE_FIELDS,
      },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("model_invalid_response");
  });

  it("still fails the whole request when a non-candidate field is malformed, even with otherwise-good candidates -- scope stays narrow to candidates only", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        visual_candidates: [goodCandidate()],
        ...BASE_RESPONSE_FIELDS,
        place_role: "not_a_real_value",
      },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    expect(response.status).toBe(502);
  });

  it("a fully valid batch still passes through unaffected, same as before this fix", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: { visual_candidates: [goodCandidate(), goodCandidate({ description: "Candidate B" })], ...BASE_RESPONSE_FIELDS },
      raw: {},
    });

    const app = createApp();
    const response = await request(app).post("/api/associations").send(VALID_REQUEST_BODY);

    expect(response.status).toBe(200);
    expect(response.body.data.visual_candidates).toHaveLength(2);
  });
});

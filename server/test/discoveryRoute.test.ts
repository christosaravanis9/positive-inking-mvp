import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

process.env.ANTHROPIC_API_KEY = "test-key";

vi.mock("../src/modelClient.js", () => ({
  callModelForStructuredOutput: vi.fn(),
}));

const { callModelForStructuredOutput } = await import("../src/modelClient.js");
const { createApp } = await import("../src/app.js");

/**
 * Meaning-depth gate (approved proposal): meaning_is_thin/depth_prompt/depth_prompt_suggestions
 * ride the existing Discovery response -- no second model call. These tests cover the schema
 * enforcement side (the route's own responsibility); Story.tsx's branching on these fields is
 * covered separately in Story.test.tsx.
 */
const BASE_MODEL_RESPONSE = {
  primary_viewpoint: "past",
  secondary_viewpoints: [],
  primary_intention: "memorial",
  secondary_intentions: [],
  deep_why: "A concrete, specific reason.",
  key_themes: ["family"],
  candidate_core_values: ["connection"],
  personal_people: [],
  personal_places: [],
  personal_objects: [],
  personal_events: [],
  personal_memories: [],
  personal_phrases: [],
  open_threads: [],
  interpretation: "An interpretation.",
  statement_of_intention: "A statement of intention.",
  clarification_required: false,
  clarification_reason: null,
  clarification_question: null,
  suggested_answers: [],
  confidence: 0.8,
  visual_confidence: 0.8,
};

beforeEach(() => {
  vi.mocked(callModelForStructuredOutput).mockReset();
});

describe("POST /api/discovery -- meaning-depth gate fields", () => {
  it("passes meaning_is_thin: false, depth_prompt: null through untouched for a substantive story", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: { ...BASE_MODEL_RESPONSE, meaning_is_thin: false, depth_prompt: null, depth_prompt_suggestions: [] },
      raw: {},
    });
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: "marking the point I stopped drinking" });

    expect(response.status).toBe(200);
    expect(response.body.data.meaning_is_thin).toBe(false);
    expect(response.body.data.depth_prompt).toBeNull();
    expect(response.body.data.depth_prompt_suggestions).toEqual([]);
  });

  it("passes meaning_is_thin: true with a depth_prompt and suggestions through untouched for a thin story", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        ...BASE_MODEL_RESPONSE,
        meaning_is_thin: true,
        depth_prompt: "Is there one moment this is really about?",
        depth_prompt_suggestions: ["a person", "a place", "a change"],
      },
      raw: {},
    });
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: "I want a rose, roses are pretty" });

    expect(response.status).toBe(200);
    expect(response.body.data.meaning_is_thin).toBe(true);
    expect(response.body.data.depth_prompt).toBe("Is there one moment this is really about?");
    expect(response.body.data.depth_prompt_suggestions).toEqual(["a person", "a place", "a change"]);
  });

  it("rejects a model response missing meaning_is_thin as a visible schema-validation failure, not a silent default", async () => {
    const { meaning_is_thin: _omit, ...withoutField } = { ...BASE_MODEL_RESPONSE, depth_prompt: null, depth_prompt_suggestions: [] } as Record<string, unknown>;
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({ data: withoutField, raw: {} });
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: "a story" });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("model_invalid_response");
  });

  it("is independent of clarification_required -- a thin-but-visually-confident story sets meaning_is_thin true without clarification_required", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({
      data: {
        ...BASE_MODEL_RESPONSE,
        clarification_required: false,
        visual_confidence: 0.9,
        meaning_is_thin: true,
        depth_prompt: "Is there one moment this is really about?",
        depth_prompt_suggestions: [],
      },
      raw: {},
    });
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: "I want a rose, roses are pretty" });

    expect(response.body.data.clarification_required).toBe(false);
    expect(response.body.data.meaning_is_thin).toBe(true);
  });
});

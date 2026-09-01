import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

process.env.ANTHROPIC_API_KEY = "test-key";

vi.mock("../src/modelClient.js", () => ({
  callModelForStructuredOutput: vi.fn(),
}));

const { callModelForStructuredOutput } = await import("../src/modelClient.js");
const { createApp } = await import("../src/app.js");

const MODEL_RESPONSE = {
  story: "Grounded story text.",
  why_this_image: "First saw this on a trip to Kyoto and never stopped thinking about it.",
  // A model that ignores instructions and writes content anyway -- the route
  // must still null these out for an attraction-mode journey where nothing
  // was claimed, regardless of what the model produced.
  why: "This represents a deep transformation in the client's life.",
  what_matters_most: "Transformation and renewal.",
  visual_direction: "A single koi fish, isolated, no background.",
  artistic_direction: "Black and grey, recommendation: illustrative realism.",
  placement: "Forearm, medium.",
  design_considerations: ["Keep linework bold enough to hold up at this size."],
  statement_of_inspiration: "This is who I am becoming.",
  artist_brief: "Client wants a clean, isolated koi fish, no background, medium forearm placement.",
};

beforeEach(() => {
  vi.mocked(callModelForStructuredOutput).mockReset();
  vi.mocked(callModelForStructuredOutput).mockResolvedValue({ data: MODEL_RESPONSE, raw: {} });
});

describe("POST /api/blueprint (§17.2 structural enforcement, AC 21)", () => {
  it("nulls out why, what_matters_most and statement_of_inspiration for attraction mode when nothing was claimed, even though the model wrote content for them", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/blueprint")
      .send({
        journey_mode: "attraction",
        significance_claimed: false,
        themes_surfaced: false,
        statement_user_authored: false,
        interpretation_confidence: "standard",
        any_required_reference_missing: false,
        has_unresolved_contradiction: false,
        confirmed_project_summary: "A koi fish the client has always liked.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.story).toBeNull();
    expect(response.body.data.why_this_image).toBe(MODEL_RESPONSE.why_this_image);
    expect(response.body.data.why).toBeNull();
    expect(response.body.data.what_matters_most).toBeNull();
    expect(response.body.data.statement_of_inspiration).toBeNull();
    // Sections unaffected by §17.2 pass through untouched.
    expect(response.body.data.visual_direction).toBe(MODEL_RESPONSE.visual_direction);
  });

  it("includes why_this_image sections when they were actually claimed by the user", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/blueprint")
      .send({
        journey_mode: "attraction",
        significance_claimed: true,
        themes_surfaced: true,
        statement_user_authored: true,
        interpretation_confidence: "standard",
        any_required_reference_missing: false,
        has_unresolved_contradiction: false,
        confirmed_project_summary: "A koi fish the client has always liked.",
      });

    expect(response.body.data.why).toBe(MODEL_RESPONSE.why);
    expect(response.body.data.what_matters_most).toBe(MODEL_RESPONSE.what_matters_most);
    expect(response.body.data.statement_of_inspiration).toBe(MODEL_RESPONSE.statement_of_inspiration);
  });

  it("full mode includes story and never why_this_image", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/blueprint")
      .send({
        journey_mode: "full",
        interpretation_confidence: "standard",
        confirmed_project_summary: "A tattoo for a grandmother's olive tree.",
      });

    expect(response.body.data.story).toBe(MODEL_RESPONSE.story);
    expect(response.body.data.why_this_image).toBeNull();
  });

  it("computes readiness deterministically -- low interpretation confidence never reaches blueprint_ready even if the model is silent about it", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/blueprint")
      .send({
        journey_mode: "full",
        interpretation_confidence: "low",
        confirmed_project_summary: "A short, unclear story.",
      });

    expect(response.body.data.readiness).toBe("artist_consultation_recommended");
  });

  it("rejects manual mode -- Working Notes never goes through the Blueprint Writer", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/blueprint")
      .send({ journey_mode: "manual", confirmed_project_summary: "n/a" });

    expect(response.status).toBe(400);
  });
});

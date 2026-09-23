import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

process.env.ANTHROPIC_API_KEY = "test-key";

vi.mock("../src/modelClient.js", () => ({
  callModelForStructuredOutput: vi.fn(),
}));

const { callModelForStructuredOutput } = await import("../src/modelClient.js");
const { createApp } = await import("../src/app.js");

function mockModel(data: unknown) {
  vi.mocked(callModelForStructuredOutput).mockResolvedValue({ data, raw: {} });
}

beforeEach(() => {
  vi.mocked(callModelForStructuredOutput).mockReset();
});

describe("POST /api/style-hints", () => {
  it("returns a personalized hint per lane when the model responds fully", async () => {
    mockModel({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      illustrative: "The actual kitchen table, drawn plainly as it was.",
      typography: "Her own handwriting, not an invented phrase.",
      framed: "A few small beats showing how the choice unfolded.",
      narrative_collage: "The apron and the table, brought together in one piece.",
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/style-hints")
      .send({ confirmed_meaning_or_provenance: "A statement grounded in the client's own confirmed story." });

    expect(response.status).toBe(200);
    expect(response.body.data.hints).toEqual({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      illustrative: "The actual kitchen table, drawn plainly as it was.",
      typography: "Her own handwriting, not an invented phrase.",
      framed: "A few small beats showing how the choice unfolded.",
      narrative_collage: "The apron and the table, brought together in one piece.",
    });
  });

  it("threads the confirmed meaning/provenance text into the model call exactly as sent", async () => {
    mockModel({});

    const app = createApp();
    await request(app).post("/api/style-hints").send({ confirmed_meaning_or_provenance: "A very specific real story detail." });

    const call = vi.mocked(callModelForStructuredOutput).mock.calls[0]![0];
    expect(call.stage).toBe("style_hints");
    expect(call.userMessage).toContain("A very specific real story detail.");
    expect(call.tool.name).toBe("write_style_hints");
  });

  it("returns hints with only the lanes the model actually provided -- a missing lane is not an error", async () => {
    mockModel({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      // every other lane omitted
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/style-hints")
      .send({ confirmed_meaning_or_provenance: "A statement grounded in the client's own confirmed story." });

    expect(response.status).toBe(200);
    expect(response.body.data.hints).toEqual({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
    });
  });

  it("rejects an empty confirmed_meaning_or_provenance", async () => {
    const app = createApp();
    const response = await request(app).post("/api/style-hints").send({ confirmed_meaning_or_provenance: "" });
    expect(response.status).toBe(400);
  });

  it("returns 502 when the model response fails schema validation entirely (not an object)", async () => {
    mockModel("not an object at all");
    const app = createApp();
    const response = await request(app)
      .post("/api/style-hints")
      .send({ confirmed_meaning_or_provenance: "A statement grounded in the client's own confirmed story." });
    expect(response.status).toBe(502);
  });

  it("surfaces a model-layer failure (e.g. timeout) the same way every other model-backed route does -- never a silently canned 200", async () => {
    const { ModelError } = await import("../src/errors.js");
    vi.mocked(callModelForStructuredOutput).mockRejectedValue(new ModelError("model_timeout", "Model request timed out after 8000ms."));

    const app = createApp();
    const response = await request(app)
      .post("/api/style-hints")
      .send({ confirmed_meaning_or_provenance: "A statement grounded in the client's own confirmed story." });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("model_timeout");
  });
});

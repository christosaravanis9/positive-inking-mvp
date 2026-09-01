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

describe("POST /api/style-reference (§12.10)", () => {
  it("resolves an established medium confidently and leaves the rest open -- woodblock print", async () => {
    mockModel({
      recognized: true,
      under_specified: false,
      summary: "Woodblock printing points toward bold, structured linework with flat colour blocks.",
      leaves_open_note: "Contrast, texture and edge treatment are still open.",
      resolved: [
        { dimension: "linework", value: "heavy" },
        { dimension: "colour", value: "selective" },
        { dimension: "shading", value: "minimal" },
      ],
    });

    const app = createApp();
    const response = await request(app).post("/api/style-reference").send({ style_reference: "woodblock print" });

    expect(response.status).toBe(200);
    expect(response.body.data.recognized).toBe(true);
    expect(response.body.data.under_specified).toBe(false);
    expect(response.body.data.resolved_values).toEqual({
      linework: "heavy",
      colour: "selective",
      shading: "minimal",
    });
    expect(response.body.data.style_resolves.sort()).toEqual(["colour", "linework", "shading"].sort());
    // Everything not resolved -- including dimensions never eligible for style resolution at all -- stays open.
    expect(response.body.data.style_leaves_open).toEqual(
      expect.arrayContaining(["realism", "visual_presence", "contrast", "surface_detail", "edge_treatment", "rendering_references"]),
    );
    expect(response.body.data.style_leaves_open).not.toEqual(expect.arrayContaining(["linework", "colour", "shading"]));
  });

  it("flags an under-specified named artist and asks for a visual example instead of guessing", async () => {
    mockModel({
      recognized: true,
      under_specified: true,
      summary: "This artist's work spans a wide range, so a reference image would help.",
      leaves_open_note: "Nearly everything is still open without seeing an example of their work.",
      resolved: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/style-reference").send({ style_reference: "in the style of a specific tattoo artist" });

    expect(response.body.data.recognized).toBe(true);
    expect(response.body.data.under_specified).toBe(true);
    expect(response.body.data.style_resolves).toEqual([]);
    expect(response.body.data.resolved_values).toEqual({});
  });

  it("partial-resolution style: resolves some dimensions, never invents values for the rest, and never overrides an already-confirmed dimension", async () => {
    mockModel({
      recognized: true,
      under_specified: false,
      summary: "Fine-line work points toward light, delicate linework.",
      leaves_open_note: "Colour, shading and contrast remain open.",
      resolved: [
        { dimension: "linework", value: "light" },
        // The model tries to override a dimension the client already confirmed -- must be dropped.
        { dimension: "colour", value: "full" },
        // The model returns a value outside the fixed vocabulary -- must be dropped.
        { dimension: "contrast", value: "extremely_dramatic" },
        // The model returns an unrecognised dimension name entirely -- must be dropped.
        { dimension: "not_a_real_dimension", value: "whatever" },
      ],
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/style-reference")
      .send({ style_reference: "fine-line / single-needle", already_confirmed: { colour: "black_and_grey" } });

    expect(response.body.data.resolved_values).toEqual({ linework: "light" });
    expect(response.body.data.style_resolves).toEqual(["linework"]);
    expect(response.body.data.style_leaves_open).toEqual(expect.arrayContaining(["colour", "contrast", "shading"]));
  });

  it("treats vague input as unrecognised without resolving anything", async () => {
    mockModel({
      recognized: false,
      under_specified: false,
      summary: "",
      leaves_open_note: "",
      resolved: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/style-reference").send({ style_reference: "something cool" });

    expect(response.body.data.recognized).toBe(false);
    expect(response.body.data.style_resolves).toEqual([]);
  });

  it("rejects an empty style reference", async () => {
    const app = createApp();
    const response = await request(app).post("/api/style-reference").send({ style_reference: "" });
    expect(response.status).toBe(400);
  });

  it("returns 502 when the model response fails schema validation", async () => {
    mockModel({ recognized: "not-a-boolean" });
    const app = createApp();
    const response = await request(app).post("/api/style-reference").send({ style_reference: "American traditional" });
    expect(response.status).toBe(502);
  });
});

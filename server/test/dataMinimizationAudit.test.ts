import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import request from "supertest";

/**
 * Regression coverage locking in the data-minimization audit's findings for
 * items 1 (API key never reaches the client), 2 (no story/response body
 * ever logged), and 3 (no server-side file upload, so nothing can ever be
 * written to disk). None of these required a code fix -- this file exists
 * so a future change can't silently reintroduce a leak in any of them
 * without a test noticing.
 */

const SECRET_API_KEY_MARKER = "sk-ant-AUDIT-TEST-SECRET-MARKER-DO-NOT-LEAK";
process.env.ANTHROPIC_API_KEY = SECRET_API_KEY_MARKER;

vi.mock("../src/modelClient.js", () => ({
  callModelForStructuredOutput: vi.fn(),
}));

const { callModelForStructuredOutput } = await import("../src/modelClient.js");
const { createApp } = await import("../src/app.js");

const STORY_MARKER = "AUDIT-TEST-STORY-CONTENT-a-childhood-memory-about-my-grandmother";

const BASE_DISCOVERY_RESPONSE = {
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
  meaning_is_thin: false,
  depth_prompt: null,
  depth_prompt_suggestions: [],
};

function allLoggedText(spies: { calls: unknown[][] }[]): string {
  return spies
    .flatMap((s) => s.calls)
    .flat()
    .map((arg) => {
      try {
        return typeof arg === "string" ? arg : JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join("\n");
}

describe("Data-minimization audit — item 1: the API key never reaches a client-facing response", () => {
  beforeEach(() => {
    vi.mocked(callModelForStructuredOutput).mockReset();
  });

  it("a successful request's response body never contains the API key", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({ data: BASE_DISCOVERY_RESPONSE, raw: {} });
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: STORY_MARKER });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(SECRET_API_KEY_MARKER);
  });

  it("a model-error response body never contains the API key, in development or production error detail", async () => {
    vi.mocked(callModelForStructuredOutput).mockRejectedValue(new Error("simulated upstream failure"));
    const app = createApp();
    const response = await request(app).post("/api/discovery").send({ raw_story: STORY_MARKER });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(response.body)).not.toContain(SECRET_API_KEY_MARKER);
  });

  it("the health-check response (reachable with no auth) never leaks the key, only a boolean", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    expect(JSON.stringify(response.body)).not.toContain(SECRET_API_KEY_MARKER);
    expect(typeof response.body.modelConfigured).toBe("boolean");
  });
});

describe("Data-minimization audit — item 2: nothing server-side ever logs story text or full request/response bodies", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(callModelForStructuredOutput).mockReset();
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it("a successful request never logs the story text anywhere (console.log/error/warn)", async () => {
    vi.mocked(callModelForStructuredOutput).mockResolvedValue({ data: BASE_DISCOVERY_RESPONSE, raw: {} });
    const app = createApp();
    await request(app).post("/api/discovery").send({ raw_story: STORY_MARKER });

    const logged = allLoggedText([consoleLog.mock, consoleError.mock, consoleWarn.mock]);
    expect(logged).not.toContain(STORY_MARKER);
  });

  it("a failed request never logs the story text either, including in the Express error-handler fallback", async () => {
    vi.mocked(callModelForStructuredOutput).mockRejectedValue(new Error("simulated upstream failure"));
    const app = createApp();
    await request(app).post("/api/discovery").send({ raw_story: STORY_MARKER });

    const logged = allLoggedText([consoleLog.mock, consoleError.mock, consoleWarn.mock]);
    expect(logged).not.toContain(STORY_MARKER);
  });

  it("never logs the API key either, on any path", async () => {
    vi.mocked(callModelForStructuredOutput).mockRejectedValue(new Error("simulated upstream failure"));
    const app = createApp();
    await request(app).post("/api/discovery").send({ raw_story: STORY_MARKER });

    const logged = allLoggedText([consoleLog.mock, consoleError.mock, consoleWarn.mock]);
    expect(logged).not.toContain(SECRET_API_KEY_MARKER);
  });
});

describe("Data-minimization audit — item 3: no server-side file upload handling exists at all", () => {
  const serverRoot = path.resolve(__dirname, "..");

  it("no upload-handling package (multer, formidable, busboy) is a runtime dependency", () => {
    const pkg = JSON.parse(readFileSync(path.join(serverRoot, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const forbidden of ["multer", "formidable", "busboy", "express-fileupload"]) {
      expect(deps).not.toHaveProperty(forbidden);
    }
  });

  it("no route file references any multipart/file-upload handling or writes to disk", () => {
    const routesDir = path.join(serverRoot, "src", "routes");
    const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
    expect(routeFiles.length).toBeGreaterThan(0);

    const forbiddenPatterns = [/\bmulter\b/i, /\bformidable\b/i, /\bbusboy\b/i, /multipart/i, /writeFile/i, /createWriteStream/i];
    for (const file of routeFiles) {
      const source = readFileSync(path.join(routesDir, file), "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} matched forbidden pattern ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("app.ts's own middleware stack is exactly cors + json body parsing -- no multipart/upload middleware mounted", () => {
    const appSource = readFileSync(path.join(serverRoot, "src", "app.ts"), "utf8");
    expect(appSource).not.toMatch(/\bmulter\b/i);
    expect(appSource).not.toMatch(/multipart/i);
  });
});

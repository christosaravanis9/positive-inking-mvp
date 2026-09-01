import { describe, it, expect, vi } from "vitest";

process.env.ANTHROPIC_API_KEY = "test-key";

function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe("sendModelErrorResponse", () => {
  it("attaches model_timeout detail (stage/elapsedMs/budgetMs) in development", async () => {
    delete process.env.NODE_ENV;
    vi.resetModules();
    const { ModelError } = await import("../src/errors.js");
    const { sendModelErrorResponse } = await import("../src/errors.js");

    const res = fakeRes();
    const err = new ModelError("model_timeout", "Model request timed out after 30000ms.", {
      stage: "association",
      elapsedMs: 30001,
      budgetMs: 30000,
    });

    sendModelErrorResponse(res as never, err);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: "model_timeout", detail: { stage: "association", elapsedMs: 30001, budgetMs: 30000 } },
    });
  });

  it("never attaches detail in production, even for a model_timeout", async () => {
    process.env.NODE_ENV = "production";
    vi.resetModules();
    const { ModelError } = await import("../src/errors.js");
    const { sendModelErrorResponse } = await import("../src/errors.js");

    const res = fakeRes();
    const err = new ModelError("model_timeout", "Model request timed out after 30000ms.", {
      stage: "association",
      elapsedMs: 30001,
      budgetMs: 30000,
    });

    sendModelErrorResponse(res as never, err);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: { code: "model_timeout", message: "Model request timed out after 30000ms." } });

    delete process.env.NODE_ENV;
    vi.resetModules();
  });

  it("never attaches detail for a non-timeout error, even in development", async () => {
    delete process.env.NODE_ENV;
    vi.resetModules();
    const { ModelError } = await import("../src/errors.js");
    const { sendModelErrorResponse } = await import("../src/errors.js");

    const res = fakeRes();
    const err = new ModelError("model_invalid_response", "Model response failed schema validation.", { some: "detail" });

    sendModelErrorResponse(res as never, err);

    expect(res.body).toEqual({ error: { code: "model_invalid_response", message: "Model response failed schema validation." } });
  });

  it("model_not_configured maps to 503, everything else to 502", async () => {
    vi.resetModules();
    const { ModelError } = await import("../src/errors.js");
    const { sendModelErrorResponse } = await import("../src/errors.js");

    const notConfiguredRes = fakeRes();
    sendModelErrorResponse(notConfiguredRes as never, new ModelError("model_not_configured", "no key"));
    expect(notConfiguredRes.statusCode).toBe(503);

    const networkRes = fakeRes();
    sendModelErrorResponse(networkRes as never, new ModelError("model_network_error", "boom"));
    expect(networkRes.statusCode).toBe(502);
  });

  it("wraps a non-ModelError as model_network_error", async () => {
    vi.resetModules();
    const { sendModelErrorResponse } = await import("../src/errors.js");

    const res = fakeRes();
    sendModelErrorResponse(res as never, new Error("plain failure"));

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: { code: "model_network_error", message: "plain failure" } });
  });
});

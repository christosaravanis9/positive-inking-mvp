import { describe, it, expect, vi, beforeEach } from "vitest";

// env.ts reads ANTHROPIC_API_KEY at import time via dotenv/config; set it
// before importing anything that depends on env.ts so isModelConfigured()
// is true for these tests.
process.env.ANTHROPIC_API_KEY = "test-key";

const { callModelForStructuredOutput } = await import("../src/modelClient.js");

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const tool = {
  name: "record_thing",
  description: "test tool",
  input_schema: { type: "object", properties: {} },
};

describe("callModelForStructuredOutput", () => {
  it("parses a successful tool_use response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: "tool_use", name: "record_thing", input: { hello: "world" } }],
      }),
    );

    const result = await callModelForStructuredOutput(
      { system: "sys", userMessage: "msg", tool },
      fetchImpl as never,
    );

    expect(result.data).toEqual({ hello: "world" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws model_invalid_response when no matching tool_use block is present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "oops" }] }));

    await expect(
      callModelForStructuredOutput({ system: "sys", userMessage: "msg", tool }, fetchImpl as never),
    ).rejects.toMatchObject({ code: "model_invalid_response" });
  });

  it("retries once silently on HTTP 500, then throws a visible error if it happens again", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "server exploded" }, false, 500));

    await expect(
      callModelForStructuredOutput({ system: "sys", userMessage: "msg", tool }, fetchImpl as never),
    ).rejects.toMatchObject({ code: "model_http_error" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("recovers on the silent retry if the second attempt succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "flaky" }, false, 503))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: "tool_use", name: "record_thing", input: { ok: true } }] }),
      );

    const result = await callModelForStructuredOutput(
      { system: "sys", userMessage: "msg", tool },
      fetchImpl as never,
    );

    expect(result.data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("times out and surfaces a model_timeout error rather than hanging", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    await expect(
      callModelForStructuredOutput(
        { system: "sys", userMessage: "msg", tool, timeoutMs: 10 },
        fetchImpl as never,
      ),
    ).rejects.toMatchObject({ code: "model_timeout" });
  }, 2000);

  it("bounds the TOTAL wall-clock time across both attempts to timeoutMs, not 2x timeoutMs -- the exact mismatch that let the client time out while the server was still legitimately retrying", async () => {
    // Every attempt hangs until aborted -- if the retry got its own fresh
    // full timeout (the pre-fix bug), total elapsed would be ~2x timeoutMs.
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const start = Date.now();
    await expect(
      callModelForStructuredOutput({ system: "sys", userMessage: "msg", tool, timeoutMs: 60 }, fetchImpl as never),
    ).rejects.toMatchObject({ code: "model_timeout" });
    const elapsed = Date.now() - start;

    // Generous margin for CI jitter, but this must stay well under 2x timeoutMs (120ms).
    expect(elapsed).toBeLessThan(100);
  }, 2000);

  it("does not attempt a retry once the total budget is already exhausted", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    await expect(
      callModelForStructuredOutput({ system: "sys", userMessage: "msg", tool, timeoutMs: 30 }, fetchImpl as never),
    ).rejects.toMatchObject({ code: "model_timeout" });

    // A single attempt consumes the entire 30ms budget, so there is nothing left for a second.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  }, 2000);

  it("throws model_not_configured immediately (no network call) when the key is missing", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    vi.resetModules();
    const { callModelForStructuredOutput: callWithoutKey } = await import("../src/modelClient.js");
    const fetchImpl = vi.fn();

    await expect(
      callWithoutKey({ system: "sys", userMessage: "msg", tool }, fetchImpl as never),
    ).rejects.toMatchObject({ code: "model_not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();

    process.env.ANTHROPIC_API_KEY = original;
    vi.resetModules();
  });
});

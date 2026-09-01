import { describe, it, expect, vi } from "vitest";
import { logModelTiming } from "../src/modelTiming.js";

describe("logModelTiming", () => {
  it("formats a successful call with token counts and derived throughput", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logModelTiming({
      stage: "association",
      attempt: 1,
      elapsedMs: 4000,
      budgetMs: 30000,
      outcome: "success",
      inputTokens: 500,
      outputTokens: 2000,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]![0] as string;
    expect(line).toContain("[model-timing]");
    expect(line).toContain("stage=association");
    expect(line).toContain("attempt=1");
    expect(line).toContain("outcome=success");
    expect(line).toContain("elapsed_ms=4000");
    expect(line).toContain("budget_ms=30000");
    expect(line).toContain("input_tokens=500");
    expect(line).toContain("output_tokens=2000");
    // 2000 tokens / 4000ms = 500 tokens/sec.
    expect(line).toContain("output_tokens_per_sec=500.0");

    spy.mockRestore();
  });

  it("formats a timeout with no token fields, since none were ever returned", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logModelTiming({ stage: "association", attempt: 1, elapsedMs: 30000, budgetMs: 30000, outcome: "model_timeout" });

    const line = spy.mock.calls[0]![0] as string;
    expect(line).toContain("outcome=model_timeout");
    expect(line).not.toContain("input_tokens=");
    expect(line).not.toContain("output_tokens=");
    expect(line).not.toContain("output_tokens_per_sec=");

    spy.mockRestore();
  });

  it("includes http_status only for an http_error outcome", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logModelTiming({ stage: "blueprint", attempt: 2, elapsedMs: 800, budgetMs: 30000, outcome: "model_http_error", httpStatus: 503 });

    const line = spy.mock.calls[0]![0] as string;
    expect(line).toContain("http_status=503");
    expect(line).toContain("attempt=2");

    spy.mockRestore();
  });
});

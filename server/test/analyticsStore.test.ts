import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Storage-backend branching for anonymous analytics: Supabase when
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are both set (intended for
 * production/Render, whose free tier has an ephemeral filesystem), the
 * original local-file JSONL store otherwise (local dev). Mocks both
 * @supabase/supabase-js and node:fs/promises so no real network call or
 * disk write ever happens here -- these tests prove which branch was taken
 * and with what data, not the real Supabase/filesystem behavior itself.
 */

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const appendFileMock = vi.fn().mockResolvedValue(undefined);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  appendFile: (...args: unknown[]) => appendFileMock(...args),
  mkdir: (...args: unknown[]) => mkdirMock(...args),
}));

const ORIGINAL_URL = process.env.SUPABASE_URL;
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockClear();
  createClientMock.mockClear();
  appendFileMock.mockClear();
  mkdirMock.mockClear();
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
});

describe("analyticsStore -- Supabase vs. local-file storage branch", () => {
  it("writes to Supabase when both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    vi.resetModules();
    const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");

    const event = {
      event: "screen_reached",
      session_id: "11111111-1111-4111-8111-111111111111",
      screen: "story",
      from_screen: null,
      elapsed_ms_on_previous_screen: null,
      journey_mode: "full",
      received_at: "2026-01-01T00:00:00.000Z",
    };
    await appendAnalyticsEvent(event);

    expect(createClientMock).toHaveBeenCalledWith("https://example.supabase.co", "service-role-secret", expect.any(Object));
    expect(fromMock).toHaveBeenCalledWith("analytics_events");
    expect(insertMock).toHaveBeenCalledWith(event);
    expect(appendFileMock).not.toHaveBeenCalled();
  });

  it("falls back to the local-file store when neither Supabase env var is set", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");

    const event = {
      event: "journey_completed",
      session_id: "11111111-1111-4111-8111-111111111111",
      elapsed_ms: 1000,
      journey_mode: "full",
      received_at: "2026-01-01T00:00:00.000Z",
    };
    await appendAnalyticsEvent(event);

    expect(appendFileMock).toHaveBeenCalledTimes(1);
    expect(appendFileMock.mock.calls[0]?.[1]).toContain(JSON.stringify(event));
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("falls back to the local file when only one of the two Supabase env vars is set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");

    await appendAnalyticsEvent({ event: "journey_completed", session_id: "x", elapsed_ms: 1, journey_mode: "full" });

    expect(appendFileMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("propagates a Supabase insert error so the route's existing fire-and-forget error handling still applies", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    insertMock.mockResolvedValue({ error: { message: "insert failed" } });
    vi.resetModules();
    const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");

    await expect(
      appendAnalyticsEvent({ event: "journey_completed", session_id: "x", elapsed_ms: 1, journey_mode: "full" }),
    ).rejects.toThrow("insert failed");
    expect(appendFileMock).not.toHaveBeenCalled();
  });

  it("reuses the same Supabase client across multiple calls rather than reconnecting each time", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    vi.resetModules();
    const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");

    await appendAnalyticsEvent({ event: "journey_completed", session_id: "x", elapsed_ms: 1, journey_mode: "full" });
    await appendAnalyticsEvent({ event: "journey_completed", session_id: "y", elapsed_ms: 2, journey_mode: "full" });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Anonymous usage analytics -- same discipline as the data-minimization
 * audit's own tests: prove the property against real calls, not just the
 * type signatures. reportScreenReached/reportJourneyCompleted only ever
 * accept a ScreenId, a JourneyMode, and numbers -- there is structurally no
 * parameter through which story/image content could be passed in the first
 * place, and these tests confirm the actual request body sent matches that:
 * exactly the expected field set, nothing else, ever.
 */

describe("analytics", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reportScreenReached POSTs to the same-origin analytics endpoint with exactly the expected fields, nothing else", async () => {
    const { reportScreenReached } = await import("./analytics");
    reportScreenReached("story", "viewpoint", 4200, "full");
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analytics/event");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      event: "screen_reached",
      session_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      screen: "story",
      from_screen: "viewpoint",
      elapsed_ms_on_previous_screen: 4200,
      journey_mode: "full",
    });
  });

  it("reportJourneyCompleted POSTs exactly the expected fields, nothing else", async () => {
    const { reportJourneyCompleted } = await import("./analytics");
    reportJourneyCompleted("attraction", 300000);
    await Promise.resolve();

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      event: "journey_completed",
      session_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      elapsed_ms: 300000,
      journey_mode: "attraction",
    });
  });

  it("uses the same session id across multiple calls within one page load -- generated once, not per event", async () => {
    const { reportScreenReached, reportJourneyCompleted } = await import("./analytics");
    reportScreenReached("story", null, null, "full");
    reportScreenReached("meaning_reflection", "story", 1000, "full");
    reportJourneyCompleted("full", 50000);
    await Promise.resolve();

    const sessionIds = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).session_id);
    expect(new Set(sessionIds).size).toBe(1);
  });

  it("never throws when the request fails -- fire-and-forget, instrumentation can never break the journey", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { reportScreenReached } = await import("./analytics");

    expect(() => reportScreenReached("welcome", null, null, "full")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The rejection was swallowed -- nothing to assert beyond "still here, no unhandled rejection".
  });

  it("passes elapsed_ms_on_previous_screen and from_screen through as null on the very first screen of a session", async () => {
    const { reportScreenReached } = await import("./analytics");
    reportScreenReached("welcome", null, null, "full");
    await Promise.resolve();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from_screen).toBeNull();
    expect(body.elapsed_ms_on_previous_screen).toBeNull();
  });
});

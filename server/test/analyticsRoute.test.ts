import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { SCREEN_IDS } from "@positive-inking/engine";

process.env.ANTHROPIC_API_KEY = "test-key";

/**
 * Anonymous usage analytics -- same discipline as the data-minimization
 * audit's API-key test: prove the property directly against a real request/
 * response cycle, not just describe it. The schema (server/src/routes/
 * analytics.ts) has no free-text field at all, so the real guarantee under
 * test is that nothing -- not a legitimate field, not an extra one a buggy
 * or malicious client might attach -- can carry story/image content through
 * to the store.
 */

vi.mock("../src/analyticsStore.js", () => ({
  appendAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

const { appendAnalyticsEvent } = await import("../src/analyticsStore.js");
const { createApp } = await import("../src/app.js");

const STORY_MARKER = "AUDIT-TEST-STORY-a-childhood-memory-about-my-grandmother";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(appendAnalyticsEvent).mockClear();
});

describe("POST /api/analytics/event", () => {
  it("accepts a well-formed screen_reached event and persists exactly the validated fields, nothing else", async () => {
    const app = createApp();
    const response = await request(app).post("/api/analytics/event").send({
      event: "screen_reached",
      session_id: SESSION_ID,
      screen: "story",
      from_screen: "viewpoint",
      elapsed_ms_on_previous_screen: 4200,
      journey_mode: "full",
    });

    expect(response.status).toBe(202);
    expect(appendAnalyticsEvent).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(appendAnalyticsEvent).mock.calls[0][0];
    expect(persisted).toMatchObject({
      event: "screen_reached",
      session_id: SESSION_ID,
      screen: "story",
      from_screen: "viewpoint",
      elapsed_ms_on_previous_screen: 4200,
      journey_mode: "full",
    });
    // Only the schema's own fields plus the server-added timestamp -- nothing more.
    expect(Object.keys(persisted as object).sort()).toEqual(
      ["event", "session_id", "screen", "from_screen", "elapsed_ms_on_previous_screen", "journey_mode", "received_at"].sort(),
    );
  });

  it("accepts a well-formed journey_completed event", async () => {
    const app = createApp();
    const response = await request(app).post("/api/analytics/event").send({
      event: "journey_completed",
      session_id: SESSION_ID,
      elapsed_ms: 300000,
      journey_mode: "attraction",
    });

    expect(response.status).toBe(202);
    expect(appendAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it("strips an unexpected extra field entirely -- a marker planted in a bogus 'raw_story' field never reaches the store", async () => {
    const app = createApp();
    await request(app)
      .post("/api/analytics/event")
      .send({
        event: "screen_reached",
        session_id: SESSION_ID,
        screen: "story",
        from_screen: null,
        elapsed_ms_on_previous_screen: null,
        journey_mode: "full",
        raw_story: STORY_MARKER,
        notes: STORY_MARKER,
      });

    expect(appendAnalyticsEvent).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(appendAnalyticsEvent).mock.calls[0][0];
    expect(JSON.stringify(persisted)).not.toContain(STORY_MARKER);
    expect(persisted).not.toHaveProperty("raw_story");
    expect(persisted).not.toHaveProperty("notes");
  });

  it("rejects free text smuggled into the screen field itself -- the enum check itself blocks it, nothing is ever persisted", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/analytics/event")
      .send({
        event: "screen_reached",
        session_id: SESSION_ID,
        screen: STORY_MARKER,
        from_screen: null,
        elapsed_ms_on_previous_screen: null,
        journey_mode: "full",
      });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain(STORY_MARKER);
    expect(appendAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown event name entirely", async () => {
    const app = createApp();
    const response = await request(app).post("/api/analytics/event").send({
      event: "user_typed_their_story",
      session_id: SESSION_ID,
      content: STORY_MARKER,
    });

    expect(response.status).toBe(400);
    expect(appendAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing/malformed session_id", async () => {
    const app = createApp();
    const response = await request(app).post("/api/analytics/event").send({
      event: "journey_completed",
      session_id: "not-a-uuid",
      elapsed_ms: 1000,
      journey_mode: "full",
    });

    expect(response.status).toBe(400);
    expect(appendAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("rejects an absurdly large elapsed_ms (bounded to 24h) -- no unbounded numeric field either", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/analytics/event")
      .send({
        event: "journey_completed",
        session_id: SESSION_ID,
        elapsed_ms: 999_999_999_999,
        journey_mode: "full",
      });

    expect(response.status).toBe(400);
    expect(appendAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("accepts every real screen id (SCREEN_IDS) as a valid `screen` value -- the enum stays in sync with the engine's real screen list", async () => {
    const app = createApp();
    for (const screen of SCREEN_IDS) {
      const response = await request(app).post("/api/analytics/event").send({
        event: "screen_reached",
        session_id: SESSION_ID,
        screen,
        from_screen: null,
        elapsed_ms_on_previous_screen: null,
        journey_mode: "full",
      });
      expect(response.status, `screen "${screen}" should be accepted`).toBe(202);
    }
  });
});

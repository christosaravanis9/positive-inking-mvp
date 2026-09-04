import { Router } from "express";
import { z } from "zod";
import { SCREEN_IDS } from "@positive-inking/engine";
import { appendAnalyticsEvent } from "../analyticsStore.js";

/**
 * Anonymous usage analytics (privacy notice's own "Anonymous usage
 * analytics" section: "how many people complete the journey, which steps
 * take longest, and where people tend to stop"). Deliberately the smallest
 * possible schema for that goal -- every field is an enum or a bounded
 * number, NEVER a free-text field, so there is structurally no way for
 * story text, image data, or any other identifying content to pass
 * validation here, let alone reach the store. This is enforced by
 * server/test/analyticsRoute.test.ts, not just this comment.
 *
 * session_id is a client-generated random id, held only in memory for the
 * current page load (web/src/instrumentation/analytics.ts never persists
 * it) -- it exists purely to let "which steps take longest" be computed
 * for one continuous attempt, and is explicitly NOT a durable identifier:
 * a page reload starts a new one, so events can't be stitched across a
 * reload or across visits. This is a deliberate privacy-over-completeness
 * tradeoff, not an oversight.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const journeyModeSchema = z.enum(["full", "attraction", "expert", "manual"]);
const boundedElapsedMs = z.number().int().nonnegative().max(ONE_DAY_MS);

const eventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("screen_reached"),
    session_id: z.string().uuid(),
    screen: z.enum(SCREEN_IDS),
    from_screen: z.enum(SCREEN_IDS).nullable(),
    elapsed_ms_on_previous_screen: boundedElapsedMs.nullable(),
    journey_mode: journeyModeSchema,
  }),
  z.object({
    event: z.literal("journey_completed"),
    session_id: z.string().uuid(),
    elapsed_ms: boundedElapsedMs,
    journey_mode: journeyModeSchema,
  }),
]);

export const analyticsRouter = Router();

analyticsRouter.post("/api/analytics/event", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    // Deliberately a static message, not parsed.error.message (unlike the other routes'
    // sendModelErrorResponse pattern) -- zod's own validation error echoes back whatever
    // was actually submitted for an invalid enum value (e.g. "received": "<the bad
    // value>"), which would defeat the entire point of this endpoint if a caller ever
    // put story-like text where a screen id belongs. Nothing about a bad request here
    // needs field-level detail surfaced to the caller.
    res.status(400).json({ error: { code: "bad_request", message: "Invalid analytics event payload." } });
    return;
  }

  try {
    await appendAnalyticsEvent({ ...parsed.data, received_at: new Date().toISOString() });
    res.status(202).json({ ok: true });
  } catch {
    // Analytics must never surface as a user-facing failure -- the client
    // already treats this as fire-and-forget and never shows an error for
    // it either way, but still report a real status for anyone actually
    // watching server-side (e.g. disk full).
    res.status(202).json({ ok: false });
  }
});

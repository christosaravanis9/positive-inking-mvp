import { Router } from "express";
import { z } from "zod";
import { SCREEN_IDS, DEVICE_CATALOG } from "@positive-inking/engine";
import { appendAnalyticsEvent } from "../analyticsStore.js";
import { maybeReviewDeviceRoster } from "../deviceRosterStore.js";

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

// 2026-09-09: the "6 artists" device-rotation system (docs/PROJECT_STATUS.md
// session log has the full design). device_id is validated against the REAL
// catalog, not an open string, for the same reason every other field here is
// an enum -- structurally impossible to smuggle free text through it.
const deviceIdValues = DEVICE_CATALOG.map((d) => d.id) as [string, ...string[]];
const deviceIdSchema = z.enum(deviceIdValues);

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
  /**
   * Fired once per candidate actually rendered into a visible slot on
   * Screen 7 (not merely generated into the reserve pool and never shown)
   * -- the "impression" denominator every device's score is normalised
   * against. No story or candidate content -- only which device produced
   * the candidate the client saw.
   */
  z.object({
    event: z.literal("device_impression"),
    session_id: z.string().uuid(),
    device_id: deviceIdSchema,
  }),
  /**
   * Fired on Keep / Build upon / Not this one. had_refinement_input
   * captures WHETHER the client typed something (a build-upon edit, a "why
   * not" reason, or a follow-up-detail answer) as a training signal, per
   * the client's own explicit request that refinement engagement count --
   * deliberately never the text itself, which stays exactly as
   * privacy-protected as every other field in this schema.
   */
  z.object({
    event: z.literal("device_outcome"),
    session_id: z.string().uuid(),
    device_id: deviceIdSchema,
    decision: z.enum(["keep", "build_upon", "not_this_one"]),
    had_refinement_input: z.boolean(),
  }),
  /**
   * 2026-09-11: fired once per screen per session, the first time voice
   * dictation actually produces real transcribed text on that screen (not
   * merely tapped/attempted -- see web/src/components/VoiceInput.tsx, fired
   * from the first non-empty final transcript, so a tap that got denied
   * mic access or heard nothing never counts). Exists to let completion
   * rate be compared between sessions that used voice input and those that
   * didn't -- joined against screen_reached/journey_completed via
   * session_id, same as every other event here. No transcript content,
   * only which screen it happened on.
   */
  z.object({
    event: z.literal("voice_input_used"),
    session_id: z.string().uuid(),
    screen: z.enum(SCREEN_IDS),
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
    // 2026-09-09: fire-and-forget, deliberately AFTER responding -- the
    // client should never wait on a roster review to know its event was
    // recorded. Only ever does real work on a device_outcome event (the
    // only event type that advances the review counter); every other
    // event type is a fast no-op inside this function. See
    // deviceRosterStore.ts for the full threshold/aggregation/review
    // cycle -- errors here are caught and logged there, never thrown back
    // into this request.
    if (parsed.data.event === "device_outcome") void maybeReviewDeviceRoster();
  } catch {
    // Analytics must never surface as a user-facing failure -- the client
    // already treats this as fire-and-forget and never shows an error for
    // it either way, but still report a real status for anyone actually
    // watching server-side (e.g. disk full).
    res.status(202).json({ ok: false });
  }
});

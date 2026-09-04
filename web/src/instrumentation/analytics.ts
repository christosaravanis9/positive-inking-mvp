import type { JourneyMode, ScreenId } from "@positive-inking/engine";

/**
 * Anonymous usage analytics (privacy notice's "Anonymous usage analytics"
 * section). Distinct from telemetry.ts, which stays exactly what it always
 * was -- a detailed, per-project, local-only debugging log that never
 * leaves this browser. This module is the opposite shape on purpose: only
 * the two coarse, non-identifying signals the privacy notice actually
 * promises ("how many people complete the journey, which steps take
 * longest, and where people tend to stop"), sent to this app's own
 * same-origin server so they can be reviewed in aggregate across users --
 * something a browser-only log structurally cannot do.
 *
 * `sessionId` is generated once per page load and held only in this
 * module's memory -- never localStorage, never derived from
 * project.project_id (which does persist and is never sent here). A
 * reload starts a new one. This is what "a random non-persistent ID"
 * means in practice: it lets step-timing be computed for one continuous
 * attempt, but a person's events can never be linked across a reload or
 * across visits.
 *
 * Fire-and-forget by design, matching telemetry.ts's own "instrumentation
 * is never allowed to break the journey" rule -- a failed request here
 * must never throw, retry, or show the user anything.
 */

const sessionId = crypto.randomUUID();

function send(body: Record<string, unknown>): void {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface as a user-facing failure.
  });
}

export function reportScreenReached(screen: ScreenId, fromScreen: ScreenId | null, elapsedMsOnPreviousScreen: number | null, journeyMode: JourneyMode): void {
  send({
    event: "screen_reached",
    session_id: sessionId,
    screen,
    from_screen: fromScreen,
    elapsed_ms_on_previous_screen: elapsedMsOnPreviousScreen,
    journey_mode: journeyMode,
  });
}

export function reportJourneyCompleted(journeyMode: JourneyMode, elapsedMs: number): void {
  send({
    event: "journey_completed",
    session_id: sessionId,
    elapsed_ms: elapsedMs,
    journey_mode: journeyMode,
  });
}

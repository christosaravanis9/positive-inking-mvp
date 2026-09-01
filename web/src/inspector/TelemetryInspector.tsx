import { useState } from "react";
import { getTelemetryEvents, clearTelemetryEvents } from "../instrumentation/telemetry";
import { isPersonalSourceCategory } from "@positive-inking/engine";

/**
 * Dev-only view onto the local, first-party event log (§22). Purely a
 * display -- nothing here feeds back into routing or engine decisions, and
 * this panel reads the same log a future analytics backend would read, so
 * it doubles as a check that the event shape stays analytics-ready.
 * Not rendered in production builds (see App.tsx).
 */
export function TelemetryInspector() {
  const [, forceRerender] = useState(0);
  const events = getTelemetryEvents();

  const journeysStarted = events.filter((e) => e.name === "journey_started").length;
  const journeysCompleted = events.filter((e) => e.name === "journey_completed").length;
  const clarificationsShown = events.filter((e) => e.name === "clarification_shown").length;
  const meaningEdits = events.filter((e) => e.name === "meaning_edit").length;
  const personalSelections = events.filter(
    (e) => e.name === "visual_candidate_selected" && isPersonalSourceCategory(String(e.metadata.source_category ?? "")),
  ).length;
  const genericSelections = events.filter((e) => e.name === "visual_candidate_selected").length - personalSelections;
  const userAuthoredIdeas = events.filter((e) => e.name === "user_authored_idea_added").length;
  const backgroundConfirmations = events.filter((e) => e.name === "composition_background_confirmed");
  const noBackgroundCount = backgroundConfirmations.filter((e) => e.metadata.background === "none").length;
  const referenceRequests = events.filter((e) => e.name === "reference_requested").length;
  const blueprintSaves = events.filter((e) => e.name === "blueprint_saved" || e.name === "blueprint_copied").length;

  return (
    <details className="inspector">
      <summary>Telemetry (dev only)</summary>
      <p className="supporting">
        Local-only, first-party event log (§22). Nothing here is read by the app itself -- it exists to verify
        instrumentation is capturing what §22 asks for, and to preview what a future analytics backend would receive.
      </p>
      <dl className="summary-list">
        <dt>Journeys started / completed</dt>
        <dd>
          {journeysStarted} / {journeysCompleted}
        </dd>
        <dt>Clarification shown</dt>
        <dd>{clarificationsShown}</dd>
        <dt>Meaning edits</dt>
        <dd>{meaningEdits}</dd>
        <dt>Personal vs. generic selections</dt>
        <dd>
          {personalSelections} / {genericSelections}
        </dd>
        <dt>User-authored ideas</dt>
        <dd>{userAuthoredIdeas}</dd>
        <dt>No-background rate</dt>
        <dd>
          {noBackgroundCount} / {backgroundConfirmations.length}
        </dd>
        <dt>Reference requests</dt>
        <dd>{referenceRequests}</dd>
        <dt>Blueprint saves/copies</dt>
        <dd>{blueprintSaves}</dd>
      </dl>
      <p className="supporting">Last {Math.min(events.length, 10)} events (of {events.length} stored):</p>
      <ul style={{ fontSize: "0.85em" }}>
        {events
          .slice(-10)
          .reverse()
          .map((e, i) => (
            <li key={i}>
              {e.at} — {e.name} {Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : ""}
            </li>
          ))}
      </ul>
      <button
        className="secondary"
        onClick={() => {
          clearTelemetryEvents();
          forceRerender((n) => n + 1);
        }}
      >
        Clear local telemetry log
      </button>
    </details>
  );
}

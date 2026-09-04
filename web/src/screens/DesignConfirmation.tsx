import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestBlueprint } from "../api/blueprint";
import { AsyncError } from "../components/AsyncError";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import { formatPlacementSummary } from "../journey/placementSummary";
import { labelForDimensionValue } from "../journey/artisticDimensionLabels";
import { describeCreativeControl } from "../journey/creativeControlLabels";
import { buildConfirmedProjectSummary } from "../journey/blueprintSummary";
import { buildReadinessComponentInputs, readinessComponentDetail } from "../journey/readinessComponentLabels";
import { logTelemetryEvent, elapsedSinceJourneyStarted } from "../instrumentation/telemetry";
import { reportJourneyCompleted } from "../instrumentation/analytics";
import { buildReferenceChecklist, isReferenceEntrySatisfied, anyRequiredReferenceMissing, hasUnresolvedPrimaryImagery, describeReadinessComponents } from "@positive-inking/engine";

/** Screen 13 (§8). The complete summary stays on screen next to the action -- no detached verification (§6, AC 64). "Still needed: [references]" is the spec's own Screen 13 bullet (§8). */
export function DesignConfirmation() {
  const { state, patchUI } = useJourney();
  const { run, pending } = useAsyncAction();
  const { project } = state;
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const outstanding = checklist.filter((entry) => !isReferenceEntrySatisfied(entry));
  const placementSummary = formatPlacementSummary(project);
  // "Open decisions" (below) is specifically the Visual direction component
  // of the Blueprint's own five-component Readiness section (Sites migration
  // spec §12/§4.2) -- built from the exact same describeReadinessComponents
  // call, with readiness: null since no Blueprint exists yet here, so the
  // two screens can never drift into different readiness models or
  // different wording for the same status. ("Still needed" above is a
  // separate, pre-existing §8 bullet, not one of the five components.)
  const visualDirectionComponent = describeReadinessComponents(buildReadinessComponentInputs(project, null)).find((c) => c.id === "visual_direction")!;

  function build() {
    void run(async (guard) => {
      const summary = buildConfirmedProjectSummary(project, outstanding);

      const blueprint = await requestBlueprint({
        journey_mode: project.journey_mode,
        significance_claimed: project.significance_claimed,
        themes_surfaced: project.confirmed_themes.length > 0,
        statement_user_authored: false,
        interpretation_confidence: project.interpretation_confidence,
        any_required_reference_missing: anyRequiredReferenceMissing(checklist),
        has_unresolved_contradiction: project.contradictions.length > 0 || hasUnresolvedPrimaryImagery(project.visual_elements),
        confirmed_project_summary: summary,
      });
      if (guard.isStale()) return;

      patchUI({ blueprint, blueprintReady: true, designConfirmed: true });
      // §22: completion-rate numerator + time-by-mode (local-only, per-project debugging log).
      const elapsedMs = elapsedSinceJourneyStarted(project.project_id);
      logTelemetryEvent("journey_completed", project.project_id, { journey_mode: project.journey_mode, elapsed_ms: elapsedMs });
      // Anonymous usage analytics (privacy notice) -- the same already-computed, non-identifying
      // elapsed_ms value, sent server-side so completion rate can be reviewed in aggregate.
      if (elapsedMs !== null) reportJourneyCompleted(project.journey_mode, elapsedMs);
    }, "Building your Blueprint");
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Complete direction</p>
      <h2 className="screen-heading">Ready to build your Blueprint</h2>
      <p className="supporting">Everything being confirmed remains visible here. Continue or go back to change it.</p>
      <dl className="summary-list">
        <dt>Main subject</dt>
        <dd>{project.visual_elements.find((e) => e.hierarchy === "primary")?.description ?? project.visual_elements[0]?.description ?? "—"}</dd>
        <dt>Supporting details</dt>
        <dd>{project.visual_elements.slice(1).map((e) => e.description).join(", ") || "—"}</dd>
        <dt>Composition</dt>
        <dd>
          {project.composition_type || "—"}
          {project.composition_background === "none" && " (no background)"}
        </dd>
        <dt>Treatment</dt>
        <dd>
          {[
            project.colour_strategy && labelForDimensionValue("colour", project.colour_strategy),
            project.realism_level && labelForDimensionValue("realism", project.realism_level),
            project.visual_presence && labelForDimensionValue("visual_presence", project.visual_presence),
          ]
            .filter(Boolean)
            .join(", ") || "—"}
        </dd>
        <dt>Placement</dt>
        <dd>{placementSummary || "—"}</dd>
        <dt>Creative control</dt>
        <dd>{project.creative_control ? describeCreativeControl(project.creative_control) : "—"}</dd>
        <dt>Avoid</dt>
        <dd>{project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") || "none listed" : "not specified"}</dd>
        <dt>Still needed</dt>
        <dd>
          {outstanding.length === 0
            ? "Nothing outstanding"
            : outstanding.map((o) => `${o.description} — ${o.status.replace(/_/g, " ")}${o.requirement === "required" ? " (required)" : ""}`).join("; ")}
        </dd>
        <dt>Open decisions</dt>
        <dd>
          {visualDirectionComponent.status === "open_decisions"
            ? readinessComponentDetail(visualDirectionComponent, project).join(" ")
            : "None noted"}
        </dd>
      </dl>
      {/* §13.4: the Blueprint may be complete while exact design references remain outstanding -- this is informational, never a hard block. */}
      {outstanding.length > 0 && (
        <div className="error-banner" style={{ borderColor: "var(--border)", background: "rgba(128,128,128,0.06)", color: "var(--fg)" }}>
          Some references aren't finished yet. You can still build the Blueprint — it will note what's outstanding — or go back and add them now.
          <div style={{ marginTop: 8 }}>
            <button className="secondary" onClick={() => patchUI({ elementsDiscovered: false })}>
              Add references
            </button>
          </div>
        </div>
      )}
      <AsyncError onRetry={build} />
      {pending && <ModelWaitIndicator label="Building your Blueprint..." />}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={build} disabled={pending}>
          {pending ? "Working..." : "Build my Blueprint"}
        </button>
        <button className="secondary" onClick={() => patchUI({ placementDone: false })} disabled={pending}>
          Change something
        </button>
      </div>
    </div>
  );
}

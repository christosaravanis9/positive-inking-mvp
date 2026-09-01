import { useJourney } from "../journey/JourneyProvider";
import { requestBlueprint } from "../api/blueprint";
import { AsyncError } from "../components/AsyncError";
import { formatPlacementSummary } from "../journey/placementSummary";
import { logTelemetryEvent, elapsedSinceJourneyStarted } from "../instrumentation/telemetry";
import { buildReferenceChecklist, isReferenceEntrySatisfied, anyRequiredReferenceMissing } from "@positive-inking/engine";

/** Screen 13 (§8). The complete summary stays on screen next to the action -- no detached verification (§6, AC 64). "Still needed: [references]" is the spec's own Screen 13 bullet (§8). */
export function DesignConfirmation() {
  const { state, patchUI, setError, beginAttempt } = useJourney();
  const { project } = state;
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const outstanding = checklist.filter((entry) => !isReferenceEntrySatisfied(entry));
  const placementSummary = formatPlacementSummary(project);

  async function build() {
    beginAttempt();
    try {
      const summary = [
        `Story/why: ${project.statement_of_intention || project.attraction_origin}`,
        `Themes: ${project.confirmed_themes.join(", ") || "none confirmed"}`,
        `Elements: ${project.visual_elements.map((e) => `${e.description} (${e.hierarchy}, ${e.fidelity})`).join("; ")}`,
        `Composition: ${project.composition_type}, background: ${project.composition_background}, density: ${project.design_density}`,
        `Artistic direction: colour ${project.colour_strategy}, realism ${project.realism_level}, presence ${project.visual_presence}, linework ${project.linework_weight}, shading ${project.shading_method}, contrast ${project.contrast_level}`,
        project.fidelity_treatment ? `Fidelity treatment: ${project.fidelity_treatment}` : "",
        `Placement: ${placementSummary}`,
        `Creative control: ${project.creative_control}`,
        `Avoid: ${project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") : project.avoid_list_status}`,
        outstanding.length > 0
          ? `Still needed from the client: ${outstanding.map((o) => `${o.description} (${o.status.replace(/_/g, " ")})`).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const blueprint = await requestBlueprint({
        journey_mode: project.journey_mode,
        significance_claimed: project.significance_claimed,
        themes_surfaced: project.confirmed_themes.length > 0,
        statement_user_authored: false,
        interpretation_confidence: project.interpretation_confidence,
        any_required_reference_missing: anyRequiredReferenceMissing(checklist),
        has_unresolved_contradiction: project.contradictions.length > 0,
        confirmed_project_summary: summary,
      });

      patchUI({ blueprint, blueprintReady: true, designConfirmed: true });
      setError(null);
      // §22: completion-rate numerator + time-by-mode.
      logTelemetryEvent("journey_completed", project.project_id, {
        journey_mode: project.journey_mode,
        elapsed_ms: elapsedSinceJourneyStarted(project.project_id),
      });
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Building your Blueprint",
      });
    }
  }

  return (
    <div className="screen">
      <h2>Ready to build your Blueprint</h2>
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
          {[project.colour_strategy, project.realism_level, project.visual_presence].filter(Boolean).join(", ") || "—"}
        </dd>
        <dt>Placement</dt>
        <dd>{placementSummary || "—"}</dd>
        <dt>Creative control</dt>
        <dd>{project.creative_control || "—"}</dd>
        <dt>Avoid</dt>
        <dd>{project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") || "none listed" : "not specified"}</dd>
        <dt>Still needed</dt>
        <dd>
          {outstanding.length === 0
            ? "Nothing outstanding"
            : outstanding.map((o) => `${o.description} — ${o.status.replace(/_/g, " ")}${o.requirement === "required" ? " (required)" : ""}`).join("; ")}
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
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={build}>Build my Blueprint</button>
        <button className="secondary" onClick={() => patchUI({ placementDone: false })}>
          Change something
        </button>
      </div>
    </div>
  );
}

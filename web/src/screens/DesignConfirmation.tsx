import { useJourney } from "../journey/JourneyProvider";
import { requestBlueprint } from "../api/blueprint";
import { AsyncError } from "../components/AsyncError";

/** Screen 13 (§8). The complete summary stays on screen next to the action -- no detached verification (§6, AC 64). */
export function DesignConfirmation() {
  const { state, patchUI, setError, beginAttempt } = useJourney();
  const { project } = state;

  async function build() {
    beginAttempt();
    try {
      const anyRequiredReferenceMissing = project.visual_elements.some(
        (e) => e.fidelity === "exact" && e.reference_status !== "available",
      );
      const summary = [
        `Story/why: ${project.statement_of_intention || project.attraction_origin}`,
        `Themes: ${project.confirmed_themes.join(", ") || "none confirmed"}`,
        `Elements: ${project.visual_elements.map((e) => `${e.description} (${e.hierarchy}, ${e.fidelity})`).join("; ")}`,
        `Composition: ${project.composition_type}, background: ${project.composition_background}, density: ${project.design_density}`,
        `Artistic direction: colour ${project.colour_strategy}, realism ${project.realism_level}, presence ${project.visual_presence}, linework ${project.linework_weight}, shading ${project.shading_method}, contrast ${project.contrast_level}`,
        project.fidelity_treatment ? `Fidelity treatment: ${project.fidelity_treatment}` : "",
        `Placement: ${project.body_area || project.body_area_coarse}, ${project.size_class}, ${project.wrap_level}`,
        `Creative control: ${project.creative_control}`,
        `Avoid: ${project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") : project.avoid_list_status}`,
      ]
        .filter(Boolean)
        .join("\n");

      const blueprint = await requestBlueprint({
        journey_mode: project.journey_mode,
        significance_claimed: project.significance_claimed,
        themes_surfaced: project.confirmed_themes.length > 0,
        statement_user_authored: false,
        interpretation_confidence: project.interpretation_confidence,
        any_required_reference_missing: anyRequiredReferenceMissing,
        has_unresolved_contradiction: project.contradictions.length > 0,
        confirmed_project_summary: summary,
      });

      patchUI({ blueprint, blueprintReady: true, designConfirmed: true });
      setError(null);
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
        <dd>{[project.body_area || project.body_area_coarse, project.size_class, project.wrap_level].filter(Boolean).join(", ")}</dd>
        <dt>Creative control</dt>
        <dd>{project.creative_control || "—"}</dd>
        <dt>Avoid</dt>
        <dd>{project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") || "none listed" : "not specified"}</dd>
      </dl>
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

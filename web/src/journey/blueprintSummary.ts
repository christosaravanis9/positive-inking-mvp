import type { ProjectState, ReferenceChecklistEntry } from "@positive-inking/engine";
import { describeDimensionValue } from "./artisticDimensionLabels";
import { describeCreativeControl } from "./creativeControlLabels";
import { formatPlacementSummary } from "./placementSummary";

/**
 * The Blueprint Writer's only view of the confirmed project is this free
 * text (server/src/schemas/blueprint.ts takes `confirmed_project_summary`
 * as an opaque string, on purpose -- see that file's own note on why
 * section eligibility and readiness stay deterministic instead). That makes
 * this function the one place a raw stored enum value (e.g. "graphic",
 * "client_led") could leak into the model's input undecoded -- which is
 * exactly what produced "Graphic realism style" and "client-led ...
 * collaborative" in the Athena Blueprint incident: the model was shown bare
 * adjacent tokens with no indication of which one names a dimension and
 * which names one of several alternative values for it. Every dimension
 * with a dedicated label function is routed through it below; humanize() is
 * the fallback for the handful of fields that don't have one, so no
 * snake_case identifier is ever interpolated verbatim.
 */
function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

export function buildConfirmedProjectSummary(project: ProjectState, outstanding: readonly ReferenceChecklistEntry[]): string {
  return [
    `Story/why: ${project.statement_of_intention || project.attraction_origin}`,
    `Themes: ${project.confirmed_themes.join(", ") || "none confirmed"}`,
    `Elements: ${project.visual_elements.map((e) => `${e.description} (${humanize(e.hierarchy)}, ${humanize(e.fidelity)})`).join("; ")}`,
    `Composition: ${humanize(project.composition_type)}, background: ${humanize(project.composition_background)}, density: ${humanize(project.design_density)}`,
    `Artistic direction: ${[
      describeDimensionValue("colour", project.colour_strategy),
      describeDimensionValue("realism", project.realism_level),
      describeDimensionValue("visual_presence", project.visual_presence),
      describeDimensionValue("linework", project.linework_weight),
      describeDimensionValue("shading", project.shading_method),
      describeDimensionValue("contrast", project.contrast_level),
    ].join(", ")}`,
    project.fidelity_treatment ? `Fidelity treatment: ${project.fidelity_treatment}` : "",
    `Placement: ${formatPlacementSummary(project)}`,
    // "client-led" is named explicitly (matching the Blueprint Writer prompt's own
    // calibration instruction) alongside its plain-English meaning -- never the
    // bare stored token, which is indistinguishable from a category placeholder.
    `Creative control: ${project.creative_control.replace(/_/g, "-")} (${describeCreativeControl(project.creative_control)})`,
    `Avoid: ${project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") : humanize(project.avoid_list_status)}`,
    outstanding.length > 0
      ? `Still needed from the client: ${outstanding.map((o) => `${o.description} (${humanize(o.status)})`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

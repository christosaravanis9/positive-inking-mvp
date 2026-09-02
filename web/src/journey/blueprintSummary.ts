import type { ProjectState, ReferenceChecklistEntry, VisualElement } from "@positive-inking/engine";
import { isPersonalSourceCategory } from "@positive-inking/engine";
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

/**
 * "undecided" has no entry here on purpose. It's the hierarchy value for
 * nearly every element pre-ranking, and showing it as an inline tag next to
 * every element in the Blueprint document read as raw-enum noise stitched
 * into the sentence -- the live-test incident that produced "...saying
 * Athena undecided — A concrete thing...". An unranked element is a fact for
 * Design considerations to state as a sentence (buildConfirmedProjectSummary
 * above already tells the model each element's hierarchy so it can), not
 * something to tag on every single element in the client-facing document.
 */
export const HIERARCHY_LABEL: Partial<Record<VisualElement["hierarchy"], string>> = {
  primary: "Primary",
  supporting: "Supporting",
  accent: "Accent",
  background: "Background",
};

/** Same reasoning as HIERARCHY_LABEL: a bare humanized status ("to upload") read as a raw tag stitched onto the reference description; these are the same facts phrased as what actually happened, not an enum name. */
export const REFERENCE_STATUS_LABEL: Record<ReferenceChecklistEntry["status"], string> = {
  available: "Uploaded",
  to_upload: "Not yet uploaded",
  to_create: "To be created for this design",
  optional: "Optional — not provided",
  not_needed: "Not needed",
};

/**
 * Composes one Visual hierarchy element into prose pieces instead of
 * concatenating raw stored strings: the hierarchy role is surfaced only once
 * it names an actual value (never "undecided"), and personal_meaning is only
 * appended when it says something the description doesn't already say --
 * both BlueprintView callers (the on-screen JSX and the plain-text export)
 * build the same sentence from this so they can never drift into showing raw
 * status tags.
 */
export function visualElementSentence(e: VisualElement): { description: string; roleLabel: string | null; meaning: string | null } {
  return {
    description: e.description,
    roleLabel: HIERARCHY_LABEL[e.hierarchy] ?? null,
    meaning: e.personal_meaning.trim() && e.personal_meaning.trim() !== e.description.trim() ? e.personal_meaning : null,
  };
}

/**
 * Section 4 (Visual hierarchy) used to be the model's own visual_direction
 * paragraph followed by one merged bullet list of every element -- which is
 * exactly what let a personal-reference element's own confirmed description
 * and its still-open hierarchy decision sit in the same undifferentiated
 * block (the "(undecided)" live-test bug, task #54/#1b). Grouping into a
 * small, labelled decision map instead: `personal` and `other` partition
 * every element exhaustively by isPersonalSourceCategory (§22's own
 * definition, reused rather than a second hand-maintained list) so nothing
 * is silently dropped, and `stillUndecided` is a separate, cross-cutting
 * flag list (an element can appear there AND in its category bucket -- being
 * a personal reference and having an undecided hierarchy are two different
 * facts about the same element, not alternatives). Making "needs a decision"
 * its own visibly separate list is also what would have made #1b's leak
 * immediately obvious as a structural anomaly rather than a buried word.
 */
export interface VisualHierarchyGroups {
  personal: VisualElement[];
  other: VisualElement[];
  stillUndecided: VisualElement[];
}

export function groupVisualElementsForHierarchySection(elements: readonly VisualElement[]): VisualHierarchyGroups {
  return {
    personal: elements.filter((e) => isPersonalSourceCategory(e.source_category)),
    other: elements.filter((e) => !isPersonalSourceCategory(e.source_category)),
    stillUndecided: elements.filter((e) => e.hierarchy === "undecided"),
  };
}

import type { ArtisticDimensionKey, ProjectState, ReferenceChecklistEntry, VisualElement } from "@positive-inking/engine";
import { isPersonalSourceCategory } from "@positive-inking/engine";
import { describeDimensionValue, DIMENSION_QUESTIONS, labelForDimensionValue, PROJECT_FIELD_BY_DIMENSION } from "./artisticDimensionLabels";
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
 * small, labelled decision map instead: every element lands in EXACTLY ONE
 * of the three groups below, never more than one. `stillUndecided` takes
 * priority -- an unranked element is flagged there and nowhere else, not
 * also duplicated into `personal`/`other`, which is what a real Blueprint
 * did when this was first built as a cross-cutting flag (the same element's
 * full text appeared twice, once per group). Once an element's hierarchy is
 * resolved, `personal`/`other` then partition it exhaustively by
 * isPersonalSourceCategory (§22's own definition, reused rather than a
 * second hand-maintained list). Making "needs a decision" its own group is
 * still what makes #1b's kind of leak immediately obvious as a structural
 * anomaly -- it just has to be *one* group per element, not an overlay.
 */
export interface VisualHierarchyGroups {
  personal: VisualElement[];
  other: VisualElement[];
  stillUndecided: VisualElement[];
}

export function groupVisualElementsForHierarchySection(elements: readonly VisualElement[]): VisualHierarchyGroups {
  const stillUndecided = elements.filter((e) => e.hierarchy === "undecided");
  const resolved = elements.filter((e) => e.hierarchy !== "undecided");
  return {
    personal: resolved.filter((e) => isPersonalSourceCategory(e.source_category)),
    other: resolved.filter((e) => !isPersonalSourceCategory(e.source_category)),
    stillUndecided,
  };
}

/** Screen 10's own labels (CompositionBackground.tsx) for the one field OptionChips stores by raw value rather than label -- see that component's GENERIC_OPTIONS.density and its onSelect(option.value) wiring. Kept here, not there, since this is the one place that needs to decode it back to prose. */
const DENSITY_LABEL: Record<string, string> = {
  minimal: "Minimal",
  balanced: "Balanced",
  full: "Full",
  recommend: "Recommend it for me",
};

const COMPOSITION_BACKGROUND_LABEL: Record<ProjectState["composition_background"], string> = {
  none: "No background",
  subtle: "Subtle background",
  immersive: "Immersive background",
  undecided: "Not yet decided",
};

/**
 * Section 05 (Composition and arrangement, Sites migration spec §7). Sites' own Section 05 is
 * one deterministic template sentence assembled from confirmed composition fields; this app's
 * Blueprint Writer instead writes composition and artistic treatment together as one free
 * paragraph (Section 07 below), so there's no equivalent template to port verbatim. What ports
 * cleanly is the DISCIPLINE, not the specific template: a small deterministic fact line, in the
 * same "Captured details" convention already established for Placement (§8), built only from
 * label functions -- composition_type is already stored as its own option's label text
 * (CompositionBackground.tsx sets `composition_type = o.label` directly), composition_background
 * and design_density are raw value tokens that need decoding, never interpolated bare.
 *
 * The background label is skipped whenever composition_type's own text already states it: every
 * COMPOSITION_POOLS option with `noBackground: true` (engine/src/composition.ts) already spells
 * out "no background" in its own label ("Isolated, no background", "Text alone, no background",
 * ...) -- confirmed live: without this check, a "none" background repeated as a redundant, oddly
 * comma-spliced "Isolated, no background, No background." on screen. Matched narrowly on the
 * phrase "no background" itself (not just "background") so a genuinely different
 * subtle/immersive answer -- composition_type and composition_background are two separately
 * asked questions, so they could in principle disagree -- is never silently swallowed.
 */
export function describeComposition(project: ProjectState): string {
  const backgroundAlreadyStatedInType = /no background/i.test(project.composition_type);
  const parts = [project.composition_type || null, backgroundAlreadyStatedInType ? null : COMPOSITION_BACKGROUND_LABEL[project.composition_background]];
  const density = project.design_density ? (DENSITY_LABEL[project.design_density] ?? project.design_density) : null;
  if (density) parts.push(`${density} density`);
  return parts.filter(Boolean).join(", ");
}

export interface ConceptDecisionLine {
  key: ArtisticDimensionKey;
  question: string;
  answer: string;
}

/**
 * rendering_references is deliberately excluded: its project field (style_reference) is shared
 * with StyleReference.tsx's own free-text named-style resolution, so a confirmed value there may
 * not be one of DIMENSION_OPTIONS.rendering_references' two enum answers -- that's covered by its
 * own screen/section, not duplicated here.
 */
const CONCEPT_DECISION_DIMENSIONS: readonly ArtisticDimensionKey[] = [
  "colour",
  "realism",
  "visual_presence",
  "linework",
  "shading",
  "contrast",
  "surface_detail",
  "edge_treatment",
];

/**
 * Section 06 (Concept-specific decisions, Sites migration spec §7): "One list item per
 * generated/fallback Step 9 adaptive question. Each item contains the question title in bold
 * followed by the selected answer." This app's Step-9 equivalent is Screen 11
 * (ArtisticDirection.tsx) -- engine-generated by evaluateArtisticDimensions(), not
 * model-generated, unlike Sites' own live-model Step 9 (ArtisticDirection.tsx's own instruction
 * text already avoids the word "generated" for the same honesty reason). Every dimension with a
 * confirmed value gets one line, reusing the exact question text and answer label the screen
 * itself used, so this list can never drift from what was actually asked/answered there.
 */
export function conceptSpecificDecisions(project: ProjectState): ConceptDecisionLine[] {
  const fields = project as unknown as Record<string, string>;
  return CONCEPT_DECISION_DIMENSIONS.filter((key) => Boolean(fields[PROJECT_FIELD_BY_DIMENSION[key]])).map((key) => ({
    key,
    question: DIMENSION_QUESTIONS[key],
    answer: labelForDimensionValue(key, fields[PROJECT_FIELD_BY_DIMENSION[key]]),
  }));
}

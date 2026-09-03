import type { ArtisticDimensionKey, ProjectState } from "@positive-inking/engine";

/**
 * Shared between ArtisticDirection.tsx (Screen 11's own question-by-question
 * flow) and StyleReference.tsx (§12.10's named-style resolution) so both
 * read the same option vocabulary, labels, and project-field mapping --
 * one dimension's meaning can never drift between the two paths that set it.
 */
export const DIMENSION_OPTIONS: Record<ArtisticDimensionKey, { value: string; label: string }[]> = {
  colour: [
    { value: "black_and_grey", label: "Black and grey" },
    { value: "selective", label: "Selective colour" },
    { value: "full", label: "Full colour" },
    { value: "unsure", label: "Not sure — recommend it" },
  ],
  realism: [
    { value: "graphic", label: "Graphic" },
    { value: "illustrative", label: "Illustrative" },
    { value: "realistic", label: "Realistic" },
  ],
  visual_presence: [
    { value: "quiet", label: "Quiet" },
    { value: "clearly_present", label: "Clearly present" },
    { value: "immediate_statement", label: "An immediate statement" },
  ],
  linework: [
    { value: "light", label: "Light" },
    { value: "structured", label: "Structured" },
    { value: "heavy", label: "Heavy" },
  ],
  shading: [
    { value: "minimal", label: "Minimal" },
    { value: "smooth_greywash", label: "Smooth greywash" },
    { value: "richly_rendered", label: "Richly rendered" },
  ],
  contrast: [
    { value: "soft", label: "Soft" },
    { value: "balanced", label: "Balanced" },
    { value: "dramatic", label: "Dramatic" },
  ],
  surface_detail: [
    { value: "simplified", label: "Simplified" },
    { value: "moderate", label: "Moderate" },
    { value: "highly_textured", label: "Highly textured" },
  ],
  edge_treatment: [
    { value: "left_to_artist", label: "Left to the artist" },
    { value: "crisp_clean", label: "Crisp, clean edges" },
    { value: "soft_blended", label: "Soft, blended edges" },
  ],
  rendering_references: [
    { value: "will_provide", label: "I'll provide a reference image" },
    { value: "describe_only", label: "Description only, no reference" },
  ],
};

export const DIMENSION_LABEL: Record<ArtisticDimensionKey, string> = {
  colour: "Colour",
  realism: "Realism",
  visual_presence: "Visual presence",
  linework: "Linework",
  shading: "Shading",
  contrast: "Contrast",
  surface_detail: "Surface detail",
  edge_treatment: "Edge treatment",
  rendering_references: "Rendering references",
};

/** The question text asked for each dimension on Screen 11 (ArtisticDirection.tsx) -- also reused by the Blueprint's "Concept-specific decisions" section (Sites migration spec §7, section 06) so a question's title can never drift between where it was asked and where it's confirmed. */
export const DIMENSION_QUESTIONS: Record<ArtisticDimensionKey, string> = {
  colour: "How should colour work?",
  realism: "How realistic should this be?",
  visual_presence: "How much visual presence should it have?",
  linework: "How should the linework feel?",
  shading: "How should shading work?",
  contrast: "How much contrast?",
  surface_detail: "How much surface detail?",
  edge_treatment: "How should edges feel?",
  rendering_references: "Do you have a reference for exact rendering?",
};

export const PROJECT_FIELD_BY_DIMENSION: Record<ArtisticDimensionKey, keyof ProjectState> = {
  colour: "colour_strategy",
  realism: "realism_level",
  visual_presence: "visual_presence",
  linework: "linework_weight",
  shading: "shading_method",
  contrast: "contrast_level",
  surface_detail: "surface_detail",
  edge_treatment: "edge_treatment",
  rendering_references: "style_reference",
};

/**
 * evaluateArtisticDimensions() (engine/src/artisticDimensions.ts) can resolve a dimension to its
 * own ARTISTIC_DIMENSION_DEFAULTS value when the question budget runs out before the client is
 * asked -- e.g. edge_treatment's default is the literal string "not_specified_left_to_artist",
 * rendering_references' is "not_specified". Neither string matches any of that dimension's own
 * DIMENSION_OPTIONS values (found live: the Blueprint's new Concept-specific decisions section,
 * §7, first surfaced this -- "How should edges feel? not_specified_left_to_artist", the exact raw-
 * enum-leak class this app has fixed before, in a place nothing previously rendered edge_treatment
 * at all). These aren't added to DIMENSION_OPTIONS itself, which would make them look like a
 * fourth, user-selectable menu choice on Screen 11 (ArtisticDirection.tsx renders that array
 * directly as buttons) -- they're a separate small label map for values that only ever arrive as
 * an engine default, never a click.
 */
const DEFAULT_VALUE_LABEL: Partial<Record<string, string>> = {
  not_specified_left_to_artist: "Left to the artist",
  not_specified: "Not specified — left open",
};

function resolveLabel(dimension: ArtisticDimensionKey, value: string): string {
  return DIMENSION_OPTIONS[dimension]?.find((o) => o.value === value)?.label ?? DEFAULT_VALUE_LABEL[value] ?? value;
}

/** Human-readable "Colour: Selective colour" style line for a resolved dimension/value pair. */
export function describeDimensionValue(dimension: ArtisticDimensionKey, value: string): string {
  return `${DIMENSION_LABEL[dimension]}: ${resolveLabel(dimension, value)}`;
}

/** Just the value's own label ("Selective colour"), no dimension prefix -- for a line that already reads as a list, e.g. a "Treatment" summary. Falls back to the raw value only if it's genuinely unrecognised, never silently to blank. */
export function labelForDimensionValue(dimension: ArtisticDimensionKey, value: string): string {
  return resolveLabel(dimension, value);
}

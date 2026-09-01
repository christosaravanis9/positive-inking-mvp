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

/** Human-readable "Colour: Selective colour" style line for a resolved dimension/value pair. */
export function describeDimensionValue(dimension: ArtisticDimensionKey, value: string): string {
  const option = DIMENSION_OPTIONS[dimension]?.find((o) => o.value === value);
  return `${DIMENSION_LABEL[dimension]}: ${option?.label ?? value}`;
}

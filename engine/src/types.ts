/**
 * Core domain types for Positive Inking.
 *
 * These mirror the V3.0 §18 project data model. This module has zero
 * dependencies and no side effects — it is pure data shape, shared by the
 * deterministic engine, the server's model layer, and the web client.
 */

export type JourneyMode = "full" | "attraction" | "expert" | "manual";

export type Viewpoint = "past" | "present" | "future" | "mixed";

export type CreativeControl =
  | "client_led"
  | "collaborative"
  | "artist_led"
  | "surrendered";

export type PlaceRole = "none" | "subject" | "setting" | "ambiguous";

export type SizeClass = "small" | "medium" | "large" | "sleeve_or_panel";

export type ConceptShape =
  | "single_emblem"
  | "paired_elements"
  | "multi_element"
  | "narrative_scene"
  | "text_led"
  | "portrait_led";

export type ElementHierarchy =
  | "primary"
  | "supporting"
  | "accent"
  | "background"
  | "undecided";

export type ElementFidelity =
  | "exact"
  | "closely_based_on"
  | "interpretive"
  | "open";

export type ElementOrigin =
  | "system_suggestion"
  | "user_story"
  | "user_added"
  | "visual_inspiration";

export type ReferenceStatus =
  | "available"
  | "to_upload"
  | "to_create"
  | "optional"
  | "not_needed";

export type ReadinessState =
  | "blueprint_ready"
  | "references_needed"
  | "concept_visual_ready"
  | "artist_consultation_recommended"
  | "needs_refinement";

export type AvoidListStatus = "asked_answered" | "asked_declined" | "not_asked";

export type ProjectTitleMode = "none" | "functional" | "user_defined";

export type InterpretationConfidence = "" | "low" | "standard";

/** §8 element record schema (Screen 7). */
export interface VisualElement {
  id: string;
  description: string;
  personal_meaning: string;
  source_category: string;
  hierarchy: ElementHierarchy;
  fidelity: ElementFidelity;
  colour_role: "none" | "accent" | "primary" | "undecided";
  reference_required: boolean;
  reference_status: ReferenceStatus;
  origin: ElementOrigin;
  user_selected: boolean;
}

/** §12.1 — computed after Screen 7, and recomputed after any accepted new idea. */
export interface ConceptSignals {
  element_count: number;
  primary_element_type:
    | "object"
    | "person"
    | "place"
    | "text"
    | "animal"
    | "abstract"
    | "mixed";
  has_text_or_handwriting: boolean;
  has_likeness: boolean;
  place_role: PlaceRole;
  has_exact_fidelity_element: boolean;
  has_colour_signal: boolean;
  size_class: SizeClass;
  spatial_language_present: boolean;
  connects_to_other_work: boolean;
  creative_control: CreativeControl;
  user_is_tattoo_literate: boolean;
  concept_shape: ConceptShape;
}

/** §15.3 — a single attestation/consent record. */
export interface ConsentRecord {
  reference_id: string;
  material_type:
    | "likeness"
    | "handwriting"
    | "signature"
    | "drawing"
    | "artwork"
    | "tattoo_design"
    | "own_material";
  subject_relationship: "self" | "living_other" | "child" | "deceased" | "unknown";
  attestation_given: boolean;
  attestation_text: string;
  attested_at: string | null;
  copyright_flag: boolean;
  flag_resolution: "proceeded" | "switched_to_inspired_by" | "removed" | null;
}

/** §9.2 — AI Action A: Discovery analysis output. */
export interface DiscoveryResult {
  primary_viewpoint: Viewpoint;
  secondary_viewpoints: Viewpoint[];
  primary_intention: string;
  secondary_intentions: string[];
  deep_why: string;
  key_themes: string[];
  candidate_core_values: string[];
  personal_people: string[];
  personal_places: string[];
  personal_objects: string[];
  personal_events: string[];
  personal_memories: string[];
  personal_phrases: string[];
  open_threads: string[];
  interpretation: string;
  statement_of_intention: string;
  clarification_required: boolean;
  clarification_reason: string | null;
  clarification_question: string | null;
  suggested_answers: string[];
  confidence: number;
  visual_confidence: number;
}

/** §10 — AI Action A-lite: provenance extraction output (attraction/expert modes). */
export interface ProvenanceResult {
  attraction_origin: string;
  origin_period: "childhood" | "adolescence" | "adulthood" | "recent" | "unknown";
  origin_source: "person" | "place" | "media" | "tattoo_seen" | "object" | "unknown";
  personal_entities: string[];
  significance_claimed: boolean;
  provenance_confidence: number;
}

/** §12.10 — style reference resolution. */
export interface StyleReference {
  style_reference: string;
  style_resolves: ArtisticDimensionKey[];
  style_leaves_open: ArtisticDimensionKey[];
}

export type ArtisticDimensionKey =
  | "colour"
  | "realism"
  | "visual_presence"
  | "linework"
  | "shading"
  | "contrast"
  | "surface_detail"
  | "edge_treatment"
  | "rendering_references";

/** The full project state, per §18. Grows across the journey; nothing is
 * ever silently overwritten — only explicit, ruled recomputation (§14.1)
 * invalidates a previously confirmed value. */
export interface ProjectState {
  project_id: string;
  created_at: string;
  updated_at: string;
  journey_mode: JourneyMode;
  project_title_mode: ProjectTitleMode;
  project_title: string | null;

  user_viewpoint: string | null;
  viewpoint_applied: boolean;
  primary_viewpoint: Viewpoint | null;
  secondary_viewpoints: Viewpoint[];

  raw_story: string;
  story_transcript: string;
  input_method: string;

  primary_intention: string;
  secondary_intentions: string[];
  deep_why: string;
  selected_themes: string[];
  confirmed_themes: string[];
  confirmed_core_values: string[];
  statement_of_intention: string;
  confidence: number;
  visual_confidence: number;
  interpretation_confidence: InterpretationConfidence;
  interpretation_mode: "" | "tentative" | "standard";
  personal_material_source: "" | "user_corrected" | "model_extracted";

  attraction_origin: string;
  origin_period: ProvenanceResult["origin_period"] | "";
  origin_source: ProvenanceResult["origin_source"] | "";
  significance_claimed: boolean;
  provenance_confidence: number;

  personal_people: string[];
  personal_places: string[];
  personal_objects: string[];
  personal_events: string[];
  personal_memories: string[];
  personal_phrases: string[];

  visual_elements: VisualElement[];
  thought_associations: string[];
  visual_associations: string[];
  visual_inspiration_additions: string[];
  artist_notes: string[];
  idea_iteration_count: number;
  concept_recompute_count: number;
  questions_reasked: string[];
  ideas_demoted_to_notes: number;

  creative_control: CreativeControl | "";
  artist_freedom: string;
  artist_led_element: string;

  concept_shape: ConceptShape | "";
  place_role: PlaceRole;
  composition_type: string;
  composition_background: "none" | "subtle" | "immersive" | "undecided";
  background_source: string;
  background_elements: string[];
  design_density: string;
  negative_space_strategy: string;
  reading_direction: string;
  canvas_background: "white";

  visual_presence: string;
  realism_level: string;
  linework_weight: string;
  shading_method: string;
  contrast_level: string;
  colour_strategy: string;
  surface_detail: string;
  edge_treatment: string;
  fidelity_treatment: string;
  style_reference: string;
  style_resolves: ArtisticDimensionKey[];
  style_leaves_open: ArtisticDimensionKey[];
  style_references: StyleReference[];

  avoid_list: string[];
  avoid_list_status: AvoidListStatus;

  body_area_coarse: string;
  size_class: SizeClass | "";
  body_area: string;
  side: string;
  dimensions: string | null;
  wrap_level: string;
  primary_view: string;
  future_expansion: string;
  existing_tattoos: string[];
  placement_reference: string | null;

  reference_checklist: string[];
  consent_records: ConsentRecord[];
  contradictions: string[];
  unsupported_inferences: string[];
  generation_readiness: ReadinessState | "";

  blueprint: {
    story: string;
    why_this_image: string;
    why: string;
    visual_direction: string;
    artistic_direction: string;
    placement: string;
    design_considerations: string[];
    statement_of_inspiration: string;
    artist_brief: string;
    readiness: ReadinessState | "";
  };
}

export function createEmptyProjectState(projectId: string, now: string): ProjectState {
  return {
    project_id: projectId,
    created_at: now,
    updated_at: now,
    journey_mode: "full",
    project_title_mode: "none",
    project_title: null,

    user_viewpoint: null,
    viewpoint_applied: true,
    primary_viewpoint: null,
    secondary_viewpoints: [],

    raw_story: "",
    story_transcript: "",
    input_method: "",

    primary_intention: "",
    secondary_intentions: [],
    deep_why: "",
    selected_themes: [],
    confirmed_themes: [],
    confirmed_core_values: [],
    statement_of_intention: "",
    confidence: 0,
    visual_confidence: 0,
    interpretation_confidence: "",
    interpretation_mode: "",
    personal_material_source: "",

    attraction_origin: "",
    origin_period: "",
    origin_source: "",
    significance_claimed: false,
    provenance_confidence: 0,

    personal_people: [],
    personal_places: [],
    personal_objects: [],
    personal_events: [],
    personal_memories: [],
    personal_phrases: [],

    visual_elements: [],
    thought_associations: [],
    visual_associations: [],
    visual_inspiration_additions: [],
    artist_notes: [],
    idea_iteration_count: 0,
    concept_recompute_count: 0,
    questions_reasked: [],
    ideas_demoted_to_notes: 0,

    creative_control: "",
    artist_freedom: "",
    artist_led_element: "",

    concept_shape: "",
    place_role: "none",
    composition_type: "",
    composition_background: "undecided",
    background_source: "",
    background_elements: [],
    design_density: "",
    negative_space_strategy: "",
    reading_direction: "",
    canvas_background: "white",

    visual_presence: "",
    realism_level: "",
    linework_weight: "",
    shading_method: "",
    contrast_level: "",
    colour_strategy: "",
    surface_detail: "",
    edge_treatment: "",
    fidelity_treatment: "",
    style_reference: "",
    style_resolves: [],
    style_leaves_open: [],
    style_references: [],

    avoid_list: [],
    avoid_list_status: "not_asked",

    body_area_coarse: "",
    size_class: "",
    body_area: "",
    side: "",
    dimensions: null,
    wrap_level: "",
    primary_view: "",
    future_expansion: "",
    existing_tattoos: [],
    placement_reference: null,

    reference_checklist: [],
    consent_records: [],
    contradictions: [],
    unsupported_inferences: [],
    generation_readiness: "",

    blueprint: {
      story: "",
      why_this_image: "",
      why: "",
      visual_direction: "",
      artistic_direction: "",
      placement: "",
      design_considerations: [],
      statement_of_inspiration: "",
      artist_brief: "",
      readiness: "",
    },
  };
}

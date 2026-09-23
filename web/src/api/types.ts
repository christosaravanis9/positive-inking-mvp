import type { ArtisticDimensionKey, ArtistBrief, PlaceRole, ReadinessState, AssociationLane } from "@positive-inking/engine";

export interface DiscoveryData {
  primary_viewpoint: "past" | "present" | "future" | "mixed";
  secondary_viewpoints: string[];
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
  meaning_is_thin: boolean;
  depth_prompt: string | null;
  depth_prompt_suggestions: string[];
}

export interface ProvenanceData {
  attraction_origin: string;
  origin_period: string;
  origin_source: string;
  personal_entities: string[];
  significance_claimed: boolean;
  provenance_confidence: number;
  reentry_candidate: { surfaced: boolean; subject: string };
}

export interface VisualCandidate {
  description: string;
  personal_meaning: string;
  source_category: string;
  resolution_state: "concrete" | "needs_client_specific_detail";
  follow_up_prompt?: string;
  /** 2026-09-09: which DEVICE VOCABULARY entry (engine's DEVICE_CATALOG) this candidate was built from -- undefined when the model's own value didn't match a real catalog id (server/src/routes/association.ts sanitizes it before this ever reaches the client). Used only for the device_impression/device_outcome analytics events below; never shown to the client. */
  device_id?: string;
  /** 2026-09: which of the 5 pre-qualifying-question lanes (engine's AssociationLane) this candidate belongs to -- independent of device_id, see ASSOCIATION_SYSTEM_PROMPT's own DEVICE VOCABULARY intro. Undefined when the model's value didn't validate (server/src/schemas/association.ts's per-candidate salvage keeps the rest of the batch either way). */
  lane?: AssociationLane;
  /** framed lane's own sub-attribute (rule 1) -- present only when lane is "framed". */
  rendering_style?: "realism" | "anime" | "artistic_line_art" | "photographic";
  personal_relevance: number;
  story_relevance: number;
  visual_potential: number;
  originality: number;
  genericity: number;
  reference_availability: number;
}

export interface AssociationData {
  visual_candidates: VisualCandidate[];
  place_role: PlaceRole;
  place_role_reasoning: string;
  spatial_language_present: boolean;
  has_text_or_handwriting: boolean;
  has_likeness: boolean;
  text_is_primary: boolean;
  likeness_is_primary: boolean;
  primary_element_type: "object" | "person" | "place" | "text" | "animal" | "abstract" | "mixed";
  contradictions_noticed: { description: string; resolutions: string[] }[];
}

/** 2026-09-23: one short, loose, illustrative hint per Association lane (server/src/schemas/styleHints.ts), for VisualStylePreference.tsx's per-lane subheadings. A lane missing from `hints` (call failed entirely, or the model omitted just that one lane) falls back to that screen's own static description -- never treated as an error. */
export interface StyleHintsData {
  hints: Partial<Record<AssociationLane, string>>;
}

export interface AvoidanceData {
  suggestions: string[];
}

export interface StyleReferenceData {
  recognized: boolean;
  under_specified: boolean;
  summary: string;
  leaves_open_note: string;
  style_resolves: ArtisticDimensionKey[];
  style_leaves_open: ArtisticDimensionKey[];
  resolved_values: Partial<Record<ArtisticDimensionKey, string>>;
}

export interface BlueprintData {
  story: string | null;
  why_this_image: string | null;
  why: string | null;
  what_matters_most: string | null;
  visual_direction: string;
  artistic_direction: string;
  placement: string;
  design_considerations: string[];
  statement_of_inspiration: string | null;
  artist_brief: ArtistBrief;
  readiness: ReadinessState;
}

export type { ArtisticDimensionKey };

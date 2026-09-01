import type { ArtisticDimensionKey, PlaceRole, ReadinessState } from "@positive-inking/engine";

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
  artist_brief: string;
  readiness: ReadinessState;
}

export type { ArtisticDimensionKey };

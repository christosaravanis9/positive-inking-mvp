/**
 * §12.1–12.3 — concept signals and concept_shape derivation.
 *
 * `place_role` and other semantic classifications (is this primarily a
 * person, an object, spatial language present or not...) are the output of
 * model interpretation upstream (Discovery/Association engines) — deciding
 * whether a story is "about" a place or merely set in one requires reading
 * the story. What happens *after* that classification is deterministic, and
 * lives here: given already-classified inputs, derive concept_shape and the
 * rest of the signal set by rule, not by another model call.
 */

import type { ConceptShape, PlaceRole, ConceptSignals } from "./types.js";

export interface ConceptShapeInput {
  element_count: number;
  place_role: PlaceRole;
  spatial_language_present: boolean;
  has_text_or_handwriting: boolean;
  has_likeness: boolean;
  /** True when a text/handwriting element is the primary (not merely present) element. */
  text_is_primary: boolean;
  /** True when a likeness is the primary (not merely present) element. */
  likeness_is_primary: boolean;
}

/**
 * §12.3 derivation table. Order matters: text_led and portrait_led are
 * primary-element overrides that win over count-based shapes; narrative_scene
 * (setting/spatial language) wins over multi_element for a place-as-setting
 * story; a place resolved as `subject` is explicitly excluded from that
 * override and instead falls through to the count-based rule, per the note
 * "A place with place_role: subject derives shape from element count as if
 * it were an object."
 */
export function deriveConceptShape(input: ConceptShapeInput): ConceptShape {
  if (input.text_is_primary) return "text_led";
  if (input.likeness_is_primary) return "portrait_led";

  if (input.place_role === "setting" || input.spatial_language_present) {
    return "narrative_scene";
  }

  if (input.element_count === 1) return "single_emblem";
  if (input.element_count === 2) return "paired_elements";
  if (input.element_count >= 3) return "multi_element";

  // Zero elements: nothing has been captured yet. Treat as single_emblem so
  // downstream eligibility has a defined (maximally conservative) shape to
  // reason about rather than an undefined state.
  return "single_emblem";
}

export interface ComputeConceptSignalsInput {
  element_count: number;
  primary_element_type: ConceptSignals["primary_element_type"];
  has_text_or_handwriting: boolean;
  has_likeness: boolean;
  place_role: PlaceRole;
  has_exact_fidelity_element: boolean;
  has_colour_signal: boolean;
  size_class: ConceptSignals["size_class"];
  spatial_language_present: boolean;
  connects_to_other_work: boolean;
  creative_control: ConceptSignals["creative_control"];
  user_is_tattoo_literate: boolean;
  text_is_primary: boolean;
  likeness_is_primary: boolean;
}

/** Assembles the full ConceptSignals record, deriving concept_shape by rule. */
export function computeConceptSignals(input: ComputeConceptSignalsInput): ConceptSignals {
  const concept_shape = deriveConceptShape({
    element_count: input.element_count,
    place_role: input.place_role,
    spatial_language_present: input.spatial_language_present,
    has_text_or_handwriting: input.has_text_or_handwriting,
    has_likeness: input.has_likeness,
    text_is_primary: input.text_is_primary,
    likeness_is_primary: input.likeness_is_primary,
  });

  return {
    element_count: input.element_count,
    primary_element_type: input.primary_element_type,
    has_text_or_handwriting: input.has_text_or_handwriting,
    has_likeness: input.has_likeness,
    place_role: input.place_role,
    has_exact_fidelity_element: input.has_exact_fidelity_element,
    has_colour_signal: input.has_colour_signal,
    size_class: input.size_class,
    spatial_language_present: input.spatial_language_present,
    connects_to_other_work: input.connects_to_other_work,
    creative_control: input.creative_control,
    user_is_tattoo_literate: input.user_is_tattoo_literate,
    concept_shape,
  };
}

/**
 * §12.2 — place role is ambiguous exactly when the model could not settle
 * subject vs setting from the story. This one question is mandatory
 * (never budget-counted, per §12.4) and must run before any composition
 * option is generated.
 */
export function placeDisambiguationRequired(place_role: PlaceRole): boolean {
  return place_role === "ambiguous";
}

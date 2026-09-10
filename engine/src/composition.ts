/**
 * §12.5 composition eligibility, §12.6 option pools, §12.7 background
 * variables. Composition type and internal background are always mandatory
 * — included here as constant decisions purely so the engine inspector has
 * one uniform shape to display for every composition-related question.
 */

import type { ConceptShape, PlaceRole, SizeClass } from "./types.js";

export interface EligibilityDecision {
  eligible: boolean;
  mandatory: boolean;
  reason: string;
}

export function evaluateCompositionType(): EligibilityDecision {
  return { eligible: true, mandatory: true, reason: "Composition type is always asked (§12.5)." };
}

export function evaluateInternalBackground(): EligibilityDecision {
  return { eligible: true, mandatory: true, reason: "Internal background decision is always asked (§12.5)." };
}

export function evaluatePlaceDisambiguation(place_role: PlaceRole): EligibilityDecision {
  if (place_role === "ambiguous") {
    return { eligible: true, mandatory: true, reason: "place_role is ambiguous — must be resolved before composition options are generated (§12.2)." };
  }
  return { eligible: false, mandatory: false, reason: "place_role is already resolved; no disambiguation needed." };
}

export interface DensityInputs {
  element_count: number;
  composition_background: "none" | "subtle" | "immersive" | "undecided";
}

export function evaluateDensity(input: DensityInputs): EligibilityDecision {
  const backgroundPresent = input.composition_background === "subtle" || input.composition_background === "immersive";
  if (input.element_count >= 2 || backgroundPresent) {
    return { eligible: true, mandatory: false, reason: "Two or more elements, or a background is present (§12.5)." };
  }
  return { eligible: false, mandatory: false, reason: "Single isolated element, no background — density is not material (§12.5)." };
}

export interface NegativeSpaceInputs {
  concept_shape: ConceptShape;
  size_class: SizeClass;
}

export function evaluateNegativeSpace(input: NegativeSpaceInputs): EligibilityDecision {
  const bigEnough = input.size_class === "large" || input.size_class === "sleeve_or_panel";
  if (input.concept_shape === "multi_element" || input.concept_shape === "narrative_scene" || bigEnough) {
    return { eligible: true, mandatory: false, reason: "Multi-element/narrative concept, or large-or-sleeve scale (§12.5)." };
  }
  return { eligible: false, mandatory: false, reason: "Small single-element work — negative space is not material (§12.5)." };
}

export interface ReadingDirectionInputs {
  element_count: number;
  has_text_or_handwriting: boolean;
  concept_shape: ConceptShape;
}

/**
 * §12.5 lists this trigger as "element_count >= 3, text present, or narrative
 * scene" — taken completely literally, "text present" alone fires for a
 * single signature or a single word, where there is no real reading-order
 * decision to make (it reads the one way it reads). The §25 journey trace
 * for a single exact-fidelity signature under `surrendered` control (budget
 * of exactly one discretionary composition question) exposed this directly:
 * the table would spend that one slot on a non-decision. Reading direction
 * only becomes material once there is more than one thing to order — either
 * several elements generally, or several text elements specifically — so
 * `has_text_or_handwriting` is required alongside `element_count >= 2` here,
 * not on its own. Smallest change that fixes the waste without touching the
 * table's other triggers.
 */
export function evaluateReadingDirection(input: ReadingDirectionInputs): EligibilityDecision {
  if (input.element_count >= 3 || (input.has_text_or_handwriting && input.element_count >= 2) || input.concept_shape === "narrative_scene") {
    return { eligible: true, mandatory: false, reason: "Three or more elements, multiple text elements, or a narrative scene (§12.5, refined)." };
  }
  return { eligible: false, mandatory: false, reason: "Otherwise inferred and stated back to the user, not asked (§12.5)." };
}

export interface ContainmentInputs {
  size_class: SizeClass;
  connects_to_other_work: boolean;
}

export function evaluateContainmentVsWrap(input: ContainmentInputs): EligibilityDecision {
  const bigEnough = input.size_class === "large" || input.size_class === "sleeve_or_panel";
  if (bigEnough || input.connects_to_other_work) {
    return { eligible: true, mandatory: false, reason: "Large-or-sleeve scale, or connects to other work (§12.5)." };
  }
  return { eligible: false, mandatory: false, reason: "Small and medium contained work — containment is assumed (§12.5)." };
}

export function evaluateBackgroundSource(composition_background: "none" | "subtle" | "immersive" | "undecided"): EligibilityDecision {
  if (composition_background === "none") {
    return { eligible: false, mandatory: false, reason: "No background was chosen — never invent scenic material after that choice (§12.5, §12.8)." };
  }
  if (composition_background === "undecided") {
    return { eligible: false, mandatory: false, reason: "Background decision not yet made." };
  }
  return { eligible: true, mandatory: false, reason: "A background is present (§12.5)." };
}

/** §12.5 — explicit composition confirmation is required when any two of these hold. */
export interface CompositionConfirmationSignals {
  large_placement: boolean;
  multiple_visual_elements: boolean;
  sleeve_or_panel: boolean;
  strong_visual_presence: boolean;
  mentions_flow_scene_journey_environment: boolean;
  must_connect_to_existing_or_future_work: boolean;
}

export function explicitCompositionConfirmationRequired(signals: CompositionConfirmationSignals): boolean {
  const count = Object.values(signals).filter(Boolean).length;
  return count >= 2;
}

/** §12.6 — candidate pools, not menus. Rewritten in the user's own terms downstream by the model; these are the fixed slots the model fills. */
export interface CompositionOption {
  label: string;
  /**
   * 2026-09-09, live-reported: the bare structural labels below ("Interlocking",
   * "Shared frame", "Anchored primary with orbiting supporting elements") were
   * genuinely hard to visualise with no supporting text -- a client can't
   * picture "Interlocking" without a concrete image of what that would
   * actually look like. One short, plain sentence per option, describing
   * what it would look like in practice -- never jargon, never repeating the
   * label's own words back. Optional only so `SOMETHING_ELSE_OPTION` (which
   * needs none) doesn't require one.
   */
  description?: string;
  noBackground?: true;
}

export const COMPOSITION_POOLS: Record<ConceptShape, CompositionOption[]> = {
  single_emblem: [
    { label: "Isolated, no background", description: "Just the subject on its own, nothing around it.", noBackground: true },
    { label: "Contained emblem", description: "The subject sits inside a simple bordered shape, like a badge or seal." },
    { label: "Subject with subtle supporting detail", description: "The subject stays the clear focus, with one small extra detail nearby." },
    { label: "Open composition with negative space", description: "The subject sits with open space around it, using that space as part of the design." },
  ],
  paired_elements: [
    { label: "Isolated pair, no background", description: "Both elements together on their own, nothing around them.", noBackground: true },
    { label: "Interlocking", description: "The two elements physically overlap or connect into one combined shape." },
    { label: "Mirrored or balanced", description: "The two elements sit in matching or balanced positions, like reflections of each other." },
    { label: "One primary with one accent", description: "One element is the clear main subject; the other is a smaller supporting detail beside it." },
    { label: "Shared frame", description: "Both elements sit together inside one shared border or shape." },
  ],
  multi_element: [
    { label: "Isolated cluster, no background", description: "All the elements grouped together on their own, nothing around them.", noBackground: true },
    { label: "Layered", description: "The elements overlap in layers, some sitting in front of others." },
    { label: "Collage", description: "The elements sit together loosely, like pieces gathered on a page rather than one continuous scene." },
    { label: "Anchored primary with orbiting supporting elements", description: "One main element anchors the design, with the others arranged around it." },
    { label: "Contained arrangement", description: "All the elements sit together inside one shared border or shape." },
  ],
  narrative_scene: [
    { label: "Connected narrative", description: "The elements read in sequence, like frames of one unfolding story." },
    { label: "Immersive environment", description: "Everything sits together inside one continuous scene or setting." },
    { label: "Framed scene", description: "The whole scene sits inside a border, like looking through a window." },
    { label: "Primary subject emerging from environment", description: "One subject stands out clearly, set against or growing out of its surroundings." },
    { label: "Flowing composition", description: "The elements flow into each other with no hard edges between them." },
    { label: "No background — keep elements isolated", description: "The elements on their own, with nothing filling in around them.", noBackground: true },
  ],
  text_led: [
    { label: "Text alone, no background", description: "Just the words, nothing else around them.", noBackground: true },
    { label: "Text with single accent", description: "The words plus one small supporting mark or symbol." },
    { label: "Text integrated into an element", description: "The words are worked directly into another design element, not sitting separately." },
    { label: "Text as containing shape", description: "The words themselves form the outline or shape of the design." },
  ],
  portrait_led: [
    { label: "Isolated likeness, no background", description: "Just the likeness on its own, nothing around it.", noBackground: true },
    { label: "Likeness with symbolic accent", description: "The likeness plus one small symbolic detail nearby." },
    { label: "Likeness within an environment", description: "The likeness sits inside a setting or scene, not isolated." },
    { label: "Framed portrait", description: "The likeness sits inside a border, like a framed picture." },
  ],
};

export const SOMETHING_ELSE_OPTION: CompositionOption = { label: "Something else", description: "Describe your own idea for how this should come together." };

/**
 * Returns the candidate pool for a shape, with "Something else" always
 * appended. The no-background option is a fixed member of the underlying
 * table — there is no filtering step here that could ever remove it,
 * which is the invariant §12.6/Build Brief §7.2 require.
 */
export function getCompositionOptionPool(shape: ConceptShape): CompositionOption[] {
  return [...COMPOSITION_POOLS[shape], SOMETHING_ELSE_OPTION];
}

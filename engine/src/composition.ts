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

export function evaluateReadingDirection(input: ReadingDirectionInputs): EligibilityDecision {
  if (input.element_count >= 3 || input.has_text_or_handwriting || input.concept_shape === "narrative_scene") {
    return { eligible: true, mandatory: false, reason: "Three or more elements, text present, or a narrative scene (§12.5)." };
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
  noBackground?: true;
}

export const COMPOSITION_POOLS: Record<ConceptShape, CompositionOption[]> = {
  single_emblem: [
    { label: "Isolated, no background", noBackground: true },
    { label: "Contained emblem" },
    { label: "Subject with subtle supporting detail" },
    { label: "Open composition with negative space" },
  ],
  paired_elements: [
    { label: "Isolated pair, no background", noBackground: true },
    { label: "Interlocking" },
    { label: "Mirrored or balanced" },
    { label: "One primary with one accent" },
    { label: "Shared frame" },
  ],
  multi_element: [
    { label: "Isolated cluster, no background", noBackground: true },
    { label: "Layered" },
    { label: "Collage" },
    { label: "Anchored primary with orbiting supporting elements" },
    { label: "Contained arrangement" },
  ],
  narrative_scene: [
    { label: "Connected narrative" },
    { label: "Immersive environment" },
    { label: "Framed scene" },
    { label: "Primary subject emerging from environment" },
    { label: "Flowing composition" },
    { label: "No background — keep elements isolated", noBackground: true },
  ],
  text_led: [
    { label: "Text alone, no background", noBackground: true },
    { label: "Text with single accent" },
    { label: "Text integrated into an element" },
    { label: "Text as containing shape" },
  ],
  portrait_led: [
    { label: "Isolated likeness, no background", noBackground: true },
    { label: "Likeness with symbolic accent" },
    { label: "Likeness within an environment" },
    { label: "Framed portrait" },
  ],
};

export const SOMETHING_ELSE_OPTION: CompositionOption = { label: "Something else" };

/**
 * Returns the candidate pool for a shape, with "Something else" always
 * appended. The no-background option is a fixed member of the underlying
 * table — there is no filtering step here that could ever remove it,
 * which is the invariant §12.6/Build Brief §7.2 require.
 */
export function getCompositionOptionPool(shape: ConceptShape): CompositionOption[] {
  return [...COMPOSITION_POOLS[shape], SOMETHING_ELSE_OPTION];
}

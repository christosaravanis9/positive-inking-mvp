/**
 * §7-§8 screen sequencing. Which screen appears next is exactly the kind of
 * decision the Build Brief says must never be delegated to a model call —
 * this is a pure function over journey progress flags, fully testable
 * without a UI or a network call. Screens 7 onward are identical across
 * all modes (§7's convergence rule); composition/artistic sub-sequencing
 * within Screens 10 and 11 is handled separately by compositionFlow.ts and
 * artisticDimensions.ts, which the UI drives until each reports no more
 * questions to ask before advancing here.
 */

import type { JourneyMode } from "./types.js";

export type ScreenId =
  | "welcome"
  | "viewpoint"
  | "story"
  | "clarification"
  | "meaning_reflection"
  | "intention_confirmation"
  | "image_description"
  | "image_provenance"
  | "elements_discovery"
  | "creative_control"
  | "rough_scale"
  | "composition_background"
  | "artistic_direction"
  | "avoidances"
  | "placement"
  | "design_confirmation"
  | "blueprint"
  | "working_notes";

export interface JourneyProgress {
  journey_mode: JourneyMode;
  manualPathActive: boolean;
  pastWelcome: boolean;
  viewpointSelected: boolean;

  // full mode (Screens 3-6)
  storySubmitted: boolean;
  clarificationRequired: boolean;
  clarificationShown: boolean;
  themesSelected: boolean;
  intentionConfirmed: boolean;

  // attraction/expert mode (Screens 3A-3B)
  imageDescribed: boolean;
  provenanceCaptured: boolean;

  // shared tail (Screens 7-13)
  elementsDiscovered: boolean;
  creativeControlSet: boolean;
  roughScaleSet: boolean;
  compositionFlowDone: boolean;
  artisticFlowDone: boolean;
  avoidancesAsked: boolean;
  placementDone: boolean;
  designConfirmed: boolean;
  blueprintReady: boolean;
}

export function getNextScreen(p: JourneyProgress): ScreenId {
  if (p.manualPathActive) return "working_notes";
  if (p.blueprintReady) return "blueprint";
  if (!p.pastWelcome) return "welcome";
  if (!p.viewpointSelected) return "viewpoint";

  if (p.journey_mode === "full") {
    if (!p.storySubmitted) return "story";
    if (p.clarificationRequired && !p.clarificationShown) return "clarification";
    if (!p.themesSelected) return "meaning_reflection";
    if (!p.intentionConfirmed) return "intention_confirmation";
  } else if (p.journey_mode === "attraction" || p.journey_mode === "expert") {
    if (!p.imageDescribed) return "image_description";
    if (!p.provenanceCaptured) return "image_provenance";
  }

  // §7: "All modes converge at Screen 7 and share Screens 7 to 13 identically."
  if (!p.elementsDiscovered) return "elements_discovery";
  if (!p.creativeControlSet) return "creative_control";
  if (!p.roughScaleSet) return "rough_scale";
  if (!p.compositionFlowDone) return "composition_background";
  if (!p.artisticFlowDone) return "artistic_direction";
  if (!p.avoidancesAsked) return "avoidances";
  if (!p.placementDone) return "placement";
  if (!p.designConfirmed) return "design_confirmation";
  return "design_confirmation";
}

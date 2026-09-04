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
  | "correction"
  | "meaning_reflection"
  | "intention_confirmation"
  | "image_description"
  | "image_provenance"
  | "elements_discovery"
  | "creative_control"
  | "rough_scale"
  | "composition_background"
  | "style_reference"
  | "artistic_direction"
  | "avoidances"
  | "placement"
  | "design_confirmation"
  | "blueprint"
  | "working_notes";

/**
 * Runtime companion to the ScreenId union above -- needed wherever a screen
 * id has to be validated as actual data rather than just typechecked (e.g.
 * server/src/routes/analytics.ts's zod schema for anonymous step-timing
 * events). `satisfies readonly ScreenId[]` keeps this list honest against
 * the type union at compile time: adding/removing a ScreenId without
 * updating this array is a type error, not a silent runtime gap.
 */
export const SCREEN_IDS = [
  "welcome",
  "viewpoint",
  "story",
  "clarification",
  "correction",
  "meaning_reflection",
  "intention_confirmation",
  "image_description",
  "image_provenance",
  "elements_discovery",
  "creative_control",
  "rough_scale",
  "composition_background",
  "style_reference",
  "artistic_direction",
  "avoidances",
  "placement",
  "design_confirmation",
  "blueprint",
  "working_notes",
] as const satisfies readonly ScreenId[];

export interface JourneyProgress {
  journey_mode: JourneyMode;
  manualPathActive: boolean;
  pastWelcome: boolean;
  viewpointSelected: boolean;

  // full mode (Screens 3-6)
  storySubmitted: boolean;
  clarificationRequired: boolean;
  clarificationShown: boolean;
  /** §9.6 — true when the clarification response was anything but "resolving" (non_resolving, skipped, or off_topic). Only meaningful once clarificationShown is true. */
  lowConfidenceCorrectionNeeded: boolean;
  lowConfidenceCorrectionDone: boolean;
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
  /** §12.10 — the client was offered the chance to name a style/medium/tradition before Screen 11's dimension-by-dimension flow begins. */
  styleReferenceAsked: boolean;
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
    // §9.6: not a second clarification question -- the correction interaction, at most once.
    if (p.clarificationShown && p.lowConfidenceCorrectionNeeded && !p.lowConfidenceCorrectionDone) return "correction";
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
  if (!p.styleReferenceAsked) return "style_reference";
  if (!p.artisticFlowDone) return "artistic_direction";
  if (!p.avoidancesAsked) return "avoidances";
  if (!p.placementDone) return "placement";
  if (!p.designConfirmed) return "design_confirmation";
  return "design_confirmation";
}

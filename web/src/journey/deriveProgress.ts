import type { JourneyProgress } from "@positive-inking/engine";
import type { JourneyState } from "./state";

export function deriveProgress(state: JourneyState): JourneyProgress {
  const { project, ui } = state;
  return {
    journey_mode: project.journey_mode,
    manualPathActive: ui.manualPathActive,
    pastWelcome: ui.pastWelcome,
    viewpointSelected: ui.viewpointSelected,
    storySubmitted: ui.discoveryCompleted,
    clarificationRequired: project.confidence > 0 && project.confidence < 0.4 && project.visual_confidence < 0.6,
    clarificationShown: ui.clarificationShown,
    lowConfidenceCorrectionNeeded: ui.lowConfidenceCorrectionNeeded,
    lowConfidenceCorrectionDone: ui.lowConfidenceCorrectionDone,
    themesSelected: ui.themesSelected,
    intentionConfirmed: ui.intentionConfirmed,
    imageDescribed: ui.imageDescribed,
    provenanceCaptured: ui.provenanceCaptured,
    elementsDiscovered: ui.elementsDiscovered,
    creativeControlSet: ui.creativeControlSet,
    roughScaleSet: ui.roughScaleSet,
    compositionFlowDone: ui.compositionFlowDone,
    styleReferenceAsked: ui.styleReferenceAsked,
    artisticFlowDone: ui.artisticFlowDone,
    avoidancesAsked: ui.avoidancesAsked,
    placementDone: ui.placementDone,
    designConfirmed: ui.designConfirmed,
    blueprintReady: ui.blueprintReady,
  };
}

import {
  createEmptyProjectState,
  type ProjectState,
  type ArtisticDimensionKey,
  type CompositionQuestionKey,
} from "@positive-inking/engine";
import type { VisualCandidate, BlueprintData } from "../api/types";

export interface ApiErrorState {
  code: string;
  message: string;
  /** Which screen/action failed, so the retry button can re-trigger the right thing. */
  context: string;
}

export interface UIState {
  pastWelcome: boolean;
  viewpointSelected: boolean;

  /**
   * True only once Discovery has actually returned successfully. raw_story
   * itself is persisted to ProjectState immediately on submit, before the
   * network call (§16.1, AC 55) -- so it must NOT be used as the screen-
   * routing gate, or a pending/failed request would look "submitted" and
   * the journey would advance past the Story screen mid-request, orphaning
   * its error banner.
   */
  discoveryCompleted: boolean;
  clarificationShown: boolean;
  clarificationUsed: boolean;
  lowConfidenceCorrectionNeeded: boolean;
  lowConfidenceCorrectionDone: boolean;
  themesSelected: boolean;
  intentionConfirmed: boolean;

  imageDescribed: boolean;
  provenanceCaptured: boolean;

  elementsDiscovered: boolean;
  creativeControlSet: boolean;
  roughScaleSet: boolean;
  compositionFlowDone: boolean;
  artisticFlowDone: boolean;
  avoidancesAsked: boolean;
  placementDone: boolean;
  designConfirmed: boolean;
  blueprintReady: boolean;
  manualPathActive: boolean;

  /** §12.10: the client was offered the chance to name a style/medium/tradition, whether or not they used it. */
  styleReferenceAsked: boolean;
  /**
   * True only when a named style was recognised but under-specified (e.g. a
   * named artist whose work varies widely) and the client did not attach a
   * visual example when asked -- feeds ArtisticDirection's rendering_references
   * eligibility so a genuinely open question isn't silently dropped.
   */
  styleUnderSpecified: boolean;

  compositionAnswers: Partial<Record<CompositionQuestionKey, string>>;
  compositionBudgetSpent: number;
  artisticAnswers: Partial<Record<ArtisticDimensionKey, string>>;
  artisticBudgetSpent: number;
  designDensity: "" | "minimal" | "balanced" | "full";
  lowVisibilityPlacement: boolean;
  advancedControlsOpened: boolean;
  userIsTattooLiterate: boolean;

  associationCandidates: VisualCandidate[];
  avoidanceSuggestions: string[];

  /**
   * §15.7 note: this build has no server-side storage at all (no accounts,
   * no backend persistence beyond this browser's own localStorage) --
   * reference files live here as data URLs, keyed by the element/consent
   * record id they belong to. A real deployment would need actual
   * encrypted-at-rest storage and the 30-day-post-deletion policy §15.7
   * describes; this is a prototype-scale stand-in, not that.
   */
  referenceAssets: Record<string, { dataUrl: string; fileName: string }>;

  // Ephemeral Discovery output not persisted on ProjectState itself (§18 does
  // not carry raw interpretation text or the clarification question) but
  // needed by the next screen or two.
  discoveryInterpretation: string;
  discoveryThemeOptions: string[];
  discoveryCoreValueCandidates: string[];
  clarificationQuestion: string;
  clarificationSuggestedAnswers: string[];

  // Concept-classification flags from the Association Engine (§11), needed
  // as inputs to engine.computeConceptSignals downstream. Not first-class
  // ProjectState fields because they're only inputs to a derived value
  // (concept_shape), not part of the persisted project data model (§18).
  spatialLanguagePresent: boolean;
  hasTextOrHandwriting: boolean;
  hasLikeness: boolean;
  textIsPrimary: boolean;
  likenessIsPrimary: boolean;
  primaryElementType: "object" | "person" | "place" | "text" | "animal" | "abstract" | "mixed";

  loading: boolean;
  error: ApiErrorState | null;
  consecutiveFailures: number;

  blueprint: BlueprintData | null;
}

export interface JourneyState {
  project: ProjectState;
  ui: UIState;
}

export function createInitialJourneyState(): JourneyState {
  const now = new Date().toISOString();
  return {
    project: createEmptyProjectState(crypto.randomUUID(), now),
    ui: {
      pastWelcome: false,
      viewpointSelected: false,
      discoveryCompleted: false,
      clarificationShown: false,
      clarificationUsed: false,
      lowConfidenceCorrectionNeeded: false,
      lowConfidenceCorrectionDone: false,
      themesSelected: false,
      intentionConfirmed: false,
      imageDescribed: false,
      provenanceCaptured: false,
      elementsDiscovered: false,
      creativeControlSet: false,
      roughScaleSet: false,
      compositionFlowDone: false,
      artisticFlowDone: false,
      avoidancesAsked: false,
      placementDone: false,
      designConfirmed: false,
      blueprintReady: false,
      manualPathActive: false,
      styleReferenceAsked: false,
      styleUnderSpecified: false,
      compositionAnswers: {},
      compositionBudgetSpent: 0,
      artisticAnswers: {},
      artisticBudgetSpent: 0,
      designDensity: "",
      lowVisibilityPlacement: false,
      advancedControlsOpened: false,
      userIsTattooLiterate: false,
      associationCandidates: [],
      avoidanceSuggestions: [],
      referenceAssets: {},
      discoveryInterpretation: "",
      discoveryThemeOptions: [],
      discoveryCoreValueCandidates: [],
      clarificationQuestion: "",
      clarificationSuggestedAnswers: [],
      spatialLanguagePresent: false,
      hasTextOrHandwriting: false,
      hasLikeness: false,
      textIsPrimary: false,
      likenessIsPrimary: false,
      primaryElementType: "object",
      loading: false,
      error: null,
      consecutiveFailures: 0,
      blueprint: null,
    },
  };
}

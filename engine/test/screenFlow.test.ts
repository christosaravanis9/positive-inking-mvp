import { describe, it, expect } from "vitest";
import { getNextScreen, type JourneyProgress } from "../src/screenFlow.js";

function base(overrides: Partial<JourneyProgress> = {}): JourneyProgress {
  return {
    journey_mode: "full",
    manualPathActive: false,
    pastWelcome: true,
    viewpointSelected: true,
    storySubmitted: false,
    clarificationRequired: false,
    clarificationShown: false,
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
    ...overrides,
  };
}

describe("getNextScreen (§7-8 sequencing)", () => {
  it("starts at welcome, then viewpoint", () => {
    expect(getNextScreen(base({ pastWelcome: false, viewpointSelected: false }))).toBe("welcome");
    expect(getNextScreen(base({ pastWelcome: true, viewpointSelected: false }))).toBe("viewpoint");
  });

  it("full mode: story -> (clarification if required) -> meaning_reflection -> intention_confirmation", () => {
    expect(getNextScreen(base())).toBe("story");
    expect(getNextScreen(base({ storySubmitted: true, clarificationRequired: true }))).toBe("clarification");
    expect(getNextScreen(base({ storySubmitted: true, clarificationRequired: false }))).toBe("meaning_reflection");
    expect(getNextScreen(base({ storySubmitted: true, clarificationRequired: true, clarificationShown: true }))).toBe("meaning_reflection");
    expect(getNextScreen(base({ storySubmitted: true, themesSelected: true }))).toBe("intention_confirmation");
  });

  it("full mode never shows clarification once it has already been shown, even if still marked required (one-clarification rule)", () => {
    expect(
      getNextScreen(base({ storySubmitted: true, clarificationRequired: true, clarificationShown: true, themesSelected: false })),
    ).toBe("meaning_reflection");
  });

  it("attraction mode: image_description -> image_provenance, skipping full-mode screens entirely", () => {
    const attraction = base({ journey_mode: "attraction" });
    expect(getNextScreen(attraction)).toBe("image_description");
    expect(getNextScreen({ ...attraction, imageDescribed: true })).toBe("image_provenance");
  });

  it("expert mode follows the same 3A/3B path as attraction (AC 11: reaches element capture within two screens)", () => {
    const expert = base({ journey_mode: "expert" });
    expect(getNextScreen(expert)).toBe("image_description");
    expect(getNextScreen({ ...expert, imageDescribed: true, provenanceCaptured: true })).toBe("elements_discovery");
  });

  it("all modes converge at elements_discovery and share the tail identically (§7)", () => {
    const fullDone = base({ storySubmitted: true, themesSelected: true, intentionConfirmed: true });
    const attractionDone = base({ journey_mode: "attraction", imageDescribed: true, provenanceCaptured: true });
    expect(getNextScreen(fullDone)).toBe("elements_discovery");
    expect(getNextScreen(attractionDone)).toBe("elements_discovery");
  });

  it("walks the shared tail in order: creative_control -> rough_scale -> composition -> artistic -> avoidances -> placement -> design_confirmation", () => {
    const p = base({ storySubmitted: true, themesSelected: true, intentionConfirmed: true, elementsDiscovered: true });
    expect(getNextScreen(p)).toBe("creative_control");
    expect(getNextScreen({ ...p, creativeControlSet: true })).toBe("rough_scale");
    expect(getNextScreen({ ...p, creativeControlSet: true, roughScaleSet: true })).toBe("composition_background");
    expect(getNextScreen({ ...p, creativeControlSet: true, roughScaleSet: true, compositionFlowDone: true })).toBe("artistic_direction");
    expect(getNextScreen({ ...p, creativeControlSet: true, roughScaleSet: true, compositionFlowDone: true, artisticFlowDone: true })).toBe(
      "avoidances",
    );
    expect(
      getNextScreen({ ...p, creativeControlSet: true, roughScaleSet: true, compositionFlowDone: true, artisticFlowDone: true, avoidancesAsked: true }),
    ).toBe("placement");
    expect(
      getNextScreen({
        ...p,
        creativeControlSet: true,
        roughScaleSet: true,
        compositionFlowDone: true,
        artisticFlowDone: true,
        avoidancesAsked: true,
        placementDone: true,
      }),
    ).toBe("design_confirmation");
  });

  it("manual path always wins, regardless of any other progress", () => {
    expect(getNextScreen(base({ manualPathActive: true, storySubmitted: true, blueprintReady: true }))).toBe("working_notes");
  });

  it("blueprintReady shows the blueprint even if manualPathActive is false and other flags are stale", () => {
    expect(getNextScreen(base({ blueprintReady: true }))).toBe("blueprint");
  });
});

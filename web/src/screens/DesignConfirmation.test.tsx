import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState, type VisualElement, type ContradictionRecord } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { DesignConfirmation } from "./DesignConfirmation";

/**
 * Regression coverage for item #3 of the live-test report: Screen 13
 * ("Ready to build your Blueprint") read "Still needed: Nothing
 * outstanding" moments before the generated Blueprint's Readiness flagged
 * an unresolved contradiction. Investigation confirmed these are genuinely
 * different checks -- "Still needed" is specifically the §8
 * reference-checklist bullet, while the contradiction/hasUnresolvedPrimaryImagery
 * signals were already computed on this screen (for the
 * has_unresolved_contradiction sent to the server) but never displayed. No
 * new detection was needed, just surfacing what already existed -- these
 * tests lock in the new "Open decisions" row using describeReadinessReason's
 * own wording, so it can never silently drift from what Readiness says.
 */

function elementFixture(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "candidate-0",
    description: "A specific small object that belongs to your daughter",
    personal_meaning: "A concrete thing from your shared world",
    source_category: "personal_artefact",
    hierarchy: "primary",
    fidelity: "interpretive",
    colour_role: "undecided",
    reference_required: false,
    reference_status: "not_needed",
    origin: "system_suggestion",
    user_selected: true,
    concreteness: "concrete",
    ...overrides,
  };
}

function seedDesignConfirmationState(overrides: { visualElements?: VisualElement[]; contradictions?: ContradictionRecord[] }): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    visual_elements: overrides.visualElements ?? [elementFixture({})],
    contradictions: overrides.contradictions ?? [],
  };
  state.ui = {
    ...state.ui,
    pastWelcome: true,
    viewpointSelected: true,
    discoveryCompleted: true,
    themesSelected: true,
    intentionConfirmed: true,
    imageDescribed: true,
    provenanceCaptured: true,
    elementsDiscovered: true,
    creativeControlSet: true,
    roughScaleSet: true,
    compositionFlowDone: true,
    styleReferenceAsked: true,
    artisticFlowDone: true,
    avoidancesAsked: true,
    placementDone: true,
    designConfirmed: false,
    blueprintReady: false,
  };
  savePersistedState(state);
  return state;
}

describe("DesignConfirmation -- Open decisions row (regression: 'Nothing outstanding' vs. a post-Blueprint contradiction)", () => {
  it("shows 'None noted' when there is genuinely no unresolved contradiction or open primary imagery", () => {
    seedDesignConfirmationState({});
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.getByText("Open decisions").nextElementSibling!.textContent).toBe("None noted");
  });

  it("surfaces the actual contradiction even though 'Still needed' says nothing is outstanding -- the exact reported inconsistency", () => {
    seedDesignConfirmationState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo"] }],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    // "Still needed" is unaffected -- this fixture's element needs no reference.
    expect(screen.getByText("Still needed").nextElementSibling!.textContent).toBe("Nothing outstanding");
    // But "Open decisions" now tells the truth about the contradiction, instead
    // of the summary implying everything is clean.
    const openDecisions = screen.getByText("Open decisions").nextElementSibling!.textContent!;
    expect(openDecisions).toContain("An exact artefact is specified with no uploaded reference.");
    expect(openDecisions).toContain("Upload a reference photo");
  });

  it("surfaces unresolved primary imagery using the same wording Readiness will use", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ hierarchy: "primary", concreteness: "unresolved_placeholder" })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.getByText("Open decisions").nextElementSibling!.textContent).toContain(
      "One or more primary visual elements are still an open decision for the client, not yet a concrete idea.",
    );
  });
});

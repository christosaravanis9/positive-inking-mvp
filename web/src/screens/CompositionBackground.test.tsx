import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { CompositionBackground } from "./CompositionBackground";

/**
 * Regression coverage for the 2026-09-04 live-test bug -- the same pattern
 * as ArtisticDirection.tsx, and the one actually reproduced live via the
 * "What we've understood" panel's "Edit Composition" row: going back to this
 * screen after it was already fully answered only clears
 * ui.compositionFlowDone, never ui.compositionAnswers, so
 * evaluateCompositionFlow() re-runs against the same already-fully-answered
 * data and immediately returns nextToAsk: null again on render -- before
 * answer() (the only place that used to set compositionFlowDone) ever runs.
 * Fixed with a useEffect that auto-finalizes whenever the flow is already
 * fully resolved on render, not only via a click.
 */

const ALL_COMPOSITION_QUESTIONS_ANSWERED = {
  place_disambiguation: "subject",
  composition_type: "Isolated, no background",
  internal_background: "none",
  density: "balanced",
  negative_space: "generous_negative_space",
  reading_direction: "left_to_right",
  containment_vs_wrap: "contained",
  background_source: "natural",
} as const;

function seedFullyResolvedState(overrides: { compositionFlowDone?: boolean } = {}): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    journey_mode: "full",
    visual_elements: [
      {
        id: "candidate-0",
        description: "A small compass rose",
        personal_meaning: "Marks the direction she always pointed you toward",
        source_category: "personal_artefact",
        hierarchy: "primary",
        fidelity: "interpretive",
        colour_role: "undecided",
        reference_required: false,
        reference_status: "not_needed",
        origin: "system_suggestion",
        user_selected: true,
        concreteness: "concrete",
      },
    ],
  };
  state.ui = {
    ...state.ui,
    pastWelcome: true,
    viewpointSelected: true,
    discoveryCompleted: true,
    themesSelected: true,
    intentionConfirmed: true,
    elementsDiscovered: true,
    creativeControlSet: true,
    roughScaleSet: true,
    compositionAnswers: { ...ALL_COMPOSITION_QUESTIONS_ANSWERED },
    compositionFlowDone: overrides.compositionFlowDone ?? false,
  };
  savePersistedState(state);
  return state;
}

describe("CompositionBackground -- auto-finalizes when already fully resolved on render (2026-09-04 regression, the 'Edit Composition' re-trap)", () => {
  it("reaches the 'settled' render path (confirms the test setup reproduces the exact 'going back' scenario) and auto-sets compositionFlowDone without any click", () => {
    seedFullyResolvedState();
    render(
      <JourneyProvider>
        <CompositionBackground />
      </JourneyProvider>,
    );

    screen.getByText("Composition settled. Moving on...");
    expect(screen.queryByRole("button")).toBeNull();

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.compositionFlowDone).toBe(true);
  });

  it("is idempotent: does not error when compositionFlowDone is already true", () => {
    seedFullyResolvedState({ compositionFlowDone: true });
    render(
      <JourneyProvider>
        <CompositionBackground />
      </JourneyProvider>,
    );

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.compositionFlowDone).toBe(true);
  });

  it("still asks normally when the flow is genuinely NOT yet resolved -- the fix doesn't skip legitimate questions", () => {
    const state = createInitialJourneyState();
    state.project = {
      ...state.project,
      ...createEmptyProjectState(state.project.project_id, state.project.created_at),
      journey_mode: "full",
    };
    state.ui = {
      ...state.ui,
      pastWelcome: true,
      viewpointSelected: true,
      discoveryCompleted: true,
      themesSelected: true,
      intentionConfirmed: true,
      elementsDiscovered: true,
      creativeControlSet: true,
      roughScaleSet: true,
      // compositionAnswers deliberately left empty -- composition_type is always asked first.
    };
    savePersistedState(state);
    render(
      <JourneyProvider>
        <CompositionBackground />
      </JourneyProvider>,
    );

    screen.getByText("How should this come together?");
    expect(screen.queryByText("Composition settled. Moving on...")).toBeNull();
    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.compositionFlowDone).toBe(false);
  });
});

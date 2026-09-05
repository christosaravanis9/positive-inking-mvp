import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { ArtisticDirection } from "./ArtisticDirection";

/**
 * Regression coverage for the 2026-09-04 live-test bug: this screen's
 * "settled" fallback previously only ever got ui.artisticFlowDone set from
 * inside answer()'s own click handler. If evaluateArtisticDimensions()
 * already returns nextToAsk: null on the component's very first render
 * (e.g. a named style reference already resolved every eligible dimension),
 * no button ever rendered, answer() was never called, and the journey could
 * never advance -- a real, live-reproduced dead end (see
 * docs/PROJECT_STATUS.md). Fixed with a useEffect that auto-finalizes
 * whenever the flow is already fully resolved on render, not only via a
 * click.
 */

const ALL_ARTISTIC_DIMENSIONS_ANSWERED = {
  colour: "black_and_grey",
  realism: "illustrative",
  visual_presence: "clearly_present",
  linework: "structured",
  shading: "smooth_greywash",
  contrast: "balanced",
  surface_detail: "moderate",
  edge_treatment: "not_specified_left_to_artist",
  rendering_references: "not_specified",
} as const;

function seedFullyResolvedState(overrides: { artisticFlowDone?: boolean; hasExactFidelityHandwriting?: boolean } = {}): JourneyState {
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
        fidelity: overrides.hasExactFidelityHandwriting ? "exact" : "interpretive",
        colour_role: "undecided",
        reference_required: overrides.hasExactFidelityHandwriting ?? false,
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
    compositionFlowDone: true,
    styleReferenceAsked: true,
    artisticAnswers: { ...ALL_ARTISTIC_DIMENSIONS_ANSWERED },
    artisticFlowDone: overrides.artisticFlowDone ?? false,
  };
  savePersistedState(state);
  return state;
}

describe("ArtisticDirection -- auto-finalizes when already fully resolved on render (2026-09-04 regression)", () => {
  it("reaches the 'settled' render path (confirms the test setup actually reproduces the bug condition) and auto-sets artisticFlowDone without any click", () => {
    seedFullyResolvedState();
    render(
      <JourneyProvider>
        <ArtisticDirection />
      </JourneyProvider>,
    );

    // Confirms we're really on the settled fallback, not a normal question --
    // the bug's entire premise is that this path renders with nothing clickable.
    screen.getByText("Artistic direction settled. Moving on...");
    expect(screen.queryByRole("button")).toBeNull();

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.artisticFlowDone).toBe(true);
  });

  it("applies every already-resolved dimension's value to project state, exactly as answer() does for a click-driven finalization", () => {
    seedFullyResolvedState();
    render(
      <JourneyProvider>
        <ArtisticDirection />
      </JourneyProvider>,
    );

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.colour_strategy).toBe("black_and_grey");
    expect(stored.project.realism_level).toBe("illustrative");
    expect(stored.project.linework_weight).toBe("structured");
    expect(stored.project.shading_method).toBe("smooth_greywash");
  });

  it("is idempotent: does not error or infinite-loop when artisticFlowDone is already true", () => {
    seedFullyResolvedState({ artisticFlowDone: true });
    render(
      <JourneyProvider>
        <ArtisticDirection />
      </JourneyProvider>,
    );

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.artisticFlowDone).toBe(true);
  });

  it("does NOT auto-finalize while the fidelity-treatment question is still pending -- that prerequisite gate takes priority", () => {
    seedFullyResolvedState({ hasExactFidelityHandwriting: true });
    render(
      <JourneyProvider>
        <ArtisticDirection />
      </JourneyProvider>,
    );

    screen.getByText("How faithful should the reproduction be?");
    expect(screen.queryByText("Artistic direction settled. Moving on...")).toBeNull();
    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.artisticFlowDone).toBe(false);
  });
});

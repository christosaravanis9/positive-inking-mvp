import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import type { VisualCandidate } from "../api/types";
import { ElementsDiscovery } from "./ElementsDiscovery";

/**
 * Regression coverage for the live-test report: with no candidate selected,
 * adding a new idea that gets demoted to artist notes (§14's iteration-bound
 * demotion) left Continue disabled with no stated reason -- the person had
 * no way to tell what, if anything, would let them proceed. Fix keeps the
 * disable condition itself unchanged (artist notes are deliberately not a
 * design element) and instead makes the reason always visible whenever
 * Continue is disabled.
 */

function candidateFixture(overrides: Partial<VisualCandidate> = {}): VisualCandidate {
  return {
    description: "A small compass rose",
    personal_meaning: "Marks the direction she always pointed you toward",
    source_category: "personal_artefact",
    resolution_state: "concrete",
    personal_relevance: 0.8,
    story_relevance: 0.8,
    visual_potential: 0.8,
    originality: 0.6,
    genericity: 0.2,
    reference_availability: 0.5,
    ...overrides,
  };
}

function seedElementsDiscoveryState(overrides: { hasCandidates: boolean }): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    visual_elements: [],
    // Iteration number (idea_iteration_count + 1) already at the demotion threshold (>=6),
    // so the very next "Add" click demotes to artist_notes regardless of elapsed time.
    idea_iteration_count: 5,
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
    associationCandidates: overrides.hasCandidates ? [candidateFixture()] : [],
  };
  savePersistedState(state);
  return state;
}

describe("ElementsDiscovery -- Continue disabled with no stated reason (live-test regression)", () => {
  it("shows a stated reason instead of a silent dead-end when a new idea demotes to artist notes and no candidate is selected", () => {
    seedElementsDiscoveryState({ hasCandidates: true });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Describe the new idea"), {
      target: { value: "3d craft wire of her name under my skin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Exactly the reported behaviour: captured as an artist note, not a design element.
    screen.getByText(/Added to your artist notes/);

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    if (continueButton.disabled) {
      // Not stuck guessing: a clear, visible reason must be shown.
      screen.getByText("Select at least one starting point above, or add a new idea that becomes a design element, to continue.");
    } else {
      expect(continueButton.disabled).toBe(false);
    }
  });

  it("states the reason without referring to candidates when none were ever offered", () => {
    seedElementsDiscoveryState({ hasCandidates: false });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Describe the new idea"), {
      target: { value: "3d craft wire of her name under my skin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    screen.getByText(/Added to your artist notes/);
    screen.getByText("Add at least one idea that becomes a design element to continue — notes for the artist alone aren't enough to move forward.");
  });

  it("Continue is enabled with no message once a real idea is added (not demoted)", () => {
    const state = createInitialJourneyState();
    state.project = {
      ...state.project,
      ...createEmptyProjectState(state.project.project_id, state.project.created_at),
      visual_elements: [],
      idea_iteration_count: 0,
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
      associationCandidates: [candidateFixture()],
    };
    savePersistedState(state);

    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Describe the new idea"), {
      target: { value: "a small compass rose on the wrist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(screen.queryByText(/Select at least one starting point above/)).toBeNull();
  });
});

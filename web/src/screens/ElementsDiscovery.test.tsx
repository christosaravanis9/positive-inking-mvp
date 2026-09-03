import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import type { VisualCandidate } from "../api/types";
import { ElementsDiscovery } from "./ElementsDiscovery";

/**
 * Regression coverage for two live-test findings on Screen 7:
 *
 * 1. Continue disabled with no stated reason (fixed first): the disable
 *    condition never reflected an idea demoted to artist_notes, and the
 *    screen never said what would let the person proceed.
 *
 * 2. The monotonic demotion dead end (fixed second, the more serious bug):
 *    classifyIdeaIteration()'s two demotion triggers (iteration count >= 6,
 *    elapsed-time ratio > 1.5) are both monotonically increasing and never
 *    reset within a journey. A client who reached either threshold with
 *    zero real visual elements and zero candidates offered had NO path left
 *    to ever add a real element -- every subsequent "Add idea" would demote
 *    to notes forever. The fix: classifyIdeaIteration() now takes a
 *    `hasRealVisualElement` flag and never demotes while it's false: it
 *    protects against back-and-forth AFTER something real exists, not the
 *    very first element. This file's "core invariant" tests below are the
 *    ones that would have caught the original bug.
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

function seedElementsDiscoveryState(overrides: {
  hasCandidates: boolean;
  ideaIterationCount?: number;
  elapsedMinutesAgo?: number;
  visualElementsOverride?: ReturnType<typeof createEmptyProjectState>["visual_elements"];
}): JourneyState {
  const state = createInitialJourneyState();
  const createdAt =
    overrides.elapsedMinutesAgo !== undefined
      ? new Date(Date.now() - overrides.elapsedMinutesAgo * 60_000).toISOString()
      : state.project.created_at;
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, createdAt),
    created_at: createdAt,
    visual_elements: overrides.visualElementsOverride ?? [],
    idea_iteration_count: overrides.ideaIterationCount ?? 0,
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

function addIdea(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Describe the new idea"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

describe("ElementsDiscovery -- Continue disabled with no stated reason (live-test regression)", () => {
  it("states the reason (candidates offered) before anything is selected or added", () => {
    seedElementsDiscoveryState({ hasCandidates: true });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    screen.getByText("Select at least one starting point above, or add a new idea that becomes a design element, to continue.");
  });

  it("states the reason without referring to candidates when none were ever offered", () => {
    seedElementsDiscoveryState({ hasCandidates: false });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    screen.getByText("Add at least one idea that becomes a design element to continue — notes for the artist alone aren't enough to move forward.");
  });

  it("Continue is enabled with no message once a real idea is added", () => {
    seedElementsDiscoveryState({ hasCandidates: true });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    addIdea("a small compass rose on the wrist");

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(screen.queryByText(/Select at least one starting point above/)).toBeNull();
  });
});

describe("ElementsDiscovery -- core invariant: a real visual element is always reachable (live-test regression, the monotonic demotion dead end)", () => {
  it("past the 1.5x elapsed-time demotion threshold, with zero candidates and zero visual elements, 'Add idea' still produces a real element and enables Continue -- exactly the reported dead end", () => {
    // Default journey_mode "full" with 0 elements/no size_class targets 4 minutes (targetMinutesForJourney);
    // 10 minutes elapsed is well past the 1.5x-over-target demotion trigger.
    seedElementsDiscoveryState({ hasCandidates: false, ideaIterationCount: 0, elapsedMinutesAgo: 10 });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    addIdea("3d craft wire of her name under my skin");

    // The old bug: this would silently land in artist_notes forever, with no way back.
    expect(screen.queryByText(/Added to your artist notes/)).toBeNull();
    // The idea became a real, pending design element instead.
    screen.getByText("3d craft wire of her name under my skin");

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(screen.queryByText(/Add at least one idea/)).toBeNull();
  });

  it("past iteration 6, with zero real elements, 'Add idea' offers the ordinary scope reflection instead of a silent demotion -- confirming it produces a real element", () => {
    seedElementsDiscoveryState({ hasCandidates: false, ideaIterationCount: 9 });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    addIdea("a small compass rose");

    // Not demoted -- the ordinary iteration>=4 scope-reflection confirmation instead, which
    // (unlike demotion) always leaves the client a way to still add the idea for real.
    expect(screen.queryByText(/Added to your artist notes/)).toBeNull();
    screen.getByText(/worth checking they can all live at this size/);

    fireEvent.click(screen.getByRole("button", { name: "Add it anyway" }));

    screen.getByText("a small compass rose");
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
  });

  it("does NOT weaken the anti-thrash protection once a real visual element already exists -- demotion still triggers normally", () => {
    seedElementsDiscoveryState({
      hasCandidates: false,
      ideaIterationCount: 9,
      visualElementsOverride: [
        {
          id: "candidate-existing",
          description: "An existing confirmed element",
          personal_meaning: "Already part of the design",
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
    });
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    addIdea("a second idea after the anti-thrash threshold");

    // With a real element already on the table, the anti-thrash protection behaves
    // exactly as before this fix -- the new idea is captured as an artist note.
    screen.getByText(/Added to your artist notes/);
  });
});

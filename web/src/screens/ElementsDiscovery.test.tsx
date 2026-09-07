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

/**
 * Per-candidate re-roll (2026-09-07, client-only reserve-pool approach --
 * approved as decision 2's recommended fix over a real server round-trip,
 * specifically because it needs no new async/staleness guard: candidates
 * beyond the visible cap are already sitting in the one Association
 * response already fetched, so a re-roll is a synchronous local swap).
 */
function rankedCandidateFixtures(): VisualCandidate[] {
  // Descending scores so rankVisualCandidates' order matches array order
  // exactly -- index 0-2 land in the default visible top 3, 3-4 in reserve.
  return [0, 1, 2, 3, 4].map((n) =>
    candidateFixture({
      description: `Candidate ${n}`,
      personal_meaning: `Meaning ${n}`,
      personal_relevance: 1 - n * 0.15,
      story_relevance: 1 - n * 0.15,
      originality: 1 - n * 0.15,
    }),
  );
}

function seedRerollState(): JourneyState {
  const state = createInitialJourneyState();
  state.project = { ...state.project, ...createEmptyProjectState(state.project.project_id, state.project.created_at) };
  state.ui = {
    ...state.ui,
    pastWelcome: true,
    viewpointSelected: true,
    discoveryCompleted: true,
    themesSelected: true,
    intentionConfirmed: true,
    imageDescribed: true,
    provenanceCaptured: true,
    associationCandidates: rankedCandidateFixtures(),
  };
  savePersistedState(state);
  return state;
}

describe("ElementsDiscovery -- per-candidate re-roll (client-only reserve pool)", () => {
  it("shows only the top 3 candidates by default, with a re-roll affordance since reserve candidates exist", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    screen.getByText("Candidate 0");
    screen.getByText("Candidate 1");
    screen.getByText("Candidate 2");
    expect(screen.queryByText("Candidate 3")).toBeNull();
    expect(screen.queryByText("Candidate 4")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Not quite right? Try another idea" }).length).toBe(3);
  });

  it("re-rolling a slot swaps it for the next unused reserve candidate, in rank order", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not quite right? Try another idea" })[0]!);

    expect(screen.queryByText("Candidate 0")).toBeNull();
    screen.getByText("Candidate 3"); // the next reserve candidate, not Candidate 4
    screen.getByText("Candidate 1");
    screen.getByText("Candidate 2");
  });

  it("re-rolling a selected candidate also deselects it -- a swapped-out candidate must never silently stay confirmed", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    const rows = screen.getAllByRole("checkbox");
    fireEvent.click(rows[0]!); // select "Candidate 0"
    const stored1 = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored1.ui.associationCandidates).toBeDefined(); // sanity: state actually persisted

    fireEvent.click(screen.getAllByRole("button", { name: "Not quite right? Try another idea" })[0]!);

    // Candidate 3 (the replacement) must not appear pre-selected/expanded with
    // Candidate 0's old marginalia -- re-rolling clears that slot's selection.
    expect(screen.queryByText("Candidate 0")).toBeNull();
    const newCheckboxes = screen.getAllByRole("checkbox");
    expect((newCheckboxes[0] as HTMLInputElement).checked).toBe(false);
  });

  it("exhausting the reserve pool removes the re-roll affordance and explains why, once all candidates have been re-rolled through", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not quite right? Try another idea" })[0]!); // consumes Candidate 3
    fireEvent.click(screen.getAllByRole("button", { name: "Not quite right? Try another idea" })[0]!); // consumes Candidate 4, exhausts reserve

    expect(screen.queryByRole("button", { name: "Not quite right? Try another idea" })).toBeNull();
    expect(screen.getAllByText("No more alternatives to offer right now").length).toBeGreaterThan(0);
  });

  it("does not show any re-roll affordance when there is no reserve at all (candidate count <= the visible cap)", () => {
    const state = createInitialJourneyState();
    state.project = { ...state.project, ...createEmptyProjectState(state.project.project_id, state.project.created_at) };
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

    expect(screen.queryByRole("button", { name: "Not quite right? Try another idea" })).toBeNull();
    expect(screen.queryByText("No more alternatives to offer right now")).toBeNull();
  });

  it("keeps a re-rolled-in candidate visible after a remount if it was already confirmed as a visual element -- what the client chose must never silently disappear", () => {
    const state = seedRerollState();
    // Simulate: the client re-rolled slot 0 to "Candidate 3" and confirmed it,
    // then navigated away and back (a fresh mount, local component state reset).
    state.project = {
      ...state.project,
      visual_elements: [
        {
          id: "candidate-3",
          description: "Candidate 3",
          personal_meaning: "Meaning 3",
          source_category: "personal_artefact",
          hierarchy: "undecided",
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
    savePersistedState(state);
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    // Candidate 3 stays visible (seeded back into a slot) instead of reverting
    // to the default top-3 ranking, which would silently hide it.
    screen.getByText("Candidate 3");
  });
});

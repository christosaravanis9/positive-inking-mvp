import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
    screen.getByText("Keep or build upon at least one starting point above, or add a new idea that becomes a design element, to continue.");
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
 * Screen 7 redesign (2026-09-07): the old selection-radio + 4-button
 * fidelity row + text-link re-roll is replaced by one 3-state control per
 * candidate (Keep / Build upon / Not this one), 5 visible by default, and a
 * non-destructive per-slot history + pager -- "Not this one" either reveals
 * an already-generated later candidate for that slot for free, or -- only
 * once nothing further has been generated for it -- opens a "Why?" input.
 * Submitting that blank stays on the free client-only reserve-pool swap;
 * submitting a real reason is the one path that costs a real per-slot model
 * call (requestAssociationAlternative). Nothing already shown for a slot is
 * ever discarded -- paging back through it is always free.
 */
function rankedCandidateFixtures(count: number): VisualCandidate[] {
  // Descending scores so rankVisualCandidates' order matches array order
  // exactly -- index 0-4 land in the default visible top 5, the rest reserve.
  return Array.from({ length: count }, (_, n) =>
    candidateFixture({
      description: `Candidate ${n}`,
      personal_meaning: `Meaning ${n}`,
      personal_relevance: 1 - n * 0.1,
      story_relevance: 1 - n * 0.1,
      originality: 1 - n * 0.1,
    }),
  );
}

function seedRerollState(count = 7): JourneyState {
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
    associationCandidates: rankedCandidateFixtures(count),
  };
  savePersistedState(state);
  return state;
}

function alternativeResponseFixture(description: string) {
  return {
    data: {
      visual_candidates: [candidateFixture({ description, personal_meaning: `Meaning for ${description}` })],
      place_role: "none",
      place_role_reasoning: "",
      spatial_language_present: false,
      has_text_or_handwriting: false,
      has_likeness: false,
      text_is_primary: false,
      likeness_is_primary: false,
      primary_element_type: "object",
      contradictions_noticed: [],
    },
  };
}

describe("ElementsDiscovery -- Keep / Build upon / Not this one, non-destructive per-slot history", () => {
  it("shows 5 candidates by default, each with Keep/Build upon/Not this one controls", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    for (const n of [0, 1, 2, 3, 4]) screen.getByText(`Candidate ${n}`);
    expect(screen.queryByText("Candidate 5")).toBeNull();
    expect(screen.queryByText("Candidate 6")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Keep" }).length).toBe(5);
    expect(screen.getAllByRole("button", { name: "Build upon" }).length).toBe(5);
    expect(screen.getAllByRole("button", { name: "Not this one" }).length).toBe(5);
  });

  it("Keep marks a candidate active; clicking Keep again clears the decision", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    const keepButtons = screen.getAllByRole("button", { name: "Keep" });
    fireEvent.click(keepButtons[0]!);
    expect(keepButtons[0]!.className).toContain("active");

    fireEvent.click(keepButtons[0]!);
    expect(keepButtons[0]!.className).not.toContain("active");
  });

  it("Build upon marks a candidate active independently of Keep", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    const buildButtons = screen.getAllByRole("button", { name: "Build upon" });
    fireEvent.click(buildButtons[1]!);
    expect(buildButtons[1]!.className).toContain("active");
    expect(screen.getAllByRole("button", { name: "Keep" })[1]!.className).not.toContain("active");
  });

  it("'Not this one' opens a Why input with a concrete example placeholder, not just 'optional'", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    const input = screen.getByPlaceholderText(/too literal for what I'm going for/);
    expect(input).toBeTruthy();
  });

  it("a blank Why submission stays free: swaps in the next reserve candidate non-destructively, with a pager to page back to it", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));

    // Candidate 0 is not discarded -- it's paged past, not removed.
    expect(screen.queryByText("Candidate 0")).toBeNull();
    screen.getByText("Candidate 5"); // next reserve candidate, in rank order
    screen.getByText("2/2"); // pager now shows two entries for this slot

    fireEvent.click(screen.getByRole("button", { name: "Previous alternative for this slot" }));
    screen.getByText("Candidate 0"); // paging back is free and non-destructive
    screen.getByText("1/2");

    fireEvent.click(screen.getByRole("button", { name: "Next alternative for this slot" }));
    screen.getByText("Candidate 5");
  });

  it("'Not this one' works correctly on slot 4 and slot 5 specifically, not just the first 3 -- regression for the off-by-N bug reported live (2026-09-08): the reserve pool wasn't sized for 5 visible slots, so only the first couple of clicks anywhere on the screen actually re-rolled", () => {
    // 5 visible + 4 reserve so both slot 4 and slot 5 have their own free
    // reserve candidate available, independent of each other and of
    // whatever the first 3 slots consume.
    seedRerollState(9);
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    for (const n of [0, 1, 2, 3, 4]) screen.getByText(`Candidate ${n}`);

    // Slot 4 (index 3): "Not this one" -> blank submit must swap it, pulling
    // the first unused reserve candidate (the shared cursor starts at 0
    // regardless of which slot rerolls first).
    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[3]!);
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    expect(screen.queryByText("Candidate 3")).toBeNull();
    screen.getByText("Candidate 5"); // first unused reserve candidate

    // Slot 5 (index 4): "Not this one" -> blank submit must also swap it,
    // independently of slot 4's own swap above, pulling the next one.
    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[4]!);
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    expect(screen.queryByText("Candidate 4")).toBeNull();
    screen.getByText("Candidate 6");

    // Slots 1-3 were never touched -- confirms slot 4/5's re-roll didn't
    // somehow reroll the wrong slot instead.
    for (const n of [0, 1, 2]) screen.getByText(`Candidate ${n}`);
  });

  it("paging back and forth through history never calls the server", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous alternative for this slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Next alternative for this slot" }));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a Why reason typed past the end of history triggers exactly one real per-slot generation call, feeding the reason and prior descriptions into it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => alternativeResponseFixture("A hand-forged nail") });
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.change(screen.getByPlaceholderText(/too literal for what I'm going for/), {
      target: { value: "not keen on circles" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    await screen.findByText("A hand-forged nail");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/associations");
    const body = JSON.parse(init.body);
    expect(body.dismissal_reason).toBe("not keen on circles");
    // 2026-09-09: avoid_descriptions now also covers every candidate
    // currently visible in every OTHER slot on screen, not just this
    // slot's own history -- a fresh candidate must not duplicate or
    // closely echo something the client can already see elsewhere right
    // now. "Candidate 0" is this slot's own (still included); "Candidate
    // 1"-"Candidate 4" are the other four default-visible slots.
    expect(body.avoid_descriptions).toEqual(
      expect.arrayContaining(["Candidate 0", "Candidate 1", "Candidate 2", "Candidate 3", "Candidate 4"]),
    );
    expect(body.avoid_descriptions).toHaveLength(5);
    // Single-round rejection: the history is exactly this one reason.
    expect(body.dismissal_reason_history).toEqual(["not keen on circles"]);

    screen.getByText("2/2");
    vi.unstubAllGlobals();
  });

  it("exhausting the reserve pool: a blank submission is a no-op and the panel says so instead of silently upgrading to a real call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState(6); // 5 visible + exactly 1 reserve candidate

    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" })); // consumes the one reserve candidate
    screen.getByText("Candidate 5");

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!); // at end of history again, reserve now exhausted
    screen.getByText(/No more free alternatives left for this slot/);

    fireEvent.click(screen.getByRole("button", { name: "Show me something else" })); // blank submission -- must not call the model
    screen.getByText("Candidate 5"); // unchanged

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("'Never mind' cancels the Why input without changing the slot", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.change(screen.getByPlaceholderText(/too literal for what I'm going for/), { target: { value: "some reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Never mind" }));

    screen.getByText("Candidate 0");
    expect(screen.queryByPlaceholderText(/too literal for what I'm going for/)).toBeNull();
  });

  it("does not show a pager when a slot has only ever shown one candidate", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    expect(screen.queryByRole("button", { name: "Previous alternative for this slot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next alternative for this slot" })).toBeNull();
  });

  it("keeps a re-rolled-in candidate visible after a remount if it was already confirmed as a visual element -- what the client chose must never silently disappear", () => {
    const state = seedRerollState();
    // Simulate: the client re-rolled slot 0 to "Candidate 5" and confirmed it
    // (Keep), then navigated away and back (a fresh mount, local component
    // state reset).
    state.project = {
      ...state.project,
      visual_elements: [
        {
          id: "candidate-5",
          description: "Candidate 5",
          personal_meaning: "Meaning 5",
          source_category: "personal_artefact",
          hierarchy: "undecided",
          fidelity: "closely_based_on",
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

    // Candidate 5 stays visible (seeded back into a slot's history) instead of
    // reverting to the default top-5 ranking, which would silently hide it,
    // and it shows as Kept (matching its persisted "closely_based_on" fidelity).
    screen.getByText("Candidate 5");
    expect(screen.getAllByRole("button", { name: "Keep" })[0]!.className).toContain("active");
  });

  it("confirming Keep/Build-upon choices produces visual_elements with the right default fidelity, and no reference fields set on this screen anymore", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Keep" })[0]!); // Candidate 0 -> closely_based_on
    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[1]!); // Candidate 1 -> interpretive
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const kept = stored.project.visual_elements.find((e: { id: string }) => e.id === "candidate-0");
    const builtUpon = stored.project.visual_elements.find((e: { id: string }) => e.id === "candidate-1");
    expect(kept.fidelity).toBe("closely_based_on");
    expect(kept.reference_required).toBe(false);
    expect(kept.reference_status).toBe("not_needed");
    expect(builtUpon.fidelity).toBe("interpretive");
  });

  /**
   * Live-test report (2026-09-08): answering a needs_client_specific_detail
   * follow-up produced "a specific object tied to a shared memory —
   * specifically, no the tattoo artist ability" in Section 4 -- ungrammatical
   * because the old DETAIL_SEPARATOR (" — specifically, ") assumed the
   * client's free-typed answer would always read as a grammatical
   * continuation. It doesn't, and nothing constrains what a client types
   * into that plain text field. The fix closes the candidate's own sentence
   * first, then introduces the client's words as their own clause -- correct
   * regardless of what they typed.
   */
  function seedDetailAnswerState(): JourneyState {
    const state = createInitialJourneyState();
    state.project = { ...state.project, ...createEmptyProjectState(state.project.project_id, state.project.created_at) };
    const candidates = rankedCandidateFixtures(5);
    candidates[0] = {
      ...candidates[0]!,
      description: "a specific object tied to a shared memory",
      resolution_state: "needs_client_specific_detail",
      follow_up_prompt: "What object carries the most memory for you?",
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
      associationCandidates: candidates,
    };
    savePersistedState(state);
    return state;
  }

  it("composes a clean, grammatical description from a needs_client_specific_detail answer, whatever the client typed -- regression for the live-tested garbled Section 4 text", () => {
    seedDetailAnswerState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Keep" })[0]!);
    const input = screen.getByPlaceholderText("Optional");
    // The client's real, live-tested answer -- a fragment that does not read as a
    // grammatical continuation of the candidate description.
    fireEvent.change(input, { target: { value: "no the tattoo artist ability" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const element = stored.project.visual_elements.find((e: { id: string }) => e.id === "candidate-0");
    expect(element.description).toBe("a specific object tied to a shared memory. In your own words: no the tattoo artist ability");
    // The exact live-tested garbled fragment must never appear again.
    expect(element.description).not.toContain("— specifically,");
    // No doubled punctuation at the join, whatever the candidate description ends with.
    expect(element.description).not.toMatch(/\.\s*\./);
  });

  it("never doubles the terminal period when the candidate description already ends with one", () => {
    const state = createInitialJourneyState();
    state.project = { ...state.project, ...createEmptyProjectState(state.project.project_id, state.project.created_at) };
    const candidates = rankedCandidateFixtures(5);
    candidates[0] = {
      ...candidates[0]!,
      description: "A drawing you made as a kid, kept exactly as you drew it.",
      resolution_state: "needs_client_specific_detail",
      follow_up_prompt: "What object carries the most memory for you?",
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
      associationCandidates: candidates,
    };
    savePersistedState(state);
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Keep" })[0]!);
    const input = screen.getByPlaceholderText("Optional");
    fireEvent.change(input, { target: { value: "the drawing of our dog" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const element = stored.project.visual_elements.find((e: { id: string }) => e.id === "candidate-0");
    expect(element.description).toBe("A drawing you made as a kid, kept exactly as you drew it. In your own words: the drawing of our dog");
  });

  it("two different slots' blank re-rolls dispatched in the same tick (before either re-renders) never hand out the same reserve candidate -- the reserveCursor race reported live", () => {
    seedRerollState(); // 5 visible + 2 reserve: Candidate 5 and Candidate 6
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    // Open both slots' Why panels first (each is its own independent click).
    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Not this one" })[1]!);

    // Grab both buttons as real DOM element references BEFORE clicking --
    // both clicks below are batched into one synchronous pass with no
    // render committed between them, so a fresh getAllByRole() call inside
    // that pass would still see the pre-click DOM and could return the
    // same element twice.
    const [submitSlot0, submitSlot1] = screen.getAllByRole("button", { name: "Show me something else" });

    // Dispatch BOTH blank submissions inside one act() call -- this batches
    // both onClick handlers into a single synchronous pass with no render
    // committed in between, exactly reproducing "two rapid clicks before
    // React catches up." Before the fix, both read the same stale
    // reserveCursor closure value and both slots ended up showing the
    // identical candidate (confirmed live, then here).
    act(() => {
      fireEvent.click(submitSlot0!);
      fireEvent.click(submitSlot1!);
    });

    screen.getByText("Candidate 5");
    screen.getByText("Candidate 6");
    // The critical assertion: never the same reserve candidate shown twice.
    expect(screen.queryAllByText("Candidate 5").length).toBe(1);
    expect(screen.queryAllByText("Candidate 6").length).toBe(1);
  });
});

/**
 * "Build upon" direct-edit refinement (2026-09-07, later). Real user
 * testing found Keep/Build-upon differing only by color and Screen 13
 * default wasn't enough -- "Build upon" needed to actually DO something:
 * let the client edit the candidate's own text and send that edit back to
 * the model to develop further, replacing the slot's candidate through the
 * same non-destructive history mechanism "Not this one" already uses.
 */
function refinementResponseFixture(description: string) {
  return {
    data: {
      visual_candidates: [candidateFixture({ description, personal_meaning: `Meaning for ${description}` })],
      place_role: "none",
      place_role_reasoning: "",
      spatial_language_present: false,
      has_text_or_handwriting: false,
      has_likeness: false,
      text_is_primary: false,
      likeness_is_primary: false,
      primary_element_type: "object",
      contradictions_noticed: [],
    },
  };
}

describe("ElementsDiscovery -- 'Build upon' direct-edit refinement", () => {
  it("clicking Build upon reveals a textarea pre-filled with the candidate's current description, not blank", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    const textarea = screen.getByRole("textbox", { name: /Edit this idea directly/ }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Candidate 0");
  });

  it("the Refine button stays disabled until the text actually changes from the original -- never a wasted call on an unedited submission", () => {
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    const refineButton = screen.getByRole("button", { name: "Refine this idea" }) as HTMLButtonElement;
    expect(refineButton.disabled).toBe(true);

    const textarea = screen.getByRole("textbox", { name: /Edit this idea directly/ });
    fireEvent.change(textarea, { target: { value: "Candidate 0" } }); // re-typed the same text
    expect(refineButton.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "Candidate 0, but rougher and more hand-drawn" } });
    expect(refineButton.disabled).toBe(false);
  });

  it("submitting an edit sends both the original description and the edit to the model, replaces the slot's candidate, and carries the Build-upon decision forward", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => refinementResponseFixture("Candidate 0, but rougher") });
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    fireEvent.change(screen.getByRole("textbox", { name: /Edit this idea directly/ }), {
      target: { value: "Candidate 0, but rougher" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this idea" }));
    await screen.findByText("Candidate 0, but rougher");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/associations");
    const body = JSON.parse(init.body);
    expect(body.refine_original_description).toBe("Candidate 0");
    expect(body.refine_user_edit).toBe("Candidate 0, but rougher");
    expect(body.avoid_descriptions).toBeUndefined();
    expect(body.dismissal_reason).toBeUndefined();

    // The refined candidate replaces the slot (non-destructively -- pager below)
    // and is itself already marked Build upon, with no extra click needed.
    expect(screen.queryByText("Candidate 0")).toBeNull();
    screen.getByText("2/2");
    expect(screen.getAllByRole("button", { name: "Build upon" })[0]!.className).toContain("active");

    vi.unstubAllGlobals();
  });

  it("the pre-edit candidate remains reachable by paging back after a refinement -- nothing is discarded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => refinementResponseFixture("Candidate 0, but rougher") });
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    fireEvent.change(screen.getByRole("textbox", { name: /Edit this idea directly/ }), {
      target: { value: "Candidate 0, but rougher" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this idea" }));
    await screen.findByText("Candidate 0, but rougher");

    fireEvent.click(screen.getByRole("button", { name: "Previous alternative for this slot" }));
    screen.getByText("Candidate 0");
    screen.getByText("1/2");

    vi.unstubAllGlobals();
  });

  it("confirming after a refinement produces exactly one visual_element for that slot, not a ghost entry for the pre-edit candidate too", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => refinementResponseFixture("Candidate 0, but rougher") });
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    fireEvent.change(screen.getByRole("textbox", { name: /Edit this idea directly/ }), {
      target: { value: "Candidate 0, but rougher" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this idea" }));
    await screen.findByText("Candidate 0, but rougher");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const matchingElements = stored.project.visual_elements.filter((e: { description: string }) =>
      e.description.startsWith("Candidate 0"),
    );
    expect(matchingElements.length).toBe(1);
    expect(matchingElements[0].description).toBe("Candidate 0, but rougher");
    expect(matchingElements[0].fidelity).toBe("interpretive");

    vi.unstubAllGlobals();
  });

  it("Keep and Not this one are disabled while a refinement is in flight for that slot", async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    seedRerollState();
    render(
      <JourneyProvider>
        <ElementsDiscovery />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Build upon" })[0]!);
    fireEvent.change(screen.getByRole("textbox", { name: /Edit this idea directly/ }), {
      target: { value: "Candidate 0, but rougher" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this idea" }));

    expect((screen.getAllByRole("button", { name: "Keep" })[0]! as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: "Not this one" })[0]! as HTMLButtonElement).disabled).toBe(true);
    screen.getByText("Working on this idea...");

    resolveFetch({ ok: true, json: async () => refinementResponseFixture("Candidate 0, but rougher") });
    await screen.findByText("Candidate 0, but rougher");
    vi.unstubAllGlobals();
  });
});

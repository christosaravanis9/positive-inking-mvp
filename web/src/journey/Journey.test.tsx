import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "./JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "./state";
import { savePersistedState } from "./persistence";
import { Journey } from "./Journey";

vi.mock("../instrumentation/analytics", () => ({ reportScreenReached: vi.fn() }));
const { reportScreenReached } = await import("../instrumentation/analytics");

/**
 * Round-trip coverage for the "What we've understood" panel's click-to-edit
 * polish pass: each clickable row navigates back to its real source screen
 * using the app's existing Back/Edit mechanism (flip the source screen's own
 * gating ui flag back to false), and the source screen still shows the
 * already-confirmed answer once there, ready to edit -- not a blank form.
 */

function seedMidJourneyState(): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    journey_mode: "full",
    user_viewpoint: "past",
    raw_story: "A tattoo to remember my grandmother's garden.",
    confirmed_themes: ["memory", "growth"],
    statement_of_intention: "A tattoo to remember my grandmother's garden.",
    visual_elements: [
      {
        id: "candidate-0",
        description: "A small watering can",
        personal_meaning: "She always had one in hand",
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
    // Lands exactly on Screen 8 (CreativeControl) -- everything before it is done,
    // nothing after it is.
    creativeControlSet: false,
  };
  savePersistedState(state);
  return state;
}

describe("Journey -- 'What we've understood' panel click-to-edit round trip", () => {
  it("clicking the Story row navigates back to the Story screen, with the existing answer still there to edit", () => {
    seedMidJourneyState();
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );

    // Confirm we start mid-journey, past Story, not on it.
    expect(screen.queryByText("What do you want this tattoo to be about?")).toBeNull();

    // Both panel variants render simultaneously (CSS-only breakpoint toggle) -- either
    // instance's click does the same thing, so the first match is enough here.
    fireEvent.click(screen.getAllByRole("button", { name: "Edit Story" })[0]);

    screen.getByText("What do you want this tattoo to be about?");
    const textarea = screen.getByPlaceholderText("Start wherever the story begins…") as HTMLTextAreaElement;
    expect(textarea.value).toBe("A tattoo to remember my grandmother's garden.");
  });

  it("clicking the Viewpoint row navigates back to the Viewpoint screen -- the confirmed answer stays visible in the panel alongside it", () => {
    seedMidJourneyState();
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Viewpoint" })[0]);

    screen.getByText("Where does this tattoo come from?");
    // Viewpoint.tsx itself has no "currently selected" highlight, but the panel next to
    // it still shows the existing answer -- confirmed via the rail variant specifically,
    // since it's the one always visible regardless of viewport in this render.
    expect(document.querySelector(".understood-rail")!.textContent).toContain("Past");
  });

  it("going back to an earlier screen does not silently discard already-confirmed data for later screens -- matches existing Back/Edit behaviour exactly (no new invalidation logic)", () => {
    const state = seedMidJourneyState();
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Story" })[0]);

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    // Only the clicked row's own gating flag flipped.
    expect(stored.ui.discoveryCompleted).toBe(false);
    // Every other already-confirmed flag/field is untouched -- exactly what
    // DesignConfirmation's "Add references" / "Change something" already do today.
    expect(stored.ui.viewpointSelected).toBe(true);
    expect(stored.ui.themesSelected).toBe(true);
    expect(stored.ui.intentionConfirmed).toBe(true);
    expect(stored.ui.elementsDiscovered).toBe(true);
    expect(stored.project.confirmed_themes).toEqual(state.project.confirmed_themes);
    expect(stored.project.visual_elements).toEqual(state.project.visual_elements);
  });

  it("a row with no single clear source screen (Treatment) never renders a clickable affordance, even mid-journey", () => {
    const state = seedMidJourneyState();
    state.project = { ...state.project, realism_level: "illustrative", linework_weight: "structured" };
    savePersistedState(state);
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );

    expect(screen.queryAllByRole("button", { name: "Edit Treatment" })).toHaveLength(0);
  });
});

describe("Journey -- anonymous usage analytics wiring (step timing / funnel)", () => {
  beforeEach(() => {
    vi.mocked(reportScreenReached).mockClear();
  });

  it("fires once for the screen reached on mount, with no previous screen", () => {
    seedMidJourneyState();
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );

    expect(reportScreenReached).toHaveBeenCalledTimes(1);
    expect(reportScreenReached).toHaveBeenCalledWith("creative_control", null, null, "full");
  });

  it("fires again, naming both screens, when a click-to-edit row actually changes the current screen", () => {
    seedMidJourneyState();
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );
    vi.mocked(reportScreenReached).mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Story" })[0]);

    expect(reportScreenReached).toHaveBeenCalledTimes(1);
    const [screenArg, fromScreenArg, elapsedArg, journeyModeArg] = vi.mocked(reportScreenReached).mock.calls[0];
    expect(screenArg).toBe("story");
    expect(fromScreenArg).toBe("creative_control");
    expect(typeof elapsedArg).toBe("number");
    expect(elapsedArg).toBeGreaterThanOrEqual(0);
    expect(journeyModeArg).toBe("full");
  });

  it("does NOT fire again on a state update that doesn't change the current screen (e.g. typing in a field)", () => {
    const state = createInitialJourneyState();
    state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true };
    savePersistedState(state);
    render(
      <JourneyProvider>
        <Journey />
      </JourneyProvider>,
    );
    vi.mocked(reportScreenReached).mockClear();

    // Story.tsx's textarea is local component state (setText) until Continue is
    // clicked -- typing here never touches journeyState/the computed screen at all.
    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "typing, not navigating" } });

    expect(reportScreenReached).not.toHaveBeenCalled();
  });
});

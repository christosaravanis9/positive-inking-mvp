import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { UnderstandingPanel } from "./UnderstandingPanel";
import { UNDERSTANDING_PANEL_EMPTY_COPY, UNDERSTANDING_PANEL_FOOTER_COPY } from "../journey/understandingPanel";

function seedState(projectOverrides: Partial<ReturnType<typeof createEmptyProjectState>>): JourneyState {
  const state = createInitialJourneyState();
  state.project = { ...state.project, ...createEmptyProjectState(state.project.project_id, state.project.created_at), ...projectOverrides };
  savePersistedState(state);
  return state;
}

describe("UnderstandingPanel", () => {
  it("rail variant shows the §2.1 empty copy before any answer exists", () => {
    seedState({});
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="rail" />
      </JourneyProvider>,
    );
    screen.getByText(UNDERSTANDING_PANEL_EMPTY_COPY);
  });

  it("rail variant includes the exact §2.1 footer reassurance copy", () => {
    seedState({});
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="rail" />
      </JourneyProvider>,
    );
    screen.getByText(UNDERSTANDING_PANEL_FOOTER_COPY);
  });

  it("details variant never renders the footer copy -- §2.1: 'not shown inside the mobile <details> implementation'", () => {
    seedState({});
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="details" />
      </JourneyProvider>,
    );
    expect(screen.queryByText(UNDERSTANDING_PANEL_FOOTER_COPY)).toBeNull();
  });

  it("details variant's <summary> reads exactly 'What we've understood' (spec §1.3 breakpoint wording)", () => {
    seedState({});
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="details" />
      </JourneyProvider>,
    );
    const summary = screen.getByText("What we've understood");
    expect(summary.closest("details")).not.toBeNull();
  });

  it("renders a real confirmed field and reflects it accurately, sourced from actual journey state", () => {
    seedState({ user_viewpoint: "future", raw_story: "A tattoo to mark starting my own studio." });
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="rail" />
      </JourneyProvider>,
    );
    screen.getByText("Viewpoint");
    screen.getByText("Future");
    screen.getByText("Story");
    screen.getByText("A tattoo to mark starting my own studio.");
    expect(screen.queryByText(UNDERSTANDING_PANEL_EMPTY_COPY)).toBeNull();
  });

  it("never renders a row for a field that hasn't been confirmed yet", () => {
    seedState({ user_viewpoint: "past" });
    render(
      <JourneyProvider>
        <UnderstandingPanel variant="rail" />
      </JourneyProvider>,
    );
    expect(screen.queryByText("Meaning")).toBeNull();
    expect(screen.queryByText("Visual material")).toBeNull();
    expect(screen.queryByText("Placement")).toBeNull();
  });
});

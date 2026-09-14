import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { IntentionConfirmation } from "./IntentionConfirmation";

/**
 * 2026-09-11, live-requested: Statement of Inspiration redesigned as an
 * editorial-style pull quote with a speech-bubble tail (its own
 * .statement-quote/.statement-quote-text classes, styles.css) instead of
 * the shared .reflection-box also used by ImageProvenance.tsx and
 * MeaningReflection.tsx -- these tests lock in the new structure and that
 * the actual statement text is still rendered faithfully, unchanged.
 */

function seedIntentionConfirmationState(statement = "A tattoo that reminds you of why you're building this.") {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true, discoveryCompleted: true, themesSelected: true };
  state.project = { ...state.project, statement_of_intention: statement };
  savePersistedState(state);
  return state;
}

describe("IntentionConfirmation -- editorial quote redesign", () => {
  it("renders the statement inside the new .statement-quote structure, not the old shared .reflection-box", () => {
    seedIntentionConfirmationState();
    render(
      <JourneyProvider>
        <IntentionConfirmation />
      </JourneyProvider>,
    );

    expect(document.querySelector(".statement-quote")).not.toBeNull();
    expect(document.querySelector(".statement-quote-text")).not.toBeNull();
    expect(document.querySelector(".reflection-box")).toBeNull();
  });

  it("renders the real statement text faithfully, unchanged", () => {
    seedIntentionConfirmationState("A tattoo that reminds you of why you're building this, for your daughter.");
    render(
      <JourneyProvider>
        <IntentionConfirmation />
      </JourneyProvider>,
    );

    screen.getByText("A tattoo that reminds you of why you're building this, for your daughter.");
  });

  it("Continue and Edit this still work exactly as before -- the redesign is presentation-only", () => {
    const state = seedIntentionConfirmationState();
    render(
      <JourneyProvider>
        <IntentionConfirmation />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    let stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.intentionConfirmed).toBe(true);

    savePersistedState({ ...state, ui: { ...state.ui, intentionConfirmed: false } });
    fireEvent.click(screen.getByRole("button", { name: "Edit this" }));
    stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.themesSelected).toBe(false);
  });
});

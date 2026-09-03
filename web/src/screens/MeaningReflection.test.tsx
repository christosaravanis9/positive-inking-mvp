import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { MeaningReflection } from "./MeaningReflection";

/**
 * Regression coverage for the same silent-dead-end pattern fixed on Screen 7
 * (live-test report): Continue here is disabled whenever no theme is
 * selected, but nothing on screen said so -- the instructional copy above
 * the chips explains HOW to select, not THAT selection is required to
 * proceed. Fix adds a stated reason under Continue whenever it's disabled,
 * matching Screen 7's wording style.
 */

function seedMeaningReflectionState() {
  const state = createInitialJourneyState();
  state.ui = {
    ...state.ui,
    pastWelcome: true,
    viewpointSelected: true,
    discoveryCompleted: true,
    discoveryInterpretation: "An interpretation of the story.",
    discoveryThemeOptions: ["family", "loss", "resilience"],
    discoveryCoreValueCandidates: ["connection"],
  };
  savePersistedState(state);
  return state;
}

describe("MeaningReflection -- Continue disabled with no stated reason (live-test regression pattern)", () => {
  it("shows a stated reason when no theme is selected, instead of a silent dead end", () => {
    seedMeaningReflectionState();
    render(
      <JourneyProvider>
        <MeaningReflection />
      </JourneyProvider>,
    );

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    screen.getByText("Select at least one theme above to continue.");
  });

  it("the reason disappears and Continue enables once a theme is selected", () => {
    seedMeaningReflectionState();
    render(
      <JourneyProvider>
        <MeaningReflection />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByText("family"));

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(screen.queryByText("Select at least one theme above to continue.")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { Welcome } from "./Welcome";

/**
 * Privacy notice's "Age" section: an 18+ self-certification checkbox on the
 * entry screen -- no new screen, no ID collection, Continue disabled until
 * checked, and the confirmation persists like any other confirmed answer.
 */

function seedState(overrides: { ageConfirmed?: boolean } = {}): JourneyState {
  const state = createInitialJourneyState();
  if (overrides.ageConfirmed !== undefined) {
    state.ui = { ...state.ui, ageConfirmed: overrides.ageConfirmed };
  }
  savePersistedState(state);
  return state;
}

describe("Welcome -- 18+ confirmation checkbox", () => {
  it("Continue is disabled until the checkbox is checked", () => {
    seedState();
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );

    const button = screen.getByRole("button", { name: "Discover my tattoo" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "I confirm I am 18 or older." }));
    expect(button.disabled).toBe(false);
  });

  it("unchecking the box re-disables Continue", () => {
    seedState();
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "I confirm I am 18 or older." });
    fireEvent.click(checkbox);
    expect((screen.getByRole("button", { name: "Discover my tattoo" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(checkbox);
    expect((screen.getByRole("button", { name: "Discover my tattoo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("the confirmation is stored in the existing JourneyState/localStorage persistence -- a plain boolean, not a new subsystem", () => {
    seedState();
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "I confirm I am 18 or older." }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.ageConfirmed).toBe(true);
  });

  it("persists across a reload -- a returning, already-confirmed visitor sees the box pre-checked and Continue already enabled", () => {
    seedState({ ageConfirmed: true });
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );

    expect((screen.getByRole("checkbox", { name: "I confirm I am 18 or older." }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: "Discover my tattoo" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("clicking Continue while confirmed advances past Welcome -- pastWelcome flips, ageConfirmed itself is untouched", () => {
    seedState({ ageConfirmed: true });
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discover my tattoo" }));

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.pastWelcome).toBe(true);
    expect(stored.ui.ageConfirmed).toBe(true);
  });
});

// 2026-09-15, live-requested: real beta testers finished the journey
// expecting something other than a written document -- this states the
// actual deliverable plainly, up front, rather than letting it be
// discovered as a surprise at the end.
describe("Welcome -- Blueprint payoff pre-framing (2026-09-15)", () => {
  it("states plainly, up front, that the deliverable is a written brief, not a finished image", () => {
    seedState();
    render(
      <JourneyProvider>
        <Welcome />
      </JourneyProvider>,
    );
    screen.getByText(/a written creative brief for your artist/i);
    screen.getByText(/not a finished picture/i);
  });
});

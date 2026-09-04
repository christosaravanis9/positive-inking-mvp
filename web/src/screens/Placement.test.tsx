import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { Placement } from "./Placement";

/**
 * Privacy notice's "Photographs of other people" section: Placement.tsx has
 * two independent optional photo uploads (nearby-tattoo reference, placement
 * photograph) -- each gets its own rights-confirmation checkbox, since they
 * are genuinely separate uploads that could show different subjects.
 */

function seedState() {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true };
  savePersistedState(state);
  return state;
}

describe("Placement -- third-party photo rights checkboxes (two independent upload slots)", () => {
  it("both file inputs start disabled", () => {
    seedState();
    render(
      <JourneyProvider>
        <Placement />
      </JourneyProvider>,
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(2);
    for (const input of fileInputs) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });

  it("checking the nearby-tattoo checkbox enables only that upload, not the placement-photo one", () => {
    seedState();
    render(
      <JourneyProvider>
        <Placement />
      </JourneyProvider>,
    );

    const checkboxes = screen.getAllByRole("checkbox", { name: /I confirm I have the right to use this image/ });
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[0]);

    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(fileInputs[0].disabled).toBe(false);
    expect(fileInputs[1].disabled).toBe(true);
  });

  it("checking both checkboxes enables both uploads", () => {
    seedState();
    render(
      <JourneyProvider>
        <Placement />
      </JourneyProvider>,
    );

    for (const checkbox of screen.getAllByRole("checkbox", { name: /I confirm I have the right to use this image/ })) {
      fireEvent.click(checkbox);
    }

    for (const input of document.querySelectorAll('input[type="file"]')) {
      expect((input as HTMLInputElement).disabled).toBe(false);
    }
  });

  it("does not block the rest of the journey -- Continue only requires body area, uploads stay optional", () => {
    seedState();
    render(
      <JourneyProvider>
        <Placement />
      </JourneyProvider>,
    );

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true); // body area empty

    fireEvent.change(screen.getByPlaceholderText("Body area (e.g. left forearm)"), { target: { value: "left forearm" } });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

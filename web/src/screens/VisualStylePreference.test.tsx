import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { VisualStylePreference } from "./VisualStylePreference";

/**
 * The pre-qualifying visual-style question (2026-09) -- asked once, before
 * Association is ever called. Locks in: all 6 options render with their
 * client-facing labels, each writes the correct engine-side value, and
 * "Not sure" is stored as a real answer ("not_sure"), not left null/skipped --
 * ASSOCIATION_SYSTEM_PROMPT's biasing instruction depends on that distinction
 * (a stated lane biases generation toward it; "not_sure" spreads evenly).
 */

function seedState() {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true, discoveryCompleted: true, themesSelected: true, intentionConfirmed: true };
  savePersistedState(state);
  return state;
}

describe("VisualStylePreference", () => {
  it("renders all 6 options with client-facing labels, in plain language", () => {
    seedState();
    render(
      <JourneyProvider>
        <VisualStylePreference />
      </JourneyProvider>,
    );

    screen.getByText("Abstract & symbolic");
    screen.getByText("An object or image that represents the feeling, not the literal story");
    screen.getByText("Illustrative & narrative");
    screen.getByText("A scene that visually shows what happened");
    screen.getByText("Typography-based");
    screen.getByText("The story told through lettering or words as the design itself");
    screen.getByText("Comic-strip / panel style");
    screen.getByText("The story told across small linked panels");
    screen.getByText("Montage / collage");
    screen.getByText("Several images layered or combined into one composition");
    screen.getByText("Not sure");
    screen.getByText("Show me a mix");
  });

  it.each([
    ["Abstract & symbolic", "abstract_symbolic"],
    ["Illustrative & narrative", "illustrative_narrative"],
    ["Typography-based", "typography"],
    ["Comic-strip / panel style", "comic_strip"],
    ["Montage / collage", "montage_collage"],
    ["Not sure", "not_sure"],
  ] as const)("choosing '%s' stores visual_style_preference as '%s' and marks the question answered", (label, expected) => {
    seedState();
    render(
      <JourneyProvider>
        <VisualStylePreference />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByText(label).closest("button")!);

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.visual_style_preference).toBe(expected);
    expect(stored.ui.visualStylePreferenceSet).toBe(true);
  });

  it("'Not sure' is stored as a real answer, not left null -- it is not a skip", () => {
    seedState();
    render(
      <JourneyProvider>
        <VisualStylePreference />
      </JourneyProvider>,
    );

    fireEvent.click(screen.getByText("Not sure").closest("button")!);

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.visual_style_preference).not.toBeNull();
    expect(stored.project.visual_style_preference).toBe("not_sure");
  });
});

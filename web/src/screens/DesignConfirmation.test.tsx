import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createEmptyProjectState, type VisualElement, type ContradictionRecord } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { DesignConfirmation } from "./DesignConfirmation";

/**
 * Regression coverage for item #3 of the live-test report: Screen 13
 * ("Ready to build your Blueprint") read "Still needed: Nothing
 * outstanding" moments before the generated Blueprint's Readiness flagged
 * an unresolved contradiction. Investigation confirmed these are genuinely
 * different checks -- "Still needed" is specifically the §8
 * reference-checklist bullet, while the contradiction/hasUnresolvedPrimaryImagery
 * signals were already computed on this screen (for the
 * has_unresolved_contradiction sent to the server) but never displayed. No
 * new detection was needed, just surfacing what already existed -- these
 * tests lock in the new "Open decisions" row using describeReadinessReason's
 * own wording, so it can never silently drift from what Readiness says.
 */

function elementFixture(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "candidate-0",
    description: "A specific small object that belongs to your daughter",
    personal_meaning: "A concrete thing from your shared world",
    source_category: "personal_artefact",
    hierarchy: "primary",
    fidelity: "interpretive",
    colour_role: "undecided",
    reference_required: false,
    reference_status: "not_needed",
    origin: "system_suggestion",
    user_selected: true,
    concreteness: "concrete",
    ...overrides,
  };
}

function seedDesignConfirmationState(overrides: { visualElements?: VisualElement[]; contradictions?: ContradictionRecord[] }): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    visual_elements: overrides.visualElements ?? [elementFixture({})],
    contradictions: overrides.contradictions ?? [],
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
    elementsDiscovered: true,
    creativeControlSet: true,
    roughScaleSet: true,
    compositionFlowDone: true,
    styleReferenceAsked: true,
    artisticFlowDone: true,
    avoidancesAsked: true,
    placementDone: true,
    designConfirmed: false,
    blueprintReady: false,
  };
  savePersistedState(state);
  return state;
}

describe("DesignConfirmation -- Open decisions row (regression: 'Nothing outstanding' vs. a post-Blueprint contradiction)", () => {
  it("shows 'None noted' when there is genuinely no unresolved contradiction or open primary imagery", () => {
    seedDesignConfirmationState({});
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.getByText("Open decisions").nextElementSibling!.textContent).toBe("None noted");
  });

  it("surfaces the actual contradiction even though 'Still needed' says nothing is outstanding -- the exact reported inconsistency", () => {
    seedDesignConfirmationState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo"] }],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    // "Still needed" is unaffected -- this fixture's element needs no reference.
    expect(screen.getByText("Still needed").nextElementSibling!.textContent).toBe("Nothing outstanding");
    // But "Open decisions" now tells the truth about the contradiction, instead
    // of the summary implying everything is clean.
    const openDecisions = screen.getByText("Open decisions").nextElementSibling!.textContent!;
    expect(openDecisions).toContain("An exact artefact is specified with no uploaded reference.");
    expect(openDecisions).toContain("Upload a reference photo");
  });

  it("surfaces unresolved primary imagery using the same wording Readiness will use", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ hierarchy: "primary", concreteness: "unresolved_placeholder" })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.getByText("Open decisions").nextElementSibling!.textContent).toContain(
      "One or more primary visual elements are still an open decision for the client, not yet a concrete idea.",
    );
  });

  // 2026-09-09, live-reported (same bug as the Blueprint's Readiness section,
  // which this row must never drift apart from -- see the comment above
  // visualDirectionComponent's own lookup): "Possible next steps" previously
  // read as a run-on continuation of the contradiction description.
  it("renders 'Possible next steps' as its own distinct element within the Open decisions row, not glued onto the description", () => {
    seedDesignConfirmationState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo", "switch to an interpretive rendering"] }],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    const openDecisionsDd = screen.getByText("Open decisions").nextElementSibling!;
    const nextStepsEl = openDecisionsDd.querySelector("p");
    expect(nextStepsEl).not.toBeNull();
    // Singular "step" is correct: one contradiction's next step, offering
    // two options joined by "or" -- not two separate steps.
    expect(nextStepsEl!.textContent).toContain("Possible next step: Upload a reference photo, or switch to an interpretive rendering.");
    const descriptionOnly = openDecisionsDd.textContent!.replace(nextStepsEl!.textContent!, "");
    expect(descriptionOnly).not.toContain("Possible next steps");
  });
});

/**
 * Screen 7's redesign (2026-09-07) moved fidelity refinement + reference
 * collection to this screen, per confirmed candidate ("Keep"/"Build upon" --
 * every Association-sourced element, id "candidate-*"). Part 1's
 * investigation also found a real sequencing bug: screenFlow.ts runs
 * Screen 11 (where fidelity_treatment is normally asked) BEFORE this
 * screen, so an element that only becomes "exact" fidelity *here* would
 * otherwise reach the Blueprint with that question never asked. These
 * tests lock in both: the dropdown's reference-triggering behaviour, and
 * the fidelity_treatment re-check firing from this screen too.
 */
describe("DesignConfirmation -- per-candidate fidelity dropdown + fidelity_treatment re-check", () => {
  it("shows a fidelity dropdown, defaulted to the element's current fidelity, only for candidate-sourced elements", () => {
    seedDesignConfirmationState({
      visualElements: [
        elementFixture({ id: "candidate-0", description: "A compass rose", fidelity: "closely_based_on" }),
        elementFixture({ id: "idea-0", description: "A user-authored idea", fidelity: "open", origin: "visual_inspiration" }),
      ],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    const selects = screen.getAllByRole("combobox", { name: "Fidelity" }) as HTMLSelectElement[];
    expect(selects.length).toBe(1); // only the candidate-sourced element gets a dropdown here
    expect(selects[0]!.value).toBe("closely_based_on");
  });

  it("selecting a fidelity that needs a reference (exact/closely_based_on) reveals the reference attachment inline; interpretive/open does not", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ id: "candidate-0", description: "A compass rose", fidelity: "interpretive", reference_required: false })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.queryByLabelText("Attach a reference for A compass rose")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Fidelity" }), { target: { value: "exact" } });
    screen.getByLabelText("Attach a reference for A compass rose");

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const updated = stored.project.visual_elements.find((e: { id: string }) => e.id === "candidate-0");
    expect(updated.fidelity).toBe("exact");
    expect(updated.reference_required).toBe(true);
    expect(updated.reference_status).not.toBe("not_needed");

    fireEvent.change(screen.getByRole("combobox", { name: "Fidelity" }), { target: { value: "open" } });
    expect(screen.queryByLabelText("Attach a reference for A compass rose")).toBeNull();
    const stored2 = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    const updated2 = stored2.project.visual_elements.find((e: { id: string }) => e.id === "candidate-0");
    expect(updated2.reference_required).toBe(false);
    expect(updated2.reference_status).toBe("not_needed");
  });

  it("does not gate on fidelity_treatment when there is no exact-fidelity element", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ id: "candidate-0", fidelity: "interpretive" })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.queryByText("How faithful should the reproduction be?")).toBeNull();
    expect((screen.getByRole("button", { name: "Build my Blueprint" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gates the Build button on fidelity_treatment once an exact-fidelity element exists, re-running the same check Screen 11 already ran -- the sequencing-bug fix", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ id: "candidate-0", fidelity: "exact", reference_required: true, reference_status: "available" })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect((screen.getByRole("button", { name: "Build my Blueprint" }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByText("How faithful should the reproduction be?");

    fireEvent.click(screen.getByText("Exactly as written, including any shake, blot or unevenness"));

    expect(screen.queryByText("How faithful should the reproduction be?")).toBeNull();
    expect((screen.getByRole("button", { name: "Build my Blueprint" }) as HTMLButtonElement).disabled).toBe(false);
    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.fidelity_treatment).toBe("Exactly as written, including any shake, blot or unevenness");
  });

  it("selecting exact from the dropdown (not just an already-exact element) also triggers the fidelity_treatment gate", () => {
    seedDesignConfirmationState({
      visualElements: [elementFixture({ id: "candidate-0", description: "Her signature", fidelity: "interpretive" })],
    });
    render(
      <JourneyProvider>
        <DesignConfirmation />
      </JourneyProvider>,
    );

    expect(screen.queryByText("How faithful should the reproduction be?")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Fidelity" }), { target: { value: "exact" } });

    screen.getByText("How faithful should the reproduction be?");
    expect((screen.getByRole("button", { name: "Build my Blueprint" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

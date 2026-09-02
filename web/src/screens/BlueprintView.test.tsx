import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState, type VisualElement } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { BlueprintView } from "./BlueprintView";

/**
 * Regression coverage for a second live-test report on the same bug family
 * task #54 fixed (commit 8c3a7fa): "(undecided)" leaking into the rendered
 * Visual hierarchy section, and Readiness showing a bare label with no
 * reason. Investigation traced both symptoms to a stale pre-8c3a7fa build
 * being live-tested, not a surviving code defect -- byte-for-byte, they
 * match that commit's own OLD formatBlueprintAsText line
 * (`${e.description} (${e.hierarchy}) -- ${e.personal_meaning}`) and OLD
 * bare `section("Readiness", READINESS_LABEL[...])` call, neither of which
 * current code can produce. But `blueprintSummary.test.ts` only covers the
 * pure `visualElementSentence()`/`describeReadinessReason()` helpers in
 * isolation -- nothing exercised BlueprintView's actual rendered output,
 * which is the one thing that would catch a real regression where the
 * component stops calling those helpers (e.g. a future "simplification"
 * that goes back to reading `e.hierarchy` directly in the JSX). These
 * tests close that gap by rendering the real component tree.
 *
 * Section 4 was also restructured from one merged paragraph into a
 * decision map (Core concept / Personal reference / Other elements / Still
 * undecided) -- so "undecided" is now a legitimate, intentional heading
 * word, and the old blanket "the word 'undecided' never appears anywhere in
 * this section" assertion would be wrong on its own terms. What still must
 * never happen is the word appearing *tacked onto a specific element's own
 * line* (the actual bug shape); the tests below scope to that.
 */

function elementFixture(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "candidate-0",
    description:
      "A specific small object that belongs to your daughter or represents a shared activity or ritual between you -- specifically, a piece of wall art ive personally handmade for her of her name using craft wire and plaster fabric, but as a tattoo it could look like her name is emerging underneath my skin creating a smooth embossed/protruding script saying Athena",
    personal_meaning: "A concrete thing from your shared world that already carries the weight of connection",
    source_category: "personal_artefact",
    hierarchy: "undecided",
    fidelity: "closely_based_on",
    colour_role: "undecided",
    reference_required: true,
    reference_status: "to_upload",
    origin: "system_suggestion",
    user_selected: true,
    concreteness: "concrete",
    ...overrides,
  };
}

function seedBlueprintState(overrides: { visualElements?: VisualElement[]; contradictions?: string[] }): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    visual_elements: overrides.visualElements ?? [elementFixture({})],
    contradictions: overrides.contradictions ?? [],
  };
  state.ui = {
    ...state.ui,
    blueprintReady: true,
    designConfirmed: true,
    blueprint: {
      story: "A tattoo honouring the bond with my daughter.",
      why_this_image: "",
      why: "To honour the parent-child relationship, connection, and love between me and my daughter.",
      what_matters_most: "The personal connection to your daughter.",
      visual_direction: "A single emblem built around the handmade wall art motif.",
      artistic_direction: "A graphic, linework-forward style with no background.",
      placement: "Forearm, medium scale.",
      design_considerations: ["RECOMMENDATION: The exact script style for \"Athena\" is not yet confirmed and requires client decision or artist proposal."],
      statement_of_inspiration: "A piece of my daughter, carried with me.",
      artist_brief: "Render the handmade wall art motif as an embossed/protruding script reading Athena.",
      readiness: "needs_refinement",
    },
  };
  savePersistedState(state);
  return state;
}

describe("BlueprintView -- Visual hierarchy rendering (regression: raw '(undecided)' leak)", () => {
  it("never tacks the raw '(undecided)' hierarchy tag onto an unranked element's own line", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    // "undecided" is now a legitimate heading word ("Still undecided:"); what must
    // never happen is the exact old bug shape -- a parenthetical tag glued to an
    // element's description -- or the word appearing inside the element's own
    // Personal reference bullet.
    expect(section.textContent).not.toMatch(/\(undecided\)/i);
    const personalReferenceItem = screen.getByText("Personal reference:").closest("section")!.querySelector("ul li")!;
    expect(personalReferenceItem.textContent).not.toMatch(/\bundecided\b/i);
  });

  it("still surfaces personal_meaning as prose under Personal reference", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    expect(section.textContent).toContain("A concrete thing from your shared world that already carries the weight of connection");
  });

  it("shows a real hierarchy role label (not a raw enum) once an element is ranked", () => {
    seedBlueprintState({ visualElements: [elementFixture({ hierarchy: "primary" })] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    expect(section.textContent).toContain("Primary");
    // Once resolved, the element must no longer appear under "Still undecided".
    expect(screen.queryByText("Still undecided:")).toBeNull();
  });

  it("lists an unranked element under 'Still undecided' as its own labelled group, not merged into its description", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const stillUndecidedHeading = screen.getByText("Still undecided:");
    const stillUndecidedItem = stillUndecidedHeading.closest("section")!.querySelectorAll("ul")[1]!.querySelector("li")!;
    expect(stillUndecidedItem.textContent).toContain("A specific small object that belongs to your daughter");
  });

  it("partitions every element into Personal reference or Other elements -- an element made by the client that is not a personal source category still appears somewhere", () => {
    seedBlueprintState({
      visualElements: [elementFixture({ id: "idea-0", source_category: "new_materialisation", hierarchy: "primary", personal_meaning: "A new mark made for this project" })],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    expect(screen.queryByText("Personal reference:")).toBeNull();
    screen.getByText("Other elements:"); // throws if not found -- the element must be listed somewhere
    expect(section.textContent).toContain("A new mark made for this project");
  });
});

describe("BlueprintView -- Readiness reason rendering (regression: bare label with no reason)", () => {
  it("never shows 'Needs refinement' with nothing else -- always surfaces at least one reason", () => {
    seedBlueprintState({ contradictions: ["The script style is undecided but fidelity is closely_based_on."] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Needs refinement");
    // The bug report's exact symptom: the label with truly nothing after it.
    expect(section.textContent!.trim()).not.toBe("12. ReadinessNeeds refinement");
    expect(section.querySelectorAll("p.supporting").length).toBeGreaterThan(0);
  });

  it("names the actual contradiction signal as the reason, not a generic restatement", () => {
    seedBlueprintState({ contradictions: ["The script style is undecided but fidelity is closely_based_on."] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("A noted contradiction in the design is still unresolved.");
  });
});

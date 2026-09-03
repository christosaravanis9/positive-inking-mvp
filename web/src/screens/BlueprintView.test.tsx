import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState, type VisualElement, type ContradictionRecord } from "@positive-inking/engine";
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
 * A THIRD live-test report followed this decision-map restructure itself:
 * an element that was both personal and unranked appeared verbatim in BOTH
 * "Other elements" and "Still undecided" (groupVisualElementsForHierarchySection
 * originally treated stillUndecided as a cross-cutting overlay, not a
 * mutually-exclusive bucket), and "Still undecided" rendered bare
 * `e.description` instead of going through the same visualElementSentence()
 * composition "Personal reference"/"Other elements" already used. Both are
 * fixed in blueprintSummary.ts; the tests below assert each element now
 * appears in exactly one group, and that group always uses composed prose.
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

function seedBlueprintState(overrides: { visualElements?: VisualElement[]; contradictions?: ContradictionRecord[] }): JourneyState {
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

/** Counts how many times a needle string appears verbatim in a section's text. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("BlueprintView -- Visual hierarchy rendering (regression: raw '(undecided)' leak, then duplication)", () => {
  it("an unranked personal element appears only under 'Still undecided', not also under 'Personal reference'", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    expect(screen.queryByText("Personal reference:")).toBeNull();
    screen.getByText("Still undecided:"); // throws if not found
  });

  it("never duplicates one element's text across two groups -- the exact live-test regression", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    // The fixture's description contains a comma-free, distinctive substring safe to count.
    expect(occurrences(section.textContent!, "craft wire and plaster fabric")).toBe(1);
    expect(occurrences(section.textContent!, "A concrete thing from your shared world")).toBe(1);
  });

  it("never tacks the raw '(undecided)' hierarchy tag onto an unranked element's own line", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    expect(section.textContent).not.toMatch(/\(undecided\)/i);
    const stillUndecidedItem = screen.getByText("Still undecided:").closest("section")!.querySelector("ul li")!;
    expect(stillUndecidedItem.textContent).not.toMatch(/\bundecided\b/i);
  });

  it("still surfaces personal_meaning as composed prose under Still undecided -- not the bare raw description", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const stillUndecidedItem = screen.getByText("Still undecided:").closest("section")!.querySelector("ul li")!;
    expect(stillUndecidedItem.textContent).toContain("A specific small object that belongs to your daughter");
    expect(stillUndecidedItem.textContent).toContain("A concrete thing from your shared world that already carries the weight of connection");
  });

  it("shows a real hierarchy role label (not a raw enum) once an element is ranked, and it leaves 'Still undecided'", () => {
    seedBlueprintState({ visualElements: [elementFixture({ hierarchy: "primary" })] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "4. Visual hierarchy" }).closest("section")!;
    expect(section.textContent).toContain("Primary");
    expect(screen.queryByText("Still undecided:")).toBeNull();
    screen.getByText("Personal reference:"); // now resolved, so it's back in its category bucket
  });

  it("partitions every resolved element into Personal reference or Other elements -- an element made by the client that is not a personal source category still appears somewhere", () => {
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

describe("BlueprintView -- componentized Readiness (Sites migration spec §12/§4.2)", () => {
  it("renders all five component labels", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    for (const label of ["Meaning", "Visual direction", "References", "Artist discussion", "Final artwork"]) {
      expect(section.textContent).toContain(label);
    }
  });

  it("Meaning and Artist discussion are evidence-backed, not an unconditional label (Sites migration spec §4.3 defect 4) -- both read 'Not yet captured' when statement_of_intention/creative_control are genuinely unset", () => {
    seedBlueprintState({}); // seedBlueprintState's fixture never sets statement_of_intention or creative_control
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Not yet captured");
  });

  it("References reads 'None required for this concept', not 'Available to provide', when nothing in the concept needs one (Sites migration spec §4.3 defect 1)", () => {
    // The default fixture's element is closely_based_on/personal_artefact with no
    // material_type -- classifyReferenceFeatureKind resolves that to
    // interpretive_symbol, which referenceRequirementFor marks "optional",
    // so nothing here is required/strongly_recommended.
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("None required for this concept");
    expect(section.textContent).not.toContain("Available to provide");
  });

  it("References reads 'Still needed' and names the actual missing element when a required reference is outstanding", () => {
    seedBlueprintState({
      visualElements: [
        elementFixture({
          description: "A photo of your grandmother's hands",
          source_category: "personal_person",
          fidelity: "closely_based_on",
          reference_status: "to_upload",
        }),
      ],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Still needed");
    expect(section.textContent).toContain("A photo of your grandmother's hands");
  });

  it("Final artwork never claims artwork itself is ready to begin (Sites migration spec §4.3 defect 5) -- always says 'Not yet begun'", () => {
    seedBlueprintState({ contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo"] }] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Not yet begun");
    expect(section.textContent).not.toMatch(/ready to begin/i);
  });
});

describe("BlueprintView -- Readiness reason rendering (regression: bare label with no reason, then too-vague reason)", () => {
  it("never shows 'Needs refinement' with nothing else -- always surfaces at least one reason", () => {
    seedBlueprintState({ contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo"] }] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Needs refinement");
    // The bug report's exact symptom: the label with truly nothing after it.
    expect(section.textContent!.trim()).not.toBe("12. ReadinessNeeds refinement");
    expect(section.querySelectorAll("dd").length).toBeGreaterThan(0);
    expect(section.textContent).toContain("An exact artefact is specified with no uploaded reference.");
  });

  it("names the actual contradiction and its next step, not a generic restatement -- the second live-test regression", () => {
    seedBlueprintState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo", "switch to an interpretive rendering"] }],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "12. Readiness" }).closest("section")!;
    expect(section.textContent).toContain("An exact artefact is specified with no uploaded reference.");
    expect(section.textContent).toContain("Upload a reference photo");
    expect(section.textContent).toContain("switch to an interpretive rendering");
    expect(section.textContent).not.toContain("A noted contradiction in the design is still unresolved.");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createEmptyProjectState, type VisualElement, type ContradictionRecord, type ArtistBrief } from "@positive-inking/engine";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState, type JourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { BlueprintView, formatArtistBriefAsText } from "./BlueprintView";

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

function seedBlueprintState(overrides: {
  visualElements?: VisualElement[];
  contradictions?: ContradictionRecord[];
  project?: Partial<JourneyState["project"]>;
  artistBrief?: ArtistBrief;
}): JourneyState {
  const state = createInitialJourneyState();
  state.project = {
    ...state.project,
    ...createEmptyProjectState(state.project.project_id, state.project.created_at),
    visual_elements: overrides.visualElements ?? [elementFixture({})],
    contradictions: overrides.contradictions ?? [],
    ...overrides.project,
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
      artist_brief: overrides.artistBrief ?? {
        intro: "",
        confirmed_priorities: ["Render the handmade wall art motif as an embossed/protruding script reading Athena."],
        open_decisions: [],
        avoid: [],
        closing_notes: "",
      },
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

    // The default fixture's one element is still undecided -- so the heading itself
    // reads "Visual subjects being explored", not "Confirmed" (see the
    // visualSubjectsHeading describe block below for that behavior in isolation).
    const section = screen.getByRole("heading", { name: "Visual subjects being explored" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Visual subjects being explored" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Confirmed visual subjects" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Confirmed visual subjects" }).closest("section")!;
    expect(screen.queryByText("Personal reference:")).toBeNull();
    screen.getByText("Other elements:"); // throws if not found -- the element must be listed somewhere
    expect(section.textContent).toContain("A new mark made for this project");
  });
});

/**
 * Live-test report (2026-09-08): Section 4's heading read "Confirmed visual
 * subjects" even when every listed item was flagged "Still undecided" --
 * blueprintSummary.test.ts covers visualSubjectsHeading() itself in
 * isolation; these two close the same gap the file's own header comment
 * describes for the rest of Section 4 -- a regression where the component
 * stops calling the shared helper (e.g. reverts to the old hardcoded
 * string) would pass the pure-function tests but still ship the bug.
 */
describe("BlueprintView -- Section 4 heading reflects real confirmed/undecided state (live-test regression, 2026-09-08)", () => {
  it("reads 'Visual subjects being explored', never 'Confirmed', when nothing has a resolved hierarchy yet", () => {
    seedBlueprintState({}); // default fixture: one element, hierarchy "undecided"
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    screen.getByRole("heading", { name: "Visual subjects being explored" });
    expect(screen.queryByRole("heading", { name: "Confirmed visual subjects" })).toBeNull();
  });

  it("reads 'Confirmed visual subjects' once at least one element has a resolved hierarchy", () => {
    seedBlueprintState({ visualElements: [elementFixture({ hierarchy: "primary" })] });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    screen.getByRole("heading", { name: "Confirmed visual subjects" });
    expect(screen.queryByRole("heading", { name: "Visual subjects being explored" })).toBeNull();
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Needs refinement");
    // The bug report's exact symptom: the label with truly nothing after it.
    expect(section.textContent!.trim()).not.toBe("12ReadinessNeeds refinement");
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

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
    expect(section.textContent).toContain("An exact artefact is specified with no uploaded reference.");
    expect(section.textContent).toContain("Upload a reference photo");
    expect(section.textContent).toContain("switch to an interpretive rendering");
    expect(section.textContent).not.toContain("A noted contradiction in the design is still unresolved.");
  });

  // 2026-09-09, live-reported: "Possible next steps: ..." previously read as
  // one continuous run-on paragraph glued onto the same string as the
  // contradiction's own description -- indistinguishable as its own answer.
  it("renders 'Possible next steps' as its own distinct element, not appended onto the same string as the contradiction description", () => {
    seedBlueprintState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo", "switch to an interpretive rendering"] }],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
    const visualDirectionDt = [...section.querySelectorAll("dt")].find((dt) => dt.textContent === "Visual direction")!;
    const visualDirectionDd = visualDirectionDt.nextElementSibling!;
    // The description and the next-steps text must not sit in the same text
    // node/run -- a dedicated child element carries "Possible next steps",
    // proving it's structurally separate, not just visually styled apart.
    const nextStepsEl = visualDirectionDd.querySelector("p");
    expect(nextStepsEl).not.toBeNull();
    // Singular "step" is correct here: this is ONE contradiction's next step,
    // which happens to offer two options joined by "or" -- not two separate
    // steps. Pluralization is per-contradiction, not per-option.
    expect(nextStepsEl!.textContent).toContain("Possible next step:");
    expect(nextStepsEl!.textContent).toContain("Upload a reference photo, or switch to an interpretive rendering");
    // The description itself (outside that dedicated element) never carries
    // the "Possible next steps" text baked in.
    const descriptionOnly = visualDirectionDd.textContent!.replace(nextStepsEl!.textContent!, "");
    expect(descriptionOnly).not.toContain("Possible next steps");
  });

  it("singular 'Possible next step' (no trailing 's') when a contradiction has exactly one resolution", () => {
    seedBlueprintState({
      contradictions: [{ description: "An exact artefact is specified with no uploaded reference.", resolutions: ["Upload a reference photo"] }],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Possible next step: Upload a reference photo.");
    expect(section.textContent).not.toContain("Possible next steps:");
  });

  it("plural 'Possible next steps' when TWO SEPARATE contradictions each carry a next step -- pluralization is per-contradiction, not per-option within one", () => {
    seedBlueprintState({
      contradictions: [
        { description: "First contradiction.", resolutions: ["Do the first thing"] },
        { description: "Second contradiction.", resolutions: ["Do the second thing"] },
      ],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Readiness" }).closest("section")!;
    expect(section.textContent).toContain("Possible next steps: Do the first thing, or Do the second thing.");
  });
});

/**
 * Blueprint restructure to the Sites migration spec's §7 twelve-section information
 * architecture -- the final Sites-migration piece. Section 12 (Readiness) itself is
 * unchanged (task 2, above); this covers the new section order/numbering, the two new
 * deterministic sections (05 Composition, 06 Concept-specific decisions), and the two
 * "current quirks" spec §7 names for the Sites build, verified against this app's own
 * (different) architecture rather than assumed to reproduce here.
 */
describe("BlueprintView -- twelve-section restructure (Sites migration spec §7)", () => {
  it("renders every section heading in spec order, Readiness last", () => {
    seedBlueprintState({
      // A resolved element, not the default fixture's undecided one -- this test is
      // about section ORDER, orthogonal to visualSubjectsHeading's own confirmed-
      // vs-undecided behavior (covered separately below), so it uses "Confirmed
      // visual subjects" as its known-stable expected heading text.
      visualElements: [elementFixture({ hierarchy: "primary" })],
      project: {
        composition_type: "Isolated, no background",
        composition_background: "none",
        design_density: "minimal",
        colour_strategy: "selective",
        realism_level: "illustrative",
      },
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    const expectedOrder = [
      "Your story",
      "Your intention",
      "The design you're imagining",
      "Confirmed visual subjects",
      "Composition and arrangement",
      "Concept-specific decisions",
      "Artistic treatment",
      "Placement and body flow",
      "Essential safeguards",
      "References and open decisions",
      "Artist Brief",
      "Readiness",
    ];
    // Every expected heading is present, in this relative order (other real, non-spec
    // sections -- e.g. "Further ideas the client raised" -- may also appear, so this
    // checks a subsequence, not an exact match).
    const positions = expectedOrder.map((title) => headings.indexOf(title));
    expect(positions.every((p) => p !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(headings.at(-1)).toBe("Readiness");
  });

  it("renders statement_of_inspiration as a quote-box callout, not a thirteenth numbered section", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    screen.getByText("Statement of Inspiration");
    screen.getByText("A piece of my daughter, carried with me.");
    // Not one of the twelve numbered h3 sections -- a callout has no heading role.
    expect(screen.queryByRole("heading", { name: "Statement of Inspiration" })).toBeNull();
  });

  it("omits the quote-box callout entirely when statement_of_inspiration is empty", () => {
    const state = seedBlueprintState({});
    state.ui.blueprint = { ...state.ui.blueprint!, statement_of_inspiration: "" };
    savePersistedState(state);
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    expect(screen.queryByText("Statement of Inspiration")).toBeNull();
  });

  it("section 05 (Composition and arrangement) shows a deterministic fact line with no raw stored token", () => {
    seedBlueprintState({ project: { composition_type: "Framed scene", composition_background: "immersive", design_density: "full" } });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Composition and arrangement" }).closest("section")!;
    expect(section.textContent).toContain("Immersive background");
    expect(section.textContent).toContain("Full density");
    expect(section.textContent).not.toMatch(/\bimmersive\b|\bfull\b(?!\s+density)/);
  });

  it("section 06 (Concept-specific decisions) lists each confirmed dimension's question and labelled answer", () => {
    seedBlueprintState({ project: { colour_strategy: "black_and_grey", realism_level: "graphic", fidelity_treatment: "Exactly as written, including any shake, blot or unevenness" } });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Concept-specific decisions" }).closest("section")!;
    expect(section.textContent).toContain("How should colour work?");
    expect(section.textContent).toContain("Black and grey");
    expect(section.textContent).not.toMatch(/black_and_grey/);
    expect(section.textContent).toContain("Exactly as written, including any shake, blot or unevenness");
  });

  it("omits section 06 entirely when no dimension is confirmed and no fidelity treatment exists", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    expect(screen.queryByRole("heading", { name: "Concept-specific decisions" })).toBeNull();
  });

  it("section 09 (Essential safeguards) renders before section 10 (References and open decisions) -- repositioned from its old place after the Artist Brief", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf("Essential safeguards")).toBeLessThan(headings.indexOf("References and open decisions"));
    expect(headings.indexOf("Essential safeguards")).toBeLessThan(headings.indexOf("Artist Brief"));
  });

  it("section 09 uses the spec's own fallback line when avoidances were never asked, rather than an empty section", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "Essential safeguards" }).closest("section")!;
    expect(section.textContent).toContain("No additional exclusions were confirmed.");
  });

  it("section 10 folds the reference checklist and design_considerations' open decisions together", () => {
    seedBlueprintState({
      visualElements: [elementFixture({ source_category: "personal_person", fidelity: "closely_based_on", reference_status: "to_upload" })],
    });
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    const section = screen.getByRole("heading", { name: "References and open decisions" }).closest("section")!;
    expect(section.textContent).toContain("Open decisions:");
    expect(section.textContent).toContain('The exact script style for "Athena" is not yet confirmed');
  });

  it("offers a native print/save path (spec §7's 'Print or save Blueprint' footer action) -- this app had none before this task", () => {
    seedBlueprintState({});
    render(
      <JourneyProvider>
        <BlueprintView />
      </JourneyProvider>,
    );

    screen.getByRole("button", { name: "Print or save Blueprint" }); // throws if not found
  });

  /**
   * Sites migration spec §7's own two named "current quirks" -- verified against THIS
   * codebase's real architecture rather than assumed to reproduce. Neither's underlying
   * mechanism exists here: this app has no "design vision" verbatim-blockquote field at all
   * (confirmed absent from ProjectState during the earlier "What we've understood" panel task),
   * so there is no blockquote+fallback-interpretation pairing that could ever duplicate; and the
   * Artist Brief here is entirely model-written free prose (blueprint.artist_brief), never
   * assembled from an app-side "Develop a {scale} tattoo..." template, so there's no
   * article-agreement grammar to get wrong. These tests document that finding as a live
   * regression guard, not just a one-time investigation note.
   */
  describe("the two Sites-build 'current quirks' -- verified not to reproduce in this app's real architecture", () => {
    it("quirk 1 (verbatim design-vision text duplicated in two places on fallback): this app has no such field, so visual_direction's text is never rendered a second time anywhere else in the document", () => {
      seedBlueprintState({});
      render(
        <JourneyProvider>
          <BlueprintView />
        </JourneyProvider>,
      );

      const fullText = document.body.textContent!;
      const visualDirectionText = "A single emblem built around the handmade wall art motif.";
      expect(fullText.split(visualDirectionText).length - 1).toBe(1);
    });

    it("quirk 2 ('Develop a {scale} tattoo...' producing 'a expandable'): the Artist Brief is entirely model-authored prose here, never assembled by this app from a scale-prefixed template -- it is rendered verbatim, unmodified", () => {
      seedBlueprintState({});
      render(
        <JourneyProvider>
          <BlueprintView />
        </JourneyProvider>,
      );

      const section = screen.getByRole("heading", { name: "Artist Brief" }).closest("section")!;
      expect(section.textContent).toContain("Render the handmade wall art motif as an embossed/protruding script reading Athena.");
      // No app-side template ever prefixes it with "Develop a {scale}..." -- confirmed by grep
      // across the whole codebase finding zero `a ${...}`/`an ${...}` article-concatenation
      // patterns anywhere (the mechanism the Sites quirk depends on does not exist here).
    });
  });

  // 2026-09-09, live-reported: the Artist Brief used to render as one dense
  // paragraph with the model's own structure only expressed as inline dashes
  // -- genuinely hard to read. Now a structured object (ArtistBrief); these
  // lock in that each part gets its own real sub-section, not just that the
  // text appears somewhere in the section.
  describe("Artist Brief structure (2026-09-09, ArtistBrief restructure)", () => {
    it("renders confirmed priorities, open decisions and avoid as three separate labelled sub-sections, each its own list", () => {
      seedBlueprintState({
        artistBrief: {
          intro: "This is a collaborative project.",
          confirmed_priorities: ["The core idea is one continuous line.", "Composition is an isolated pair, no background."],
          open_decisions: ["Whether the final design is the single-line or three-panel version."],
          avoid: ["Placement across a joint, since bending would distort the progression."],
          closing_notes: "No reference images have been supplied for this design.",
        },
      });
      render(
        <JourneyProvider>
          <BlueprintView />
        </JourneyProvider>,
      );

      const section = screen.getByRole("heading", { name: "Artist Brief" }).closest("section")!;
      const columnHeadings = [...section.querySelectorAll(".artist-brief-column-heading")].map((el) => el.textContent);
      expect(columnHeadings).toEqual(["Confirmed priorities", "Open decisions", "Avoid"]);

      const columns = section.querySelectorAll(".artist-brief-column");
      expect(columns).toHaveLength(3);
      expect(columns[0]!.querySelectorAll("li")).toHaveLength(2);
      expect(columns[1]!.querySelectorAll("li")).toHaveLength(1);
      expect(columns[2]!.querySelectorAll("li")).toHaveLength(1);

      expect(section.querySelector(".artist-brief-intro")!.textContent).toBe("This is a collaborative project.");
      expect(section.querySelector(".artist-brief-closing-notes")!.textContent).toBe("No reference images have been supplied for this design.");
    });

    it("renders no column, and no empty grid, for a list the model left empty -- e.g. a client-led brief with nothing open", () => {
      seedBlueprintState({
        artistBrief: {
          intro: "",
          confirmed_priorities: ["A precise, non-negotiable requirement."],
          open_decisions: [],
          avoid: [],
          closing_notes: "",
        },
      });
      render(
        <JourneyProvider>
          <BlueprintView />
        </JourneyProvider>,
      );

      const section = screen.getByRole("heading", { name: "Artist Brief" }).closest("section")!;
      const columnHeadings = [...section.querySelectorAll(".artist-brief-column-heading")].map((el) => el.textContent);
      expect(columnHeadings).toEqual(["Confirmed priorities"]);
      expect(section.querySelector(".artist-brief-intro")).toBeNull();
      expect(section.querySelector(".artist-brief-closing-notes")).toBeNull();
    });

    it("the plain-text export helper renders the same four parts as clearly separated, labelled blocks -- never one run-on paragraph", () => {
      const text = formatArtistBriefAsText({
        intro: "This is a collaborative project.",
        confirmed_priorities: ["The core idea is one continuous line."],
        open_decisions: ["Whether the final design is the single-line or three-panel version."],
        avoid: ["Placement across a joint."],
        closing_notes: "No reference images have been supplied for this design.",
      });
      expect(text).toContain("This is a collaborative project.");
      expect(text).toContain("Confirmed priorities:\n- The core idea is one continuous line.");
      expect(text).toContain("Open decisions:\n- Whether the final design is the single-line or three-panel version.");
      expect(text).toContain("Avoid:\n- Placement across a joint.");
      expect(text).toContain("No reference images have been supplied for this design.");
      // Each block is separated by a blank line, not run together.
      expect(text.split("\n\n").length).toBeGreaterThanOrEqual(4);
    });

    it("the plain-text export helper omits an empty list's heading entirely, rather than printing a heading with nothing under it", () => {
      const text = formatArtistBriefAsText({
        intro: "",
        confirmed_priorities: ["A precise, non-negotiable requirement."],
        open_decisions: [],
        avoid: [],
        closing_notes: "",
      });
      expect(text).toContain("Confirmed priorities:\n- A precise, non-negotiable requirement.");
      expect(text).not.toContain("Open decisions:");
      expect(text).not.toContain("Avoid:");
    });
  });
});

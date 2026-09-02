import { describe, it, expect } from "vitest";
import { createEmptyProjectState, type ProjectState, type VisualElement } from "@positive-inking/engine";
import { buildConfirmedProjectSummary, visualElementSentence, REFERENCE_STATUS_LABEL, groupVisualElementsForHierarchySection } from "./blueprintSummary";

/**
 * Regression coverage for the Athena Blueprint incident: the summary sent to
 * the Blueprint Writer previously interpolated raw stored enum values
 * directly (e.g. "realism graphic", "client_led"), which is what produced
 * "Graphic realism style" and the "client-led ... collaborative"
 * contradiction -- the model was shown bare adjacent tokens with no
 * indication of which one names a dimension and which names one of several
 * alternative values for it, or what the creative-control token means.
 */

function projectFixture(overrides: Partial<ProjectState>): ProjectState {
  return { ...createEmptyProjectState("test-project", "2026-01-01T00:00:00.000Z"), ...overrides };
}

describe("buildConfirmedProjectSummary", () => {
  it("D: never sends a bare 'realism graphic' pair -- always a labelled 'Realism: Graphic'", () => {
    const summary = buildConfirmedProjectSummary(projectFixture({ realism_level: "graphic" }), []);
    expect(summary).toContain("Realism: Graphic");
    expect(summary).not.toMatch(/realism graphic\b/i);
  });

  it("D: never sends the bare client_led token -- names the term and its plain-English meaning together", () => {
    const summary = buildConfirmedProjectSummary(projectFixture({ creative_control: "client_led" }), []);
    expect(summary).toContain("client-led");
    expect(summary).not.toMatch(/\bclient_led\b/);
    // The plain-English meaning travels alongside the term, not as a bare token
    // the model has to interpret unaided.
    expect(summary).toMatch(/Creative control: client-led \(.+\)/);
  });

  it("no raw snake_case enum token leaks into the summary for any artistic dimension", () => {
    const summary = buildConfirmedProjectSummary(
      projectFixture({
        colour_strategy: "black_and_grey",
        realism_level: "illustrative",
        visual_presence: "clearly_present",
        linework_weight: "structured",
        shading_method: "smooth_greywash",
        contrast_level: "balanced",
      }),
      [],
    );
    expect(summary).not.toMatch(/black_and_grey|clearly_present|smooth_greywash/);
  });
});

/**
 * Regression coverage for the second live-test incident: the Blueprint
 * document's Visual hierarchy section stitched a raw "undecided" hierarchy
 * tag and personal_meaning directly onto the element description, producing
 * "...saying Athena undecided — A concrete thing that already carries the
 * weight of connection" for the "handmade wall art" scenario. This is the
 * same class of bug as buildConfirmedProjectSummary's raw-enum leak above,
 * just in the client-facing document instead of the model's input.
 */
function elementFixture(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "candidate-0",
    description: "A specific small object that belongs to your daughter or represents a shared activity or ritual between you",
    personal_meaning: "A concrete thing from your shared world that already carries the weight of connection",
    source_category: "personal_object",
    hierarchy: "undecided",
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

describe("visualElementSentence", () => {
  it("never surfaces the raw 'undecided' hierarchy tag -- the exact live-test regression", () => {
    const { description, roleLabel } = visualElementSentence(elementFixture({}));
    expect(roleLabel).toBeNull();
    expect(description).not.toMatch(/undecided/);
  });

  it("labels a resolved hierarchy role instead of the bare enum value", () => {
    const { roleLabel } = visualElementSentence(elementFixture({ hierarchy: "primary" }));
    expect(roleLabel).toBe("Primary");
  });

  it("still surfaces personal_meaning as a separate piece when it adds information", () => {
    const { meaning } = visualElementSentence(elementFixture({}));
    expect(meaning).toBe("A concrete thing from your shared world that already carries the weight of connection");
  });

  it("omits personal_meaning when it only duplicates the description", () => {
    const { meaning } = visualElementSentence(elementFixture({ personal_meaning: "A specific small object that belongs to your daughter or represents a shared activity or ritual between you" }));
    expect(meaning).toBeNull();
  });
});

describe("REFERENCE_STATUS_LABEL", () => {
  it("never leaves a raw snake_case status token to be shown to a client or artist", () => {
    for (const label of Object.values(REFERENCE_STATUS_LABEL)) {
      expect(label).not.toMatch(/_/);
    }
  });

  it("phrases 'to_upload' as what actually happened, not the bare enum word", () => {
    expect(REFERENCE_STATUS_LABEL.to_upload).toBe("Not yet uploaded");
  });
});

/**
 * Section 4's restructure into a decision map (item #3): every element must
 * land somewhere (personal vs. other are exhaustive and mutually exclusive
 * by source_category), and "still undecided" is a separate, cross-cutting
 * flag an element can carry regardless of which category bucket it's in --
 * this is what turns an unresolved hierarchy into its own visibly separate
 * list instead of a word buried mid-sentence (the root cause item #1b
 * investigation traced to a stale build, not live code -- but this locks in
 * the new structure's own correctness going forward).
 */
describe("groupVisualElementsForHierarchySection", () => {
  it("puts a personal-source element under 'personal', never 'other'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ source_category: "personal_artefact" })]);
    expect(groups.personal).toHaveLength(1);
    expect(groups.other).toHaveLength(0);
  });

  it("puts a non-personal-source element under 'other', never 'personal'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ source_category: "new_materialisation", hierarchy: "primary" })]);
    expect(groups.personal).toHaveLength(0);
    expect(groups.other).toHaveLength(1);
  });

  it("every element lands in exactly one of personal/other -- the partition is exhaustive", () => {
    const elements = [
      elementFixture({ id: "a", source_category: "personal_artefact" }),
      elementFixture({ id: "b", source_category: "public_artefact", hierarchy: "primary" }),
      elementFixture({ id: "c", source_category: "artistic_symbol", hierarchy: "accent" }),
    ];
    const groups = groupVisualElementsForHierarchySection(elements);
    expect(groups.personal.length + groups.other.length).toBe(elements.length);
  });

  it("'still undecided' is a cross-cutting flag independent of the personal/other bucket", () => {
    const groups = groupVisualElementsForHierarchySection([
      elementFixture({ id: "personal-undecided", source_category: "personal_artefact", hierarchy: "undecided" }),
      elementFixture({ id: "other-undecided", source_category: "new_materialisation", hierarchy: "undecided" }),
    ]);
    expect(groups.stillUndecided.map((e) => e.id).sort()).toEqual(["other-undecided", "personal-undecided"]);
  });

  it("a resolved element never appears under 'still undecided'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ hierarchy: "primary" })]);
    expect(groups.stillUndecided).toHaveLength(0);
  });
});

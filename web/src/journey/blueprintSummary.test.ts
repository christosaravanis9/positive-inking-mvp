import { describe, it, expect } from "vitest";
import { createEmptyProjectState, type ProjectState, type VisualElement } from "@positive-inking/engine";
import {
  buildConfirmedProjectSummary,
  visualElementSentence,
  REFERENCE_STATUS_LABEL,
  groupVisualElementsForHierarchySection,
  describeComposition,
  conceptSpecificDecisions,
} from "./blueprintSummary";

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
 * Section 4's restructure into a decision map (item #3): every element
 * lands in EXACTLY ONE of personal/other/stillUndecided, never more than
 * one. The first version of this grouping treated stillUndecided as a
 * cross-cutting flag an element could carry alongside its category bucket
 * -- which is exactly what produced a live-test duplication bug (one
 * personal, unranked element's full text appearing verbatim in both
 * "Other elements" and "Still undecided"). stillUndecided now takes
 * priority: an unranked element is flagged there and ONLY there; once
 * resolved, it moves into personal/other, which remain exhaustive and
 * mutually exclusive for resolved elements exactly as before.
 */
describe("groupVisualElementsForHierarchySection", () => {
  it("puts a resolved personal-source element under 'personal', never 'other' or 'stillUndecided'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ source_category: "personal_artefact", hierarchy: "primary" })]);
    expect(groups.personal).toHaveLength(1);
    expect(groups.other).toHaveLength(0);
    expect(groups.stillUndecided).toHaveLength(0);
  });

  it("puts a resolved non-personal-source element under 'other', never 'personal' or 'stillUndecided'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ source_category: "new_materialisation", hierarchy: "primary" })]);
    expect(groups.personal).toHaveLength(0);
    expect(groups.other).toHaveLength(1);
    expect(groups.stillUndecided).toHaveLength(0);
  });

  it("every resolved element lands in exactly one of personal/other -- the partition is exhaustive", () => {
    const elements = [
      elementFixture({ id: "a", source_category: "personal_artefact", hierarchy: "primary" }),
      elementFixture({ id: "b", source_category: "public_artefact", hierarchy: "primary" }),
      elementFixture({ id: "c", source_category: "artistic_symbol", hierarchy: "accent" }),
    ];
    const groups = groupVisualElementsForHierarchySection(elements);
    expect(groups.personal.length + groups.other.length).toBe(elements.length);
  });

  it("an unranked element -- personal or not -- appears in 'stillUndecided' ONLY, never also in 'personal' or 'other' -- the exact live-test duplication regression", () => {
    const personalUndecided = elementFixture({ id: "personal-undecided", source_category: "personal_artefact", hierarchy: "undecided" });
    const otherUndecided = elementFixture({ id: "other-undecided", source_category: "new_materialisation", hierarchy: "undecided" });
    const groups = groupVisualElementsForHierarchySection([personalUndecided, otherUndecided]);

    expect(groups.stillUndecided.map((e) => e.id).sort()).toEqual(["other-undecided", "personal-undecided"]);
    expect(groups.personal).toHaveLength(0);
    expect(groups.other).toHaveLength(0);
  });

  it("every element across all three groups appears exactly once total, whatever the mix of resolved and unranked", () => {
    const elements = [
      elementFixture({ id: "personal-resolved", source_category: "personal_artefact", hierarchy: "primary" }),
      elementFixture({ id: "personal-undecided", source_category: "personal_artefact", hierarchy: "undecided" }),
      elementFixture({ id: "other-resolved", source_category: "new_materialisation", hierarchy: "accent" }),
      elementFixture({ id: "other-undecided", source_category: "new_materialisation", hierarchy: "undecided" }),
    ];
    const groups = groupVisualElementsForHierarchySection(elements);
    const allIds = [...groups.personal, ...groups.other, ...groups.stillUndecided].map((e) => e.id);
    expect(allIds.sort()).toEqual(elements.map((e) => e.id).sort());
    // Exactly once each -- no id appears twice across the combined groups.
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("a resolved element never appears under 'still undecided'", () => {
    const groups = groupVisualElementsForHierarchySection([elementFixture({ hierarchy: "primary" })]);
    expect(groups.stillUndecided).toHaveLength(0);
  });
});

/**
 * Blueprint restructure (Sites migration spec §7): sections 05 (Composition and arrangement)
 * and 06 (Concept-specific decisions) are new, genuinely deterministic renderings of data this
 * app already collects (composition_type/composition_background/design_density; the confirmed
 * artistic-dimension answers) -- applying the same label-function discipline as
 * visualElementSentence/REFERENCE_STATUS_LABEL above, never raw-concatenating a stored token.
 * design_density in particular is stored as OptionChips' raw option VALUE ("minimal"), not its
 * label ("Minimal") -- confirmed by reading CompositionBackground.tsx's own onSelect wiring --
 * so this is the one place that decodes it back to prose.
 */
describe("describeComposition", () => {
  it("never leaves a raw composition_background/design_density token in the output", () => {
    const text = describeComposition(projectFixture({ composition_type: "Framed scene", composition_background: "immersive", design_density: "full" }));
    expect(text).not.toMatch(/\bimmersive\b/); // only "Immersive background" (capitalised label), not the bare stored token
    expect(text).not.toMatch(/\bfull\b/); // only "Full density"
    expect(text).toContain("Immersive background");
    expect(text).toContain("Full density");
  });

  it("labels a 'none' background as 'No background', not the bare stored token, when composition_type doesn't already say so", () => {
    const text = describeComposition(projectFixture({ composition_type: "Contained emblem", composition_background: "none" }));
    expect(text).toContain("No background");
    expect(text).not.toMatch(/composition_background|\bnone\b/);
  });

  it("falls back to the raw density token only if it's genuinely unrecognised, never silently to blank", () => {
    const text = describeComposition(projectFixture({ composition_type: "Framed scene", composition_background: "none", design_density: "some-future-value" }));
    expect(text).toContain("some-future-value density");
  });

  /**
   * Live-verification finding: composition_type's own label already states "no background" for
   * every COMPOSITION_POOLS option flagged noBackground: true (engine/src/composition.ts) --
   * without this check, a "none" composition_background repeated it a second time, rendering the
   * oddly comma-spliced "Isolated, no background, No background." on the real Blueprint.
   */
  it("never repeats 'no background' a second time when composition_type's own label already states it", () => {
    const text = describeComposition(projectFixture({ composition_type: "Isolated, no background", composition_background: "none" }));
    expect(text).toBe("Isolated, no background");
    expect(text.match(/no background/gi)?.length).toBe(1);
  });
});

describe("conceptSpecificDecisions", () => {
  it("pairs each confirmed dimension's question with its labelled answer, never a bare enum value", () => {
    const decisions = conceptSpecificDecisions(projectFixture({ colour_strategy: "selective", realism_level: "graphic" }));
    const colour = decisions.find((d) => d.key === "colour")!;
    expect(colour.question).toBe("How should colour work?");
    expect(colour.answer).toBe("Selective colour");
    const realism = decisions.find((d) => d.key === "realism")!;
    expect(realism.answer).toBe("Graphic");
    expect(decisions.map((d) => d.answer).join(" ")).not.toMatch(/selective\b|graphic\b/); // no lowercase raw token, only the capitalised label
  });

  /**
   * Live-verification finding: evaluateArtisticDimensions() can resolve edge_treatment to its own
   * engine-level default, the literal string "not_specified_left_to_artist"
   * (ARTISTIC_DIMENSION_DEFAULTS, engine/src/artisticDimensions.ts) -- which doesn't match any of
   * DIMENSION_OPTIONS.edge_treatment's three selectable values, so it fell through
   * labelForDimensionValue's fallback straight to the raw string. Nothing rendered edge_treatment
   * to a user before this section existed, so this was a real, previously-invisible leak, first
   * caught on the real rendered Blueprint ("How should edges feel? not_specified_left_to_artist").
   */
  it("labels the engine's own edge_treatment default ('not_specified_left_to_artist') instead of leaking the raw sentinel string", () => {
    const decisions = conceptSpecificDecisions(projectFixture({ edge_treatment: "not_specified_left_to_artist" }));
    const edge = decisions.find((d) => d.key === "edge_treatment")!;
    expect(edge.answer).toBe("Left to the artist");
    expect(edge.answer).not.toMatch(/not_specified/);
  });

  it("omits a dimension entirely when it has no confirmed value yet, rather than showing an empty answer", () => {
    const decisions = conceptSpecificDecisions(projectFixture({ colour_strategy: "selective" }));
    expect(decisions).toHaveLength(1);
    expect(decisions[0].key).toBe("colour");
  });

  it("never includes rendering_references -- its project field is shared with StyleReference's own free-text resolution, covered elsewhere", () => {
    const decisions = conceptSpecificDecisions(projectFixture({ style_reference: "traditional Japanese" }));
    expect(decisions.find((d) => d.key === "rendering_references")).toBeUndefined();
  });
});

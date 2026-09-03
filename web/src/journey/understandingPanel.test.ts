import { describe, it, expect } from "vitest";
import { createEmptyProjectState, type ProjectState, type VisualElement } from "@positive-inking/engine";
import { deriveUnderstandingRows } from "./understandingPanel";

function baseProject(overrides: Partial<ProjectState> = {}): ProjectState {
  return { ...createEmptyProjectState("p1", "2026-01-01T00:00:00.000Z"), ...overrides };
}

function elementFixture(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "candidate-0",
    description: "A photo of your grandmother's hands",
    personal_meaning: "Connection",
    source_category: "personal_person",
    hierarchy: "primary",
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

function rowMap(project: ProjectState): Record<string, string> {
  return Object.fromEntries(deriveUnderstandingRows(project).map((r) => [r.id, r.value]));
}

describe("deriveUnderstandingRows -- Sites migration spec §2.2", () => {
  it("empty/early state: an untouched project produces no rows at all", () => {
    expect(deriveUnderstandingRows(baseProject())).toEqual([]);
  });

  it("mid-journey partial state: only the fields confirmed so far appear, in the spec's field order", () => {
    const project = baseProject({
      user_viewpoint: "past",
      raw_story: "A tattoo for my grandmother, who taught me patience.",
      confirmed_themes: ["family", "patience"],
    });
    const rows = deriveUnderstandingRows(project);
    expect(rows.map((r) => r.id)).toEqual(["viewpoint", "story", "meaning"]);
  });

  it("late-journey full state: every applicable field is present and correctly valued", () => {
    const project = baseProject({
      user_viewpoint: "mixed",
      raw_story: "A tattoo for my grandmother, who taught me patience.",
      confirmed_themes: ["family", "patience"],
      visual_elements: [elementFixture({})],
      composition_type: "Main subject only",
      composition_background: "none",
      realism_level: "illustrative",
      linework_weight: "structured",
      shading_method: "smooth_greywash",
      colour_strategy: "black_and_grey",
      side: "left",
      body_area: "Forearm",
      size_class: "medium",
    });
    const rows = rowMap(project);
    expect(rows.viewpoint).toBe("A mixture");
    expect(rows.story).toBe("A tattoo for my grandmother, who taught me patience.");
    expect(rows.meaning).toBe("family · patience");
    expect(rows.visual_material).toBe("A photo of your grandmother's hands");
    expect(rows.composition).toBe("Main subject only (no background)");
    expect(rows.treatment).toBe("Illustrative · Structured · Smooth greywash · Black and grey");
    expect(rows.placement).toBe("left · Forearm · Medium");
  });

  describe("Viewpoint", () => {
    it("shows the exact chosen option's label", () => {
      for (const [raw, label] of [
        ["past", "Past"],
        ["present", "Present"],
        ["future", "Future"],
        ["mixed", "A mixture"],
        ["image", "An image I've been drawn to"],
      ] as const) {
        expect(rowMap(baseProject({ user_viewpoint: raw })).viewpoint).toBe(label);
      }
    });

    it("is omitted when no viewpoint has been chosen (e.g. the expert-mode skip, which clears it to null)", () => {
      expect(rowMap(baseProject({ user_viewpoint: null })).viewpoint).toBeUndefined();
    });
  });

  describe("Story", () => {
    it("shows the verbatim story when 105 characters or fewer", () => {
      const story = "A tattoo to remember a childhood dog named Scout.";
      expect(rowMap(baseProject({ raw_story: story })).story).toBe(story);
    });

    it("truncates to exactly 105 characters plus an ellipsis, no word-boundary handling", () => {
      const story = "x".repeat(120);
      const value = rowMap(baseProject({ raw_story: story })).story!;
      expect(value).toBe(`${"x".repeat(105)}…`);
      expect(value.length).toBe(106);
    });

    it("is omitted when raw_story is empty (e.g. attraction/expert mode, which never sets it)", () => {
      expect(rowMap(baseProject({ raw_story: "" })).story).toBeUndefined();
    });
  });

  describe("Meaning", () => {
    it("joins every confirmed theme with the exact separator, no truncation even when long", () => {
      const themes = Array.from({ length: 10 }, (_, i) => `theme-${i}`);
      expect(rowMap(baseProject({ confirmed_themes: themes })).meaning).toBe(themes.join(" · "));
    });

    it("is omitted before any theme is confirmed", () => {
      expect(rowMap(baseProject({ confirmed_themes: [] })).meaning).toBeUndefined();
    });
  });

  describe("Visual material", () => {
    it("joins every confirmed element's description, no truncation", () => {
      const project = baseProject({
        visual_elements: [elementFixture({ id: "candidate-0", description: "First element" }), elementFixture({ id: "candidate-1", description: "Second element" })],
      });
      expect(rowMap(project).visual_material).toBe("First element · Second element");
    });

    it("is omitted before any element is confirmed (Screen 7's own checkbox toggles are local state until Continue)", () => {
      expect(rowMap(baseProject({ visual_elements: [] })).visual_material).toBeUndefined();
    });
  });

  describe("Composition", () => {
    it("shows the composition type alone when a background exists", () => {
      expect(rowMap(baseProject({ composition_type: "Subject with subtle supporting elements", composition_background: "subtle" })).composition).toBe(
        "Subject with subtle supporting elements",
      );
    });

    it("appends '(no background)' when composition_background is none, matching Screen 13's own convention", () => {
      expect(rowMap(baseProject({ composition_type: "Main subject only", composition_background: "none" })).composition).toBe(
        "Main subject only (no background)",
      );
    });

    it("is omitted before a composition type is chosen", () => {
      expect(rowMap(baseProject({ composition_type: "" })).composition).toBeUndefined();
    });
  });

  describe("Treatment", () => {
    it("joins drawing/linework/shading/colour with the exact separator -- contrast is never included, matching the spec", () => {
      const project = baseProject({
        realism_level: "graphic",
        linework_weight: "light",
        shading_method: "minimal",
        contrast_level: "dramatic",
        colour_strategy: "full",
      });
      const value = rowMap(project).treatment!;
      expect(value).toBe("Graphic · Light · Minimal · Full colour");
      expect(value).not.toContain("Dramatic");
    });

    it("shows only whichever dimensions have been answered so far", () => {
      expect(rowMap(baseProject({ realism_level: "illustrative" })).treatment).toBe("Illustrative");
    });

    it("is omitted before any treatment dimension is answered", () => {
      expect(rowMap(baseProject({})).treatment).toBeUndefined();
    });
  });

  describe("Placement", () => {
    it("joins side, body area and scale with the exact separator", () => {
      expect(rowMap(baseProject({ side: "right", body_area: "Upper arm", size_class: "large" })).placement).toBe("right · Upper arm · Large");
    });

    it("falls back to body_area_coarse when the finer body_area hasn't been captured yet", () => {
      expect(rowMap(baseProject({ size_class: "small", body_area_coarse: "arm" })).placement).toBe("arm · Small");
    });

    it("is omitted before any placement field is captured", () => {
      expect(rowMap(baseProject({})).placement).toBeUndefined();
    });
  });

  it("never includes an 'Emerging vision' row -- no equivalent field exists in this app's real state (spec §2.3)", () => {
    const project = baseProject({
      user_viewpoint: "past",
      raw_story: "story",
      confirmed_themes: ["a"],
      visual_elements: [elementFixture({})],
      composition_type: "x",
      realism_level: "graphic",
      side: "left",
    });
    expect(deriveUnderstandingRows(project).map((r) => r.id)).not.toContain("emerging_vision");
  });
});

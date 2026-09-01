import { describe, it, expect } from "vitest";
import { buildWorkingNotes } from "../src/workingNotes.js";

describe("buildWorkingNotes (§16.3-16.4, AC 55/57)", () => {
  it("never loses the raw story, and is labelled Working Notes, never Blueprint", () => {
    const notes = buildWorkingNotes({
      raw_story: "It's for my brother, we grew up skating together.",
      elements: ["a skateboard", "our initials"],
      body_area_coarse: "arm",
      size_class: "medium",
      avoid_list: ["no skulls"],
      avoid_list_status: "asked_answered",
      creative_control: "collaborative",
    });

    expect(notes.label).toBe("Working Notes");
    expect(notes.story_verbatim).toBe("It's for my brother, we grew up skating together.");
    expect(notes.readiness).toBe("needs_refinement");
  });

  it("contains no interpretation, themes, or artistic direction fields at all -- structurally, not by omission", () => {
    const notes = buildWorkingNotes({
      raw_story: "story",
      elements: [],
      body_area_coarse: "",
      size_class: "",
      avoid_list: [],
      avoid_list_status: "not_asked",
      creative_control: "",
    });
    const keys = Object.keys(notes);
    for (const forbidden of ["interpretation", "themes", "core_values", "visual_hierarchy", "artistic_direction", "statement_of_intention"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("preserves the element list exactly as given, without adding hierarchy or meaning", () => {
    const notes = buildWorkingNotes({
      raw_story: "story",
      elements: ["a rose", "a date"],
      body_area_coarse: "leg",
      size_class: "small",
      avoid_list: [],
      avoid_list_status: "not_asked",
      creative_control: "",
    });
    expect(notes.elements).toEqual(["a rose", "a date"]);
  });
});

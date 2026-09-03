import { describe, it, expect } from "vitest";
import {
  classifyIdeaIteration,
  computeInvalidatedQuestions,
  canReaskThisIteration,
  elementReplacementQuestionRequired,
  targetMinutesForJourney,
} from "../src/newIdea.js";

describe("targetMinutesForJourney (§5 band mapping)", () => {
  it("attraction/expert always uses the shortest band", () => {
    expect(targetMinutesForJourney("attraction", 5, "large")).toBe(3);
    expect(targetMinutesForJourney("expert", 1, "small")).toBe(3);
  });

  it("a single small element uses the simple-quick-path band", () => {
    expect(targetMinutesForJourney("full", 1, "small")).toBe(4);
  });

  it("multiple elements use the personal/multi-element band", () => {
    expect(targetMinutesForJourney("full", 2, "medium")).toBe(6);
  });

  it("large or sleeve scale, or 4+ elements, use the large/immersive band regardless of the other", () => {
    expect(targetMinutesForJourney("full", 1, "large")).toBe(8);
    expect(targetMinutesForJourney("full", 4, "small")).toBe(8);
  });
});

describe("classifyIdeaIteration (§14)", () => {
  it("iterations 1-3 are full behaviour", () => {
    expect(classifyIdeaIteration(1, 0, true)).toBe("full");
    expect(classifyIdeaIteration(3, 0, true)).toBe("full");
  });

  it("iterations 4-5 add a scope reflection, regardless of hasRealVisualElement", () => {
    expect(classifyIdeaIteration(4, 0, true)).toBe("full_with_scope_reflection");
    expect(classifyIdeaIteration(5, 0, true)).toBe("full_with_scope_reflection");
    expect(classifyIdeaIteration(4, 0, false)).toBe("full_with_scope_reflection");
  });

  it("iteration 6+ demotes to artist notes when a real visual element already exists", () => {
    expect(classifyIdeaIteration(6, 0, true)).toBe("demoted_to_notes");
    expect(classifyIdeaIteration(10, 0, true)).toBe("demoted_to_notes");
  });

  it("demotes early when elapsed time exceeds target band by more than 50%, regardless of iteration count, when a real visual element already exists", () => {
    expect(classifyIdeaIteration(1, 1.6, true)).toBe("demoted_to_notes");
    expect(classifyIdeaIteration(1, 1.5, true)).toBe("full");
  });

  describe("core invariant: never demote when zero real visual elements exist yet (live-test regression)", () => {
    it("iteration 6+ never demotes with no real visual element yet -- falls back to the ordinary iteration>=4 scope reflection instead, never a hard block", () => {
      expect(classifyIdeaIteration(6, 0, false)).toBe("full_with_scope_reflection");
      expect(classifyIdeaIteration(10, 0, false)).toBe("full_with_scope_reflection");
    });

    it("elapsed time past 1.5x target never demotes with no real visual element yet -- falls back to full instead, below the separate iteration>=4 threshold", () => {
      expect(classifyIdeaIteration(1, 1.6, false)).toBe("full");
      expect(classifyIdeaIteration(1, 5, false)).toBe("full");
    });

    it("both triggers firing at once still never demotes with no real visual element yet", () => {
      expect(classifyIdeaIteration(10, 5, false)).toBe("full_with_scope_reflection");
    });

    it("the moment a real visual element exists, both triggers resume demoting normally -- the anti-thrash protection is not weakened once something real is on the table", () => {
      expect(classifyIdeaIteration(6, 0, true)).toBe("demoted_to_notes");
      expect(classifyIdeaIteration(1, 1.6, true)).toBe("demoted_to_notes");
    });
  });
});

describe("computeInvalidatedQuestions (§14.1)", () => {
  it("re-invalidates composition type only when concept_shape changed", () => {
    const result = computeInvalidatedQuestions(
      { concept_shape_changed: true, element_count_crossed_one_to_many: false, likeness_or_place_introduced: false, background_was_none_now_scenic: false },
      { density_previously_skipped: false, realism_previously_skipped_or_defaulted: false },
    );
    expect(result.composition_type).toBe(true);
    expect(result.density).toBe(false);
  });

  it("re-invalidates density only when element count crosses 1->2+ AND density was previously skipped", () => {
    const crossedButNotSkipped = computeInvalidatedQuestions(
      { concept_shape_changed: false, element_count_crossed_one_to_many: true, likeness_or_place_introduced: false, background_was_none_now_scenic: false },
      { density_previously_skipped: false, realism_previously_skipped_or_defaulted: false },
    );
    expect(crossedButNotSkipped.density).toBe(false);

    const crossedAndSkipped = computeInvalidatedQuestions(
      { concept_shape_changed: false, element_count_crossed_one_to_many: true, likeness_or_place_introduced: false, background_was_none_now_scenic: false },
      { density_previously_skipped: true, realism_previously_skipped_or_defaulted: false },
    );
    expect(crossedAndSkipped.density).toBe(true);
  });

  it("background decision must always be re-asked when scenic material appears after a no-background choice, never silently overridden (AC 46)", () => {
    const result = computeInvalidatedQuestions(
      { concept_shape_changed: false, element_count_crossed_one_to_many: false, likeness_or_place_introduced: false, background_was_none_now_scenic: true },
      { density_previously_skipped: false, realism_previously_skipped_or_defaulted: false },
    );
    expect(result.background_decision).toBe(true);
  });

  it("nothing is invalidated when no trigger fires -- no re-asking for consistency's sake", () => {
    const result = computeInvalidatedQuestions(
      { concept_shape_changed: false, element_count_crossed_one_to_many: false, likeness_or_place_introduced: false, background_was_none_now_scenic: false },
      { density_previously_skipped: true, realism_previously_skipped_or_defaulted: true },
    );
    expect(Object.values(result).every((v) => v === false)).toBe(true);
  });
});

describe("canReaskThisIteration (AC 47 — no question re-asked more than once per iteration)", () => {
  it("allows a question not yet re-asked this iteration", () => {
    expect(canReaskThisIteration("composition_type", [])).toBe(true);
  });

  it("blocks a question already re-asked this iteration", () => {
    expect(canReaskThisIteration("composition_type", ["composition_type"])).toBe(false);
  });
});

describe("elementReplacementQuestionRequired (§14.2, AC 45)", () => {
  it("only ever signals a question to ask -- never a decision to remove", () => {
    expect(elementReplacementQuestionRequired(true)).toBe(true);
    expect(elementReplacementQuestionRequired(false)).toBe(false);
  });
});

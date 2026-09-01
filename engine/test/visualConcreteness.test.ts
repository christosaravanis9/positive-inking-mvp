import { describe, it, expect } from "vitest";
import { hasUnresolvedPrimaryImagery } from "../src/visualConcreteness.js";
import type { VisualElement } from "../src/types.js";

/**
 * Regression coverage for the Athena Blueprint incident: a Blueprint that
 * reached "PRIMARY ELEMENTS" with a bare category placeholder ("a specific
 * object that belongs to Athena") instead of a real visual proposition, with
 * nothing in the product flagging that primary imagery was still unresolved.
 * hasUnresolvedPrimaryImagery is the deterministic signal DesignConfirmation
 * now feeds into has_unresolved_contradiction so needs_refinement no longer
 * depends on the Association Engine happening to self-report a contradiction.
 */

function element(overrides: Partial<VisualElement>): VisualElement {
  return {
    id: "el-1",
    description: "placeholder",
    personal_meaning: "placeholder",
    source_category: "personal_artefact",
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

describe("hasUnresolvedPrimaryImagery", () => {
  // Journey A: "Something to remind me of my daughter" -- a personal-category
  // candidate selected without answering its micro-resolution question must
  // never be silently treated as resolved primary imagery.
  it("A: an unresolved personal-artefact placeholder left undecided flags unresolved primary imagery", () => {
    const elements = [
      element({ id: "candidate-0", description: "a specific object that belongs to Athena", concreteness: "unresolved_placeholder" }),
    ];
    expect(hasUnresolvedPrimaryImagery(elements)).toBe(true);
  });

  // Journey B: a genuinely abstract future-facing idea with no personal
  // artefact -- new_materialisation producing a real, if abstract, starting
  // concept is concrete and must not block readiness.
  it("B: a concrete new_materialisation idea (abstract in style, not in resolution) does not block readiness", () => {
    const elements = [
      element({
        id: "candidate-0",
        description: "a new mark made by overlapping the outlines of both initials",
        source_category: "new_materialisation",
        concreteness: "concrete",
      }),
    ];
    expect(hasUnresolvedPrimaryImagery(elements)).toBe(false);
  });

  // Journey C: a user who explicitly wants an intentionally abstract mark --
  // abstraction the user chose is not the same as an unresolved category, and
  // must not be forced into a literal object.
  it("C: a user-authored deliberately abstract idea is always concrete, never gated", () => {
    const elements = [
      element({
        id: "idea-0",
        description: "an abstract mark, not tied to any literal object",
        source_category: "new_materialisation",
        origin: "visual_inspiration",
        concreteness: "concrete",
      }),
    ];
    expect(hasUnresolvedPrimaryImagery(elements)).toBe(false);
  });

  it("an unresolved placeholder that is only a supporting/accent/background element does not block readiness on its own", () => {
    const elements = [
      element({ id: "candidate-0", description: "the actual subject", concreteness: "concrete", hierarchy: "primary" }),
      element({ id: "candidate-1", description: "a decorative flourish", concreteness: "unresolved_placeholder", hierarchy: "accent" }),
    ];
    expect(hasUnresolvedPrimaryImagery(elements)).toBe(false);
  });

  it("answering the micro-resolution question (folded into the description) resolves it to concrete", () => {
    const elements = [
      element({
        id: "candidate-0",
        description: "a specific object that belongs to Athena — specifically, her handwriting on a birthday card",
        concreteness: "concrete",
      }),
    ];
    expect(hasUnresolvedPrimaryImagery(elements)).toBe(false);
  });

  it("no elements at all is not unresolved primary imagery", () => {
    expect(hasUnresolvedPrimaryImagery([])).toBe(false);
  });
});

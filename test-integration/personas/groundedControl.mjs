/**
 * Persona 3: Grounded control -- specific, concrete story. Should NOT
 * trigger the meaning-depth gate. Acts as the regression baseline every
 * other persona is contrasted against: no `__TEST_THIN__` marker, so the
 * fake double's Discovery response carries `meaning_is_thin: false`
 * naturally (its default), exactly like a genuinely well-grounded real
 * story would.
 *
 * Also answers the Screen 7 detail follow-up with a real, concrete answer
 * (not a fragment) -- a second, "clean end-to-end" data point for the
 * DETAIL_SEPARATOR composition check, contrasting with personas 1-2's
 * deliberately thin/fragment answers.
 */
export default {
  id: "grounded-control",
  label: "Grounded control",
  storyText:
    "My grandmother taught me to cook in her kitchen every Sunday from when I was six until she passed two years ago. She always wore a specific blue apron with a small tear near the pocket that she refused to replace. I want something that carries that specific memory forward.",
  viewpointChipIndex: 0,
  expectDepthGate: false,
  screen7: {
    detailAnswer: "her blue apron, the one with the small tear near the pocket",
    keepMatchers: ["a simple line drawing of a house"],
  },
  // The regression baseline: confirms all three Association candidate
  // modes (literal object, pure abstraction, illustrative sequence) are
  // genuinely present and rendered on a clean, ordinary run -- not just
  // something that happens to show up on the personas exercising edge
  // cases.
  expectAssociationModes: ["literal_object", "pure_abstraction", "illustrative_sequence"],
};

/**
 * Persona 2: Articulate-but-ungrounded -- well-written, confident prose
 * with no concrete detail. Should also trigger the meaning-depth gate:
 * this is the specific case the gate was built for (§9's own distinction
 * between "thin" and "confident but ungrounded"), and this persona exists
 * specifically to confirm the gate still catches it, distinctly from
 * persona 1's plain vagueness -- distinctly in BEHAVIOUR here, since
 * against the fake double both personas resolve meaning_is_thin the same
 * way (the `__TEST_THIN__` marker, not genuine judgement -- see
 * runner.mjs's own top-of-file caveat). What genuinely differs between
 * the two personas: the actual story text (confident/well-formed here,
 * flatly generic for persona 1) and what each one does when the gate
 * fires -- persona 1 attempts a (still thin) answer, this persona
 * declines the follow-up outright, matching its own "confident, nothing
 * more to add" character. Real-model verification is what would confirm
 * the model's actual judgement genuinely distinguishes the two story
 * texts -- out of scope for this fake-double harness, flagged here rather
 * than glossed over.
 */
export default {
  id: "articulate-ungrounded",
  label: "Articulate but ungrounded",
  storyText:
    "__TEST_THIN__ This tattoo represents a journey of self-discovery and transformation. It's about embracing who I've become and honouring the growth I've experienced. It symbolizes resilience, authenticity, and the courage to become my truest self.",
  viewpointChipIndex: 0,
  expectDepthGate: true,
  // Declines the depth-exercise follow-up -- distinct from persona 1, which
  // attempts an answer. Represents a client with nothing more concrete to
  // add even when explicitly invited.
  depthAnswer: null,
  screen7: {
    // Still answers the Screen 7 detail follow-up, but with a different
    // flavour of non-answer: articulate-sounding, still no concrete
    // detail -- a second, distinct fragment shape from persona 1's blunt
    // "no", both of which must still compose cleanly.
    detailAnswer: "that's just how it feels, honestly",
    // 2026-09-23: was "a simple line drawing of a house", the old
    // default-top-5's 5th candidate -- no longer visible by default now
    // that Screen 7 shows only 3; points at the abstract_symbolic
    // candidate that still ranks inside the new default top 3 instead.
    keepMatchers: ["a new mark made by overlapping the outlines of both your initials"],
  },
};

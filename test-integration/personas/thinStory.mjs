/**
 * Persona 1: Thin story -- vague, generic answers ("something meaningful",
 * "just because I like it"). Should trigger the meaning-depth gate.
 *
 * `__TEST_THIN__` is fakeAnthropic.mjs's own existing marker (stripped from
 * every displayed field) that makes the fake double's Discovery response
 * carry `meaning_is_thin: true` -- see that file's own comment on why a
 * fake double can't reproduce the real model's actual judgement, only
 * prove the app branches correctly on whatever it's told. This persona's
 * story text is deliberately generic/low-effort regardless of the marker,
 * so the fixture itself still reads as a genuinely thin story to a human,
 * not just to the fake double's branch logic.
 */
export default {
  id: "thin-story",
  label: "Thin story",
  storyText:
    "__TEST_THIN__ I want a tattoo that's something meaningful, I guess. Just because I like it, you know? Nothing too crazy, just something nice.",
  viewpointChipIndex: 0,
  expectDepthGate: true,
  // Answers the depth-exercise follow-up, but still with a thin, low-effort
  // answer -- distinct from persona 2, which declines the follow-up
  // entirely rather than attempting a vague one.
  depthAnswer: "not sure, just felt right",
  screen7: {
    // The "needs_client_specific_detail" candidate's follow-up answered with
    // a blunt, ungrammatical fragment -- the exact class of input
    // (DETAIL_SEPARATOR's original live-reported bug) that must still
    // compose cleanly as "...memory. In your own words: no", never a
    // garbled dash-continuation.
    detailAnswer: "no",
    // A second, low-effort Keep on another default-visible candidate (this
    // persona isn't picky -- it accepts what's offered). Not needed to
    // enable Continue (the detailAnswer Keep above already does that), but
    // exercises a second real Keep click on the same run. 2026-09-23: was
    // "a simple line drawing of a house", the old default-top-5's 5th
    // candidate -- no longer visible by default now that Screen 7 shows
    // only 3, so this points at the abstract_symbolic candidate that still
    // ranks inside the new default top 3.
    keepMatchers: ["a new mark made by overlapping the outlines of both your initials"],
  },
};

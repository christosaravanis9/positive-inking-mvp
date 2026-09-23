/**
 * Persona 4: Heavy rejector -- rejects slot 0's candidate repeatedly via
 * "Not this one" past the free reserve pool (11 items in the fake double's
 * fixture as of Part 3 of the 2026-09 5-lane expansion, the default-3/
 * second-batch-of-3 Screen 7 restructure: 14 total candidates minus 3
 * default-visible; was 9 of 14 when Screen 7 still showed 5 by default, and
 * 7 of 12 before that expansion added 2 more reserve-tier candidates) into
 * a paid, typed-reason reroll. Exercises the reserve-pool exhaustion path
 * and the real per-slot model call fixed/scaled earlier (association.ts
 * rule 1, "9 to 12" candidates so there's genuine reserve material).
 *
 * Deliberately only ever rejects slot 0 -- slots 1 and 2 are never touched,
 * so the failed-first-pull second-batch reveal (all 3 default slots
 * rejected) never fires here; that path has its own dedicated coverage in
 * ElementsDiscovery.test.tsx instead.
 */
export default {
  id: "heavy-rejector",
  label: "Heavy rejector",
  storyText:
    "I've been collecting old maps and compasses since I was a teenager, and I want a tattoo built from that specific collection -- not a generic travel symbol, the actual objects I own.",
  viewpointChipIndex: 0,
  expectDepthGate: false,
  screen7: {
    // Requests more free rerolls than the fixture's reserve pool actually
    // holds (11, see above) -- the runner stops early the moment the "No
    // more free alternatives" banner genuinely appears, so this number is a
    // ceiling, not an assumption about the exact reserve size.
    freeRerollSlot: 0,
    freeRerollCount: 13,
    paidRerollSlot: 0,
    paidRerollReason: "None of these feel personal enough -- I want something specific to my own collection, not a generic object.",
    // A Keep elsewhere (slot 1, untouched by slot 0's rejections) so
    // Continue is enabled independent of how slot 0 resolves, and so slot 0
    // stays the only rejected default slot. 2026-09-23: was "a simple line
    // drawing of a house", the old default-top-5's 5th candidate -- no
    // longer visible by default now that Screen 7 shows only 3.
    keepMatchers: ["a new mark made by overlapping the outlines of both your initials"],
  },
  expectMinFreeRerolls: 6,
  expectReservePoolExhausted: true,
};

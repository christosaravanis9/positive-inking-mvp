/**
 * Persona 4: Heavy rejector -- rejects slot 0's candidate repeatedly via
 * "Not this one" past the free reserve pool (9 items in the fake double's
 * fixture as of the 2026-09 5-lane expansion: 14 total candidates minus 5
 * default-visible; was 7 of 12 before that expansion added 2 more reserve-
 * tier candidates) into a paid, typed-reason reroll. Exercises the
 * reserve-pool exhaustion path and the real per-slot model call fixed/
 * scaled earlier (association.ts rule 1, "9 to 12" candidates so there's
 * genuine reserve material).
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
    // holds -- the runner stops early the moment the "No more free
    // alternatives" banner genuinely appears, so this number is a ceiling,
    // not an assumption about the exact reserve size.
    freeRerollSlot: 0,
    freeRerollCount: 10,
    paidRerollSlot: 0,
    paidRerollReason: "None of these feel personal enough -- I want something specific to my own collection, not a generic object.",
    // A Keep elsewhere so Continue is enabled independent of how slot 0
    // resolves.
    keepMatchers: ["a simple line drawing of a house"],
  },
  expectMinFreeRerolls: 6,
  expectReservePoolExhausted: true,
};

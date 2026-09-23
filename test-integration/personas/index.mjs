import thinStory from "./thinStory.mjs";
import articulateUngrounded from "./articulateUngrounded.mjs";
import groundedControl from "./groundedControl.mjs";
import heavyRejector from "./heavyRejector.mjs";
import editor from "./editor.mjs";
import { main } from "./runner.mjs";

/**
 * Synthetic-persona testing harness for the intake journey (2026-09-23).
 * Run: `npm run test:personas` (from the repo root), or directly:
 * `node test-integration/personas/index.mjs`.
 *
 * v1 personas (5): thin story, articulate-but-ungrounded, grounded
 * control, heavy rejector, editor. See runner.mjs's own top-of-file
 * comment for the harness's design and its one deliberate limitation
 * (fake-double branching, not genuine model judgement).
 *
 * Deliberately NOT in v1 scope (flagged here as natural v2 additions,
 * not silently skipped):
 *  - reference-photo upload personas (Screen 7 inline attach / Screen 13
 *    placement/nearby-tattoo photos) -- this harness's journeys never
 *    attach a file.
 *  - voice-input-specific personas -- every persona here types (fills
 *    text fields directly); text-equivalent phrasing stands in for
 *    voice-transcribed text, since VoiceInputButton's own onChange path
 *    is exercised identically regardless of how the text arrived (see
 *    web/src/components/VoiceInput.test.tsx's own unit coverage for the
 *    voice-specific mechanics: interim text, dedup, error mapping).
 *  - backward-navigation-via-panel personas (the "What we've understood"
 *    panel's per-row Edit links, or the generic Back button) -- every
 *    persona here only ever moves forward.
 */
const PERSONAS = [thinStory, articulateUngrounded, groundedControl, heavyRejector, editor];

main(PERSONAS).then((exitCode) => process.exit(exitCode));

import { z } from "zod";

/**
 * Per-lane style hints (2026-09). VisualStylePreference.tsx's 5 real lane
 * options previously carried one identical, generic subheading each,
 * regardless of the client's own story -- meaningless to someone who has
 * never thought about tattoo design in these terms, especially with zero
 * candidate ideas shown yet to anchor against. This call reads the
 * client's already-confirmed story/meaning (the exact same input
 * Association itself reads moments later, see server/src/routes/
 * association.ts) and writes one short, loose, illustrative line per lane,
 * replacing the static subheading on that one screen only.
 *
 * Deliberately a SEPARATE call from Association, not folded into it: this
 * runs before any real candidate exists, is asked a narrower, lighter
 * question (a gesture toward a lane, not a real visual proposition), and
 * its output must never reach Association's own prompt as source material
 * -- see server/src/routes/styleHints.ts, which never forwards this
 * anywhere else, and VisualStylePreference.tsx, which never persists the
 * hint text into project state, only ever renders it.
 */

export const STYLE_HINTS_SYSTEM_PROMPT = `You are the Positive Inking Style-Hint Writer.

The client is about to be asked which of 5 visual approaches (lanes)
appeals to them, before any real candidate ideas exist yet. Your only job
here is to write one short, loose, illustrative line per lane, grounded in
this client's own story -- not a generic definition of what the lane
means, and not a finished candidate idea.

1. GROUNDED, NOT GENERIC -- Every hint must connect to something specific
in the client's own story: a person, object, place, phrase, or moment they
actually described. Never write a hint that could apply equally well to a
different client's story.
  BAD (a generic restatement of the lane, not grounded in this story): "An
  object or image that represents the feeling, not the literal story."
  BETTER (the same lane, grounded in this specific story): "Like a single
  object standing in for the freedom you're building toward."

2. LOOSE, NOT A CANDIDATE -- This is a gesture toward what the lane could
look like for this client, never a fleshed-out visual proposition. Do not
name a specific object, image, or composition as if it were a real
candidate idea -- that is Association's job, later, with much more room to
work and much more of the story to draw on. One short sentence, evocative
rather than literal.
  BAD (reads like an actual candidate, not a loose hint): "A small hand-
  drawn compass rose with her initials worked into the needle, in fine
  linework on the inside of your wrist."
  BETTER (a gesture toward the lane, still open): "Something that points
  toward the choice you made, without spelling it out."

3. ONE SHORT SENTENCE per lane, roughly 12-20 words, in the same plain,
direct register as every other client-facing text in this app -- short
words, short sentences, no elaborate connective prose ("rather than,"
"which subsequently," "as it was originally").

4. FIVE LANES, each its own line: abstract_symbolic, illustrative,
typography, framed, narrative_collage. ("not_sure" is never shown a
hint -- do not write one for it.)

5. IF THE STORY GENUINELY DOES NOT SUPPORT a given lane (e.g. no words or
phrases exist for typography, no distinct elements to combine for
narrative_collage), still write a loose, honest hint for what that lane
could draw on if the client leaned into it -- never leave a lane blank,
and never apologise or hedge in the hint itself.

6. OUTPUT -- valid structured data via the write_style_hints tool.`;

export const styleHintsToolInputSchema = {
  type: "object",
  properties: {
    abstract_symbolic: { type: "string" },
    illustrative: { type: "string" },
    typography: { type: "string" },
    framed: { type: "string" },
    narrative_collage: { type: "string" },
  },
  required: ["abstract_symbolic", "illustrative", "typography", "framed", "narrative_collage"],
} as const;

const HINT_LANES = ["abstract_symbolic", "illustrative", "typography", "framed", "narrative_collage"] as const;

/** A missing/null/blank hint for one lane is a tracking gap, not a reason to fail the whole call -- the client falls back to that one lane's existing static description (see VisualStylePreference.tsx), same lenient philosophy as association.ts's per-candidate optional fields. */
const laneHintField = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  });

export type StyleHints = { [K in (typeof HINT_LANES)[number]]?: string };

/**
 * Validates the model's raw output and normalises it to exactly the 5
 * current `HINT_LANES` keys -- the one place this data is shaped before it
 * ever reaches the client, so `VisualStylePreference.tsx` can never receive
 * an old lane name (a rename left over in the model's own training, or a
 * stale system-prompt cache), an unrecognised key, or a malformed value for
 * one it does expect.
 *
 * Per-lane salvage (2026-09-24), same philosophy as association.ts's
 * per-candidate salvage in parseAssociationResult: validates each of the 5
 * known lanes INDEPENDENTLY via laneHintField.safeParse, not as one
 * all-or-nothing z.object. One lane coming back the wrong type (an object,
 * a number -- a real malformed-tool-call shape, not just an absent key)
 * used to fail validation for the WHOLE response and 502 the request,
 * costing all 5 lanes their personalization over a single bad one; now it
 * just drops that one lane, exactly like a missing one, and keeps
 * whichever of the other 4 validated. Any key that isn't one of the 5
 * current `HINT_LANES` (an old pre-rename name, or anything else) is never
 * looked at -- silently dropped, not even attempted.
 *
 * Returns null only when `raw` itself isn't a plain object at all (nothing
 * to read a lane out of) -- an individual lane's own shape never causes
 * that. Never throws.
 */
export function toStyleHints(raw: unknown): StyleHints | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  const hints: StyleHints = {};
  for (const lane of HINT_LANES) {
    const parsed = laneHintField.safeParse(source[lane]);
    if (parsed.success && parsed.data) hints[lane] = parsed.data;
  }
  return hints;
}

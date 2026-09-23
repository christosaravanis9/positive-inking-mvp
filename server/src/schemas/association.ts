import { z } from "zod";
import { DEVICE_CATALOG, INITIAL_ACTIVE_DEVICE_IDS, type DeviceDefinition } from "@positive-inking/engine";

/**
 * §11, §19.3 — the Association / Visual Specification Engine. V3.0 §11
 * describes a pipeline (confirmed meaning or provenance -> thought
 * associations -> personal entities -> visual associations -> source
 * classification -> relevance ranking) and hidden 0-10 ranking dimensions,
 * rather than a single fixed output schema the way §9.2 and §10 do for
 * Discovery and Provenance. The schema below is this project's own
 * synthesis of that pipeline into one structured call: candidate visual
 * elements carrying the hidden ranking dimensions (used to order results,
 * never shown to the user per §11), plus the place_role / spatial-language
 * classification the deterministic engine needs as input to concept_shape
 * (§12.2-12.3) — genuine interpretation of the story, which is why it lives
 * here and not in engine/.
 */

/** Used both as buildAssociationSystemPrompt's own default parameter and as the Association route's fallback when the live roster store is unavailable (see server/src/routes/association.ts) -- one shared source of truth for "what a safe, reasonable roster looks like with no live data available." */
export const DEFAULT_DEVICE_ROSTER: { active: DeviceDefinition[]; reserve: DeviceDefinition[] } = {
  active: INITIAL_ACTIVE_DEVICE_IDS.map((id) => DEVICE_CATALOG.find((d) => d.id === id)!),
  reserve: DEVICE_CATALOG.filter((d) => !INITIAL_ACTIVE_DEVICE_IDS.includes(d.id)),
};

export const ASSOCIATION_SYSTEM_PROMPT = buildAssociationSystemPrompt();

/**
 * 2026-09-09: the DEVICE VOCABULARY section is now built from the live
 * device roster (engine/src/deviceRoster.ts, server/src/deviceRosterStore.ts)
 * rather than a fixed, hand-written list -- see the session log entry for
 * the full "6 artists" bandit-rotation design. Defaults to the roster's own
 * initial split (INITIAL_ACTIVE_DEVICE_IDS / everything else) when called
 * with no arguments, so ASSOCIATION_SYSTEM_PROMPT above still works as a
 * plain constant for anything that doesn't have a live roster to pass in
 * (diagnostics.ts, tests) -- the real route always calls this itself with
 * the actual current roster from getActiveDeviceRoster().
 *
 * The five active devices are each explicitly assigned to one of the first
 * five candidates, in order -- this is what makes device tracking accurate
 * without relying on the model to self-classify its own candidate after
 * the fact (an unreliable step this design deliberately avoids). Devices
 * beyond the five may draw on anything in the full active+reserve list --
 * the reserve pool still needs real content to serve when the client asks
 * for "something else," and restricting THOSE candidates to only the five
 * currently-favoured devices would undermine the very exploration the
 * roster's own review cycle depends on.
 */
export function buildAssociationSystemPrompt(
  roster: { active: DeviceDefinition[]; reserve: DeviceDefinition[] } = DEFAULT_DEVICE_ROSTER,
): string {
  const activeList = roster.active.map((d, i) => `  ${i + 1}. [device_id: "${d.id}"] ${d.promptDescription}`).join("\n");
  const reserveList = roster.reserve.map((d) => `  - [device_id: "${d.id}"] ${d.promptDescription}`).join("\n");

  return `You are the Positive Inking Visual Specification Engine.

Do not produce a finished tattoo. Convert confirmed meaning or provenance into
personal visual material and a set of candidate elements for the user to react
to, confirm, reject or extend.

1. LANES — Move from values, themes or provenance to concrete visuals. Every
candidate belongs to exactly one of five lanes, chosen freely per candidate
based on what the story actually supports — never forced into an even split,
and never defaulting to the same lane every time just because it is listed
first:
  - abstract_symbolic (Abstract & symbolic) — a metaphor object or mark that
    stands for the feeling or meaning, not a literal depiction of what
    happened. Grounded in a concrete detail from the story (rule 8 still
    applies in full), but the mark itself need not resemble anything from
    the story literally. See new_materialisation in rule 2, and rule 8's
    concreteness note on abstraction.
  - illustrative (Illustrative) — a real, literal depiction of what the
    story actually describes: an actual object, person, place, or moment
    from it, rendered clearly enough that someone with no explanation could
    roughly follow what it is. Per this app's own visual-density scale,
    illustrative work "maintains clear space for visual clarity, focusing
    on a single subject without a crowded background" — one clear depicted
    subject or scene, not several elements combined or layered (several
    elements is the separate narrative_collage lane below). This is
    description, not metaphor — the test is whether a stranger, shown only
    the image, could say "that looks like the thing in the story," not
    "that could represent the feeling." A single object counts here too
    when it is drawn plainly as itself, not standing in for something else
    — the line between this lane and abstract_symbolic is literal-vs-
    metaphor, not single-object-vs-scene. See rule 8 for this lane's own
    concreteness examples — it fails in a different way than the general
    placeholder-category problem does.
  - typography (Typography-based) — the design is built from lettering or
    words themselves as the visual form, not a picture with text added to
    it. Draw the actual words from the client's own language wherever the
    story gives you any — a phrase they used, a name, a date — never an
    invented generic phrase. See rule 8.
  - framed (Framed) — the design is deliberately composed inside its own
    visible frame or sequence of frames. This covers several concrete
    shapes: a small sequence of linked panels or beats telling the story,
    each part individually a real visual proposition (rule 8's concreteness
    bar applies to every part, not just the whole — and rule 6's NO
    INVENTION applies to every part too, not just the candidate as a
    whole); a single framed vignette (a scene or object deliberately
    bounded by a drawn border, a Polaroid-style frame, or a badge/crest
    shape). Only propose the linked-panel-sequence shape when the story's
    own shape genuinely supports more than one visual beat (a journey, a
    before/after, two things in relationship to each other) — never
    manufacture a sequence just for variety, and never at the expense of a
    strong single-image candidate the story equally supports; the framed-
    vignette/badge-crest shapes fit a single strong image just as well.
    Also carries its own rendering_style attribute on the candidate — set
    it to whichever of realism / anime / artistic_line_art / photographic
    actually suits THIS candidate's own content; do not default to the
    same one every time this lane is used. rendering_style applies to this
    lane only — leave it unset for every other candidate.
  - narrative_collage (Narrative Collage / Layered Montage) — several of
    the story's own actual described elements layered or combined into one
    composition: a storyboard-like arrangement, a moodboard-style grouping,
    a portrait integrated with another element, or a themed sleeve-style
    combination of several motifs (e.g. a background motif combined with a
    distinct foreground scene). Grounded in what the client specifically
    described, not generic imagery assembled to look busy or rich. Rule 6's
    NO INVENTION applies to every layer individually, the same as framed's
    linked-panel shape above.
Set each candidate's lane to the matching value above (abstract_symbolic /
illustrative / typography / framed / narrative_collage) exactly
as spelled — this is validated, not free text.

PRE-QUALIFYING PREFERENCE — the accompanying message may state the client's
own answer to a pre-qualifying question about which of the 5 lanes above
appeal to them, asked before you were ever called — one or more lanes, or
"not sure" (never both; the two are mutually exclusive). When one or more
specific lanes are stated, weight the batch so those selected lanes
TOGETHER account for roughly 60% of it, split as evenly as makes sense
across however many were selected: one selected lane gets roughly 60% of
the batch to itself; two selected lanes get roughly 30% each; three get
roughly 20% each. Spread the remaining weight evenly across whichever
lanes were NOT selected: one lane left over gets the whole remaining ~40%;
two left over split it ~20% each; three left over split it ~13% each. The
batch should never be 100% the selected lanes even when several are
stated — a client without a clear design vocabulary of their own often
responds better to an approach they did not think to ask for. If every one
of the 5 lanes was selected, there is nothing left to spread elsewhere —
treat that the same as "not sure" and spread the batch evenly across all 5
instead. When the client's answer was "not sure," spread the batch as evenly
as you can across all 5 lanes instead. This never overrides
CONCRETENESS (rule 8) or PERSONAL PRIORITY (rule 2) — a weak candidate in
a preferred lane is still weak; never manufacture one just to hit the
target.

Propose enough candidates for the client to meaningfully compare and revisit
later — typically 9 to 12 total, more when the story genuinely supports
several distinct strong ideas, fewer only when it doesn't. This range is
deliberately well above the 3 shown by default (2026-09, down from 5): the
client screen shows only the top 3 at once, and everything beyond that is
a shared reserve drawn on whenever the client asks for something else on
any one of the 3 shown — plus, if the client rejects all 3 initial
candidates without keeping or building upon any of them, a second batch of
3 more is revealed from that same reserve, not a fresh generation call, so
the reserve needs to comfortably cushion both uses, not just individual
re-rolls. Too few total candidates starves that shared reserve across the
whole screen, not just one candidate — confirmed live: at the low end of
a smaller range, only the first couple of "not this one" clicks on the
whole screen actually produce something new, regardless of which
candidate they're clicked on. If the screen's own default visible count
ever changes, this number needs to move with it. Never pad the count
with weak filler just to hit a number; concreteness (rule 8) and
grounding still apply to every single one, no exceptions for the ones
further down the list. Every candidate in the batch must be a genuinely
different idea from every other one in it -- a different subject, form, or
visual approach, not the same idea restated in different words or a minor
variation on the same mark-making gesture (e.g. proposing both "a tangle
of lines resolving into one clean line" and "a knot that's actually one
continuous cord closing into a loop" reads as one idea offered twice, not
two real options -- live-reported: a client rejected a run of these back
to back specifically because each felt too similar to the ones already on
screen). Before finalising the batch, check it against itself: if two
candidates would look and mean nearly the same thing to the client, keep
the stronger one and use the freed slot for something that actually
differs.

DEVICE VOCABULARY — device_id and lane (rule 1) are independent
classifications; assign each candidate exactly one of each, and never let
your choice of one constrain the other. This app tracks, across real client
outcomes, which visual approaches actually resonate, and periodically
rotates the active set based on that real data (not a fixed list this
prompt invents). Assign
each of the first ${roster.active.length} candidates you propose to exactly
one of the following devices, in this exact order, and set that
candidate's device_id to the exact string shown for it — this is the one
part of your output actually measured, so get the id string exactly right,
character for character:
${activeList}
Every worked example anywhere in this prompt illustrates a required QUALITY
(concreteness, plain wording, an inspiring level of visual life) for a
device — never a technique to imitate regardless of device. Build each of
these ${roster.active.length} candidates as a genuinely different execution
of ITS OWN assigned device, not a variation on whichever worked example
elsewhere in this prompt happens to be most memorable.
Beyond those ${roster.active.length}, propose the rest of the batch (up to
the 9-12 total above) drawing on any device from the full list below
(the ${roster.active.length} above, plus this reserve) — tag each with its
own device_id the same way:
${reserveList}
Across the WHOLE batch, no single device should account for more than one
or two candidates, even one of the five explicitly assigned above — if a
candidate you're about to propose echoes the structure of another
candidate already in this batch, choose a different device instead.
If the accompanying message asks for a single replacement or refined
candidate rather than a full batch, this per-slot assignment does not
apply -- just assign it whichever one device from the full list above
genuinely fits best, and tag it with that device_id.

2. PERSONAL PRIORITY — Prioritise personal artefacts, new material created for
the project, specific people, places and objects, then broader symbolism, then
generic tattoo symbolism. Do not automatically turn courage into a lion, loss
into wings, time into a clock or direction into a compass. Where no personal
material exists, promote new_materialisation to first rank instead of reaching
for public symbolism, and say so plainly — this is a legitimate story shape,
not a gap.

3. RANKING — For every candidate, score personal_relevance, story_relevance,
visual_potential, originality, genericity and reference_availability from 0 to
10. Personal relevance, story relevance and originality outweigh generic
visual appeal. These scores are for ordering only and are never shown to the
user.

4. PLACE ROLE — Determine whether a place named in the story is the subject of
the tattoo (something to depict) or the setting it sits inside (the world the
rest of it sits in). A grandmother's kitchen usually resolves to subject; a
hillside where ashes were scattered usually resolves to setting. Mark it
"ambiguous" only when the story genuinely supports both readings — this
triggers exactly one clarifying question downstream, so do not default to
ambiguous out of caution.

5. CONCEPT CLASSIFICATION — Report whether text/handwriting or a likeness is
present and whether either is the primary element, whether spatial language
is present (a scene, a journey, an environment), and the primary element
type. These drive deterministic downstream question eligibility — classify
honestly rather than guessing toward a particular downstream path.

6. NO INVENTION — Do not add age, hair, skin texture, clothing, existing
tattoos, jewellery, props, decorative symbols or invented scenery. Applies to
every part of a framed or narrative_collage candidate individually, not
just the candidate as a whole — neither lane is license to add scene-setting
detail (a room, weather, a time of day) that isn't in the story just to fill
out a panel or a layer.

7. CONTRADICTIONS — Note any design contradictions from §13.2 you can already
see (e.g. an exact artefact with no uploaded reference) as plain descriptions
with one or two resolutions. Do not resolve them yourself.

8. CONCRETENESS — A candidate's description must be an actual visual
proposition: a specific image, motif, mark-making idea or object, not a
category name for information you do not have yet.
  BAD (a category, not a proposition): "something representing your bond";
  "a specific object that belongs to her".
  BETTER (a real starting point, even if still open to change): "a small
  hand-drawn motif built from her handwriting"; "a new mark made by
  overlapping the outlines of both your initials"; "a fragment of a specific
  object or place, once you tell us which one".
  Mark such a candidate's resolution_state as "needs_client_specific_detail"
  and write the one question that would make it concrete as
  follow_up_prompt (e.g. "What object of hers carries the most memory for
  you?") — never leave that question unasked by presenting the category as
  if it were already a resolved idea. Mark resolution_state "concrete" for
  everything else, including a deliberately abstract new_materialisation
  idea the client has explicitly chosen not to tie to a literal object —
  concreteness is about whether the visual idea itself is real, not about
  whether it is literal or abstract in style.
  A framed candidate using the linked-panel-sequence shape (rule 1's Framed
  lane) is one candidate with one description naming the whole cohesive small sequence —
  never split across multiple visual_candidates entries, and never given its
  own schema shape; write it as ordinary prose that names each part in turn.
  The same concreteness bar applies to EVERY part individually, not just to
  the sequence as a whole: "a series of meaningful moments from the
  relationship" is exactly the kind of category-not-proposition this rule
  already forbids, just spread across several beats instead of one.
  BAD (a sequence described only in the abstract): "a few panels showing
  the arc of the friendship over time."
  BETTER (each part a real, specific proposition -- one possible format
  among many; see the format-is-open note just below, and DEVICE
  VOCABULARY above -- do not default to "linked panels with no border"
  just because it is the example shown here): "Three small linked panels,
  no border between them: a figure at a fork in the path. A hand resting
  on a compass. The figure walking on alone, the path now faded behind
  them." Format is open to whatever actually suits
  the story — linked panels, polaroid-style fragments, a still scene with
  the person only implied by what they left behind, or a figure integrated
  directly into its environment are all legitimate; do not default to
  panels every time (several distinct elements layered or combined into one
  composition belongs to the separate narrative_collage lane below, not here).
  The story's own arc stays open to interpretation rather than narrating one
  specific event you weren't told — the sequence should evoke a
  relationship or passage of time the story actually supports, not invent
  a scene-by-scene plot.
  The illustrative lane (rule 1) fails CONCRETENESS in a
  different shape than the placeholder-category problem above: a
  description that is technically an image but still reads as an emotional
  summary, not something actually drawn from the story.
  BAD (emotionally true, but not a literal depiction of the story):
  "a warm scene of togetherness"; "a moment of quiet understanding between
  two people."
  BETTER (the actual scene or object the story describes, plainly): "her
  kitchen table, the blue apron hanging on its hook by the door"; "the two
  of you on the porch steps, the dog stretched out between you."
  Every noun in an illustrative candidate should trace back to
  something the story actually named or clearly implied — never a generic
  stand-in scene that could belong to a different client's story just as
  easily.
  A typography candidate must name the actual words being used, not just
  describe that words will be used.
  BAD (a category, not the real words): "a meaningful phrase in flowing
  script."
  BETTER (the client's own actual language): "the phrase 'still here,' in
  her own handwriting"; "the date she was born, spelled out in numerals
  built from the same linework as the rest of the piece."
  A narrative_collage candidate must name each specific element being
  combined, not just that "elements" are combined.
  BAD (a category, not a proposition): "a collage of meaningful pieces
  from her life."
  BETTER (each layer a real, specific thing from the story): "the outline
  of her apron, layered behind a single line drawing of the kitchen
  table."
  personal_meaning does not need description's same literal concreteness —
  a real, honestly abstract emotional truth is a legitimate answer — but it
  must be grounded in a specific detail from the client's own story or from
  this candidate's own description, never a sentence generic enough to fit
  equally well on a different client's story. If nothing in the story
  grounds the meaning yet, do NOT write that admission into personal_meaning
  itself — stated as prose next to stronger, already-grounded candidates it
  reads as a confusing, harsh judgment, not a real answer, and undersells a
  candidate that might still be worth the client's attention. Instead: write
  personal_meaning as a short, honest, neutral description of the general
  association this candidate draws on (never apologetic, never fabricating
  grounding it doesn't have), mark this candidate's resolution_state as
  "needs_client_specific_detail" — the exact same mechanism used above for
  an ungrounded description, not a separate one — and write follow_up_prompt
  as a warm, genuinely personal invitation, never a flat request for
  information or a generic template:
    - Reference something specific from the client's own story wherever the
      story gives you anything to reference. Never phrase it so it would
      read identically for a different client's story.
    - Offer one or two LOOSE, illustrative examples of the kind of detail
      that would ground it — these exist to spark the client's own
      imagination, not as a checklist or instructions to follow.
    - End by explicitly framing those examples as optional inspiration, not
      a requirement — something in the spirit of "just ideas, not
      instructions."
  Example, for a story about learning to trust your own decisions and a
  candidate built around a compass: "Could this connect to something from
  your own story? Maybe an etching of a date that mattered, a symbol that
  reminds you of the decision, or a word or phrase tied to why this matters
  to you. Just ideas, not instructions — whatever actually feels true to
  you." Generate this fresh from what the actual story contains each time —
  never reuse that exact wording for a different candidate or story.

9. WORDING — Concrete and simply-worded are not in tension: write description
and personal_meaning in plain, common words and short, direct sentences — the
same register already required for every screen's own client-facing text,
extended here to candidate content itself. This changes sentence length and
word choice only, never content — the same specific detail, said directly
instead of qualified.
  - Avoid a formal connective ("rather than," "as it was originally," "which
    subsequently") wherever a plain word, or simply a period and a new short
    sentence, says the same thing. State the specific detail once; do not
    also state what it is not, unless that contrast is itself the point.
  - When describing something exploratory or optional, an inviting verb
    ("Imagine...") carries that framing on its own — no separate disclaimer
    sentence needed.
  - description: name the specific thing plainly, in as few words as the
    specificity actually needs. Usually one sentence; a second only when it
    adds a real concrete detail, never a qualifier on the first.
  - personal_meaning: roughly 20-30 words. One concrete detail from the
    story, one short, plain echo of what it means — never a second clause
    justifying, hedging, or explaining the first.
  BEFORE (too elaborate, real output this replaces): "A miniature
  reproduction of a specific childhood drawing the client made, rendered in
  their own original linework rather than restyled or 'improved' — kept
  deliberately rough/childlike as it was originally drawn." / "Connects
  directly to the early recognition the client mentions — the drawing that
  first got noticed, rather than a symbol standing in for 'being creative.'"
  AFTER (same specific detail, plain and direct): "Your own childhood
  drawing, kept exactly as you drew it — not cleaned up, not improved." /
  "This is the actual drawing that got you noticed, not a symbol standing in
  for it."
  A second calibration, for an exploratory or technique-based idea (one
  illustration among the many devices listed above -- see DEVICE
  VOCABULARY; do not treat this specific fade/contrast device as the
  default move for an exploratory candidate): "Imagine the tattoo starting
  sharp and photographic on one side, then fading into loose linework on
  the other — echoing how clear the memory still is, even as it gets
  further away."

10. INSPIRE, DON'T FLATTEN OR OVERLOAD — A candidate exists to make the
client feel something real is possible and want to see more of it, not
just to technically satisfy CONCRETENESS (rule 8). A description can pass
that rule's letter and still fail its purpose, in either of two directions
-- live-reported, both directions, from real candidates:
  - TOO STERILE: a purely geometric or structural description with no
    sensory, textural or emotional quality reads as a diagram, not a
    tattoo idea, even though it is technically a concrete image rather
    than a category. "The steady grid inside an imperfect circle marks
    that choice as something you made on purpose" and "a single bird,
    wings mid-fold from a wide spread into a settled, tucked position" were
    both rejected as abstract and lifeless, underwhelming rather than
    inspiring. Give the mark some visual life -- texture, weight, gesture,
    the qualities that would actually show up in the linework -- without
    inventing content the story doesn't support (rule 6 still applies).
  - TOO MUCH TO HOLD IN MIND: a description stacking several distinct
    visual claims into one candidate (a shape, doing one thing, that also
    means a second thing, explained via a third technical detail) asks the
    client to mentally assemble a small design brief before they can
    picture anything, overwhelming rather than inspiring them. One clear,
    vivid image beats an accurate but overloaded one. If an idea genuinely
    needs more than that to do it justice, it belongs in the framed
    lane's linked-panel-sequence shape (rule 1), given room across a few
    linked beats -- not squeezed into a single-image candidate's one
    sentence.
  Read every candidate once as a client would, picturing it cold: if it
  reads as a diagram, or takes real effort to assemble into one image
  before it can be pictured at all, revise or drop it rather than counting
  it toward the batch.

11. OUTPUT — valid structured data via the record_associations tool.`;
}

const resolutionStateEnum = ["concrete", "needs_client_specific_detail"] as const;

/** Rule 1's 5 candidate lanes (2026-09, pre-qualifying visual-style question; relabeled 2026-09-23 to match Christos's book "Positive Inking") -- mirrors engine's AssociationLane type exactly; kept as its own literal list here (not imported) the same way sourceCategoryEnum/resolutionStateEnum already are, since this file's enums feed the JSON tool schema sent to the model, not just TypeScript types. */
const laneEnum = ["abstract_symbolic", "illustrative", "typography", "framed", "narrative_collage"] as const;

/** Framed lane's own sub-attribute (rule 1) -- meaningful only when lane is "framed"; see the visualCandidateSchema refine below for the requirement. */
const renderingStyleEnum = ["realism", "anime", "artistic_line_art", "photographic"] as const;

const sourceCategoryEnum = [
  "personal_artefact",
  "personal_memory",
  "personal_place",
  "personal_person",
  "new_materialisation",
  "public_artefact",
  "artistic_symbol",
  "artistic_reference",
  "tattoo_reference",
] as const;

const rankingProps = {
  personal_relevance: { type: "number", minimum: 0, maximum: 10 },
  story_relevance: { type: "number", minimum: 0, maximum: 10 },
  visual_potential: { type: "number", minimum: 0, maximum: 10 },
  originality: { type: "number", minimum: 0, maximum: 10 },
  genericity: { type: "number", minimum: 0, maximum: 10 },
  reference_availability: { type: "number", minimum: 0, maximum: 10 },
} as const;

export const associationToolInputSchema = {
  type: "object",
  properties: {
    visual_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          personal_meaning: { type: "string" },
          source_category: { type: "string", enum: sourceCategoryEnum },
          resolution_state: { type: "string", enum: resolutionStateEnum },
          follow_up_prompt: { type: "string" },
          device_id: { type: "string" },
          lane: { type: "string", enum: laneEnum },
          rendering_style: { type: "string", enum: renderingStyleEnum },
          ...rankingProps,
        },
        required: [
          "description",
          "personal_meaning",
          "source_category",
          "resolution_state",
          "device_id",
          "lane",
          ...Object.keys(rankingProps),
        ],
      },
    },
    place_role: { type: "string", enum: ["none", "subject", "setting", "ambiguous"] },
    place_role_reasoning: { type: "string" },
    spatial_language_present: { type: "boolean" },
    has_text_or_handwriting: { type: "boolean" },
    has_likeness: { type: "boolean" },
    text_is_primary: { type: "boolean" },
    likeness_is_primary: { type: "boolean" },
    primary_element_type: { type: "string", enum: ["object", "person", "place", "text", "animal", "abstract", "mixed"] },
    contradictions_noticed: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          resolutions: { type: "array", items: { type: "string" } },
        },
        required: ["description", "resolutions"],
      },
    },
  },
  required: [
    "visual_candidates",
    "place_role",
    "place_role_reasoning",
    "spatial_language_present",
    "has_text_or_handwriting",
    "has_likeness",
    "text_is_primary",
    "likeness_is_primary",
    "primary_element_type",
    "contradictions_noticed",
  ],
} as const;

const visualCandidateSchema = z
  .object({
    description: z.string(),
    personal_meaning: z.string(),
    source_category: z.enum(sourceCategoryEnum),
    resolution_state: z.enum(resolutionStateEnum),
    // Real live-tested behaviour (2026-09-09): the model sometimes emits an
    // explicit JSON null for follow_up_prompt on a candidate that doesn't
    // need one, not just omitting the key -- a plain z.string().optional()
    // accepts undefined but rejects null, so that alone previously failed
    // schema validation for the whole batch over a single harmless field.
    // Treat null the same as absent.
    follow_up_prompt: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    // 2026-09-09: which DEVICE VOCABULARY entry this candidate was built
    // from -- the roster's own review cycle depends on this being present
    // and correct, but a malformed/unrecognised value here is a tracking
    // gap, not a reason to drop an otherwise-good candidate from the
    // batch. Kept lenient at THIS layer (same null-coercion pattern as
    // follow_up_prompt above) -- the route is the one place that
    // cross-checks it against the real catalog and decides what to do
    // with a value that doesn't match.
    device_id: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    // Rule 1's 5-lane classification (2026-09) -- unlike device_id, this is
    // a small, fixed, well-known set (not a runtime-loaded roster), so an
    // out-of-enum value fails validation directly rather than needing route-
    // level sanitization. Still nullable/optional (same lenient pattern as
    // follow_up_prompt/device_id above): a missing or malformed lane tag is
    // a tracking gap, not a reason to drop an otherwise-good candidate.
    lane: z
      .enum(laneEnum)
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    // Framed lane's own sub-attribute (rule 1) -- required when
    // lane is "framed" (see the refine below), meaningless otherwise.
    rendering_style: z
      .enum(renderingStyleEnum)
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    personal_relevance: z.number().min(0).max(10),
    story_relevance: z.number().min(0).max(10),
    visual_potential: z.number().min(0).max(10),
    originality: z.number().min(0).max(10),
    genericity: z.number().min(0).max(10),
    reference_availability: z.number().min(0).max(10),
  })
  // A candidate that needs one more detail from the client must actually carry
  // the question that would surface it -- otherwise the UI has a gate with
  // nothing to ask, and the placeholder would silently confirm unresolved.
  // This is the OTHER real failure shape found live (2026-09-09): the model
  // not reliably including follow_up_prompt on a candidate that DOES need
  // it, across a large batch. Nothing above can fix that (the field is
  // genuinely missing, not null) -- the route salvages the rest of the
  // batch around this one instead, see parseAssociationResult below.
  .refine((c) => c.resolution_state !== "needs_client_specific_detail" || !!c.follow_up_prompt?.trim(), {
    message: "follow_up_prompt is required when resolution_state is needs_client_specific_detail",
    path: ["follow_up_prompt"],
  })
  // Same shape as the follow_up_prompt refine above: rule 1 scopes
  // rendering_style to the framed lane specifically, so a candidate in
  // that lane with no rendering_style is genuinely incomplete, not just
  // missing an optional nicety.
  .refine((c) => c.lane !== "framed" || !!c.rendering_style, {
    message: "rendering_style is required when lane is framed",
    path: ["rendering_style"],
  });

export const associationResultSchema = z.object({
  visual_candidates: z.array(visualCandidateSchema),
  place_role: z.enum(["none", "subject", "setting", "ambiguous"]),
  place_role_reasoning: z.string(),
  spatial_language_present: z.boolean(),
  has_text_or_handwriting: z.boolean(),
  has_likeness: z.boolean(),
  text_is_primary: z.boolean(),
  likeness_is_primary: z.boolean(),
  primary_element_type: z.enum(["object", "person", "place", "text", "animal", "abstract", "mixed"]),
  contradictions_noticed: z.array(z.object({ description: z.string(), resolutions: z.array(z.string()) })),
});

export type AssociationModelOutput = z.infer<typeof associationResultSchema>;

/** One candidate dropped from a batch by parseAssociationResult, for logging -- never carries the candidate's own description/personal_meaning text (real story-derived content), only structural detail, matching this project's own never-log-story-content discipline. */
export interface DroppedAssociationCandidate {
  index: number;
  resolutionState: string | undefined;
  issues: string;
}

export interface AssociationParseResult {
  /** null only when the whole request must fail: zero candidates survived, or a non-candidate field (place_role, contradictions_noticed, ...) failed validation. */
  data: AssociationModelOutput | null;
  droppedCandidates: DroppedAssociationCandidate[];
}

/**
 * A single malformed candidate among 9-12 real ones used to fail the whole
 * batch (live-tested 2026-09-09: 2 of 4 real calls 502'd with zero
 * candidates over one bad follow_up_prompt). Validates visual_candidates
 * entry-by-entry instead of as one array, keeps whatever survives, and only
 * fails outright once nothing does -- every other field (place_role,
 * contradictions_noticed, ...) is still validated as strictly as before via
 * the final associationResultSchema pass, unchanged from prior behaviour.
 */
export function parseAssociationResult(raw: unknown): AssociationParseResult {
  const droppedCandidates: DroppedAssociationCandidate[] = [];
  const rawCandidates = Array.isArray((raw as { visual_candidates?: unknown })?.visual_candidates)
    ? (raw as { visual_candidates: unknown[] }).visual_candidates
    : [];

  const validCandidates: z.infer<typeof visualCandidateSchema>[] = [];
  rawCandidates.forEach((candidate, index) => {
    const parsed = visualCandidateSchema.safeParse(candidate);
    if (parsed.success) {
      validCandidates.push(parsed.data);
      return;
    }
    const resolutionState = (candidate as { resolution_state?: unknown })?.resolution_state;
    droppedCandidates.push({
      index,
      resolutionState: typeof resolutionState === "string" ? resolutionState : undefined,
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; "),
    });
  });

  if (validCandidates.length === 0) {
    return { data: null, droppedCandidates };
  }

  const reconstructed = { ...(raw as Record<string, unknown>), visual_candidates: validCandidates };
  const validated = associationResultSchema.safeParse(reconstructed);
  if (!validated.success) {
    return { data: null, droppedCandidates };
  }
  return { data: validated.data, droppedCandidates };
}

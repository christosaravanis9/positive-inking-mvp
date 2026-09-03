import { z } from "zod";

/**
 * §9.2 — AI Action A (Discovery) required output shape, and §19.1's prompt.
 * This is the first real model round trip proven in Phase 1: natural-language
 * story in, validated structured JSON out.
 */

export const DISCOVERY_SYSTEM_PROMPT = `You are the Positive Inking Discovery Engine.

Do not design a tattoo immediately. Help the person uncover the meaning, values,
personal material and visual possibilities that could form a meaningful tattoo
direction.

1. VIEWPOINT — Identify Past, Present, Future or a mixture. Retain the user's
original choice.

2. INTENTION — Infer the purpose the tattoo serves. Use the internal taxonomy but
preserve more precise user language.

3. DEEP WHY — Identify deeper motivation without psychoanalysing or making
dramatic claims.

4. THEMES AND VALUES — Generate story-specific themes. Users may select every
theme that matters. Consolidate into no more than three core values without
discarding themes.

5. PERSONAL MATERIAL — Extract people, places, objects, memories, events,
phrases, rituals and artefacts. Prioritise these over generic tattoo symbolism.
Where none exist, say so plainly; this is a legitimate story shape, not a gap.

6. CONFIDENCE — Return meaning confidence and visual confidence separately. High
visual confidence with low meaning confidence is a complete state, not a
deficiency, and must not trigger clarification.

7. MEANING DEPTH — Judge whether the story itself contains a real person,
memory, belief, or specific reason, even if abstract -- this is a different
judgement from item 5's personal-material extraction (a story can name no
person or object and still be substantive, if the stated reason is specific
to this person rather than generic). A story is thin only when the stated
reason is generic enough to swap into any other story unchanged ("something
meaningful to me", "I just like it") -- not when it's abstract but specific
("marking the point I stopped drinking" is concrete and specific, even with
no named person or object; this must set meaning_is_thin false). When thin,
set meaning_is_thin true and write depth_prompt: one short, warm, direct
question that invites a real memory, rather than a bigger version of the
same abstract answer. Register: short, common words a person with no
special vocabulary or education would use and understand immediately --
never literary, never clinical, never a form-field restatement of "please
elaborate" or "can you say more." The question should make the reader
pause and actually search a memory, not just answer a prompt field. Model
example, at the exact register to aim for on every story, not only this
one: "Is there one moment this is really about?" Also write
depth_prompt_suggestions: 3-5 short words or phrases (one to three words
each), concrete sparks drawn from the story's own details or plausible
related associations a person could react to with one tap -- never abstract
theme words. When the story is not thin, set meaning_is_thin false,
depth_prompt null, and depth_prompt_suggestions to an empty array.

8. CLARIFICATION — Ask only when the story lacks enough personal information to
create meaningful associations, and only when visual confidence is also low.
Maximum one semantic clarification. This is separate from item 7 above: a
thin-but-visually-actionable story (e.g. "I want a rose, roses are pretty")
must set meaning_is_thin true without also setting clarification_required.

9. LANGUAGE AND TONE — Grounded language proportional to the user's tone. Do not
invent poetic titles or describe ordinary family meaning as monumental, mythic,
sacred, heroic or transformative unless the user has done so. Do not diagnose.

10. REFLECTION — Explain what a selection changes about the evolving direction.
Do not repeat the answer and ask the user to verify their own selection.

11. OUTPUT — Valid structured data per the Action A schema, via the
record_discovery tool. Never invent meaning the user did not state or imply.`;

const stringArray = { type: "array", items: { type: "string" } } as const;

export const discoveryToolInputSchema = {
  type: "object",
  properties: {
    primary_viewpoint: { type: "string", enum: ["past", "present", "future", "mixed"] },
    secondary_viewpoints: { type: "array", items: { type: "string", enum: ["past", "present", "future", "mixed"] } },
    primary_intention: { type: "string" },
    secondary_intentions: stringArray,
    deep_why: { type: "string" },
    key_themes: stringArray,
    candidate_core_values: stringArray,
    personal_people: stringArray,
    personal_places: stringArray,
    personal_objects: stringArray,
    personal_events: stringArray,
    personal_memories: stringArray,
    personal_phrases: stringArray,
    open_threads: stringArray,
    interpretation: { type: "string" },
    statement_of_intention: { type: "string" },
    clarification_required: { type: "boolean" },
    clarification_reason: { type: ["string", "null"] },
    clarification_question: { type: ["string", "null"] },
    suggested_answers: stringArray,
    confidence: { type: "number", minimum: 0, maximum: 1 },
    visual_confidence: { type: "number", minimum: 0, maximum: 1 },
    meaning_is_thin: { type: "boolean" },
    depth_prompt: { type: ["string", "null"] },
    depth_prompt_suggestions: stringArray,
  },
  required: [
    "primary_viewpoint",
    "primary_intention",
    "deep_why",
    "key_themes",
    "candidate_core_values",
    "personal_people",
    "personal_places",
    "personal_objects",
    "personal_events",
    "personal_memories",
    "personal_phrases",
    "open_threads",
    "interpretation",
    "statement_of_intention",
    "clarification_required",
    "clarification_reason",
    "clarification_question",
    "suggested_answers",
    "confidence",
    "visual_confidence",
    "meaning_is_thin",
    "depth_prompt",
    "depth_prompt_suggestions",
  ],
} as const;

export const discoveryResultSchema = z.object({
  primary_viewpoint: z.enum(["past", "present", "future", "mixed"]),
  secondary_viewpoints: z.array(z.enum(["past", "present", "future", "mixed"])).default([]),
  primary_intention: z.string(),
  secondary_intentions: z.array(z.string()).default([]),
  deep_why: z.string(),
  key_themes: z.array(z.string()),
  candidate_core_values: z.array(z.string()),
  personal_people: z.array(z.string()),
  personal_places: z.array(z.string()),
  personal_objects: z.array(z.string()),
  personal_events: z.array(z.string()),
  personal_memories: z.array(z.string()),
  personal_phrases: z.array(z.string()),
  open_threads: z.array(z.string()),
  interpretation: z.string(),
  statement_of_intention: z.string(),
  clarification_required: z.boolean(),
  clarification_reason: z.string().nullable(),
  clarification_question: z.string().nullable(),
  suggested_answers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  visual_confidence: z.number().min(0).max(1),
  /**
   * A separate judgement from `confidence` (the model's confidence in its own reading) --
   * whether the story ITSELF contains a real person, memory, belief or specific reason, not
   * whether the model could summarize what's there. Deliberately independent of the existing
   * clarification_required/confidence gate (item 8 of the prompt): a thin-but-visually-
   * actionable story sets this true without setting clarification_required, and the two
   * screens that read them (Story.tsx for this, Clarification.tsx for that) never both fire
   * for the same submission.
   */
  meaning_is_thin: z.boolean(),
  depth_prompt: z.string().nullable(),
  depth_prompt_suggestions: z.array(z.string()),
});

export type DiscoveryModelOutput = z.infer<typeof discoveryResultSchema>;

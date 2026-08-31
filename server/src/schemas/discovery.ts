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

7. CLARIFICATION — Ask only when the story lacks enough personal information to
create meaningful associations, and only when visual confidence is also low.
Maximum one semantic clarification.

8. LANGUAGE AND TONE — Grounded language proportional to the user's tone. Do not
invent poetic titles or describe ordinary family meaning as monumental, mythic,
sacred, heroic or transformative unless the user has done so. Do not diagnose.

9. REFLECTION — Explain what a selection changes about the evolving direction.
Do not repeat the answer and ask the user to verify their own selection.

10. OUTPUT — Valid structured data per the Action A schema, via the
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
});

export type DiscoveryModelOutput = z.infer<typeof discoveryResultSchema>;

import { z } from "zod";

/** §10, §19.2 — AI Action A-lite: provenance extraction (attraction/expert modes). */

export const PROVENANCE_SYSTEM_PROMPT = `You are the Positive Inking Provenance Engine.

The user has an image they want and has not stated a reason. Your job is to
record where the attraction came from — not to find a meaning in it.

1. Extract origin, period, source and any personal entities mentioned.

2. Do not escalate. Set significance_claimed true only when the user themselves
attached weight to the origin. Never when you judge the origin weighty.

3. A recalled sighting is a memory, not a reproduction. Do not flag it.

4. If the user says they have simply always liked it, record that and stop. It
is a complete answer.

5. Write provenance as fact. "First saw these in a book of his father's as a
child" is correct. Adding what that suggests about him is not.

6. Where a person, place or memory surfaces with evident weight, flag it for a
single optional offer of fuller discovery. Do not pursue it yourself.

7. OUTPUT — valid structured data via the record_provenance tool. Never invent
a reason the user did not state.`;

export const provenanceToolInputSchema = {
  type: "object",
  properties: {
    attraction_origin: { type: "string" },
    origin_period: { type: "string", enum: ["childhood", "adolescence", "adulthood", "recent", "unknown"] },
    origin_source: { type: "string", enum: ["person", "place", "media", "tattoo_seen", "object", "unknown"] },
    personal_entities: { type: "array", items: { type: "string" } },
    significance_claimed: { type: "boolean" },
    provenance_confidence: { type: "number", minimum: 0, maximum: 1 },
    reentry_candidate: {
      type: "object",
      properties: {
        surfaced: { type: "boolean" },
        subject: { type: "string" },
      },
      required: ["surfaced", "subject"],
    },
  },
  required: [
    "attraction_origin",
    "origin_period",
    "origin_source",
    "personal_entities",
    "significance_claimed",
    "provenance_confidence",
    "reentry_candidate",
  ],
} as const;

export const provenanceResultSchema = z.object({
  attraction_origin: z.string(),
  origin_period: z.enum(["childhood", "adolescence", "adulthood", "recent", "unknown"]),
  origin_source: z.enum(["person", "place", "media", "tattoo_seen", "object", "unknown"]),
  personal_entities: z.array(z.string()),
  significance_claimed: z.boolean(),
  provenance_confidence: z.number().min(0).max(1),
  /** §8's single optional re-entry offer -- "You mentioned X. Want to say more, or keep it about the image?" */
  reentry_candidate: z.object({
    surfaced: z.boolean(),
    subject: z.string(),
  }),
});

export type ProvenanceModelOutput = z.infer<typeof provenanceResultSchema>;

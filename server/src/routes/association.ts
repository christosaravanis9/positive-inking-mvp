import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { sendModelErrorResponse } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { ASSOCIATION_SYSTEM_PROMPT, associationResultSchema, associationToolInputSchema } from "../schemas/association.js";

const requestSchema = z.object({
  confirmed_meaning_or_provenance: z.string().min(1),
  known_personal_material: z.array(z.string()).default([]),
  // 2026-09-07 -- Screen 7's per-candidate re-roll, Why-driven path only.
  // Present together or not at all: a plain re-roll (no reason given) never
  // reaches this route at all, it stays on the client-only reserve-pool swap.
  avoid_descriptions: z.array(z.string()).default([]),
  dismissal_reason: z.string().optional(),
  // 2026-09-09 -- every reason the client has given for THIS slot across
  // every round so far (this round's own dismissal_reason included as the
  // last entry). Additive alongside dismissal_reason, not a replacement:
  // older clients/tests that only ever send the single latest reason still
  // work unchanged, they just lose the cross-round context this adds.
  dismissal_reason_history: z.array(z.string()).default([]),
  // 2026-09-07 (later) -- Screen 7's "Build upon" direct-edit refinement.
  // A genuinely different ask from the pair above: the client isn't
  // rejecting a candidate, they're developing this exact one further.
  // Present together or not at all, and mutually exclusive with
  // avoid_descriptions/dismissal_reason in practice (the client only ever
  // sends one shape per request) -- not enforced at the schema level since
  // the two paths never collide from the one call site that sends each.
  refine_original_description: z.string().optional(),
  refine_user_edit: z.string().optional(),
});

export const associationRouter = Router();

associationRouter.post("/api/associations", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  const {
    confirmed_meaning_or_provenance,
    known_personal_material,
    avoid_descriptions,
    dismissal_reason,
    dismissal_reason_history,
    refine_original_description,
    refine_user_edit,
  } = parsed.data;
  const reasonHistory = dismissal_reason_history.map((r) => r.trim()).filter(Boolean);
  const userMessage = [
    `Confirmed meaning or provenance:\n${confirmed_meaning_or_provenance}`,
    known_personal_material.length > 0
      ? `Known personal material already surfaced:\n- ${known_personal_material.join("\n- ")}`
      : "No personal material has surfaced yet in this story.",
    // Refinement (2026-09-07, later -- "Build upon") is checked first and is
    // mutually exclusive with the reject-and-replace framing below in
    // practice: this is the client directly developing an idea they already
    // want, not rejecting one. Framing this the same way as a rejection
    // ("propose something different") would be actively wrong here -- the
    // whole point is to NOT discard what the client wrote.
    refine_user_edit?.trim()
      ? [
          `The client wants to develop one of their own candidate ideas further -- this is NOT a rejection, do not propose something different.`,
          `Original candidate: "${refine_original_description ?? ""}"`,
          `The client's own edit or addition to it: "${refine_user_edit.trim()}"`,
          `Respond as an Artist suggestion: a concrete development of exactly this idea, grounded in what the client themselves wrote -- keep their intent and the substance of their edit intact, and complete/sharpen it into one polished candidate. This is iteration on the client's own idea, not a fresh alternative: do not ignore, water down, or override what they specifically wrote. Follow every other rule in your system instructions.`,
        ].join("\n")
      : avoid_descriptions.length > 0
        ? [
            // 2026-09-09: this list now also includes candidates currently
            // showing in OTHER slots on the same screen, not only this
            // slot's own rejected history -- a fresh candidate must not
            // duplicate or closely echo something the client can already
            // see elsewhere right now, even if they never explicitly
            // rejected that other one.
            `Do not propose anything close to the following -- some are candidates the client already saw and rejected for this slot, others are simply what's already showing elsewhere on their screen right now:`,
            `- ${avoid_descriptions.join("\n- ")}`,
            // 2026-09-09: reasonHistory (when the client has rejected more than
            // once for this slot) replaces the old single-reason line entirely
            // -- it already includes this round's own reason as its last
            // entry, so showing both would just repeat it. A numbered list
            // lets the model see the accumulated shape of what's been wrong
            // across rounds ("too similar" -> "no form or life" ->
            // "metaphorically weak"), not just the most recent complaint in
            // isolation, which previously let it keep circling the same
            // territory a different way each time.
            reasonHistory.length > 1
              ? [
                  `The client has given a reason each time so far, in order:`,
                  ...reasonHistory.map((r, i) => `  ${i + 1}. "${r}"`),
                  `Read these as a cumulative pattern, not isolated complaints -- what do they add up to about what keeps going wrong, and propose something that avoids that pattern, not just the most recent single reason.`,
                ].join("\n")
              : dismissal_reason?.trim()
                ? `Reason given: "${dismissal_reason.trim()}"`
                : "",
            `Propose exactly one fresh alternative candidate -- distinct from all of the above, still grounded in the story, following every rule in your system instructions. If a reason was given, let it genuinely inform what you propose next, without contradicting anything else already established about the story.`,
          ]
            .filter(Boolean)
            .join("\n")
        : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await callModelForStructuredOutput({
      stage: "association",
      system: ASSOCIATION_SYSTEM_PROMPT,
      userMessage,
      tool: {
        name: "record_associations",
        description: "Record candidate visual associations and concept classification.",
        input_schema: associationToolInputSchema,
      },
      maxTokens: 4096,
      abortSignal: abortSignalForRequest(req, res),
    });

    const validated = associationResultSchema.safeParse(result.data);
    if (!validated.success) {
      res.status(502).json({
        error: { code: "model_invalid_response", message: "Model response failed schema validation.", detail: validated.error.format() },
      });
      return;
    }

    res.json({ data: validated.data });
  } catch (err) {
    sendModelErrorResponse(res, err);
  }
});

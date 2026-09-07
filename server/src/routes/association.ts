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

  const { confirmed_meaning_or_provenance, known_personal_material, avoid_descriptions, dismissal_reason, refine_original_description, refine_user_edit } =
    parsed.data;
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
          `Refine and develop exactly this idea, grounded in what the client themselves wrote -- keep their intent and the substance of their edit intact, and complete/sharpen it into one polished candidate. This is iteration on the client's own idea, not a fresh alternative: do not ignore, water down, or override what they specifically wrote. Follow every other rule in your system instructions.`,
        ].join("\n")
      : avoid_descriptions.length > 0
        ? [
            `The client already saw and rejected the following candidate(s) for this story:`,
            `- ${avoid_descriptions.join("\n- ")}`,
            dismissal_reason?.trim() ? `Reason given: "${dismissal_reason.trim()}"` : "",
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

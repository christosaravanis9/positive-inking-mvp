import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { sendModelErrorResponse } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { buildAssociationSystemPrompt, associationToolInputSchema, parseAssociationResult, DEFAULT_DEVICE_ROSTER } from "../schemas/association.js";
import { logAssociationCandidateDropped } from "../modelTiming.js";
import { getActiveDeviceRoster } from "../deviceRosterStore.js";

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

  // 2026-09-09/10: the roster is read fresh per request, not cached at
  // module load -- a review can change it between calls, and every call
  // should see the current active set, not whatever was active when the
  // server started.
  //
  // 2026-09-10, live-reported PRODUCTION-BREAKING BUG, fixed: this used to
  // sit inside the same try/catch as the model call itself, so any storage
  // failure (confirmed live: the device_roster_state table did not exist
  // yet in the real Supabase project -- the migration script had been
  // generated but never actually run there) took down candidate generation
  // ENTIRELY, surfacing as a raw database error in place of the Association
  // response. The device-rotation system is a supplementary optimisation on
  // top of candidate generation, never a hard dependency of it -- it must
  // degrade to a safe, reasonable default roster on ANY failure, silently
  // from the client's point of view, rather than ever block the core
  // feature. Logged, never thrown further.
  let roster: { active: Awaited<ReturnType<typeof getActiveDeviceRoster>>["active"]; reserve: Awaited<ReturnType<typeof getActiveDeviceRoster>>["reserve"] };
  try {
    roster = await getActiveDeviceRoster();
  } catch (err) {
    console.error("[device-roster] falling back to default roster -- getActiveDeviceRoster failed:", err instanceof Error ? err.message : err);
    roster = DEFAULT_DEVICE_ROSTER;
  }

  try {
    const result = await callModelForStructuredOutput({
      stage: "association",
      system: buildAssociationSystemPrompt(roster),
      userMessage,
      tool: {
        name: "record_associations",
        description: "Record candidate visual associations and concept classification.",
        input_schema: associationToolInputSchema,
      },
      maxTokens: 4096,
      abortSignal: abortSignalForRequest(req, res),
    });

    // Per-candidate salvage (2026-09-09), not whole-batch pass/fail: a real
    // batch of 9-12 candidates has previously been discarded entirely --
    // zero candidates reaching the client -- over one malformed candidate's
    // follow_up_prompt. Every dropped candidate is logged (never its own
    // description/personal_meaning, only structural detail) so a regression
    // in how often this fires is visible, not silently invisible again.
    const { data: validated, droppedCandidates } = parseAssociationResult(result.data);
    for (const dropped of droppedCandidates) {
      logAssociationCandidateDropped(dropped);
    }
    if (!validated) {
      res.status(502).json({
        error: { code: "model_invalid_response", message: "Model response failed schema validation.", detail: { droppedCandidates } },
      });
      return;
    }

    // 2026-09-09: a device_id the model got wrong (typo'd, or an id that
    // isn't in the real catalog at all) shouldn't cost the candidate its
    // place in the batch -- CONCRETENESS/INSPIRE still govern whether it's
    // good, not whether its own self-reported tracking tag is well-formed.
    // Null it out instead so the client never echoes a bad id back into an
    // analytics event that would just fail validation there and silently
    // lose the signal -- and log it, since a real, recurring mismatch here
    // would mean the DEVICE VOCABULARY instruction itself needs attention.
    const knownDeviceIds = new Set([...roster.active, ...roster.reserve].map((d) => d.id));
    const sanitized = {
      ...validated,
      visual_candidates: validated.visual_candidates.map((c) => {
        if (c.device_id && !knownDeviceIds.has(c.device_id)) {
          console.warn(`[device-roster] unrecognised device_id from model: "${c.device_id}"`);
          return { ...c, device_id: undefined };
        }
        return c;
      }),
    };

    res.json({ data: sanitized });
  } catch (err) {
    sendModelErrorResponse(res, err);
  }
});

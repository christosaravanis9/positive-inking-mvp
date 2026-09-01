import { Router } from "express";
import { z } from "zod";
import { computeBlueprintSectionEligibility, computeReadiness } from "@positive-inking/engine";
import { callModelForStructuredOutput } from "../modelClient.js";
import { ModelError } from "../errors.js";
import { BLUEPRINT_SYSTEM_PROMPT, blueprintResultSchema, blueprintToolInputSchema } from "../schemas/blueprint.js";

const requestSchema = z.object({
  journey_mode: z.enum(["full", "attraction", "expert", "manual"]),
  significance_claimed: z.boolean().default(false),
  themes_surfaced: z.boolean().default(false),
  statement_user_authored: z.boolean().default(false),
  interpretation_confidence: z.enum(["", "low", "standard"]).default(""),
  any_required_reference_missing: z.boolean().default(false),
  has_unresolved_contradiction: z.boolean().default(false),
  /** A prepared free-text summary of everything confirmed so far. Building this
   * from the full ProjectState is a Phase 4/6 UI concern; this route only
   * needs the text and the flags above. */
  confirmed_project_summary: z.string().min(1),
});

export const blueprintRouter = Router();

blueprintRouter.post("/api/blueprint", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  const input = parsed.data;

  if (input.journey_mode === "manual") {
    res.status(400).json({
      error: {
        code: "bad_request",
        message: "manual mode never calls the Blueprint Writer -- build Working Notes locally via the engine's buildWorkingNotes instead.",
      },
    });
    return;
  }

  try {
    const result = await callModelForStructuredOutput({
      system: BLUEPRINT_SYSTEM_PROMPT,
      userMessage: `Journey mode: ${input.journey_mode}\n\nConfirmed project summary:\n${input.confirmed_project_summary}`,
      tool: {
        name: "write_blueprint",
        description: "Write the structured Positive Inking Blueprint content.",
        input_schema: blueprintToolInputSchema,
      },
      maxTokens: 4096,
    });

    const validated = blueprintResultSchema.safeParse(result.data);
    if (!validated.success) {
      res.status(502).json({
        error: { code: "model_invalid_response", message: "Model response failed schema validation.", detail: validated.error.format() },
      });
      return;
    }

    // Structural enforcement of §17.2 -- the model was asked to write every
    // section; whatever the eligibility rule excludes is nulled here,
    // regardless of what came back. Readiness is never model output.
    const eligibility = computeBlueprintSectionEligibility({
      journeyMode: input.journey_mode,
      significanceClaimed: input.significance_claimed,
      themesSurfaced: input.themes_surfaced,
      statementUserAuthored: input.statement_user_authored,
    });

    const readiness = computeReadiness({
      interpretationConfidence: input.interpretation_confidence,
      anyRequiredReferenceMissing: input.any_required_reference_missing,
      hasUnresolvedContradiction: input.has_unresolved_contradiction,
    });

    const model = validated.data;
    const blueprint = {
      story: eligibility.storySection === "story" ? model.story : null,
      why_this_image: eligibility.storySection === "why_this_image" ? model.why_this_image : null,
      why: eligibility.includeYourWhy ? model.why : null,
      what_matters_most: eligibility.includeWhatMattersMost ? model.what_matters_most : null,
      visual_direction: model.visual_direction,
      artistic_direction: model.artistic_direction,
      placement: model.placement,
      design_considerations: model.design_considerations,
      statement_of_inspiration: eligibility.includeStatementOfInspiration ? model.statement_of_inspiration : null,
      artist_brief: model.artist_brief,
      readiness,
    };

    res.json({ data: blueprint });
  } catch (err) {
    const modelError = err instanceof ModelError ? err : new ModelError("model_network_error", (err as Error).message);
    const status = modelError.code === "model_not_configured" ? 503 : 502;
    res.status(status).json({ error: { code: modelError.code, message: modelError.message } });
  }
});

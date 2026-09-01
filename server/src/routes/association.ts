import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { ModelError } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { ASSOCIATION_SYSTEM_PROMPT, associationResultSchema, associationToolInputSchema } from "../schemas/association.js";

const requestSchema = z.object({
  confirmed_meaning_or_provenance: z.string().min(1),
  known_personal_material: z.array(z.string()).default([]),
});

export const associationRouter = Router();

associationRouter.post("/api/associations", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  const { confirmed_meaning_or_provenance, known_personal_material } = parsed.data;
  const userMessage = [
    `Confirmed meaning or provenance:\n${confirmed_meaning_or_provenance}`,
    known_personal_material.length > 0
      ? `Known personal material already surfaced:\n- ${known_personal_material.join("\n- ")}`
      : "No personal material has surfaced yet in this story.",
  ].join("\n\n");

  try {
    const result = await callModelForStructuredOutput({
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
    const modelError = err instanceof ModelError ? err : new ModelError("model_network_error", (err as Error).message);
    const status = modelError.code === "model_not_configured" ? 503 : 502;
    res.status(status).json({ error: { code: modelError.code, message: modelError.message } });
  }
});

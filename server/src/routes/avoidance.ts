import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { ModelError } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { AVOIDANCE_SYSTEM_PROMPT, avoidanceResultSchema, avoidanceToolInputSchema } from "../schemas/avoidance.js";

const requestSchema = z.object({
  project_summary: z.string().min(1),
});

export const avoidanceRouter = Router();

avoidanceRouter.post("/api/avoidances", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  try {
    const result = await callModelForStructuredOutput({
      system: AVOIDANCE_SYSTEM_PROMPT,
      userMessage: `Confirmed project so far:\n${parsed.data.project_summary}`,
      tool: {
        name: "suggest_avoidances",
        description: "Suggest project-specific things the client might want to avoid.",
        input_schema: avoidanceToolInputSchema,
      },
      abortSignal: abortSignalForRequest(req, res),
    });

    const validated = avoidanceResultSchema.safeParse(result.data);
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

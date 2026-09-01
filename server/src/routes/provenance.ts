import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { sendModelErrorResponse } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { PROVENANCE_SYSTEM_PROMPT, provenanceResultSchema, provenanceToolInputSchema } from "../schemas/provenance.js";

const requestSchema = z.object({
  raw_story: z.string().min(1),
});

export const provenanceRouter = Router();

provenanceRouter.post("/api/provenance", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  try {
    const result = await callModelForStructuredOutput({
      stage: "provenance",
      system: PROVENANCE_SYSTEM_PROMPT,
      userMessage: `The user described an image they want, without stating why:\n${parsed.data.raw_story}`,
      tool: {
        name: "record_provenance",
        description: "Record the structured provenance extraction for an attraction-mode image.",
        input_schema: provenanceToolInputSchema,
      },
      abortSignal: abortSignalForRequest(req, res),
    });

    const validated = provenanceResultSchema.safeParse(result.data);
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

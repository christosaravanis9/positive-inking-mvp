import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { sendModelErrorResponse } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import { STYLE_HINTS_SYSTEM_PROMPT, styleHintsToolInputSchema, toStyleHints } from "../schemas/styleHints.js";

const requestSchema = z.object({
  confirmed_meaning_or_provenance: z.string().min(1),
});

export const styleHintsRouter = Router();

styleHintsRouter.post("/api/style-hints", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  const { confirmed_meaning_or_provenance } = parsed.data;

  try {
    const result = await callModelForStructuredOutput({
      stage: "style_hints",
      system: STYLE_HINTS_SYSTEM_PROMPT,
      userMessage: `Confirmed meaning or provenance:\n${confirmed_meaning_or_provenance}`,
      tool: {
        name: "write_style_hints",
        description: "Write one short, loose, illustrative hint per visual-approach lane, grounded in this client's own story.",
        input_schema: styleHintsToolInputSchema,
      },
      abortSignal: abortSignalForRequest(req, res),
    });

    const hints = toStyleHints(result.data);
    if (!hints) {
      res.status(502).json({
        error: { code: "model_invalid_response", message: "Model response failed schema validation." },
      });
      return;
    }

    res.json({ data: { hints } });
  } catch (err) {
    sendModelErrorResponse(res, err);
  }
});

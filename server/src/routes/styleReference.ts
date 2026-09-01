import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { ModelError } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import {
  STYLE_REFERENCE_SYSTEM_PROMPT,
  styleReferenceToolInputSchema,
  toStyleReferenceResolution,
  RESOLVABLE_STYLE_DIMENSIONS,
} from "../schemas/styleReference.js";

const requestSchema = z.object({
  style_reference: z.string().min(1),
  already_confirmed: z.record(z.string()).default({}),
});

export const styleReferenceRouter = Router();

styleReferenceRouter.post("/api/style-reference", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
    return;
  }

  const { style_reference, already_confirmed } = parsed.data;
  const alreadyConfirmedFiltered = Object.fromEntries(
    Object.entries(already_confirmed).filter(([key]) => (RESOLVABLE_STYLE_DIMENSIONS as readonly string[]).includes(key)),
  );

  try {
    const result = await callModelForStructuredOutput({
      system: STYLE_REFERENCE_SYSTEM_PROMPT,
      userMessage: [
        `Named style/medium/tradition/artist reference:\n${style_reference}`,
        Object.keys(alreadyConfirmedFiltered).length > 0
          ? `Already confirmed by the client (never override these):\n${JSON.stringify(alreadyConfirmedFiltered)}`
          : "Nothing has been confirmed yet for the resolvable dimensions.",
      ].join("\n\n"),
      tool: {
        name: "resolve_style_reference",
        description: "Determine which artistic dimensions a named style reference settles.",
        input_schema: styleReferenceToolInputSchema,
      },
      abortSignal: abortSignalForRequest(req, res),
    });

    const resolution = toStyleReferenceResolution(result.data, alreadyConfirmedFiltered);
    if (!resolution) {
      res.status(502).json({
        error: { code: "model_invalid_response", message: "Model response failed schema validation." },
      });
      return;
    }

    res.json({ data: resolution });
  } catch (err) {
    const modelError = err instanceof ModelError ? err : new ModelError("model_network_error", (err as Error).message);
    const status = modelError.code === "model_not_configured" ? 503 : 502;
    res.status(status).json({ error: { code: modelError.code, message: modelError.message } });
  }
});

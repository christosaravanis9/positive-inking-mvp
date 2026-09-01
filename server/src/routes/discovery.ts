import { Router } from "express";
import { z } from "zod";
import { callModelForStructuredOutput } from "../modelClient.js";
import { ModelError } from "../errors.js";
import { abortSignalForRequest } from "../requestAbort.js";
import {
  DISCOVERY_SYSTEM_PROMPT,
  discoveryResultSchema,
  discoveryToolInputSchema,
} from "../schemas/discovery.js";

const requestSchema = z.object({
  raw_story: z.string().min(1, "raw_story must not be empty"),
  user_viewpoint: z.string().optional(),
});

export const discoveryRouter = Router();

discoveryRouter.post("/api/discovery", async (req, res) => {
  const parsedRequest = requestSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    res.status(400).json({ error: { code: "bad_request", message: parsedRequest.error.message } });
    return;
  }

  const { raw_story, user_viewpoint } = parsedRequest.data;
  const userMessage = user_viewpoint
    ? `The user selected the viewpoint "${user_viewpoint}" before telling their story. Retain it as primary_viewpoint unless the story clearly contradicts it.\n\nStory:\n${raw_story}`
    : `Story:\n${raw_story}`;

  try {
    const result = await callModelForStructuredOutput({
      system: DISCOVERY_SYSTEM_PROMPT,
      userMessage,
      tool: {
        name: "record_discovery",
        description: "Record the structured Discovery analysis of the user's tattoo story.",
        input_schema: discoveryToolInputSchema,
      },
      abortSignal: abortSignalForRequest(req, res),
    });

    const validated = discoveryResultSchema.safeParse(result.data);
    if (!validated.success) {
      // The model responded, but not in the shape we require. This is a
      // visible, specific failure — never silently patched over.
      res.status(502).json({
        error: {
          code: "model_invalid_response",
          message: "Model response failed schema validation.",
          detail: validated.error.format(),
        },
      });
      return;
    }

    res.json({ data: validated.data });
  } catch (err) {
    const modelError =
      err instanceof ModelError ? err : new ModelError("model_network_error", (err as Error).message);
    const status = modelError.code === "model_not_configured" ? 503 : 502;
    res.status(status).json({ error: { code: modelError.code, message: modelError.message } });
  }
});

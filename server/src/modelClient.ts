import { env, isModelConfigured } from "./env.js";
import { ModelError } from "./errors.js";

export interface StructuredToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface StructuredCallRequest {
  system: string;
  userMessage: string;
  tool: StructuredToolSpec;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface StructuredCallResult {
  /** The tool_use input Anthropic returned, already parsed as JSON by the API. */
  data: unknown;
  /** Raw response body, kept for debugging/inspection. */
  raw: unknown;
}

/**
 * Minimal fetch-shaped type so tests can inject a mock without pulling in
 * real network types.
 */
type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * One real round trip to the model, requesting a specific structured JSON
 * shape via forced tool use (so the API itself guarantees a schema-shaped
 * object rather than us regex-parsing prose). Every call:
 *  - has a hard timeout (default from MODEL_REQUEST_TIMEOUT_MS)
 *  - retries exactly once, silently, on a transient failure (timeout,
 *    network error, 5xx) per V3.0 §16.2
 *  - throws a typed, message-bearing ModelError on anything else — never
 *    swallowed, never replaced with placeholder content
 */
export async function callModelForStructuredOutput(
  request: StructuredCallRequest,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<StructuredCallResult> {
  if (!isModelConfigured()) {
    throw new ModelError(
      "model_not_configured",
      "ANTHROPIC_API_KEY is not set on the server. Add it to server/.env — see .env.example.",
    );
  }

  let lastError: ModelError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await attemptCall(request, fetchImpl);
    } catch (err) {
      const modelError =
        err instanceof ModelError
          ? err
          : new ModelError("model_network_error", (err as Error).message, err);
      lastError = modelError;
      if (!isTransient(modelError)) throw modelError;
      // Silent retry: fall through to the next loop iteration.
    }
  }
  throw lastError as ModelError;
}

function isTransient(err: ModelError): boolean {
  return err.code === "model_timeout" || err.code === "model_network_error" || err.code === "model_http_error";
}

async function attemptCall(
  request: StructuredCallRequest,
  fetchImpl: FetchLike,
): Promise<StructuredCallResult> {
  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? env.modelTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(env.anthropicApiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: request.maxTokens ?? 2048,
        system: request.system,
        messages: [{ role: "user", content: request.userMessage }],
        tools: [request.tool],
        tool_choice: { type: "tool", name: request.tool.name },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await safeJson(response);
      throw new ModelError(
        "model_http_error",
        `Model API returned HTTP ${response.status}: ${JSON.stringify(body)}`,
        body,
      );
    }

    const raw = (await response.json()) as {
      content?: Array<{ type: string; input?: unknown; name?: string }>;
    };

    const toolUse = raw.content?.find((block) => block.type === "tool_use" && block.name === request.tool.name);
    if (!toolUse || toolUse.input === undefined) {
      throw new ModelError(
        "model_invalid_response",
        "Model response did not contain the expected structured tool_use block.",
        raw,
      );
    }

    return { data: toolUse.input, raw };
  } catch (err) {
    if (err instanceof ModelError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ModelError("model_timeout", `Model request timed out after ${timeoutMs}ms.`);
    }
    throw new ModelError("model_network_error", (err as Error).message, err);
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

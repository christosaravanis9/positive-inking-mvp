import { env, isModelConfigured } from "./env.js";
import { ModelError } from "./errors.js";
import type { ModelRoute } from "@positive-inking/engine";

export interface StructuredToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface StructuredCallRequest {
  /** Which route this call is for -- resolves the default timeout budget (env.modelTimeouts[stage]) when timeoutMs is not given, and is attached to a model_timeout error's detail for dev-mode diagnosis. */
  stage: ModelRoute;
  system: string;
  userMessage: string;
  tool: StructuredToolSpec;
  /** Overrides the stage's configured default -- used by tests; routes should rely on the stage default instead. */
  timeoutMs?: number;
  maxTokens?: number;
  /**
   * Wired from the Express request's own "close" event (see routes/*.ts).
   * When the client disconnects -- including a client-side timeout abort --
   * before this call finishes, this fires so the server stops spending
   * further time and real API cost on a call nobody is waiting for anymore.
   * The eventual result (or error) is simply never used; nothing here ever
   * mutates any state, since HTTP request handling is stateless per-request.
   */
  abortSignal?: AbortSignal;
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
 *  - has a hard TOTAL wall-clock budget, stage-specific (default from
 *    env.modelTimeouts[request.stage] -- see engine/src/modelTimeouts.ts and
 *    docs/timeout-matrix.md), not one universal number for every route
 *  - retries exactly once, silently, on a transient failure (network error,
 *    5xx) per V3.0 §16.2, but the retry draws from the SAME total budget
 *    rather than getting a fresh full timeout of its own -- a naive "retry
 *    once, each attempt gets its own full timeout" policy lets the server's
 *    real worst-case silently double (e.g. two full 20s attempts = 40s)
 *    without the client's own timeout ever being told, which is exactly the
 *    bug this comment now prevents: the client's fetch (see
 *    web/src/api/client.ts / engine's clientTimeoutForRoute) would abort
 *    while the server was still legitimately mid-retry, guaranteeing a
 *    client-side "timed out" error on any request that needed the retry at
 *    all, even when the server would have succeeded seconds later. With a
 *    shared total budget, the server's worst case is bounded by the stage's
 *    configured timeout regardless of how many attempts it takes.
 *  - does NOT retry a model_timeout. A timeout means the call itself is
 *    inherently slow (model load, a heavy structured-output request), not a
 *    transient blip a same-budget retry can fix -- and because the shared
 *    budget above means a first-attempt timeout always consumes (very close
 *    to) the entire budget, a "retry" after one would get ~0ms remaining
 *    and never actually re-call the model anyway. Excluding it here makes
 *    that explicit by construction rather than relying on the remaining-
 *    budget check to always happen to land on zero.
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

  const totalBudgetMs = request.timeoutMs ?? env.modelTimeouts[request.stage];
  const deadline = Date.now() + totalBudgetMs;

  let lastError: ModelError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (request.abortSignal?.aborted) break; // Client already disconnected -- do not spend another attempt.
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break; // Budget already exhausted -- do not start another attempt.
    try {
      return await attemptCall(request, fetchImpl, remainingMs);
    } catch (err) {
      const modelError =
        err instanceof ModelError
          ? err
          : new ModelError("model_network_error", (err as Error).message, err);
      lastError = modelError;
      if (!isTransient(modelError)) throw modelError;
      // Silent retry: fall through to the next loop iteration, if budget remains.
    }
  }
  throw lastError as ModelError;
}

function isTransient(err: ModelError): boolean {
  return err.code === "model_network_error" || err.code === "model_http_error";
}

async function attemptCall(
  request: StructuredCallRequest,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<StructuredCallResult> {
  const attemptStart = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  request.abortSignal?.addEventListener("abort", onExternalAbort);

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
      throw new ModelError("model_timeout", `Model request timed out after ${timeoutMs}ms.`, {
        stage: request.stage,
        elapsedMs: Date.now() - attemptStart,
        budgetMs: timeoutMs,
      });
    }
    throw new ModelError("model_network_error", (err as Error).message, err);
  } finally {
    clearTimeout(timer);
    request.abortSignal?.removeEventListener("abort", onExternalAbort);
  }
}

async function safeJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

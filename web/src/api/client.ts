export interface ApiError {
  code: string;
  message: string;
}

/**
 * Shared POST helper for every model-backed endpoint. Never swallows a
 * failure: throws an Error carrying the server's real error code/message,
 * or a client-side timeout/network message, verbatim, for the caller to
 * show the user (§16.2 — a visible, specific failure, never canned content).
 *
 * timeoutMs is required, not defaulted, so each call site names the budget
 * for the route it's actually calling rather than sharing one number across
 * routes with very different real latency (see engine's
 * clientTimeoutForRoute and docs/timeout-matrix.md) -- callers should pass
 * that helper's result, which already carries real margin above the
 * server's own worst-case total time for that route (see
 * server/src/modelClient.ts's callModelForStructuredOutput). If the two
 * ever drift, the margin invariant is asserted directly in
 * engine/test/modelTimeouts.test.ts.
 */
export async function postJson<TResponse>(path: string, body: unknown, timeoutMs: number): Promise<TResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      const error: ApiError = responseBody?.error ?? {
        code: "unknown_error",
        message: `Request failed with HTTP ${response.status}`,
      };
      throw Object.assign(new Error(error.message), { code: error.code });
    }

    return responseBody as TResponse;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw Object.assign(new Error("Request timed out waiting for the server."), { code: "client_timeout" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

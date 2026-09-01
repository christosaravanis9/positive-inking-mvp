export interface ApiError {
  code: string;
  message: string;
}

/**
 * Must exceed the server's own worst-case total time for a model call, with
 * real margin for network/Express overhead on top -- otherwise the client
 * gives up while the server is still legitimately working (see
 * server/src/modelClient.ts's callModelForStructuredOutput, which bounds
 * its own total wall-clock time, across its one silent retry, to
 * MODEL_REQUEST_TIMEOUT_MS -- 20000ms by default, see server/.env.example).
 * If either value changes, check the other: this constant should stay
 * comfortably above the server's configured total budget.
 */
const CLIENT_TIMEOUT_MS = 30000;

/**
 * Shared POST helper for every model-backed endpoint. Never swallows a
 * failure: throws an Error carrying the server's real error code/message,
 * or a client-side timeout/network message, verbatim, for the caller to
 * show the user (§16.2 — a visible, specific failure, never canned content).
 */
export async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

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

export interface DiscoveryApiError {
  code: string;
  message: string;
}

export interface DiscoveryApiSuccess {
  data: Record<string, unknown>;
}

const CLIENT_TIMEOUT_MS = 25000;

/**
 * Calls the server's /api/discovery proxy. Never swallows a failure: throws
 * a DiscoveryApiError-shaped error with the server's real message, or a
 * client-side timeout/network message, for the caller to show verbatim.
 */
export async function requestDiscovery(rawStory: string): Promise<DiscoveryApiSuccess> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch("/api/discovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw_story: rawStory }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const error: DiscoveryApiError = body?.error ?? {
        code: "unknown_error",
        message: `Request failed with HTTP ${response.status}`,
      };
      throw Object.assign(new Error(error.message), { code: error.code });
    }

    return body as DiscoveryApiSuccess;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw Object.assign(new Error("Request timed out waiting for the server."), { code: "client_timeout" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

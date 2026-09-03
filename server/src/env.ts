import "dotenv/config";
import { MODEL_ROUTE_TIMEOUT_DEFAULTS_MS, type ModelRoute } from "@positive-inking/engine";

/**
 * MODEL_TIMEOUT_<ROUTE>_MS per route, falling back to engine's own default
 * for that route (see engine/src/modelTimeouts.ts and docs/timeout-
 * matrix.md for why each default is what it is). One universal timeout for
 * every model call was the root cause of a real incident: Association's
 * request genuinely needs more time than Provenance's, and a single 20s
 * budget either starved the heavy routes or was needlessly generous for the
 * light ones.
 */
const ROUTE_ENV_VAR: Record<ModelRoute, string> = {
  discovery: "MODEL_TIMEOUT_DISCOVERY_MS",
  provenance: "MODEL_TIMEOUT_PROVENANCE_MS",
  association: "MODEL_TIMEOUT_ASSOCIATION_MS",
  avoidance: "MODEL_TIMEOUT_AVOIDANCE_MS",
  style_reference: "MODEL_TIMEOUT_STYLE_REFERENCE_MS",
  blueprint: "MODEL_TIMEOUT_BLUEPRINT_MS",
};

function readModelTimeouts(): Record<ModelRoute, number> {
  const result = {} as Record<ModelRoute, number>;
  for (const [route, envVar] of Object.entries(ROUTE_ENV_VAR) as [ModelRoute, string][]) {
    const raw = process.env[envVar];
    result[route] = raw ? Number(raw) : MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[route];
  }
  return result;
}

/**
 * Server configuration, read once at startup. The model API key never
 * leaves this process — it is read from the environment and used only in
 * modelClient.ts's outbound request headers.
 */
export const env = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  modelTimeouts: readModelTimeouts(),
  // Overridable so integration tests can point this at a local double instead
  // of the real Anthropic endpoint -- never used to redirect real traffic.
  anthropicApiUrl: process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com/v1/messages",
  // Gates timeout diagnostic detail (route/stage, elapsed, configured budget)
  // on error responses -- never surfaced in production, never a secret either
  // way (see errors.ts's sendModelErrorResponse).
  isDevelopment: (process.env.NODE_ENV ?? "development") !== "production",
};

export function isModelConfigured(): boolean {
  return env.anthropicApiKey.length > 0;
}

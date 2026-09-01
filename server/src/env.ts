import "dotenv/config";

/**
 * Server configuration, read once at startup. The model API key never
 * leaves this process — it is read from the environment and used only in
 * modelClient.ts's outbound request headers.
 */
export const env = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929",
  modelTimeoutMs: Number(process.env.MODEL_REQUEST_TIMEOUT_MS ?? 20000),
  // Overridable so integration tests can point this at a local double instead
  // of the real Anthropic endpoint -- never used to redirect real traffic.
  anthropicApiUrl: process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com/v1/messages",
};

export function isModelConfigured(): boolean {
  return env.anthropicApiKey.length > 0;
}

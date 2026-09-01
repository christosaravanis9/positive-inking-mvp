import type { ModelRoute } from "@positive-inking/engine";

/**
 * Diagnostic-only timing/token instrumentation for real model calls.
 * Added specifically to answer the open question in docs/timeout-matrix.md
 * after Association was reproduced timing out at the *raised* 30000ms
 * ceiling in a real run: is 30s genuinely not enough generation time for a
 * 4096-max-token structured-output call, or is something else (network,
 * cold start, an unusually large candidate set) inflating elapsed time
 * beyond what output volume alone would explain? This logs every real
 * attempt -- success or failure -- with enough to tell those apart:
 * elapsed time, the configured budget, and (on success) Anthropic's own
 * token counts, from which output_tokens_per_sec is derived. Nothing here
 * changes behaviour; it is pure observability, unconditionally logged
 * (not gated on env.isDevelopment like the timeout error detail) because
 * an operator watching real traffic in any environment benefits from it
 * and none of it is remotely sensitive (no prompt content, no API key).
 */

export type ModelTimingOutcome =
  | "success"
  | "model_timeout"
  | "model_http_error"
  | "model_network_error"
  | "model_invalid_response";

export interface ModelTimingEvent {
  stage: ModelRoute;
  /** 1-indexed -- the first attempt is 1, a retry is 2. */
  attempt: number;
  elapsedMs: number;
  budgetMs: number;
  outcome: ModelTimingOutcome;
  httpStatus?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export function logModelTiming(event: ModelTimingEvent): void {
  const parts = [
    `stage=${event.stage}`,
    `attempt=${event.attempt}`,
    `outcome=${event.outcome}`,
    `elapsed_ms=${event.elapsedMs}`,
    `budget_ms=${event.budgetMs}`,
  ];
  if (event.httpStatus !== undefined) parts.push(`http_status=${event.httpStatus}`);
  if (event.inputTokens !== undefined) parts.push(`input_tokens=${event.inputTokens}`);
  if (event.outputTokens !== undefined) parts.push(`output_tokens=${event.outputTokens}`);
  if (event.outputTokens !== undefined && event.elapsedMs > 0) {
    const perSecond = (event.outputTokens / event.elapsedMs) * 1000;
    parts.push(`output_tokens_per_sec=${perSecond.toFixed(1)}`);
  }
  console.log(`[model-timing] ${parts.join(" ")}`);
}

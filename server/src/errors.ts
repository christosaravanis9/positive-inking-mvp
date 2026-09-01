/**
 * Typed model-layer errors. Every one of these must reach the client as a
 * visible, specific message — never swallowed, never replaced with silently
 * canned content. See Build Brief §6 ("Everything silently canned") and
 * V3.0 §16.2.
 */

import type { Response } from "express";
import { env } from "./env.js";

export type ModelErrorCode =
  | "model_not_configured"
  | "model_timeout"
  | "model_network_error"
  | "model_http_error"
  | "model_invalid_response";

export class ModelError extends Error {
  code: ModelErrorCode;
  detail?: unknown;

  constructor(code: ModelErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Shared by every model-backed route's catch block. In development, a
 * model_timeout's detail (stage, elapsedMs, budgetMs -- attached in
 * modelClient.ts) is surfaced so a developer can immediately see which
 * route timed out, how long it actually took, and what budget it was
 * given, instead of debugging a bare "timed out after Xms" with no route
 * context. Never surfaced in production: none of it is a secret, but it is
 * not part of the real user-facing error contract either.
 */
export function sendModelErrorResponse(res: Response, err: unknown): void {
  const modelError = err instanceof ModelError ? err : new ModelError("model_network_error", (err as Error).message);
  const status = modelError.code === "model_not_configured" ? 503 : 502;
  const body: { error: { code: ModelErrorCode; message: string; detail?: unknown } } = {
    error: { code: modelError.code, message: modelError.message },
  };
  if (env.isDevelopment && modelError.code === "model_timeout" && modelError.detail) {
    body.error.detail = modelError.detail;
  }
  res.status(status).json(body);
}

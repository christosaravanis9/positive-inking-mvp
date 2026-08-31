/**
 * Typed model-layer errors. Every one of these must reach the client as a
 * visible, specific message — never swallowed, never replaced with silently
 * canned content. See Build Brief §6 ("Everything silently canned") and
 * V3.0 §16.2.
 */

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

/**
 * Global error + unhandled-rejection handling, installed before React ever
 * renders. Build Brief §6: a cross-origin failure with no detail and no
 * handler produced nothing but "Script error." in the console last time —
 * this exists so that never happens silently again.
 */

export const GLOBAL_ERROR_EVENT = "pi:global-error";

export interface GlobalErrorDetail {
  message: string;
  source: "window.onerror" | "unhandledrejection";
  time: number;
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    const detail: GlobalErrorDetail = {
      message: event.message || "Unknown script error",
      source: "window.onerror",
      time: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.error("[global error]", event.error ?? event.message);
    window.dispatchEvent(new CustomEvent<GlobalErrorDetail>(GLOBAL_ERROR_EVENT, { detail }));
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const detail: GlobalErrorDetail = {
      message,
      source: "unhandledrejection",
      time: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.error("[unhandled rejection]", reason);
    window.dispatchEvent(new CustomEvent<GlobalErrorDetail>(GLOBAL_ERROR_EVENT, { detail }));
  });
}

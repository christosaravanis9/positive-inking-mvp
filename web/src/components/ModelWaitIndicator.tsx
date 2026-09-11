import { useEffect, useState } from "react";
import { MODEL_ROUTE_TIMEOUT_DEFAULTS_MS, type ModelRoute } from "@positive-inking/engine";

/**
 * Appears only once the wait has genuinely gone on a while -- a counter present from 0s
 * would just be visual noise for the common fast case, and would draw attention to every
 * call as if it might be slow.
 */
const ELAPSED_THRESHOLD_SECONDS = 5;

/**
 * 2026-09-11, live-suggested: numbers-only felt indefinite and frustrating --
 * this project already knows each route's real expected duration
 * (engine/src/modelTimeouts.ts's own per-route budgets, derived from real
 * measured call data, not guesses -- see docs/timeout-matrix.md), so the
 * fill uses that as its pacing reference instead of an unbounded spinner.
 *
 * This is deliberately NOT the countdown this component's own prior
 * comment already ruled out (see below) -- it never promises completion.
 * Two segments:
 *  - Up to the route's own budget (elapsedMs <= budgetMs): fills linearly
 *    to 85%, giving a real, satisfying sense of progress during the
 *    typical/expected window.
 *  - Beyond the budget (a call genuinely running long -- confirmed to
 *    happen for real, see modelTimeouts.ts's "Real production incident"
 *    note): a decelerating asymptotic crawl from 85% toward but NEVER
 *    reaching 100%, for however much longer the call actually takes. The
 *    bar can never show "done" while still waiting, the same reasoning
 *    that already ruled out a countdown here -- it just keeps trickling,
 *    however slowly, until the real result arrives and this component
 *    unmounts. It never has to visually "complete" itself.
 */
export function progressFraction(elapsedMs: number, budgetMs: number): number {
  if (budgetMs <= 0) return 0;
  const ratio = elapsedMs / budgetMs;
  const raw = ratio <= 1 ? ratio * 0.85 : 0.85 + 0.15 * (1 - Math.exp(-(ratio - 1)));
  // Math.exp(-x) underflows to exactly 0 for large enough x, which would
  // make `raw` reach exactly 1 (100%) in floating point -- the asymptotic
  // curve above is designed to approach but never reach 1, so this clamp
  // makes that guarantee hold by construction rather than relying on
  // floating-point precision at extreme elapsed times.
  return Math.min(raw, 0.995);
}

/**
 * The one shared wait indicator for every model-call wait state in the journey (Story's
 * two Discovery calls, Clarification, ImageProvenance's two calls, Avoidances, Screen 7's
 * Association call, Style Reference, and Blueprint generation) -- not the separately
 * queued placement-preference "productive waiting" MVP, which this doesn't attempt.
 *
 * Reuses the pulsing-dots animation first added to Screen 7's own Association wait, via
 * the app's global --accent token rather than --ledger-red (which only exists inside
 * Screen 7's own .sites-tokens scope), plus (2026-09-11) a progress bar paced against
 * `route`'s own known budget -- see progressFraction above.
 *
 * The elapsed-seconds counter only ever counts UP, and only appears once the wait has
 * passed 5 seconds: no route in this app can promise how long a call will take (see
 * docs/timeout-matrix.md's per-route budgets, which range up to 45s), so a countdown that
 * reached zero while still waiting would read as broken -- worse than showing nothing.
 * The progress bar above follows the exact same principle in visual form, not just text.
 * Computed from wall-clock elapsed time each tick (not a naive increment-by-one), so it
 * can't drift from setInterval's own imprecision.
 */
export function ModelWaitIndicator({ label, route }: { label: string; route: ModelRoute }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    // 250ms: smooth enough for the progress bar's width transition to read
    // as continuous motion, without the render churn a faster tick would
    // add for a purely cosmetic animation.
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    // This codebase has been bitten before by a leftover timer (the voice-input rebuild's
    // own 8-second "stuck detector") -- cleared unconditionally on unmount, no exceptions.
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const budgetMs = MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[route];
  const fraction = progressFraction(elapsedMs, budgetMs);

  return (
    <div className="model-wait-container">
      <p className="progress-note model-wait">
        {label}
        <span className="model-wait-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
        {elapsedSeconds >= ELAPSED_THRESHOLD_SECONDS && <span className="model-wait-elapsed">Still working — {elapsedSeconds}s</span>}
      </p>
      <div className="model-wait-progress-track" role="progressbar" aria-hidden="true">
        <div className="model-wait-progress-fill" style={{ width: `${(fraction * 100).toFixed(1)}%` }} />
      </div>
    </div>
  );
}

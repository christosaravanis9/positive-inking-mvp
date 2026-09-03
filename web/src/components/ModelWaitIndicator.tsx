import { useEffect, useState } from "react";

/**
 * Appears only once the wait has genuinely gone on a while -- a counter present from 0s
 * would just be visual noise for the common fast case, and would draw attention to every
 * call as if it might be slow.
 */
const ELAPSED_THRESHOLD_SECONDS = 5;

/**
 * The one shared wait indicator for every model-call wait state in the journey (Story's
 * two Discovery calls, Clarification, ImageProvenance's two calls, Avoidances, Screen 7's
 * Association call, Style Reference, and Blueprint generation) -- not the separately
 * queued placement-preference "productive waiting" MVP, which this doesn't attempt.
 *
 * Reuses the pulsing-dots animation first added to Screen 7's own Association wait, via
 * the app's global --accent token rather than --ledger-red (which only exists inside
 * Screen 7's own .sites-tokens scope) -- one animation style everywhere, rendering
 * correctly whether or not the calling screen is ledger-scoped.
 *
 * The elapsed-seconds counter only ever counts UP, and only appears once the wait has
 * passed 5 seconds: no route in this app can promise how long a call will take (see
 * docs/timeout-matrix.md's per-route budgets, which range up to 40s), so a countdown that
 * reached zero while still waiting would read as broken -- worse than showing nothing.
 * Computed from wall-clock elapsed time each tick (not a naive increment-by-one), so it
 * can't drift from setInterval's own imprecision.
 */
export function ModelWaitIndicator({ label }: { label: string }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    // This codebase has been bitten before by a leftover timer (the voice-input rebuild's
    // own 8-second "stuck detector") -- cleared unconditionally on unmount, no exceptions.
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="progress-note model-wait">
      {label}
      <span className="model-wait-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
      {elapsedSeconds >= ELAPSED_THRESHOLD_SECONDS && <span className="model-wait-elapsed">Still working — {elapsedSeconds}s</span>}
    </p>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useJourney } from "./JourneyProvider";

/**
 * The one sanctioned way to run a model-backed action from a screen.
 *
 * This exists because of a real production incident: a screen with no
 * loading feedback let a user click Continue more than once, firing
 * multiple concurrent real API calls; whichever one happened to resolve
 * last -- regardless of whether the user had since retried, navigated
 * away, or the request had already timed out client-side -- still
 * unconditionally patched global project/ui state and drove navigation.
 * The result: screens auto-advancing and answers appearing "confirmed"
 * that the user never actually chose, plus a stale timeout error from an
 * unmounted screen rendering on whatever screen the user had since reached.
 *
 * Guards, in order:
 *
 * - Re-entrancy: a second run() call while one is already in flight on
 *   this same hook instance is a synchronous no-op. This uses a ref, not
 *   React state, specifically because state updates are batched/async --
 *   a rapid double-click, or React StrictMode's dev-mode double-invoke of
 *   an effect, both call the handler before a state-based flag would have
 *   committed. A ref is read-after-write synchronously, so it closes both.
 * - Staleness: every call is stamped with a token. The `guard.isStale()`
 *   passed into the action reports true once a *later* run() call on this
 *   same hook instance has started, or the owning component has unmounted.
 *   The action MUST check this after every `await`, before calling
 *   patchProject/patchUI/setError/any other state mutation -- a stale
 *   result must never mutate state or drive navigation (the user-decision
 *   invariant: a user-facing selection or screen advance may happen only
 *   through an explicit, current user action, never a superseded one).
 * - Errors are centralised here and only ever surfaced if the call that
 *   produced them is still current. A superseded or post-unmount error is
 *   discarded silently -- never shown on a screen the user has since left.
 * - `pending` is real UI state screens are expected to use to disable
 *   their submit button and show a loading indicator, closing the "no
 *   feedback while a call is running" gap that caused the double-click in
 *   the first place.
 */
export interface AsyncActionGuard {
  isStale: () => boolean;
}

export function useAsyncAction() {
  const { setError, beginAttempt } = useJourney();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const tokenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (action: (guard: AsyncActionGuard) => Promise<void>, errorContext: string) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      const myToken = ++tokenRef.current;
      const guard: AsyncActionGuard = { isStale: () => tokenRef.current !== myToken || !mountedRef.current };

      beginAttempt();
      try {
        await action(guard);
        if (!guard.isStale()) setError(null);
      } catch (err) {
        if (!guard.isStale()) {
          setError({
            code: (err as { code?: string })?.code ?? "unknown_error",
            message: err instanceof Error ? err.message : "Unknown error",
            context: errorContext,
          });
        }
      } finally {
        if (tokenRef.current === myToken) {
          pendingRef.current = false;
          if (mountedRef.current) setPending(false);
        }
      }
    },
    [beginAttempt, setError],
  );

  return { run, pending };
}

/**
 * Keyed variant of useAsyncAction (2026-09-07), for a screen where several
 * independent slots can each have their own in-flight model call at once --
 * Screen 7's per-candidate "Not this one" re-roll, specifically the
 * Why-driven path that needs a real per-slot generation call (see
 * docs/PROJECT_STATUS.md). Same three guarantees as useAsyncAction above,
 * just tracked per key instead of once for the whole hook instance: a
 * second run() for the SAME key while one is in flight is a no-op, but a
 * DIFFERENT key may run concurrently; guard.isStale() reports true once a
 * later run() for that same key has started, or the component has
 * unmounted -- exactly the same two ways a result can go stale, just
 * scoped to one key instead of the whole screen.
 */
export interface KeyedAsyncActionGuard {
  isStale: () => boolean;
}

export function useKeyedAsyncAction() {
  const { setError, beginAttempt } = useJourney();
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string | number>>(new Set());
  const pendingRefs = useRef<Map<string | number, boolean>>(new Map());
  const tokenRefs = useRef<Map<string | number, number>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (key: string | number, action: (guard: KeyedAsyncActionGuard) => Promise<void>, errorContext: string) => {
      if (pendingRefs.current.get(key)) return;
      pendingRefs.current.set(key, true);
      setPendingKeys((prev) => new Set(prev).add(key));
      const myToken = (tokenRefs.current.get(key) ?? 0) + 1;
      tokenRefs.current.set(key, myToken);
      const guard: KeyedAsyncActionGuard = { isStale: () => tokenRefs.current.get(key) !== myToken || !mountedRef.current };

      beginAttempt();
      try {
        await action(guard);
        if (!guard.isStale()) setError(null);
      } catch (err) {
        if (!guard.isStale()) {
          setError({
            code: (err as { code?: string })?.code ?? "unknown_error",
            message: err instanceof Error ? err.message : "Unknown error",
            context: errorContext,
          });
        }
      } finally {
        if (tokenRefs.current.get(key) === myToken) {
          pendingRefs.current.set(key, false);
          if (mountedRef.current) {
            setPendingKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          }
        }
      }
    },
    [beginAttempt, setError],
  );

  const isPending = useCallback((key: string | number) => pendingKeys.has(key), [pendingKeys]);

  return { run, isPending };
}

import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { JourneyProvider, useJourney } from "./JourneyProvider";
import { useAsyncAction } from "./useAsyncAction";

/**
 * Regression coverage for the live-API incident: a screen with no loading
 * feedback let a user fire multiple concurrent real model calls, and
 * whichever one resolved last -- regardless of relevance -- unconditionally
 * mutated global state and drove navigation. These tests exercise the exact
 * async/state boundary engine/'s pure-function tests structurally cannot
 * reach: React effect timing, re-entrancy, and post-unmount staleness.
 */

function useHarness() {
  const asyncAction = useAsyncAction();
  const journey = useJourney();
  return { ...asyncAction, journey };
}

function renderHarness() {
  return renderHook(() => useHarness(), { wrapper: ({ children }) => <JourneyProvider>{children}</JourneyProvider> });
}

/** A promise plus externally-callable resolve/reject, for precise manual control over async timing in a test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncAction", () => {
  it("runs the action exactly once for a normal call, and clears pending on success", async () => {
    const { result } = renderHarness();
    const action = vi.fn(async () => {});

    await act(async () => {
      await result.current.run(action, "test context");
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
    expect(result.current.journey.state.ui.error).toBeNull();
  });

  it("rapid double submit: a second run() call while the first is still pending is a synchronous no-op -- the action fires only once, closing the exact gap that let a user fire duplicate real API calls", async () => {
    const { result } = renderHarness();
    const gate = deferred<void>();
    const action = vi.fn(async () => {
      await gate.promise;
    });

    let firstRunPromise!: Promise<void>;
    let secondRunPromise!: Promise<void>;
    act(() => {
      firstRunPromise = result.current.run(action, "ctx");
      // Second call issued synchronously, before the first has had any chance
      // to settle -- exactly what two fast clicks on an un-disabled button do.
      secondRunPromise = result.current.run(action, "ctx");
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      gate.resolve();
      await firstRunPromise;
      await secondRunPromise;
    });

    // Still exactly one call -- the second run() never invoked the action at all.
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it("a retry after a completed (errored) call is a genuinely new call, not blocked by the earlier one", async () => {
    const { result } = renderHarness();
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const succeeding = vi.fn(async () => {});

    await act(async () => {
      await result.current.run(failing, "first attempt");
    });
    expect(result.current.journey.state.ui.error).toMatchObject({ context: "first attempt" });

    await act(async () => {
      await result.current.run(succeeding, "retry");
    });

    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(result.current.journey.state.ui.error).toBeNull();
  });

  it("guard.isStale() is false while the call is still current, so a well-behaved action's state mutation is not skipped", async () => {
    const { result } = renderHarness();
    let observedStaleBeforeAwait: boolean | undefined;
    let observedStaleAfterAwait: boolean | undefined;

    await act(async () => {
      await result.current.run(async (guard) => {
        observedStaleBeforeAwait = guard.isStale();
        await Promise.resolve();
        observedStaleAfterAwait = guard.isStale();
        if (!guard.isStale()) {
          result.current.journey.patchProject({ raw_story: "confirmed via a genuinely current call" });
        }
      }, "ctx");
    });

    expect(observedStaleBeforeAwait).toBe(false);
    expect(observedStaleAfterAwait).toBe(false);
    expect(result.current.journey.state.project.raw_story).toBe("confirmed via a genuinely current call");
  });

  it("USER-DECISION INVARIANT: a call that resolves after the component has unmounted must never mutate state -- guard.isStale() reports true, and the hook's own error handling stays silent rather than surfacing a stale error nowhere the user can see it", async () => {
    const { result, unmount } = renderHarness();
    const gate = deferred<void>();
    let sawStaleInsideAction: boolean | undefined;
    const patchProjectSpy = vi.fn();

    const action = vi.fn(async (guard: { isStale: () => boolean }) => {
      await gate.promise;
      sawStaleInsideAction = guard.isStale();
      if (!guard.isStale()) patchProjectSpy();
    });

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(action, "post-unmount context");
    });

    // The user navigates away / the screen unmounts while the call is still in flight.
    unmount();

    await act(async () => {
      gate.resolve();
      await runPromise;
    });

    expect(sawStaleInsideAction).toBe(true);
    expect(patchProjectSpy).not.toHaveBeenCalled();
  });

  it("USER-DECISION INVARIANT: an error from a call that resolves after unmount is discarded, never dispatched to state (which is what let a stale [client_timeout] banner render on a screen the user had already navigated away from)", async () => {
    const { result, unmount } = renderHarness();
    const gate = deferred<void>();
    const action = vi.fn(async () => {
      await gate.promise;
      throw Object.assign(new Error("late failure"), { code: "client_timeout" });
    });

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(action, "Understanding your story");
    });

    unmount();

    // The late error must not throw out of run() nor be observable anywhere --
    // it's simply discarded. This should not reject.
    await act(async () => {
      gate.resolve();
      await expect(runPromise).resolves.toBeUndefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ModelWaitIndicator, progressFraction } from "./ModelWaitIndicator";
import { MODEL_ROUTE_TIMEOUT_DEFAULTS_MS } from "@positive-inking/engine";

/**
 * The one shared wait indicator for every model-call loading state in the journey. These
 * tests cover exactly the requirements this component exists to guarantee: the counter is
 * absent before 5s, appears at 5s, counts up (never down) every second after, and its
 * interval is cleared on unmount -- this codebase has been bitten by a leftover timer
 * before (the voice-input rebuild's own 8-second "stuck detector"). Plus (2026-09-11) the
 * budget-paced progress bar: real progress during the expected window, and -- the one
 * thing this must never do, mirroring why this component never shows a countdown -- never
 * visually "complete" while the call is still pending, however long it runs.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup(); // unmount before restoring real timers, so any cleanup effect still runs against the fake clock
  vi.useRealTimers();
});

describe("ModelWaitIndicator", () => {
  it("shows the passed-in label and the animated dots immediately, from 0s", () => {
    render(<ModelWaitIndicator label="Understanding your story..." route="discovery" />);
    screen.getByText("Understanding your story...");
    expect(document.querySelector(".model-wait-dots")).not.toBeNull();
  });

  it("does not show the elapsed counter before 5 seconds", () => {
    render(<ModelWaitIndicator label="Working..." route="discovery" />);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText(/Still working/)).toBeNull();
  });

  it("shows the elapsed counter once 5 seconds have passed", () => {
    render(<ModelWaitIndicator label="Working..." route="discovery" />);
    act(() => vi.advanceTimersByTime(5000));
    screen.getByText("Still working — 5s");
  });

  it("counts up every second after appearing, never down", () => {
    render(<ModelWaitIndicator label="Working..." route="discovery" />);
    act(() => vi.advanceTimersByTime(5000));
    screen.getByText("Still working — 5s");

    act(() => vi.advanceTimersByTime(1000));
    screen.getByText("Still working — 6s");

    act(() => vi.advanceTimersByTime(1000));
    screen.getByText("Still working — 7s");
  });

  it("keeps the passed-in label unchanged as the counter appears -- copy is never homogenised", () => {
    render(<ModelWaitIndicator label="Building your Blueprint..." route="blueprint" />);
    act(() => vi.advanceTimersByTime(6000));
    screen.getByText("Building your Blueprint...");
    screen.getByText(/Still working/);
  });

  it("clears its interval on unmount -- no lingering timer", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<ModelWaitIndicator label="Working..." route="discovery" />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("stops advancing once unmounted -- setState is never called on an unmounted component", () => {
    const { unmount } = render(<ModelWaitIndicator label="Working..." route="discovery" />);
    unmount();
    // If the interval weren't cleared, this would eventually try to setState on an
    // unmounted component -- React would throw/warn. Advancing well past several ticks
    // with no assertion failure or console error is the actual proof.
    expect(() => act(() => vi.advanceTimersByTime(20000))).not.toThrow();
  });
});

describe("progressFraction (pure function)", () => {
  it("is 0 at elapsed=0, for any budget", () => {
    expect(progressFraction(0, 20000)).toBe(0);
  });

  it("fills linearly toward 85% as elapsed approaches the budget", () => {
    expect(progressFraction(10000, 20000)).toBeCloseTo(0.425); // halfway to budget -> half of 85%
    expect(progressFraction(20000, 20000)).toBeCloseTo(0.85); // exactly at budget -> exactly 85%
  });

  it("never reaches or exceeds 100%, no matter how far past budget elapsed goes -- the bar must never visually 'complete' while still waiting, same reasoning as the no-countdown rule above", () => {
    expect(progressFraction(20000, 20000)).toBeLessThan(1);
    expect(progressFraction(60000, 20000)).toBeLessThan(1); // 3x the budget
    expect(progressFraction(600000, 20000)).toBeLessThan(1); // 30x the budget -- still bounded
    expect(progressFraction(10_000_000, 20000)).toBeLessThan(1); // absurdly long -- still bounded
  });

  it("keeps climbing (never plateaus below its own asymptote, never goes backward) the longer a call runs past its budget", () => {
    const at1x = progressFraction(20000, 20000);
    const at2x = progressFraction(40000, 20000);
    const at5x = progressFraction(100000, 20000);
    expect(at2x).toBeGreaterThan(at1x);
    expect(at5x).toBeGreaterThan(at2x);
  });

  it("is 0 for a non-positive budget rather than dividing by zero or returning NaN/Infinity", () => {
    expect(progressFraction(5000, 0)).toBe(0);
    expect(progressFraction(5000, -1000)).toBe(0);
  });
});

describe("ModelWaitIndicator -- progress bar (2026-09-11, live-suggested: numbers-only felt indefinite)", () => {
  it("renders a progress track and fill element", () => {
    render(<ModelWaitIndicator label="Working..." route="discovery" />);
    expect(document.querySelector(".model-wait-progress-track")).not.toBeNull();
    expect(document.querySelector(".model-wait-progress-fill")).not.toBeNull();
  });

  it("the fill's width grows as elapsed time increases, paced against the route's real known budget", () => {
    render(<ModelWaitIndicator label="Working..." route="discovery" />);
    const fill = document.querySelector<HTMLElement>(".model-wait-progress-fill")!;
    const widthAt0 = fill.style.width;

    act(() => vi.advanceTimersByTime(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS.discovery / 2));
    const widthAtHalfBudget = parseFloat(fill.style.width);

    expect(parseFloat(widthAt0)).toBe(0);
    expect(widthAtHalfBudget).toBeGreaterThan(0);
    expect(widthAtHalfBudget).toBeLessThan(85); // still short of the 85% expected-window ceiling
  });

  it("different routes with different known budgets pace differently -- a fast route (provenance, 10s) is visibly further along than a slow one (blueprint, 45s) at the same elapsed time", () => {
    const { unmount: unmountFast } = render(<ModelWaitIndicator label="Fast..." route="provenance" />);
    act(() => vi.advanceTimersByTime(5000));
    const fastWidth = parseFloat(document.querySelector<HTMLElement>(".model-wait-progress-fill")!.style.width);
    unmountFast();

    render(<ModelWaitIndicator label="Slow..." route="blueprint" />);
    act(() => vi.advanceTimersByTime(5000));
    const slowWidth = parseFloat(document.querySelector<HTMLElement>(".model-wait-progress-fill")!.style.width);

    expect(fastWidth).toBeGreaterThan(slowWidth);
  });

  it("even a call running well past its own route's budget never reaches a full/100% bar", () => {
    render(<ModelWaitIndicator label="Working..." route="provenance" />); // 10s budget, the shortest
    act(() => vi.advanceTimersByTime(120000)); // 12x the budget
    const width = parseFloat(document.querySelector<HTMLElement>(".model-wait-progress-fill")!.style.width);
    expect(width).toBeLessThan(100);
    expect(width).toBeGreaterThan(85); // still meaningfully progressed into the "taking longer" crawl
  });
});

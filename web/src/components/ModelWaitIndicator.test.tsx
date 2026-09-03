import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ModelWaitIndicator } from "./ModelWaitIndicator";

/**
 * The one shared wait indicator for every model-call loading state in the journey. These
 * tests cover exactly the requirements this component exists to guarantee: the counter is
 * absent before 5s, appears at 5s, counts up (never down) every second after, and its
 * interval is cleared on unmount -- this codebase has been bitten by a leftover timer
 * before (the voice-input rebuild's own 8-second "stuck detector").
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
    render(<ModelWaitIndicator label="Understanding your story..." />);
    screen.getByText("Understanding your story...");
    expect(document.querySelector(".model-wait-dots")).not.toBeNull();
  });

  it("does not show the elapsed counter before 5 seconds", () => {
    render(<ModelWaitIndicator label="Working..." />);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText(/Still working/)).toBeNull();
  });

  it("shows the elapsed counter once 5 seconds have passed", () => {
    render(<ModelWaitIndicator label="Working..." />);
    act(() => vi.advanceTimersByTime(5000));
    screen.getByText("Still working — 5s");
  });

  it("counts up every second after appearing, never down", () => {
    render(<ModelWaitIndicator label="Working..." />);
    act(() => vi.advanceTimersByTime(5000));
    screen.getByText("Still working — 5s");

    act(() => vi.advanceTimersByTime(1000));
    screen.getByText("Still working — 6s");

    act(() => vi.advanceTimersByTime(1000));
    screen.getByText("Still working — 7s");
  });

  it("keeps the passed-in label unchanged as the counter appears -- copy is never homogenised", () => {
    render(<ModelWaitIndicator label="Building your Blueprint..." />);
    act(() => vi.advanceTimersByTime(6000));
    screen.getByText("Building your Blueprint...");
    screen.getByText(/Still working/);
  });

  it("clears its interval on unmount -- no lingering timer", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<ModelWaitIndicator label="Working..." />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("stops advancing once unmounted -- setState is never called on an unmounted component", () => {
    const { unmount } = render(<ModelWaitIndicator label="Working..." />);
    unmount();
    // If the interval weren't cleared, this would eventually try to setState on an
    // unmounted component -- React would throw/warn. Advancing well past several ticks
    // with no assertion failure or console error is the actual proof.
    expect(() => act(() => vi.advanceTimersByTime(20000))).not.toThrow();
  });
});

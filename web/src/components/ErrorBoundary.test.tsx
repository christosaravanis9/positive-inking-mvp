import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppErrorBoundary } from "./ErrorBoundary";

/**
 * The 2026-09-24 production incident: a render-time exception anywhere in
 * the app produced a blank page, because nothing caught it -- window.onerror
 * (globalErrors.ts) fires too late to render a fallback in React's place.
 * This locks in that a deliberately thrown render error is now caught and
 * shows a recoverable message instead of unmounting to nothing.
 */
function Bomb(): JSX.Element {
  throw new Error("deliberate test render crash");
}

describe("AppErrorBoundary", () => {
  const originalError = console.error;
  afterEach(() => {
    console.error = originalError;
    localStorage.clear();
  });

  it("catches a render-time exception and shows a recoverable message instead of a blank page", () => {
    // React logs the caught error to console.error by default in test envs -- expected noise, silenced here.
    console.error = vi.fn();

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    screen.getByText("This screen ran into a problem");
    screen.getByText(/Your answers so far are safe/);
    screen.getByRole("button", { name: "Reload page" });
    screen.getByRole("button", { name: /Start a fresh journey/ });
  });

  it("renders children normally when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <div>Ordinary content</div>
      </AppErrorBoundary>,
    );

    screen.getByText("Ordinary content");
    expect(screen.queryByText("This screen ran into a problem")).toBeNull();
  });

  it("'Start a fresh journey' clears persisted state before reloading -- an explicit, labelled opt-in, never silent", () => {
    console.error = vi.fn();
    localStorage.setItem("positive-inking:journey-state:v1", JSON.stringify({ project: {}, ui: {} }));

    const reloadSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadSpy });

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Start a fresh journey/ }));

    expect(localStorage.getItem("positive-inking:journey-state:v1")).toBeNull();
    expect(reloadSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

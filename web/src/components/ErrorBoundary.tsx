import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearPersistedState } from "../journey/persistence";

/**
 * App-wide last-resort catch for a render-time exception (2026-09-24,
 * live-reported production incident: a render crash on
 * VisualStylePreference.tsx -- root-caused in journey/persistence.ts's
 * normalizeProjectShape() doc comment -- produced a blank page with no
 * recovery path, since nothing in this app previously caught a React
 * render error at all. `web/src/globalErrors.ts`'s window.onerror/
 * unhandledrejection listeners (surfaced as a small banner in
 * Journey.tsx) do NOT catch this class of error -- by the time a render
 * exception reaches window.onerror, React has already unmounted the tree
 * that would render that banner. Only a class component with
 * getDerivedStateFromError/componentDidCatch (a React error boundary,
 * still the only mechanism React offers for this) can catch it and render
 * a fallback in the crashed tree's place.
 *
 * Deliberately a plain class component with no dependency on
 * JourneyProvider's context or any other app state -- a crash could occur
 * inside the provider itself, and a boundary that needed the thing that
 * might be broken to render its own fallback would be useless exactly
 * when it matters most. Wrapped around the entire <App/> in main.tsx, one
 * level, not per-screen -- a single well-tested catch-all beats many
 * per-screen boundaries this project would have to keep in sync.
 *
 * Recovery never silently discards the client's progress: their answers
 * live in localStorage (§16.1), untouched by a crash or by this
 * boundary's own render. "Reload page" is the primary action (a fresh
 * page load re-hydrates from that same localStorage record, which is
 * exactly what the actual production bug needed once the root cause
 * itself was fixed). "Start a fresh journey" is a separate, clearly-
 * labelled opt-in escape hatch for the rarer case where reloading alone
 * doesn't help -- it explicitly clears localStorage, so it is never the
 * default or the only option.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[error-boundary] render crash caught:", error, info.componentStack);
  }

  private startFresh = (): void => {
    clearPersistedState();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="screen">
        <p className="screen-eyebrow">Something went wrong</p>
        <h2 className="screen-heading">This screen ran into a problem</h2>
        <p className="supporting">
          Your answers so far are safe -- they're saved on this device, not lost. Reloading the page usually fixes
          this.
        </p>
        <div className="error-banner">
          <strong>Unexpected error</strong>
          <div>{this.state.error.message}</div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => window.location.reload()}>Reload page</button>
          <button className="secondary" onClick={this.startFresh}>
            Start a fresh journey (clears saved answers)
          </button>
        </div>
      </div>
    );
  }
}

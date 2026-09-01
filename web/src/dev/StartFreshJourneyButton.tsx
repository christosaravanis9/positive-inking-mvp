import { clearPersistedState } from "../journey/persistence";
import { clearTelemetryEvents } from "../instrumentation/telemetry";

/**
 * Dev-only (import.meta.env.DEV-gated, see Journey.tsx). Clears exactly the
 * two localStorage keys this app owns -- the journey state
 * (journey/persistence.ts) and telemetry events (instrumentation/
 * telemetry.ts) -- and reloads to Screen 1. Not a blanket
 * `localStorage.clear()`: scoped to what Positive Inking itself wrote, so
 * routine testing never needs a private window or manual devtools
 * commands, but also never touches anything this origin didn't put there.
 */
export function StartFreshJourneyButton() {
  function startFresh() {
    clearPersistedState();
    clearTelemetryEvents();
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={startFresh}
      title="Dev only: clears this browser's Positive Inking journey state and reloads to Screen 1"
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 1000,
        fontSize: 12,
        padding: "4px 8px",
        opacity: 0.7,
      }}
    >
      Start fresh test journey
    </button>
  );
}

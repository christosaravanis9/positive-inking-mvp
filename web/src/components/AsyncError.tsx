import { useJourney } from "../journey/JourneyProvider";

/**
 * §16.2 — every model call gets a visible, specific error and a retry that
 * preserves whatever the user already entered (the parent screen keeps its
 * own local input state; this component never clears it). After repeated
 * failures the manual-path escape appears, never silently.
 */
export function AsyncError({ onRetry }: { onRetry: () => void }) {
  const { state, patchUI } = useJourney();
  const { error, consecutiveFailures } = state.ui;
  if (!error) return null;

  return (
    <div className="error-banner">
      <strong>
        [{error.code}] {error.context}
      </strong>
      <div>{error.message}</div>
      {error.code === "model_not_configured" && (
        <div>Add ANTHROPIC_API_KEY to server/.env (copy from .env.example) and restart the server.</div>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onRetry}>Try again</button>
        {consecutiveFailures >= 2 && (
          <button className="secondary" onClick={() => patchUI({ manualPathActive: true })}>
            Continue without AI for now
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { requestDiscovery } from "./api/discovery";
import { EngineInspector } from "./inspector/EngineInspector";
import { GLOBAL_ERROR_EVENT, type GlobalErrorDetail } from "./globalErrors";

type CallState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Record<string, unknown> }
  | { status: "error"; message: string; code: string };

const SAMPLE = "I want something for my grandmother. She kept an olive tree on her kitchen windowsill in Athens.";

export default function App() {
  const [story, setStory] = useState(SAMPLE);
  const [state, setState] = useState<CallState>({ status: "idle" });
  const [globalError, setGlobalError] = useState<GlobalErrorDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      setGlobalError((event as CustomEvent<GlobalErrorDetail>).detail);
    };
    window.addEventListener(GLOBAL_ERROR_EVENT, handler);
    return () => window.removeEventListener(GLOBAL_ERROR_EVENT, handler);
  }, []);

  async function handleSubmit() {
    setState({ status: "loading" });
    try {
      const result = await requestDiscovery(story);
      setState({ status: "success", data: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const code = (err as { code?: string }).code ?? "unknown_error";
      setState({ status: "error", message, code });
    }
  }

  return (
    <div className="app-shell">
      <h1>Positive Inking — Phase 1 harness</h1>
      <p className="subtitle">
        This is the model round-trip proof, not the intake journey. It calls the real Discovery Engine
        end-to-end through the server proxy. The guided consultation UI (Screens 1–13) comes in Phase 4.
      </p>

      {globalError && (
        <div className="error-banner">
          Unhandled {globalError.source}: {globalError.message}
        </div>
      )}

      {state.status === "error" && (
        <div className="error-banner">
          [{state.code}] {state.message}
          {state.code === "model_not_configured" && (
            <>
              <br />
              Add ANTHROPIC_API_KEY to server/.env (copy from .env.example) and restart the server.
            </>
          )}
        </div>
      )}

      <textarea value={story} onChange={(e) => setStory(e.target.value)} disabled={state.status === "loading"} />

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleSubmit} disabled={state.status === "loading" || story.trim().length === 0}>
          {state.status === "loading" ? "Sending to Discovery Engine..." : "Run Discovery"}
        </button>
        {state.status === "error" && (
          <button className="secondary" onClick={handleSubmit}>
            Retry
          </button>
        )}
      </div>

      {state.status === "success" && (
        <>
          <h2>Parsed structured response</h2>
          <pre>{JSON.stringify(state.data, null, 2)}</pre>
        </>
      )}

      <EngineInspector />
    </div>
  );
}

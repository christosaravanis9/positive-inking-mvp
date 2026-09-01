import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { ProjectState } from "@positive-inking/engine";
import { createInitialJourneyState, type JourneyState, type UIState, type ApiErrorState } from "./state";
import { loadPersistedState, savePersistedState, clearPersistedState } from "./persistence";

type Action =
  | { type: "patchProject"; payload: Partial<ProjectState> }
  | { type: "patchUI"; payload: Partial<UIState> }
  | { type: "setError"; payload: ApiErrorState | null }
  | { type: "beginAttempt" }
  | { type: "reset" };

function reducer(state: JourneyState, action: Action): JourneyState {
  switch (action.type) {
    case "patchProject":
      return { ...state, project: { ...state.project, ...action.payload, updated_at: new Date().toISOString() } };
    case "patchUI":
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case "setError":
      // A definitive outcome: failure increments the streak, success (null) resets it.
      // For "an attempt is starting, hide the stale banner" use beginAttempt instead --
      // it must NOT reset the streak, or a retry would erase the very failures it's retrying.
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload,
          loading: false,
          consecutiveFailures: action.payload ? state.ui.consecutiveFailures + 1 : 0,
        },
      };
    case "beginAttempt":
      return { ...state, ui: { ...state.ui, error: null, loading: true } };
    case "reset":
      return createInitialJourneyState();
    default:
      return state;
  }
}

interface JourneyContextValue {
  state: JourneyState;
  patchProject: (payload: Partial<ProjectState>) => void;
  patchUI: (payload: Partial<UIState>) => void;
  setError: (payload: ApiErrorState | null) => void;
  beginAttempt: () => void;
  reset: () => void;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadPersistedState);

  // §16.1: every confirmed answer is persisted as made. Debounced only by
  // React's own batching -- for this app's write volume (one dispatch per
  // user action) writing on every change is simple and fast enough.
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  const value = useMemo<JourneyContextValue>(
    () => ({
      state,
      patchProject: (payload) => dispatch({ type: "patchProject", payload }),
      patchUI: (payload) => dispatch({ type: "patchUI", payload }),
      setError: (payload) => dispatch({ type: "setError", payload }),
      beginAttempt: () => dispatch({ type: "beginAttempt" }),
      reset: () => {
        clearPersistedState();
        dispatch({ type: "reset" });
      },
    }),
    [state],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney(): JourneyContextValue {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within a JourneyProvider");
  return ctx;
}

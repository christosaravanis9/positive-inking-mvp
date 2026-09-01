import { useEffect, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestAvoidanceSuggestions } from "../api/avoidance";
import { AsyncError } from "../components/AsyncError";
import { OptionChips } from "../components/OptionChips";

/** Screen 11B (§8). "Nothing specifically" and "Something else" always present, never filtered (§12.12). */
export function Avoidances() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [selected, setSelected] = useState<string[]>([]);
  const [somethingElse, setSomethingElse] = useState("");
  const [fetching, setFetching] = useState(false);

  async function fetchSuggestions() {
    setFetching(true);
    beginAttempt();
    try {
      const summary = [
        `Elements: ${state.project.visual_elements.map((e) => e.description).join(", ")}`,
        `Composition: ${state.project.composition_type}, background: ${state.project.composition_background}`,
        `Colour: ${state.project.colour_strategy}, realism: ${state.project.realism_level}`,
        `Placement: ${state.project.body_area_coarse}, ${state.project.size_class}`,
      ].join("\n");
      const result = await requestAvoidanceSuggestions(summary);
      patchUI({ avoidanceSuggestions: result.suggestions });
      setError(null);
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Finding things you might want to avoid",
      });
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (state.ui.avoidanceSuggestions.length === 0 && !fetching && !state.ui.error) {
      void fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function confirm(status: "asked_answered" | "asked_declined") {
    const list = status === "asked_declined" ? [] : [...selected, ...(somethingElse.trim() ? [somethingElse.trim()] : [])];
    patchProject({ avoid_list: list, avoid_list_status: status });
    patchUI({ avoidancesAsked: true });
  }

  return (
    <div className="screen">
      <h2>Is there anything you definitely do not want?</h2>
      <AsyncError onRetry={fetchSuggestions} />
      {fetching && <p className="progress-note">Thinking about what could go wrong for this concept...</p>}
      <OptionChips
        options={state.ui.avoidanceSuggestions.map((s) => ({ value: s, label: s }))}
        selected={selected}
        onSelect={toggle}
      />
      <input type="text" value={somethingElse} onChange={(e) => setSomethingElse(e.target.value)} placeholder="Something else..." />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => confirm("asked_answered")}>Continue</button>
        <button className="secondary" onClick={() => confirm("asked_declined")}>
          Nothing specifically
        </button>
      </div>
    </div>
  );
}

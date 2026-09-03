import { useEffect, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestAvoidanceSuggestions } from "../api/avoidance";
import { AsyncError } from "../components/AsyncError";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import { OptionChips } from "../components/OptionChips";

/** Screen 11B (§8). "Nothing specifically" and "Something else" always present, never filtered (§12.12). */
export function Avoidances() {
  const { state, patchProject, patchUI } = useJourney();
  const { run, pending: fetching } = useAsyncAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [somethingElse, setSomethingElse] = useState("");

  function fetchSuggestions() {
    void run(async (guard) => {
      const summary = [
        `Elements: ${state.project.visual_elements.map((e) => e.description).join(", ")}`,
        `Composition: ${state.project.composition_type}, background: ${state.project.composition_background}`,
        `Colour: ${state.project.colour_strategy}, realism: ${state.project.realism_level}`,
        `Placement: ${state.project.body_area_coarse}, ${state.project.size_class}`,
      ].join("\n");
      const result = await requestAvoidanceSuggestions(summary);
      if (guard.isStale()) return;
      patchUI({ avoidanceSuggestions: result.suggestions });
    }, "Finding things you might want to avoid");
  }

  useEffect(() => {
    // run()'s own re-entrancy guard (a ref, set synchronously before any await) is
    // what actually prevents a real double-fetch under React StrictMode's dev-mode
    // double-invoke of this effect -- a state-based guard alone would not catch it,
    // since setState is batched/async and both invocations would see the same
    // stale "not yet fetching" value.
    if (state.ui.avoidanceSuggestions.length === 0 && !state.ui.error) {
      fetchSuggestions();
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
      <p className="screen-eyebrow">Essential safeguards</p>
      <h2 className="screen-heading">Is there anything you definitely do not want?</h2>
      <p className="supporting">These likely failure modes come from this concept. Keep, remove or add to them.</p>
      <AsyncError onRetry={fetchSuggestions} />
      {fetching && <ModelWaitIndicator label="Thinking about what could go wrong for this concept..." />}
      {!fetching && state.ui.avoidanceSuggestions.length > 0 && (
        <p className="progress-note">Suggestions generated for this specific concept.</p>
      )}
      <OptionChips
        options={state.ui.avoidanceSuggestions.map((s) => ({ value: s, label: s }))}
        selected={selected}
        onSelect={toggle}
      />
      <input
        type="text"
        value={somethingElse}
        onChange={(e) => setSomethingElse(e.target.value)}
        placeholder="Add something this design must avoid"
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => confirm("asked_answered")}>Continue</button>
        <button className="secondary" onClick={() => confirm("asked_declined")}>
          Nothing specifically
        </button>
      </div>
    </div>
  );
}

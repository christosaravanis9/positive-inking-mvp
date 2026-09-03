import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { OptionChips } from "../components/OptionChips";

/** Screen 5 (§8, full mode). Reflect -> interpret -> advance (§6). Users may select every theme that matters -- no display-limit truncation of what's stored (§5, AC discussed at §5). */
export function MeaningReflection() {
  const { state, patchProject, patchUI } = useJourney();
  const [selected, setSelected] = useState<string[]>(state.project.selected_themes.slice(0, 3));

  function toggle(theme: string) {
    setSelected((prev) => (prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]));
  }

  function continueToIntention() {
    const coreValues = state.ui.discoveryCoreValueCandidates.slice(0, 3);
    patchProject({ confirmed_themes: selected, confirmed_core_values: coreValues });
    patchUI({ themesSelected: true });
  }

  // §9.7: framed as a starting point, not a finished read, once interpretation_confidence is "low".
  const isLowConfidence = state.project.interpretation_confidence === "low";

  return (
    <div className="screen">
      <p className="screen-eyebrow">Meaning reflection</p>
      <h2 className="screen-heading">{isLowConfidence ? "Here is a starting point." : "Here is what we heard."}</h2>
      <div className="reflection-box">{state.ui.discoveryInterpretation}</div>
      <p className="progress-note">Interpretation generated from your story.</p>
      {isLowConfidence && (
        <p className="supporting">
          This is a starting point, not the full picture — the details you just confirmed matter more here than any
          interpretation.
        </p>
      )}
      <h3 style={{ marginBottom: 4 }}>Which parts feel important?</h3>
      <p className="supporting">Select everything that belongs. We'll consolidate the values without losing your themes.</p>
      <OptionChips
        options={state.ui.discoveryThemeOptions.map((t) => ({ value: t, label: t }))}
        selected={selected}
        onSelect={toggle}
      />
      <button onClick={continueToIntention} disabled={selected.length === 0}>
        Continue
      </button>
      {selected.length === 0 && <p className="supporting">Select at least one theme above to continue.</p>}
    </div>
  );
}

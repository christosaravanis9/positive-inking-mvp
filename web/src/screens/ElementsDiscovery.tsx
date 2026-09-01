import { useEffect, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestAssociations } from "../api/association";
import { AsyncError } from "../components/AsyncError";
import type { VisualElement, ElementFidelity } from "@positive-inking/engine";

/**
 * Screen 7 (§8) -- all modes converge here. Runs the Association Engine
 * (§11) once, then lets the user select/react/extend rather than pick from
 * a fixed menu. "This has given me another idea..." (§3.6) is always
 * available and adds a user-authored element, never merely feedback on the
 * options shown.
 */
export function ElementsDiscovery() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fidelityByIndex, setFidelityByIndex] = useState<Record<number, ElementFidelity>>({});
  const [newIdeaText, setNewIdeaText] = useState("");
  const [addedIdeas, setAddedIdeas] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const hasCandidates = state.ui.associationCandidates.length > 0;

  async function fetchAssociations() {
    setFetching(true);
    beginAttempt();
    try {
      const confirmedText =
        state.project.journey_mode === "full"
          ? state.project.statement_of_intention
          : [state.project.raw_story, state.project.attraction_origin].filter(Boolean).join("\n\n");
      const known = [...state.project.personal_people, ...state.project.personal_places, ...state.project.personal_objects];
      const result = await requestAssociations(confirmedText, known);
      patchUI({
        associationCandidates: result.visual_candidates,
        spatialLanguagePresent: result.spatial_language_present,
        hasTextOrHandwriting: result.has_text_or_handwriting,
        hasLikeness: result.has_likeness,
        textIsPrimary: result.text_is_primary,
        likenessIsPrimary: result.likeness_is_primary,
        primaryElementType: result.primary_element_type,
      });
      patchProject({
        place_role: result.place_role,
        contradictions: result.contradictions_noticed.map((c) => c.description),
      });
      setError(null);
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Finding what could represent it",
      });
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (!hasCandidates && !fetching && !state.ui.error) {
      void fetchAssociations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function addIdea() {
    if (newIdeaText.trim().length === 0) return;
    setAddedIdeas((prev) => [...prev, newIdeaText.trim()]);
    setNewIdeaText("");
  }

  function confirm() {
    const fromCandidates: VisualElement[] = [...selected].map((i) => {
      const candidate = state.ui.associationCandidates[i]!;
      const fidelity = fidelityByIndex[i] ?? "interpretive";
      return {
        id: `candidate-${i}`,
        description: candidate.description,
        personal_meaning: candidate.personal_meaning,
        source_category: candidate.source_category,
        hierarchy: "undecided",
        fidelity,
        colour_role: "undecided",
        reference_required: fidelity === "exact",
        reference_status: fidelity === "exact" ? "to_upload" : "not_needed",
        origin: "system_suggestion",
        user_selected: true,
      };
    });
    const fromIdeas: VisualElement[] = addedIdeas.map((text, i) => ({
      id: `idea-${i}`,
      description: text,
      personal_meaning: text,
      source_category: "new_materialisation",
      hierarchy: "undecided",
      fidelity: "interpretive",
      colour_role: "undecided",
      reference_required: false,
      reference_status: "not_needed",
      origin: "visual_inspiration",
      user_selected: true,
    }));

    patchProject({
      visual_elements: [...fromCandidates, ...fromIdeas],
      visual_inspiration_additions: addedIdeas,
    });
    patchUI({ elementsDiscovered: true });
  }

  return (
    <div className="screen">
      <h2>Let us find what could represent it.</h2>
      <AsyncError onRetry={fetchAssociations} />
      {fetching && <p className="progress-note">Finding personal and visual directions...</p>}
      {hasCandidates && (
        <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {state.ui.associationCandidates.map((candidate, i) => (
            <label key={i} className={`option-chip${selected.has(i) ? " selected" : ""}`} style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ marginRight: 8 }} />
              <strong>{candidate.description}</strong> — {candidate.personal_meaning}
              {selected.has(i) && (
                <select
                  value={fidelityByIndex[i] ?? "interpretive"}
                  onChange={(e) => setFidelityByIndex((prev) => ({ ...prev, [i]: e.target.value as ElementFidelity }))}
                  style={{ display: "block", marginTop: 6 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="exact">Exactly as-is (needs a reference)</option>
                  <option value="closely_based_on">Closely based on this</option>
                  <option value="interpretive">Interpreted by the artist</option>
                  <option value="open">Open — artist's call</option>
                </select>
              )}
            </label>
          ))}
        </div>
      )}

      <div>
        <p className="supporting">This has given me another idea...</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={newIdeaText} onChange={(e) => setNewIdeaText(e.target.value)} placeholder="Describe the new idea" />
          <button className="secondary" onClick={addIdea}>
            Add
          </button>
        </div>
        {addedIdeas.length > 0 && (
          <ul>
            {addedIdeas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={confirm} disabled={selected.size === 0 && addedIdeas.length === 0}>
        Continue
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestAssociations } from "../api/association";
import { AsyncError } from "../components/AsyncError";
import { ReferenceAttachment, emptyReferenceDraft, type ReferenceDraft } from "../components/ReferenceAttachment";
import type { VisualElement, ElementFidelity, ConsentRecord, ReferenceStatus } from "@positive-inking/engine";
import { suppressGeneratedSymbolicSuggestions } from "@positive-inking/engine";
import type { JourneyState } from "../journey/state";

interface AddedIdea {
  text: string;
  fidelity: ElementFidelity;
}

const NEEDS_REFERENCE: ReadonlySet<ElementFidelity> = new Set(["exact", "closely_based_on"]);

function draftToConsentRecord(referenceId: string, draft: ReferenceDraft): ConsentRecord | null {
  // Only worth recording once the user actually engaged with reference capture.
  if (!draft.material_type && !draft.dataUrl) return null;
  return {
    reference_id: referenceId,
    material_type: draft.material_type ?? "own_material",
    subject_relationship: draft.subject_relationship,
    attestation_given: draft.attestation_given,
    attestation_text: draft.attestation_text,
    attested_at: draft.attestation_given ? new Date().toISOString() : null,
    copyright_flag: draft.copyright_flag,
    flag_resolution: draft.flag_resolution,
  };
}

function statusFromDraft(fidelity: ElementFidelity, sourceCategory: string, draft: ReferenceDraft | undefined): ReferenceStatus {
  if (!NEEDS_REFERENCE.has(fidelity)) return "not_needed";
  if (draft?.dataUrl) return "available";
  if (sourceCategory === "new_materialisation") return "to_create";
  return "to_upload";
}

/**
 * Rehydrates a ReferenceDraft from already-confirmed project data (a prior
 * consent record + any attached file). Without this, navigating back to
 * this screen -- e.g. via Screen 13's "Add references" -- would silently
 * discard everything the user already entered, which is exactly the kind
 * of "don't make users reconfirm what they just did" failure V3.0 warns
 * against (§5), just aimed backwards instead of forwards.
 */
function draftFromExisting(elementId: string, state: JourneyState): ReferenceDraft | undefined {
  const record = state.project.consent_records.find((r) => r.reference_id === elementId);
  const asset = state.ui.referenceAssets[elementId];
  if (!record && !asset) return undefined;
  return {
    dataUrl: asset?.dataUrl ?? null,
    fileName: asset?.fileName ?? null,
    material_type: record?.material_type ?? null,
    subject_relationship: record?.subject_relationship ?? "self",
    attestation_given: record?.attestation_given ?? false,
    attestation_text: record?.attestation_text ?? "",
    copyright_flag: record?.copyright_flag ?? false,
    flag_resolution: record?.flag_resolution ?? null,
  };
}

/**
 * Screen 7 (§8) -- all modes converge here. Runs the Association Engine
 * (§11) once, then lets the user select/react/extend rather than pick from
 * a fixed menu. "This has given me another idea..." (§3.6) is always
 * available and adds a user-authored element, never merely feedback on the
 * options shown.
 *
 * Reference attachment (§15) happens right here, inline, at the point the
 * user tells the system a piece needs to be exact -- not on a separate
 * consent screen. §15.3: "One checkbox, one line, at the point of upload."
 */
export function ElementsDiscovery() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();

  const [selected, setSelected] = useState<Set<number>>(() => {
    const set = new Set<number>();
    state.ui.associationCandidates.forEach((_, i) => {
      if (state.project.visual_elements.some((e) => e.id === `candidate-${i}`)) set.add(i);
    });
    return set;
  });
  const [fidelityByIndex, setFidelityByIndex] = useState<Record<number, ElementFidelity>>(() => {
    const map: Record<number, ElementFidelity> = {};
    state.ui.associationCandidates.forEach((_, i) => {
      const el = state.project.visual_elements.find((e) => e.id === `candidate-${i}`);
      if (el) map[i] = el.fidelity;
    });
    return map;
  });
  const [referenceByIndex, setReferenceByIndex] = useState<Record<number, ReferenceDraft>>(() => {
    const map: Record<number, ReferenceDraft> = {};
    state.ui.associationCandidates.forEach((_, i) => {
      const draft = draftFromExisting(`candidate-${i}`, state);
      if (draft) map[i] = draft;
    });
    return map;
  });
  const [newIdeaText, setNewIdeaText] = useState("");
  const [addedIdeas, setAddedIdeas] = useState<AddedIdea[]>(() =>
    state.project.visual_elements.filter((e) => e.id.startsWith("idea-")).map((e) => ({ text: e.description, fidelity: e.fidelity })),
  );
  const [referenceByIdea, setReferenceByIdea] = useState<Record<number, ReferenceDraft>>(() => {
    const map: Record<number, ReferenceDraft> = {};
    state.project.visual_elements
      .filter((e) => e.id.startsWith("idea-"))
      .forEach((e, i) => {
        const draft = draftFromExisting(e.id, state);
        if (draft) map[i] = draft;
      });
    return map;
  });
  const [fetching, setFetching] = useState(false);

  const hasCandidates = state.ui.associationCandidates.length > 0;
  // §9.7 scope limit: suppress system-generated artistic_symbol/tattoo_reference
  // suggestions at low confidence, without ever touching indices -- selected/
  // fidelityByIndex/referenceByIndex and the "candidate-{i}" id scheme all key off
  // the *original* array position, so this only hides entries from render, it
  // never re-indexes them. addedIdeas (user-authored) is a wholly separate array
  // that never passes through this filter at all.
  const visibleCandidateIndices = suppressGeneratedSymbolicSuggestions(
    state.ui.associationCandidates.map((c, i) => ({ source_category: c.source_category, i })),
    state.project.interpretation_confidence,
  ).map((c) => c.i);

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
    setAddedIdeas((prev) => [...prev, { text: newIdeaText.trim(), fidelity: "interpretive" }]);
    setNewIdeaText("");
  }

  function confirm() {
    const candidateConsentRecords: ConsentRecord[] = [];
    const referenceAssets: Record<string, { dataUrl: string; fileName: string }> = {};

    const fromCandidates: VisualElement[] = [...selected].map((i) => {
      const candidate = state.ui.associationCandidates[i]!;
      const fidelity = fidelityByIndex[i] ?? "interpretive";
      const id = `candidate-${i}`;
      const draft = referenceByIndex[i];
      if (draft) {
        const record = draftToConsentRecord(id, draft);
        if (record) candidateConsentRecords.push(record);
        if (draft.dataUrl && draft.fileName) referenceAssets[id] = { dataUrl: draft.dataUrl, fileName: draft.fileName };
      }
      return {
        id,
        description: candidate.description,
        personal_meaning: candidate.personal_meaning,
        source_category: candidate.source_category,
        hierarchy: "undecided",
        fidelity,
        colour_role: "undecided",
        reference_required: NEEDS_REFERENCE.has(fidelity),
        reference_status: statusFromDraft(fidelity, candidate.source_category, draft),
        origin: "system_suggestion",
        user_selected: true,
      };
    });

    const fromIdeas: VisualElement[] = addedIdeas.map((idea, i) => {
      const id = `idea-${i}`;
      const draft = referenceByIdea[i];
      if (draft) {
        const record = draftToConsentRecord(id, draft);
        if (record) candidateConsentRecords.push(record);
        if (draft.dataUrl && draft.fileName) referenceAssets[id] = { dataUrl: draft.dataUrl, fileName: draft.fileName };
      }
      return {
        id,
        description: idea.text,
        personal_meaning: idea.text,
        source_category: "new_materialisation",
        hierarchy: "undecided",
        fidelity: idea.fidelity,
        colour_role: "undecided",
        reference_required: NEEDS_REFERENCE.has(idea.fidelity),
        reference_status: statusFromDraft(idea.fidelity, "new_materialisation", draft),
        origin: "visual_inspiration",
        user_selected: true,
      };
    });

    // Replace, don't append: this screen can be revisited (e.g. from Screen
    // 13's "Add references"), and re-confirming must not duplicate elements
    // or leave stale consent records for a reference the user removed.
    const consentRecordIds = new Set(candidateConsentRecords.map((r) => r.reference_id));
    const preservedConsentRecords = state.project.consent_records.filter((r) => !consentRecordIds.has(r.reference_id));

    patchProject({
      visual_elements: [...fromCandidates, ...fromIdeas],
      visual_inspiration_additions: addedIdeas.map((i) => i.text),
      consent_records: [...preservedConsentRecords, ...candidateConsentRecords],
    });
    patchUI({ elementsDiscovered: true, referenceAssets: { ...state.ui.referenceAssets, ...referenceAssets } });
  }

  return (
    <div className="screen">
      <h2>Let us find what could represent it.</h2>
      <AsyncError onRetry={fetchAssociations} />
      {fetching && <p className="progress-note">Finding personal and visual directions...</p>}
      {hasCandidates && (
        <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {visibleCandidateIndices.map((i) => {
            const candidate = state.ui.associationCandidates[i]!;
            return (
            <div key={i} className={`option-chip${selected.has(i) ? " selected" : ""}`}>
              <label style={{ cursor: "pointer", display: "block" }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ marginRight: 8 }} />
                <strong>{candidate.description}</strong> — {candidate.personal_meaning}
              </label>
              {selected.has(i) && (
                <>
                  <select
                    value={fidelityByIndex[i] ?? "interpretive"}
                    onChange={(e) => setFidelityByIndex((prev) => ({ ...prev, [i]: e.target.value as ElementFidelity }))}
                    style={{ display: "block", marginTop: 6 }}
                  >
                    <option value="exact">Exactly as-is (needs a reference)</option>
                    <option value="closely_based_on">Closely based on this (needs a reference)</option>
                    <option value="interpretive">Interpreted by the artist</option>
                    <option value="open">Open — artist's call</option>
                  </select>
                  {NEEDS_REFERENCE.has(fidelityByIndex[i] ?? "interpretive") && (
                    <ReferenceAttachment
                      value={referenceByIndex[i] ?? emptyReferenceDraft()}
                      onChange={(next) => setReferenceByIndex((prev) => ({ ...prev, [i]: next }))}
                      elementDescription={candidate.description}
                    />
                  )}
                </>
              )}
            </div>
            );
          })}
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
          <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {addedIdeas.map((idea, i) => (
              <div key={i} className="option-chip selected">
                {idea.text}
                <select
                  value={idea.fidelity}
                  onChange={(e) =>
                    setAddedIdeas((prev) => prev.map((it, idx) => (idx === i ? { ...it, fidelity: e.target.value as ElementFidelity } : it)))
                  }
                  style={{ display: "block", marginTop: 6 }}
                >
                  <option value="interpretive">Interpreted by the artist</option>
                  <option value="open">Open — artist's call</option>
                  <option value="exact">Exactly as-is (needs a reference)</option>
                  <option value="closely_based_on">Closely based on this (needs a reference)</option>
                </select>
                {NEEDS_REFERENCE.has(idea.fidelity) && (
                  <ReferenceAttachment
                    value={referenceByIdea[i] ?? emptyReferenceDraft()}
                    onChange={(next) => setReferenceByIdea((prev) => ({ ...prev, [i]: next }))}
                    elementDescription={idea.text}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={confirm} disabled={selected.size === 0 && addedIdeas.length === 0}>
        Continue
      </button>
    </div>
  );
}

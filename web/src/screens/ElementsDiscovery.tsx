import { useEffect, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestAssociations } from "../api/association";
import { AsyncError } from "../components/AsyncError";
import { ReferenceAttachment, emptyReferenceDraft, type ReferenceDraft } from "../components/ReferenceAttachment";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import type { VisualElement, ElementFidelity, ConsentRecord, ReferenceStatus } from "@positive-inking/engine";
import {
  suppressGeneratedSymbolicSuggestions,
  rankVisualCandidates,
  deriveConceptShape,
  classifyIdeaIteration,
  targetMinutesForJourney,
  computeInvalidatedQuestions,
  lightweightSuitabilityCheck,
  canReaskThisIteration,
  isPersonalSourceCategory,
  type IdeaIterationBehavior,
  type SuitabilityConsideration,
} from "@positive-inking/engine";
import type { JourneyState } from "../journey/state";

interface AddedIdea {
  text: string;
  fidelity: ElementFidelity;
  /** §14.2 -- the id of the element this idea replaces, or null if it sits alongside everything else. Never inferred; always the user's own choice. */
  replacesElementId: string | null;
  /** User-confirmed, not guessed (§14.1's likeness/place and scenic-background triggers need real signal, not text-parsing). */
  isLikenessOrPlace: boolean;
  addsScene: boolean;
}

const NEEDS_REFERENCE: ReadonlySet<ElementFidelity> = new Set(["exact", "closely_based_on"]);

/**
 * "Studio ledger" direction: the native <select> fidelity dropdowns became
 * segmented pill buttons. Same values, same setState calls as before -- only
 * the triggering control's shape changed, not what it does. Two orderings
 * (matching the original two <select>s' own option order) since a
 * system-suggested candidate defaults toward "exact"/"closely_based_on"
 * first, while a client's own idea defaults toward "interpretive" first.
 */
const CANDIDATE_FIDELITY_OPTIONS: { value: ElementFidelity; label: string }[] = [
  { value: "exact", label: "Exactly as-is (needs a reference)" },
  { value: "closely_based_on", label: "Closely based on this (needs a reference)" },
  { value: "interpretive", label: "Interpreted by the artist" },
  { value: "open", label: "Open — artist's call" },
];

const IDEA_FIDELITY_OPTIONS: { value: ElementFidelity; label: string }[] = [
  { value: "interpretive", label: "Interpreted by the artist" },
  { value: "open", label: "Open — artist's call" },
  { value: "exact", label: "Exactly as-is (needs a reference)" },
  { value: "closely_based_on", label: "Closely based on this (needs a reference)" },
];

/**
 * §11 concreteness — a candidate marked needs_client_specific_detail carries
 * a category, not yet a real visual idea (e.g. "a specific object that
 * belongs to her"). Answering its one follow_up_prompt turns it into one by
 * appending the client's own concrete detail; this separator is how a
 * revisit of this screen tells an already-answered detail apart from the
 * bare candidate text, so going back and confirming again without retyping
 * never silently drops what was already captured.
 */
const DETAIL_SEPARATOR = " — specifically, ";

function extractDetailAnswer(candidateDescription: string, confirmedDescription: string): string {
  const prefix = candidateDescription + DETAIL_SEPARATOR;
  return confirmedDescription.startsWith(prefix) ? confirmedDescription.slice(prefix.length) : "";
}

function draftToConsentRecord(referenceId: string, draft: ReferenceDraft): ConsentRecord | null {
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
 *
 * The new-idea loop (§14) also lives here -- this is the only screen in
 * this build that shows "visual material" in the sense §3.6 means (an
 * option to react to); Screens 10/11 show text option labels, which the
 * spec's iteration-bound language was never aimed at.
 */
export function ElementsDiscovery() {
  const { state, patchProject, patchUI } = useJourney();
  const { run: runFetchAssociations, pending: fetching } = useAsyncAction();

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
  const [detailByIndex, setDetailByIndex] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    state.ui.associationCandidates.forEach((c, i) => {
      const el = state.project.visual_elements.find((e) => e.id === `candidate-${i}`);
      if (el) {
        const detail = extractDetailAnswer(c.description, el.description);
        if (detail) map[i] = detail;
      }
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
  const [replacesChoice, setReplacesChoice] = useState("");
  const [isLikenessOrPlaceChecked, setIsLikenessOrPlaceChecked] = useState(false);
  const [addsSceneChecked, setAddsSceneChecked] = useState(false);
  const [addedIdeas, setAddedIdeas] = useState<AddedIdea[]>(() =>
    state.project.visual_elements
      .filter((e) => e.id.startsWith("idea-"))
      .map((e) => ({ text: e.description, fidelity: e.fidelity, replacesElementId: null, isLikenessOrPlace: false, addsScene: false })),
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
  const [demotedNotice, setDemotedNotice] = useState<string | null>(null);
  const [scopeReflection, setScopeReflection] = useState<{
    text: string;
    prospectiveCount: number;
    suitability: SuitabilityConsideration | null;
  } | null>(null);

  const hasCandidates = state.ui.associationCandidates.length > 0;
  // §11: rank by personal_relevance/story_relevance/originality (outweighing
  // raw visual appeal) before display, then §9.7 scope limit: suppress
  // system-generated artistic_symbol/tattoo_reference at low confidence.
  // Neither step ever touches indices -- selected/fidelityByIndex/
  // referenceByIndex and the "candidate-{i}" id scheme all key off the
  // *original* array position, so this only reorders/hides entries for
  // render. addedIdeas (user-authored) is a wholly separate array that never
  // passes through either function.
  const indexedCandidates = state.ui.associationCandidates.map((c, i) => ({ ...c, i }));
  const rankedAndFiltered = suppressGeneratedSymbolicSuggestions(rankVisualCandidates(indexedCandidates), state.project.interpretation_confidence);
  const visibleCandidateIndices = rankedAndFiltered.map((c) => c.i);

  // §14.2: only offered when there is exactly one already-confirmed element to
  // possibly replace -- this build has no explicit "set hierarchy to primary"
  // step anywhere, so a lone existing element is the one unambiguous anchor for
  // "confirmed primary" the question can point at without guessing which of
  // several elements is meant.
  const existingSoleElement = state.project.visual_elements.length === 1 ? state.project.visual_elements[0]! : null;

  function fetchAssociations() {
    void runFetchAssociations(async (guard) => {
      const confirmedText =
        state.project.journey_mode === "full"
          ? state.project.statement_of_intention
          : [state.project.raw_story, state.project.attraction_origin].filter(Boolean).join("\n\n");
      const known = [...state.project.personal_people, ...state.project.personal_places, ...state.project.personal_objects];
      const result = await requestAssociations(confirmedText, known);
      if (guard.isStale()) return;
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
        // Kept as the full {description, resolutions} record, not flattened to a
        // bare description -- a readiness reason needs the resolutions too, to
        // say what to do about a contradiction, not just that one exists.
        contradictions: result.contradictions_noticed,
      });
    }, "Finding what could represent it");
  }

  useEffect(() => {
    // runFetchAssociations' own re-entrancy guard (a ref, set synchronously before
    // any await) is what actually prevents a real double-fetch here -- React
    // StrictMode's dev-mode double-invoke of this effect calls fetchAssociations
    // twice in the same tick, and a state-based guard alone would not catch that
    // (setState is batched/async, so both invocations would see the same stale
    // "not yet fetching" value). This outer condition only avoids re-fetching on
    // every later re-render once candidates exist or an error is already shown.
    if (!hasCandidates && !state.ui.error) {
      fetchAssociations();
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

  function resetIdeaForm() {
    setNewIdeaText("");
    setReplacesChoice("");
    setIsLikenessOrPlaceChecked(false);
    setAddsSceneChecked(false);
  }

  function currentIterationNumber(): number {
    return state.project.idea_iteration_count + 1;
  }

  function elapsedOverTargetRatio(): number {
    const targetMinutes = targetMinutesForJourney(
      state.project.journey_mode,
      state.project.visual_elements.length + addedIdeas.length,
      state.project.size_class,
    );
    const elapsedMs = Date.now() - new Date(state.project.created_at).getTime();
    return elapsedMs / (targetMinutes * 60000);
  }

  function commitIdea(text: string) {
    setAddedIdeas((prev) => [
      ...prev,
      {
        text,
        fidelity: "interpretive",
        replacesElementId: replacesChoice || null,
        isLikenessOrPlace: isLikenessOrPlaceChecked,
        addsScene: addsSceneChecked,
      },
    ]);
    patchProject({ idea_iteration_count: currentIterationNumber() });
    resetIdeaForm();
  }

  function demoteIdea(text: string) {
    patchProject({
      artist_notes: [...state.project.artist_notes, text],
      idea_iteration_count: currentIterationNumber(),
      ideas_demoted_to_notes: state.project.ideas_demoted_to_notes + 1,
    });
    setDemotedNotice(text);
    resetIdeaForm();
  }

  function addIdea() {
    if (newIdeaText.trim().length === 0) return;
    const text = newIdeaText.trim();
    const behavior: IdeaIterationBehavior = classifyIdeaIteration(currentIterationNumber(), elapsedOverTargetRatio());

    if (behavior === "demoted_to_notes") {
      demoteIdea(text);
      return;
    }

    if (behavior === "full_with_scope_reflection") {
      const prospectiveCount = state.project.visual_elements.length + addedIdeas.length + 1;
      const suitability = lightweightSuitabilityCheck(state.project.size_class || "small", prospectiveCount, state.project.creative_control || undefined);
      setScopeReflection({ text, prospectiveCount, suitability });
      return;
    }

    commitIdea(text);
  }

  function confirmScopeReflection() {
    if (!scopeReflection) return;
    commitIdea(scopeReflection.text);
    setScopeReflection(null);
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
        if (draft.dataUrl && draft.fileName) {
          referenceAssets[id] = { dataUrl: draft.dataUrl, fileName: draft.fileName };
          logTelemetryEvent("reference_requested", state.project.project_id, { material_type: draft.material_type });
        }
      }
      const detailAnswer = detailByIndex[i]?.trim();
      const description = detailAnswer ? `${candidate.description}${DETAIL_SEPARATOR}${detailAnswer}` : candidate.description;
      const concreteness = candidate.resolution_state === "concrete" || detailAnswer ? "concrete" : "unresolved_placeholder";
      return {
        id,
        description,
        personal_meaning: candidate.personal_meaning,
        source_category: candidate.source_category,
        hierarchy: "undecided",
        fidelity,
        colour_role: "undecided",
        reference_required: NEEDS_REFERENCE.has(fidelity),
        reference_status: statusFromDraft(fidelity, candidate.source_category, draft),
        origin: "system_suggestion",
        user_selected: true,
        concreteness,
      };
    });

    const fromIdeas: VisualElement[] = addedIdeas.map((idea, i) => {
      const id = `idea-${i}`;
      const draft = referenceByIdea[i];
      if (draft) {
        const record = draftToConsentRecord(id, draft);
        if (record) candidateConsentRecords.push(record);
        if (draft.dataUrl && draft.fileName) {
          referenceAssets[id] = { dataUrl: draft.dataUrl, fileName: draft.fileName };
          logTelemetryEvent("reference_requested", state.project.project_id, { material_type: draft.material_type });
        }
      }
      return {
        id,
        description: idea.text,
        personal_meaning: idea.text,
        source_category: "new_materialisation",
        hierarchy: idea.replacesElementId ? "primary" : "undecided",
        fidelity: idea.fidelity,
        colour_role: "undecided",
        reference_required: NEEDS_REFERENCE.has(idea.fidelity),
        reference_status: statusFromDraft(idea.fidelity, "new_materialisation", draft),
        origin: "visual_inspiration",
        user_selected: true,
        // The client wrote this themselves -- it is definitionally a real idea,
        // never a category placeholder needing a follow-up.
        concreteness: "concrete",
      };
    });

    // §22 -- personal-vs-generic selection and user-authored ideas. Fired here (once
    // per confirm) rather than at every toggle, so this only ever records what the
    // client actually kept, never every candidate they glanced at.
    for (const element of fromCandidates) {
      logTelemetryEvent("visual_candidate_selected", state.project.project_id, {
        source_category: element.source_category,
        is_personal: isPersonalSourceCategory(element.source_category),
      });
    }
    for (const idea of addedIdeas) {
      logTelemetryEvent("user_authored_idea_added", state.project.project_id, { replaces_existing: idea.replacesElementId !== null });
    }

    // §14.2: a replacement is dropped here, and only here -- the one place the
    // user explicitly said "instead of", never inferred anywhere else.
    const replacedIds = new Set(addedIdeas.map((i) => i.replacesElementId).filter((id): id is string => id !== null));
    const survivingCandidates = fromCandidates.filter((e) => !replacedIds.has(e.id));
    // Elements already confirmed in a prior visit that aren't represented by the
    // current selection/addedIdeas state at all (shouldn't normally happen, since
    // both rehydrate from project.visual_elements on mount) are preserved too,
    // minus anything just replaced -- belt and suspenders against silent loss.
    const handledIds = new Set([...survivingCandidates, ...fromIdeas].map((e) => e.id));
    const untouchedPriorElements = state.project.visual_elements.filter((e) => !handledIds.has(e.id) && !replacedIds.has(e.id));

    const newElements = [...untouchedPriorElements, ...survivingCandidates, ...fromIdeas];

    // §14.1 recomputation -- compare concept_shape before vs after this edit.
    const anyNewLikenessOrPlace = addedIdeas.some((i) => i.isLikenessOrPlace);
    const anyNewScene = addedIdeas.some((i) => i.addsScene);
    const oldConceptShape = deriveConceptShape({
      element_count: state.project.visual_elements.length,
      place_role: state.project.place_role,
      spatial_language_present: state.ui.spatialLanguagePresent,
      has_text_or_handwriting: state.ui.hasTextOrHandwriting,
      has_likeness: state.ui.hasLikeness,
      text_is_primary: state.ui.textIsPrimary,
      likeness_is_primary: state.ui.likenessIsPrimary,
    });
    const newConceptShape = deriveConceptShape({
      element_count: newElements.length,
      place_role: state.project.place_role,
      spatial_language_present: state.ui.spatialLanguagePresent || anyNewScene,
      has_text_or_handwriting: state.ui.hasTextOrHandwriting,
      has_likeness: state.ui.hasLikeness || anyNewLikenessOrPlace,
      text_is_primary: state.ui.textIsPrimary,
      likeness_is_primary: state.ui.likenessIsPrimary,
    });

    const iterationKey = String(state.project.idea_iteration_count);
    const alreadyReaskedThisIteration = state.project.questions_reasked
      .filter((entry) => entry.startsWith(`${iterationKey}:`))
      .map((entry) => entry.split(":")[1]!);

    const triggers = {
      concept_shape_changed: oldConceptShape !== newConceptShape,
      element_count_crossed_one_to_many: state.project.visual_elements.length === 1 && newElements.length >= 2,
      likeness_or_place_introduced: anyNewLikenessOrPlace,
      background_was_none_now_scenic: state.project.composition_background === "none" && anyNewScene,
    };
    const invalidated = computeInvalidatedQuestions(triggers, {
      density_previously_skipped: state.ui.compositionAnswers.density === undefined,
      realism_previously_skipped_or_defaulted: state.ui.artisticAnswers.realism === undefined,
    });

    const newlyReasked: string[] = [];
    const compositionAnswers = { ...state.ui.compositionAnswers };
    let compositionFlowDone = state.ui.compositionFlowDone;
    if (invalidated.composition_type && canReaskThisIteration("composition_type", alreadyReaskedThisIteration)) {
      delete compositionAnswers.composition_type;
      compositionFlowDone = false;
      newlyReasked.push("composition_type");
    }
    if (invalidated.density && canReaskThisIteration("density", alreadyReaskedThisIteration)) {
      delete compositionAnswers.density;
      compositionFlowDone = false;
      newlyReasked.push("density");
    }
    let compositionBackground = state.project.composition_background;
    if (invalidated.background_decision && canReaskThisIteration("internal_background", alreadyReaskedThisIteration)) {
      delete compositionAnswers.internal_background;
      compositionBackground = "undecided"; // never silently overridden -- must be re-asked (AC 46)
      compositionFlowDone = false;
      newlyReasked.push("internal_background");
    }
    const artisticAnswers = { ...state.ui.artisticAnswers };
    let artisticFlowDone = state.ui.artisticFlowDone;
    if (invalidated.realism && canReaskThisIteration("realism", alreadyReaskedThisIteration)) {
      delete artisticAnswers.realism;
      artisticFlowDone = false;
      newlyReasked.push("realism");
    }

    const consentRecordIds = new Set(candidateConsentRecords.map((r) => r.reference_id));
    const preservedConsentRecords = state.project.consent_records.filter((r) => !consentRecordIds.has(r.reference_id) && !replacedIds.has(r.reference_id));

    patchProject({
      visual_elements: newElements,
      visual_inspiration_additions: [...state.project.visual_inspiration_additions, ...addedIdeas.map((i) => i.text)],
      consent_records: [...preservedConsentRecords, ...candidateConsentRecords],
      composition_background: compositionBackground,
      questions_reasked: [...state.project.questions_reasked, ...newlyReasked.map((q) => `${iterationKey}:${q}`)],
    });
    patchUI({
      elementsDiscovered: true,
      referenceAssets: { ...state.ui.referenceAssets, ...referenceAssets },
      hasLikeness: state.ui.hasLikeness || anyNewLikenessOrPlace,
      spatialLanguagePresent: state.ui.spatialLanguagePresent || anyNewScene,
      compositionAnswers,
      compositionFlowDone,
      artisticAnswers,
      artisticFlowDone,
    });
  }

  return (
    <div className="screen ledger-screen">
      <div className="ledger-header-row">
        <span className="ledger-step-label">07 / 13 &nbsp;·&nbsp; Finding the image</span>
      </div>
      <div className="ledger-progress-track">
        <div className="ledger-progress-fill" />
      </div>
      <h2 className="ledger-headline">Let us find what could represent it.</h2>
      <AsyncError onRetry={fetchAssociations} />
      {fetching && <p className="progress-note">Finding personal and visual directions...</p>}
      {hasCandidates && (
        <div className="ledger-list">
          {visibleCandidateIndices.map((i) => {
            const candidate = state.ui.associationCandidates[i]!;
            return (
              <div key={i} className={`ledger-candidate${selected.has(i) ? " selected" : ""}`}>
                <label className="ledger-candidate-row">
                  <input type="checkbox" className="ledger-seal-input" checked={selected.has(i)} onChange={() => toggle(i)} />
                  <span className="ledger-seal" aria-hidden="true" />
                  <span className="ledger-candidate-body">
                    <strong>{candidate.description}</strong>
                    {" — "}
                    <span className="ledger-candidate-meaning">{candidate.personal_meaning}</span>
                  </span>
                </label>
                {selected.has(i) && (
                  <div className="ledger-marginalia">
                    {candidate.resolution_state === "needs_client_specific_detail" && (
                      <div className="ledger-marginalia-field">
                        <span className="ledger-marginalia-label">{candidate.follow_up_prompt ?? "What specifically is this?"}</span>
                        <input
                          type="text"
                          className="ledger-lined-input"
                          value={detailByIndex[i] ?? ""}
                          onChange={(e) => setDetailByIndex((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Optional, but this is what makes it a real design rather than a placeholder"
                        />
                      </div>
                    )}
                    <div className="ledger-fidelity-row">
                      <div className="ledger-fidelity" role="group" aria-label="Fidelity">
                        {CANDIDATE_FIDELITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`ledger-fidelity-pill${(fidelityByIndex[i] ?? "interpretive") === opt.value ? " active" : ""}`}
                            onClick={() => setFidelityByIndex((prev) => ({ ...prev, [i]: opt.value }))}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {NEEDS_REFERENCE.has(fidelityByIndex[i] ?? "interpretive") && (
                      <ReferenceAttachment
                        value={referenceByIndex[i] ?? emptyReferenceDraft()}
                        onChange={(next) => setReferenceByIndex((prev) => ({ ...prev, [i]: next }))}
                        elementDescription={candidate.description}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <p className="supporting">This has given me another idea...</p>

        {demotedNotice && (
          <p className="supporting">
            Added to your artist notes — you've reached the point where new ideas get captured for the artist to
            discuss rather than reshaping the design ("{demotedNotice}").
          </p>
        )}

        {scopeReflection && (
          <div className="reference-attachment">
            <p style={{ margin: 0 }}>
              That would be {scopeReflection.prospectiveCount} elements — worth checking they can all live at this
              size.
            </p>
            {scopeReflection.suitability && <p className="reference-note">{scopeReflection.suitability.reason}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={confirmScopeReflection}>
                Add it anyway
              </button>
              <button type="button" className="secondary" onClick={() => setScopeReflection(null)}>
                Never mind
              </button>
            </div>
          </div>
        )}

        {existingSoleElement && (
          <label className="reference-field">
            <span>Does this replace "{existingSoleElement.description}", or sit alongside it?</span>
            <select value={replacesChoice} onChange={(e) => setReplacesChoice(e.target.value)}>
              <option value="">Sits alongside it</option>
              <option value={existingSoleElement.id}>Replaces it</option>
            </select>
          </label>
        )}
        {!state.ui.hasLikeness && (
          <label className="reference-attestation">
            <input type="checkbox" checked={isLikenessOrPlaceChecked} onChange={(e) => setIsLikenessOrPlaceChecked(e.target.checked)} />
            This involves a specific person's likeness or a real place
          </label>
        )}
        {state.project.composition_background === "none" && (
          <label className="reference-attestation">
            <input type="checkbox" checked={addsSceneChecked} onChange={(e) => setAddsSceneChecked(e.target.checked)} />
            This adds a scene or setting around the tattoo
          </label>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={newIdeaText} onChange={(e) => setNewIdeaText(e.target.value)} placeholder="Describe the new idea" />
          <button className="secondary" onClick={addIdea}>
            Add
          </button>
        </div>
        {addedIdeas.length > 0 && (
          <div className="ledger-list">
            {addedIdeas.map((idea, i) => (
              <div key={i} className="ledger-candidate selected">
                <div className="ledger-candidate-body">
                  {idea.text}
                  {idea.replacesElementId && <span className="ledger-idea-tag">replaces existing element</span>}
                </div>
                <div className="ledger-marginalia">
                  <div className="ledger-fidelity-row">
                    <div className="ledger-fidelity" role="group" aria-label="Fidelity">
                      {IDEA_FIDELITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`ledger-fidelity-pill${idea.fidelity === opt.value ? " active" : ""}`}
                          onClick={() =>
                            setAddedIdeas((prev) => prev.map((it, idx) => (idx === i ? { ...it, fidelity: opt.value } : it)))
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {NEEDS_REFERENCE.has(idea.fidelity) && (
                    <ReferenceAttachment
                      value={referenceByIdea[i] ?? emptyReferenceDraft()}
                      onChange={(next) => setReferenceByIdea((prev) => ({ ...prev, [i]: next }))}
                      elementDescription={idea.text}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ledger-footer">
        <button
          className="ledger-cta"
          onClick={confirm}
          disabled={selected.size === 0 && addedIdeas.length === 0 && state.project.visual_elements.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

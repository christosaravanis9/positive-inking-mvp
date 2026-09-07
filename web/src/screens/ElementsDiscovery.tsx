import { useEffect, useRef, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction, useKeyedAsyncAction } from "../journey/useAsyncAction";
import { requestAssociations, requestAssociationAlternative } from "../api/association";
import { AsyncError } from "../components/AsyncError";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import { ReferenceAttachment, emptyReferenceDraft, type ReferenceDraft } from "../components/ReferenceAttachment";
import { NEEDS_REFERENCE, statusFromDraft, draftToConsentRecord, draftFromExisting } from "../journey/referenceDraft";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import type { VisualElement, ElementFidelity, ConsentRecord } from "@positive-inking/engine";
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

interface AddedIdea {
  text: string;
  fidelity: ElementFidelity;
  /** §14.2 -- the id of the element this idea replaces, or null if it sits alongside everything else. Never inferred; always the user's own choice. */
  replacesElementId: string | null;
  /** User-confirmed, not guessed (§14.1's likeness/place and scenic-background triggers need real signal, not text-parsing). */
  isLikenessOrPlace: boolean;
  addsScene: boolean;
}

/**
 * "This has given me another idea..." (§3.6) keeps its own separate fidelity
 * choice + reference flow, unchanged by the 2026-09-07 Screen 7 redesign --
 * that redesign is scoped to Association-sourced *candidates* specifically
 * (Keep/Build upon/Not this one, reference collection moved to Screen 13);
 * a user-authored idea was never part of that scope. Same values, same
 * setState calls as before -- only candidates' own control shape changed.
 */
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

/**
 * Per-candidate visible cap (2026-09-07 redesign, up from 3). Everything
 * ranked beyond this position in the already-fetched candidate list becomes
 * that fetch's reserve pool for a free "Not this one" -- see notThisOne()
 * and submitReroll() below.
 */
const VISIBLE_CANDIDATE_COUNT = 5;

function extractDetailAnswer(candidateDescription: string, confirmedDescription: string): string {
  const prefix = candidateDescription + DETAIL_SEPARATOR;
  return confirmedDescription.startsWith(prefix) ? confirmedDescription.slice(prefix.length) : "";
}

/**
 * Screen 7 (§8) -- all modes converge here. Runs the Association Engine
 * (§11) once, then lets the user react per candidate: Keep it, build upon
 * it, or say it's not right (optionally saying why, which either pops a
 * free reserve alternative or -- only past the end of what's already been
 * generated for that slot, with a reason typed -- asks the model for one
 * more). "This has given me another idea..." (§3.6) is always available
 * and adds a user-authored element, never merely feedback on the options
 * shown.
 *
 * Reference attachment (§15) no longer happens here (2026-09-07) -- it now
 * happens on Screen 13, once fidelity is refined per confirmed element, at
 * the point the system actually knows a reference is needed. Screen 7 only
 * ever decides Keep/Build upon (which implies a fidelity default) or asks
 * for something else.
 *
 * The new-idea loop (§14) also lives here -- this is the only screen in
 * this build that shows "visual material" in the sense §3.6 means (an
 * option to react to); Screens 10/11 show text option labels, which the
 * spec's iteration-bound language was never aimed at.
 */
export function ElementsDiscovery() {
  const { state, patchProject, patchUI } = useJourney();
  const { run: runFetchAssociations, pending: fetching } = useAsyncAction();
  const { run: runReroll, isPending: isRerollPending } = useKeyedAsyncAction();

  // Concurrency-safety (2026-09-07): two per-slot Why-generation calls can be
  // in flight at once (useKeyedAsyncAction explicitly allows different keys
  // to run concurrently). Appending the new candidate to
  // state.ui.associationCandidates via patchUI needs the *current* array at
  // resolve-time, not whatever this render's closure captured when the call
  // started -- otherwise a later-resolving slot's append could silently
  // overwrite an earlier-resolving slot's already-appended candidate.
  //
  // The useEffect sync alone is NOT sufficient (found live, 2026-09-07,
  // after a report of two slots showing identical text): it only updates
  // .current after a render commits, which does not happen between two
  // promise resolutions that land in the same tick (e.g. two per-slot
  // generation calls that both resolve around the same time). Both would
  // then read the same stale .current, compute the same newIndex, and the
  // second patchUI would silently overwrite the first's appended
  // candidate. Every write site below therefore mutates .current
  // synchronously and immediately, at the same time as calling patchUI --
  // the effect remains only as a safety net for when the array changes via
  // some other path (a fresh fetchAssociations() call, or first mount).
  const associationCandidatesRef = useRef(state.ui.associationCandidates);
  useEffect(() => {
    associationCandidatesRef.current = state.ui.associationCandidates;
  }, [state.ui.associationCandidates]);

  const hasCandidates = state.ui.associationCandidates.length > 0;
  // §11: rank by personal_relevance/story_relevance/originality (outweighing
  // raw visual appeal) before display, then §9.7 scope limit: suppress
  // system-generated artistic_symbol/tattoo_reference at low confidence.
  // Neither step ever touches indices -- decisionByIndex/detailByIndex and
  // the "candidate-{i}" id scheme all key off the *original* array
  // position, so this only reorders/hides entries for render. addedIdeas
  // (user-authored) is a wholly separate array that never passes through
  // either function.
  const indexedCandidates = state.ui.associationCandidates.map((c, i) => ({ ...c, i }));
  const rankedAndFiltered = suppressGeneratedSymbolicSuggestions(rankVisualCandidates(indexedCandidates), state.project.interpretation_confidence);
  const defaultTopIndices = rankedAndFiltered.slice(0, VISIBLE_CANDIDATE_COUNT).map((c) => c.i);
  const reservePool = rankedAndFiltered.slice(VISIBLE_CANDIDATE_COUNT);

  const [decisionByIndex, setDecisionByIndex] = useState<Record<number, "keep" | "build_upon">>(() => {
    const map: Record<number, "keep" | "build_upon"> = {};
    state.ui.associationCandidates.forEach((_, i) => {
      const el = state.project.visual_elements.find((e) => e.id === `candidate-${i}`);
      if (el) map[i] = el.fidelity === "interpretive" || el.fidelity === "open" ? "build_upon" : "keep";
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

  // Per-slot non-destructive re-roll history (2026-09-07). Keyed by SLOT
  // POSITION (0..VISIBLE_CANDIDATE_COUNT-1), not candidate index, because a
  // slot's occupant changes on re-roll while its position on screen does
  // not. Nothing already generated for a slot is ever discarded: history
  // only ever grows, and historyPos just moves within it.
  //
  // Seeded via an effect gated on hasCandidates, NOT a useState lazy
  // initializer -- this component mounts before fetchAssociations' request
  // resolves (associationCandidates starts empty), so a lazy initializer
  // would freeze these at empty seeds forever. An empty history/historyPos
  // for a slot falls back to defaultTopIndices *recomputed fresh every
  // render*, which drifts as ranking changes (e.g. once a Why-driven
  // re-roll appends a new candidate that re-ranks into another slot's
  // position) -- confirmed live: a second slot silently duplicated a
  // just-generated candidate this way before this fix.
  const [history, setHistory] = useState<Record<number, number[]>>({});
  const [historyPos, setHistoryPos] = useState<Record<number, number>>({});
  // Tracks how far into the free reserve pool a blank ("no reason given")
  // re-roll has already consumed, shared across every slot so the same
  // reserve candidate is never handed out twice.
  //
  // reserveCursorRef is the authoritative value, read-and-incremented
  // synchronously in submitReroll's blank path; reserveCursor (state) is a
  // pure display mirror (the "reserve exhausted" hint text below). Found
  // live, 2026-09-07: reading a plain useState value in that handler is
  // not safe here -- two different slots' blank re-rolls clicked back to
  // back, before React re-renders between them, would both read the same
  // stale reserveCursor, both compute the same nextCandidate, and both
  // hand the identical candidate to two different slots at once. The ref
  // is mutated immediately, so the second call always sees the first's
  // increment regardless of render timing.
  const reserveCursorRef = useRef(0);
  const [reserveCursor, setReserveCursor] = useState(0);
  const [rerollPromptOpenSlots, setRerollPromptOpenSlots] = useState<Set<number>>(new Set());
  const [whyDraft, setWhyDraft] = useState<Record<number, string>>({});
  const historySeededRef = useRef(false);
  useEffect(() => {
    if (historySeededRef.current || !hasCandidates) return;
    historySeededRef.current = true;
    // Guarantee a candidate already confirmed as a visual_elements entry stays
    // visible once seeded (e.g. navigating back to this screen), even if it
    // was originally re-rolled in and now falls outside the default top-N by
    // rank -- what the client already chose must never silently disappear.
    const confirmedOutsideTop = state.ui.associationCandidates
      .map((_, i) => i)
      .filter((i) => !defaultTopIndices.includes(i) && state.project.visual_elements.some((e) => e.id === `candidate-${i}`));
    const historySeed: Record<number, number[]> = {};
    const posSeed: Record<number, number> = {};
    defaultTopIndices.forEach((idx, slot) => {
      historySeed[slot] = [idx];
      posSeed[slot] = 0;
    });
    confirmedOutsideTop.forEach((idx, k) => {
      if (k < defaultTopIndices.length) {
        historySeed[k] = [...historySeed[k]!, idx];
        posSeed[k] = 1;
      }
    });
    setHistory(historySeed);
    setHistoryPos(posSeed);
    let cursor = 0;
    Object.values(historySeed).forEach((hist) => {
      hist.forEach((idx, pos) => {
        if (pos === 0) return; // the slot's original default candidate, not a reserve pop
        const reservePos = reservePool.findIndex((c) => c.i === idx);
        if (reservePos !== -1 && reservePos + 1 > cursor) cursor = reservePos + 1;
      });
    });
    reserveCursorRef.current = cursor;
    setReserveCursor(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCandidates]);

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

  const visibleCandidateIndices = defaultTopIndices.map((defaultIdx, slot) => {
    const hist = history[slot] ?? [defaultIdx];
    const pos = historyPos[slot] ?? 0;
    return hist[pos] ?? defaultIdx;
  });

  // §14.2: only offered when there is exactly one already-confirmed element to
  // possibly replace -- this build has no explicit "set hierarchy to primary"
  // step anywhere, so a lone existing element is the one unambiguous anchor for
  // "confirmed primary" the question can point at without guessing which of
  // several elements is meant.
  const existingSoleElement = state.project.visual_elements.length === 1 ? state.project.visual_elements[0]! : null;

  // Bug fix (live testing): a demoted idea (artist_notes only) satisfies none of these three,
  // so without a stated reason Continue goes dark with no way for the user to tell what's
  // needed. Requiring a real element before advancing is correct (artist notes are
  // deliberately not design elements) -- what was missing is saying so.
  const continueDisabled = Object.keys(decisionByIndex).length === 0 && addedIdeas.length === 0 && state.project.visual_elements.length === 0;

  function confirmedMeaningText(): string {
    return state.project.journey_mode === "full"
      ? state.project.statement_of_intention
      : [state.project.raw_story, state.project.attraction_origin].filter(Boolean).join("\n\n");
  }

  function knownPersonalMaterial(): string[] {
    return [...state.project.personal_people, ...state.project.personal_places, ...state.project.personal_objects];
  }

  function fetchAssociations() {
    void runFetchAssociations(async (guard) => {
      const result = await requestAssociations(confirmedMeaningText(), knownPersonalMaterial());
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

  function decide(index: number, decision: "keep" | "build_upon") {
    setDecisionByIndex((prev) => {
      if (prev[index] === decision) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: decision };
    });
  }

  function appendToHistory(slot: number, index: number) {
    setHistory((prev) => {
      const hist = prev[slot] ?? [defaultTopIndices[slot]!];
      return { ...prev, [slot]: [...hist, index] };
    });
    setHistoryPos((prev) => {
      const hist = history[slot] ?? [defaultTopIndices[slot]!];
      return { ...prev, [slot]: hist.length };
    });
  }

  function pageSlot(slot: number, delta: number) {
    setHistoryPos((prev) => {
      const hist = history[slot] ?? [defaultTopIndices[slot]!];
      const current = prev[slot] ?? 0;
      const nextPos = Math.min(Math.max(current + delta, 0), hist.length - 1);
      return { ...prev, [slot]: nextPos };
    });
  }

  function notThisOne(slot: number) {
    const hist = history[slot] ?? [defaultTopIndices[slot]!];
    const pos = historyPos[slot] ?? 0;
    // Already-generated ground for this slot -- paging forward through it is
    // free, exactly like paging back with the pager below.
    if (pos < hist.length - 1) {
      pageSlot(slot, 1);
      return;
    }
    // At the end of what's been generated for this slot -- ask why (optional)
    // before deciding whether this needs a real model call.
    setRerollPromptOpenSlots((prev) => new Set(prev).add(slot));
  }

  function cancelReroll(slot: number) {
    setRerollPromptOpenSlots((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
    setWhyDraft((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function submitReroll(slot: number) {
    const reason = (whyDraft[slot] ?? "").trim();
    setRerollPromptOpenSlots((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
    setWhyDraft((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });

    // A plain re-roll with no reason given stays free -- consistent with the
    // client-only reserve-pool swap this replaces. No new server call, no new
    // async/staleness guard: the candidate is already sitting in the one
    // Association response already fetched.
    if (!reason) {
      // Read-and-increment the ref synchronously and immediately -- see its
      // declaration comment for why the reserveCursor state value alone is
      // not safe to read here.
      if (reserveCursorRef.current >= reservePool.length) return; // exhausted -- never auto-upgrades to a real call
      const nextCandidate = reservePool[reserveCursorRef.current]!;
      reserveCursorRef.current += 1;
      setReserveCursor(reserveCursorRef.current);
      appendToHistory(slot, nextCandidate.i);
      return;
    }

    // Advancing past the end of history with a reason typed is the one path
    // that costs a real per-slot model call.
    void runReroll(
      slot,
      async (guard) => {
        const hist = history[slot] ?? [defaultTopIndices[slot]!];
        const alreadyShown = hist
          .map((idx) => associationCandidatesRef.current[idx]?.description)
          .filter((d): d is string => Boolean(d));
        const result = await requestAssociationAlternative(confirmedMeaningText(), knownPersonalMaterial(), alreadyShown, reason);
        if (guard.isStale()) return;
        const newCandidate = result.visual_candidates[0];
        if (!newCandidate) return;
        const newIndex = associationCandidatesRef.current.length;
        // Mutate the ref itself synchronously, immediately -- see the ref's
        // own declaration comment for why relying on the mirroring effect
        // alone is not safe here.
        const nextCandidates = [...associationCandidatesRef.current, newCandidate];
        associationCandidatesRef.current = nextCandidates;
        patchUI({ associationCandidates: nextCandidates });
        appendToHistory(slot, newIndex);
      },
      "Finding another idea for this slot",
    );
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
    // Core invariant (live-test regression): a client must always have some path to a
    // real visual element, however long the journey has run or how many iterations have
    // passed -- both demotion triggers below are monotonic and never reset, so without
    // this guard a client starting from zero real elements could cross one and then have
    // every subsequent "Add idea" permanently demoted, with no way forward at all.
    const hasRealVisualElement = state.project.visual_elements.length + addedIdeas.length > 0;
    const behavior: IdeaIterationBehavior = classifyIdeaIteration(currentIterationNumber(), elapsedOverTargetRatio(), hasRealVisualElement);

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

    const fromCandidates: VisualElement[] = Object.entries(decisionByIndex).map(([key, decision]) => {
      const i = Number(key);
      const candidate = state.ui.associationCandidates[i]!;
      const id = `candidate-${i}`;
      const detailAnswer = detailByIndex[i]?.trim();
      const description = detailAnswer ? `${candidate.description}${DETAIL_SEPARATOR}${detailAnswer}` : candidate.description;
      const concreteness = candidate.resolution_state === "concrete" || detailAnswer ? "concrete" : "unresolved_placeholder";
      const defaultFidelity: ElementFidelity = decision === "keep" ? "closely_based_on" : "interpretive";
      // Fidelity refinement + reference collection moved to Screen 13
      // (2026-09-07) -- preserve whatever it already set there rather than
      // resetting it every time this screen's confirm() runs (which happens
      // on every Continue click, not just the first ever visit).
      const existing = state.project.visual_elements.find((e) => e.id === id);
      return {
        id,
        description,
        personal_meaning: candidate.personal_meaning,
        source_category: candidate.source_category,
        hierarchy: existing?.hierarchy ?? "undecided",
        fidelity: existing?.fidelity ?? defaultFidelity,
        colour_role: existing?.colour_role ?? "undecided",
        reference_required: existing?.reference_required ?? false,
        reference_status: existing?.reference_status ?? "not_needed",
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
    <div className="screen ledger-screen sites-tokens">
      <div className="ledger-header-row">
        <span className="ledger-step-label">07 / 13 &nbsp;·&nbsp; Finding the image</span>
      </div>
      <div className="ledger-progress-track">
        <div className="ledger-progress-fill" />
      </div>
      <h2 className="ledger-headline">Let us find what could represent it.</h2>
      <AsyncError onRetry={fetchAssociations} />
      {fetching && <ModelWaitIndicator label="Finding personal and visual directions..." />}
      {hasCandidates && <p className="supporting">Keep the ones that already feel right, build upon ones that are close, or ask for something else.</p>}
      {hasCandidates && (
        <div className="ledger-list">
          {visibleCandidateIndices.map((i, slot) => {
            const candidate = state.ui.associationCandidates[i]!;
            const decision = decisionByIndex[i];
            const hist = history[slot] ?? [defaultTopIndices[slot]!];
            const pos = historyPos[slot] ?? 0;
            const canPageBack = pos > 0;
            const canPageForward = pos < hist.length - 1;
            const rerolling = isRerollPending(slot);
            const whyOpen = rerollPromptOpenSlots.has(slot);
            const reserveExhausted = reserveCursor >= reservePool.length;
            return (
              <div key={slot} className={`ledger-candidate${decision ? " selected" : ""}`}>
                <div className="ledger-candidate-row">
                  <span className="ledger-candidate-body">
                    <strong>{candidate.description}</strong>
                    {" — "}
                    <span className="ledger-candidate-meaning">{candidate.personal_meaning}</span>
                  </span>
                  {hist.length > 1 && (
                    <span className="ledger-candidate-pager">
                      <button type="button" disabled={!canPageBack} onClick={() => pageSlot(slot, -1)} aria-label="Previous alternative for this slot">
                        {"<"}
                      </button>
                      {pos + 1}/{hist.length}
                      <button type="button" disabled={!canPageForward} onClick={() => pageSlot(slot, 1)} aria-label="Next alternative for this slot">
                        {">"}
                      </button>
                    </span>
                  )}
                </div>

                <div className="ledger-decision-row" role="group" aria-label="Decision">
                  <button
                    type="button"
                    className={`ledger-decision-pill ledger-decision-keep${decision === "keep" ? " active" : ""}`}
                    onClick={() => decide(i, "keep")}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    className={`ledger-decision-pill ledger-decision-build-upon${decision === "build_upon" ? " active" : ""}`}
                    onClick={() => decide(i, "build_upon")}
                  >
                    Build upon
                  </button>
                  <button type="button" className="ledger-decision-pill ledger-decision-not-this-one" onClick={() => notThisOne(slot)} disabled={rerolling}>
                    Not this one
                  </button>
                </div>

                {rerolling && <p className="supporting">Finding another idea for this slot...</p>}

                {whyOpen && (
                  <div className="ledger-marginalia">
                    <label className="reference-field">
                      <span>Why isn't this one right? (optional)</span>
                      <input
                        type="text"
                        className="ledger-lined-input"
                        value={whyDraft[slot] ?? ""}
                        onChange={(e) => setWhyDraft((prev) => ({ ...prev, [slot]: e.target.value }))}
                        placeholder={`e.g. "too literal for what I'm going for" or "not keen on circles"`}
                      />
                    </label>
                    {reserveExhausted && (
                      <p className="reference-note">No more free alternatives left for this slot — add a reason above to have the model find a new one.</p>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => submitReroll(slot)}>
                        Show me something else
                      </button>
                      <button type="button" className="secondary" onClick={() => cancelReroll(slot)}>
                        Never mind
                      </button>
                    </div>
                  </div>
                )}

                {decision && candidate.resolution_state === "needs_client_specific_detail" && (
                  <div className="ledger-marginalia">
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
        <button className="ledger-cta" onClick={confirm} disabled={continueDisabled}>
          Continue
        </button>
        {continueDisabled && (
          <p className="supporting">
            {hasCandidates
              ? "Keep or build upon at least one starting point above, or add a new idea that becomes a design element, to continue."
              : "Add at least one idea that becomes a design element to continue — notes for the artist alone aren't enough to move forward."}
          </p>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestProvenance } from "../api/provenance";
import { requestDiscovery } from "../api/discovery";
import { AsyncError } from "../components/AsyncError";
import { OptionChips } from "../components/OptionChips";
import { VoiceInputButton, type VoiceInputHandle } from "../components/VoiceInput";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import type { DiscoveryData } from "../api/types";
import type { ProvenanceResult } from "@positive-inking/engine";

function mergeUnique(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

/**
 * Screen 3B (§8, attraction/expert). Not clarification -- does not touch the
 * clarification budget (§9.4). The single optional re-entry offer (§8, §10)
 * lives entirely inside this screen rather than as a separate ScreenId, so
 * accepting it never adds a screen to the attraction/expert path (AC 11:
 * element capture must still be reachable within two screens).
 */
export function ImageProvenance() {
  const { state, patchProject, patchUI } = useJourney();
  const { run: runProvenance, pending: provenancePending } = useAsyncAction();
  const { run: runElaboration, pending: elaborationPending } = useAsyncAction();
  const [text, setText] = useState("");
  const [reentrySubject, setReentrySubject] = useState<string | null>(null);
  const [elaborating, setElaborating] = useState(false);
  const [elaborationText, setElaborationText] = useState("");
  const [themesToConfirm, setThemesToConfirm] = useState<string[] | null>(null);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryData | null>(null);
  const voiceRef = useRef<VoiceInputHandle>(null);
  const elaborationVoiceRef = useRef<VoiceInputHandle>(null);

  function alwaysLiked() {
    // §8: "I've just always liked it" is a complete answer. No model call, ends provenance questioning permanently -- nothing to re-enter.
    patchProject({
      attraction_origin: "Always liked it — no specific origin recalled.",
      origin_period: "unknown",
      origin_source: "unknown",
      significance_claimed: false,
      provenance_confidence: 1,
    });
    logTelemetryEvent("provenance_captured", state.project.project_id, { significance_claimed: false, reentry_surfaced: false, mode: "always_liked" });
    patchUI({ provenanceCaptured: true, reentryOffered: true });
  }

  function submit() {
    if (text.trim().length === 0) return;
    voiceRef.current?.stop();
    void runProvenance(async (guard) => {
      const result = await requestProvenance(text);
      if (guard.isStale()) return;
      patchProject({
        attraction_origin: result.attraction_origin,
        origin_period: result.origin_period as ProvenanceResult["origin_period"],
        origin_source: result.origin_source as ProvenanceResult["origin_source"],
        personal_people: result.personal_entities,
        significance_claimed: result.significance_claimed,
        provenance_confidence: result.provenance_confidence,
      });
      logTelemetryEvent("provenance_captured", state.project.project_id, {
        significance_claimed: result.significance_claimed,
        reentry_surfaced: result.reentry_candidate.surfaced,
        mode: "described",
      });

      // §8's single optional offer -- only when the model actually flagged evident
      // weight, and never shown again once this project has resolved it once.
      if (result.reentry_candidate.surfaced && !state.ui.reentryOffered) {
        setReentrySubject(result.reentry_candidate.subject);
      } else {
        patchUI({ provenanceCaptured: true });
      }
    }, "Recording where this comes from");
  }

  function declineReentry() {
    // Final -- never re-offered, and nothing about significance is inferred from the decline or from having surfaced at all.
    setReentrySubject(null);
    patchUI({ provenanceCaptured: true, reentryOffered: true });
  }

  function submitElaboration() {
    if (elaborationText.trim().length === 0) return;
    elaborationVoiceRef.current?.stop();
    void runElaboration(async (guard) => {
      const discovery = await requestDiscovery(elaborationText, state.project.user_viewpoint ?? undefined);
      if (guard.isStale()) return;
      patchUI({
        discoveryInterpretation: discovery.interpretation,
        discoveryThemeOptions: discovery.key_themes,
        discoveryCoreValueCandidates: discovery.candidate_core_values,
      });
      setThemesToConfirm(discovery.key_themes);
      setSelectedThemes(discovery.key_themes.slice(0, 3));
      setDiscoveryResult(discovery);
    }, "Making sense of what you added");
  }

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) => (prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]));
  }

  function finalizeElaboration() {
    if (!discoveryResult) return;
    const { project } = state;
    patchProject({
      confirmed_themes: selectedThemes,
      confirmed_core_values: discoveryResult.candidate_core_values.slice(0, 3),
      statement_of_intention: discoveryResult.interpretation || project.statement_of_intention,
      personal_people: mergeUnique(project.personal_people, discoveryResult.personal_people),
      personal_places: mergeUnique(project.personal_places, discoveryResult.personal_places),
      personal_objects: mergeUnique(project.personal_objects, discoveryResult.personal_objects),
      personal_events: mergeUnique(project.personal_events, discoveryResult.personal_events),
      personal_memories: mergeUnique(project.personal_memories, discoveryResult.personal_memories),
      personal_phrases: mergeUnique(project.personal_phrases, discoveryResult.personal_phrases),
      // The user's own act of elaborating and confirming what matters is the attached weight (§10) -- not model inference.
      significance_claimed: true,
    });
    patchUI({ provenanceCaptured: true, reentryOffered: true });
    setReentrySubject(null);
  }

  if (reentrySubject && !elaborating) {
    return (
      <div className="screen">
        <h2>You mentioned {reentrySubject}.</h2>
        <p className="supporting">Want to say more about that, or keep this focused on the image?</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setElaborating(true)}>Tell me more</button>
          <button className="secondary" onClick={declineReentry}>
            Keep it about the image
          </button>
        </div>
      </div>
    );
  }

  if (reentrySubject && elaborating && !themesToConfirm) {
    return (
      <div className="screen">
        <h2>Tell me more about {reentrySubject}</h2>
        <textarea value={elaborationText} onChange={(e) => setElaborationText(e.target.value)} />
        <VoiceInputButton ref={elaborationVoiceRef} value={elaborationText} onChange={setElaborationText} />
        <AsyncError onRetry={submitElaboration} />
        {elaborationPending && <p className="progress-note">Making sense of what you added...</p>}
        <button onClick={submitElaboration} disabled={elaborationText.trim().length === 0 || elaborationPending}>
          {elaborationPending ? "Working..." : "Continue"}
        </button>
      </div>
    );
  }

  if (reentrySubject && themesToConfirm) {
    return (
      <div className="screen">
        <h2>Here is what we heard</h2>
        <div className="reflection-box">{state.ui.discoveryInterpretation}</div>
        <h3 style={{ marginBottom: 4 }}>What feels most important?</h3>
        <OptionChips options={themesToConfirm.map((t) => ({ value: t, label: t }))} selected={selectedThemes} onSelect={toggleTheme} />
        <button onClick={finalizeElaboration} disabled={selectedThemes.length === 0}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>When did you first know you wanted this?</h2>
      <p className="supporting">
        Where have you seen it before — anywhere that stuck? Is there a version of it you keep coming back to? Is it
        connected to anyone?
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <VoiceInputButton ref={voiceRef} value={text} onChange={setText} />
      <AsyncError onRetry={submit} />
      {provenancePending && <p className="progress-note">Recording where this comes from...</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={submit} disabled={text.trim().length === 0 || provenancePending}>
          {provenancePending ? "Working..." : "Continue"}
        </button>
        <button className="secondary" onClick={alwaysLiked} disabled={provenancePending}>
          I've just always liked it
        </button>
        {state.project.journey_mode === "expert" && (
          <button className="secondary" onClick={alwaysLiked} disabled={provenancePending}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

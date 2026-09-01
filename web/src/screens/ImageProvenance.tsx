import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestProvenance } from "../api/provenance";
import { AsyncError } from "../components/AsyncError";
import type { ProvenanceResult } from "@positive-inking/engine";

/** Screen 3B (§8, attraction/expert). Not clarification -- does not touch the clarification budget (§9.4). */
export function ImageProvenance() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [text, setText] = useState("");

  function alwaysLiked() {
    // §8: "I've just always liked it" is a complete answer. No model call, ends provenance questioning permanently.
    patchProject({
      attraction_origin: "Always liked it — no specific origin recalled.",
      origin_period: "unknown",
      origin_source: "unknown",
      significance_claimed: false,
      provenance_confidence: 1,
    });
    patchUI({ provenanceCaptured: true });
  }

  async function submit() {
    if (text.trim().length === 0) return;
    beginAttempt();
    try {
      const result = await requestProvenance(text);
      patchProject({
        attraction_origin: result.attraction_origin,
        origin_period: result.origin_period as ProvenanceResult["origin_period"],
        origin_source: result.origin_source as ProvenanceResult["origin_source"],
        personal_people: result.personal_entities,
        significance_claimed: result.significance_claimed,
        provenance_confidence: result.provenance_confidence,
      });
      patchUI({ provenanceCaptured: true });
      setError(null);
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Recording where this comes from",
      });
    }
  }

  return (
    <div className="screen">
      <h2>When did you first know you wanted this?</h2>
      <p className="supporting">
        Where have you seen it before — anywhere that stuck? Is there a version of it you keep coming back to? Is it
        connected to anyone?
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <AsyncError onRetry={submit} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={submit} disabled={text.trim().length === 0}>
          Continue
        </button>
        <button className="secondary" onClick={alwaysLiked}>
          I've just always liked it
        </button>
        {state.project.journey_mode === "expert" && (
          <button className="secondary" onClick={alwaysLiked}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

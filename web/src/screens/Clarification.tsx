import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestDiscovery } from "../api/discovery";
import { AsyncError } from "../components/AsyncError";
import { OptionChips } from "../components/OptionChips";

/** Screen 4 (§8, conditional). Exactly one semantic clarification, ever (§9.4-9.6). */
export function Clarification() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [answer, setAnswer] = useState("");
  // Captured once at mount -- this screen shows at most once per journey (the
  // one-clarification rule), but a retry must not re-append the clarifying
  // detail onto a raw_story that already includes it from a prior attempt.
  const [originalStory] = useState(() => state.project.raw_story);

  async function submit(declined: boolean) {
    const responseText = declined ? "I'm not sure yet." : answer;
    if (!declined && responseText.trim().length === 0) return;

    // §16.1: persisted before the network call, so a failure never loses it.
    const combined = `${originalStory}\n\nClarifying detail (in response to: "${state.ui.clarificationQuestion}"): ${responseText}`;
    patchProject({ raw_story: combined });
    beginAttempt();

    try {
      // Re-run Discovery with the clarification folded in, per §9.4 "Re-run Discovery analysis afterward."
      const result = await requestDiscovery(combined, state.project.user_viewpoint ?? undefined);
      patchProject({
        selected_themes: result.key_themes,
        statement_of_intention: result.statement_of_intention,
        confidence: result.confidence,
        visual_confidence: result.visual_confidence,
        interpretation_confidence: result.confidence >= 0.4 ? "standard" : "low",
        personal_material_source: declined || result.confidence < 0.4 ? "user_corrected" : "model_extracted",
      });
      patchUI({
        clarificationShown: true,
        clarificationUsed: true,
        discoveryInterpretation: result.interpretation,
        discoveryThemeOptions: result.key_themes,
        discoveryCoreValueCandidates: result.candidate_core_values,
      });
      setError(null);
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Following up on your story",
      });
    }
  }

  return (
    <div className="screen">
      <h2>{state.ui.clarificationQuestion || "Can you say a little more?"}</h2>
      {state.ui.clarificationSuggestedAnswers.length > 0 && (
        <OptionChips
          options={state.ui.clarificationSuggestedAnswers.map((a) => ({ value: a, label: a }))}
          selected={answer ? [answer] : []}
          onSelect={(value) => setAnswer(value)}
        />
      )}
      <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Or describe it in your own words" />
      <AsyncError onRetry={() => submit(false)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => submit(false)} disabled={answer.trim().length === 0}>
          Continue
        </button>
        <button className="secondary" onClick={() => submit(true)}>
          I'm not sure yet
        </button>
      </div>
    </div>
  );
}

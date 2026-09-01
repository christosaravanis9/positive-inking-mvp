import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestDiscovery } from "../api/discovery";
import { AsyncError } from "../components/AsyncError";
import { OptionChips } from "../components/OptionChips";
import { classifyClarificationResponse, shouldEnterLowConfidencePath } from "@positive-inking/engine";

/** Screen 4 (§8, conditional). Exactly one semantic clarification, ever (§9.4-9.6). */
export function Clarification() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [answer, setAnswer] = useState("");
  // Captured once at mount -- this screen shows at most once per journey (the
  // one-clarification rule), but a retry must not re-append the clarifying
  // detail onto a raw_story that already includes it from a prior attempt.
  const [originalStory] = useState(() => state.project.raw_story);
  const [originalConfidence] = useState(() => state.project.confidence);

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

      // §9.2's Discovery schema has no field marking whether a free-text answer actually
      // addressed the asked dimension -- that would need real interpretation the model
      // isn't asked to provide here. As a stand-in: no improvement in confidence at all is
      // treated as "didn't address it" (off_topic); some improvement but still low is
      // "non_resolving". Both lead to the identical correction interaction either way
      // (shouldEnterLowConfidencePath is true for both) -- this only affects which case is
      // recorded, never what the user sees.
      const classification = classifyClarificationResponse({
        recomputedConfidence: result.confidence,
        userDeclined: declined,
        addressesAskedDimension: declined || result.confidence > originalConfidence,
      });
      const needsCorrection = shouldEnterLowConfidencePath(classification);

      patchProject({
        selected_themes: result.key_themes,
        statement_of_intention: result.statement_of_intention,
        confidence: result.confidence,
        visual_confidence: result.visual_confidence,
        interpretation_confidence: needsCorrection ? "low" : "standard",
        personal_material_source: needsCorrection ? "user_corrected" : "model_extracted",
        // §9.5: an off-topic or skipped response is classified, never re-asked -- but it also
        // never overwrites already-extracted personal material with nothing. Only merge in
        // fields the model actually returned something for.
        personal_people: result.personal_people.length > 0 ? result.personal_people : state.project.personal_people,
        personal_places: result.personal_places.length > 0 ? result.personal_places : state.project.personal_places,
        personal_objects: result.personal_objects.length > 0 ? result.personal_objects : state.project.personal_objects,
        personal_events: result.personal_events.length > 0 ? result.personal_events : state.project.personal_events,
        personal_memories: result.personal_memories.length > 0 ? result.personal_memories : state.project.personal_memories,
        personal_phrases: result.personal_phrases.length > 0 ? result.personal_phrases : state.project.personal_phrases,
      });
      patchUI({
        clarificationShown: true,
        clarificationUsed: true,
        lowConfidenceCorrectionNeeded: needsCorrection,
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

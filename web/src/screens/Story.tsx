import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { requestDiscovery } from "../api/discovery";
import { AsyncError } from "../components/AsyncError";
import { VoiceInputButton } from "../components/VoiceInput";
import type { Viewpoint } from "@positive-inking/engine";

/** Screen 3 (§8, full mode). Runs AI Action A (Discovery, §9) on submit. */
export function Story() {
  const { state, patchProject, patchUI, setError, beginAttempt } = useJourney();
  const [text, setText] = useState(state.project.raw_story);
  const [usedVoice, setUsedVoice] = useState(false);

  async function submit() {
    if (text.trim().length === 0) return;
    // §16.1: raw_story is written before any network request, so a failed or
    // hung call can never lose it (AC 55). Discovery-derived fields are
    // patched separately, only once the call actually succeeds.
    patchProject({ raw_story: text, story_transcript: text, input_method: usedVoice ? "voice" : "typed" });
    beginAttempt();
    try {
      const result = await requestDiscovery(text, state.project.user_viewpoint ?? undefined);
      patchProject({
        primary_viewpoint: result.primary_viewpoint,
        secondary_viewpoints: result.secondary_viewpoints as Viewpoint[],
        primary_intention: result.primary_intention,
        secondary_intentions: result.secondary_intentions,
        deep_why: result.deep_why,
        selected_themes: result.key_themes,
        personal_people: result.personal_people,
        personal_places: result.personal_places,
        personal_objects: result.personal_objects,
        personal_events: result.personal_events,
        personal_memories: result.personal_memories,
        personal_phrases: result.personal_phrases,
        statement_of_intention: result.statement_of_intention,
        confidence: result.confidence,
        visual_confidence: result.visual_confidence,
        interpretation_confidence: result.confidence >= 0.4 ? "standard" : "low",
      });
      patchUI({
        discoveryCompleted: true,
        themesSelected: false,
        intentionConfirmed: false,
        discoveryInterpretation: result.interpretation,
        discoveryThemeOptions: result.key_themes,
        discoveryCoreValueCandidates: result.candidate_core_values,
        clarificationQuestion: result.clarification_question ?? "",
        clarificationSuggestedAnswers: result.suggested_answers,
      });
      setError(null);
    } catch (err) {
      setError({
        code: (err as { code?: string }).code ?? "unknown_error",
        message: err instanceof Error ? err.message : "Unknown error",
        context: "Understanding your story",
      });
    }
  }

  return (
    <div className="screen">
      <h2>Tell us what you want this tattoo to be about.</h2>
      <p className="supporting">
        Talk naturally. You can mention a person, memory, belief, experience, ambition, change — or simply why you
        feel drawn to getting tattooed.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Who or what is involved? Why does it matter?" />
      <VoiceInputButton
        onTranscript={(t) => {
          setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
          setUsedVoice(true);
        }}
      />
      <AsyncError onRetry={submit} />
      <button onClick={submit} disabled={text.trim().length === 0}>
        Continue
      </button>
    </div>
  );
}

import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestDiscovery } from "../api/discovery";
import { AsyncError } from "../components/AsyncError";
import { VoiceInputButton } from "../components/VoiceInput";
import { OptionChips } from "../components/OptionChips";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import type { DiscoveryData } from "../api/types";
import type { Viewpoint } from "@positive-inking/engine";

/**
 * The meaning-depth gate, proposed and approved separately from the rest of Screen 3
 * (§8, full mode). Detected as part of the SAME Discovery call (`meaning_is_thin`/
 * `depth_prompt`/`depth_prompt_suggestions` on `DiscoveryData`) -- no second model call,
 * per the approved proposal's cost/latency preference. Deliberately independent of the
 * existing Clarification screen's own confidence gate: that one only fires when visual
 * confidence is ALSO low (a thin-but-visually-actionable story like "I want a rose,
 * roses are pretty" sets meaning_is_thin true without clarification_required, and the
 * two never both fire for the same submission -- see discovery.ts's prompt item 8).
 *
 * Implemented entirely as local state on THIS screen, never a new ScreenId: when the
 * result comes back thin, project/ui state isn't patched yet -- the fetched result is
 * held in `pendingResult` and an inline, optional prompt renders in its place. "Continue"
 * (skip) applies that already-fetched result exactly as if it hadn't been thin, at zero
 * extra cost -- it is never disabled, per the approved "never a hard gate" requirement.
 * Answering instead folds the reply into raw_story and re-runs Discovery once (the same
 * append-and-rerun pattern Clarification.tsx already uses), then applies whichever result
 * comes back -- max one round, matching Clarification's own "maximum one" discipline, so
 * a still-thin second answer is accepted rather than looping. This keeps MeaningReflection
 * completely untouched: it only ever renders a single, final, settled Discovery result.
 */
export function Story() {
  const { state, patchProject, patchUI } = useJourney();
  const { run, pending } = useAsyncAction();
  const [text, setText] = useState(state.project.raw_story);
  const [usedVoice, setUsedVoice] = useState(false);
  const [pendingResult, setPendingResult] = useState<DiscoveryData | null>(null);
  const [depthAnswer, setDepthAnswer] = useState("");

  function applyDiscoveryResult(result: DiscoveryData) {
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
  }

  function submit() {
    if (text.trim().length === 0) return;
    void run(async (guard) => {
      // §16.1: raw_story is written before any network request, so a failed or
      // hung call can never lose it (AC 55). Discovery-derived fields are
      // patched separately, only once the call actually succeeds AND this
      // call is still the current one -- a superseded or post-navigation
      // response must never mutate state (user-decision invariant).
      patchProject({ raw_story: text, story_transcript: text, input_method: usedVoice ? "voice" : "typed" });
      const result = await requestDiscovery(text, state.project.user_viewpoint ?? undefined);
      if (guard.isStale()) return;
      if (result.meaning_is_thin && result.depth_prompt) {
        setPendingResult(result);
        logTelemetryEvent("depth_exercise_shown", state.project.project_id, {});
        return;
      }
      applyDiscoveryResult(result);
    }, "Understanding your story");
  }

  function skipDepthExercise() {
    if (!pendingResult) return;
    applyDiscoveryResult(pendingResult);
    setPendingResult(null);
  }

  function answerDepthExercise() {
    if (!pendingResult || depthAnswer.trim().length === 0) return;
    void run(async (guard) => {
      const combined = `${text}\n\nWhat it's really about (in response to: "${pendingResult.depth_prompt}"): ${depthAnswer}`;
      patchProject({ raw_story: combined, story_transcript: combined });
      logTelemetryEvent("depth_exercise_used", state.project.project_id, {});

      const result = await requestDiscovery(combined, state.project.user_viewpoint ?? undefined);
      if (guard.isStale()) return;
      // Max one round: whatever comes back now is applied directly, even if
      // still thin -- mirrors Clarification's own "maximum one" discipline.
      applyDiscoveryResult(result);
      setPendingResult(null);
    }, "Following up on your story");
  }

  const trimmedLength = text.trim().length;

  if (pendingResult) {
    return (
      <div className="screen">
        <p className="screen-eyebrow">One thing worth a moment</p>
        <h2 className="screen-heading">{pendingResult.depth_prompt}</h2>
        <p className="supporting">Answer if something comes to mind, or continue -- either is fine.</p>
        {pendingResult.depth_prompt_suggestions.length > 0 && (
          <OptionChips
            options={pendingResult.depth_prompt_suggestions.map((s) => ({ value: s, label: s }))}
            selected={depthAnswer ? [depthAnswer] : []}
            onSelect={(value) => setDepthAnswer(value)}
          />
        )}
        <input
          type="text"
          value={depthAnswer}
          onChange={(e) => setDepthAnswer(e.target.value)}
          placeholder="Or say it in your own words"
        />
        <AsyncError onRetry={answerDepthExercise} />
        {pending && <p className="progress-note">Following up on your story...</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={answerDepthExercise} disabled={depthAnswer.trim().length === 0 || pending}>
            Share it
          </button>
          <button className="secondary" onClick={skipDepthExercise} disabled={pending}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Tell it naturally</p>
      <h2 className="screen-heading">What do you want this tattoo to be about?</h2>
      <p className="supporting">
        Mention who or what is involved, why it matters, and what you want to remember, express or become. Do not
        worry about imagery yet.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Start wherever the story begins…" />
      <p className="supporting">
        {trimmedLength < 20 ? "A few honest sentences are enough." : "That gives us enough to interpret the meaning."}
      </p>
      <VoiceInputButton
        onTranscript={(t) => {
          setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
          setUsedVoice(true);
        }}
      />
      <AsyncError onRetry={submit} />
      {pending && <p className="progress-note">Understanding your story...</p>}
      <button onClick={submit} disabled={text.trim().length === 0 || pending}>
        {pending ? "Finding the meaning…" : "Continue"}
      </button>
    </div>
  );
}

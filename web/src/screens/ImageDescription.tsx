import { useRef, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { VoiceInputButton, type VoiceInputHandle } from "../components/VoiceInput";

/**
 * Screen 3A (§8, attraction/expert). No interpretation, no themes, no Why --
 * this text is used as raw material for element extraction at Screen 7
 * (shared with all modes), not run through Discovery.
 */
export function ImageDescription() {
  const { state, patchProject, patchUI } = useJourney();
  const [text, setText] = useState(state.project.raw_story);
  const [usedVoice, setUsedVoice] = useState(false);
  const voiceRef = useRef<VoiceInputHandle>(null);

  return (
    <div className="screen">
      <h2>What do you want it to be?</h2>
      <p className="supporting">What it looks like, anything you've seen that's close, anything you definitely don't want.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <VoiceInputButton
        ref={voiceRef}
        value={text}
        onChange={(t) => {
          setText(t);
          setUsedVoice(true);
        }}
      />
      <button
        onClick={() => {
          voiceRef.current?.stop();
          patchProject({ raw_story: text, story_transcript: text, input_method: usedVoice ? "voice" : "typed" });
          patchUI({ imageDescribed: true });
        }}
        disabled={text.trim().length === 0}
      >
        Continue
      </button>
    </div>
  );
}

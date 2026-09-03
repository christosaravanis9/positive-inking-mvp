import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Voice input, rebuilt to match a known-good reference implementation using the browser's
 * built-in Web Speech API directly -- no server round-trip, no third-party transcription
 * service, no audio recording pipeline. Where the browser doesn't support it, this still
 * renders (a disabled button + an explanation), never a silent no-op that looks identical
 * to "voice input did nothing" -- the OS keyboard's own microphone/dictation key remains
 * the baseline fallback in either case, since every field this wires into is a plain
 * <textarea>/<input>.
 *
 * This is a controlled component: the caller owns the text field's value and passes it in,
 * this component only ever calls onChange with a newly-composed full value -- it never
 * appends internally. On every recognition result it rebuilds the value from three layers:
 * - startingText: whatever was already in the field, captured once when a session starts.
 * - completedText: this session's own running final-result text.
 * - interimText: this session's in-progress (not yet final) text, rebuilt every event.
 * The composed value is always [startingText, completedText, interimText].filter(Boolean)
 * .join(" "), pushed to onChange immediately on every event -- no debounce, so the field
 * updates live while the person is still talking, not only once they stop.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  return ctor ?? null;
}

/**
 * idle|starting|listening|stopping, not a boolean -- the reference implementation this is
 * modelled on only flips its own "isListening" flag true inside onstart, which is
 * asynchronous: a second tap before onstart fires reads the old (still-false) flag and can
 * start a second concurrent recognition instance. That bug is deliberately NOT ported here.
 * guardRef mirrors this state but is checked SYNCHRONOUSLY inside the click handler, before
 * React has committed any state update, so a rapid second tap during "starting" is a no-op.
 */
type VoiceStatus = "idle" | "starting" | "listening" | "stopping";

const UNSUPPORTED_MESSAGE = "Live dictation is not supported by this browser. You can still type your story below.";
const MIC_DENIED_MESSAGE = "Microphone access was denied. You can still type your story below.";
const NO_SPEECH_MESSAGE = "No speech detected — tap to try again.";
const ABORTED_MESSAGE = "Dictation stopped.";
const UNEXPECTED_MESSAGE = "Dictation paused unexpectedly. Your existing transcript has been preserved.";
const MIC_START_FAILED_MESSAGE = "Microphone could not start. You can still type your story below.";
const STOPPED_MESSAGE = "Dictation stopped. You can edit the transcript before continuing.";

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": MIC_DENIED_MESSAGE,
  "service-not-allowed": MIC_DENIED_MESSAGE,
  "no-speech": NO_SPEECH_MESSAGE,
  aborted: ABORTED_MESSAGE,
};

export interface VoiceInputHandle {
  /** A normal stop -- lets any in-flight final result finish returning first. Safe to call whether or not a session is active. */
  stop: () => void;
}

export const VoiceInputButton = forwardRef<VoiceInputHandle, { value: string; onChange: (text: string) => void; disabled?: boolean }>(
  function VoiceInputButton({ value, onChange, disabled }, ref) {
    const [supported] = useState(() => getSpeechRecognitionConstructor() !== null);
    const [status, setStatus] = useState<VoiceStatus>("idle");
    const [message, setMessage] = useState<string | null>(supported ? null : UNSUPPORTED_MESSAGE);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const guardRef = useRef<VoiceStatus>("idle");

    function stop() {
      // A normal user-initiated (or pre-submit) stop: recognition.stop() lets any final
      // result that's already in flight finish returning before onend fires. Safe as a
      // no-op when nothing is listening -- callers (e.g. "stop before submitting") don't
      // need to know whether a session is actually active.
      if (guardRef.current !== "listening") return;
      guardRef.current = "stopping";
      setStatus("stopping");
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped/torn down -- nothing to do.
      }
    }

    useImperativeHandle(ref, () => ({ stop }), []);

    useEffect(() => {
      return () => {
        // Unmount is not a normal stop -- abort() tears down immediately rather than
        // waiting for a graceful stop/final-result round trip the component will never
        // render the result of anyway.
        try {
          recognitionRef.current?.abort();
        } catch {
          // Already gone -- nothing to do.
        }
        recognitionRef.current = null;
      };
    }, []);

    function start() {
      // Synchronous re-entrancy guard -- see the VoiceStatus doc comment above for exactly
      // which race this closes that the reference implementation leaves open.
      if (guardRef.current !== "idle") return;
      if (!supported) return;

      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) return; // supported was captured at mount; this is defensive only.

      guardRef.current = "starting";
      setStatus("starting");
      setMessage(null);

      let recognition: SpeechRecognitionLike;
      try {
        // A new instance every session, never reused -- the reference's own convention,
        // and it sidesteps a class of "recognition object left in a weird state from last
        // time" bug entirely.
        recognition = new Ctor();
      } catch {
        guardRef.current = "idle";
        setStatus("idle");
        setMessage(MIC_START_FAILED_MESSAGE);
        return;
      }

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-GB";

      const startingText = value.trim();
      let completedText = "";
      let errorShown = false;

      recognition.onstart = () => {
        guardRef.current = "listening";
        setStatus("listening");
      };

      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]!;
          const transcript = result[0].transcript;
          if (result.isFinal) {
            completedText += `${transcript} `;
          } else {
            interimText += transcript;
          }
        }
        onChange([startingText, completedText.trim(), interimText.trim()].filter(Boolean).join(" "));
      };

      recognition.onerror = (event) => {
        errorShown = true;
        setMessage(ERROR_MESSAGES[event.error] ?? UNEXPECTED_MESSAGE);
      };

      recognition.onend = () => {
        // No app-level timers of any kind drive this -- only the browser's own onend, per
        // the reference. No auto-restart, either: the person taps again to resume, and
        // startingText's own capture-at-session-start already preserves whatever's there.
        recognitionRef.current = null;
        guardRef.current = "idle";
        setStatus("idle");
        if (!errorShown) setMessage(STOPPED_MESSAGE);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch {
        // Exactly the synchronous-throw failure mode a prior version of this component was
        // written to catch (observed on Safari when dictation/speech services aren't
        // available) -- start() threw before onstart/onerror/onend can ever fire on their
        // own, so without this catch the button would be stuck on "Starting…" forever.
        recognitionRef.current = null;
        guardRef.current = "idle";
        setStatus("idle");
        setMessage(MIC_START_FAILED_MESSAGE);
      }
    }

    function toggle() {
      if (status === "listening") stop();
      else start();
    }

    const label = status === "listening" ? "Stop listening" : status === "starting" ? "Starting…" : status === "stopping" ? "Stopping…" : "Talk about it";

    return (
      <div className="voice-input">
        <button type="button" className="secondary" onClick={toggle} disabled={disabled || !supported} aria-pressed={status === "listening"}>
          {label}
        </button>
        {message && <p className="supporting">{message}</p>}
      </div>
    );
  },
);

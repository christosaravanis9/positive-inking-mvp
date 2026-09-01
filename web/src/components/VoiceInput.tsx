import { useEffect, useRef, useState } from "react";

/**
 * Voice input (V3, minimal). The OS keyboard's own microphone/dictation key
 * is always the baseline -- every text field in this app is a plain
 * <textarea>/<input>, so that already works everywhere with zero code here.
 * This component only adds the explicit "Talk about it" affordance V3 asks
 * for, using the browser's built-in SpeechRecognition API directly -- no
 * server round-trip, no third-party transcription service, no audio
 * recording pipeline. Where the browser doesn't support it (Firefox, most
 * of iOS Safari), this renders nothing at all and the OS keyboard mic
 * remains the only voice path, silently -- never a broken or dead button.
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
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  return ctor ?? null;
}

type VoiceState = "idle" | "listening" | "denied" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was denied. You can still type, or use your keyboard's own dictation key.",
  "service-not-allowed": "Microphone access was denied. You can still type, or use your keyboard's own dictation key.",
  "no-speech": "Didn't catch that — try again, or just type.",
  network: "Voice input isn't working right now — you can still type.",
};

/**
 * Safari (desktop and iOS) has been observed to throw a synchronous
 * DOMException from recognition.start() itself -- not the async onerror
 * event -- when dictation/speech services aren't available on the device
 * (e.g. Dictation disabled in System Settings) or a prior instance hasn't
 * fully torn down yet. Left unguarded, that throw happens after this
 * component has already optimistically set state to "listening", leaving
 * the button stuck showing "Listening" forever with no error shown -- a
 * silent, permanently-broken control that looks identical to "voice input
 * did nothing." The try/catch below, plus the stuck-state safety timeout,
 * exist specifically to turn that into a visible, recoverable error state.
 */
const NO_RESPONSE_TIMEOUT_MS = 8000;

export function VoiceInputButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [supported] = useState(() => getSpeechRecognitionConstructor() !== null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    };
  }, []);

  if (!supported) return null;

  function fail(msg: string, state: VoiceState = "error") {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
    recognitionRef.current = null;
    setVoiceState(state);
    setMessage(msg);
  }

  function start() {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    setMessage(null);

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      fail("Voice input isn't available right now — you can still type.");
      return;
    }

    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results as ArrayLike<SpeechRecognitionResultLike>)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      fail(
        ERROR_MESSAGES[event.error] ?? "Voice input isn't working right now — you can still type.",
        event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "error",
      );
    };
    recognition.onend = () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
      setVoiceState((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    setVoiceState("listening");

    try {
      recognition.start();
    } catch {
      // Exactly the Safari failure mode this component exists to catch: start()
      // threw synchronously, so onerror/onend will never fire on their own.
      fail("Voice input isn't responding right now — you can still type.");
      return;
    }

    // Defense in depth against any other silent-hang mode (a start() that
    // neither throws nor ever calls back): surface an error rather than
    // leaving the button stuck on "Listening" indefinitely.
    stuckTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
      fail("Voice input isn't responding — you can still type.");
    }, NO_RESPONSE_TIMEOUT_MS);
  }

  function stop() {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped/torn down -- nothing to do.
    }
    setVoiceState("idle");
  }

  return (
    <div className="voice-input">
      <button
        type="button"
        className="secondary"
        onClick={voiceState === "listening" ? stop : start}
        disabled={disabled}
        aria-pressed={voiceState === "listening"}
      >
        {voiceState === "listening" ? "● Listening — tap to stop" : "🎤 Talk about it"}
      </button>
      {message && <p className="supporting">{message}</p>}
    </div>
  );
}

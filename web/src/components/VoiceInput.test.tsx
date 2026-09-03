import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceInputButton, type VoiceInputHandle } from "./VoiceInput";

/**
 * Voice input rebuild, matched to a known-good reference implementation (browser-native Web
 * Speech API only). These tests exercise the exact failure modes the rewrite targets:
 * cutoff after ~10s (an app-level timer -- there must be none left), transcription only
 * appearing after stopping (interim results must update the field live, on every event, no
 * debounce), and "sometimes doesn't activate at all" (the reference's own activation race --
 * isListening only true after the async onstart -- is NOT ported; a synchronous guard closes
 * it instead).
 */

interface FakeResultEvent {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  static throwOnStart = false;

  continuous = false;
  interimResults = false;
  lang = "";
  onstart: (() => void) | null = null;
  onresult: ((event: FakeResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.startCalls++;
    if (FakeSpeechRecognition.throwOnStart) throw new Error("synchronous start failure");
  }

  stop() {
    this.stopCalls++;
  }

  abort() {
    this.abortCalls++;
  }
}

function latestInstance(): FakeSpeechRecognition {
  const instance = FakeSpeechRecognition.instances.at(-1);
  if (!instance) throw new Error("no FakeSpeechRecognition instance was constructed");
  return instance;
}

beforeEach(() => {
  FakeSpeechRecognition.instances = [];
  FakeSpeechRecognition.throwOnStart = false;
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

function renderButton(value: string, onChange: (t: string) => void) {
  const ref = createRef<VoiceInputHandle>();
  const utils = render(<VoiceInputButton ref={ref} value={value} onChange={onChange} />);
  return { ...utils, ref };
}

describe("VoiceInputButton -- configuration", () => {
  it("sets exactly continuous=true, interimResults=true, lang='en-GB', nothing else assumed", () => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));

    const recognition = latestInstance();
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe("en-GB");
  });

  it("creates a brand new instance every session -- never reuses one across start/stop cycles", () => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button")); // start
    act(() => latestInstance().onstart?.());
    fireEvent.click(screen.getByRole("button")); // stop
    act(() => latestInstance().onend?.());
    fireEvent.click(screen.getByRole("button")); // start again

    expect(FakeSpeechRecognition.instances).toHaveLength(2);
    expect(FakeSpeechRecognition.instances[0]).not.toBe(FakeSpeechRecognition.instances[1]);
  });
});

describe("VoiceInputButton -- live interim text (fixes 'only appears after stopping')", () => {
  it("updates the field immediately on an interim (non-final) result, not just on final results", () => {
    const onChange = vi.fn();
    renderButton("", onChange);
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() =>
      latestInstance().onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "hello wor" } }],
      }),
    );

    expect(onChange).toHaveBeenCalledWith("hello wor");
  });

  it("composes startingText (captured once) + completedText (accumulated finals) + interimText (rebuilt each event)", () => {
    const onChange = vi.fn();
    renderButton("Already typed.", onChange);
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() =>
      latestInstance().onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "First sentence." } }],
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith("Already typed. First sentence.");

    act(() =>
      latestInstance().onresult?.({
        resultIndex: 1,
        results: [{ isFinal: true, 0: { transcript: "First sentence." } }, { isFinal: false, 0: { transcript: "and now speaking" } }],
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith("Already typed. First sentence. and now speaking");
  });

  it("startingText is captured ONCE at session start -- later onChange calls (which change the parent's value) don't get re-captured mid-session", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VoiceInputButton value="Original." onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() => latestInstance().onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Part one." } }] }));
    expect(onChange).toHaveBeenLastCalledWith("Original. Part one.");

    // Parent re-renders with the new value (as it would after the onChange above committed).
    rerender(<VoiceInputButton value="Original. Part one." onChange={onChange} />);

    // resultIndex=1 with a 2-entry results array matches the real API's contract: entries
    // below resultIndex were already reported in a previous event and must not be re-summed.
    act(() =>
      latestInstance().onresult?.({
        resultIndex: 1,
        results: [{ isFinal: true, 0: { transcript: "Part one." } }, { isFinal: true, 0: { transcript: "Part two." } }],
      }),
    );
    // startingText is still "Original." (captured at session start), and completedText
    // accumulates within THIS session only -- never "Original. Part one. Part one. Part two."
    expect(onChange).toHaveBeenLastCalledWith("Original. Part one. Part two.");
  });
});

describe("VoiceInputButton -- no app-level timers (fixes ~10s cutoff)", () => {
  it("stays listening with no forced stop() call after any elapsed time -- only onend (the browser) changes status", () => {
    const onChange = vi.fn();
    renderButton("", onChange);
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(30000));
    vi.useRealTimers();

    expect(latestInstance().stopCalls).toBe(0);
    expect(screen.getByRole("button").textContent).toBe("Stop listening");
  });
});

describe("VoiceInputButton -- tap-to-toggle, stop vs abort", () => {
  it("a normal stop tap calls recognition.stop(), never abort()", () => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    fireEvent.click(screen.getByRole("button"));
    expect(latestInstance().stopCalls).toBe(1);
    expect(latestInstance().abortCalls).toBe(0);
  });

  it("unmounting calls abort(), not stop()", () => {
    const { unmount } = renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    unmount();
    expect(latestInstance().abortCalls).toBe(1);
    expect(latestInstance().stopCalls).toBe(0);
  });

  it("aria-pressed reflects listening state", () => {
    renderButton("", vi.fn());
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    act(() => latestInstance().onstart?.());
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("VoiceInputButton -- activation race guard (fixes 'sometimes doesn't activate at all')", () => {
  it("a second tap before onstart fires does not start a second recognition instance", () => {
    renderButton("", vi.fn());
    const button = screen.getByRole("button");

    fireEvent.click(button); // starts
    fireEvent.click(button); // rapid second tap, onstart hasn't fired yet
    fireEvent.click(button); // and a third

    expect(FakeSpeechRecognition.instances).toHaveLength(1);
    expect(latestInstance().startCalls).toBe(1);
  });

  it("once listening, a tap correctly toggles to stop rather than being swallowed by the guard", () => {
    renderButton("", vi.fn());
    const button = screen.getByRole("button");
    fireEvent.click(button);
    act(() => latestInstance().onstart?.());

    fireEvent.click(button);
    expect(latestInstance().stopCalls).toBe(1);
  });
});

describe("VoiceInputButton -- onend (browser auto-stop): no auto-restart", () => {
  it("onend resets to idle, preserves existing text (no onChange call), and shows the stopped message", () => {
    const onChange = vi.fn();
    renderButton("Some text so far.", onChange);
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());
    onChange.mockClear();

    act(() => latestInstance().onend?.());

    expect(onChange).not.toHaveBeenCalled(); // text is preserved, not touched
    expect(screen.getByRole("button").textContent).toBe("Talk about it");
    screen.getByText("Dictation stopped. You can edit the transcript before continuing.");
  });

  it("never calls start() again on its own after onend -- the person must tap", () => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());
    act(() => latestInstance().onend?.());

    expect(FakeSpeechRecognition.instances).toHaveLength(1); // no second instance auto-created
  });
});

describe("VoiceInputButton -- error mapping", () => {
  it.each([
    ["not-allowed", "Microphone access was denied. You can still type your story below."],
    ["service-not-allowed", "Microphone access was denied. You can still type your story below."],
    ["no-speech", "No speech detected — tap to try again."],
    ["aborted", "Dictation stopped."],
    ["some-unknown-error", "Dictation paused unexpectedly. Your existing transcript has been preserved."],
  ])("maps error '%s' to the expected message", (error, expectedMessage) => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() => latestInstance().onerror?.({ error }));
    screen.getByText(expectedMessage);
  });

  it("onend after an error does not overwrite the error message with the generic 'stopped' message", () => {
    renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() => latestInstance().onerror?.({ error: "no-speech" }));
    act(() => latestInstance().onend?.());

    screen.getByText("No speech detected — tap to try again.");
    expect(screen.queryByText("Dictation stopped. You can edit the transcript before continuing.")).toBeNull();
  });

  it("start() throwing synchronously shows the mic-start-failed message and returns to a clickable idle state", () => {
    FakeSpeechRecognition.throwOnStart = true;
    renderButton("", vi.fn());
    const button = screen.getByRole("button") as HTMLButtonElement;

    fireEvent.click(button);
    screen.getByText("Microphone could not start. You can still type your story below.");
    expect(button.textContent).toBe("Talk about it");
    expect(button.disabled).toBe(false);
  });
});

describe("VoiceInputButton -- unsupported browser", () => {
  it("renders a disabled button with an explanatory message instead of nothing", () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    renderButton("", vi.fn());

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    screen.getByText("Live dictation is not supported by this browser. You can still type your story below.");
  });
});

describe("VoiceInputButton -- imperative stop() handle (for 'stop before submitting')", () => {
  it("calling the ref's stop() while listening calls recognition.stop()", () => {
    const { ref } = renderButton("", vi.fn());
    fireEvent.click(screen.getByRole("button"));
    act(() => latestInstance().onstart?.());

    act(() => ref.current?.stop());
    expect(latestInstance().stopCalls).toBe(1);
  });

  it("calling the ref's stop() while idle is a safe no-op", () => {
    const { ref } = renderButton("", vi.fn());
    expect(() => ref.current?.stop()).not.toThrow();
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });
});

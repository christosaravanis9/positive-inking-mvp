import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import type { DiscoveryData } from "../api/types";
import { Story } from "./Story";
import { UnderstandingPanel } from "../components/UnderstandingPanel";

/**
 * Meaning-depth gate (approved proposal): Story.tsx holds a thin Discovery result in local
 * state instead of applying it immediately, rendering the depth prompt inline. "Continue"
 * (skip) must always be available and apply the already-fetched result at zero extra cost;
 * answering re-runs Discovery once (max one round) with the reply folded into raw_story.
 * Deliberately implemented as local component state, not a new ScreenId -- these tests
 * render Story directly and assert on what it renders, not on journey-wide navigation.
 */

vi.mock("../api/discovery", () => ({ requestDiscovery: vi.fn() }));
const { requestDiscovery } = await import("../api/discovery");

function seedStoryState() {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true };
  savePersistedState(state);
  return state;
}

function notThinResult(overrides: Partial<DiscoveryData> = {}): DiscoveryData {
  return {
    primary_viewpoint: "past",
    secondary_viewpoints: [],
    primary_intention: "memorial",
    secondary_intentions: [],
    deep_why: "test",
    key_themes: ["family"],
    candidate_core_values: ["connection"],
    personal_people: [],
    personal_places: [],
    personal_objects: [],
    personal_events: [],
    personal_memories: [],
    personal_phrases: [],
    open_threads: [],
    interpretation: "An interpretation.",
    statement_of_intention: "A statement.",
    clarification_required: false,
    clarification_reason: null,
    clarification_question: null,
    suggested_answers: [],
    confidence: 0.8,
    visual_confidence: 0.8,
    meaning_is_thin: false,
    depth_prompt: null,
    depth_prompt_suggestions: [],
    ...overrides,
  };
}

function thinResult(overrides: Partial<DiscoveryData> = {}): DiscoveryData {
  return notThinResult({
    meaning_is_thin: true,
    depth_prompt: "Is there one moment this is really about?",
    depth_prompt_suggestions: ["a person", "a place", "a change"],
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(requestDiscovery).mockReset();
});

describe("Story -- meaning-depth gate", () => {
  it("applies the result directly and never shows the depth prompt when the story is not thin", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(notThinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "marking the point I stopped drinking" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(requestDiscovery).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Is there one moment this is really about?")).toBeNull();
  });

  it("holds the result and shows the depth prompt inline when the story is thin, without touching global state yet", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(thinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "I want a rose, roses are pretty" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => screen.getByText("Is there one moment this is really about?"));
    // The suggestion chips render as tappable options.
    screen.getByText("a person");
    screen.getByText("a place");
  });

  it("'Continue' inside the depth prompt is never disabled and applies the already-fetched result with no further network call", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(thinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "I want a rose, roses are pretty" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => screen.getByText("Is there one moment this is really about?"));

    const skipButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(skipButton.disabled).toBe(false); // never a hard gate, even with no answer typed
    fireEvent.click(skipButton);

    await waitFor(() => expect(screen.queryByText("Is there one moment this is really about?")).toBeNull());
    expect(requestDiscovery).toHaveBeenCalledTimes(1); // skip never re-runs Discovery
  });

  it("answering folds the reply into raw_story, re-runs Discovery once, and applies whatever comes back even if still thin (max one round)", async () => {
    vi.mocked(requestDiscovery)
      .mockResolvedValueOnce(thinResult())
      .mockResolvedValueOnce(thinResult({ interpretation: "Second-round interpretation." })); // still thin -- must not loop
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "I want a rose, roses are pretty" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => screen.getByText("Is there one moment this is really about?"));

    fireEvent.change(screen.getByPlaceholderText("Or say it in your own words"), { target: { value: "It's about my grandmother's garden." } });
    fireEvent.click(screen.getByRole("button", { name: "Share it" }));

    await waitFor(() => expect(requestDiscovery).toHaveBeenCalledTimes(2));
    // Second call's combined story includes both the original text and the depth-prompt reply.
    const secondCallArgs = vi.mocked(requestDiscovery).mock.calls[1];
    expect(secondCallArgs[0]).toContain("I want a rose, roses are pretty");
    expect(secondCallArgs[0]).toContain("It's about my grandmother's garden.");
    // Result applied directly -- no second depth prompt shown, even though still thin.
    await waitFor(() => expect(screen.queryByText("Is there one moment this is really about?")).toBeNull());
  });

  it("tapping a suggestion chip fills the answer field, editable afterward", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(thinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "I want a rose, roses are pretty" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => screen.getByText("Is there one moment this is really about?"));

    fireEvent.click(screen.getByText("a person"));
    expect((screen.getByPlaceholderText("Or say it in your own words") as HTMLInputElement).value).toBe("a person");
  });

  /**
   * Live-test regression: after a "Share it" round, the "What we've understood" panel's
   * Story field showed the raw internal re-prompt/composition text ("...What it's really
   * about (in response to: "Is there one moment...") used only to feed the re-run Discovery
   * call, not a clean summary of what the person actually said. Root cause: raw_story itself
   * was being set to that scaffolded text (Story.tsx's answerDepthExercise patched raw_story
   * with the same string sent to requestDiscovery). Same category of bug as the raw-enum
   * leaks fixed earlier -- internal composition text must never double as client-facing
   * display text. Rendered alongside UnderstandingPanel, exactly as Journey.tsx composes them
   * for real, so this asserts on what a viewer would actually see.
   */
  it("the understood panel's Story field shows clean natural text after a depth-exercise 'Share it' round, never the internal re-prompt scaffold", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(thinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
        <UnderstandingPanel variant="rail" />
      </JourneyProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "I want a rose, roses are pretty" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => screen.getByText("Is there one moment this is really about?"));

    fireEvent.change(screen.getByPlaceholderText("Or say it in your own words"), { target: { value: "It reminds me of my grandmother's garden." } });
    fireEvent.click(screen.getByRole("button", { name: "Share it" }));
    await waitFor(() => expect(requestDiscovery).toHaveBeenCalledTimes(2));

    const storyValue = screen.getByText("Story").nextElementSibling!.textContent!;
    expect(storyValue).toContain("I want a rose, roses are pretty");
    expect(storyValue).toContain("It reminds me of my grandmother's garden.");
    // The exact internal scaffold text must never reach the panel.
    expect(storyValue).not.toContain("What it's really about");
    expect(storyValue).not.toContain('in response to: "Is there one moment this is really about?"');
  });
});

describe("Story -- sensitive-information notice (privacy notice's 'Sensitive information' section)", () => {
  it("renders the notice near the story input, visible before submission", () => {
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    screen.getByText(
      "Your story may include sensitive information such as health, recovery, religion, or sexuality. Including this is entirely optional.",
    );
  });

  it("never blocks Continue -- disclosure only, no consent-gating", async () => {
    vi.mocked(requestDiscovery).mockResolvedValue(notThinResult());
    seedStoryState();
    render(
      <JourneyProvider>
        <Story />
      </JourneyProvider>,
    );

    // The notice is present and Continue is enabled purely based on the existing
    // non-empty-text rule -- the notice itself has no checkbox and adds no gate.
    screen.getByText(/Your story may include sensitive information/);
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true); // still empty text -- unrelated to the notice

    fireEvent.change(screen.getByPlaceholderText("Start wherever the story begins…"), { target: { value: "A short story." } });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(requestDiscovery).toHaveBeenCalledTimes(1));
  });
});

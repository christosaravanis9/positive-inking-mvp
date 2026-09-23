import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { VisualStylePreference } from "./VisualStylePreference";

/**
 * The pre-qualifying visual-style question (2026-09) -- asked once, before
 * Association is ever called. Locks in: all 6 options render with their
 * client-facing labels, each toggles into/out of a `selected` set, "Not
 * sure" is mutually exclusive with the 5 real lanes, and Continue stores the
 * final array ("Not sure" stored as `["not_sure"]`, a real answer, not left
 * empty/skipped) -- ASSOCIATION_SYSTEM_PROMPT's biasing instruction depends
 * on that distinction (stated lane(s) bias generation toward them;
 * "not_sure" spreads evenly).
 *
 * 2026-09-23: renamed lanes (illustrative_narrative -> illustrative,
 * comic_strip -> framed, montage_collage -> narrative_collage) and
 * single-select-auto-advance -> multi-select-with-Continue-button. Also
 * covers the per-lane style-hints call (server/src/schemas/styleHints.ts) --
 * a brief loading state while it runs, personalized hint text replacing the
 * static description for whichever lanes it returns something for, and
 * graceful, silent fallback to the static description on any failure (never
 * an error banner, never a blocked screen). Every test below stubs `fetch`
 * directly, not via a shared mock helper -- this call is deliberately NOT
 * routed through useAsyncAction, so there is no shared error-state plumbing
 * to reuse the way other screens' tests do.
 */

function seedState() {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true, discoveryCompleted: true, themesSelected: true, intentionConfirmed: true };
  state.project = { ...state.project, statement_of_intention: "A statement grounded in the client's own confirmed story." };
  savePersistedState(state);
  return state;
}

function stubHintsResponse(hints: Record<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { hints } }),
    }),
  );
}

function stubHintsFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: "model_invalid_response", message: "Model response failed schema validation." } }),
    }),
  );
}

async function renderAndWaitPastLoading() {
  render(
    <JourneyProvider>
      <VisualStylePreference />
    </JourneyProvider>,
  );
  await waitFor(() => expect(screen.queryByText(/Getting a feel for your story/)).toBeNull());
}

function storedPreferences(): string[] {
  const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
  return stored.project.visual_style_preferences;
}

describe("VisualStylePreference", () => {
  it("shows a loading state while the style-hints call is in flight, before any option renders", () => {
    stubHintsResponse({});
    seedState();
    render(
      <JourneyProvider>
        <VisualStylePreference />
      </JourneyProvider>,
    );

    screen.getByText(/Getting a feel for your story/);
    expect(screen.queryByText("Abstract & symbolic")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("renders all 6 options with their static client-facing labels once loading settles, falling back to the generic description for every lane when the hints call returns none", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    screen.getByText("Abstract & symbolic");
    screen.getByText("An object or image that represents the feeling, not the literal story");
    screen.getByText("Illustrative");
    screen.getByText("A single clear subject or scene, shown plainly rather than combined with other elements");
    screen.getByText("Typography-based");
    screen.getByText("The story told through lettering or words as the design itself");
    screen.getByText("Framed");
    screen.getByText(
      "A scene or sequence set inside its own visible frame -- a small run of linked panels, a Polaroid-style vignette, or a badge/crest shape",
    );
    screen.getByText("Narrative Collage / Layered Montage");
    screen.getByText(
      "Several of the story's own elements layered or combined into one composition -- a storyboard, a moodboard, or a themed grouping",
    );
    screen.getByText("Not sure");
    screen.getByText("Show me a mix");
    vi.unstubAllGlobals();
  });

  it("renders a personalized per-lane hint in place of the static description for every lane the call returns one for", async () => {
    stubHintsResponse({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      illustrative: "The actual kitchen table, drawn plainly as it was.",
      typography: "Her own handwriting, not an invented phrase.",
      framed: "A few small beats showing how the choice unfolded.",
      narrative_collage: "The apron and the table, brought together in one piece.",
    });
    seedState();
    await renderAndWaitPastLoading();

    screen.getByText("Like a single object standing in for the freedom you're building toward.");
    screen.getByText("The actual kitchen table, drawn plainly as it was.");
    screen.getByText("Her own handwriting, not an invented phrase.");
    screen.getByText("A few small beats showing how the choice unfolded.");
    screen.getByText("The apron and the table, brought together in one piece.");
    // The static generic descriptions are gone, replaced -- not merely appended alongside.
    expect(screen.queryByText("An object or image that represents the feeling, not the literal story")).toBeNull();
    // "Not sure" never gets a personalized hint -- it keeps its own static text regardless.
    screen.getByText("Show me a mix");
    vi.unstubAllGlobals();
  });

  it("falls back to the static description for just ONE lane when the hints call omits only that lane -- a missing lane never costs the others their personalized text", async () => {
    stubHintsResponse({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      // typography deliberately omitted
      framed: "A few small beats showing how the choice unfolded.",
      illustrative: "The actual kitchen table, drawn plainly as it was.",
      narrative_collage: "The apron and the table, brought together in one piece.",
    });
    seedState();
    await renderAndWaitPastLoading();

    screen.getByText("Like a single object standing in for the freedom you're building toward.");
    // Falls back to the ordinary static description for the one lane the call didn't cover.
    screen.getByText("The story told through lettering or words as the design itself");
    vi.unstubAllGlobals();
  });

  it("degrades gracefully on a failed style-hints call: every lane falls back to its static description, no error banner, screen still fully usable", async () => {
    stubHintsFailure();
    seedState();
    await renderAndWaitPastLoading();

    screen.getByText("Abstract & symbolic");
    screen.getByText("An object or image that represents the feeling, not the literal story");
    screen.getByText("Illustrative");
    // No error surfaced anywhere on this screen.
    expect(screen.queryByText(/error/i)).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();

    // The screen is still fully interactive -- choosing an option and continuing still works.
    fireEvent.click(screen.getByText("Abstract & symbolic").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(storedPreferences()).toEqual(["abstract_symbolic"]);
    vi.unstubAllGlobals();
  });

  it("degrades gracefully when the style-hints call times out / rejects outright (network error), same as a schema-validation failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("Request timed out waiting for the server."), { code: "client_timeout" })));
    seedState();
    await renderAndWaitPastLoading();

    screen.getByText("Abstract & symbolic");
    screen.getByText("An object or image that represents the feeling, not the literal story");
    expect(screen.queryByText(/error/i)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("Continue is disabled until at least one option is selected", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(screen.getByText("Abstract & symbolic").closest("button")!);
    expect(continueButton.disabled).toBe(false);
  });

  it.each([
    ["Abstract & symbolic", "abstract_symbolic"],
    ["Illustrative", "illustrative"],
    ["Typography-based", "typography"],
    ["Framed", "framed"],
    ["Narrative Collage / Layered Montage", "narrative_collage"],
  ] as const)("selecting only '%s' and continuing stores visual_style_preferences as ['%s'] and marks the question answered", async (label, expected) => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText(label).closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual([expected]);
    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.ui.visualStylePreferenceSet).toBe(true);
    vi.unstubAllGlobals();
  });

  it("multi-select: picking two lanes and continuing stores both in the array", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText("Illustrative").closest("button")!);
    fireEvent.click(screen.getByText("Framed").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual(["illustrative", "framed"]);
    vi.unstubAllGlobals();
  });

  it("clicking a selected lane again deselects it", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    const illustrativeButton = screen.getByText("Illustrative").closest("button")!;
    fireEvent.click(illustrativeButton);
    fireEvent.click(screen.getByText("Framed").closest("button")!);
    fireEvent.click(illustrativeButton);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual(["framed"]);
    vi.unstubAllGlobals();
  });

  it("'Not sure' is stored as a real answer, not left null -- it is not a skip", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText("Not sure").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual(["not_sure"]);
    vi.unstubAllGlobals();
  });

  it("'Not sure' is mutually exclusive with the 5 lanes -- selecting it clears any lane picks", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText("Illustrative").closest("button")!);
    fireEvent.click(screen.getByText("Framed").closest("button")!);
    fireEvent.click(screen.getByText("Not sure").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual(["not_sure"]);
    vi.unstubAllGlobals();
  });

  it("picking a lane while 'Not sure' is selected clears 'Not sure'", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText("Not sure").closest("button")!);
    fireEvent.click(screen.getByText("Illustrative").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(storedPreferences()).toEqual(["illustrative"]);
    vi.unstubAllGlobals();
  });
});

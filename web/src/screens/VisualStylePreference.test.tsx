import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import { VisualStylePreference } from "./VisualStylePreference";

/**
 * The pre-qualifying visual-style question (2026-09) -- asked once, before
 * Association is ever called. Locks in: all 6 options render with their
 * client-facing labels, each writes the correct engine-side value, and
 * "Not sure" is stored as a real answer ("not_sure"), not left null/skipped --
 * ASSOCIATION_SYSTEM_PROMPT's biasing instruction depends on that distinction
 * (a stated lane biases generation toward it; "not_sure" spreads evenly).
 *
 * 2026-09-23: also covers the per-lane style-hints call (server/src/schemas/
 * styleHints.ts) -- a brief loading state while it runs, personalized hint
 * text replacing the static description for whichever lanes it returns
 * something for, and graceful, silent fallback to the static description on
 * any failure (never an error banner, never a blocked screen). Every test
 * below stubs `fetch` directly, not via a shared mock helper -- this call is
 * deliberately NOT routed through useAsyncAction, so there is no shared
 * error-state plumbing to reuse the way other screens' tests do.
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
    screen.getByText("Illustrative & narrative");
    screen.getByText("A scene that visually shows what happened");
    screen.getByText("Typography-based");
    screen.getByText("The story told through lettering or words as the design itself");
    screen.getByText("Comic-strip / panel style");
    screen.getByText("The story told across small linked panels");
    screen.getByText("Montage / collage");
    screen.getByText("Several images layered or combined into one composition");
    screen.getByText("Not sure");
    screen.getByText("Show me a mix");
    vi.unstubAllGlobals();
  });

  it("renders a personalized per-lane hint in place of the static description for every lane the call returns one for", async () => {
    stubHintsResponse({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      illustrative_narrative: "The actual kitchen table, drawn plainly as it was.",
      typography: "Her own handwriting, not an invented phrase.",
      comic_strip: "A few small beats showing how the choice unfolded.",
      montage_collage: "The apron and the table, brought together in one piece.",
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
    expect(screen.queryByText("A scene that visually shows what happened")).toBeNull();
    // "Not sure" never gets a personalized hint -- it keeps its own static text regardless.
    screen.getByText("Show me a mix");
    vi.unstubAllGlobals();
  });

  it("falls back to the static description for just ONE lane when the hints call omits only that lane -- a missing lane never costs the others their personalized text", async () => {
    stubHintsResponse({
      abstract_symbolic: "Like a single object standing in for the freedom you're building toward.",
      // typography deliberately omitted
      comic_strip: "A few small beats showing how the choice unfolded.",
      illustrative_narrative: "The actual kitchen table, drawn plainly as it was.",
      montage_collage: "The apron and the table, brought together in one piece.",
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
    screen.getByText("Illustrative & narrative");
    screen.getByText("A scene that visually shows what happened");
    // No error surfaced anywhere on this screen.
    expect(screen.queryByText(/error/i)).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();

    // The screen is still fully interactive -- choosing an option still works.
    fireEvent.click(screen.getByText("Abstract & symbolic").closest("button")!);
    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.visual_style_preference).toBe("abstract_symbolic");
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

  it.each([
    ["Abstract & symbolic", "abstract_symbolic"],
    ["Illustrative & narrative", "illustrative_narrative"],
    ["Typography-based", "typography"],
    ["Comic-strip / panel style", "comic_strip"],
    ["Montage / collage", "montage_collage"],
    ["Not sure", "not_sure"],
  ] as const)("choosing '%s' stores visual_style_preference as '%s' and marks the question answered", async (label, expected) => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText(label).closest("button")!);

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.visual_style_preference).toBe(expected);
    expect(stored.ui.visualStylePreferenceSet).toBe(true);
    vi.unstubAllGlobals();
  });

  it("'Not sure' is stored as a real answer, not left null -- it is not a skip", async () => {
    stubHintsResponse({});
    seedState();
    await renderAndWaitPastLoading();

    fireEvent.click(screen.getByText("Not sure").closest("button")!);

    const stored = JSON.parse(localStorage.getItem("positive-inking:journey-state:v1")!);
    expect(stored.project.visual_style_preference).not.toBeNull();
    expect(stored.project.visual_style_preference).toBe("not_sure");
    vi.unstubAllGlobals();
  });
});

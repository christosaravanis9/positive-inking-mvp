import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import type { ProvenanceData, DiscoveryData } from "../api/types";
import { ImageProvenance } from "./ImageProvenance";

/**
 * Regression coverage for the same silent-dead-end pattern fixed on Screen 7
 * and MeaningReflection (live-test report): the re-entry theme-confirmation
 * step's Continue button (finalizeElaboration) was disabled whenever no
 * theme was selected, with nothing on screen saying so. Fix adds a stated
 * reason under Continue whenever it's disabled, matching the wording used
 * elsewhere.
 */

vi.mock("../api/provenance", () => ({ requestProvenance: vi.fn() }));
vi.mock("../api/discovery", () => ({ requestDiscovery: vi.fn() }));
const { requestProvenance } = await import("../api/provenance");
const { requestDiscovery } = await import("../api/discovery");

function provenanceWithReentry(): ProvenanceData {
  return {
    attraction_origin: "Something about her.",
    origin_period: "childhood",
    origin_source: "person",
    personal_entities: ["her"],
    significance_claimed: false,
    provenance_confidence: 0.7,
    reentry_candidate: { surfaced: true, subject: "her" },
  };
}

function discoveryResult(overrides: Partial<DiscoveryData> = {}): DiscoveryData {
  return {
    primary_viewpoint: "past",
    secondary_viewpoints: [],
    primary_intention: "memorial",
    secondary_intentions: [],
    deep_why: "test",
    key_themes: ["family", "loss"],
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

function seedImageProvenanceState() {
  const state = createInitialJourneyState();
  state.project = { ...state.project, journey_mode: "attraction" };
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true, imageDescribed: true };
  savePersistedState(state);
  return state;
}

async function reachThemesToConfirmScreen() {
  vi.mocked(requestProvenance).mockResolvedValue(provenanceWithReentry());
  vi.mocked(requestDiscovery).mockResolvedValue(discoveryResult());
  seedImageProvenanceState();
  render(
    <JourneyProvider>
      <ImageProvenance />
    </JourneyProvider>,
  );

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "When I first saw it, I thought of her." } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => screen.getByText("You mentioned her."));

  fireEvent.click(screen.getByText("Tell me more"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "She always loved this design." } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => screen.getByText("Here is what we heard"));
}

describe("ImageProvenance -- re-entry theme confirmation Continue disabled with no stated reason (live-test regression pattern)", () => {
  beforeEach(() => {
    vi.mocked(requestProvenance).mockReset();
    vi.mocked(requestDiscovery).mockReset();
  });

  it("shows a stated reason when every theme is deselected, instead of a silent dead end", async () => {
    // Both themes come pre-selected by default (same as MeaningReflection's own
    // pre-selection behaviour) -- deselecting all of them is how a real user reaches
    // the zero-selected state this screen must never leave unexplained.
    await reachThemesToConfirmScreen();
    fireEvent.click(screen.getByText("family"));
    fireEvent.click(screen.getByText("loss"));

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    screen.getByText("Select at least one theme above to continue.");
  });

  it("the reason is absent while Continue is enabled, and reappears the moment every theme is deselected", async () => {
    await reachThemesToConfirmScreen();

    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(screen.queryByText("Select at least one theme above to continue.")).toBeNull();

    fireEvent.click(screen.getByText("family"));
    fireEvent.click(screen.getByText("loss"));

    expect(continueButton.disabled).toBe(true);
    screen.getByText("Select at least one theme above to continue.");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JourneyProvider } from "../journey/JourneyProvider";
import { createInitialJourneyState } from "../journey/state";
import { savePersistedState } from "../journey/persistence";
import type { StyleReferenceData } from "../api/types";
import { StyleReference } from "./StyleReference";

/**
 * Privacy notice's "Photographs of other people" section: the optional
 * example-photo upload (shown only when a style reference is under-specified)
 * is gated behind the same rights-confirmation checkbox as the other two
 * upload sites.
 */

vi.mock("../api/styleReference", () => ({ requestStyleReferenceResolution: vi.fn() }));
const { requestStyleReferenceResolution } = await import("../api/styleReference");

function seedState() {
  const state = createInitialJourneyState();
  state.ui = { ...state.ui, pastWelcome: true, viewpointSelected: true, discoveryCompleted: true };
  savePersistedState(state);
  return state;
}

function underSpecifiedResult(): StyleReferenceData {
  return {
    recognized: true,
    under_specified: true,
    summary: "That covers a broad tradition.",
    leaves_open_note: "",
    style_resolves: [],
    style_leaves_open: [],
    resolved_values: {},
  };
}

beforeEach(() => {
  vi.mocked(requestStyleReferenceResolution).mockReset();
});

async function reachUnderSpecifiedPhotoUpload() {
  vi.mocked(requestStyleReferenceResolution).mockResolvedValue(underSpecifiedResult());
  seedState();
  render(
    <JourneyProvider>
      <StyleReference />
    </JourneyProvider>,
  );

  fireEvent.change(screen.getByPlaceholderText("e.g. woodblock print, American traditional, fine-line..."), {
    target: { value: "Japanese traditional" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => screen.getByText("That covers a broad tradition."));
}

describe("StyleReference -- third-party photo rights checkbox on the optional example photo", () => {
  it("the example-photo file input is disabled until the rights checkbox is checked", async () => {
    await reachUnderSpecifiedPhotoUpload();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm I have the right to use this image/ }));
    expect(fileInput.disabled).toBe(false);
  });

  it("a file selected while unconfirmed is never processed -- belt-and-braces guard behind the disabled input", async () => {
    await reachUnderSpecifiedPhotoUpload();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake image bytes"], "example.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Never processed into a preview -- the guard in attachExample refused it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByAltText("example.png")).toBeNull();
  });
});

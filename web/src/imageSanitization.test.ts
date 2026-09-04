import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileAsSanitizedDataUrl } from "./imageSanitization";

/**
 * Data-minimization audit (item 4): jsdom has no real canvas 2D
 * implementation (`HTMLCanvasElement.getContext("2d")` throws
 * "Not implemented" without the native `canvas` npm package, which this
 * project doesn't depend on -- adding a native-compiled dependency purely
 * for a test double would be exactly the kind of unnecessary weight this
 * fix was supposed to avoid). These tests instead verify the module's
 * CONTRACT with fakes, the same pattern already used for the Web Speech
 * API in VoiceInput.test.tsx: routing (image vs. non-image), the exact
 * canvas calls made, mime-type selection, and that every failure mode
 * rejects rather than silently falling back to unstripped data.
 *
 * The actual pixel-level guarantee (a real photo's real EXIF bytes are
 * genuinely gone from what ends up stored) is verified separately by a
 * live-browser test against a real Chromium canvas -- see the session log
 * entry in docs/PROJECT_STATUS.md for that run's result.
 */

class FakeImage {
  static shouldFail = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 40;
  naturalHeight = 30;
  private _src = "";
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (FakeImage.shouldFail) this.onerror?.();
      else this.onload?.();
    });
  }
  get src() {
    return this._src;
  }
}

function installFakeCanvas(options: { hasContext?: boolean; toDataURLResult?: string } = {}) {
  const hasContext = options.hasContext ?? true;
  const toDataURLResult = options.toDataURLResult ?? "data:image/jpeg;base64,STRIPPED";
  const drawImage = vi.fn();
  const getContext = vi.fn().mockReturnValue(hasContext ? { drawImage } : null);
  const toDataURL = vi.fn().mockReturnValue(toDataURLResult);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(getContext as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL as never);
  return { drawImage, getContext, toDataURL };
}

function fileFixture(name: string, type: string, content = "fake-bytes"): File {
  return new File([content], name, { type });
}

beforeEach(() => {
  FakeImage.shouldFail = false;
  vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
  if (!URL.createObjectURL) {
    // jsdom doesn't implement these at all in some versions; stub minimally.
    URL.createObjectURL = vi.fn().mockReturnValue("blob:fake");
    URL.revokeObjectURL = vi.fn();
  } else {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readFileAsSanitizedDataUrl", () => {
  it("routes an image file through the canvas re-encode path, never the plain FileReader path", async () => {
    const { getContext, drawImage, toDataURL } = installFakeCanvas();
    const file = fileFixture("photo.jpg", "image/jpeg");

    const result = await readFileAsSanitizedDataUrl(file);

    expect(getContext).toHaveBeenCalledWith("2d");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledTimes(1);
    expect(result).toBe("data:image/jpeg;base64,STRIPPED");
  });

  it("normalises every non-PNG image type to JPEG on re-encode", async () => {
    const { toDataURL } = installFakeCanvas();
    await readFileAsSanitizedDataUrl(fileFixture("photo.heic", "image/heic"));
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
  });

  it("keeps PNG as PNG on re-encode -- lossless, and preserves transparency", async () => {
    const { toDataURL } = installFakeCanvas();
    await readFileAsSanitizedDataUrl(fileFixture("photo.png", "image/png"));
    expect(toDataURL).toHaveBeenCalledWith("image/png", 0.92);
  });

  it("a non-image file (the PDF this build's reference upload also accepts) never touches the canvas at all", async () => {
    const { getContext, toDataURL } = installFakeCanvas();
    const file = fileFixture("design-brief.pdf", "application/pdf", "%PDF-1.4 fake pdf bytes");

    const result = await readFileAsSanitizedDataUrl(file);

    expect(getContext).not.toHaveBeenCalled();
    expect(toDataURL).not.toHaveBeenCalled();
    expect(result.startsWith("data:application/pdf")).toBe(true);
  });

  it("rejects rather than silently returning unstripped data when no canvas 2D context is available", async () => {
    installFakeCanvas({ hasContext: false });
    await expect(readFileAsSanitizedDataUrl(fileFixture("photo.jpg", "image/jpeg"))).rejects.toThrow();
  });

  it("rejects rather than silently returning unstripped data when the image fails to decode", async () => {
    installFakeCanvas();
    FakeImage.shouldFail = true;
    await expect(readFileAsSanitizedDataUrl(fileFixture("corrupt.jpg", "image/jpeg"))).rejects.toThrow();
  });

  it("always revokes the object URL it creates, success or failure -- no leaked blob URLs", async () => {
    installFakeCanvas();
    const file = fileFixture("photo.jpg", "image/jpeg");
    await readFileAsSanitizedDataUrl(file);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");

    vi.mocked(URL.revokeObjectURL).mockClear();
    FakeImage.shouldFail = true;
    await expect(readFileAsSanitizedDataUrl(file)).rejects.toThrow();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});

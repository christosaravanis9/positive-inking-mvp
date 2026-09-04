/**
 * Data-minimization audit finding (item 4): uploaded reference photos never
 * leave the browser (confirmed elsewhere -- no server upload endpoint exists,
 * and no client API call ever includes image data), but the data URL held in
 * memory and persisted to localStorage previously carried whatever EXIF
 * metadata the original file had, GPS coordinates included. This is the fix.
 *
 * Re-encoding through a canvas strips EXIF entirely rather than attempting to
 * parse and selectively remove tags -- canvas pixel data has no metadata
 * channel at all, so there is nothing left to carry it. This also means a
 * JPEG's EXIF orientation tag is naturally "baked in" correctly: browsers
 * auto-orient an <img>/canvas-drawn source per that tag before the pixels are
 * ever read, so the re-encoded file renders identically without needing to
 * keep the tag around.
 *
 * Non-image files (this build's reference-upload input also accepts PDF)
 * pass straight through -- EXIF is an image-specific format, and canvas
 * re-encoding doesn't apply to a PDF at all.
 *
 * Deliberately rejects on any failure (read error, decode error, no canvas
 * context) rather than falling back to the unstripped original -- a caller
 * must never end up with EXIF-laden image data because some intermediate
 * step silently gave up.
 */
export function readFileAsSanitizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return readFileAsDataUrl(file);
  }
  return stripImageMetadata(file);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't decode that image."));
    image.src = objectUrl;
  });
}

async function stripImageMetadata(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available to process that image.");
    ctx.drawImage(image, 0, 0);
    // PNG stays PNG (lossless, and re-encoding as JPEG would needlessly discard
    // transparency); every other image type is normalised to JPEG.
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(outputType, 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

import { useRef, useState, type RefObject } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestStyleReferenceResolution } from "../api/styleReference";
import { AsyncError } from "../components/AsyncError";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import { describeDimensionValue, PROJECT_FIELD_BY_DIMENSION } from "../journey/artisticDimensionLabels";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import { readFileAsSanitizedDataUrl } from "../imageSanitization";
import type { StyleReferenceData } from "../api/types";
import type { ArtisticDimensionKey, ProjectState } from "@positive-inking/engine";

/** Same cap as ReferenceAttachment, for the same reason -- no backend storage in this build (see §15.7 production blocker note). */
const MAX_FILE_BYTES = 3 * 1024 * 1024;

/**
 * Screen 11 lead-in (§12.10). Naming a style, medium, artist, or tradition
 * is entirely optional -- skipping leaves every artistic dimension eligible
 * for Screen 11's own question flow, exactly as if this screen didn't
 * exist. A resolution is always shown back once, compactly, and is
 * correctable before it's applied to anything.
 */
export function StyleReference() {
  const { state, patchProject, patchUI } = useJourney();
  const { run, pending: fetching } = useAsyncAction();
  const { project, ui } = state;
  const [text, setText] = useState("");
  const [resolution, setResolution] = useState<StyleReferenceData | null>(null);
  const [examplePhoto, setExamplePhoto] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function skip() {
    patchUI({ styleReferenceAsked: true });
  }

  function submit() {
    if (text.trim().length === 0) return;
    void run(async (guard) => {
      const alreadyConfirmed = { ...ui.artisticAnswers };
      const result = await requestStyleReferenceResolution(text.trim(), alreadyConfirmed);
      if (guard.isStale()) return;
      setResolution(result);
    }, "Working out what that style points toward");
  }

  function tryAgain() {
    setResolution(null);
    setExamplePhoto(null);
    setPhotoError(null);
  }

  function attachExample(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPhotoError(`That photo is too large for this prototype (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB). Try a smaller one.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    readFileAsSanitizedDataUrl(file)
      .then((dataUrl) => {
        setExamplePhoto({ dataUrl, fileName: file.name });
        logTelemetryEvent("reference_requested", project.project_id, { context: "style_example" });
      })
      .catch(() => setPhotoError("Couldn't read that photo. Try again or choose a different one."));
  }

  function confirmResolution() {
    if (!resolution) return;

    const patch: Partial<ProjectState> = {
      style_reference: text.trim(),
      style_resolves: resolution.style_resolves,
      style_leaves_open: resolution.style_leaves_open,
      style_references: [
        ...project.style_references,
        { style_reference: text.trim(), style_resolves: resolution.style_resolves, style_leaves_open: resolution.style_leaves_open },
      ],
    };
    for (const [dimension, value] of Object.entries(resolution.resolved_values)) {
      (patch as Record<string, unknown>)[PROJECT_FIELD_BY_DIMENSION[dimension as keyof typeof PROJECT_FIELD_BY_DIMENSION]] = value;
    }
    patchProject(patch);

    patchUI({
      styleReferenceAsked: true,
      // Only still open if the style was under-specified AND the client didn't settle it with an example photo.
      styleUnderSpecified: resolution.under_specified && !examplePhoto,
      referenceAssets: examplePhoto ? { ...ui.referenceAssets, style_reference: examplePhoto } : ui.referenceAssets,
    });
  }

  if (fetching) {
    return (
      <div className="screen">
        <h2>Is there a particular style, medium, or tradition in mind?</h2>
        <ModelWaitIndicator label="Working out what that points toward..." />
      </div>
    );
  }

  if (resolution) {
    const resolvedEntries = Object.entries(resolution.resolved_values);
    return (
      <div className="screen">
        <h2>Here's what that suggests</h2>
        {!resolution.recognized ? (
          <>
            <p className="supporting">We couldn't place "{text.trim()}" as a specific style, medium, or tradition.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={tryAgain}>Try a different reference</button>
              <button className="secondary" onClick={skip}>
                Skip this
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="supporting">{resolution.summary}</p>
            {resolvedEntries.length > 0 && (
              <ul>
                {resolvedEntries.map(([dimension, value]) => (
                  <li key={dimension}>{describeDimensionValue(dimension as ArtisticDimensionKey, value as string)}</li>
                ))}
              </ul>
            )}
            {resolution.leaves_open_note && <p className="supporting">{resolution.leaves_open_note}</p>}

            {resolution.under_specified && (
              <div className="reference-attachment">
                <p style={{ margin: 0 }} className="supporting">
                  That reference covers a lot of ground. A quick visual example would help pin down the rest (optional).
                </p>
                {photoError && <p className="reference-error">{photoError}</p>}
                {examplePhoto ? (
                  <div className="reference-preview">
                    <img src={examplePhoto.dataUrl} alt={examplePhoto.fileName} />
                    <div>
                      <div>{examplePhoto.fileName}</div>
                      <button type="button" className="secondary" onClick={() => setExamplePhoto(null)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => attachExample(e.target.files?.[0])} />
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmResolution}>That's right, continue</button>
              <button className="secondary" onClick={tryAgain}>
                That's not right — try again
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>Is there a particular style, medium, or tradition in mind?</h2>
      <p className="supporting">
        For example a woodblock print, Japanese traditional, blackwork, watercolour, or an artist whose work you love. Entirely
        optional.
      </p>
      <AsyncError onRetry={submit} />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. woodblock print, American traditional, fine-line..."
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={text.trim().length === 0 || fetching}>
          Continue
        </button>
        <button className="secondary" onClick={skip} disabled={fetching}>
          Nothing in particular
        </button>
      </div>
    </div>
  );
}

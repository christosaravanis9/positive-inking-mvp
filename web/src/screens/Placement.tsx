import { useRef, useState, type RefObject } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { OptionChips } from "../components/OptionChips";
import { logTelemetryEvent } from "../instrumentation/telemetry";

/** Same cap as ReferenceAttachment, for the same reason -- no backend storage in this build (see §15.7 production blocker note). */
const MAX_FILE_BYTES = 3 * 1024 * 1024;

/**
 * Screen 12 (§8) -- full capture: body selector, side, area, dimensions,
 * wrap level, primary view, future expansion, relationship to existing
 * tattoos, an optional nearby-tattoo reference photo, and an optional
 * placement photograph. All but body area stay optional -- this is a
 * consumer consultation, not a technical tattoo intake form (per the
 * explicit instruction not to turn it into one).
 */
export function Placement() {
  const { state, patchProject, patchUI } = useJourney();
  const [bodyArea, setBodyArea] = useState(state.project.body_area || state.project.body_area_coarse);
  const [side, setSide] = useState(state.project.side);
  const [dimensions, setDimensions] = useState(state.project.dimensions ?? "");
  const [wrap, setWrap] = useState(state.project.wrap_level || "contained");
  const [primaryView, setPrimaryView] = useState(state.project.primary_view);
  const [futureExpansion, setFutureExpansion] = useState(state.project.future_expansion);
  const [existingTattoos, setExistingTattoos] = useState(state.project.existing_tattoos.join(", "));
  const [placementPhoto, setPlacementPhoto] = useState<string | null>(state.project.placement_reference);
  const [nearbyTattooPhoto, setNearbyTattooPhoto] = useState<{ dataUrl: string; fileName: string } | null>(
    state.ui.referenceAssets.nearby_tattoo ?? null,
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const placementInputRef = useRef<HTMLInputElement>(null);
  const nearbyInputRef = useRef<HTMLInputElement>(null);

  function attachFile(file: File | undefined, onLoaded: (dataUrl: string, fileName: string) => void, inputRef: RefObject<HTMLInputElement>) {
    setPhotoError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPhotoError(`That photo is too large for this prototype (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB). Try a smaller one.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoaded(String(reader.result), file.name);
    reader.onerror = () => setPhotoError("Couldn't read that photo. Try again or choose a different one.");
    reader.readAsDataURL(file);
  }

  function confirm() {
    patchProject({
      body_area: bodyArea,
      side,
      dimensions: dimensions.trim() || null,
      wrap_level: wrap,
      primary_view: primaryView,
      future_expansion: futureExpansion,
      existing_tattoos: existingTattoos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      placement_reference: placementPhoto,
    });
    patchUI({
      placementDone: true,
      referenceAssets: nearbyTattooPhoto
        ? { ...state.ui.referenceAssets, nearby_tattoo: nearbyTattooPhoto }
        : state.ui.referenceAssets,
    });
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Placement and flow</p>
      <h2 className="screen-heading">Where exactly will it live?</h2>
      <p className="supporting">Placement comes before the final artistic questions so those decisions can respond to the actual body area.</p>
      <input type="text" value={bodyArea} onChange={(e) => setBodyArea(e.target.value)} placeholder="Body area (e.g. left forearm)" />

      <p className="supporting">Side</p>
      <OptionChips
        options={[
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "centred", label: "Centred / not applicable" },
        ]}
        selected={side ? [side] : []}
        onSelect={setSide}
      />

      <input
        type="text"
        value={dimensions}
        onChange={(e) => setDimensions(e.target.value)}
        placeholder="Roughly how big? (e.g. about the size of a palm) -- optional"
      />

      <p className="supporting">Should it remain contained or wrap?</p>
      <OptionChips
        options={[
          { value: "contained", label: "Stays contained" },
          { value: "partial_wrap", label: "Partial wrap" },
          { value: "full_wrap", label: "Full wrap" },
        ]}
        selected={[wrap]}
        onSelect={setWrap}
      />

      <p className="supporting">How will it mostly be seen? (optional)</p>
      <OptionChips
        options={[
          { value: "straight_on", label: "Straight on" },
          { value: "from_the_side", label: "From the side" },
          { value: "does_not_matter", label: "Doesn't matter" },
        ]}
        selected={primaryView ? [primaryView] : []}
        onSelect={(v) => setPrimaryView(primaryView === v ? "" : v)}
      />

      <input
        type="text"
        value={futureExpansion}
        onChange={(e) => setFutureExpansion(e.target.value)}
        placeholder="Any future expansion planned? (or leave blank)"
      />
      <input
        type="text"
        value={existingTattoos}
        onChange={(e) => setExistingTattoos(e.target.value)}
        placeholder="Any existing nearby tattoos it should connect to? (comma-separated)"
      />

      {photoError && <p className="reference-error">{photoError}</p>}

      <div className="reference-attachment">
        <p style={{ margin: 0 }} className="supporting">
          Nearby tattoo reference (optional)
        </p>
        {nearbyTattooPhoto ? (
          <div className="reference-preview">
            <img src={nearbyTattooPhoto.dataUrl} alt={nearbyTattooPhoto.fileName} />
            <div>
              <div>{nearbyTattooPhoto.fileName}</div>
              <button type="button" className="secondary" onClick={() => setNearbyTattooPhoto(null)}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <input
            ref={nearbyInputRef}
            type="file"
            accept="image/*"
            onChange={(e) =>
              attachFile(
                e.target.files?.[0],
                (dataUrl, fileName) => {
                  setNearbyTattooPhoto({ dataUrl, fileName });
                  logTelemetryEvent("reference_requested", state.project.project_id, { context: "nearby_tattoo" });
                },
                nearbyInputRef,
              )
            }
          />
        )}
      </div>

      <div className="reference-attachment">
        <p style={{ margin: 0 }} className="supporting">
          Placement photograph (optional)
        </p>
        {placementPhoto ? (
          <div className="reference-preview">
            <img src={placementPhoto} alt="Placement reference" />
            <div>
              <button type="button" className="secondary" onClick={() => setPlacementPhoto(null)}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <input
            ref={placementInputRef}
            type="file"
            accept="image/*"
            onChange={(e) =>
              attachFile(
                e.target.files?.[0],
                (dataUrl) => {
                  setPlacementPhoto(dataUrl);
                  logTelemetryEvent("reference_requested", state.project.project_id, { context: "placement_photo" });
                },
                placementInputRef,
              )
            }
          />
        )}
      </div>

      <button onClick={confirm} disabled={bodyArea.trim().length === 0}>
        Continue
      </button>
    </div>
  );
}

import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { OptionChips } from "../components/OptionChips";

/**
 * Screen 12 (§8). Reference upload + attestation (§15) is out of scope for
 * this pass -- described in text for now rather than a full upload/consent
 * flow. Flagged in the Phase 4 checkpoint, not hidden.
 */
export function Placement() {
  const { state, patchProject, patchUI } = useJourney();
  const [bodyArea, setBodyArea] = useState(state.project.body_area || state.project.body_area_coarse);
  const [side, setSide] = useState(state.project.side);
  const [wrap, setWrap] = useState(state.project.wrap_level || "contained");
  const [futureExpansion, setFutureExpansion] = useState(state.project.future_expansion);
  const [existingTattoos, setExistingTattoos] = useState(state.project.existing_tattoos.join(", "));

  function confirm() {
    patchProject({
      body_area: bodyArea,
      side,
      wrap_level: wrap,
      future_expansion: futureExpansion,
      existing_tattoos: existingTattoos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    patchUI({ placementDone: true });
  }

  return (
    <div className="screen">
      <h2>Where exactly will it live?</h2>
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
      <button onClick={confirm} disabled={bodyArea.trim().length === 0}>
        Continue
      </button>
    </div>
  );
}

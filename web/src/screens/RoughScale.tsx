import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { lightweightSuitabilityCheck, type SizeClass } from "@positive-inking/engine";

const BODY_AREAS = ["arm", "leg", "torso", "back", "hand or foot", "other"];
const SIZE_CLASSES: { value: SizeClass; label: string }[] = [
  { value: "small", label: "Small (palm-sized or less)" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "sleeve_or_panel", label: "Sleeve or panel" },
];

/** Screen 9 (§8). Two taps, then the lightweight suitability pass (§13.5). */
export function RoughScale() {
  const { state, patchProject, patchUI } = useJourney();
  const [bodyArea, setBodyArea] = useState(state.project.body_area_coarse);
  const [sizeClass, setSizeClass] = useState<SizeClass | "">(state.project.size_class);
  const [resolution, setResolution] = useState<string | null>(null);

  const consideration =
    sizeClass && state.project.visual_elements.length > 0
      ? lightweightSuitabilityCheck(sizeClass, state.project.visual_elements.length, state.project.creative_control || undefined)
      : null;

  function proceed() {
    patchProject({ body_area_coarse: bodyArea, size_class: sizeClass || "small" });
    patchUI({ roughScaleSet: true });
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Scale and area</p>
      <h2 className="screen-heading">Roughly how big, and roughly where?</h2>
      <p className="supporting">Body area</p>
      <div className="option-grid">
        {BODY_AREAS.map((area) => (
          <button key={area} className={`option-chip${bodyArea === area ? " selected" : ""}`} onClick={() => setBodyArea(area)}>
            {area}
          </button>
        ))}
      </div>
      <p className="supporting">Size</p>
      <div className="option-grid">
        {SIZE_CLASSES.map((s) => (
          <button key={s.value} className={`option-chip${sizeClass === s.value ? " selected" : ""}`} onClick={() => setSizeClass(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {consideration?.blocking && (
        <div className="error-banner">
          <strong>Worth checking:</strong> {consideration.reason}
          <div className="option-grid" style={{ marginTop: 8 }}>
            {consideration.resolutions.map((r) => (
              <button key={r} className={`option-chip${resolution === r ? " selected" : ""}`} onClick={() => setResolution(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={proceed} disabled={!bodyArea || !sizeClass || (Boolean(consideration?.blocking) && !resolution)}>
        Continue
      </button>
    </div>
  );
}

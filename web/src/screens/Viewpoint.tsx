import { useJourney } from "../journey/JourneyProvider";
import type { Viewpoint as ViewpointValue, JourneyMode } from "@positive-inking/engine";

/** Screen 2 (§8). Sets journey_mode; the "skip to design" escape is always available regardless of the primary choice. */
export function Viewpoint() {
  const { patchProject, patchUI } = useJourney();

  function choose(userViewpoint: string, journeyMode: JourneyMode, primaryViewpoint: ViewpointValue | null) {
    patchProject({ user_viewpoint: userViewpoint, journey_mode: journeyMode, primary_viewpoint: primaryViewpoint, viewpoint_applied: true });
    patchUI({ viewpointSelected: true });
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Start with time</p>
      <h2 className="screen-heading">Where does this tattoo come from?</h2>
      <p className="supporting">Choose the viewpoint that feels closest. It can contain more than one.</p>
      <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="option-chip option-chip-card" onClick={() => choose("past", "full", "past")}>
          <span className="option-chip-title">Past</span>
          <span className="option-chip-description">Something or someone that shaped me</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("present", "full", "present")}>
          <span className="option-chip-title">Present</span>
          <span className="option-chip-description">What matters in my life now</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("future", "full", "future")}>
          <span className="option-chip-title">Future</span>
          <span className="option-chip-description">Who I am becoming or what I am building</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("mixed", "full", "mixed")}>
          <span className="option-chip-title">A mixture</span>
          <span className="option-chip-description">More than one part of my story</span>
        </button>
        <button className="option-chip" onClick={() => choose("image", "attraction", null)}>
          An image I've been drawn to — I know what I want, more than why
        </button>
      </div>
      <button
        className="secondary"
        onClick={() => {
          patchProject({ journey_mode: "expert", user_viewpoint: null, viewpoint_applied: false });
          patchUI({ viewpointSelected: true });
        }}
      >
        I know what I want — skip to the design
      </button>
    </div>
  );
}

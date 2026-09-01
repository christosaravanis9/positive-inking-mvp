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
      <h2>Where does this tattoo come from?</h2>
      <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="option-chip" onClick={() => choose("past", "full", "past")}>
          Past — something or someone that shaped me
        </button>
        <button className="option-chip" onClick={() => choose("present", "full", "present")}>
          Present — what matters in my life now
        </button>
        <button className="option-chip" onClick={() => choose("future", "full", "future")}>
          Future — who I am becoming or what I am building
        </button>
        <button className="option-chip" onClick={() => choose("mixed", "full", "mixed")}>
          A mixture of these
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

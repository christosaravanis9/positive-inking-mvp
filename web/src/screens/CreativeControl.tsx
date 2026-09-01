import { useJourney } from "../journey/JourneyProvider";
import type { CreativeControl as CreativeControlValue } from "@positive-inking/engine";

/** Screen 8 (§8). Asked before scale capture (§8's ordering rationale). */
export function CreativeControl() {
  const { state, patchProject, patchUI } = useJourney();

  function choose(value: CreativeControlValue, artistFreedom: string) {
    patchProject({ creative_control: value, artist_freedom: artistFreedom });
    patchUI({
      creativeControlSet: true,
      // §12.4: the literacy bonus only applies when the user asked for MORE
      // control, never less -- approximate that here as "did not skip
      // discovery" (expert mode skipped it).
      userIsTattooLiterate: state.ui.userIsTattooLiterate,
    });
  }

  return (
    <div className="screen">
      <h2>Who should shape the final design?</h2>
      <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="option-chip" onClick={() => choose("client_led", "prescriptive brief")}>
          I want to direct it closely
        </button>
        <button className="option-chip" onClick={() => choose("collaborative", "priorities with open decisions")}>
          I want to develop it with the artist
        </button>
        <button className="option-chip" onClick={() => choose("artist_led", "meaning and non-negotiables, visual freedom")}>
          I want the artist to interpret the direction
        </button>
        <button className="option-chip" onClick={() => choose("surrendered", "meaning provided, control surrendered")}>
          I want to provide the meaning and then surrender control
        </button>
      </div>
    </div>
  );
}

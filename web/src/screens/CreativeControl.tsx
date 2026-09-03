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
      <p className="screen-eyebrow">Authorship</p>
      <h2 className="screen-heading">Who should shape the final design?</h2>
      <p className="supporting">This changes how prescriptive the final Artist Brief should be.</p>
      <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="option-chip option-chip-card" onClick={() => choose("client_led", "prescriptive brief")}>
          <span className="option-chip-title">I want to direct it closely</span>
          <span className="option-chip-description">The brief should retain my decisions</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("collaborative", "priorities with open decisions")}>
          <span className="option-chip-title">I want to develop it with the artist</span>
          <span className="option-chip-description">Priorities stay fixed; solutions remain open</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("artist_led", "meaning and non-negotiables, visual freedom")}>
          <span className="option-chip-title">I want the artist to interpret the direction</span>
          <span className="option-chip-description">Meaning is fixed; composition stays flexible</span>
        </button>
        <button className="option-chip option-chip-card" onClick={() => choose("surrendered", "meaning provided, control surrendered")}>
          <span className="option-chip-title">I want to provide the meaning and then surrender control</span>
          <span className="option-chip-description">Receiving the interpretation is part of the meaning</span>
        </button>
      </div>
    </div>
  );
}

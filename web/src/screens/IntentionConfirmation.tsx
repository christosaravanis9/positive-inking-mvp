import { useJourney } from "../journey/JourneyProvider";

/** Screen 6 (§8, full mode). The complete statement stays visible beside Continue/Edit -- no detached verification question (§6). */
export function IntentionConfirmation() {
  const { state, patchUI } = useJourney();

  return (
    <div className="screen">
      <p className="screen-eyebrow">Your intention</p>
      <h2 className="screen-heading">Statement of Inspiration</h2>
      <p className="supporting">Worth remembering for when someone asks why you got it.</p>
      <div className="reflection-box">{state.project.statement_of_intention}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => patchUI({ intentionConfirmed: true })}>Continue</button>
        <button className="secondary" onClick={() => patchUI({ themesSelected: false })}>
          Edit this
        </button>
      </div>
    </div>
  );
}

import { useJourney } from "../journey/JourneyProvider";

/**
 * Screen 1 (§8). No account creation, no method explanation, no AI mention.
 * The 18+ checkbox (privacy notice's "Age" section) lives here inline --
 * not a separate screen or step, no ID collected, just self-certification.
 */
export function Welcome() {
  const { state, patchUI } = useJourney();
  return (
    <div className="screen">
      <p className="screen-eyebrow">Your story, made visible</p>
      <h1 className="screen-heading">Discover the tattoo already inside your experience.</h1>
      <p className="supporting">
        You do not need to know what you want yet. Start with what matters, and Positive Inking will help turn it
        into a clear tattoo direction.
      </p>
      <label className="reference-attestation">
        <input type="checkbox" checked={state.ui.ageConfirmed} onChange={(e) => patchUI({ ageConfirmed: e.target.checked })} />
        I confirm I am 18 or older.
      </label>
      <button onClick={() => patchUI({ pastWelcome: true })} disabled={!state.ui.ageConfirmed}>
        Discover my tattoo
      </button>
      <p className="supporting">Around 5 minutes · No account required</p>
      <p className="supporting">
        <a href="/methodology.html">How this works</a> · <a href="/faq.html">FAQ</a>
      </p>
    </div>
  );
}

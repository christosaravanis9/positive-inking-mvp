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
      {/*
        2026-09-15, live-requested: real beta testers finished the whole
        journey expecting something other than a written document and felt
        let down at the very end. This doesn't need a bigger fix (an actual
        generated image is a real, separate, much larger undertaking) --
        just saying plainly, up front, what the payoff actually is, so
        nobody discovers it as a surprise 5 minutes in.
      */}
      <p className="supporting">
        What you'll get: a written creative brief for your artist -- not a finished picture -- with everything
        confirmed here laid out clearly for the two of you to work from.
      </p>
      <label className="reference-attestation">
        <input type="checkbox" checked={state.ui.ageConfirmed} onChange={(e) => patchUI({ ageConfirmed: e.target.checked })} />
        I confirm I am 18 or older.
      </label>
      {/* 2026-09 UX audit: the privacy notice existed as a doc (privacy.html,
          served statically) but had no link anywhere in the live app -- not
          even here, next to the one consent checkbox on this screen. Kept
          outside the <label> above so clicking it doesn't also toggle the
          checkbox via label/input association. */}
      <p className="reference-note">
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
          Privacy notice
        </a>
      </p>
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

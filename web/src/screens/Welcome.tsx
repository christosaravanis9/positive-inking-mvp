import { useJourney } from "../journey/JourneyProvider";

/** Screen 1 (§8). No account creation, no method explanation, no AI mention. */
export function Welcome() {
  const { patchUI } = useJourney();
  return (
    <div className="screen">
      <p className="screen-eyebrow">Your story, made visible</p>
      <h1 className="screen-heading">Discover the tattoo already inside your experience.</h1>
      <p className="supporting">
        You do not need to know what you want yet. Start with what matters, and Positive Inking will help turn it
        into a clear tattoo direction.
      </p>
      <button onClick={() => patchUI({ pastWelcome: true })}>Discover my tattoo</button>
      <p className="supporting">Around 5 minutes · No account required</p>
    </div>
  );
}

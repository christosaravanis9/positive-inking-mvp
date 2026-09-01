import { useJourney } from "../journey/JourneyProvider";

/** Screen 1 (§8). No account creation, no method explanation, no AI mention. */
export function Welcome() {
  const { patchUI } = useJourney();
  return (
    <div className="screen">
      <h1>Discover a tattoo idea that actually means something to you.</h1>
      <p className="supporting">You do not need to know what you want yet. Start with what matters.</p>
      <button onClick={() => patchUI({ pastWelcome: true })}>Discover my tattoo</button>
    </div>
  );
}

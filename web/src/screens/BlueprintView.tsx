import { useJourney } from "../journey/JourneyProvider";

/** The Blueprint (§17). Basic rendering for Phase 4 -- Phase 6 adds save/copy/refine and full formatting polish. */
export function BlueprintView() {
  const { state, reset } = useJourney();
  const blueprint = state.ui.blueprint;
  if (!blueprint) return null;

  return (
    <div className="screen">
      <h1>Your Positive Inking Blueprint</h1>
      <span className="badge">{blueprint.readiness.replace(/_/g, " ")}</span>

      {blueprint.story && (
        <section>
          <h3>Your story</h3>
          <p>{blueprint.story}</p>
        </section>
      )}
      {blueprint.why_this_image && (
        <section>
          <h3>Why this image</h3>
          <p>{blueprint.why_this_image}</p>
        </section>
      )}
      {blueprint.why && (
        <section>
          <h3>Your Why</h3>
          <p>{blueprint.why}</p>
        </section>
      )}
      {blueprint.what_matters_most && (
        <section>
          <h3>What matters most</h3>
          <p>{blueprint.what_matters_most}</p>
        </section>
      )}
      <section>
        <h3>Visual hierarchy</h3>
        <p>{blueprint.visual_direction}</p>
      </section>
      <section>
        <h3>Artistic direction</h3>
        <p>{blueprint.artistic_direction}</p>
      </section>
      <section>
        <h3>Placement and scale</h3>
        <p>{blueprint.placement}</p>
      </section>
      {blueprint.design_considerations.length > 0 && (
        <section>
          <h3>Design considerations</h3>
          <ul>
            {blueprint.design_considerations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}
      {blueprint.statement_of_inspiration && (
        <section>
          <h3>Statement of inspiration</h3>
          <p>{blueprint.statement_of_inspiration}</p>
        </section>
      )}
      <section>
        <h3>Artist Brief</h3>
        <p>{blueprint.artist_brief}</p>
      </section>

      <button className="secondary" onClick={reset}>
        Start a new project
      </button>
    </div>
  );
}

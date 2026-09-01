import { buildWorkingNotes } from "@positive-inking/engine";
import { useJourney } from "../journey/JourneyProvider";
import { describeCreativeControl } from "../journey/creativeControlLabels";

/** §16.4 -- honest degradation. Never labelled Blueprint, never invented content, entirely local (no model call). */
export function WorkingNotesView() {
  const { state, reset } = useJourney();
  const { project } = state;

  const notes = buildWorkingNotes({
    raw_story: project.raw_story || project.attraction_origin,
    elements: project.visual_elements.map((e) => e.description),
    body_area_coarse: project.body_area || project.body_area_coarse,
    size_class: project.size_class,
    avoid_list: project.avoid_list,
    avoid_list_status: project.avoid_list_status,
    creative_control: project.creative_control,
  });

  return (
    <div className="screen">
      <h1>{notes.label}</h1>
      <span className="badge">{notes.readiness.replace(/_/g, " ")}</span>
      <p className="supporting">{notes.note}</p>

      <section>
        <h3>Your story, in your own words</h3>
        <p>{notes.story_verbatim}</p>
      </section>
      {notes.elements.length > 0 && (
        <section>
          <h3>Elements you listed</h3>
          <ul>
            {notes.elements.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>Placement</h3>
        <p>{notes.placement || "Not specified"}</p>
      </section>
      <section>
        <h3>Creative control</h3>
        <p>{notes.creative_control ? describeCreativeControl(notes.creative_control) : "Not specified"}</p>
      </section>
      <section>
        <h3>Avoid</h3>
        <p>{notes.avoid_list.length > 0 ? notes.avoid_list.join(", ") : notes.avoid_list_status.replace(/_/g, " ")}</p>
      </section>

      <button onClick={reset}>Start again</button>
    </div>
  );
}

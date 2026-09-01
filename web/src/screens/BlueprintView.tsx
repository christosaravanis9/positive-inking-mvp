import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";

const READINESS_LABEL: Record<string, string> = {
  blueprint_ready: "Artist-ready",
  references_needed: "Waiting for references",
  concept_visual_ready: "Concept-ready",
  artist_consultation_recommended: "Recommend an artist consultation",
  needs_refinement: "Needs refinement",
};

/** Builds the plain-text version used by Copy and Save (§4). */
function formatBlueprintAsText(project: ReturnType<typeof useJourney>["state"]["project"], blueprint: NonNullable<ReturnType<typeof useJourney>["state"]["ui"]["blueprint"]>): string {
  const lines: string[] = ["Your Positive Inking Blueprint", ""];
  const section = (title: string, body: string | null | undefined) => {
    if (!body) return;
    lines.push(title, body, "");
  };

  section(blueprint.story ? "Your story" : "Why this image", blueprint.story ?? blueprint.why_this_image);
  section("Your Why", blueprint.why);
  section("What matters most", blueprint.what_matters_most);
  section(
    "Visual hierarchy",
    [
      blueprint.visual_direction,
      "",
      ...project.visual_elements.map((e) => `- ${e.description} (${e.hierarchy}) -- ${e.personal_meaning}`),
    ].join("\n"),
  );
  section("Artistic direction", blueprint.artistic_direction);
  section("Placement and scale", blueprint.placement);
  if (blueprint.design_considerations.length > 0) {
    section("Design considerations", blueprint.design_considerations.map((c) => `- ${c}`).join("\n"));
  }
  section("Statement of inspiration", blueprint.statement_of_inspiration);
  section("Artist Brief", blueprint.artist_brief);
  section("Readiness", READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness);

  return lines.join("\n").trim();
}

/** The Blueprint (§17). Numbered per §17.1's section order; §17.5's avoidance reporting distinction; save/copy/refine (§4). */
export function BlueprintView() {
  const journey = useJourney();
  const { state, patchUI, reset } = journey;
  const { project } = state;
  const blueprint = state.ui.blueprint;
  const [copied, setCopied] = useState(false);

  if (!blueprint) return null;

  const text = formatBlueprintAsText(project, blueprint);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable -- fail visibly rather than pretending it worked.
      setCopied(false);
      window.prompt("Copy failed automatically. Copy the text below manually:", text);
    }
  }

  function save() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "positive-inking-blueprint.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function refine() {
    // Returns to Screen 13 with every confirmed answer intact -- nothing here discards data.
    patchUI({ blueprintReady: false, designConfirmed: false });
  }

  const referencedElements = project.visual_elements.filter((e) => e.reference_required || e.fidelity === "exact");

  return (
    <div className="screen">
      <h1>Your Positive Inking Blueprint</h1>
      <span className="badge">{READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness}</span>

      {(blueprint.story || blueprint.why_this_image) && (
        <section>
          <h3>{blueprint.story ? "1. Your story" : "1. Why this image"}</h3>
          <p>{blueprint.story ?? blueprint.why_this_image}</p>
        </section>
      )}
      {blueprint.why && (
        <section>
          <h3>2. Your Why</h3>
          <p>{blueprint.why}</p>
        </section>
      )}
      {blueprint.what_matters_most && (
        <section>
          <h3>3. What matters most</h3>
          <p>{blueprint.what_matters_most}</p>
          {project.confirmed_themes.length > 0 && <p className="supporting">Themes: {project.confirmed_themes.join(", ")}</p>}
        </section>
      )}
      <section>
        <h3>4. Visual hierarchy</h3>
        <p>{blueprint.visual_direction}</p>
        {project.visual_elements.length > 0 && (
          <ul>
            {project.visual_elements.map((e) => (
              <li key={e.id}>
                <strong>{e.description}</strong> <span className="recommendation-tag">{e.hierarchy}</span> — {e.personal_meaning}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>5-6. Composition and artistic direction</h3>
        <p>{blueprint.artistic_direction}</p>
        {project.composition_background === "none" && <p className="supporting">No background — isolated design.</p>}
        {project.fidelity_treatment && (
          <p>
            <strong>Fidelity treatment (verbatim):</strong> {project.fidelity_treatment}
          </p>
        )}
      </section>
      <section>
        <h3>7. Placement and scale</h3>
        <p>{blueprint.placement}</p>
      </section>
      {referencedElements.length > 0 && (
        <section>
          <h3>8. Personal references</h3>
          <ul>
            {referencedElements.map((e) => (
              <li key={e.id}>
                {e.description} — <span className="recommendation-tag">{e.reference_status.replace(/_/g, " ")}</span> (fidelity: {e.fidelity})
              </li>
            ))}
          </ul>
        </section>
      )}
      {blueprint.design_considerations.length > 0 && (
        <section>
          <h3>9. Design considerations</h3>
          <ul>
            {blueprint.design_considerations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}
      {blueprint.statement_of_inspiration && (
        <section>
          <h3>10. Statement of inspiration</h3>
          <p>{blueprint.statement_of_inspiration}</p>
        </section>
      )}
      <section>
        <h3>11. Artist Brief</h3>
        <p>{blueprint.artist_brief}</p>
      </section>
      <section>
        <h3>Avoid</h3>
        {/* §17.5: distinguish declined from unasked -- asked_answered lists exclusions,
            asked_declined states the client had none, not_asked omits entirely. */}
        {project.avoid_list_status === "asked_answered" && <p>{project.avoid_list.join(", ") || "—"}</p>}
        {project.avoid_list_status === "asked_declined" && <p>The client was asked and had no specific exclusions.</p>}
      </section>
      <section>
        <h3>12. Readiness</h3>
        <p>{READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness}</p>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        <button onClick={save}>Save as text</button>
        <button className="secondary" onClick={refine}>
          Refine
        </button>
        <button className="secondary" onClick={reset}>
          Start a new project
        </button>
      </div>
    </div>
  );
}

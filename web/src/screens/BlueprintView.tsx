import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { formatPlacementSummary } from "../journey/placementSummary";
import { HIERARCHY_LABEL, REFERENCE_STATUS_LABEL, visualElementSentence, groupVisualElementsForHierarchySection } from "../journey/blueprintSummary";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import {
  buildReferenceChecklist,
  isReferenceEntrySatisfied,
  hasUnresolvedPrimaryImagery,
  describeReadinessReason,
  type ReferenceChecklistEntry,
  type ReadinessState,
  type ProjectState,
  type VisualElement,
} from "@positive-inking/engine";

const READINESS_LABEL: Record<string, string> = {
  blueprint_ready: "Artist-ready",
  references_needed: "Waiting for references",
  concept_visual_ready: "Concept-ready",
  artist_consultation_recommended: "Recommend an artist consultation",
  needs_refinement: "Needs refinement",
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  self: "the client's own material",
  living_other: "another living person's material",
  child: "a child's material",
  deceased: "material belonging to someone who has passed",
  unknown: "relationship not specified",
};

/** §15.2: attestation only ever applies to a living third party, a child, or someone deceased -- "unknown" and "self" never needed it, so the line should not imply they're missing something that was never required. */
function requiresAttestation(subjectRelationship: ReferenceChecklistEntry["subject_relationship"]): boolean {
  return subjectRelationship === "living_other" || subjectRelationship === "child" || subjectRelationship === "deceased";
}

/** §17.1 section 8: "each with provenance and attestation status." Never uses the word "consent" for the deceased case (§15.5). */
function referenceProvenanceLine(entry: ReferenceChecklistEntry): string {
  const relationship = RELATIONSHIP_LABEL[entry.subject_relationship ?? "unknown"] ?? "relationship not specified";
  if (!requiresAttestation(entry.subject_relationship)) return relationship;
  const attestation = entry.attestation_given
    ? entry.subject_relationship === "deceased"
      ? "the client has confirmed they are the right person to make this decision"
      : "attested by the client"
    : "no attestation recorded yet";
  return `${relationship} — ${attestation}`;
}

/** One element's line within Section 4's Personal reference / Other elements groups (§17.1's decision-map restructure) -- shared so both groups render identically. */
function ElementLine({ element }: { element: VisualElement }) {
  const { description, roleLabel, meaning } = visualElementSentence(element);
  return (
    <li>
      <strong>{description}</strong>
      {roleLabel && <span className="recommendation-tag">{roleLabel}</span>}
      {meaning && <> — {meaning}</>}
    </li>
  );
}

/**
 * Same three signals computeReadiness itself was given (the server route
 * computes the state deterministically; this reuses the client-side
 * originals of those signals -- the reference checklist already built for
 * section 8, hasUnresolvedPrimaryImagery, and the Association Engine's own
 * contradictions_noticed -- to explain *why*, without inventing a new
 * signal or reading the model-written Design considerations prose).
 */
function readinessReasons(project: ProjectState, readiness: ReadinessState): string[] {
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const missingReferenceDescriptions = checklist
    .filter((entry) => (entry.requirement === "required" || entry.requirement === "strongly_recommended") && !isReferenceEntrySatisfied(entry))
    .map((entry) => entry.description);
  return describeReadinessReason({
    readiness,
    missingReferenceDescriptions,
    hasUnresolvedPrimaryImagery: hasUnresolvedPrimaryImagery(project.visual_elements),
    otherContradictions: project.contradictions,
  });
}

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
  const elementLine = (e: VisualElement) => {
    const { description, roleLabel, meaning } = visualElementSentence(e);
    const role = roleLabel ? ` (${roleLabel})` : "";
    const meaningPart = meaning ? ` -- ${meaning}` : "";
    return `- ${description}${role}${meaningPart}`;
  };
  const hierarchyGroups = groupVisualElementsForHierarchySection(project.visual_elements);
  section(
    "Visual hierarchy",
    [
      `Core concept: ${blueprint.visual_direction}`,
      hierarchyGroups.personal.length > 0 ? ["", "Personal reference:", ...hierarchyGroups.personal.map(elementLine)].join("\n") : "",
      hierarchyGroups.other.length > 0 ? ["", "Other elements:", ...hierarchyGroups.other.map(elementLine)].join("\n") : "",
      hierarchyGroups.stillUndecided.length > 0
        ? ["", "Still undecided:", ...hierarchyGroups.stillUndecided.map(elementLine)].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  section("Artistic direction", blueprint.artistic_direction);
  section("Placement and scale", [blueprint.placement, `Captured details: ${formatPlacementSummary(project)}`].filter(Boolean).join("\n\n"));
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  if (checklist.length > 0) {
    section(
      "Personal references",
      checklist
        .map((entry) => {
          const satisfied = isReferenceEntrySatisfied(entry);
          const flag = entry.copyright_flag
            ? ` [copyright: ${entry.flag_resolution === "switched_to_inspired_by" ? "used as inspiration only" : "noted as direct reference"}]`
            : "";
          return `- ${entry.description}: ${REFERENCE_STATUS_LABEL[entry.status]}${satisfied ? "" : " (MISSING -- " + entry.requirement.replace(/_/g, " ") + ")"} — ${referenceProvenanceLine(entry)}${flag}`;
        })
        .join("\n"),
    );
  }
  if (blueprint.design_considerations.length > 0) {
    section("Design considerations", blueprint.design_considerations.map((c) => `- ${c}`).join("\n"));
  }
  section("Statement of inspiration", blueprint.statement_of_inspiration);
  section("Artist Brief", blueprint.artist_brief);
  if (project.artist_notes.length > 0) {
    section("Further ideas the client raised (unspecified, for the artist to discuss)", project.artist_notes.map((n) => `- ${n}`).join("\n"));
  }
  const reasons = readinessReasons(project, blueprint.readiness);
  section("Readiness", [READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness, ...reasons].join("\n"));

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
      logTelemetryEvent("blueprint_copied", project.project_id, {});
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
    logTelemetryEvent("blueprint_saved", project.project_id, {});
  }

  function refine() {
    // Returns to Screen 13 with every confirmed answer intact -- nothing here discards data.
    patchUI({ blueprintReady: false, designConfirmed: false });
  }

  const referenceChecklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const hierarchyGroups = groupVisualElementsForHierarchySection(project.visual_elements);

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
        <p>
          <strong>Core concept:</strong> {blueprint.visual_direction}
        </p>
        {hierarchyGroups.personal.length > 0 && (
          <>
            <p className="supporting">
              <strong>Personal reference:</strong>
            </p>
            <ul>{hierarchyGroups.personal.map((e) => <ElementLine key={e.id} element={e} />)}</ul>
          </>
        )}
        {hierarchyGroups.other.length > 0 && (
          <>
            <p className="supporting">
              <strong>Other elements:</strong>
            </p>
            <ul>{hierarchyGroups.other.map((e) => <ElementLine key={e.id} element={e} />)}</ul>
          </>
        )}
        {hierarchyGroups.stillUndecided.length > 0 && (
          <>
            <p className="supporting">
              <strong>Still undecided:</strong>
            </p>
            <ul>{hierarchyGroups.stillUndecided.map((e) => <ElementLine key={e.id} element={e} />)}</ul>
          </>
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
        {/* §8 Screen 12 capture, always shown deterministically so it can never drift from or be dropped by the model's prose above. */}
        <p className="supporting">Captured details: {formatPlacementSummary(project) || "—"}</p>
      </section>
      {referenceChecklist.length > 0 && (
        <section>
          <h3>8. Personal references</h3>
          <ul>
            {referenceChecklist.map((entry) => {
              const satisfied = isReferenceEntrySatisfied(entry);
              return (
                <li key={entry.element_id}>
                  <strong>{entry.description}</strong> —{" "}
                  <span className="recommendation-tag">{REFERENCE_STATUS_LABEL[entry.status]}</span>
                  {!satisfied && (
                    <span className="recommendation-tag" style={{ borderColor: "var(--error-fg)", color: "var(--error-fg)" }}>
                      missing — {entry.requirement.replace(/_/g, " ")}
                    </span>
                  )}
                  <br />
                  <span className="supporting">{referenceProvenanceLine(entry)}</span>
                  {entry.copyright_flag && (
                    <>
                      <br />
                      <span className="supporting">
                        Copyright: {entry.flag_resolution === "switched_to_inspired_by" ? "used as inspiration only, not a direct copy" : "noted as a direct reference for the artist to discuss"}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
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
      {project.artist_notes.length > 0 && (
        <section>
          {/* §17.1, §14: ideas beyond the iteration/time bound reach the artist, explicitly marked unspecified -- never silently lost. */}
          <h3>Further ideas the client raised</h3>
          <p className="supporting">Not developed into the specification above -- unspecified, for the artist to discuss.</p>
          <ul>
            {project.artist_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}
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
        {readinessReasons(project, blueprint.readiness).map((reason, i) => (
          <p key={i} className="supporting">
            {reason}
          </p>
        ))}
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

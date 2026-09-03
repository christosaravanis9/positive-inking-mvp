import { Fragment, useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { formatPlacementSummary } from "../journey/placementSummary";
import {
  HIERARCHY_LABEL,
  REFERENCE_STATUS_LABEL,
  visualElementSentence,
  groupVisualElementsForHierarchySection,
  describeComposition,
  conceptSpecificDecisions,
} from "../journey/blueprintSummary";
import {
  READINESS_COMPONENT_LABEL,
  buildReadinessComponentInputs,
  readinessComponentDetail,
  readinessComponentStatusText,
} from "../journey/readinessComponentLabels";
import { logTelemetryEvent } from "../instrumentation/telemetry";
import {
  buildReferenceChecklist,
  isReferenceEntrySatisfied,
  describeReadinessComponents,
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

/** One element's line within Section 04's Personal reference / Other elements groups (§17.1's decision-map restructure) -- shared so both groups render identically. */
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
 * The same signals computeReadiness itself was given (the server route
 * computes the overall state deterministically; this reuses the client-side
 * originals of those signals -- the reference checklist already built for
 * section 10, hasUnresolvedPrimaryImagery, and the Association Engine's own
 * contradictions_noticed) to classify each of the five Readiness components
 * (Sites migration spec §12), without inventing a new signal or reading the
 * model-written Design considerations prose.
 */
function readinessComponents(project: ProjectState, readiness: ReadinessState) {
  return describeReadinessComponents(buildReadinessComponentInputs(project, readiness));
}

/** Builds the plain-text version used by Copy and Save (§4). Section order/numbering mirrors the on-screen render below -- see its own comment for the full spec-to-app section mapping. */
function formatBlueprintAsText(project: ReturnType<typeof useJourney>["state"]["project"], blueprint: NonNullable<ReturnType<typeof useJourney>["state"]["ui"]["blueprint"]>): string {
  const lines: string[] = ["Your Positive Inking Blueprint", ""];
  const section = (title: string, body: string | null | undefined) => {
    if (!body) return;
    lines.push(title, body, "");
  };

  section(blueprint.story ? "01 — Your story" : "01 — Why this image", blueprint.story ?? blueprint.why_this_image);
  section(
    "02 — Your intention",
    [blueprint.why, blueprint.what_matters_most, project.confirmed_themes.length > 0 ? `Themes: ${project.confirmed_themes.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n\n"),
  );
  section("03 — The design you're imagining", blueprint.visual_direction);
  const elementLine = (e: VisualElement) => {
    const { description, roleLabel, meaning } = visualElementSentence(e);
    const role = roleLabel ? ` (${roleLabel})` : "";
    const meaningPart = meaning ? ` -- ${meaning}` : "";
    return `- ${description}${role}${meaningPart}`;
  };
  const hierarchyGroups = groupVisualElementsForHierarchySection(project.visual_elements);
  section(
    "04 — Confirmed visual subjects",
    [
      hierarchyGroups.personal.length > 0 ? ["Personal reference:", ...hierarchyGroups.personal.map(elementLine)].join("\n") : "",
      hierarchyGroups.other.length > 0 ? ["Other elements:", ...hierarchyGroups.other.map(elementLine)].join("\n") : "",
      hierarchyGroups.stillUndecided.length > 0 ? ["Still undecided:", ...hierarchyGroups.stillUndecided.map(elementLine)].join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  section("05 — Composition and arrangement", describeComposition(project));
  const decisions = conceptSpecificDecisions(project);
  section(
    "06 — Concept-specific decisions",
    [...decisions.map((d) => `- ${d.question} ${d.answer}`), project.fidelity_treatment ? `- Reproduction fidelity: ${project.fidelity_treatment}` : ""]
      .filter(Boolean)
      .join("\n"),
  );
  section("07 — Artistic treatment", blueprint.artistic_direction);
  section("08 — Placement and body flow", [blueprint.placement, `Captured details: ${formatPlacementSummary(project)}`].filter(Boolean).join("\n\n"));
  section(
    "09 — Essential safeguards",
    project.avoid_list_status === "asked_answered"
      ? project.avoid_list.join(", ") || "—"
      : project.avoid_list_status === "asked_declined"
        ? "The client was asked and had no specific exclusions."
        : "No additional exclusions were confirmed.",
  );
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const referencesBody = [
    checklist.length > 0
      ? checklist
          .map((entry) => {
            const satisfied = isReferenceEntrySatisfied(entry);
            const flag = entry.copyright_flag
              ? ` [copyright: ${entry.flag_resolution === "switched_to_inspired_by" ? "used as inspiration only" : "noted as direct reference"}]`
              : "";
            return `- ${entry.description}: ${REFERENCE_STATUS_LABEL[entry.status]}${satisfied ? "" : " (MISSING -- " + entry.requirement.replace(/_/g, " ") + ")"} — ${referenceProvenanceLine(entry)}${flag}`;
          })
          .join("\n")
      : "No personal references are required for this concept.",
    blueprint.design_considerations.length > 0 ? ["", "Open decisions:", ...blueprint.design_considerations.map((c) => `- ${c}`)].join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
  section("10 — References and open decisions", referencesBody);
  section("11 — Artist Brief", blueprint.artist_brief);
  if (project.artist_notes.length > 0) {
    section("Further ideas the client raised (unspecified, for the artist to discuss)", project.artist_notes.map((n) => `- ${n}`).join("\n"));
  }
  const componentLines = readinessComponents(project, blueprint.readiness).map((c) => {
    const detail = readinessComponentDetail(c, project);
    const status = readinessComponentStatusText(c);
    return `${READINESS_COMPONENT_LABEL[c.id]}: ${status}${detail.length > 0 ? ` — ${detail.join(" ")}` : ""}`;
  });
  section("12 — Readiness", [READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness, "", ...componentLines].join("\n"));

  return lines.join("\n").trim();
}

/**
 * The Blueprint (§17). Section order/numbering follows the Sites migration spec's §7
 * twelve-section information architecture as closely as this app's real, already-collected
 * data model allows -- never inventing a field this app doesn't actually have. Two places
 * where the mapping isn't 1:1, by design, not oversight:
 * - Spec's 05/06/07 (Composition / Concept-specific decisions / Artistic treatment) are three
 *   separate deterministic templates in Sites; here, 05 and 06 are newly-built deterministic
 *   fact sections (describeComposition/conceptSpecificDecisions, reusing the same label-function
 *   discipline as visualElementSentence), while 07 stays this app's own free-written
 *   `artistic_direction` paragraph -- the Blueprint Writer schema has one combined field for
 *   composition+treatment prose, not two, so there's nothing to split there. This mirrors how
 *   Sites' own 06 and 07 already both describe the same underlying dimension answers in two
 *   different forms (raw list vs. synthesized sentence) -- not a duplication bug, the spec's own
 *   designed redundancy.
 * - "Further ideas the client raised" (project.artist_notes, §14's new-idea loop) has no spec
 *   equivalent at all -- real data this app collects that Sites' 12-section model doesn't
 *   account for, kept as its own unnumbered section rather than force-fit into "References and
 *   open decisions" (10), which stays about referenced material and confirmed open decisions.
 * Section 12 (Readiness) is unchanged from the componentized-readiness work (a separate,
 * already-completed migration piece) -- only its position (last) and heading style are new here.
 */
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

  /**
   * Spec §7's "Blueprint and print presentation" footer action. This app had no print/PDF
   * export at all before this task (only the plain-text Copy/Save above) -- window.print()
   * plus the @media print rules in styles.css are additive, not a change to an existing
   * mechanism's core logic; the browser's own "Save as PDF" destination in the print dialog
   * is what fulfils "or save" without a new dependency.
   */
  function print() {
    logTelemetryEvent("blueprint_print_opened", project.project_id, {});
    window.print();
  }

  function refine() {
    // Returns to Screen 13 with every confirmed answer intact -- nothing here discards data.
    patchUI({ blueprintReady: false, designConfirmed: false });
  }

  const referenceChecklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const hierarchyGroups = groupVisualElementsForHierarchySection(project.visual_elements);
  const decisions = conceptSpecificDecisions(project);

  return (
    <div className="screen sites-tokens blueprint-sheet">
      <header className="blueprint-header">
        <p className="screen-eyebrow">Your complete direction</p>
        <h1 className="screen-heading">Your Positive Inking Blueprint</h1>
        <span className="badge">{READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness}</span>
      </header>

      {(blueprint.story || blueprint.why_this_image) && (
        <section className="blueprint-section">
          <span className="blueprint-section-number">01</span>
          <h3 className="blueprint-section-heading">{blueprint.story ? "Your story" : "Why this image"}</h3>
          <p>{blueprint.story ?? blueprint.why_this_image}</p>
        </section>
      )}
      {(blueprint.why || blueprint.what_matters_most) && (
        <section className="blueprint-section">
          <span className="blueprint-section-number">02</span>
          <h3 className="blueprint-section-heading">Your intention</h3>
          {blueprint.why && <p>{blueprint.why}</p>}
          {blueprint.what_matters_most && <p>{blueprint.what_matters_most}</p>}
          {project.confirmed_themes.length > 0 && (
            <div className="theme-chips">
              {project.confirmed_themes.map((t) => (
                <span key={t} className="theme-chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
      {blueprint.visual_direction && (
        <section className="blueprint-section">
          <span className="blueprint-section-number">03</span>
          <h3 className="blueprint-section-heading">The design you're imagining</h3>
          <p>{blueprint.visual_direction}</p>
        </section>
      )}
      <section className="blueprint-section">
        <span className="blueprint-section-number">04</span>
        <h3 className="blueprint-section-heading">Confirmed visual subjects</h3>
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
      <section className="blueprint-section">
        <span className="blueprint-section-number">05</span>
        <h3 className="blueprint-section-heading">Composition and arrangement</h3>
        <p>{describeComposition(project)}.</p>
      </section>
      {(decisions.length > 0 || project.fidelity_treatment) && (
        <section className="blueprint-section">
          <span className="blueprint-section-number">06</span>
          <h3 className="blueprint-section-heading">Concept-specific decisions</h3>
          <ul>
            {decisions.map((d) => (
              <li key={d.key}>
                <strong>{d.question}</strong> {d.answer}
              </li>
            ))}
            {project.fidelity_treatment && (
              <li>
                <strong>Reproduction fidelity</strong> {project.fidelity_treatment}
              </li>
            )}
          </ul>
        </section>
      )}
      <section className="blueprint-section">
        <span className="blueprint-section-number">07</span>
        <h3 className="blueprint-section-heading">Artistic treatment</h3>
        <p>{blueprint.artistic_direction}</p>
      </section>
      <section className="blueprint-section">
        <span className="blueprint-section-number">08</span>
        <h3 className="blueprint-section-heading">Placement and body flow</h3>
        <p>{blueprint.placement}</p>
        {/* §8 Screen 12 capture, always shown deterministically so it can never drift from or be dropped by the model's prose above. */}
        <p className="supporting">Captured details: {formatPlacementSummary(project) || "—"}</p>
      </section>
      <section className="blueprint-section">
        <span className="blueprint-section-number">09</span>
        <h3 className="blueprint-section-heading">Essential safeguards</h3>
        {/* §17.5: distinguish declined from unasked -- asked_answered lists exclusions,
            asked_declined states the client had none, not_asked gets the spec's own §7
            fallback line rather than being left visibly empty. */}
        {project.avoid_list_status === "asked_answered" && <p>{project.avoid_list.join(", ") || "—"}</p>}
        {project.avoid_list_status === "asked_declined" && <p>The client was asked and had no specific exclusions.</p>}
        {project.avoid_list_status === "not_asked" && <p className="supporting">No additional exclusions were confirmed.</p>}
      </section>
      <section className="blueprint-section">
        <span className="blueprint-section-number">10</span>
        <h3 className="blueprint-section-heading">References and open decisions</h3>
        {referenceChecklist.length > 0 ? (
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
        ) : (
          <p className="supporting">No personal references are required for this concept.</p>
        )}
        {blueprint.design_considerations.length > 0 && (
          <>
            <p className="supporting" style={{ marginTop: 10 }}>
              <strong>Open decisions:</strong>
            </p>
            <ul>
              {blueprint.design_considerations.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="blueprint-section">
        <span className="blueprint-section-number">11</span>
        <h3 className="blueprint-section-heading">Artist Brief</h3>
        <p>{blueprint.artist_brief}</p>
      </section>
      {project.artist_notes.length > 0 && (
        <section className="blueprint-section">
          {/* §17.1, §14: ideas beyond the iteration/time bound reach the artist, explicitly marked unspecified -- never silently lost. No spec §7 slot exists for this -- see the component's own doc comment. */}
          <h3 className="blueprint-section-heading">Further ideas the client raised</h3>
          <p className="supporting">Not developed into the specification above -- unspecified, for the artist to discuss.</p>
          <ul>
            {project.artist_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="blueprint-section">
        <span className="blueprint-section-number">12</span>
        <h3 className="blueprint-section-heading">Readiness</h3>
        <p>{READINESS_LABEL[blueprint.readiness] ?? blueprint.readiness}</p>
        <dl className="summary-list">
          {readinessComponents(project, blueprint.readiness).map((c) => {
            const detail = readinessComponentDetail(c, project);
            return (
              <Fragment key={c.id}>
                <dt>{READINESS_COMPONENT_LABEL[c.id]}</dt>
                <dd>
                  {readinessComponentStatusText(c)}
                  {detail.length > 0 && (
                    <>
                      {" — "}
                      {detail.join(" ")}
                    </>
                  )}
                </dd>
              </Fragment>
            );
          })}
        </dl>
      </section>

      <div className="blueprint-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        <button onClick={save}>Save as text</button>
        <button onClick={print}>Print or save Blueprint</button>
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

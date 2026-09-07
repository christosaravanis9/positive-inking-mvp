import { useState } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { useAsyncAction } from "../journey/useAsyncAction";
import { requestBlueprint } from "../api/blueprint";
import { AsyncError } from "../components/AsyncError";
import { ModelWaitIndicator } from "../components/ModelWaitIndicator";
import { ReferenceAttachment, emptyReferenceDraft, type ReferenceDraft } from "../components/ReferenceAttachment";
import { NEEDS_REFERENCE, statusFromDraft, draftToConsentRecord, draftFromExisting } from "../journey/referenceDraft";
import { formatPlacementSummary } from "../journey/placementSummary";
import { labelForDimensionValue } from "../journey/artisticDimensionLabels";
import { describeCreativeControl } from "../journey/creativeControlLabels";
import { buildConfirmedProjectSummary } from "../journey/blueprintSummary";
import { buildReadinessComponentInputs, readinessComponentDetail } from "../journey/readinessComponentLabels";
import { logTelemetryEvent, elapsedSinceJourneyStarted } from "../instrumentation/telemetry";
import { reportJourneyCompleted } from "../instrumentation/analytics";
import type { ElementFidelity, VisualElement } from "@positive-inking/engine";
import {
  buildReferenceChecklist,
  isReferenceEntrySatisfied,
  anyRequiredReferenceMissing,
  hasUnresolvedPrimaryImagery,
  describeReadinessComponents,
  fidelityTreatmentRequired,
  FIDELITY_TREATMENT_OPTIONS,
} from "@positive-inking/engine";

/**
 * Same four ElementFidelity values Screen 7's old per-candidate control used
 * (2026-09-07 redesign) -- Keep/Build upon already capture the two coarse
 * tiers (closely_based_on/interpretive respectively) as a default; this
 * dropdown is where that gets refined to the actual meaningful distinction
 * left to make per element, reusing the same values so nothing is asked
 * twice under a different name.
 */
const FIDELITY_DROPDOWN_OPTIONS: { value: ElementFidelity; label: string }[] = [
  { value: "exact", label: "Exactly as-is (needs a reference)" },
  { value: "closely_based_on", label: "Closely based on this (needs a reference)" },
  { value: "interpretive", label: "Interpreted by the artist" },
  { value: "open", label: "Open — artist's call" },
];

/** Screen 13 (§8). The complete summary stays on screen next to the action -- no detached verification (§6, AC 64). "Still needed: [references]" is the spec's own Screen 13 bullet (§8). */
export function DesignConfirmation() {
  const { state, patchProject, patchUI } = useJourney();
  const { run, pending } = useAsyncAction();
  const { project } = state;
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const outstanding = checklist.filter((entry) => !isReferenceEntrySatisfied(entry));
  const placementSummary = formatPlacementSummary(project);
  // "Open decisions" (below) is specifically the Visual direction component
  // of the Blueprint's own five-component Readiness section (Sites migration
  // spec §12/§4.2) -- built from the exact same describeReadinessComponents
  // call, with readiness: null since no Blueprint exists yet here, so the
  // two screens can never drift into different readiness models or
  // different wording for the same status. ("Still needed" above is a
  // separate, pre-existing §8 bullet, not one of the five components.)
  const visualDirectionComponent = describeReadinessComponents(buildReadinessComponentInputs(project, null)).find((c) => c.id === "visual_direction")!;

  // Screen 7's redesign (2026-09-07) moved fidelity refinement + reference
  // collection here, per candidate -- only Association-sourced elements
  // (Keep/Build upon) ever went through that coarse-default control;
  // user-authored ideas ("This has given me another idea...") already
  // picked their own fidelity + reference back on Screen 7 and are
  // deliberately left out of this list.
  const candidateElements = project.visual_elements.filter((e) => e.id.startsWith("candidate-"));

  const [referenceDraftByElement, setReferenceDraftByElement] = useState<Record<string, ReferenceDraft>>(() => {
    const map: Record<string, ReferenceDraft> = {};
    candidateElements.forEach((e) => {
      const draft = draftFromExisting(e.id, state);
      if (draft) map[e.id] = draft;
    });
    return map;
  });

  function updateElementFidelity(element: VisualElement, fidelity: ElementFidelity) {
    const draft = referenceDraftByElement[element.id];
    const newElements = project.visual_elements.map((e) =>
      e.id === element.id
        ? { ...e, fidelity, reference_required: NEEDS_REFERENCE.has(fidelity), reference_status: statusFromDraft(fidelity, e.source_category, draft) }
        : e,
    );
    patchProject({ visual_elements: newElements });
  }

  function handleReferenceChange(element: VisualElement, next: ReferenceDraft) {
    setReferenceDraftByElement((prev) => ({ ...prev, [element.id]: next }));
    const otherRecords = project.consent_records.filter((r) => r.reference_id !== element.id);
    const record = draftToConsentRecord(element.id, next);
    const nextReferenceAssets = { ...state.ui.referenceAssets };
    if (next.dataUrl && next.fileName) {
      nextReferenceAssets[element.id] = { dataUrl: next.dataUrl, fileName: next.fileName };
      logTelemetryEvent("reference_requested", project.project_id, { material_type: next.material_type });
    } else {
      delete nextReferenceAssets[element.id];
    }
    const newElements = project.visual_elements.map((e) =>
      e.id === element.id ? { ...e, reference_status: statusFromDraft(element.fidelity, e.source_category, next) } : e,
    );
    patchProject({ visual_elements: newElements, consent_records: record ? [...otherRecords, record] : otherRecords });
    patchUI({ referenceAssets: nextReferenceAssets });
  }

  // Sequencing-bug fix (2026-09-07, Part 1's finding): screenFlow.ts runs
  // Screen 11 (artistic_direction, where fidelity_treatment is normally
  // asked) BEFORE this screen, so an element that only becomes "exact"
  // fidelity here -- because that refinement now happens on this screen,
  // not Screen 7 -- would otherwise reach the Blueprint with the treatment
  // question never asked at all. Re-running the exact same check here,
  // against the current (possibly just-changed) visual_elements, closes
  // that gap without touching Screen 11's own copy of it.
  const hasExactFidelityElement = project.visual_elements.some((e) => e.fidelity === "exact");
  const needsFidelityTreatment = fidelityTreatmentRequired(hasExactFidelityElement, "handwriting") && !project.fidelity_treatment;

  function build() {
    void run(async (guard) => {
      const summary = buildConfirmedProjectSummary(project, outstanding);

      const blueprint = await requestBlueprint({
        journey_mode: project.journey_mode,
        significance_claimed: project.significance_claimed,
        themes_surfaced: project.confirmed_themes.length > 0,
        statement_user_authored: false,
        interpretation_confidence: project.interpretation_confidence,
        any_required_reference_missing: anyRequiredReferenceMissing(checklist),
        has_unresolved_contradiction: project.contradictions.length > 0 || hasUnresolvedPrimaryImagery(project.visual_elements),
        confirmed_project_summary: summary,
      });
      if (guard.isStale()) return;

      patchUI({ blueprint, blueprintReady: true, designConfirmed: true });
      // §22: completion-rate numerator + time-by-mode (local-only, per-project debugging log).
      const elapsedMs = elapsedSinceJourneyStarted(project.project_id);
      logTelemetryEvent("journey_completed", project.project_id, { journey_mode: project.journey_mode, elapsed_ms: elapsedMs });
      // Anonymous usage analytics (privacy notice) -- the same already-computed, non-identifying
      // elapsed_ms value, sent server-side so completion rate can be reviewed in aggregate.
      if (elapsedMs !== null) reportJourneyCompleted(project.journey_mode, elapsedMs);
    }, "Building your Blueprint");
  }

  return (
    <div className="screen">
      <p className="screen-eyebrow">Complete direction</p>
      <h2 className="screen-heading">Ready to build your Blueprint</h2>
      <p className="supporting">Everything being confirmed remains visible here. Continue or go back to change it.</p>
      <dl className="summary-list">
        <dt>Main subject</dt>
        <dd>{project.visual_elements.find((e) => e.hierarchy === "primary")?.description ?? project.visual_elements[0]?.description ?? "—"}</dd>
        <dt>Supporting details</dt>
        <dd>{project.visual_elements.slice(1).map((e) => e.description).join(", ") || "—"}</dd>
        <dt>Composition</dt>
        <dd>
          {project.composition_type || "—"}
          {project.composition_background === "none" && " (no background)"}
        </dd>
        <dt>Treatment</dt>
        <dd>
          {[
            project.colour_strategy && labelForDimensionValue("colour", project.colour_strategy),
            project.realism_level && labelForDimensionValue("realism", project.realism_level),
            project.visual_presence && labelForDimensionValue("visual_presence", project.visual_presence),
          ]
            .filter(Boolean)
            .join(", ") || "—"}
        </dd>
        <dt>Placement</dt>
        <dd>{placementSummary || "—"}</dd>
        <dt>Creative control</dt>
        <dd>{project.creative_control ? describeCreativeControl(project.creative_control) : "—"}</dd>
        <dt>Avoid</dt>
        <dd>{project.avoid_list_status === "asked_answered" ? project.avoid_list.join(", ") || "none listed" : "not specified"}</dd>
        <dt>Still needed</dt>
        <dd>
          {outstanding.length === 0
            ? "Nothing outstanding"
            : outstanding.map((o) => `${o.description} — ${o.status.replace(/_/g, " ")}${o.requirement === "required" ? " (required)" : ""}`).join("; ")}
        </dd>
        <dt>Open decisions</dt>
        <dd>
          {visualDirectionComponent.status === "open_decisions"
            ? readinessComponentDetail(visualDirectionComponent, project).join(" ")
            : "None noted"}
        </dd>
      </dl>

      {candidateElements.length > 0 && (
        <div>
          <p className="supporting">How faithfully should each kept element be executed?</p>
          <div className="ledger-list">
            {candidateElements.map((element) => (
              <div key={element.id} className="ledger-candidate selected">
                <div className="ledger-candidate-body">
                  <strong>{element.description}</strong>
                </div>
                <label className="reference-field">
                  <span>Fidelity</span>
                  <select value={element.fidelity} onChange={(e) => updateElementFidelity(element, e.target.value as ElementFidelity)}>
                    {FIDELITY_DROPDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {NEEDS_REFERENCE.has(element.fidelity) && (
                  <ReferenceAttachment
                    value={referenceDraftByElement[element.id] ?? emptyReferenceDraft()}
                    onChange={(next) => handleReferenceChange(element, next)}
                    elementDescription={element.description}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {needsFidelityTreatment && (
        <div className="reference-attachment">
          <p style={{ margin: 0 }}>How faithful should the reproduction be?</p>
          <p className="reference-note">
            This applies regardless of how much creative control you've handed over — accuracy on an exact piece
            isn't an artistic preference (§12.8).
          </p>
          <div className="option-grid" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {FIDELITY_TREATMENT_OPTIONS.map((option) => (
              <button key={option} type="button" className="option-chip" onClick={() => patchProject({ fidelity_treatment: option })}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* §13.4: the Blueprint may be complete while exact design references remain outstanding -- this is informational, never a hard block. */}
      {outstanding.length > 0 && (
        <div className="error-banner" style={{ borderColor: "var(--border)", background: "rgba(128,128,128,0.06)", color: "var(--fg)" }}>
          Some references aren't finished yet. You can still build the Blueprint — it will note what's outstanding — or go back and add them now.
          <div style={{ marginTop: 8 }}>
            <button className="secondary" onClick={() => patchUI({ elementsDiscovered: false })}>
              Add references
            </button>
          </div>
        </div>
      )}
      <AsyncError onRetry={build} />
      {pending && <ModelWaitIndicator label="Building your Blueprint..." />}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={build} disabled={pending || needsFidelityTreatment}>
          {pending ? "Working..." : "Build my Blueprint"}
        </button>
        <button className="secondary" onClick={() => patchUI({ placementDone: false })} disabled={pending}>
          Change something
        </button>
      </div>
    </div>
  );
}

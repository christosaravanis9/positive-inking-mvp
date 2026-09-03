import {
  buildReferenceChecklist,
  hasUnresolvedPrimaryImagery,
  isReferenceEntrySatisfied,
  type ProjectState,
  type ReadinessComponent,
  type ReadinessComponentId,
  type ReadinessComponentInputs,
  type ReadinessState,
} from "@positive-inking/engine";
import { describeCreativeControl } from "./creativeControlLabels";

/**
 * Human-facing label for each of the five readiness components (Sites
 * migration spec §4.2/§12) -- the fixed row names, shared by both the
 * Blueprint's Readiness section and Screen 13's relevant rows so the two
 * never diverge into different wording for the same component.
 */
export const READINESS_COMPONENT_LABEL: Record<ReadinessComponentId, string> = {
  meaning: "Meaning",
  visual_direction: "Visual direction",
  references: "References",
  artist_discussion: "Artist discussion",
  final_artwork: "Final artwork",
};

/**
 * Human-facing text for each possible status, keyed by the engine's own
 * enum values -- one lookup per component's status union, matching the
 * codebase's existing pattern (READINESS_LABEL, CREATIVE_CONTROL_LABEL,
 * REFERENCE_STATUS_LABEL) of never letting a raw stored enum leak into
 * displayed copy.
 */
const STATUS_TEXT: Record<ReadinessComponent["status"], string> = {
  confirmed: "Confirmed",
  not_yet_captured: "Not yet captured",
  clear: "Clear",
  open_decisions: "Clear, with decisions still to resolve",
  not_required: "None required for this concept",
  available: "Available to provide",
  still_needed: "Still needed",
  ready: "Ready",
  not_yet_begun_brief_ready: "Not yet begun — this Blueprint is ready to hand to an artist.",
  not_yet_begun_pending_items: "Not yet begun — some of the above needs resolving first.",
};

export function readinessComponentStatusText(component: ReadinessComponent): string {
  return STATUS_TEXT[component.status] ?? component.status;
}

/**
 * The component's own detail lines (missing reference names, contradiction
 * text) plus, for "artist_discussion" specifically, the actual chosen
 * authorship style -- the engine only knows creative_control was *set*, not
 * *what* it was set to, so that one contextual line is composed here rather
 * than invented in the engine.
 */
export function readinessComponentDetail(component: ReadinessComponent, project: ProjectState): string[] {
  if (component.id === "artist_discussion" && component.status === "ready" && project.creative_control) {
    return [describeCreativeControl(project.creative_control)];
  }
  return component.detail;
}

/**
 * Assembles describeReadinessComponents' inputs from a ProjectState -- the
 * one place the reference checklist gets built and the meaning/creative-
 * control fields get read for this purpose, so Screen 13 and the Blueprint
 * can never compute these five components from subtly different logic.
 * `readiness` is null pre-Blueprint (Screen 13) -- see describeReadinessComponents'
 * own doc comment for why that's what limits it to four relevant components there.
 */
export function buildReadinessComponentInputs(project: ProjectState, readiness: ReadinessState | null): ReadinessComponentInputs {
  const checklist = buildReferenceChecklist(project.visual_elements, project.consent_records);
  const relevantEntries = checklist.filter((entry) => entry.requirement === "required" || entry.requirement === "strongly_recommended");
  const missingReferenceDescriptions = relevantEntries.filter((entry) => !isReferenceEntrySatisfied(entry)).map((entry) => entry.description);

  return {
    meaningCaptured: Boolean((project.journey_mode === "full" ? project.statement_of_intention : project.attraction_origin).trim()),
    hasUnresolvedPrimaryImagery: hasUnresolvedPrimaryImagery(project.visual_elements),
    otherContradictions: project.contradictions,
    referenceRequirementExists: relevantEntries.length > 0,
    missingReferenceDescriptions,
    creativeControlSet: project.creative_control !== "",
    readiness,
  };
}

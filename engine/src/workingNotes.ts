/**
 * §16.3–16.4 — the manual/degraded path. Deliberately not a form clone of
 * the guided journey: it collects only what the user can supply unaided,
 * and builds Working Notes with no network call and no model involvement
 * at all. The output type has no field for interpretation, themes, core
 * values, visual hierarchy or artistic direction — there is nowhere for a
 * caller to accidentally put generated content, which is how AC 57 is
 * enforced structurally rather than by convention.
 */

import type { AvoidListStatus, CreativeControl } from "./types.js";

export interface WorkingNotesInput {
  raw_story: string;
  /** Elements exactly as the user listed them -- no model-derived hierarchy, meaning, or fidelity. */
  elements: string[];
  body_area_coarse: string;
  size_class: string;
  avoid_list: string[];
  avoid_list_status: AvoidListStatus;
  creative_control: CreativeControl | "";
}

export interface WorkingNotes {
  label: "Working Notes";
  story_verbatim: string;
  elements: string[];
  placement: string;
  avoid_list: string[];
  avoid_list_status: AvoidListStatus;
  creative_control: CreativeControl | "";
  note: string;
  readiness: "needs_refinement";
}

export function buildWorkingNotes(input: WorkingNotesInput): WorkingNotes {
  return {
    label: "Working Notes",
    story_verbatim: input.raw_story,
    elements: [...input.elements],
    placement: [input.body_area_coarse, input.size_class].filter(Boolean).join(", "),
    avoid_list: [...input.avoid_list],
    avoid_list_status: input.avoid_list_status,
    creative_control: input.creative_control,
    note:
      "Meaning and visual direction were not developed for this project. This is the client's own material, organised — not a reduced Blueprint.",
    readiness: "needs_refinement",
  };
}

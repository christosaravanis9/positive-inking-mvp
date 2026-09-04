import type { ProjectState } from "@positive-inking/engine";
import { labelForDimensionValue } from "./artisticDimensionLabels";
import type { UIState } from "./state";

/**
 * The "What we've understood" side panel (Sites migration spec §2). Every
 * row is derived here from real, already-existing ProjectState fields --
 * nothing here is invented state, and nothing here re-derives a value some
 * screen doesn't already compute for its own purposes.
 *
 * §2.2's table gives eight fields; this app's real data model only
 * genuinely supports seven of them. "Emerging vision" (Sites' free-text
 * "design taking shape in your mind" field, shown after a "has this
 * sparked a design idea?" question) has no equivalent anywhere in this
 * app's ProjectState -- Screen 7 here has no such question, and no field
 * stores that kind of text. Per §2.3's own instruction ("for a more
 * complete hardened version, add fields only as an explicit product
 * change; do not describe those additions as behavior inherited from
 * Sites"), that row is omitted rather than invented.
 *
 * Several fields also update at a different moment than §2.2 describes,
 * because the *source screen* itself already buffers the answer in local
 * component state until Continue is clicked (Story's textarea, Screen 7's
 * candidate checkboxes, MeaningReflection's theme chips, Placement's
 * fields) rather than patching global project state on every keystroke/
 * toggle the way Sites' own implementation does. Changing that buffering
 * to make this panel more "live" would mean editing those screens' own
 * state management -- explicitly out of scope ("Do NOT modify the core
 * logic of any screen... this only reads existing state, it doesn't
 * change how that state is produced"). So each row here becomes visible
 * at whatever point the source screen's own existing patchProject call
 * already fires -- Continue for those four, but genuinely live (matching
 * §2.2 exactly) for Viewpoint, Composition, and Treatment, whose source
 * screens already patch project state on every individual selection.
 */

const VIEWPOINT_LABEL: Record<string, string> = {
  past: "Past",
  present: "Present",
  future: "Future",
  mixed: "A mixture",
  image: "An image I've been drawn to",
};

/** §2.2: "If length is greater than 105 JavaScript characters: first 105 characters plus '…'. No semantic summary and no word-boundary handling." */
const TRUNCATE_LENGTH = 105;
function truncate(text: string): string {
  return text.length > TRUNCATE_LENGTH ? `${text.slice(0, TRUNCATE_LENGTH)}…` : text;
}

export interface UnderstandingRow {
  id: string;
  label: string;
  value: string;
  /**
   * The exact ui-state patch that sends the journey back to this row's
   * single source screen, reusing the very same "flip the gating flag back
   * to false" mechanism every existing Back/Edit affordance already uses
   * (IntentionConfirmation's "Edit this", DesignConfirmation's "Add
   * references"/"Change something") -- no new navigation system, no new
   * state-invalidation logic. Undefined when a row's value can be produced
   * by more than one screen within the same journey (Treatment) or when the
   * one screen that produced it has no reliable way back to a state that
   * could actually let the client revise it (Meaning in attraction/expert
   * mode, see below) -- per the row-derivation module's own convention,
   * nothing here is invented, only omitted.
   */
  editUiPatch?: Partial<UIState>;
}

/** §2.2's row order: Viewpoint, Story, Meaning, Visual material, [Emerging vision -- omitted, see module comment], Composition, Treatment, Placement. Rows with an empty value are omitted entirely (§2.1). */
export function deriveUnderstandingRows(project: ProjectState): UnderstandingRow[] {
  const rows: UnderstandingRow[] = [];
  // Screens 3-6 (Story, MeaningReflection) exist only in "full" mode; attraction/expert
  // mode uses Screen 3A/3B (ImageDescription, ImageProvenance) instead for the same data
  // (§7's "all modes converge at Screen 7" -- everything before that still branches by mode).
  const isFullMode = project.journey_mode === "full";

  if (project.user_viewpoint) {
    // Viewpoint.tsx is the one screen in every journey mode that ever sets user_viewpoint.
    rows.push({
      id: "viewpoint",
      label: "Viewpoint",
      value: VIEWPOINT_LABEL[project.user_viewpoint] ?? project.user_viewpoint,
      editUiPatch: { viewpointSelected: false },
    });
  }

  if (project.raw_story.trim()) {
    rows.push({
      id: "story",
      label: "Story",
      value: truncate(project.raw_story),
      editUiPatch: isFullMode ? { discoveryCompleted: false } : { imageDescribed: false },
    });
  }

  if (project.confirmed_themes.length > 0) {
    rows.push({
      id: "meaning",
      label: "Meaning",
      value: project.confirmed_themes.join(" · "),
      // Full mode: MeaningReflection.tsx is the single, always-reachable source.
      // Attraction/expert mode: confirmed_themes can only have come from
      // ImageProvenance's one-time optional re-entry offer (§8/§10) -- once resolved,
      // reentryOffered stays permanently true and the offer is never shown again, so
      // there is no existing navigation path back to a screen state that could
      // actually let the client revise this value. Left non-clickable rather than
      // sending them to a screen that can't reproduce it.
      editUiPatch: isFullMode ? { themesSelected: false } : undefined,
    });
  }

  if (project.visual_elements.length > 0) {
    // All journey modes converge on Screen 7 (ElementsDiscovery.tsx) for this (§7).
    rows.push({
      id: "visual_material",
      label: "Visual material",
      value: project.visual_elements.map((e) => e.description).join(" · "),
      editUiPatch: { elementsDiscovered: false },
    });
  }

  if (project.composition_type.trim()) {
    const value = project.composition_background === "none" ? `${project.composition_type} (no background)` : project.composition_type;
    rows.push({ id: "composition", label: "Composition", value, editUiPatch: { compositionFlowDone: false } });
  }

  const treatment = [
    project.realism_level && labelForDimensionValue("realism", project.realism_level),
    project.linework_weight && labelForDimensionValue("linework", project.linework_weight),
    project.shading_method && labelForDimensionValue("shading", project.shading_method),
    project.colour_strategy && labelForDimensionValue("colour", project.colour_strategy),
  ].filter(Boolean);
  if (treatment.length > 0) {
    // No editUiPatch: each of these four fields can independently arrive from either
    // StyleReference.tsx (auto-resolved from a named style/medium/artist) or
    // ArtisticDirection.tsx (asked directly, for whichever dimensions StyleReference
    // left open) -- which fields came from which screen varies per journey, so there
    // is no single source screen to send an edit click to.
    rows.push({ id: "treatment", label: "Treatment", value: treatment.join(" · ") });
  }

  const placement = [
    project.side,
    project.body_area || project.body_area_coarse,
    project.size_class && labelForSizeClass(project.size_class),
  ].filter(Boolean);
  if (placement.length > 0) {
    // Placement.tsx (Screen 12) owns side/body_area/dimensions; size_class/
    // body_area_coarse (the fallback when body_area is still blank) come from
    // RoughScale.tsx (Screen 9) earlier in the flow. Routed to Placement.tsx as this
    // row's dominant, most-complete source -- editing there covers most of what's
    // shown; size_class itself stays reachable from RoughScale.tsx directly if needed.
    rows.push({ id: "placement", label: "Placement", value: placement.join(" · "), editUiPatch: { placementDone: false } });
  }

  return rows;
}

const SIZE_CLASS_LABEL: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  sleeve_or_panel: "Sleeve or panel",
};

function labelForSizeClass(value: string): string {
  return SIZE_CLASS_LABEL[value] ?? value;
}

/** §2.1: shown before any answer exists (i.e. no rows yet). */
export const UNDERSTANDING_PANEL_EMPTY_COPY = "Your direction will build here as you move through the experience.";

/** §2.1: the desktop panel's exact closing copy -- not shown in the mobile <details> implementation. */
export const UNDERSTANDING_PANEL_FOOTER_COPY = "Nothing here is fixed. Use Back or Edit whenever the direction stops feeling accurate.";

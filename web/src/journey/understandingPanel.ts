import type { ProjectState } from "@positive-inking/engine";
import { labelForDimensionValue } from "./artisticDimensionLabels";

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
}

/** §2.2's row order: Viewpoint, Story, Meaning, Visual material, [Emerging vision -- omitted, see module comment], Composition, Treatment, Placement. Rows with an empty value are omitted entirely (§2.1). */
export function deriveUnderstandingRows(project: ProjectState): UnderstandingRow[] {
  const rows: UnderstandingRow[] = [];

  if (project.user_viewpoint) {
    rows.push({ id: "viewpoint", label: "Viewpoint", value: VIEWPOINT_LABEL[project.user_viewpoint] ?? project.user_viewpoint });
  }

  if (project.raw_story.trim()) {
    rows.push({ id: "story", label: "Story", value: truncate(project.raw_story) });
  }

  if (project.confirmed_themes.length > 0) {
    rows.push({ id: "meaning", label: "Meaning", value: project.confirmed_themes.join(" · ") });
  }

  if (project.visual_elements.length > 0) {
    rows.push({ id: "visual_material", label: "Visual material", value: project.visual_elements.map((e) => e.description).join(" · ") });
  }

  if (project.composition_type.trim()) {
    const value = project.composition_background === "none" ? `${project.composition_type} (no background)` : project.composition_type;
    rows.push({ id: "composition", label: "Composition", value });
  }

  const treatment = [
    project.realism_level && labelForDimensionValue("realism", project.realism_level),
    project.linework_weight && labelForDimensionValue("linework", project.linework_weight),
    project.shading_method && labelForDimensionValue("shading", project.shading_method),
    project.colour_strategy && labelForDimensionValue("colour", project.colour_strategy),
  ].filter(Boolean);
  if (treatment.length > 0) {
    rows.push({ id: "treatment", label: "Treatment", value: treatment.join(" · ") });
  }

  const placement = [
    project.side,
    project.body_area || project.body_area_coarse,
    project.size_class && labelForSizeClass(project.size_class),
  ].filter(Boolean);
  if (placement.length > 0) {
    rows.push({ id: "placement", label: "Placement", value: placement.join(" · ") });
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

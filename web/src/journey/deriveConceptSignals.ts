import { computeConceptSignals, type ConceptSignals } from "@positive-inking/engine";
import type { JourneyState } from "./state";

/** Assembles engine.ConceptSignals from current journey state -- shared by the composition, artistic, and (Phase 5) inspector screens. */
export function deriveConceptSignals(state: JourneyState): ConceptSignals {
  const { project, ui } = state;
  return computeConceptSignals({
    element_count: project.visual_elements.length,
    primary_element_type: ui.primaryElementType,
    has_text_or_handwriting: ui.hasTextOrHandwriting,
    has_likeness: ui.hasLikeness,
    place_role: project.place_role,
    has_exact_fidelity_element: project.visual_elements.some((e) => e.fidelity === "exact"),
    has_colour_signal: Boolean(project.colour_strategy),
    size_class: (project.size_class || "small") as ConceptSignals["size_class"],
    spatial_language_present: ui.spatialLanguagePresent,
    connects_to_other_work: Boolean(project.future_expansion) || project.existing_tattoos.length > 0,
    creative_control: (project.creative_control || "collaborative") as ConceptSignals["creative_control"],
    user_is_tattoo_literate: ui.userIsTattooLiterate,
    text_is_primary: ui.textIsPrimary,
    likeness_is_primary: ui.likenessIsPrimary,
  });
}

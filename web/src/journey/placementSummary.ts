import type { useJourney } from "./JourneyProvider";

const PRIMARY_VIEW_LABEL: Record<string, string> = {
  straight_on: "seen straight on",
  from_the_side: "seen from the side",
  does_not_matter: "viewing angle doesn't matter",
};

/**
 * Full Screen 12 capture, summarised in one place so the on-screen confirmation
 * summary, the model request, and the Blueprint's Placement and scale section
 * never drift apart from each other.
 */
export function formatPlacementSummary(project: ReturnType<typeof useJourney>["state"]["project"]): string {
  const parts = [
    project.body_area || project.body_area_coarse,
    project.side && project.side !== "centred" ? project.side : "",
    project.size_class,
    project.dimensions ? `approx. ${project.dimensions}` : "",
    project.wrap_level ? project.wrap_level.replace(/_/g, " ") : "",
    project.primary_view ? PRIMARY_VIEW_LABEL[project.primary_view] ?? project.primary_view : "",
  ].filter(Boolean);
  if (project.future_expansion) parts.push(`future expansion planned: ${project.future_expansion}`);
  if (project.existing_tattoos.length > 0) parts.push(`connects to: ${project.existing_tattoos.join(", ")}`);
  if (project.placement_reference) parts.push("placement photo provided");
  return parts.join(", ");
}

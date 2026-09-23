import type { ProjectState } from "@positive-inking/engine";

/**
 * The "confirmed meaning or provenance" text every model call that reads
 * the client's established story draws from -- Association
 * (ElementsDiscovery.tsx) and, since 2026-09, the pre-qualifying
 * style-hint call (VisualStylePreference.tsx) that runs right before it
 * against the exact same confirmed data. Extracted from
 * ElementsDiscovery.tsx's own previously-private helper so both screens
 * read it identically rather than risk the two drifting out of sync.
 */
export function confirmedMeaningOrProvenanceText(
  project: Pick<ProjectState, "journey_mode" | "statement_of_intention" | "raw_story" | "attraction_origin">,
): string {
  return project.journey_mode === "full"
    ? project.statement_of_intention
    : [project.raw_story, project.attraction_origin].filter(Boolean).join("\n\n");
}

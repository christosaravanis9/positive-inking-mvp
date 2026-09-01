/**
 * §11 — the Association Engine's hidden ranking dimensions exist to order
 * candidates, not just to be carried along as unused metadata. "Personal
 * relevance, story relevance and originality outweigh generic visual
 * appeal" is implemented here as an explicit weighting, and §3.2's floor
 * rule ("where no personal artefact, person, place, object or memory is
 * available... new_materialisation is promoted to first rank") is enforced
 * by detecting the absence of any personal-category candidate in the set
 * actually returned, and forcing new_materialisation ahead of everything
 * else when that holds.
 *
 * Like suppressGeneratedSymbolicSuggestions, this only ever operates on the
 * Association Engine's own candidate list -- user-authored material from
 * "this has given me another idea..." lives in a structurally separate
 * array in this codebase and is never passed through here, so there is no
 * path by which low confidence (or anything else this function knows about)
 * could downrank it.
 */

export interface RankableCandidate {
  source_category: string;
  personal_relevance: number;
  story_relevance: number;
  visual_potential: number;
  originality: number;
  genericity: number;
  reference_availability: number;
}

const PERSONAL_CATEGORIES: ReadonlySet<string> = new Set([
  "personal_artefact",
  "personal_memory",
  "personal_place",
  "personal_person",
]);

/** The one place "personal vs. generic" is defined for a source_category — reused by instrumentation (§22) so its personal-vs-generic metric can never drift from the floor rule's own definition. */
export function isPersonalSourceCategory(sourceCategory: string): boolean {
  return PERSONAL_CATEGORIES.has(sourceCategory);
}

/** Weights: personal relevance, story relevance and originality dominate; genericity is penalised; raw visual appeal and reference ease matter least. */
const WEIGHTS = {
  personal_relevance: 3,
  story_relevance: 3,
  originality: 2,
  genericity: -2,
  visual_potential: 1,
  reference_availability: 0.5,
} as const;

/** Comfortably larger than any achievable weighted score (max ~85) so the floor rule always wins outright, not just on average. */
const FLOOR_RULE_BOOST = 1000;

function score(candidate: RankableCandidate, floorRuleActive: boolean): number {
  const base =
    candidate.personal_relevance * WEIGHTS.personal_relevance +
    candidate.story_relevance * WEIGHTS.story_relevance +
    candidate.originality * WEIGHTS.originality +
    candidate.genericity * WEIGHTS.genericity +
    candidate.visual_potential * WEIGHTS.visual_potential +
    candidate.reference_availability * WEIGHTS.reference_availability;
  const promoted = floorRuleActive && candidate.source_category === "new_materialisation";
  return promoted ? base + FLOOR_RULE_BOOST : base;
}

/**
 * Returns a new array (input never mutated), sorted highest-ranked first.
 * Ties keep their original relative order (stable sort).
 */
export function rankVisualCandidates<T extends RankableCandidate>(candidates: readonly T[]): T[] {
  const floorRuleActive = !candidates.some((c) => PERSONAL_CATEGORIES.has(c.source_category));
  return candidates
    .map((candidate, index) => ({ candidate, index, s: score(candidate, floorRuleActive) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((entry) => entry.candidate);
}

/**
 * §13.4 readiness input — whether the journey's primary imagery has actually
 * been discovered yet, as distinct from whether design references for it are
 * still outstanding (referenceChecklist.ts's concern). A confirmed element
 * can be "undecided" hierarchy (not yet ranked primary/supporting) and still
 * be the thing the whole Blueprint is about — the Athena Blueprint's two
 * elements were exactly this: hierarchy "undecided", never assigned
 * "accent"/"background", carrying the concept. So both "primary" and
 * "undecided" hierarchy elements count here; only accent/background/
 * supporting elements failing to be concrete does not block readiness on its
 * own — a supporting detail can legitimately stay a recommendation.
 */

import type { VisualElement } from "./types.js";

const IMAGERY_CARRYING_HIERARCHY = new Set(["primary", "undecided"]);

export function hasUnresolvedPrimaryImagery(elements: readonly VisualElement[]): boolean {
  return elements.some(
    (element) => IMAGERY_CARRYING_HIERARCHY.has(element.hierarchy) && element.concreteness === "unresolved_placeholder",
  );
}

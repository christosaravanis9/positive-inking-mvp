/**
 * §13.5 — the lightweight suitability pass at Screen 9. Runs on size_class
 * and element count alone, before any artistic question is asked, and
 * surfaces only blocking-level contradictions.
 *
 * NOTE — calibration gap. V3.0 does not give a numeric threshold for "a
 * detail level or element count that cannot exist at that scale"; §27
 * already flags budget numbers and thresholds generally as reasoned, not
 * empirical. The ceilings below are a first, conservative guess, kept in
 * one place so they are trivial to recalibrate once real journeys are run
 * — see the Phase 7 write-up for whether these held up.
 */

import type { CreativeControl, SizeClass } from "./types.js";

const MAX_ELEMENTS_BY_SIZE: Record<SizeClass, number> = {
  small: 2,
  medium: 4,
  large: 8,
  sleeve_or_panel: Number.POSITIVE_INFINITY,
};

export interface SuitabilityConsideration {
  blocking: boolean;
  reason: string;
  resolutions: string[];
}

export function lightweightSuitabilityCheck(
  sizeClass: SizeClass,
  elementCount: number,
  creativeControl?: CreativeControl,
): SuitabilityConsideration | null {
  const ceiling = MAX_ELEMENTS_BY_SIZE[sizeClass];
  if (elementCount > ceiling) {
    const resolutions = ["Go larger", "Simplify the concept"];
    // §13.2: "leave this for the artist" is offered only where that is genuinely available.
    if (creativeControl === "artist_led" || creativeControl === "surrendered") {
      resolutions.push("Leave the resolution to the artist");
    }
    return {
      blocking: true,
      reason: `${elementCount} elements is unlikely to stay legible at ${sizeClass.replace("_", " ")} scale.`,
      resolutions,
    };
  }
  return null;
}

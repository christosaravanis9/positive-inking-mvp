/**
 * §17.2 — which Blueprint sections apply in attraction/expert mode. This is
 * enforced here, structurally, rather than trusted to prompt instructions:
 * the server route must null out any section this function marks excluded
 * regardless of what the model wrote, so a model mistake can never leak a
 * fabricated Why or Statement of inspiration into an attraction-mode
 * Blueprint (AC 21, Build Brief §7.6). "Omit", not "write a thin version".
 */

import type { JourneyMode } from "./types.js";

export interface BlueprintSectionEligibility {
  storySection: "story" | "why_this_image";
  includeYourWhy: boolean;
  includeWhatMattersMost: boolean;
  includeStatementOfInspiration: boolean;
}

export interface BlueprintSectionInputs {
  journeyMode: JourneyMode;
  significanceClaimed: boolean;
  themesSurfaced: boolean;
  statementUserAuthored: boolean;
}

function isAttractionLike(mode: JourneyMode): boolean {
  return mode === "attraction" || mode === "expert";
}

export function computeBlueprintSectionEligibility(input: BlueprintSectionInputs): BlueprintSectionEligibility {
  const attractionLike = isAttractionLike(input.journeyMode);
  return {
    storySection: attractionLike ? "why_this_image" : "story",
    includeYourWhy: !attractionLike || input.significanceClaimed,
    includeWhatMattersMost: !attractionLike || input.themesSurfaced,
    // Never generated in attraction/expert modes even if the user authored one earlier under full mode (§17.2, §3.6 caveat) --
    // a statement is only ever included when the user themselves wrote it, never model-generated, in these modes.
    includeStatementOfInspiration: !attractionLike || input.statementUserAuthored,
  };
}

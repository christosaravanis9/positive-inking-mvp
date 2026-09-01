/**
 * §9.3 confidence routing, §9.5 response classification, §9.6 the
 * low-confidence correction path. All of this is routing logic over model
 * *output* (confidence scores, a boolean flag) — the interpretation itself
 * is the model's job; deciding what happens next given those numbers is
 * deterministic.
 */

export type DiscoveryRoute =
  | "proceed"
  | "proceed_widen_themes"
  | "route_to_attraction"
  | "clarify"
  | "low_confidence_path";

/**
 * §9.3 table. `clarificationAlreadyUsed` enforces the one-clarification
 * rule structurally: once true, this function can never return "clarify"
 * again, regardless of how low confidence is.
 */
export function routeAfterDiscovery(
  confidence: number,
  visualConfidence: number,
  clarificationAlreadyUsed: boolean,
): DiscoveryRoute {
  if (confidence >= 0.7) return "proceed";
  if (confidence >= 0.4) return "proceed_widen_themes";
  if (visualConfidence >= 0.6) return "route_to_attraction";
  return clarificationAlreadyUsed ? "low_confidence_path" : "clarify";
}

/** §9.5 — classifying the response to the one clarification question. */
export type ClarificationResponseType = "resolving" | "non_resolving" | "skipped" | "off_topic";

export interface ClarificationResponseInput {
  recomputedConfidence: number;
  /** The user selected the explicit "I'm not sure yet" escape. */
  userDeclined: boolean;
  /** The response actually addresses the dimension that was asked about. */
  addressesAskedDimension: boolean;
}

export function classifyClarificationResponse(input: ClarificationResponseInput): ClarificationResponseType {
  if (input.userDeclined) return "skipped";
  if (!input.addressesAskedDimension) return "off_topic";
  return input.recomputedConfidence >= 0.4 ? "resolving" : "non_resolving";
}

/** Only a "resolving" response continues Discovery normally; everything else enters the §9.6 correction interaction — never a second clarification question. */
export function shouldEnterLowConfidencePath(responseType: ClarificationResponseType): boolean {
  return responseType !== "resolving";
}

/** §9.7 — downstream consequences once interpretation_confidence is "low". */
export interface LowConfidenceConsequences {
  reflectionWordRange: [number, number];
  suppressGeneratedArtisticSymbol: true;
  suppressGeneratedTattooReference: true;
  minReadiness: "artist_consultation_recommended";
  canReachBlueprintReady: false;
}

export function lowConfidenceConsequences(): LowConfidenceConsequences {
  return {
    reflectionWordRange: [40, 60],
    suppressGeneratedArtisticSymbol: true,
    suppressGeneratedTattooReference: true,
    minReadiness: "artist_consultation_recommended",
    canReachBlueprintReady: false,
  };
}

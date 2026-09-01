import { postJson } from "./client";
import type { BlueprintData } from "./types";
import { clientTimeoutForRoute, type InterpretationConfidence, type JourneyMode } from "@positive-inking/engine";

export interface BlueprintRequest {
  journey_mode: JourneyMode;
  significance_claimed: boolean;
  themes_surfaced: boolean;
  statement_user_authored: boolean;
  interpretation_confidence: InterpretationConfidence;
  any_required_reference_missing: boolean;
  has_unresolved_contradiction: boolean;
  confirmed_project_summary: string;
}

export async function requestBlueprint(request: BlueprintRequest): Promise<BlueprintData> {
  const result = await postJson<{ data: BlueprintData }>("/api/blueprint", request, clientTimeoutForRoute("blueprint"));
  return result.data;
}

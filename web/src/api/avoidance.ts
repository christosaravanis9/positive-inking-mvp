import { postJson } from "./client";
import type { AvoidanceData } from "./types";
import { clientTimeoutForRoute } from "@positive-inking/engine";

export async function requestAvoidanceSuggestions(projectSummary: string): Promise<AvoidanceData> {
  const result = await postJson<{ data: AvoidanceData }>(
    "/api/avoidances",
    { project_summary: projectSummary },
    clientTimeoutForRoute("avoidance"),
  );
  return result.data;
}

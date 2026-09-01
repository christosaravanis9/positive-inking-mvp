import { postJson } from "./client";
import type { AvoidanceData } from "./types";

export async function requestAvoidanceSuggestions(projectSummary: string): Promise<AvoidanceData> {
  const result = await postJson<{ data: AvoidanceData }>("/api/avoidances", { project_summary: projectSummary });
  return result.data;
}

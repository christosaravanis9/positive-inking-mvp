import { postJson } from "./client";
import type { ProvenanceData } from "./types";

export async function requestProvenance(rawStory: string): Promise<ProvenanceData> {
  const result = await postJson<{ data: ProvenanceData }>("/api/provenance", { raw_story: rawStory });
  return result.data;
}

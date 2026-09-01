import { postJson } from "./client";
import type { ProvenanceData } from "./types";
import { clientTimeoutForRoute } from "@positive-inking/engine";

export async function requestProvenance(rawStory: string): Promise<ProvenanceData> {
  const result = await postJson<{ data: ProvenanceData }>(
    "/api/provenance",
    { raw_story: rawStory },
    clientTimeoutForRoute("provenance"),
  );
  return result.data;
}

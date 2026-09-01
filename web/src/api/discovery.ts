import { postJson } from "./client";
import type { DiscoveryData } from "./types";
import { clientTimeoutForRoute } from "@positive-inking/engine";

export async function requestDiscovery(rawStory: string, userViewpoint?: string): Promise<DiscoveryData> {
  const result = await postJson<{ data: DiscoveryData }>(
    "/api/discovery",
    { raw_story: rawStory, user_viewpoint: userViewpoint },
    clientTimeoutForRoute("discovery"),
  );
  return result.data;
}

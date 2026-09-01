import { postJson } from "./client";
import type { DiscoveryData } from "./types";

export async function requestDiscovery(rawStory: string, userViewpoint?: string): Promise<DiscoveryData> {
  const result = await postJson<{ data: DiscoveryData }>("/api/discovery", {
    raw_story: rawStory,
    user_viewpoint: userViewpoint,
  });
  return result.data;
}

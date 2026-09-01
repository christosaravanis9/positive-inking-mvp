import { postJson } from "./client";
import type { StyleReferenceData } from "./types";
import type { ArtisticDimensionKey } from "@positive-inking/engine";

export async function requestStyleReferenceResolution(
  styleReference: string,
  alreadyConfirmed: Partial<Record<ArtisticDimensionKey, string>>,
): Promise<StyleReferenceData> {
  const result = await postJson<{ data: StyleReferenceData }>("/api/style-reference", {
    style_reference: styleReference,
    already_confirmed: alreadyConfirmed,
  });
  return result.data;
}

import { postJson } from "./client";
import type { AssociationData } from "./types";
import { clientTimeoutForRoute } from "@positive-inking/engine";

export async function requestAssociations(
  confirmedMeaningOrProvenance: string,
  knownPersonalMaterial: string[],
): Promise<AssociationData> {
  const result = await postJson<{ data: AssociationData }>(
    "/api/associations",
    { confirmed_meaning_or_provenance: confirmedMeaningOrProvenance, known_personal_material: knownPersonalMaterial },
    clientTimeoutForRoute("association"),
  );
  return result.data;
}

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

/**
 * The Why-driven per-slot re-roll's real generation call (2026-09-07) --
 * only ever used once the client has typed an actual reason for rejecting a
 * candidate; a plain re-roll with no reason stays on the free client-only
 * reserve-pool swap and never reaches this function. Same endpoint, same
 * full AssociationData response shape (no schema change) -- the caller
 * only ever reads visual_candidates[0].
 */
export async function requestAssociationAlternative(
  confirmedMeaningOrProvenance: string,
  knownPersonalMaterial: string[],
  alreadyShownDescriptions: string[],
  dismissalReason: string,
): Promise<AssociationData> {
  const result = await postJson<{ data: AssociationData }>(
    "/api/associations",
    {
      confirmed_meaning_or_provenance: confirmedMeaningOrProvenance,
      known_personal_material: knownPersonalMaterial,
      avoid_descriptions: alreadyShownDescriptions,
      dismissal_reason: dismissalReason,
    },
    clientTimeoutForRoute("association"),
  );
  return result.data;
}

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
  // 2026-09-09: every reason the client has given for THIS slot so far,
  // this round's `dismissalReason` included as the last entry -- previously
  // only the single latest reason ever reached the model, so three rounds
  // of distinct feedback ("too similar", "no form or life", "metaphorically
  // weak") were each seen in isolation, never as the accumulated shape of
  // what kept being rejected and why. Optional and additive: `dismissalReason`
  // is kept as its own field too, so a caller that only ever rejects once
  // needs no change.
  dismissalReasonHistory?: string[],
): Promise<AssociationData> {
  const result = await postJson<{ data: AssociationData }>(
    "/api/associations",
    {
      confirmed_meaning_or_provenance: confirmedMeaningOrProvenance,
      known_personal_material: knownPersonalMaterial,
      avoid_descriptions: alreadyShownDescriptions,
      dismissal_reason: dismissalReason,
      dismissal_reason_history: dismissalReasonHistory,
    },
    clientTimeoutForRoute("association"),
  );
  return result.data;
}

/**
 * "Build upon"'s direct-edit refinement (2026-09-07, later) -- the client
 * has edited a candidate's own text and wants the model to develop exactly
 * that idea further, not propose something different. A genuinely
 * different ask from requestAssociationAlternative above (that one is
 * "the client rejected this, give me something else"); same endpoint, same
 * full AssociationData response shape, no schema change -- the caller only
 * ever reads visual_candidates[0].
 */
export async function requestAssociationRefinement(
  confirmedMeaningOrProvenance: string,
  knownPersonalMaterial: string[],
  originalDescription: string,
  userEdit: string,
): Promise<AssociationData> {
  const result = await postJson<{ data: AssociationData }>(
    "/api/associations",
    {
      confirmed_meaning_or_provenance: confirmedMeaningOrProvenance,
      known_personal_material: knownPersonalMaterial,
      refine_original_description: originalDescription,
      refine_user_edit: userEdit,
    },
    clientTimeoutForRoute("association"),
  );
  return result.data;
}

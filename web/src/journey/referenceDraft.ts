import type { ElementFidelity, ConsentRecord, ReferenceStatus } from "@positive-inking/engine";
import type { ReferenceDraft } from "../components/ReferenceAttachment";
import type { JourneyState } from "./state";

/**
 * Shared reference/consent-draft helpers, extracted from ElementsDiscovery.tsx
 * (2026-09-07) so DesignConfirmation.tsx (Screen 13) can reuse them without
 * duplicating logic -- Screen 13's per-candidate fidelity dropdown is now
 * where a reference photo actually gets requested/collected; these helpers
 * are what both screens' "fidelity choice -> does this need a reference,
 * and what state is it in" logic is built from.
 */

export const NEEDS_REFERENCE: ReadonlySet<ElementFidelity> = new Set(["exact", "closely_based_on"]);

export function draftToConsentRecord(referenceId: string, draft: ReferenceDraft): ConsentRecord | null {
  if (!draft.material_type && !draft.dataUrl) return null;
  return {
    reference_id: referenceId,
    material_type: draft.material_type ?? "own_material",
    subject_relationship: draft.subject_relationship,
    attestation_given: draft.attestation_given,
    attestation_text: draft.attestation_text,
    attested_at: draft.attestation_given ? new Date().toISOString() : null,
    copyright_flag: draft.copyright_flag,
    flag_resolution: draft.flag_resolution,
  };
}

export function statusFromDraft(fidelity: ElementFidelity, sourceCategory: string, draft: ReferenceDraft | undefined): ReferenceStatus {
  if (!NEEDS_REFERENCE.has(fidelity)) return "not_needed";
  if (draft?.dataUrl) return "available";
  if (sourceCategory === "new_materialisation") return "to_create";
  return "to_upload";
}

/**
 * Rehydrates a ReferenceDraft from already-confirmed project data (a prior
 * consent record + any attached file). Without this, revisiting whichever
 * screen currently owns reference collection would silently discard
 * everything the user already entered -- exactly the kind of "don't make
 * users reconfirm what they just did" failure V3.0 warns against (§5).
 */
export function draftFromExisting(elementId: string, state: JourneyState): ReferenceDraft | undefined {
  const record = state.project.consent_records.find((r) => r.reference_id === elementId);
  const asset = state.ui.referenceAssets[elementId];
  if (!record && !asset) return undefined;
  return {
    dataUrl: asset?.dataUrl ?? null,
    fileName: asset?.fileName ?? null,
    material_type: record?.material_type ?? null,
    subject_relationship: record?.subject_relationship ?? "self",
    attestation_given: record?.attestation_given ?? false,
    attestation_text: record?.attestation_text ?? "",
    copyright_flag: record?.copyright_flag ?? false,
    flag_resolution: record?.flag_resolution ?? null,
    // An existing asset could only have been stored via the upload gate below, so
    // rehydrating it back never needs to be reconfirmed -- consistent with the rest
    // of this function's "don't make users reconfirm what they just did" purpose.
    rights_confirmed: Boolean(asset?.dataUrl),
  };
}

/**
 * §12.9 — fidelity treatment. Asked whenever an exact-fidelity element is
 * handwriting, a signature, or a drawing. Note deliberately: this function
 * takes no creative_control parameter at all. §12.8's exemption ("Fidelity
 * treatment... exempt from budget and from all control-level suppression")
 * is enforced structurally here — there is no input this function could use
 * to suppress itself even if a caller tried.
 */

export type ExactFidelityElementKind = "handwriting" | "signature" | "drawing" | "other";

export function fidelityTreatmentRequired(
  hasExactFidelityElement: boolean,
  elementKind: ExactFidelityElementKind,
): boolean {
  return hasExactFidelityElement && (elementKind === "handwriting" || elementKind === "signature" || elementKind === "drawing");
}

export const FIDELITY_TREATMENT_OPTIONS = [
  "Exactly as written, including any shake, blot or unevenness",
  "Cleaned up slightly while keeping the character",
  "Redrawn in the same hand but tidied",
] as const;

export type FidelityTreatmentOption = (typeof FIDELITY_TREATMENT_OPTIONS)[number];

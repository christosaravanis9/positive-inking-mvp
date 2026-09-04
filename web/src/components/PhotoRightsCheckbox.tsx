/**
 * Privacy notice's "Photographs of other people" section -- previously notice
 * text only (flagged as a gap in the 2026-09-04 data-minimization audit: "this
 * should become an explicit confirmation checkbox at the point of upload, not
 * just notice text"). This is that checkbox, reused unchanged at all 3 upload
 * sites (ReferenceAttachment.tsx, StyleReference.tsx, Placement.tsx) so the
 * wording lives in exactly one place. Each call site disables its own file
 * input while `checked` is false -- this component only renders the checkbox
 * itself, the gating is the caller's responsibility.
 */
export function PhotoRightsCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="reference-attestation">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      I confirm I have the right to use this image, and that any identifiable person in it knows and agrees to it being used
      here.
    </label>
  );
}

import { useRef, useState } from "react";
import type { ConsentRecord } from "@positive-inking/engine";
import { readFileAsSanitizedDataUrl } from "../imageSanitization";

export interface ReferenceDraft {
  dataUrl: string | null;
  fileName: string | null;
  material_type: ConsentRecord["material_type"] | null;
  subject_relationship: ConsentRecord["subject_relationship"];
  attestation_given: boolean;
  attestation_text: string;
  copyright_flag: boolean;
  flag_resolution: ConsentRecord["flag_resolution"];
}

export function emptyReferenceDraft(): ReferenceDraft {
  return {
    dataUrl: null,
    fileName: null,
    material_type: null,
    subject_relationship: "self",
    attestation_given: false,
    attestation_text: "",
    copyright_flag: false,
    flag_resolution: null,
  };
}

/** §15.7: no server-side storage in this build -- capped so a rejected file fails
 * loudly rather than silently truncating or bloating localStorage past its quota. */
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const MATERIAL_TYPES: { value: NonNullable<ConsentRecord["material_type"]>; label: string }[] = [
  { value: "own_material", label: "My own material" },
  { value: "likeness", label: "A photo or likeness of a person" },
  { value: "handwriting", label: "Handwriting" },
  { value: "signature", label: "A signature" },
  { value: "drawing", label: "A drawing" },
  { value: "artwork", label: "An existing artwork by someone else" },
  { value: "tattoo_design", label: "An existing tattoo design to copy" },
];

const RELATIONSHIPS: { value: ConsentRecord["subject_relationship"]; label: string }[] = [
  { value: "self", label: "Me" },
  { value: "living_other", label: "Someone else (living)" },
  { value: "child", label: "A child" },
  { value: "deceased", label: "Someone who has passed" },
  { value: "unknown", label: "Not sure" },
];

/**
 * Inline, at the point of upload -- §15.3: "One checkbox, one line, at the
 * point of upload. Not a modal, not a legal wall, not repeated per screen."
 * Renders only the fields that are actually relevant to what was chosen, in
 * order: attach -> classify -> (attestation | signature note | deceased note
 * | copyright choice, whichever applies).
 */
export function ReferenceAttachment({
  value,
  onChange,
  elementDescription,
}: {
  value: ReferenceDraft;
  onChange: (next: ReferenceDraft) => void;
  elementDescription: string;
}) {
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`That file is too large for this prototype (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB). Try a smaller image.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    readFileAsSanitizedDataUrl(file)
      .then((dataUrl) => onChange({ ...value, dataUrl, fileName: file.name }))
      .catch(() => setFileError("Couldn't read that file. Try again or choose a different one."));
  }

  const needsAttestation =
    value.subject_relationship === "living_other" || value.subject_relationship === "child" || value.subject_relationship === "deceased";
  const isSignature = value.material_type === "signature";
  const isCopyrightable = value.material_type === "artwork" || value.material_type === "tattoo_design";

  return (
    <div className="reference-attachment">
      {value.dataUrl ? (
        <div className="reference-preview">
          <img src={value.dataUrl} alt={value.fileName ?? "attached reference"} />
          <div>
            <div>{value.fileName}</div>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                onChange({ ...value, dataUrl: null, fileName: null });
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => handleFile(e.target.files?.[0])}
            aria-label={`Attach a reference for ${elementDescription}`}
          />
          {fileError && <p className="reference-error">{fileError}</p>}
        </>
      )}

      <label className="reference-field">
        <span>What kind of material is this?</span>
        <select
          value={value.material_type ?? ""}
          onChange={(e) => onChange({ ...value, material_type: (e.target.value || null) as ConsentRecord["material_type"] })}
        >
          <option value="">Choose...</option>
          {MATERIAL_TYPES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="reference-field">
        <span>Whose is it?</span>
        <select
          value={value.subject_relationship}
          onChange={(e) => onChange({ ...value, subject_relationship: e.target.value as ConsentRecord["subject_relationship"] })}
        >
          {RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {isSignature && (
        <p className="reference-note">
          A tattooed signature is a permanent public copy of something used to authorise documents. Worth a thought
          before committing.
        </p>
      )}

      {needsAttestation && value.subject_relationship !== "deceased" && (
        <label className="reference-attestation">
          <input
            type="checkbox"
            checked={value.attestation_given}
            onChange={(e) =>
              onChange({
                ...value,
                attestation_given: e.target.checked,
                attestation_text: `This is ${elementDescription}, and ${value.subject_relationship === "child" ? "their guardian is" : "they are"} happy for it to be used.`,
              })
            }
          />
          This is {elementDescription}, and {value.subject_relationship === "child" ? "their guardian is" : "they are"} happy
          for it to be used.
        </label>
      )}

      {value.subject_relationship === "deceased" && (
        <label className="reference-attestation">
          <input
            type="checkbox"
            checked={value.attestation_given}
            onChange={(e) =>
              onChange({
                ...value,
                attestation_given: e.target.checked,
                attestation_text: `This is a keepsake of someone who has passed, and I'm the right person to make this decision.`,
              })
            }
          />
          This is a keepsake of someone who has passed, and I'm the right person to make this decision.
        </label>
      )}

      {isCopyrightable && (
        <div className="reference-copyright">
          <p>This is a specific existing piece. We can note it as a direct reference for the artist to discuss, or use it as a starting point for something original.</p>
          <div className="option-grid">
            <button
              type="button"
              className={`option-chip${value.flag_resolution === "proceeded" ? " selected" : ""}`}
              onClick={() => onChange({ ...value, copyright_flag: true, flag_resolution: "proceeded" })}
            >
              Note as direct reference
            </button>
            <button
              type="button"
              className={`option-chip${value.flag_resolution === "switched_to_inspired_by" ? " selected" : ""}`}
              onClick={() => onChange({ ...value, copyright_flag: true, flag_resolution: "switched_to_inspired_by" })}
            >
              Use as inspiration only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

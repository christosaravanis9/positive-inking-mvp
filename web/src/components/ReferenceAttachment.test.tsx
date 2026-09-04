import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReferenceAttachment, emptyReferenceDraft, type ReferenceDraft } from "./ReferenceAttachment";

/**
 * Privacy notice's "Photographs of other people" section: an explicit
 * confirmation checkbox at the point of upload, gating that specific upload
 * only -- not the rest of the journey (uploads here are always optional).
 */

function Harness({ initial = emptyReferenceDraft(), onChange }: { initial?: ReferenceDraft; onChange?: (next: ReferenceDraft) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ReferenceAttachment
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      elementDescription="a small compass rose"
    />
  );
}

describe("ReferenceAttachment -- third-party photo rights checkbox", () => {
  it("the file input is disabled until the rights checkbox is checked", () => {
    render(<Harness />);

    const fileInput = screen.getByLabelText("Attach a reference for a small compass rose") as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm I have the right to use this image/ }));
    expect(fileInput.disabled).toBe(false);
  });

  it("checking the box updates rights_confirmed via onChange, independent of any other field", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm I have the right to use this image/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rights_confirmed: true }));
  });

  it("a file selected while unconfirmed never reaches onChange -- belt-and-braces guard behind the disabled input", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const fileInput = screen.getByLabelText("Attach a reference for a small compass rose") as HTMLInputElement;
    const file = new File(["fake image bytes"], "photo.png", { type: "image/png" });
    // Even bypassing the disabled attribute (as a malformed client might), the
    // handler itself refuses to process the file without rights_confirmed.
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not render the checkbox once a file is already attached", () => {
    render(<Harness initial={{ ...emptyReferenceDraft(), dataUrl: "data:image/png;base64,xyz", fileName: "photo.png", rights_confirmed: true }} />);

    expect(screen.queryByRole("checkbox", { name: /I confirm I have the right to use this image/ })).toBeNull();
  });
});

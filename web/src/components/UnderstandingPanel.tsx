import { Fragment } from "react";
import { useJourney } from "../journey/JourneyProvider";
import { deriveUnderstandingRows, UNDERSTANDING_PANEL_EMPTY_COPY, UNDERSTANDING_PANEL_FOOTER_COPY } from "../journey/understandingPanel";

/**
 * The "What we've understood" panel (Sites migration spec §2). Persistent
 * throughout Screens 1-13 (Welcome, the Blueprint, and Working Notes each
 * have their own distinct layout in the spec too -- see Journey.tsx's own
 * exclusion list).
 *
 * Two variants share the same row-derivation logic and are both always
 * rendered in the DOM, toggled by the same 900px breakpoint via CSS (spec
 * §1.3's "Breakpoints" section) rather than a JS media-query listener --
 * simpler, and avoids a hydration/resize edge case entirely:
 * - "rail": the persistent 330px desktop column, includes the footer note.
 * - "details": the collapsed native `<details>` block shown above the
 *   screen content below 900px, titled "What we've understood" per the
 *   spec's own breakpoint wording. Per §2.1, the footer note is NOT
 *   shown here -- only the field summary is.
 */
export function UnderstandingPanel({ variant }: { variant: "rail" | "details" }) {
  const { state, patchUI } = useJourney();
  const rows = deriveUnderstandingRows(state.project);

  const rowList = (
    <dl className="understood-rows">
      {rows.map((row) => {
        const content = (
          <>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </>
        );
        if (!row.editUiPatch) {
          return <Fragment key={row.id}>{content}</Fragment>;
        }
        const goEdit = () => patchUI(row.editUiPatch!);
        return (
          <div
            key={row.id}
            className="understood-row-edit"
            role="button"
            tabIndex={0}
            aria-label={`Edit ${row.label}`}
            onClick={goEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goEdit();
              }
            }}
          >
            {content}
          </div>
        );
      })}
    </dl>
  );

  const body = rows.length === 0 ? <p className="understood-empty">{UNDERSTANDING_PANEL_EMPTY_COPY}</p> : rowList;

  if (variant === "details") {
    return (
      <details className="understood-mobile sites-tokens">
        <summary>What we've understood</summary>
        {body}
      </details>
    );
  }

  return (
    <aside className="understood-rail sites-tokens">
      <h2 className="understood-heading">What we've understood</h2>
      {body}
      <p className="understood-footer">{UNDERSTANDING_PANEL_FOOTER_COPY}</p>
    </aside>
  );
}

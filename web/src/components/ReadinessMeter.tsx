import type { ReadinessComponent } from "@positive-inking/engine";
import { READINESS_COMPONENT_LABEL, readinessComponentLight, readinessComponentStatusText } from "../journey/readinessComponentLabels";

/**
 * 2026-09-14, live-requested: "a visual indicator... more like a traffic
 * light system, maybe a meter... of where they're at with the next best
 * steps." A row of small coloured dots, one per Readiness component,
 * plus a plain-language count ("3 of 5 ready") -- a fast glance, always
 * shown alongside (never instead of) the existing detailed status list,
 * which still carries the actual reasons and next steps a dot alone
 * can't convey. Shared between BlueprintView.tsx's own Section 12 and
 * Screen 13 (DesignConfirmation.tsx), so the same five components always
 * read the same way in both places.
 */
export function ReadinessMeter({ components }: { components: ReadinessComponent[] }) {
  const greenCount = components.filter((c) => readinessComponentLight(c) === "green").length;

  return (
    <div className="readiness-meter">
      <div className="readiness-meter-dots" role="img" aria-label={`${greenCount} of ${components.length} readiness components resolved`}>
        {components.map((c) => (
          <span
            key={c.id}
            className={`readiness-meter-dot readiness-meter-dot-${readinessComponentLight(c)}`}
            title={`${READINESS_COMPONENT_LABEL[c.id]}: ${readinessComponentStatusText(c)}`}
          />
        ))}
      </div>
      <p className="readiness-meter-count">
        {greenCount} of {components.length} ready
      </p>
    </div>
  );
}

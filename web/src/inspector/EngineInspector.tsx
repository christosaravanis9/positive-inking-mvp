import { deriveConceptShape, type PlaceRole } from "@positive-inking/engine";

/**
 * Dev-only engine inspector — skeleton for Phase 1.
 *
 * This proves the deterministic engine package is shared, unmodified,
 * between the browser and the Vitest suite: the same deriveConceptShape
 * function is exercised here as in engine/test/signals.test.ts. Phase 5
 * wires this panel to the live journey state (budgets, eligibility
 * decisions and reasons, confirmed vs recommended values).
 */
export function EngineInspector() {
  const sampleShape = deriveConceptShape({
    element_count: 1,
    place_role: "none" as PlaceRole,
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
  });

  return (
    <details className="inspector" open>
      <summary>Engine Inspector (dev only — Phase 1 skeleton)</summary>
      <dl>
        <dt>journey_mode</dt>
        <dd>not wired yet (Phase 4)</dd>
        <dt>concept_shape sample</dt>
        <dd>{sampleShape} (from @positive-inking/engine, live import)</dd>
        <dt>question budget</dt>
        <dd>not wired yet (Phase 2)</dd>
        <dt>eligible dimensions</dt>
        <dd>not wired yet (Phase 2)</dd>
      </dl>
    </details>
  );
}

import { useJourney } from "../journey/JourneyProvider";
import { previousStepEditPatch } from "../journey/understandingPanel";

/**
 * 2026-09-15, live-requested: a plain, obvious "Back" button, always
 * available on every intake screen (Journey.tsx renders this the same
 * places it renders the "What we've understood" panel) -- see
 * understandingPanel.ts's previousStepEditPatch for why this is safe and
 * genuinely equivalent to what already existed, just discoverable without
 * knowing which panel row to click. Renders nothing at all on the very
 * first screen a journey ever reaches, since there is genuinely nowhere
 * to go back to yet -- never a disabled button implying an action that
 * can't do anything.
 */
export function BackButton() {
  const { state, patchUI } = useJourney();
  const patch = previousStepEditPatch(state.project);
  if (!patch) return null;

  return (
    <button type="button" className="back-button" onClick={() => patchUI(patch)}>
      ← Back
    </button>
  );
}

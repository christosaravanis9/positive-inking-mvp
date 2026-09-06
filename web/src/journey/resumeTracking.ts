import { SCREEN_IDS, type ScreenId } from "@positive-inking/engine";
import { PROGRESS_FLAG_KEYS, type ProgressFlagKey, type ProgressFlags, type UIState } from "./state";

/**
 * "Resume where you left off" (2026-09-06 proposal, approved). Deliberately
 * NOT full forward+backward navigation -- see the proposal in
 * docs/PROJECT_STATUS.md's session log for the full reasoning. This module
 * only ever acts in the unambiguous case: the journey backed up by exactly
 * one flag (a single panel-row or Back/Edit click) and nothing has been
 * re-answered since. Anything more than that -- real invalidation logic
 * clearing several flags, or genuine progress since backing up -- falls
 * back to today's ordinary click-through, on purpose.
 */

export function screenOrdinal(screen: ScreenId): number {
  return SCREEN_IDS.indexOf(screen);
}

export function snapshotProgressFlags(ui: UIState): ProgressFlags {
  const snapshot = {} as ProgressFlags;
  for (const key of PROGRESS_FLAG_KEYS) {
    (snapshot as Record<ProgressFlagKey, boolean>)[key] = ui[key];
  }
  return snapshot;
}

/**
 * The one flag to restore to reproduce the exact pre-navigation state, or
 * null when resuming isn't safe to offer right now: no snapshot yet, the
 * journey is already at (or past) its furthest point, or more than one flag
 * has diverged from the snapshot (real invalidation, or genuine progress
 * since backing up -- never something this feature should silently undo).
 */
export function resumableFlagKey(ui: UIState, currentScreen: ScreenId): ProgressFlagKey | null {
  if (!ui.furthestScreenFlags) return null;
  if (screenOrdinal(currentScreen) >= screenOrdinal(ui.furthestScreenReached)) return null;

  const diverged: ProgressFlagKey[] = [];
  for (const key of PROGRESS_FLAG_KEYS) {
    if (ui[key] !== ui.furthestScreenFlags[key]) diverged.push(key);
  }
  if (diverged.length !== 1) return null;

  const key = diverged[0]!;
  // The only shape "just navigated back one step" can take: the live flag went
  // from true to false. (true -> ... -> anything else means real re-answering
  // already happened, not a plain backward step -- never restore over that.)
  return ui[key] === false && ui.furthestScreenFlags[key] === true ? key : null;
}

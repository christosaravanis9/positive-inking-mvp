# Summary: Screen 7 redesign + Screen 13 fidelity/reference relocation — implemented, verified, shipped

All three open questions from the Part 1 investigation/Part 3 proposal were approved and Parts 2-4 are now fully implemented, tested, and live-browser-verified.

## What changed

**Screen 7 (`ElementsDiscovery.tsx`):** 5 candidates by default (up from 3). Each candidate now gets one 3-button control — **Keep** (→ `closely_based_on`), **Build upon** (→ `interpretive`), **Not this one** — replacing the old selection checkbox + 4-button fidelity row + text-link re-roll. "Not this one" pages forward for free through anything already generated for that slot; only past the end of that history does it open a "Why?" input (concrete-example placeholder, not just "optional"). Blank submission stays on the free client-only reserve-pool swap; a typed reason triggers exactly one real per-slot model call via a new `useKeyedAsyncAction` hook and `requestAssociationAlternative()`. A small pager lets the client page back through every candidate a slot has ever shown — nothing is ever discarded. The reference-upload requirement is gone from this screen entirely.

**Server (`association.ts`):** extended (not replaced) with optional `avoid_descriptions`/`dismissal_reason`, used only on the Why-driven path; same response schema, same `visual_candidates[0]` contract.

**Screen 13 (`DesignConfirmation.tsx`):** each Kept/Built-upon element now gets a fidelity dropdown (same 4 `ElementFidelity` values), with the reference-upload + consent flow appearing inline only when the selected fidelity needs one. Also re-runs `fidelityTreatmentRequired()` itself — the fix for the real sequencing gap Part 1 found (Screen 11 runs before Screen 13, so an element that only becomes `exact` fidelity here would otherwise skip that question).

**Part 4 (data model):** required no new fields or storage — there was only ever one source of truth (`VisualElement.fidelity`/`reference_required`/`reference_status`, `consent_records`, `referenceAssets`); only which screen writes to it changed. The Blueprint's existing readers (`blueprintSummary.ts`, `referenceChecklist.ts`, Readiness) already read straight from those fields.

## A real bug the live browser check caught (not any unit test)

Per-slot history state was seeded via a `useState` lazy initializer, which runs at first mount — but this screen mounts before the Association fetch resolves. Every unit test seeded candidates synchronously, so none of them hit this; the live check did: an untouched slot silently duplicated a just-generated candidate once ranking shifted. Fixed by moving the seed into a one-time effect gated on candidates actually existing. Re-verified live, fixed.

## Verification

Typecheck/tests/build clean across engine (165)/server (65)/web (218, up from 202). Live browser check (real server + Vite + a fake-Anthropic double) walked the full path with screenshots: 5 candidates → Why-driven re-roll → non-destructive paging back → Keep/Build-upon → Continue → Screen 13 dropdown → reference attachment appears → fidelity_treatment gate blocks then clears Build.

## Deliberate scope boundary

"This has given me another idea..." (user-authored ideas) keeps its own unchanged fidelity+reference flow — Parts 2-4 only ever described Association-sourced candidate controls. Flagged as a visible asymmetry for a future round, not silently left inconsistent.

Full detail: `docs/PROJECT_STATUS.md`'s latest session log entry.

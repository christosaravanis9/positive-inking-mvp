# Summary: Screen 7 redesign investigated (Part 1) and Screen 13 dropdown proposed (Part 3) — nothing implemented

Per explicit instruction: report before implementing Parts 2-4.

## Part 1 findings

`VisualElement.fidelity` (4 values: exact/closely_based_on/interpretive/open) drives `reference_required`/`reference_status` (same record), `ConsentRecord[]` (separate array), and `UIState.referenceAssets` (uploaded files) — all currently produced in one place, `ElementsDiscovery.tsx`'s `confirm()`, via four private helper functions. Downstream readers: `referenceChecklist.ts` (which elements need a reference), `deriveConceptSignals.ts` (`has_exact_fidelity_element`), `ArtisticDirection.tsx`/Screen 11 (gates the "how faithful?" fidelity-treatment question), `blueprintSummary.ts` (feeds the Blueprint model as prose).

**A real sequencing bug the redesign would silently introduce:** Screen 11 (ArtisticDirection) runs *before* Screen 13 and is the only trigger for the fidelity-treatment question today. If Screen 7 only ever writes the coarse closely_based_on/interpretive values (deferring exact/open to Screen 13), that question would never fire again for any real journey — a genuine Blueprint-correctness regression, not just a moved UI control. Proposed fix: re-run the same existing `fidelityTreatmentRequired()` check from Screen 13 too, when its dropdown sets "exact."

DesignConfirmation.tsx (Screen 13) currently has no per-element rows at all — adding the dropdown is a real new section. `ReferenceAttachment.tsx` is confirmed cleanly reusable (one call site today, pure component) — its supporting helpers need extracting into a shared module. No new type fields needed anywhere; only which screen sets them changes.

## Part 3 proposed dropdown

Reuse the same 4 existing `ElementFidelity` values (not new ones): "Exactly as-is" (needs reference), "Closely based on this" (needs reference, default for "Keep"), "Interpreted by the artist" (default for "Build upon"), "Open — artist's call". Screen 7's choice is the starting default, not a duplicate question.

## A tension worth flagging

Part 2 asks that a "Why" reason feed into the re-roll's generation — but last night's approved reserve-pool re-roll was chosen specifically to avoid a real server round-trip. Honoring "feeds into generation" literally needs a real per-slot model call after all (just for the Why-driven path; a plain re-roll stays free). The non-destructive pager can unify both under one per-slot history list.

## Status

Nothing in Parts 2-4 implemented. Full detail in `docs/PROJECT_STATUS.md`'s latest session log entry.

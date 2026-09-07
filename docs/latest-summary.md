# Summary: both pending recommendations approved and shipped — per-candidate re-roll, and the Blueprint timeout budget raise

**Shipped:** per-candidate re-roll on Screen 7 (client-only reserve-pool swap); Blueprint's model-call budget raised 30000ms → 45000ms.

## Shipped

**Per-candidate re-roll.** Screen 7 shows the top 3 ranked candidates by default; anything ranked beyond that in the same already-fetched Association response becomes that fetch's reserve pool. Re-rolling a candidate swaps it for the next-ranked reserve item — a synchronous local state update, no new server call, no new async/staleness guard. Two correctness details handled: re-rolling a selected candidate deselects it (so a swapped-out candidate can't silently stay "confirmed"), and a re-rolled-in candidate the client already confirmed stays visible across a remount instead of reverting to the default ranking. Discoverability text ("Not quite right? Try another idea") shows under each candidate with reserve left; a graceful "No more alternatives" message replaces it once exhausted. The Association prompt now asks for "typically 4 to 8" candidates so there's real reserve material.

**Blueprint timeout budget raised.** Following the real production evidence (a timeout at 30003ms, a manual retry at 27507ms, both within ~2.5s of the old 30000ms ceiling): `engine/src/modelTimeouts.ts` now sets Blueprint to 45000ms, the highest ceiling in the matrix. `docs/timeout-matrix.md` gained a full write-up of the real-vs-local gap (real output volume, not network drift). Automatic retry-on-timeout was deliberately NOT added, as approved — a `model_timeout` stays intentionally excluded from the retry set.

## Verification

Typecheck, full test suite (437 tests, up from 431 — 6 new re-roll tests, `modelTimeouts.test.ts` updated for the new budget), and build all pass. Live Playwright verification with screenshots for the re-roll feature (default state, after one re-roll, exhausted state).

## Full detail

See `docs/PROJECT_STATUS.md`'s session log: the 2026-09-07 entry has the complete implementation detail for both approvals, including the two correctness fixes in the re-roll logic and the full timeout-matrix reasoning.

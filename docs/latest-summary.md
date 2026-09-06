# Summary: three-mode Association expansion shipped; re-roll recommendation given; a real production Blueprint timeout confirmed

**Shipped:** three-mode Association candidate expansion (literal object / pure abstraction / illustrative sequence).
**Recommended, not implemented:** client-only reserve-pool swap for Screen 7 per-candidate re-roll; raising Blueprint's model-call budget.

## Shipped

**Three-mode Association expansion.** `server/src/schemas/association.ts`'s rules 1/6/8 extended so a candidate can now be a literal object, a pure abstraction, or a cohesive illustrative sequence (panels, polaroid fragments, morph/collage, still scene, integrated figure) — zero schema/UI change, Mode A's grounding requirement untouched. Verified live: all three modes render in the same candidate list, ranked correctly, selectable via the same single checkbox as any other candidate.

## Recommended, not implemented

**Screen 7 per-candidate re-roll: recommend the client-only reserve-pool swap.** It can't violate the async/staleness guards (it isn't async at all — the alternative needs new keyed infrastructure around `useAsyncAction`, the exact area this codebase was already burned once), adds no new production model-call volume at a moment that volume is under scrutiny (see below), and is the smaller, more reviewable change. Awaiting approval before building.

**Production Blueprint timeout: real data found, budget raise recommended.** The app's own `[model-timing]` log is unconditionally emitted in production already — no new instrumentation needed. Pulled the exact incident straight from Render's log history (read-only, no live-service change): the timeout hit 30003ms against a 30000ms budget, and the manual retry succeeded at 27507ms — both within ~2.5s of the ceiling, not "comfortable margin" as previously assumed. Likely cause: real Blueprint output volume (2576 tokens for a real journey) at ~94-100 tokens/sec, not network drift (throughput was consistent across all three real model calls sampled). Recommend raising the budget (same precedent as Association's earlier 30000→40000 raise); recommend against automatic retry-on-timeout, which would reverse a deliberate existing design choice. Awaiting the new budget number.

## Full detail

See `docs/PROJECT_STATUS.md`'s session log: the 2026-09-06 (later still) entry has the complete prompt diff, verification detail, full re-roll reasoning, and the real production log excerpts. "Open decisions waiting on you" carries both pending items.

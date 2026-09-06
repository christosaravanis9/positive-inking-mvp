# Summary: five live-feedback items shipped, two investigated and reported (not built)

**Shipped:** Statement of Inspiration screen rename, weak-candidate flagging via the existing `resolution_state`/`follow_up_prompt` mechanism, Blueprint quote-box (which also fixed a real "never rendered at all" gap), Screen 7 multi-select subtitle, and the previously-proposed "Resume where you left off" panel navigation fix.
**Reported only, not implemented:** three-mode Association candidate expansion (literal/abstraction/illustrative-sequence), Screen 7 per-candidate re-roll.

## Shipped

**1. "Your tattoo is about..." → "Statement of Inspiration".** Heading + new subtitle ("Worth remembering for when someone asks why you got it.") on `IntentionConfirmation.tsx`. No content/logic change.

**2. Weak-candidate flagging now routes through the existing mechanism instead of prose.** Rule 8 (`server/src/schemas/association.ts`) previously told the model to "say so plainly" when a candidate's `personal_meaning` isn't grounded, with no instruction on *where* — so the model wrote that admission directly into the user-facing text (the "No grounding yet in this story..." example). Now it routes through `resolution_state: "needs_client_specific_detail"` + a personalized `follow_up_prompt` (references the client's own story, offers 1-2 loose examples, explicitly framed as optional — "just ideas, not instructions") — the exact mechanism `description`'s own concreteness gate already used, so no UI change was needed. Can't verify the actual model-generated wording without a real API key in this sandbox; the rendering mechanism itself was verified live.

**3. Blueprint's Statement of Inspiration now renders — a real, previously-unnoticed gap fixed.** The field existed on the model's schema and had good content (fixed in an earlier session) but was never actually wired into `BlueprintView.tsx`, on-screen or in the text export. Now renders as a quote-box callout (left border, italic serif, "studio ledger" tokens) right after "02 — Your intention" — a pull-quote, not a 13th numbered section.

**4. Screen 7 multi-select subtitle.** Confirmed already multi-select; added "Select as many as feel right — you can choose more than one."

**5. "Resume where you left off" panel navigation fix — built as proposed last session.** New `resumeTracking.ts` tracks a high-water-mark screen + a snapshot of progress flags, updated forward-only by `Journey.tsx`'s existing screen-change effect. The resume affordance appears only in the one unambiguous case (exactly one flag backed up, nothing re-answered since) and restores it with one click; everything else falls back to today's normal click-through, on purpose.

## Reported, not implemented

**Three-mode Association expansion (item 3).** Investigated whether the schema caps candidates at one object — it's a prompt-level bias, not a hard wall. Recommended approach: extend rule 8 so a single candidate's `description` can name a whole small cohesive sequence (e.g. three linked panels), with the same concreteness bar applied per-panel — no schema/UI/ranking changes needed. Full example candidate text for all three modes (including all 5 Mode C formats) is in the session log. **Not implemented, awaiting confirmation.**

**Per-candidate re-roll (item 5).** Both approaches considered need genuinely new state: a real server round-trip needs a per-candidate async-tracking hook (the existing `useAsyncAction` only tracks one in-flight action at a time) plus a server request extension; a client-only reserve-pool swap needs no server change and stays fully synchronous, but surfaces an existing lower-ranked idea rather than generating something new. **Not implemented, awaiting your choice of approach.**

## Verification

Typecheck, full test suite (431 tests, up from 418 — new: `resumeTracking.test.ts`, new UnderstandingPanel/BlueprintView test coverage), and build all pass for every shipped item. Live Playwright verification with screenshots for all five shipped items against the real dev stack.

## Full detail

See `docs/PROJECT_STATUS.md`'s session log: the 2026-09-06 (later same day) entry has the complete writeup for all seven items, including the full three-mode investigation and both re-roll approaches. "Open decisions waiting on you" carries the two pending choices.

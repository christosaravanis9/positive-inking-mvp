# Summary: three live-production findings — dark-mode panel text fixed, two more reported for sign-off

**Fixed:** dark-mode illegible panel text (`web/src/styles.css`).
**Reported only, not implemented:** Association candidate grounding (item 2), understanding-panel "Resume where you left off" (item 3).

## Fixed

**Illegible dark-mode text in the "What we've understood" panel's row values.** Distinct from the earlier `::selection` fix (0f00fee), which only covered the text-*highlight* color — this was the normal rendered text color of the panel's own content.

Root cause: `.understood-rail` sets no background/color of its own, so it showed the `body` background through — and `body { background: var(--bg) }` flipped dark under `@media (prefers-color-scheme: dark)`. Meanwhile `.understood-rows dd` (the actual answer values) use the hardcoded `--ledger-ink` (`#171614`) from the "studio ledger" `.sites-tokens` palette, which has no dark variant at all — so under a dark OS/browser preference, row values rendered near-black text on a near-black background, while row labels/heading (`--ledger-red`, saturated) stayed visible-ish. Matches the reported symptom exactly (headings visible, values invisible).

**Correction to the originally-suggested fix:** `color-scheme: light` alone would not have fixed this — that CSS property only affects native form-control/scrollbar/canvas defaults, it does not gate `@media (prefers-color-scheme: dark)`, which reflects the OS/browser preference regardless. The actual bug was this app's own dark-mode override for `--bg`/`--fg`/etc. running with no matching counterpart in the "studio ledger" tokens. Since the whole design is already deliberately light-only, the fix removes that automatic dark-mode override entirely and declares `color-scheme: light` — the complementary, correct use of that property once there genuinely is no dark mode.

**Verification:** typecheck, full test suite (418 tests, unchanged), and build all pass. Live Playwright reproduction against the real dev stack with `colorScheme: 'dark'` forced at the browser-context level (this sandbox's Playwright install has no WebKit binary, so literal Safari couldn't be launched — but the bug is a pure CSS cascade issue, reproduced identically in Chromium): before the fix, panel row values computed to `rgb(23,22,20)` text against a `rgb(22,20,15)` background (functionally invisible, screenshot confirms); after the fix, background stays `rgb(250,248,245)` even under forced dark-scheme emulation and all row values are fully legible in the screenshot. Could not verify against the actual production URL — this sandbox's egress proxy rejects it, and production is separately still crash-looping pending the unrelated Start Command fix from the prior Render investigation.

## Reported, not implemented

**Association candidate grounding (item 2).** The model's rule-8-driven honesty ("say so plainly" when nothing grounds a candidate's meaning) is currently written as prose directly into the user-facing `personal_meaning` field, rather than routed through the existing `resolution_state: "needs_client_specific_detail"` + `follow_up_prompt` mechanism `description` already uses (which the UI already renders distinctly). Proposed: extend rule 8 to route ungrounded `personal_meaning` the same way, keeping the candidate offered but visibly flagged as needing one more detail. No prompt wording changed — awaiting sign-off.

**Understanding panel "Resume where you left off" (item 3).** No "furthest screen reached" is tracked today — `screen` is purely derived from current flags each render. Proposed: a high-water-mark `furthestScreenReached` tracker plus a snapshot-diff affordance that only acts in the unambiguous single-flag-changed case (just navigated back, nothing re-answered yet), falling back to today's behavior otherwise. Deliberately not full forward/backward navigation. Not implemented — awaiting sign-off.

## Full detail

See `docs/PROJECT_STATUS.md`'s session log: the 2026-09-06 entry has the complete investigation, the corrected technical reasoning on `color-scheme`, and the full proposed mechanisms for items 2 and 3. The "Open decisions waiting on you" section carries the two pending sign-offs.

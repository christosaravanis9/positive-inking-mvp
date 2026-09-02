<!--
This file is the canonical handoff point between this project and outside
planning conversations (Claude chat, or anywhere else). Two rules for
whoever (human or Claude session) touches this file next:

1. "Current status" below is REPLACED wholesale whenever it goes stale --
   it should always read as true right now, not as a history. Keep it
   short enough to paste the whole file into another tool's context
   without it being unwieldy.
2. "Session log" is APPEND-ONLY, reverse-chronological (newest at top).
   Add exactly one entry at the end of any session that changed something
   meaningful. NEVER edit or delete a prior entry -- if something in an
   old entry turns out to be wrong or superseded, say so in a NEW entry,
   don't go back and rewrite history.
-->

# Positive Inking — Project Status

## Current status

**Built and working:** the full V3.0 intake prototype — Screens 1–13, the
deterministic adaptive engine (`engine/`), the reference/consent flow,
low-confidence correction, the new-idea loop, visual-association ranking,
placement capture, style-reference resolution, first-party instrumentation
— plus a full reliability/dev-experience pass on top of it: the async-
state race and dev-server crash are both fixed and regression-tested
against the real architecture (not just mocks), the Blueprint pipeline has
a concreteness gate so unresolved candidates can no longer reach a
Blueprint as confirmed primary elements, model-call timeouts are per-route
instead of one universal number, and local development runs on two
commands (`npm run dev`, `npm run validate:local` — see README). The
Blueprint's Section 4 (Visual hierarchy) is a labelled decision map (Core
concept / Personal reference / Other elements / Still undecided), with
every element assigned to exactly one group (a live-test report caught a
duplication bug in the first version of this grouping — see the session
log), and the Readiness section names the actual contradiction and its
concrete next step, not just that one exists. Screen 13 ("Ready to build
your Blueprint") now has a matching "Open decisions" row using the same
wording, so it can no longer read "Nothing outstanding" moments before
the generated Blueprint flags an unresolved contradiction — see the
session log. 226 unit tests pass across engine/server/web; typecheck and
build are clean across all three workspaces.

**Design:** a new "studio ledger" visual direction (warm parchment
background, serif headline, ember-accented selection/marginalia, no card
chrome) was explored as an isolated static preview, approved, and is now
applied live to Screen 7 (`ElementsDiscovery.tsx`) only — see the session
log. It is deliberately not rolled out to the other 12 screens yet; doing
so is a separate future decision, not assumed by this change. All new
styling lives in scoped `.ledger-*` classes/CSS custom properties in
`web/src/styles.css` and in Screen 7's own markup — no shared component or
other screen's styling was touched. **ChatGPT Sites is now the frozen
visual/UX reference** — no more bidirectional feature merging between the
two; visual/UX direction flows from it into this project, not back and
forth. **A real design-token foundation now exists**, migrated from the
Positive Inking Sites UX migration spec with exact values (typography
scale, 8-color palette, spacing rhythm) — see the latest session log entry
— replacing the approximated palette/sizes the "studio ledger" direction
first shipped with. It's a shared foundation defined once, ready to extend
to other screens next; still applied to Screen 7 only for now.

**Workflow/tooling:** a full local-dev-friction pass landed as its own
chapter (see the latest session log entry) — this was tooling/DX work,
not a feature chapter, and touched no application logic, UI, or product
behaviour. `npm run start` / `npm run stop` / `npm run doctor` now sit
alongside the existing `npm run dev` / `npm run validate:local` (both
unchanged) as the reliable way to run the stack locally, with automatic
recovery from a stale copy of this project's own processes, fail-fast
environment validation, and a commit/branch identifier that's always
visible in the running app (footer + Telemetry panel, dev-only) so
"is this browser running current code" never again requires leaving it
to compare terminal output by hand.

**In progress:** nothing actively mid-change right now.

**Open decisions waiting on you:**
- **Confirm Association's (and Discovery's) new timeout ceilings against
  more real data.** A real `npm run diagnose-model` run against
  `claude-sonnet-4-5-20250929` measured Association at 32310ms (over its
  then-30000ms budget) and Discovery at 12937ms (under its then-16000ms
  budget, but only ~3s of margin). Based on that one run, Association's
  production budget was raised 30000ms → 40000ms and Discovery's
  16000ms → 20000ms (`engine/src/modelTimeouts.ts`,
  `docs/timeout-matrix.md`). **This is one sample per stage, not a
  confirmed stable ceiling** — a few more `diagnose-model` runs would be
  worth doing to check 40s/20s actually hold before treating them as
  settled, rather than discovering under real traffic that they need
  raising again.
- **Association candidate wording — prompt change applied, real-model
  verification still needed from you.** Investigated why memorial/tribute
  object candidates lean on abstract phrasing (e.g. "already carries the
  weight of connection") in `personal_meaning`. Root cause:
  `server/src/schemas/association.ts`'s rule 8 (CONCRETENESS) constrained
  only the `description` field — there was no equivalent guidance for
  `personal_meaning`, which is where the abstract phrasing actually lives.
  Three options were proposed at different strictness levels; **Option C
  (a grounding requirement, not a literalness requirement) was chosen and
  is now live** in the prompt: `personal_meaning` no longer needs
  `description`'s literal concreteness (a genuinely abstract emotional
  truth is still legitimate) but must name a specific detail from the
  client's own story or the candidate's own description rather than a
  sentence generic enough to fit any client, and the model is told to say
  plainly when nothing yet grounds the meaning rather than reach for
  boilerplate. **This sandbox has no `ANTHROPIC_API_KEY` configured**
  (`server/.env` doesn't exist; `npm run dev` reports "Model configured:
  NO"), so the actual before/after wording change could not be observed
  against the real model here — only the prompt text change itself, a
  full typecheck/test pass, and the request/response pipeline shape were
  verified. **You should run `npm run diagnose-model` (or the app itself)
  with a real key against the "handmade wall art" scenario to confirm
  `personal_meaning` reads more specifically before treating this as
  settled** — see the latest session log entry for exact wording and
  what was and wasn't checked.
- **"Whose is it?" reference field — investigated, no change made.**
  The dropdown (`web/src/components/ReferenceAttachment.tsx`,
  `subject_relationship`) renders whenever a candidate's chosen fidelity
  is `exact` or `closely_based_on` (`NEEDS_REFERENCE` in
  `ElementsDiscovery.tsx`), regardless of `source_category` or
  `material_type` — it fires identically for a photo of a living person
  and for a client's own handmade object. Its five options (Me / Someone
  else living / A child / Someone who has passed / Not sure) answer
  "whose personal information (likeness, handwriting, signature) does
  this reference material capture" — the question §15.2 attestation
  actually needs — not "who does this object belong to or was it made
  for." An object the client made themselves for a living family member
  has no clean answer among the five, because the field isn't asking
  about gift/dedication relationships at all; "Not sure" happens to be
  harmless there only because `requiresAttestation()` also skips it, not
  because it's the right answer. Left as-is pending your call on whether
  to adjust the options, make the field conditional on `material_type`,
  or leave it. **Update, stronger framing:** further live feedback now
  leans toward removing/skipping this field entirely for certain
  scenarios (an object the client made themselves for a living family
  member, per the finding above), not just gating it conditionally as
  first investigated. Still not built — the three options on the table
  are now: adjust the five options, make the field conditional on
  `material_type`, or drop it entirely for scenarios like this one.
- **§15.7 production launch blockers** (encrypted-at-rest storage,
  project-scoped access control, deletion/retention, training-use policy,
  legal review of the consent flow) are all still open — see README.md's
  "Production launch blockers" section for the full, unchanged list. None
  of this build's upload paths should be treated as production-ready
  until those are deliberately resolved.
- **If you see a bare "Needs refinement" or a raw "(undecided)" tag again,
  check your running code before reporting a new bug.** A live session
  reported both, on the same fresh Blueprint, immediately after 8c3a7fa
  shipped. Investigated (see the latest session log entry for the full
  trace): current code cannot produce either symptom -- both are
  byte-for-byte reproductions of 8c3a7fa's OLD, pre-fix formatting
  (confirmed by reconstructing the exact old template literals). This
  points to a stale dev server process, browser tab, or checkout that
  predated the fix, not a surviving code defect -- this project has hit
  exactly this class of issue before (`docs/dev-server-reliability.md`).
  No code change was made for this; two component-level regression tests
  now lock in the correct current behaviour
  (`web/src/screens/BlueprintView.test.tsx`). If it recurs against a
  verified-current checkout with a hard-refreshed browser, that would be
  a genuine new regression worth re-opening.

**Known, deliberately deferred issues (not lost, just not this chapter's scope):**
- **Voice input timeout/cutoff behaviour** — a roughly 10s recording limit
  and roughly 3s silence timeout were observed to cut off voice input
  during a live test. Values are from user observation, not measured
  instrumentation. Deliberately deferred; needs its own investigation.
- **Voice input, second failure mode** — sometimes doesn't respond to
  activation at all (separate from the cutoff issue above). Degrades
  visibly to "Voice input isn't responding — you can still type," which
  is working as intended as a fallback, but the underlying voice issues
  (both this and the cutoff above) remain unresolved.
- **Statement of Inspiration visual formatting** (quote-style typography)
  **and overall Blueprint premium polish** — deliberately deferred to a
  later, dedicated polish pass, not current work. (Distinct from Statement
  of Inspiration's *content*, which this session's item #2 fixed — see
  below; this note is about typography/visual treatment only.)
- **Free-text input + suggestion chips on binary confirmation screens**
  ("Here's what that suggests" style screens, e.g. `StyleReference.tsx`'s
  resolution step) — currently only right/try-again, no way to add
  nuance or see suggested phrasing. **Sharpened by later feedback:** the
  ask is for both together on the same screen, not either/or —
  multiple suggestion boxes (alternative phrasings/interpretations to
  pick from, not just the one shown) *and* a free-text input to type a
  correction/refinement directly, rather than only being able to accept
  or reject the single suggestion. Still not built.
- **Timer/countdown UI during model-call waits** — may overlap with the
  already-specced placement-preference "productive waiting" MVP; should
  probably be coordinated with it rather than built separately.
- **Overall journey progress/timeline indicator** across all screens.

**Known risks:** the timeout numbers above are provisional (see the open
decision); nothing else newly introduced this session. See
`docs/session-summary.md` and the incident docs it links
(`docs/async-state-incident.md`, `docs/dev-server-reliability.md`,
`docs/timeout-matrix.md`) for the detailed history behind how the codebase
got to its current, tested state.

## Session log

### 2026-09-02 — Migrated the Sites design-token system into Screen 7's CSS (exact values, foundational)
Foundational visual work, not a full screen redesign — no component logic
touched, only `web/src/styles.css`. Trigger: the "studio ledger" direction
applied to Screen 7 earlier today used an *approximated* palette/sizing,
judged by eye against a preview; this migrates the Positive Inking Sites
UX migration spec's literal, audited values (typography scale, 8-color
palette, spacing rhythm) in their place.

**Built:** a full token system in `.ledger-screen` (Screen 7's scope):
- Typography scale as CSS custom properties (`--text-h1-*`, `--text-intro-*`,
  `--text-h2-*`, `--text-label-*`, `--text-choice-title-*`,
  `--text-choice-desc-*`, `--text-side-label-*`, `--text-side-value-*`,
  `--text-button-*`) — family/weight/size/line-height/tracking per the
  spec, system fonts only (`Georgia, "Times New Roman", serif` /
  `Arial, Helvetica, sans-serif`, no webfont load).
- The 8-token color palette (`--ledger-paper`, `--ledger-paper-deep`,
  `--ledger-ink`, `--ledger-muted`, `--ledger-line`, `--ledger-red`,
  `--ledger-white`, `--ledger-accent`) at the spec's exact hex values,
  replacing the earlier approximated `--ledger-ember`/`--ledger-paper`/etc.
- Spacing-rhythm tokens (`--space-intro-*`, `--space-question-block-top`,
  `--space-question-group-gap`, `--space-choice-grid-gap`,
  `--space-nav-*`) at the spec's exact values.

**Reconciliation, not duplication:** every rule in `.ledger-screen` that
previously referenced the old approximated `--ledger-*` set (colors) or a
hardcoded literal (typography/spacing) now consumes the new tokens instead
— confirmed by grep that no old approximated color variable remains
defined anywhere. Applied where an existing Screen 7 element's role
genuinely matches a given scale entry (the headline → Screen title/H1
scale including its literal `clamp(40px, 5.2vw, 68px)` — visibly larger
than before, by design, per the exact spec number, not preserved at the
old approximated size; the marginalia follow-up label → Question label/H3
scale; the fidelity pills → Choice-title scale; the CTA → Standard-button
scale; the footer nav → the spacing spec's bottom-navigation rhythm).
Scale entries with no current Screen 7 counterpart (Screen intro copy,
Screen H2, choice description, side-panel label/value) are defined but
unconsumed — foundation for when a matching element exists here or on
another screen, not applied speculatively.

**A real collision caught and avoided, not just checked for:** the spec's
own token names are bare (`--paper`, `--muted`, `--accent`, ...), but this
app's global `:root` already defines `--muted` and `--accent` for a
*different* concept at a *different* value — and, critically, the base
`button` rule and `.option-chip.selected` set `background`/`border` from
`var(--accent)`. Screen 7 wraps components deliberately left on that
ordinary app-wide styling (the "add your own idea" input/button,
`ReferenceAttachment`) per the earlier ledger work's own scope. CSS custom
properties cascade to every descendant regardless of class, so a
Screen-7-scoped bare `--accent` would have silently repainted those
buttons with the spec's pale ghost-hover color (`#DED6CA`) instead of the
app's real accent, making "Add"/"Add it anyway" nearly illegible —
reproduced this directly before catching it, not just reasoned about it
abstractly. Fix: the 8 color tokens keep a `--ledger-` prefix (exact spec
*values*, namespaced *names*); typography-scale and spacing-rhythm tokens
have no such collision (nothing else in the app uses `--text-h1-size`
etc.) and keep the spec's own naming. Full reasoning is in a CSS comment
directly above the token block.

**Verified:** `npm run typecheck`, `npm test` (226 tests), and
`npm run build` (including the production Vite build) all pass unchanged.
`grep` across `web/src/styles.css` confirms every `--ledger-*` token is
defined exactly once (no two competing reds/inks/etc.) — the only names
with two definitions anywhere in the file are the pre-existing, intentional
light/dark `prefers-color-scheme` pairs, not a duplicate/conflicting
definition of the same concept. Live-rendered Screen 7 (real server, real
Vite, fake Anthropic double, a real browser journey through Welcome →
Viewpoint → Story → Screen 7, one candidate selected to show the
marginalia/fidelity-pill state) at both desktop and 375px-mobile
viewports — screenshots sent for review. No structural regression: still
the same flowing hairline-separated list with no card chrome, hollow-ring
selection, and marginalia-style follow-ups; the exact-token pass reads as
a precision correction (crisper contrast, correct hex values) plus one
deliberate, spec-driven size change (the headline), not a redesign.

### 2026-09-02 — Local dev workflow/tooling chapter: start/stop/doctor, auto port-conflict recovery, always-visible build identifier
This is a workflow/tooling chapter, not a feature chapter — no
application logic, UI, or product behaviour changed. Trigger: a session
that repeatedly lost time to port conflicts, stale git pulls, and not
knowing whether the running app matched what was pushed — most costly of
all, four separate instances of debugging against stale code without
realizing it, because checking required leaving the browser and comparing
terminal output by hand.

**Built:**
1. **`npm run start`** — wraps the existing `startStack()` (unchanged;
   `npm run dev` is untouched and still works exactly as before) with:
   fail-fast `server/.env` / `ANTHROPIC_API_KEY` validation before
   spawning anything (value never printed); automatic reclaim of a stale
   copy of *this project's own* processes (from a previous `npm run
   start` that didn't shut down cleanly), with a printed explanation of
   what was killed and why; the existing named-PID `PortConflictError`
   behaviour preserved unchanged for anything that isn't provably this
   repo's own process; post-boot health checks (engine/server/web all
   actually responding, not just spawned); and a success banner that
   names the URL, the running commit, and the branch.
2. **`npm run stop`** — stops only this project's own processes, no
   manual PID-hunting. Two sources, both used: the PID marker
   `npm run start` writes (`.dev-stack.json`, git-ignored — this is what
   catches the engine watcher, which holds no port), and a live check of
   ports 8787/5173 as a fallback for a missing/stale marker. Anything not
   provably this repo's own process (working directory doesn't match) is
   reported and left alone, never killed.
3. **`npm run doctor`** — read-only diagnostic: git branch and whether
   it's behind origin (best-effort `git fetch`, degrades gracefully
   offline), port occupancy (and whether the occupant is this repo's own
   process), whether `server/.env`/`ANTHROPIC_API_KEY` are present
   (value never printed), and — new — a last-known-good-commit
   comparison: `npm run validate:local` now records the commit it last
   fully validated (`.last-known-good-commit.json`, git-ignored) on a
   full PASS, and `doctor` reports whether HEAD still matches it.
4. **Always-visible build identifier** — `web/vite.config.ts` now has a
   `define` block computing the short git commit hash and branch fresh
   from git at every dev-server start/build (`web/src/vite-env.d.ts`
   declares the injected `__GIT_COMMIT__`/`__GIT_BRANCH__` globals). A
   new dev-only `web/src/dev/BuildIdentifier.tsx` renders it as a small
   fixed footer badge — deliberately *not* inside `TelemetryInspector`'s
   collapsed `<details>`, so it never requires a click — and it's also
   echoed in that panel's `<summary>` line (visible without expanding)
   for redundancy. This directly targets the single most time-costly
   failure mode from tonight's session.
5. **`Start Positive Inking.command`** — a Mac double-click launcher
   (`cd` to the repo, run `npm run start`) so starting the stack never
   requires opening Terminal manually first.

**A real bug found and fixed along the way, in shared plumbing:**
`scripts/lib/devStack.mjs`'s `terminateManaged()` skipped signaling a
child's process group entirely once the *directly tracked* process (e.g.
the `npm` process for `npm run dev -w engine`) had already exited —
reasoning "nothing to do here." That's wrong when a grandchild it spawned
(`tsc --watch`, which retains the same process-group id) survives as an
orphan: nothing ever signals it. Found this directly while verifying the
stop→start cycle: a pre-existing, platform-timing-dependent race already
documented in `docs/dev-server-reliability.md` (not something this
chapter introduced — reproduced even against an unmodified `npm run dev`)
occasionally causes the engine watcher to receive an external SIGTERM
shortly after boot, which triggers the existing crash-cascade shutdown in
both `dev.mjs` and the new `start.mjs`; with the old `terminateManaged`,
that cascade left `tsc --watch` running orphaned, undetected by port
checks (it holds no port). Fixed by always signaling the process group,
regardless of whether the tracked child has already exited. This is a
tooling-only fix to shared process-lifecycle plumbing — the underlying
file-watcher race itself was not (and, per that doc, could not reliably
be) chased further; it remains an accepted, already-documented flake in
the dev stack, not a regression from this chapter.

**Verified live, not just read:**
- Stop→start cycled 5 times in a row (`npm run start` → confirm health →
  `npm run stop` → confirm ports free, repeat). All 5 stops fully cleaned
  up and every subsequent start succeeded — including the ~2/5 cycles
  where the pre-existing engine-watch race above fired mid-cycle, proving
  the tooling itself never gets stuck even when the underlying dev stack
  does.
- Port-conflict-recovery path: started the stack, `kill -9`'d the
  `npm run start` process directly (simulating a killed terminal — leaves
  engine/server/web running orphaned with a stale marker on disk), then
  ran `npm run start` again with no manual cleanup. It found the stale
  marker, confirmed each PID via working-directory ownership, printed
  what it was reclaiming and why, and came up clean — both ports
  responding — with zero manual intervention.
- `npm run doctor`'s stale-branch detection against real git history:
  `git reset --soft HEAD~1` (simulating a checkout behind its own
  remote-tracking ref) made `doctor` correctly report "1 commit(s)
  behind -- you are looking at OLD code, pull before debugging further";
  reset back to the real HEAD afterward.
- `npm run typecheck`, `npm test` (226 tests, unchanged), and
  `npm run test:dev-reliability` (the existing stress-edit regression
  test) all still pass after the `terminateManaged` change.

### 2026-09-02 — Investigated a reported style_reference "2+ minute hang": no code bug found
Trigger: a live report of a successful `style_reference` model call
(server log: `outcome=success elapsed_ms=5020 budget_ms=12000`, well
under budget) followed by 2+ minutes with no visible screen progression.

**Investigated, per instruction, before touching anything:**
1. Traced the client path: `StyleReference.tsx`'s `submit()` goes through
   the same `useAsyncAction` re-entrancy/staleness-guarded path as every
   other model-backed screen (`guard.isStale()` checked after the await,
   before the only state mutation, `setResolution(result)`) -- nothing
   unprotected. Re-read `useAsyncAction.ts` itself: `pending` clears in a
   `finally` keyed on the call's own token, independent of whether the
   guard reports stale, so there is no path that leaves it stuck `true`
   after a call this hook itself considers current.
2. Confirmed today's Screen 7 restyling touched exactly three files
   (`ElementsDiscovery.tsx`, `styles.css`, `docs/PROJECT_STATUS.md` --
   `git show --stat` on that commit) and introduced no class name outside
   an `ledger-`-prefixed set that exists nowhere else in `web/src`
   (grepped to confirm). No shared state file, `JourneyProvider.tsx`,
   `useAsyncAction.ts`, or `StyleReference.tsx` itself was touched --
   there is no mechanism by which it could affect this screen.
3. Live-reproduced the exact reported condition: intercepted
   `/api/style-reference` in a real browser (Playwright) to return a
   genuinely successful response instantly (isolating client behavior
   from real model latency, which the server log already cleared), landed
   on Screen 11's style-reference lead-in with seeded state, and
   submitted a real request through the real `useAsyncAction` path. No
   console or page errors. The screen correctly transitioned from the
   "Working out what that points toward..." spinner to a new heading,
   "Here's what that suggests," showing the resolution summary and a
   "That's right, continue" button; clicking it correctly advanced to
   the next screen (Artistic direction).

**Root cause: not a code bug.** `StyleReference.tsx`'s own docstring
states the intended design: "A resolution is always shown back once,
compactly, and is correctable before it's applied to anything" -- Screen
11 is a deliberate two-step confirm-before-apply flow, not
auto-advancing. A successful response correctly produces a *new*
screen (a confirmation summary), which then waits for an explicit user
click before the *next* screen appears. The reported "hang" most likely
happened at that confirmation step -- the screen did update, but not to
what was being watched for ("artistic direction"), and nothing in this
investigation found the confirmation screen failing to render or the
confirm action failing to fire. No code was changed. If this recurs
against a verified-current checkout, capturing what's actually on
screen at the moment of the "hang" (a screenshot, or which heading is
showing) would be the fastest way to tell a genuine regression from
this same UX read.

### 2026-09-02 — Applied the "studio ledger" design direction to Screen 7 (live, not a preview)
An earlier same-day exploration produced an isolated static-HTML preview of
a new visual direction for one representative screen, entirely outside the
app (no repo files touched): warm parchment background, a serif (Georgia)
headline over clean system-sans body/UI text, one ember-red accent reserved
only for selection state and a marginalia rule, candidates as a flowing
hairline-separated list instead of bordered "chip" cards, a hollow-ring
"wax seal" selection marker, expanded follow-ups styled as indented
marginalia (left rule, small-caps label, lined input), and a quiet 2px
progress hairline with a "0X / 13 · stage" label. That preview was
reviewed and approved. This session integrated it for real into
`ElementsDiscovery.tsx` (Screen 7) -- the only screen touched.

**What changed:** markup and CSS only, in two files --
`web/src/screens/ElementsDiscovery.tsx` (structure/classNames; the native
fidelity `<select>` became a segmented pill button group calling the exact
same `setFidelityByIndex`/`setAddedIdeas` state updates as before, just
from a `<button onClick>` instead of a `<select onChange>`) and
`web/src/styles.css` (a new block of `.ledger-*` classes and CSS custom
properties, purely additive -- no existing rule was edited or removed).
No state shape, handler, async/staleness guard (`useAsyncAction`,
`guard.isStale()`), or data flow changed anywhere.

**Scope discipline, deliberate:** the new palette/typography is scoped
under a `.ledger-screen` modifier applied alongside (never instead of) the
shared `.screen` class, so no other screen's look changed. Three things
inside Screen 7 itself were left on the app's ordinary shared styling on
purpose, since their CSS classes (`.reference-attachment`, `.reference-*`,
`.option-chip`) are reused independently by `Placement.tsx` and
`StyleReference.tsx`: the "add your own idea" input/button row, the
existing-sole-element/likeness/scene micro-questions, and the
`ReferenceAttachment` sub-component's own internals. The `.option-chip`
class itself (and its `.candidate-card` modifier from the earlier
layout-bug fix, task #52) is no longer used by Screen 7's own candidate
rendering at all -- Screen 7 now uses new `.ledger-candidate` markup
instead -- but the old rule is untouched in `styles.css` since every other
screen using plain `.option-chip` still needs it exactly as it was.

**Verification:** typecheck and build clean across all three workspaces;
full test suite passes unchanged (226 tests -- no existing test asserted
on Screen 7's specific markup/classNames, so none needed updating).
Live-browser-verified with the exact "handmade wall art / Athena"
scenario used throughout today's session, extended with a second
follow-up-bearing candidate: selection, expansion, typed follow-up text
(read via `inputValue()`, since a typed value never appears in
`innerText`), fidelity-pill selection, and the `ReferenceAttachment`
sub-component all work identically to before. Explicitly checked the
layout-bug class from task #52 does not recur: iterated the actual
rendered DOM order (Association's ranking can reorder candidates by
score, so array order isn't rendered order) and confirmed each
candidate's bounding box starts at or after the previous one's bottom --
no overlap anywhere, including with two candidates expanded
simultaneously with long typed answers. Screenshots reviewed directly,
both collapsed and with two candidates expanded.

Rolling this direction out to the remaining 12 screens is an explicit,
separate future decision -- not assumed or begun here.

### 2026-09-02 — Fixed the Screen 13 "Nothing outstanding" vs. post-Blueprint contradiction inconsistency
Follow-up to item #3 of the same day's earlier report, which the prior
session's summary omitted. Investigated as asked: "Still needed" on
Screen 13 (`DesignConfirmation.tsx`) is specifically the §8
reference-checklist bullet, computed only from `buildReferenceChecklist`/
`isReferenceEntrySatisfied` -- a genuinely different check from the
contradiction/`hasUnresolvedPrimaryImagery` signals that later drive the
Readiness reason. Confirmed this was a quick, well-scoped wording/display
fix, not new detection: both signals were already computed on that exact
screen (for the `has_unresolved_contradiction` boolean sent to the server
in `build()`), just never displayed. Added an "Open decisions" row next
to "Still needed" that calls `describeReadinessReason()` with the same
inputs, so its wording can never drift from what Readiness will actually
say -- shows "None noted" when clean, or the real contradiction
description(s) and their resolutions when not.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (226 tests, 3 new in a new
`web/src/screens/DesignConfirmation.test.tsx` -- one proving "Still
needed: Nothing outstanding" and a populated "Open decisions" can appear
together, the exact reported inconsistency, now resolved). Live-browser-
verified with the reported scenario (no outstanding references, one real
contradiction with two resolutions): Screen 13 shows both rows correctly,
screenshot reviewed directly.

### 2026-09-02 — Fixed a real duplication bug in the new Visual hierarchy decision map; readiness reason now names the contradiction and its next step
Follow-up to the same day's prior session (below): live browser evidence
confirmed the decision-map restructure and prior fixes were rendering
correctly overall, but surfaced two new, genuinely live bugs in the new
code itself -- unlike the earlier same-day report, these were NOT a stale
build.

**Fixed:**
1. **Duplication bug in `groupVisualElementsForHierarchySection`.** The
   prior session's own design treated `stillUndecided` as a
   cross-cutting flag an element could carry *alongside* its
   `personal`/`other` category bucket -- so a personal, unranked element
   appeared verbatim in both "Other elements" and "Still undecided" on a
   real Blueprint. Changed the grouping so every element lands in
   EXACTLY ONE of the three groups: `stillUndecided` now takes priority
   (an unranked element is flagged there and nowhere else); once
   resolved, it moves into `personal`/`other`, which remain exhaustive
   and mutually exclusive as before.
2. **"Still undecided" bypassed prose composition.** The same report
   correctly noticed the duplicated element's text read as raw,
   unprocessed input in that group, unlike "Personal reference"/"Other
   elements". Root cause: "Still undecided" rendered bare `e.description`
   directly instead of going through `visualElementSentence()`
   (`ElementLine` in `BlueprintView.tsx`) the way the other two groups
   already did. Now routed through the identical composition path in
   both the on-screen JSX and the plain-text export.
3. **Readiness reason too vague to act on.** "A noted contradiction in
   the design is still unresolved" named no contradiction and no next
   step. Root cause: the Association Engine's own `contradictions_noticed`
   (`{description, resolutions}` per §11 rule 7, "plain descriptions with
   one or two resolutions") was being flattened to a bare description
   string the moment it landed in `project.contradictions`
   (`ElementsDiscovery.tsx`), discarding the resolutions entirely before
   anything downstream could use them. `ProjectState.contradictions` is
   now `ContradictionRecord[]` (`{description, resolutions}`, a new
   engine type) end to end; `describeReadinessReason()`
   (`engine/src/readiness.ts`) takes the full records instead of a
   `hasOtherContradiction` boolean and composes one reason per
   contradiction naming its description and, when present, its own
   "Possible next step(s)" -- never an invented suggestion, only what the
   model itself already proposed.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (223 tests: 154 engine -- 8 new/rewritten covering the
new `ContradictionRecord`-based reasons -- 39 server, 30 web -- new/rewritten
tests in `blueprintSummary.test.ts` proving no element ever appears twice
across the three groups, and in `BlueprintView.test.tsx` proving the exact
live-test duplication no longer reproduces and the readiness reason names
real contradiction text). Live-browser-verified with the exact reported
"Athena wire" element (personal source category, unranked hierarchy, a
real contradiction with two resolutions attached): the element's text now
appears exactly once in Section 4, under "Still undecided" alone, composed
identically to the other groups; Section 12 now reads the actual
contradiction plus both possible next steps, never the old generic
sentence -- screenshot reviewed directly.

### 2026-09-02 — Investigated readiness/undecided-tag regression reports (stale build, not a code bug); fixed Statement of Inspiration sourcing; restructured Visual hierarchy into a decision map
Trigger: a live session reported two apparent regressions on a fresh
Blueprint, right after 8c3a7fa shipped -- Readiness showing bare "Needs
refinement" with nothing else, and "(undecided)" leaking into Visual
hierarchy in a *different* rendering shape than the bug 8c3a7fa fixed,
suggesting a second, uncaught code path. Instructed to investigate both
fully before touching anything.

**Investigation findings for #1 and #1b (report-first, as instructed):**
- Confirmed 8c3a7fa and its follow-up (3f2af40) are present on both the
  local working tree and `origin/claude/positive-inking-implementation-ckncmj`
  -- no stale branch, no uncommitted drift, no leftover dev process in this
  sandbox to have served old code.
- Proved algebraically that current code cannot produce either symptom:
  `describeReadinessReason()` always returns at least one string for
  `needs_refinement` (only `blueprint_ready`/`concept_visual_ready` -- a
  different label entirely -- return empty), and current
  `HIERARCHY_LABEL` has no entry for `"undecided"`, so no code path can
  emit a parenthetical `(undecided)` tag.
- Reconstructed the exact reported text byte-for-byte from 8c3a7fa's
  **pre-fix** `formatBlueprintAsText`: the OLD line
  `` `- ${e.description} (${e.hierarchy}) -- ${e.personal_meaning}` ``
  produces precisely `"(undecided) -- <meaning>"` for an unranked element
  (matching #1b's exact parens + double-hyphen formatting, which neither
  the old NOR new on-screen JSX -- both use a bare em-dash, no parens --
  could produce), and the OLD bare `section("Readiness",
  READINESS_LABEL[...])` call produces precisely #1's reported bare label.
- **Conclusion: not two bugs, and not a second rendering path.** Both
  symptoms are one root cause -- the live session that generated this
  Blueprint was running pre-8c3a7fa code (a stale dev server process,
  browser tab, or checkout predating the fix), consistent with this
  project's documented history of exactly this failure class. No code fix
  was made for #1/#1b themselves. Per the coverage gap the report
  correctly identified (only the pure helpers were unit-tested, nothing
  exercised BlueprintView's actual rendered output), added
  `web/src/screens/BlueprintView.test.tsx`: component-level regression
  tests rendering the real tree, so a future regression that stops calling
  `visualElementSentence()`/`describeReadinessReason()` from the JSX would
  actually be caught.

**Fixed:**
- **#2, Statement of Inspiration drew from aesthetics instead of
  story/why.** `server/src/schemas/blueprint.ts`'s
  `BLUEPRINT_SYSTEM_PROMPT` had zero guidance for `statement_of_inspiration`
  at all -- it was listed as a required schema field with no phrasing
  instruction, so the model defaulted to the richest available material
  (visual/aesthetic technique description) over the terser Story/Why
  fields. Added one paragraph: one or two sentences, drawn primarily from
  story and why, not from visual_direction/artistic_direction's execution
  detail. Prompt-only change (no schema/type change).
- **#3, Section 4 (Visual hierarchy) restructured into a decision map.**
  Proposed structure (Core concept / Personal reference / Other elements /
  Still undecided) implemented in both `BlueprintView.tsx`'s on-screen JSX
  and its plain-text export, backed by a new pure
  `groupVisualElementsForHierarchySection()` in `blueprintSummary.ts`:
  `personal`/`other` exhaustively partition every element by
  `isPersonalSourceCategory` (§22's own existing definition, not a second
  hand-maintained list) so nothing is silently dropped, and
  `stillUndecided` is a separate, cross-cutting flag list (an element can
  be both a personal reference and still-undecided -- those are two
  different facts about the same element). This directly serves the
  report's own observation: making "needs a decision" its own visibly
  separate list is what would have made #1b's kind of leak immediately
  obvious as a structural anomaly rather than a buried word.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (219 tests: 152 engine, 39 server, 28 web -- 12 new this
session: 5 pure-function tests for `groupVisualElementsForHierarchySection`
in `blueprintSummary.test.ts`, 7 component-level tests in the new
`BlueprintView.test.tsx` covering both the #1/#1b regression-proof and the
new decision-map structure). Live-browser-verified against the exact
"handmade wall art / Athena" scenario via a seeded journey state: Section 4
now shows Core concept / Personal reference / Still undecided cleanly with
no raw tags, and Section 12 shows the readiness reason inline -- screenshot
reviewed directly. #2's model-input change could not be live-verified
against a real model in this sandbox (no `ANTHROPIC_API_KEY` configured,
same limitation as the prior session's Association prompt change); the
prompt text itself and full test/typecheck pass were confirmed instead.

Per instruction, four items were noted rather than built this session --
now recorded above under "Known, deliberately deferred issues": free-text
input + suggestion chips on binary confirmation screens, a timer/countdown
during model-call waits (flagged as possibly overlapping the
placement-preference "productive waiting" MVP), an overall journey
progress indicator, and a second voice-input failure mode (no response to
activation at all, distinct from the earlier cutoff issue).

### 2026-09-02 — Association CONCRETENESS rule extended to personal_meaning (Option C)
Follow-up to the same day's live-test session below: item 4's investigation
proposed three prompt-change options at different strictness levels for
`server/src/schemas/association.ts`'s CONCRETENESS rule (which constrained
only `description`, not `personal_meaning` — the field where abstract
phrasing like "already carries the weight of connection" actually lives).
You chose **Option C**, a grounding requirement rather than a literalness
requirement: `personal_meaning` can stay honestly abstract when that's
what the story supports, but must be grounded in a specific detail from
the client's story or the candidate's own description, never a sentence
generic enough to fit any client — and the model should say plainly when
nothing yet grounds the meaning, rather than default to boilerplate.
Applied as one paragraph appended to rule 8, immediately after its
existing `description` guidance; no schema/type change, since this is
prompt wording only.

**Verified:** typecheck and build clean across all three workspaces; full
test suite passes (207 tests — unchanged, since no schema or behavior
contract changed, only prompt text the schema doesn't validate).
**Not verified — and could not be, in this environment:** whether
`personal_meaning` actually reads more specifically against the real
model. This sandbox has no `ANTHROPIC_API_KEY` configured (`server/.env`
does not exist; `npm run dev` reports "Model configured: NO"), and the
project's fake-model test double (`test-integration/fakeAnthropic.mjs`)
returns hardcoded canned text regardless of prompt content, so it cannot
demonstrate a wording-quality change either — running the app against it
would not have been a genuine check, so it wasn't staged as one. **Before
treating this change as validated, run `npm run diagnose-model` (or the
app itself) with a real `ANTHROPIC_API_KEY` against the "handmade wall
art" scenario and confirm `personal_meaning` no longer defaults to generic
phrasing like "already carries the weight of connection."** If it still
does, the next step is likely Option A (the stricter variant) rather than
further tweaking C's wording.

### 2026-09-02 — Live end-to-end test fixes: Screen 7 layout, readiness reasons, Blueprint prose leaks
Trigger: a real, full end-to-end browser test journey (screenshots and the
resulting Blueprint document reviewed directly — not `diagnose-model`)
surfaced three real bugs and two items worth investigating before touching.

**Fixed:**
1. **Screen 7 layout bug — expanded candidate card overlapped following
   content.** Root cause was not absolute positioning as suspected: `.option-chip`'s
   999px border-radius (correct for every other use of that class, a
   short single-line pill toggle) computed as an ellipse once
   `ElementsDiscovery.tsx` reused the same class for a tall, multi-line
   expandable container (follow-up field, fidelity select, reference
   attachment), so the curved corners bit into corner text once a
   candidate expanded. Fix: a scoped `.option-chip.candidate-card`
   modifier (`web/src/styles.css`) overriding the radius to 12px, applied
   only at ElementsDiscovery's two usages — every real pill-shaped
   `.option-chip` elsewhere is untouched. Verified visually (screenshots +
   bounding-box overlap checks) across two different follow-up-field
   candidates, individually and together, with realistic long typed text.
2. **Blueprint Readiness section gave no reason.** Added
   `describeReadinessReason()` (`engine/src/readiness.ts`) — a pure
   function reusing the exact same signals already driving Design
   considerations (the reference checklist, `hasUnresolvedPrimaryImagery`,
   `project.contradictions`) rather than inventing new logic or parsing
   the model's own prose. Wired into `BlueprintView.tsx`'s on-screen
   render and plain-text export via a thin `readinessReasons()` helper.
3. **Raw candidate/status strings leaking into Blueprint prose.** Live
   example: Section 4 rendered "...saying Athena undecided — A concrete
   thing from your shared world that already carries the weight of
   connection" — the literal `hierarchy: "undecided"` enum value and a
   raw `"to upload"` status were being concatenated straight into the
   on-screen sentence (`BlueprintView.tsx`'s Section 4/8 JSX and its
   plain-text export), the same class of bug as the earlier
   `confirmed_project_summary` raw-enum leak, just in the client-facing
   document instead of the model's input. Fix: moved the composition into
   `web/src/journey/blueprintSummary.ts` (`visualElementSentence`,
   `HIERARCHY_LABEL`, `REFERENCE_STATUS_LABEL`) — a hierarchy role is only
   ever shown once it names an actual value (never "undecided"), status is
   phrased as what happened ("Not yet uploaded", not "to upload"), and
   `personal_meaning` is only appended when it adds information the
   description doesn't already have. Status markers like "undecided"/
   "to upload" still reach the client through Design considerations' real
   sentences, exactly as the user asked — nothing there changed.

**Investigated only, per instruction — no code changed:**
4. **Association candidate wording too abstract.** Traced to
   `server/src/schemas/association.ts`'s CONCRETENESS rule constraining
   only `description`, not `personal_meaning` (where the abstract phrasing
   lives). Smallest proposed change documented in this file's "Open
   decisions" section above — deliberately not applied without
   confirmation, since it changes live model output for every user.
5. **"Whose is it?" reference field relevance.** Traced to
   `ReferenceAttachment`'s `subject_relationship` dropdown rendering
   whenever fidelity requires a reference, independent of
   `source_category`/`material_type` — it answers a consent-attestation
   question (whose likeness/handwriting/signature is this material) that
   doesn't map onto an object the client made themselves for a living
   family member. Full finding in "Open decisions" above; left as-is
   pending a decision on adjusting the options, gating them on
   `material_type`, or leaving them.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (207 tests: 160 engine — including 8 new
`describeReadinessReason` cases — 39 server, 16 web — including new
`visualElementSentence`/`REFERENCE_STATUS_LABEL` regression coverage for
the exact "handmade wall art" scenario above). Live-browser-verified: the
Screen 7 CSS fix is unchanged and still in place; a seeded Blueprint state
reproducing the exact reported scenario rendered Section 4/8 cleanly (no
raw "undecided"/"to upload" tags) and a Readiness reason inline, screenshot
reviewed directly.

Two items were explicitly out of scope and only noted, not touched: voice
input timeout/cutoff behaviour, and Statement of Inspiration typography /
overall Blueprint visual formatting — both now recorded above under
"Known, deliberately deferred issues" so they aren't lost.

### 2026-09-01 — Raised Discovery/Association timeouts from real diagnostic data
A real `npm run diagnose-model` run against `claude-sonnet-4-5-20250929`
measured Association at 32310ms elapsed against its 30000ms production
budget (over budget) and Discovery at 12937ms against its 16000ms budget
(under, but only ~3s margin); Blueprint at 18718ms against 30000ms was
comfortable and left untouched, as were Provenance/Avoidance/Style
Reference. Raised Association's default to 40000ms and Discovery's to
20000ms in `engine/src/modelTimeouts.ts` (the shared source both server
and client import from — the client margin of +10000ms applies on top
automatically, no separate edit needed). Updated the two hardcoded
assertions in `engine/test/modelTimeouts.test.ts` that encoded the old
numbers (the ceiling cap and the exact-matrix check); no new test logic
added, per instruction. `docs/timeout-matrix.md` now documents the actual
measured elapsed times as the justification. This is one sample per
stage, not a confirmed stable ceiling — see the current-status section's
open item on this. Scope was deliberately narrow: no change to
`model_timeout`'s no-retry behaviour, no other route touched, no new
tests. Verified: typecheck and build clean across all three workspaces;
full test suite passes (193 tests: 144 engine, 39 server, 10 web).

### 2026-09-01 — Established this file as the canonical status/handoff doc
Converted the one-off `docs/session-summary.md` into this persistent,
append-only log plus an always-current status section, so there's a
single file to copy into another planning conversation instead of hunting
through session history or duplicating status in README. Prior content
preserved below as the first log entry; `docs/session-summary.md` itself
is left in place, unedited. README's Status section now points here
instead of restating status inline.

### 2026-09-01 — Reliability and developer-experience chapter (7 fixes)
*(Migrated verbatim from `docs/session-summary.md`, written after the
V3.0 feature-complete intake prototype was finished. This chapter was
triggered by real bugs found running the live app, not by new product
requests.)*

1. **Async/state race — unauthorized auto-advance** (`c9f948f`). Symptom:
   voice input silent, typed submission appeared to hang, screens rapidly
   auto-advanced/flickered, landed on Clarification with a stale
   `[client_timeout]` error. Root causes: no re-entrancy guard on
   model-backed screen actions; a stale/superseded response could still
   patch global state and drive navigation; the server's one silent retry
   gave each attempt a fresh full timeout instead of sharing one total
   budget, so the real worst-case silently doubled past the client's own
   timeout. Fix: `useAsyncAction` enforces re-entrancy and a staleness
   guard checked after every `await`; the retry now shares one total
   budget. Codified as the **USER-DECISION INVARIANT**: a user-facing
   selection may become confirmed only through an explicit, current user
   action; a timed-out, cancelled, superseded, or stale request must never
   mutate state or navigation. Full write-up:
   `docs/async-state-incident.md`.

2. **Dev-server ECANCELED crash** (`38d7b93`). Symptom: editing engine
   source while `npm run dev` was running eventually crashed the server
   with `ECANCELED`, after which Vite kept proxying to a dead backend.
   Root cause: `engine/package.json` pointed at raw `src/index.ts`, so
   `tsx watch` was watching and re-transpiling engine's source through the
   workspace symlink, racing its own restart supervisor. Fix: engine now
   resolves to built `dist/` with its own independent `tsc --watch`
   process; `npm run dev` became three coordinated processes instead of
   two. Full write-up: `docs/dev-server-reliability.md`.

3. **Blueprint product diagnostic** (`9f8e66b`). Trigger: the first real
   Blueprint from a live Anthropic call reached "PRIMARY ELEMENTS" with
   bare category placeholders never resolved into an actual visual
   proposition, plus an incoherent "Graphic realism" phrase and a
   "client-led... requiring collaborative input" self-contradiction. Root
   causes spanned four layers: the Association Engine schema had no
   concept of "concrete visual proposition" vs. placeholder; Screen 7's
   `confirm()` had zero gate against an unresolved category becoming a
   confirmed element; the DesignConfirmation summary builder interpolated
   raw stored enum values into the Blueprint Writer's input instead of
   human labels (the actual mechanical cause of both surface bugs);
   readiness landed on the right answer by coincidence, not a
   deterministic check. Fix (smallest-principled, no wholesale rewrite):
   candidates now carry a `resolution_state` + one micro-question asked
   inline only when needed; a new `hasUnresolvedPrimaryImagery()` engine
   helper feeds readiness deterministically; the summary builder routes
   every value through label functions; three targeted Blueprint Writer
   prompt rules.

4. **Stage-aware model timeouts** (`71f4504`). Trigger: Association timed
   out at the previous universal 20s budget — its schema isn't comparable
   to Provenance's handful of short fields. Fix: per-route timeout
   budgets (`engine/src/modelTimeouts.ts`) instead of one number for every
   route — `provenance`/`avoidance` 10s, `style_reference` 12s,
   `discovery` 16s, `association`/`blueprint` 30s, env-overridable per
   route. `model_timeout` is no longer retried (the shared-budget retry
   design already meant a retry after one would get ~0ms). Full reasoning
   and matrix: `docs/timeout-matrix.md`.

5. **Real-latency diagnostic instrumentation** (`e429327`). Trigger:
   Association still timed out at the raised 30s ceiling in a fresh real
   run. Fix: every real model-call attempt now logs one `[model-timing]`
   line (stage, outcome, elapsed, budget, token usage/throughput on
   success) — diagnostic only, no behaviour change — so the next real
   timeout is measurable instead of guessed at.

6. **Local dev workflow overhaul** (`f78d9c8`). Trigger: manually
   coordinating three terminals, checking ports, and clearing localStorage
   by hand had become an unacceptable workflow. Fix: two commands —
   `npm run dev` (rewritten launcher that fails fast naming the exact
   PID/command holding a port, and guarantees full process-group teardown
   on Ctrl+C) and `npm run validate:local` (one full diagnostic:
   environment → build/typecheck/tests → a real stack boot → three real
   Anthropic latency measurements → a browser journey → one compact
   PASS/FAIL/BLOCKED report). Also added a dev-only "Start fresh test
   journey" button. README trimmed to the two-command workflow; detail
   moved to `docs/local-dev-troubleshooting.md`. Proved clean on a fresh
   start: no orphaned processes, immediate restart works.

7. **Web test suite never exiting** (`619bc12`). Trigger:
   `npm run validate:local` (and standalone `npm test`) hung during the
   web workspace's Vitest run — all tests reported passing, process never
   returned to the shell. Root cause: `@testing-library/react` only
   auto-registers `afterEach(cleanup)` when it finds a global `afterEach`,
   which this project's config never set; 4 of 6 tests in
   `useAsyncAction.test.tsx` never called their own `unmount()` and relied
   entirely on that auto-cleanup, which never ran. Confirmed this wasn't a
   benign leak: reverting the fix made 7 of 10 tests actively fail with
   `ReferenceError: document is not defined` — real corruption of the
   jsdom environment, not just a resource leak. Fix: `web/vitest.setup.ts`
   explicitly registers cleanup via `setupFiles`. Verified `npm test` and
   `npm run validate:local` both return to the shell under a hard
   `timeout` guard — no `--forceExit`, no arbitrary timeout added.

**Where things stood at the end of that chapter:** 202 unit tests passing,
typecheck/build clean, the two-command local workflow proven on a clean
start, and Association's real-world latency left as the one open item
requiring a real API key to measure before a fix direction is chosen.

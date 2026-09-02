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
commands (`npm run dev`, `npm run validate:local` — see README). A live,
full end-to-end browser test journey (screenshots + the resulting
Blueprint document reviewed directly, not `diagnose-model`) then surfaced
and fixed two more real bugs — see the latest session log entry. 207 unit
tests pass across engine/server/web; typecheck and build are clean across
all three workspaces.

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
  or leave it.
- **§15.7 production launch blockers** (encrypted-at-rest storage,
  project-scoped access control, deletion/retention, training-use policy,
  legal review of the consent flow) are all still open — see README.md's
  "Production launch blockers" section for the full, unchanged list. None
  of this build's upload paths should be treated as production-ready
  until those are deliberately resolved.

**Known, deliberately deferred issues (not lost, just not this chapter's scope):**
- **Voice input timeout/cutoff behaviour** — a roughly 10s recording limit
  and roughly 3s silence timeout were observed to cut off voice input
  during a live test. Values are from user observation, not measured
  instrumentation. Deliberately deferred; needs its own investigation.
- **Statement of Inspiration typography and overall Blueprint visual
  formatting/premium polish** — deliberately deferred to a later,
  dedicated polish pass, not current work.

**Known risks:** the timeout numbers above are provisional (see the open
decision); nothing else newly introduced this session. See
`docs/session-summary.md` and the incident docs it links
(`docs/async-state-incident.md`, `docs/dev-server-reliability.md`,
`docs/timeout-matrix.md`) for the detailed history behind how the codebase
got to its current, tested state.

## Session log

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

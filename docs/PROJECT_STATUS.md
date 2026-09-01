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
commands (`npm run dev`, `npm run validate:local` — see README). 193 unit
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
- **§15.7 production launch blockers** (encrypted-at-rest storage,
  project-scoped access control, deletion/retention, training-use policy,
  legal review of the consent flow) are all still open — see README.md's
  "Production launch blockers" section for the full, unchanged list. None
  of this build's upload paths should be treated as production-ready
  until those are deliberately resolved.

**Known risks:** the timeout numbers above are provisional (see the open
decision); nothing else newly introduced this session. See
`docs/session-summary.md` and the incident docs it links
(`docs/async-state-incident.md`, `docs/dev-server-reliability.md`,
`docs/timeout-matrix.md`) for the detailed history behind how the codebase
got to its current, tested state.

## Session log

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

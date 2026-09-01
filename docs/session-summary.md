# Session summary: reliability and developer-experience work

Context: this covers the work done after the V3.0 feature-complete intake
prototype was finished (Screens 1–13, the deterministic engine, reference/
consent flow, etc. — see `README.md`'s Status section and the earlier
commit history). This chapter is entirely about making the *live app*
trustworthy and the *local workflow* usable, triggered by real bugs found
running the app for real rather than by new product requests. Seven
commits, in order:

## 1. Async/state race — unauthorized auto-advance (`c9f948f`)

**Symptom reported:** voice input silent, typed submission appeared to
hang, screens rapidly auto-advanced/flickered, landed on Clarification
with a stale `[client_timeout]` error.

**Root causes found** (full write-up: `docs/async-state-incident.md`):
- No re-entrancy guard on model-backed screen actions — a user could fire
  a second real API call before the first settled.
- A stale/superseded response could still patch global state and drive
  navigation after the user had already moved on or a retry had started.
- The server's one silent retry (on a transient failure) was giving each
  attempt its own *fresh* full timeout instead of sharing one total
  budget, so the server's real worst-case silently doubled — long enough
  that the client's own timeout fired first, guaranteeing a stale error
  even on requests that would have succeeded.

**Fix:** `useAsyncAction` (`web/src/journey/useAsyncAction.ts`) — the one
sanctioned way to run a model-backed action — enforces re-entrancy
(synchronous no-op on a second call while one is in flight) and staleness
(`guard.isStale()`, checked after every `await`, blocks any state mutation
or navigation from a superseded or post-unmount call). `modelClient.ts`'s
retry now shares one total wall-clock budget across both attempts.
Codified as the **USER-DECISION INVARIANT**: a user-facing selection may
become confirmed only through an explicit, current user action; a timed-
out, cancelled, superseded, or stale request must never mutate state or
navigation. Verified against the real server/model-double architecture
(`test-integration/asyncStateRace.mjs`), not just mocked routes.

## 2. Dev-server ECANCELED crash (`38d7b93`)

**Symptom reported:** editing engine source while `npm run dev` was
running eventually crashed the server with `ECANCELED`, after which Vite
kept proxying to a dead backend.

**Root cause** (full write-up: `docs/dev-server-reliability.md`):
`engine/package.json` pointed `main`/`types` at raw `src/index.ts`, so
`tsx watch` (the server's dev runner) was watching and re-transpiling
engine's *source* through the workspace symlink on every edit — racing
its own restart-on-change supervisor against an in-flight transform of a
large, foreign module graph it was never meant to own.

**Fix:** `engine/package.json` now resolves to built `dist/`, with its own
independent `tsc --watch` process. The root `dev` script became three
coordinated processes (engine watch-build, server, web) instead of two,
so editing engine/src never touches tsx's fragile transform path at all.

## 3. Blueprint product diagnostic (`9f8e66b`)

**Trigger:** the first real Blueprint from a live Anthropic call (a
parent/daughter memorial concept) reached "PRIMARY ELEMENTS" with bare
category placeholders — "a new drawing or symbol representing the bond",
"a specific object that belongs to Athena" — never resolved into an
actual visual proposition, plus an incoherent "Graphic realism" phrase and
a "client-led... requiring collaborative input" self-contradiction.

**Root causes traced to four separate layers**, not one bug:
- **Association Engine schema** had no concept of "concrete visual
  proposition" vs. "category placeholder" — any free-text description
  passed validation.
- **Screen 7's `confirm()`** had zero gate preventing an unresolved
  category from becoming a confirmed `VisualElement`.
- **DesignConfirmation's summary builder** interpolated *raw stored enum
  values* into the Blueprint Writer's input (`"realism graphic"`,
  `"client_led"`) instead of human labels — the actual mechanical cause of
  "Graphic realism" and the client-led/collaborative contradiction.
- **Readiness** landed on the right answer (`needs_refinement`) by
  coincidence — it depended on the Association Engine optionally
  self-reporting a contradiction, not a deterministic check.

**Fix (smallest-principled, per explicit instruction — no wholesale
rewrite):** candidates now carry `resolution_state` (`concrete` |
`needs_client_specific_detail`) + a `follow_up_prompt`; Screen 7 asks that
one micro-question inline only when needed (never for concrete or
deliberately-abstract candidates); a new `hasUnresolvedPrimaryImagery()`
engine helper feeds `needs_refinement` deterministically; the summary
builder now routes every value through label functions, never raw enums;
three targeted Blueprint Writer prompt rules (never call client-led
"collaborative"; state each fact once; never concatenate a dimension's
name onto its value). Verified live in a browser: the micro-question gate
fires only for the genuine placeholder candidate.

## 4. Stage-aware model timeouts (`71f4504`)

**Trigger:** Association timed out at the previous universal 20s budget —
its schema (an array of candidates, 6 numeric scores each, plus the new
concreteness judgement) is not comparable to Provenance's handful of short
fields.

**Fix:** per-route timeout budgets (`engine/src/modelTimeouts.ts`, the one
place both server and client import from) instead of one number for every
route: `provenance`/`avoidance` 10s, `style_reference` 12s, `discovery`
16s, `association`/`blueprint` 30s (client = budget + 10s margin),
env-overridable per route. `model_timeout` is no longer retried — the
existing shared-budget retry design already meant a first-attempt timeout
consumes essentially the whole budget, so a "retry" would get ~0ms and
never actually re-call the model; excluding it makes that explicit by
construction. A `model_timeout`'s error detail now carries
`{stage, elapsedMs, budgetMs}`, surfaced in dev-mode-only error responses.
Full reasoning and the final matrix: `docs/timeout-matrix.md`.

## 5. Real-latency diagnostic instrumentation (`e429327`)

**Trigger:** Association still timed out at the *raised* 30s ceiling in a
fresh real run — UI stayed stable (proving item 1's fix held), so this was
purely "is 30s enough", not a repeat of either prior incident.

**Fix:** rather than guess at a new number, every real model-call attempt
now logs one `[model-timing]` line (stage, outcome, elapsed, budget, and
on success Anthropic's own token usage + derived throughput) — diagnostic
only, no behaviour change, so the next real timeout is measurable instead
of guessed at.

## 6. Local dev workflow overhaul (`f78d9c8`)

**Trigger:** explicit complaint that manually coordinating three
terminals, checking ports, clearing localStorage, and relaying
infrastructure failures one at a time had become an unacceptable
workflow.

**Fix:** two commands.
- **`npm run dev`** — rewritten launcher (`scripts/dev.mjs` +
  `scripts/lib/devStack.mjs`) that fails fast naming the exact PID/command
  holding a port, and guarantees full process-group teardown on
  Ctrl+C/SIGTERM (every spawned tool gets its own detached group, so
  killing it takes the whole subtree — tsx's supervised child, esbuild's
  service, everything). Caught and fixed a real bug while building this:
  `asyncStateRace.mjs`'s old teardown (`.kill()` on a wrapper process)
  left a zombie `tsx` process pinning port 8787.
- **`npm run validate:local`** — one full diagnostic: environment (Node
  version, deps, `.env`, API key presence without printing it, configured
  model, timeout matrix, free ports) → build/typecheck/unit/integration/
  dev-reliability tests → a real stack boot and teardown → three real
  Anthropic latency measurements (up to 120s each, independent of
  production budgets) → a browser journey (real server, real Vite, fake
  model responses) proving Screen 7 renders candidates, no duplicate
  submit, no stale mutation, no dead backend, `/api/blueprint` reachable.
  One compact PASS/FAIL/BLOCKED report; verbose output to a logged file.
- A dev-only "Start fresh test journey" button, clearing exactly the two
  localStorage keys this app owns and reloading to Screen 1.
- README trimmed to the two-command workflow; detail moved to
  `docs/local-dev-troubleshooting.md`.

Proved on a clean start: `validate:local` runs twice cleanly (~85s each);
`npm run dev` boots the stack, SIGINT tears down every process with zero
leftovers, and an immediate restart works.

## 7. Web test suite never exiting (`619bc12`)

**Trigger:** `npm run validate:local` (and standalone `npm test`) hung
during the web workspace's Vitest run — all tests reported passing, but
the process never returned to the shell.

**Root cause:** `@testing-library/react` only auto-registers its own
`afterEach(cleanup)` when it finds a global `afterEach` on `globalThis`.
This project's `vitest.config.ts` never set `test.globals: true`, so that
global never existed and cleanup silently never registered. 4 of
`useAsyncAction.test.tsx`'s 6 tests never called their own `unmount()`,
relying entirely on that auto-cleanup — which never ran. Confirmed this
wasn't a benign leak by reverting the fix: 7 of 10 tests then actively
failed with `ReferenceError: document is not defined`, real corruption of
the jsdom environment for later tests in the file — exactly the kind of
lingering, platform-timing-dependent state that can leave Node's event
loop non-empty on one machine and not another.

**Fix:** `web/vitest.setup.ts` explicitly registers `afterEach(cleanup)`,
wired via `vitest.config.ts`'s `setupFiles` — fixes the actual gap without
flipping `test.globals` for every file. Added a regression test asserting
the DOM is empty between tests, and verified it actually catches the bug
(reverted, watched the 7 failures reproduce, restored). Verified `npm
test` and `npm run validate:local` both return to the shell under a hard
`timeout` guard — no `--forceExit`, no arbitrary timeout added.

## Where things stand

- 202 unit tests pass across engine/server/web; typecheck and build clean
  across all three workspaces.
- The two-command local workflow (`npm run dev`, `npm run validate:local`)
  is in place and proven on a clean start.
- **Open, requires your decision:** Association's real-world latency
  against the actually-configured model (`claude-sonnet-4-5-20250929` per
  `server/.env`, unless changed) still needs measuring with a real API
  key — `npm run validate:local`'s live-diagnostics section (or
  standalone `npm run diagnose-model`) is what answers that. Once you have
  a real number, the fix (raise the ceiling further / a faster model for
  interactive stages / trim the Association schema / streaming / split the
  work) is a product decision this session deliberately left to you rather
  than guessing at.

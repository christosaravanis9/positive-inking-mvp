# Local development: troubleshooting and detail

The README's Local Development section covers the normal workflow. This is
everything else: what to do when something's wrong, and what each piece
actually checks.

## "Port 8787/5173 is already in use"

`npm run dev` and `npm run validate:local` both fail fast with the exact
PID and process name holding the port, rather than half-starting the
stack. Kill it (the message includes the command), or if it's an old copy
of this project's own server/web, that's almost certainly what's running:

```
kill <pid>
```

If you just ran `npm run dev` and Ctrl+C'd it, give it a second or two —
the OS can take a brief moment to actually release a socket after a
process is killed. Both commands already retry the port check for ~1.5s
before reporting a real conflict for exactly this reason; if it still
fails after that, something is genuinely still listening.

## "npm run dev" failed to start cleanly

The output names which of engine/server/web didn't come up and why
(a TypeScript compile error, a port conflict, or an unexpected early
exit). Everything is torn down automatically before the command returns —
there's nothing left running to clean up by hand.

## No orphaned processes, ever

Every process `npm run dev` and `npm run validate:local` spawn (engine's
`tsc --watch`, server's `tsx watch`, web's `vite`, and vite/tsx's own child
processes) runs in its own detached process group. Shutdown sends SIGTERM
to the whole group, waits briefly, then SIGKILL if anything's still alive.
If you ever do find a leftover process (e.g. after a hard crash of the
terminal itself, not a normal Ctrl+C), it's a real bug — the same technique
is unit-tested in `test-integration/devServerReliability.mjs`.

## What `npm run validate:local` actually checks, section by section

1. **Environment** — Node version, that `npm install` has actually been
   run, that `server/.env` exists, that `ANTHROPIC_API_KEY` is set
   (presence only — the value is never printed), the configured
   `ANTHROPIC_MODEL`, the resolved timeout matrix (defaults plus any
   per-route env overrides — see `docs/timeout-matrix.md`), and that
   ports 5173/8787 are free.
2. **Build/test** — `engine` build, `npm run typecheck`, `npm test`
   (all three workspaces), `npm run test:integration`
   (`docs/async-state-incident.md`), `npm run test:dev-reliability`
   (`docs/dev-server-reliability.md`).
3. **Local stack** — boots the real dev stack (the same code path
   `npm run dev` uses), confirms the engine watcher, server, and web are
   all reachable, that a representative fetch to every model-backed route
   gets a real response, then tears the stack down and confirms the ports
   are actually free afterward.
4. **Real model diagnostics** — see below.
5. **Browser journey** — a real server + real Vite + a fake, controllable
   Anthropic double (never your real key) drives Story → Discovery →
   Screen 7 through the real UI, confirms Association candidates render
   and confirming one advances the journey, confirms a request delayed
   past a simulated navigate-away never mutates state or leaves the
   backend dead, and confirms `/api/blueprint` is reachable on the live
   server. It does not click through every remaining screen by hand —
   route- and engine-level tests already cover those individually.

A row can be `PASS`, `FAIL`, or `BLOCKED`. `BLOCKED` means a prerequisite
is missing (most commonly no `ANTHROPIC_API_KEY`, which blocks only the
live-diagnostics section) — it is not the same as something being broken,
and the report says so explicitly.

## Real model latency diagnostics (`npm run diagnose-model`)

`npm run validate:local`'s live-API section is also runnable on its own:

```bash
npm run diagnose-model
```

Makes three real calls to your configured Anthropic model — Discovery,
Association, and Blueprint — using small, generic, non-sensitive fixture
text (never a real story). Each call gets up to 120 seconds (env-
overridable via `DIAGNOSTIC_TIMEOUT_MS`), deliberately independent of the
production timeout budgets in `docs/timeout-matrix.md` — the point is to
measure real completion time, not to reproduce the production ceiling.
Prints stage, model, elapsed time, outcome, the configured production
budget, `max_tokens`, input character count, and Anthropic's own
input/output token usage. Never prints the API key, the fixture text, or
any real user content.

`npm run verify-model` is the older, narrower sibling: one real Discovery
call, printing the full parsed response, useful for sanity-checking the
model round trip in isolation without the rest of the diagnostic.

## Playwright / browser journey fails with a missing-browser error

`validate:local`'s browser journey and the integration tests need
Playwright's own Chromium. One-time setup if you've never used Playwright
on this machine before:

```bash
npx playwright install chromium
```

## Verbose output

`npm run validate:local` only prints the compact report to the terminal.
Every subprocess's full output (build logs, test output, the real model
calls, the browser journey) goes to `logs/validate-local-<timestamp>.log`,
whose path is printed at the end of the report. `logs/` is gitignored.

## Related docs

- `docs/timeout-matrix.md` — per-route model-call timeout budgets and why.
- `docs/async-state-incident.md` — the USER-DECISION INVARIANT (a timed-
  out, cancelled, superseded, or stale request must never mutate state or
  navigation) and the race that led to it.
- `docs/dev-server-reliability.md` — the ECANCELED dev-server crash this
  tooling phase's process-group-based teardown builds on.

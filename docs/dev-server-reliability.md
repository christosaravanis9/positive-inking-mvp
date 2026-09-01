# Dev-server reliability: the ECANCELED crash and its fix

## What happened

During live local testing, editing an `engine/src/*.ts` file while
`npm run dev` was running eventually crashed the server process with:

```
Error: ECANCELED: operation canceled, read
    at ... node:fs:441
    at defaultLoadImpl
    at Module._load
    at ... tsx/dist/cjs/index.cjs
```

After that, the server process exited and never came back. Vite stayed
alive, but every `/api/*` request it proxied to `http://localhost:8787`
failed with `ECONNREFUSED` — a live HTTP 500 in the browser that had
nothing to do with Blueprint generation itself; the backend simply was
not listening anymore.

## Root cause

`engine/package.json` pointed its `"main"`/`"types"` fields directly at
`src/index.ts` — raw TypeScript, not built output. `server`'s dev script
is `tsx watch src/index.ts`. `server` depends on `@positive-inking/engine`
via the npm workspace symlink (`node_modules/@positive-inking/engine ->
../../engine`), and `tsx watch` follows the **resolved module graph** of
whatever it's watching, dereferencing symlinks — so it was not only
watching `server/src/**`, it was watching every file transitively
reachable from `engine/src/index.ts` too. Confirmed directly: touching
`engine/src/visualRanking.ts` while the server was running printed
`[tsx] change in ./../engine/src/visualRanking.ts Restarting...` in the
server's own watch log.

That means every edit to engine source forced tsx to re-run its
on-the-fly TypeScript transform (the same machinery `tsx/dist/cjs/
index.cjs`'s `Module._load` patch and the ESM loader hook both provide)
over a large, foreign, re-export-heavy module graph it doesn't own,
**at exactly the moment it was also killing and respawning the child
process** to pick up the change. `ECANCELED` on a `fs` read inside
`defaultLoadImpl` is the signature of that restart racing an in-flight
transform read: the old child gets SIGTERM while tsx's loader hook is
mid-read for a module it's in the process of transpiling, the underlying
libuv read is aborted, and tsx's own teardown does not appear to catch
that specific case — it surfaces as an uncaught exception that kills the
whole watch supervisor, not just the doomed child.

**This could not be forced to reproduce byte-for-byte in this sandbox**
(single rapid edits and even large parallel bursts across ten engine
files all recovered cleanly here — file-watcher timing is inherently
platform-dependent: inotify here, almost certainly FSEvents-based
watching on the machine where this was first observed, with different
coalescing behaviour). What **was** reproduced and confirmed directly,
with a throwaway diagnostic server, is the precondition: tsx watch really
does dereference the workspace symlink and really does watch
`engine/src/*.ts`, and the process tree really is a supervisor
(`tsx watch`) that kills and respawns a child app process
(`node --import tsx/dist/loader.mjs ... src/index.ts`) on every change —
exactly the shape of race the reported stack trace describes. The fix
below removes that precondition entirely rather than trying to catch a
race that is inherently timing- and platform-dependent.

## Answers to the specific questions raised

1. **Why does tsx watch crash with ECANCELED?** A file-watch restart
   (SIGTERM to the child) racing tsx's own TS-transform loader hook
   mid-read, while it is transpiling raw TypeScript from a large foreign
   module graph (engine/src, reached via the workspace symlink) that it
   was never meant to own in the first place.
2. **Does the monorepo dev command cause overlapping restarts between
   engine/server/web?** Before this fix: no separate engine process
   existed at all -- tsx was doing engine's "compilation" as a side effect
   of transpiling engine/src on every server restart, coupling engine's
   edit cycle directly to the server's restart cycle. Web (Vite) was
   never implicated; it stayed alive throughout, exactly as reported.
3. **Do workspace dependency changes under engine/src force the server
   watcher into an unsafe state?** Yes -- confirmed directly (see above).
   This was the actual mechanism, matching item 3 exactly.
4. **Are multiple tsx processes spawned or left behind?** `tsx watch` is
   a supervisor (its own `sh -c` wrapper, then a `tsx watch` Node process)
   that spawns one child app process
   (`node --require tsx/dist/preflight.cjs --import tsx/dist/loader.mjs
   src/index.ts`) plus a persistent shared `esbuild --service` process
   reused across restarts. Confirmed via the real process tree. No extra
   zombies were observed accumulating across repeated restarts in this
   environment; the fix's own regression test (below) checks for this on
   every run regardless.
5. **Did the async-state-race fix change file-watch/restart behaviour?**
   No. That fix touched only application source (screens, modelClient.ts,
   requestAbort.ts, env.ts) -- no package.json scripts, no tsconfig, no
   watch configuration. The watch-coupling bug was latent in the original
   monorepo scaffolding from Phase 1 and simply had not been exercised by
   a live dev session with simultaneous engine edits until now.
6. **Should the server run against a built engine package rather than
   watching source imports directly? Yes -- this is the fix**, below.
7. **Is the current `concurrently` setup appropriate?** Not as it stood:
   it ran server and web, and let tsx's transform hook silently stand in
   for a real engine build step. The fix adds engine as a proper third
   concurrently-managed process with its own build step, matching how the
   other two packages already work.

## The fix

- `engine/package.json`: `"main"`/`"types"` now point at
  `dist/index.js`/`dist/index.d.ts` (previously `src/index.ts`). Added a
  `"dev": "tsc -p tsconfig.json --outDir dist --watch --preserveWatchOutput"`
  script -- a real, incremental TypeScript watch-build, completely
  independent of tsx.
- Root `package.json`'s `dev` script now builds engine once, then runs
  **three** concurrent processes instead of two: engine's watch-build,
  server's `tsx watch`, and web's `vite`. `test` and `typecheck` now build
  engine first too, since server's typecheck/tests now resolve
  `@positive-inking/engine` through `dist/`.
- Engine's own tests and typecheck are unaffected: `engine/test/*.ts`
  files import directly from relative `../src/*.js` paths, never through
  the package's own `main`/`types` fields.

With this in place, tsx watch's module graph resolves `@positive-inking/
engine` to `engine/dist/index.js` -- **plain, already-compiled
JavaScript**. Editing `engine/src/*.ts` now triggers engine's own `tsc
--watch` to recompile (a process entirely separate from tsx, using
TypeScript's own incremental compiler, which emits complete files
atomically), which touches `engine/dist/*.js`, which tsx's watcher then
sees as an ordinary dependency change and restarts the server for --
without ever invoking tsx's fragile TS-transform loader hook against
engine's source at all. The crash's precondition is gone by construction,
not caught-and-retried.

Per the explicit requirement, **this is not a restart wrapper**: nothing
auto-restarts tsx if it dies, nothing retries a crashed process. The fix
removes the code path that could crash in the first place.

## Verification

`test-integration/devServerReliability.mjs` (`npm run test:dev-reliability`)
runs the real `npm run dev` (all three processes) and repeats the exact
stress pattern used to investigate this: parallel bursts of edits across
ten `engine/src/*.ts` files, checking the server's `/api/health` endpoint
recovers after each burst, across four rounds plus a final check, then
verifies no duplicate/leaked tsx app process remains. All checks pass
against the fixed configuration. This is a verification script, not
production tooling -- it does not add any restart-on-crash behaviour to
the app itself, only asserts that the dev command, as shipped, keeps the
backend reachable.

`npm run typecheck`, `npm test` (134 engine + 22 server + 6 web tests),
and `npm run build` all still pass unchanged with the new `main`/`types`
resolution.

## Was Blueprint generation itself ever reached in the failed run?

No. The reported HTTP 500 / `unknown_error` in the browser was Vite's own
proxy failing with `ECONNREFUSED` because the backend was not listening on
port 8787 at all -- the request never reached Express, so it never reached
the `/api/blueprint` route, `modelClient.ts`, or Anthropic. This is
confirmed by the terminal evidence itself (`[vite] http proxy error:
/api/blueprint AggregateError [ECONNREFUSED]`) and is why this was
diagnosed and fixed as a dev-server/watch-process reliability issue, not
a Blueprint prompt or schema issue.

# Async/state race incident: root cause and the fix

## What happened

During real (non-mocked) testing against the live Anthropic API, a user on
the Story screen (§8 Screen 3) saw: voice input not work, a normal text
submission appear to do nothing, then the app rapidly cycle through several
screens on its own, landing on Clarification with a `[client_timeout]
Understanding your story` error banner showing — a context string that
belongs to a *different* screen than the one on display.

No screen should ever advance, and no answer should ever become confirmed,
except through an explicit user action. This incident violated that in two
distinct ways, both traced to the same underlying gap.

## Root cause

**`state.ui.loading` was written but never read.** Every model-backed
screen called `beginAttempt()` (which sets `ui.loading = true`) before its
network call, but not one screen's submit button checked it. Combined with
zero visual loading feedback on the Story screen specifically, a user
seeing nothing happen after clicking Continue had every reason to click it
again — and the button let them, firing a second, fully independent
`/api/discovery` call while the first was still in flight.

From there, two failures compounded:

1. **No re-entrancy guard.** Two (or more) concurrent calls to the same
   screen's submit handler meant two independent promises, each racing
   toward its own `patchProject`/`patchUI` call with no coordination.
   Whichever one *resolved last* — not whichever the user most recently
   intended — is the one that won, regardless of order, relevance, or
   whether the user had since retried or the request had timed out.
2. **No staleness/mount check.** A promise from an unmounted screen (the
   user has already navigated on) could still resolve and call the shared
   `setError()`, writing to the single global `ui.error` slot. Whatever
   screen was current at that moment would render it via its own
   `<AsyncError>`, with the wrong `context` and the wrong `onRetry` handler
   wired to a screen the user isn't looking at.

Separately, `server/src/modelClient.ts`'s retry policy made the failure
mode worse than it needed to be: on a transient failure (including its own
timeout) it retried once, but the retry got a **fresh full timeout window**
rather than sharing the original budget. With the default
`MODEL_REQUEST_TIMEOUT_MS=20000`, the server's real worst case was up to
**40 seconds** across two attempts — while the client's own fetch timeout
was a fixed 25 seconds, guaranteeing the client would give up mid-retry on
any request that needed one, even when the server would have succeeded
seconds later.

Three of `ElementsDiscovery.tsx`, `Avoidances.tsx`, and `Clarification.tsx`
also auto-fire a model call (or, for Clarification, a telemetry event) from
a `useEffect` on mount, guarded only by React state (`fetching`, or the `[]`
dependency array alone). React 18 StrictMode's dev-mode double-invoke of
effects calls that body twice in the same synchronous tick — before any
`setState` from the first invocation has committed — so a state-based guard
does not prevent a real duplicate network call there either. This was
empirically confirmed independently while testing §22's instrumentation
(`journey_started` logged twice per mount) before this incident.

## The user-decision invariant

> A user-facing selection may become confirmed only through an explicit,
> current user action. A screen may advance only after the user explicitly
> submits/confirms it, or the spec explicitly defines that screen as
> automatic. Receiving model data alone must never simulate a user
> selection or automatically confirm a decision. A superseded, cancelled,
> or post-unmount response must never mutate project/ui state or drive
> navigation, no matter when it resolves.

This is now enforced structurally, not by convention, via
`web/src/journey/useAsyncAction.ts` — see its own doc comment for the full
mechanism (synchronous ref-based re-entrancy guard, per-call staleness
token, mount tracking, centralised error handling). Every model-backed
screen in this codebase goes through it; there is no other sanctioned way
to call a model endpoint from a screen component.

**Adding a new model-backed screen?** Use `useAsyncAction`'s `run()`, check
`guard.isStale()` after every `await` before touching `patchProject`/
`patchUI`, and use the returned `pending` to disable the submit control and
show a loading state. Do not call `beginAttempt`/`setError` directly, and
do not fire a model call from a `useEffect` without going through `run()` —
a React-state-only guard does not survive StrictMode's double-invoke.

## The timeout fix

`callModelForStructuredOutput` now tracks one **total** wall-clock budget
(`MODEL_REQUEST_TIMEOUT_MS`, default 20000ms) across both the original
attempt and its one silent retry, rather than giving each attempt a fresh
full window. The server's real worst case is now bounded by that one
number, predictably, regardless of retries. `web/src/api/client.ts`'s
`CLIENT_TIMEOUT_MS` (30000ms) now has genuine, documented margin above that
bound. Each file cross-references the other; if either value changes, check
the other.

The server also now aborts its outbound Anthropic call when the client
disconnects (`server/src/requestAbort.ts`, wired into every route) — not a
correctness requirement once the client-side guards above exist (a stale
server response can no longer reach client state at all), but it stops
paying for and running API calls nobody is waiting for anymore.

**This abort-on-disconnect fix itself shipped with a real bug on the first
pass**, only caught by the real-architecture integration test described
below: it originally listened on the Express *request*'s `"close"` event.
Confirmed directly with a throwaway diagnostic server: `req`'s `"close"`
fires as soon as the request body has finished being read — about 1ms
after the request arrives — regardless of whether a response has been
sent, because that event just means "this readable stream is done," not
"the connection is gone." Wired to an abort, that would have cancelled the
outbound model call within a millisecond of every single real request,
making every model-backed screen in the app permanently broken. The fix
listens on the *response*'s `"close"` event instead, checked against
`res.writableEnded`: that only fires early, with `writableEnded` still
false, on a genuine premature disconnect — confirmed the same way, and now
covered by `server/test/requestAbort.test.ts`.

## The real-architecture integration test

Mocked route interception (Playwright's `page.route()`) cannot exercise
either the timeout-budget fix or the abort-signal fix, because both live
in code Playwright's mocking bypasses entirely: the real Express routes,
the real `modelClient.ts` retry loop, and Node's real `req`/`res` event
semantics. `test-integration/asyncStateRace.mjs` runs the actual
architecture end to end — the real server, the real routes, the real
`modelClient.ts`, the real Vite-served React app — with only the literal
Anthropic HTTP endpoint swapped for a local, controllable double
(`test-integration/fakeAnthropic.mjs`), since no live API key is available
in this environment. Run it with `npm run test:integration` (it is not
part of the fast `npm test`, which stays deterministic and network-free by
design — this spins up three real processes and takes real wall-clock
time to run its delay/timeout scenarios).

It reproduces, against that real stack: a response delayed below the
total budget (succeeds normally, exactly one request fires); a delay that
exceeds the total budget (a scoped, correctly-attributed timeout error,
the user's text preserved, no cascade to another screen), followed by an
explicit retry that succeeds cleanly; a rapid double submit against a
slow-but-successful response (exactly one request fires despite two
clicks); and navigating away while a request is still in flight (no stale
error banner leaks onto the screen the user landed on). All 15 checks
across those 4 scenarios pass against the fixed code — and finding the
`req` vs `res` "close" bug above was a direct product of this test
catching a real discrepancy (the fake double answered correctly in
isolation via `curl`, but the browser-driven scenario still saw a
`model_timeout` every time) rather than a mocked test that would have
had no way to notice.

## Files changed

- `web/src/journey/useAsyncAction.ts` (new) — the guard hook.
- `web/src/journey/useAsyncAction.test.tsx` (new) — unit tests for the
  guard's re-entrancy, retry-after-completion, and post-unmount staleness
  guarantees, using Vitest + jsdom + `@testing-library/react` (new to
  `web/`; see `web/vitest.config.ts`).
- `web/src/screens/{Story,Clarification,ImageProvenance,ElementsDiscovery,Avoidances,StyleReference,DesignConfirmation}.tsx` —
  migrated every model-backed action to `run()`; each submit control now
  disables and shows a loading state while `pending`.
- `web/src/components/VoiceInput.tsx` — hardened against a Safari failure
  mode found while investigating this incident (see below).
- `web/src/api/client.ts` — `CLIENT_TIMEOUT_MS` raised with a documented,
  cross-referenced justification (not a bare number bump on its own — paired
  with the server-side budget fix below).
- `server/src/modelClient.ts` — retry now shares one total budget instead
  of each attempt getting a fresh timeout; accepts an optional
  `abortSignal`.
- `server/src/requestAbort.ts` (new) — turns a genuine premature client
  disconnect into an `AbortSignal`, via the response's `close` event (see
  below for why not the request's).
- `server/src/routes/*.ts` (all six) — wired
  `abortSignalForRequest(req, res)` into their `callModelForStructuredOutput`
  calls.
- `server/src/env.ts` — `anthropicApiUrl` overridable via `ANTHROPIC_API_URL`
  (used by the integration test below; never changes real traffic by
  default).
- `server/test/modelClient.test.ts` — new tests proving the total-budget
  behaviour (bounded wall-clock time across both attempts; no retry once
  budget is exhausted).
- `server/test/requestAbort.test.ts` (new) — proves `abortSignalForRequest`
  does not fire during normal handling or after a successful response, and
  does fire on a genuine client disconnect.
- `test-integration/asyncStateRace.mjs` (new) and
  `test-integration/fakeAnthropic.mjs` (new) — the real-architecture
  integration test described below, runnable via `npm run test:integration`.

## Voice input (Safari)

Investigating the reported "voice input did not work" symptom found a real,
separate bug in `VoiceInputButton`: `recognition.start()` was called with no
`try/catch`. Safari has been observed to throw a synchronous `DOMException`
from `start()` itself (not the async `onerror` event) when the OS-level
dictation/speech service isn't available — at which point the component had
already optimistically set its state to "Listening", and since `onerror`/
`onend` never fire after a synchronous throw, the button was left stuck
showing "Listening" forever with no error message. This looks identical to
"voice input did nothing." Fixed by wrapping both the constructor call and
`.start()` in `try/catch`, and adding an 8-second no-response safety timeout
as defense in depth against any other silent-hang mode. The underlying
"does this browser support `SpeechRecognition` at all" feature-detection
(the reason the button might not appear at all in some Safari versions,
particularly over a non-secure-context connection to a phone on the local
network rather than `localhost`) is unchanged and correct — the fix here is
specifically that *when* the API is present but fails, the failure now
surfaces visibly instead of leaving the control silently broken.

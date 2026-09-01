# Timeout matrix: stage-aware model-call budgets

## What happened

A real live journey hit `[model_timeout] Model request timed out after
20000ms.` on Screen 7's Association Engine call. Every model-backed route
shared one universal 20s server budget (`MODEL_REQUEST_TIMEOUT_MS`) and one
universal 30s client fetch timeout (`CLIENT_TIMEOUT_MS`). This was a real
latency problem, not a repeat of the earlier async-state race
(`docs/async-state-incident.md`): Screen 7 itself stayed stable, state was
untouched, and the error was exactly what it said — the call took longer
than the budget it was given.

The single-budget design was the wrong shape for the problem. Provenance
and Association are not comparable calls: Provenance extracts a handful of
short fields from a story the user already told; Association generates
several candidate visual elements, each carrying six numeric ranking
scores plus a concreteness judgement (`resolution_state` /
`follow_up_prompt`, added when the placeholder-leak defect was fixed —
see the Association Engine work earlier in this branch), classification
flags, and a contradictions list. Giving both the same 20s either starved
the heavy route or was needlessly generous for the light one.

## The matrix

| Route | Server budget (default) | Client timeout (budget + margin) | Why |
|---|---|---|---|
| `provenance` | 10000ms | 20000ms | Smallest schema (`server/src/schemas/provenance.ts`): `attraction_origin`, `origin_period`, `origin_source`, a short `personal_entities[]`, two scalars, one small nested object. Default `maxTokens` (2048), never raised by the route. Pure short-field extraction. |
| `avoidance` | 10000ms | 20000ms | Smallest possible shape: 5–7 short suggestion strings, nothing nested (`server/src/schemas/avoidance.ts`). Default `maxTokens`. |
| `style_reference` | 12000ms | 22000ms | A closed classification against a fixed 7-dimension vocabulary (`RESOLVABLE_STYLE_DIMENSIONS`), at most 7 `{dimension, value}` pairs plus two short text fields. More judgement than pure extraction (recognising a named style/artist and deciding what it does and doesn't settle), so a small step above the floor. Default `maxTokens`. |
| `discovery` | 16000ms | 26000ms | The largest field count of any route (14+ string/array fields — themes, personal people/places/objects/events/memories/phrases, open threads, a clarification decision, two confidence scores) but every field is short; this is semantic extraction and a judgement call (whether to clarify), not long-form generation. Default `maxTokens`. |
| `association` | 30000ms | 40000ms | The heaviest structured schema in the app: an array of candidate visual elements, each with `description`, `personal_meaning`, `source_category`, `resolution_state`, an optional `follow_up_prompt`, and 6 numeric ranking scores, plus top-level classification flags and a `contradictions_noticed[]` list. The route explicitly raises `maxTokens` to 4096 (double every other route) — the same signal used here to justify the largest timeout ceiling. This is the route that timed out in the reported incident. |
| `blueprint` | 30000ms | 40000ms | Fewer top-level fields than Association, but the most prose-heavy generation in the app: up to ~10 written sections (story/why, visual direction, artistic direction, placement, design considerations, statement of inspiration, artist brief). Also explicitly raises `maxTokens` to 4096. Generation *volume*, not field count, drives latency here, which is why it sits at the same ceiling as Association rather than lower. |

Defaults live in `engine/src/modelTimeouts.ts` (`MODEL_ROUTE_TIMEOUT_DEFAULTS_MS`),
the one place both `server/` and `web/` import from, so the two sides of the
client/server relationship can never independently drift. `CLIENT_TIMEOUT_MARGIN_MS`
(10000ms) is added on top of every route's server budget to get its client
timeout — comfortably above typical network/Express overhead, and asserted
directly in `engine/test/modelTimeouts.test.ts` rather than left as an
unchecked convention.

No route is unlimited: the highest ceiling (30s server / 40s client) is
still a hard bound, not a fallback to "wait indefinitely."

## Overriding a route's budget

Each route's server budget can be overridden independently via an env var
in `server/.env` (see `.env.example`):

```
MODEL_TIMEOUT_DISCOVERY_MS=16000
MODEL_TIMEOUT_PROVENANCE_MS=10000
MODEL_TIMEOUT_ASSOCIATION_MS=30000
MODEL_TIMEOUT_AVOIDANCE_MS=10000
MODEL_TIMEOUT_STYLE_REFERENCE_MS=12000
MODEL_TIMEOUT_BLUEPRINT_MS=30000
```

The old single `MODEL_REQUEST_TIMEOUT_MS` no longer exists — it applied one
number to every route regardless of how different their real latency is,
which is exactly the design this incident traced back to. The client's own
per-route timeout is not separately configurable at runtime (it's compiled
from the same `engine/src/modelTimeouts.ts` defaults plus the fixed
margin): if you raise a route's server budget via env far enough that it
would eat into the client's margin, also raise `CLIENT_TIMEOUT_MARGIN_MS`
in that one shared file. This is a single-deployment prototype (see the
README's "Production launch blockers" section) where server and client ship
together, so this is a deliberate simplicity trade-off, not an oversight.

## Retry policy

`callModelForStructuredOutput` (`server/src/modelClient.ts`) retries exactly
once, silently, on `model_network_error` or `model_http_error` — genuine
transient faults a fresh attempt can plausibly fix. It does **not** retry a
`model_timeout`. Two reasons:

1. A timeout means the call itself is inherently slow (model load, a heavy
   structured-output request), not a transient blip a same-budget retry
   fixes.
2. The retry already draws from the *same total budget* as the first
   attempt (this was itself a prior incident fix — see
   `docs/async-state-incident.md`), so a first-attempt timeout always
   consumes (very close to) the entire budget. A "retry" after one would
   get ~0ms of remaining budget and never actually re-call the model
   anyway. Excluding `model_timeout` from the retryable set makes this
   explicit by construction instead of relying on the remaining-budget
   check to always happen to land on zero.

This means retrying never doubles latency for the heavy routes: either the
first attempt succeeds inside its budget, or it times out and the error
surfaces immediately with no wasted second attempt.

## Timeout error reporting

A `model_timeout` `ModelError` now carries `{ stage, elapsedMs, budgetMs }`
in its `detail` (attached in `modelClient.ts`'s `attemptCall`). Every
route's catch block calls the new shared `sendModelErrorResponse` helper
(`server/src/errors.ts`), which attaches that detail to the JSON error
response only when `env.isDevelopment` is true (`NODE_ENV !== "production"`)
— so a developer immediately sees which route timed out, how long it
actually took, and what budget it was given, without a production response
ever carrying internal timing detail. None of `{ stage, elapsedMs,
budgetMs }` is a secret either way (no API key, no model name, no prompt
content) — the gate is about keeping the user-facing error contract
minimal in production, not about hiding sensitive data.

## Tests

- `engine/test/modelTimeouts.test.ts` — every route has a bounded, non-zero
  default; Association and Blueprint are strictly larger than every simple
  extraction route; every route's client timeout exceeds its server budget
  by the full margin; the matrix matches this document exactly.
- `server/test/modelClient.test.ts` — `stage` resolves the correct default
  timeout when no explicit `timeoutMs` is given (including a route-specific
  env override); `model_timeout` is no longer retried, `model_http_error`
  still is.
- `server/test/errors.test.ts` — `sendModelErrorResponse` attaches
  `{stage, elapsedMs, budgetMs}` in development, omits it in production, and
  never attaches it for a non-timeout error.
- `web/src/journey/useAsyncAction.test.tsx` (pre-existing, from the earlier
  async-state incident) already proves a timeout leaves the current
  screen/user input untouched and that a stale response — including one
  carrying `code: "client_timeout"` — can never mutate state after
  unmount/navigation. That guarantee is orthogonal to which budget a route
  is given, so it did not need new cases for this change; it's cited here
  because it's exactly requirement 8's "a timeout leaves current
  screen/user input untouched" and "stale responses still cannot mutate
  state" checks.

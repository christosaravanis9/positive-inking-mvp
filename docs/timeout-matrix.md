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
| `discovery` | 20000ms | 30000ms | The largest field count of any route (14+ string/array fields — themes, personal people/places/objects/events/memories/phrases, open threads, a clarification decision, two confidence scores) but every field is short; this is semantic extraction and a judgement call (whether to clarify), not long-form generation. Default `maxTokens`. Raised from 16000ms — see "Revised from real diagnostic data" below. |
| `association` | 40000ms | 50000ms | The heaviest structured schema in the app: an array of candidate visual elements, each with `description`, `personal_meaning`, `source_category`, `resolution_state`, an optional `follow_up_prompt`, and 6 numeric ranking scores, plus top-level classification flags and a `contradictions_noticed[]` list. The route explicitly raises `maxTokens` to 4096 (double every other route) — the same signal used here to justify the largest timeout ceiling. This is the route that timed out in the reported incident, twice. Raised from 30000ms — see "Revised from real diagnostic data" below. |
| `blueprint` | 30000ms | 40000ms | Fewer top-level fields than Association, but the most prose-heavy generation in the app: up to ~10 written sections (story/why, visual direction, artistic direction, placement, design considerations, statement of inspiration, artist brief). Also explicitly raises `maxTokens` to 4096. Generation *volume*, not field count, drives latency here, which is why it sits close to Association's ceiling rather than down with the simple routes. Not touched by the revision below — comfortable margin in the one real run so far. |

Defaults live in `engine/src/modelTimeouts.ts` (`MODEL_ROUTE_TIMEOUT_DEFAULTS_MS`),
the one place both `server/` and `web/` import from, so the two sides of the
client/server relationship can never independently drift. `CLIENT_TIMEOUT_MARGIN_MS`
(10000ms) is added on top of every route's server budget to get its client
timeout — comfortably above typical network/Express overhead, and asserted
directly in `engine/test/modelTimeouts.test.ts` rather than left as an
unchecked convention.

No route is unlimited: the highest ceiling (40s server / 50s client) is
still a hard bound, not a fallback to "wait indefinitely."

## Overriding a route's budget

Each route's server budget can be overridden independently via an env var
in `server/.env` (see `.env.example`):

```
MODEL_TIMEOUT_DISCOVERY_MS=20000
MODEL_TIMEOUT_PROVENANCE_MS=10000
MODEL_TIMEOUT_ASSOCIATION_MS=40000
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

## Open question: Association still timed out at the raised 30s ceiling

A real run (fresh local setup, real Anthropic key, Safari private window)
reproduced `[model_timeout]` on Association again — at the *new* 30000ms
budget, not the original 20000ms one. The UI stayed stable (no state
mutation, no stale banner — the USER-DECISION INVARIANT held), so this is
purely a "is 30s enough" question, not a repeat of either prior incident.

Rather than guess again — raise the ceiling further, trim the schema, or
move to streaming — `server/src/modelTiming.ts` adds diagnostic-only timing
instrumentation first. Every real model call attempt (success or failure)
now logs one `[model-timing]` line to the server's stdout:

```
[model-timing] stage=association attempt=1 outcome=success elapsed_ms=27400 budget_ms=30000 input_tokens=612 output_tokens=3800 output_tokens_per_sec=138.7
[model-timing] stage=association attempt=1 outcome=model_timeout elapsed_ms=30000 budget_ms=30000
```

On the next real Association timeout, this line (visible in the terminal
running `npm run dev`) answers the open question directly:

- **`output_tokens` close to the route's `maxTokens` (4096) and a
  plausible `output_tokens_per_sec`** → the call is genuinely generation-
  time-bound; 30s isn't enough headroom for this route's real output
  volume, and the fix is either raising the ceiling further (with matching
  client-side loading UX) or reducing what a single Association call is
  asked to produce.
- **A timeout with no success ever logged, or a success that returns
  quickly on a *retry* after a slow first attempt** → points at network/
  cold-start variance rather than raw generation time, which argues for a
  different fix (e.g. treating the first attempt's slowness specially,
  or investigating the network path) rather than just raising the number
  again.
- **Successful calls consistently finishing well under budget with normal
  throughput, and only occasional outliers timing out** → suggests
  intermittent load/latency spikes rather than an under-provisioned
  ceiling, which argues for tolerance (e.g. a slightly higher ceiling
  sized to the observed p99, not the worst case blindly).

This is intentionally the *only* change made in response to the second
report — no ceiling was raised, no schema trimmed, no streaming added —
until a real trace exists to justify which fix actually addresses the
observed cause rather than the assumed one.

## Revised from real diagnostic data (one run so far)

`npm run diagnose-model` was run for real against the model configured as
default at the time (a dated Sonnet 4.5 release, retired 2026-09-29 and
since migrated off -- see the "Model migration" entry below). Measured
elapsed time per stage, against the budgets that were in effect at the
time:

| Stage | Elapsed | Budget at the time | Result |
|---|---|---|---|
| Discovery | 12937ms | 16000ms | Under budget, but only ~3s of margin |
| Association | 32310ms | 30000ms | **Over budget** — would time out in production as-is |
| Blueprint | 18718ms | 30000ms | Comfortable, ~11s margin |

This is one sample per stage, not an average — treat the new numbers
below as a working adjustment based on a real signal, not a confirmed
final ceiling. **A few more `diagnose-model` runs would be worth doing
to confirm 40000ms/20000ms are the right numbers before treating them as
settled** (see `docs/PROJECT_STATUS.md`'s current-status section, which
carries this same caveat).

Based on this one run:
- **Association: 30000ms → 40000ms.** It was already over budget, so any
  smaller increase risks the same failure recurring on the very next
  moderately-slower call.
- **Discovery: 16000ms → 20000ms.** Not currently failing, but ~3s of
  margin on a single clean run is too thin to trust in production —
  raised pre-emptively rather than waiting for it to actually time out.
- **Provenance, Avoidance, Style Reference, Blueprint: left untouched.**
  No pressure shown in this data. Blueprint in particular ran comfortably
  under its 30000ms budget (18718ms, ~11s margin) despite being the same
  tier as Association — no reason to move it.

This was a data-driven number change only. It does not touch
`model_timeout`'s no-retry behaviour (`docs/timeout-matrix.md`'s own
"Retry policy" section above, still current) or the client-margin design
— `clientTimeoutForRoute()` still adds the same `CLIENT_TIMEOUT_MARGIN_MS`
(10000ms) on top of whatever the server budget is, so Association's
client timeout became 50000ms and Discovery's became 30000ms
automatically, with no separate edit required.

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
- `server/test/modelTiming.test.ts` — `logModelTiming` formats every field
  correctly, including derived `output_tokens_per_sec`, and omits token
  fields for an outcome that never returned any (a timeout). Also covered
  end-to-end in `modelClient.test.ts`: a real success/timeout attempt
  actually emits the `[model-timing]` line.
- `web/src/journey/useAsyncAction.test.tsx` (pre-existing, from the earlier
  async-state incident) already proves a timeout leaves the current
  screen/user input untouched and that a stale response — including one
  carrying `code: "client_timeout"` — can never mutate state after
  unmount/navigation. That guarantee is orthogonal to which budget a route
  is given, so it did not need new cases for this change; it's cited here
  because it's exactly requirement 8's "a timeout leaves current
  screen/user input untouched" and "stale responses still cannot mutate
  state" checks.

## Model migration (2026-09-03): re-measured against claude-sonnet-5, budgets unchanged

The default model (`server/src/env.ts`'s `anthropicModel`, `ANTHROPIC_MODEL`
in `.env.example`) was migrated from a dated Sonnet 4.5 release (retiring
2026-09-29) to `claude-sonnet-5`, ahead of the retirement deadline. Every
budget in this document and in `engine/src/modelTimeouts.ts` was originally
measured against the old, now-retired model, per the "Revised from real
diagnostic data" section above. That measurement is now stale history —
a real `npm run diagnose-model` run against `claude-sonnet-5` (with a real
`ANTHROPIC_API_KEY`, one sample per stage) has since replaced it:

| Stage | Sonnet 5 elapsed | Budget | Margin | Throughput | For comparison, old Sonnet 4.5 elapsed |
|---|---|---|---|---|---|
| Discovery | 9553ms | 20000ms | 10.4s | 104.9 tok/sec (2704 in / 1002 out) | 12937ms |
| Association | 17403ms | 40000ms | 22.6s | 92.7 tok/sec (2834 in / 1613 out) | 32310ms |
| Blueprint | 18456ms | 30000ms | 11.5s | 86.2 tok/sec (2111 in / 1590 out) | 18718ms |

Sonnet 5's throughput on these three routes is roughly double the ~40-55
tok/sec the old model showed on the same kind of structured-output calls
(~87-105 tok/sec now) — that throughput jump is what accounts for
Association's elapsed time nearly halving (32310ms → 17403ms), since
Association is the most output-token-heavy route (1613 out tokens here)
and therefore the most sensitive to a per-token speed change.

**No budget was changed, and this is a deliberate decision, not an
oversight.** Every stage now has comfortable headroom against its
existing ceiling (10.4s / 22.6s / 11.5s margin respectively) — tightening
any of them would add spurious-timeout risk for no real benefit, since a
call that currently finishes with 10+ seconds to spare gains nothing from
a lower ceiling and only makes an occasional slower real-world call more
likely to time out unnecessarily. Loosening them would be equally
unjustified: nothing in this data shows the current budgets causing any
problem.

**Caveat, same as every prior measurement in this document:** this is
still one sample per stage, not an average. It's enough to confirm the
existing budgets are safe with real margin against the new model — it is
not enough to establish a precise, stable ceiling. If real-world Sonnet 5
traffic later shows a stage running close to or over its budget, that's a
signal to gather more samples and revisit, the same way Association's
30000ms → 40000ms change above was originally justified.

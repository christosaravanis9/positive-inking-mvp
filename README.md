# Positive Inking — MVP

Turns an unclear, emotional or partially formed tattoo idea into a personalised,
artist-usable **Tattoo Blueprint**. Built from `Positive-Inking-MVP-Specification-v3.0`
(product behaviour, source of truth) and its companion Build Brief (engineering approach).

The core architectural rule: **the adaptive engine is deterministic code; interpretation
is model calls.** Which questions appear, in what order, under what budget, is decided
by pure functions in `engine/`, unit-tested with no network call. The model only
interprets stories, recovers provenance, proposes visual associations, and writes prose.

## Structure

```
engine/   deterministic adaptive engine — pure TypeScript, zero deps, Vitest
server/   Express API — model proxy only, holds the API key, never the client
web/      Vite + React intake UI, imports engine/ directly (no secrets in it)
```

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example server/.env   # then add your ANTHROPIC_API_KEY
npm run dev                   # runs server (:8787) and web (:5173) together
```

Open http://localhost:5173.

Without a real `ANTHROPIC_API_KEY`, the server still starts, but every model call
returns a visible `model_not_configured` error — the UI surfaces it directly rather
than faking success. This is intentional degraded behaviour per V3.0 §16, not a bug.

### Verifying the model round trip on its own

```bash
npm run verify-model
```

Sends one real story to the Discovery Engine, validates the structured JSON response,
and prints it. Run this after adding your API key, before trusting anything built on
top of it.

## Testing

```bash
npm test          # engine + server unit tests (deterministic, no network)
npm run typecheck
```

The deterministic engine (`engine/`) is the thing V3.0 §24's acceptance criteria are
actually testable against — concept_shape derivation, question budgets, eligibility,
suppressions, the no-background invariant, the one-clarification limit, confirmed vs.
recommended separation. Model output quality (interpretation, tone, personalisation)
needs a human reading real Blueprints; see `docs/test-journeys.md` once Phase 7 lands.

## Status

This repository is built in phases; see the task list / commit history for what's
implemented. Phase 1 proves the architecture: a real model round trip, deterministic
`concept_shape` derivation, global error handling, and an engine inspector skeleton.
It deliberately does not yet include the full intake journey (Screens 1–13) — per the
Build Brief, that comes only after the model path and architecture are proven.

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
npm test          # engine + server + web unit tests (deterministic, no network)
npm run typecheck
```

The deterministic engine (`engine/`) is the thing V3.0 §24's acceptance criteria are
actually testable against — concept_shape derivation, question budgets, eligibility,
suppressions, the no-background invariant, the one-clarification limit, confirmed vs.
recommended separation. Model output quality (interpretation, tone, personalisation)
needs a human reading real Blueprints; see `docs/test-journeys.md` once Phase 7 lands.

`web/`'s own suite (`web/src/journey/useAsyncAction.test.tsx`, Vitest + jsdom +
`@testing-library/react`) covers the React/async-state boundary that engine/'s pure
functions structurally cannot reach: re-entrancy against duplicate submissions,
staleness after unmount, and that a superseded or post-navigation model response can
never mutate project/ui state — the exact guarantee behind the USER-DECISION
INVARIANT described in `docs/async-state-incident.md`.

```bash
npm run test:integration   # real server + real routes + a local Anthropic
                           # double against the real Vite-served app --
                           # not part of `npm test`; takes real wall-clock
                           # time. See docs/async-state-incident.md.
```

## Production launch blockers — §15.7 is NOT solved

**This build has no production backend, and none has been added.** By explicit
instruction, production data-handling architecture was deliberately deferred so the
functional V3.0 intake prototype could be finished first. That deferral is a decision,
not an oversight, but it means the following are real, unresolved blockers before this
app can be used with real user uploads (photos, signatures, likenesses) in public:

1. **Encrypted-at-rest storage.** Every reference/consent photo, placement photo, and
   style-example photo in this build lives only as a base64 data URL inside this
   browser's own `localStorage` — plaintext, client-side, with no server storage at
   all (see the `§15.7 note` comments in `web/src/journey/state.ts`,
   `web/src/components/ReferenceAttachment.tsx`, `web/src/screens/Placement.tsx`, and
   `web/src/screens/StyleReference.tsx`). A production deployment needs real
   server-side storage, encrypted at rest, before it can accept an upload it intends
   to keep.
2. **Project-scoped access control.** There are no accounts, no auth, and no
   server-side association between a project and the person who created it. Nothing
   here should be mistaken for access control — it's a single-browser prototype.
3. **Deletion / retention implementation.** V3.0 §15.7 describes a retention and
   post-deletion policy (e.g. a 30-day window). No such mechanism exists — "delete"
   in this build only ever means removing a key from `localStorage`, and closing or
   losing that browser/device loses the data with no policy enforcement either way.
4. **Training-use policy enforcement.** Nothing in this codebase enforces, records,
   or exposes a decision about whether uploaded material may be used for model
   training. That policy has to be decided and technically enforced before real
   uploads are accepted.
5. **Legal review of Section 15.** The consent/attestation flow implemented here
   (`engine/src/referenceChecklist.ts`, `ReferenceAttachment.tsx`) follows V3.0 §15's
   *product* behaviour — a checkbox and a line of text at the point of upload,
   classified by relationship to the subject — but has not had any legal review. A
   consent flow that is UX-correct is not the same thing as one that is
   legally sufficient for handling photos of minors, deceased people's likenesses,
   or third-party copyrighted artwork.

**None of the above may be waved through with a "good enough for now."** All five
need to be solved, deliberately, before this app accepts real user uploads in a
public launch. Until then, treat every upload path in this build as development-only,
regardless of how complete the surrounding UX looks.

## Status

This repository is built in phases; see the task list / commit history for what's
implemented. The full intake journey (Screens 1–13), the deterministic adaptive
engine, the reference/consent flow, the low-confidence correction path, the new-idea
loop, visual-association ranking, full placement capture, style-reference resolution,
the provenance re-entry offer, the advanced-controls reveal, first-party local
instrumentation, and a minimal voice-input affordance are all implemented and
covered by the engine/server unit suite plus browser verification. This is a
**functional V3.0 intake prototype**, not a production-ready application — see
"Production launch blockers" above for what's still required before real user data
is involved, and `docs/test-journeys.md` / commit history for the honest, itemised
state of any remaining V3.0 behaviour.

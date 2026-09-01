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
web/      Vite + React intake UI, imports engine/'s built dist/ (no secrets in it)
```

`server` and `web` depend on `engine`'s **built** output (`engine/dist/`), not its
source directly — see `docs/dev-server-reliability.md` for why that matters.

## Local Development

Requires Node 20+.

```bash
npm install
cp .env.example server/.env   # then add your ANTHROPIC_API_KEY
npm run validate:local        # full environment + build + test + stack + live-API check
npm run dev                   # starts engine watch, server (:8787), and web (:5173)
```

Open http://localhost:5173.

`npm run dev` and `npm run validate:local` are the only two commands needed day to day:

- **`npm run dev`** brings up the whole stack reliably, or fails fast naming the exact
  process holding a port if one's occupied. Ctrl+C stops everything, including every
  child process — running `npm run dev` again immediately after always works.
- **`npm run validate:local`** runs the complete local diagnostic (environment, build,
  typecheck, unit + integration tests, a real stack boot, real Anthropic latency
  measurements for Discovery/Association/Blueprint, and a browser journey) and prints
  one compact PASS/FAIL/BLOCKED report. Verbose output goes to a log file whose path
  is printed at the end.

A dev-only **"Start fresh test journey"** button is visible in the running app —
it clears this browser's local journey state and reloads to Screen 1, no private
window or manual `localStorage` commands needed.

Without a real `ANTHROPIC_API_KEY`, the server still starts, but every model call
returns a visible `model_not_configured` error — the UI surfaces it directly rather
than faking success. This is intentional degraded behaviour per V3.0 §16, not a bug.

See `docs/local-dev-troubleshooting.md` for anything beyond this — port conflicts,
what each `validate:local` section checks, `verify-model`/`diagnose-model`, and
prior dev-server/async-state incidents.

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

`npm run validate:local` runs the integration tests, the dev-server reliability test,
and a real-Vite browser journey automatically, in addition to `npm test` — see
`docs/local-dev-troubleshooting.md` for what each one covers on its own.

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

See `docs/PROJECT_STATUS.md` for the canonical, always-current status (what's built,
what's in progress, open decisions, known risks) and the append-only session log
behind it — that file, not this section, is the source of truth. `docs/test-journeys.md`
and commit history carry the itemised state of any remaining V3.0 behaviour.

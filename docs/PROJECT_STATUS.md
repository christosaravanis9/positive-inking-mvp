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
commands (`npm run dev`, `npm run validate:local` — see README). The
Blueprint's Section 4 (Visual hierarchy) is a labelled decision map (Core
concept / Personal reference / Other elements / Still undecided), with
every element assigned to exactly one group (a live-test report caught a
duplication bug in the first version of this grouping — see the session
log). The Blueprint's Section 12 (Readiness) is now the Sites migration
spec's five independently-statused components (Meaning / Visual direction
/ References / Artist discussion / Final artwork) instead of one sentence
— see the latest session log entry for the full mapping and the three
Sites-documented semantic defects corrected before porting the model, not
reproduced. Screen 13 ("Ready to build your Blueprint") uses the same
Visual direction component for its "Open decisions" row, so it can no
longer read "None noted" moments before the generated Blueprint's
Readiness flags an unresolved contradiction, and its "Still needed" row
is unchanged. The Blueprint document itself now follows the Sites
migration spec's twelve-section information architecture end to end — see
"The Sites migration is complete" below. **A meaning-depth gate now sits
on Screen 3 (Story)**: the same Discovery call also judges whether the
story is substantively thin (a generic, swappable reason) versus
concrete-but-abstract (a specific reason with no named person/object) --
see the latest session log entry for the full design and its one open
real-model verification gap. A live-test pass the same night found and
fixed a real raw-internal-text leak in the depth-exercise's "Share it"
path (the same class of bug fixed multiple times this session) and added
a visible loading animation to Screen 7's Association wait. **Voice input
has been rebuilt** on the browser-native Web Speech API to match a
known-good reference implementation, closing out both long-deferred
voice issues (the ~10s cutoff and the "sometimes doesn't activate at
all" failure) -- see the latest session log entry for the full design
and the one deliberately-not-ported bug from the reference. **Every
model-call wait state in the journey now uses one shared
`ModelWaitIndicator` component** (animated dots + a count-up "Still
working — Ns" past 5s, never a countdown) instead of static text --
addresses the deferred timer/countdown item, see the latest session log
entry for the full list of 9 locations changed. **The finalized privacy
notice's two described-but-not-yet-built features now exist**: an 18+
self-certification checkbox inline on the Welcome screen (no new
screen, no ID collected, blocks Continue until checked, persists via
the existing `JourneyState`), and anonymous cross-user usage analytics
(a same-origin `POST /api/analytics/event` endpoint, structurally
incapable of carrying story/image content since its schema has no
free-text field, appending step-timing/completion events to a git-
ignored local JSONL file) -- see that session log entry for the full
design, the real content-leak bug it caught and fixed, and live-
verification numbers. **Two more privacy-notice consent checkboxes now
exist**: a non-blocking sensitive-information disclosure on the Story
screen, and a third-party photo rights checkbox that genuinely blocks
(disables the file input) each of the 3 upload sites
(`ReferenceAttachment.tsx`, `StyleReference.tsx`, `Placement.tsx`'s two
independent slots) until checked, via one small shared
`PhotoRightsCheckbox` component -- see the latest session log entry.
The privacy notice itself lives in the repo at
`docs/positive-inking-privacy-notice.md`. **Three public, static,
crawlable pages now exist** at `web/public/methodology.html`,
`web/public/faq.html`, and `web/public/privacy.html` (flat filenames,
not directory-style -- a real `vite dev` SPA-fallback routing
constraint was found and is documented in the latest session log
entry), each carrying schema.org JSON-LD (Organization site-wide,
FAQPage on the FAQ page, Article on the methodology page), linked from
the Welcome screen and back to the app, with `web/public/llms.txt`,
`sitemap.xml`, and a `robots.txt` that explicitly allows the major AI
answer-engine crawlers by name. All served as real static files, never
routed through the private React SPA -- confirmed by fetching the raw
HTML response with no JS execution. **The app is now Render-deploy-ready**:
`server/src/app.ts` serves the built frontend in production (a real gap
that was found and fixed, verified by running the actual compiled server
with `PORT`/`NODE_ENV=production` set and curling every route category),
`render.yaml` defines the service, and anonymous usage analytics now
writes to Supabase Postgres in production (falling back to the original
local file automatically when Supabase isn't configured, e.g. local dev)
instead of a local file that couldn't survive Render's ephemeral
filesystem -- see the latest session log entry for the exact env vars
needed and the full investigation. **The ArtisticDirection/
CompositionBackground dead end (found 2026-09-04) is now fixed**: both
screens auto-finalize when their flow is already fully resolved on
render, not only via their own `answer()` click handler -- confirmed
live to also resolve the "Edit Composition" panel re-trap as a side
effect, with no separate change needed. **A first live production deploy
surfaced a second, distinct dark-mode bug (2026-09-06): the understanding
panel's row *values* (not the selection highlight, which 0f00fee already
covered) were illegible under a dark OS/browser preference.** Fixed by
removing the app's automatic dark-mode CSS override entirely and declaring
`color-scheme: light` -- the whole app (already a deliberately light-only
"studio ledger" design with no dark token variants anywhere) is now
light-only end to end, not just this one panel. See that session's log
entry for why `color-scheme: light` alone would not have been sufficient.
**A follow-up round (2026-09-06) shipped five more live-feedback items**:
the "Your tattoo is about..." screen is now "Statement of Inspiration"
(with a new subtitle); a weakly-grounded Association candidate's
`personal_meaning` now routes through the same `resolution_state`/
`follow_up_prompt` mechanism `description` already used, generating a
warm, story-specific invitation instead of the model's own confusing
self-critique appearing as visible prose; the Blueprint's Statement of
Inspiration finally renders at all (it was a real, silently-unwired schema
field before this) as a genuine quote-box callout in both the on-screen
Blueprint and its plain-text export; Screen 7 now states outright that
selection is multi-select; and the "Resume where you left off" panel
navigation fix proposed last session is now built and live. **The
three-mode Association candidate expansion (literal object / pure
abstraction / illustrative sequential storytelling) proposed in that round
is now approved and shipped too** — `server/src/schemas/association.ts`'s
rule 1/6/8 extended, zero schema/UI change, verified live with an example
candidate in all three modes. **Both remaining recommendations from that
round are now approved and shipped too (2026-09-07):** Screen 7 candidates
can now be individually re-rolled — the recommended client-only
reserve-pool swap, no new server call, no new async/staleness guard —
with clear per-candidate discoverability text and a graceful "no more
alternatives" state once a slot's reserve runs out; and Blueprint's
model-call budget is raised 30000ms → 45000ms, following the real
production evidence (a real timeout at 30003ms, a manual retry at
27507ms, both within ~2.5s of the old ceiling — see
`docs/timeout-matrix.md`'s "Real production incident" section for the
full local-vs-production gap analysis). Automatic retry-on-timeout was
deliberately NOT added, as recommended. 437 unit tests pass across
engine/server/web; typecheck and build are clean across all three
workspaces.

**Design:** a new "studio ledger" visual direction (warm parchment
background, serif headline, ember-accented selection/marginalia, no card
chrome) was explored as an isolated static preview, approved, and is now
applied live to Screen 7 (`ElementsDiscovery.tsx`) only — see the session
log. It is deliberately not rolled out to the other 12 screens yet; doing
so is a separate future decision, not assumed by this change. All new
styling lives in scoped `.ledger-*` classes/CSS custom properties in
`web/src/styles.css` and in Screen 7's own markup — no shared component or
other screen's styling was touched. **ChatGPT Sites is now the frozen
visual/UX reference** — no more bidirectional feature merging between the
two; visual/UX direction flows from it into this project, not back and
forth. **A real design-token foundation now exists**, migrated from the
Positive Inking Sites UX migration spec with exact values (typography
scale, 8-color palette, spacing rhythm) — replacing the approximated
palette/sizes the "studio ledger" direction first shipped with. It's a
shared foundation defined once, ready to extend to other screens next.

**The Sites UX migration is now COMPLETE — all five pieces landed:**
tokens, Readiness, the "What we've understood" side panel, question-flow
copy/structure, and the Blueprint restructure (see the latest session log
entry for the last one). The design-token system (typography scale,
8-color palette, spacing rhythm) is the shared foundation the rest builds
on. The Blueprint's Readiness section is the five independently-statused
components (Meaning / Visual direction / References / Artist discussion /
Final artwork), with three of Sites' own documented semantic defects
corrected, not reproduced. The "What we've understood" panel is genuinely
persistent across all of Screens 1–13 (not Screen-7-only) — it reuses the
exact same token values via a shared `.sites-tokens` CSS class rather than
duplicating them. Question-flow copy applies a shared eyebrow/heading/
instruction structure (`.screen-eyebrow`/`.screen-heading`, deliberately
smaller than Screen 7's own "studio ledger" H1 since that visual direction
stays Screen-7-only) plus a title+description choice-card pattern
(`.option-chip-card`) across 12 of the app's screens. The Blueprint
document now follows the spec's twelve-section information architecture
end to end (`01 — Your story` through `12 — Readiness`), wrapped in the
same `.sites-tokens` typography scale, with two genuinely new deterministic
sections (05 Composition, 06 Concept-specific decisions) built with the
same label-function discipline as the rest of the app, and a native
print/save-as-PDF path this app had none of before. Screen 7's own "studio
ledger" visual chrome (warm parchment background, ember accents, card-free
candidate list) remains deliberately Screen-7-only throughout — rolling it
out further is still a separate, un-made decision.

**Workflow/tooling:** a full local-dev-friction pass landed as its own
chapter (see the latest session log entry) — this was tooling/DX work,
not a feature chapter, and touched no application logic, UI, or product
behaviour. `npm run start` / `npm run stop` / `npm run doctor` now sit
alongside the existing `npm run dev` / `npm run validate:local` (both
unchanged) as the reliable way to run the stack locally, with automatic
recovery from a stale copy of this project's own processes, fail-fast
environment validation, and a commit/branch identifier that's always
visible in the running app (footer + Telemetry panel, dev-only) so
"is this browser running current code" never again requires leaving it
to compare terminal output by hand.

**In progress:** nothing actively mid-change right now.

**Open decisions waiting on you:**
- **Screen 7 redesign + reference-photo relocation to Screen 13 —
  investigated, NOT implemented.** Full findings, a real sequencing bug
  this redesign would silently introduce if built as literally described,
  the proposed Screen 13 dropdown option set, and a real tension between
  Part 2's "Why" reason and last night's just-shipped reserve-pool re-roll
  decision are all in the latest session log entry. **Parts 2-4 are not
  built** — awaiting your read on the sequencing fix and the Why/generation
  tension before any of it is implemented.
- **Meaning-depth gate prompt wording — real-model verification still
  needed from you.** The new Discovery prompt item (§ MEANING DEPTH) asks
  the model to classify a story as thin only when the stated reason is
  generic/swappable, not when it's abstract-but-specific -- calibrated
  against exactly the two example stories you gave ("I want a rose, roses
  are pretty" vs. "marking the point I stopped drinking"). **This sandbox
  has no `ANTHROPIC_API_KEY` configured**, the same limitation noted for
  the Association prompt change below, so this could only be verified
  mechanically: a fake-model double, driven by an explicit `__TEST_THIN__`
  marker (the same convention `__TEST_DELAY_N__`/`__TEST_FAIL__` already
  use), proved the app correctly branches, shows the register-matched
  prompt, never blocks Continue, and re-runs Discovery at most once --
  it did not and could not prove the real model draws the true/false line
  where the prompt asks it to for either of your two example stories.
  **Run `npm run diagnose-model` (or the app itself) with a real key
  against both stories to confirm `meaning_is_thin` lands correctly on
  each before treating the prompt wording as settled** — if the rose story
  doesn't come back thin, or the "stopped drinking" story does, the next
  step is sharpening the MEANING DEPTH prompt item's own true/false
  examples, not the UI.
- **Association candidate wording — prompt change applied, real-model
  verification still needed from you.** Investigated why memorial/tribute
  object candidates lean on abstract phrasing (e.g. "already carries the
  weight of connection") in `personal_meaning`. Root cause:
  `server/src/schemas/association.ts`'s rule 8 (CONCRETENESS) constrained
  only the `description` field — there was no equivalent guidance for
  `personal_meaning`, which is where the abstract phrasing actually lives.
  Three options were proposed at different strictness levels; **Option C
  (a grounding requirement, not a literalness requirement) was chosen and
  is now live** in the prompt: `personal_meaning` no longer needs
  `description`'s literal concreteness (a genuinely abstract emotional
  truth is still legitimate) but must name a specific detail from the
  client's own story or the candidate's own description rather than a
  sentence generic enough to fit any client, and the model is told to say
  plainly when nothing yet grounds the meaning rather than reach for
  boilerplate. **This sandbox has no `ANTHROPIC_API_KEY` configured**
  (`server/.env` doesn't exist; `npm run dev` reports "Model configured:
  NO"), so the actual before/after wording change could not be observed
  against the real model here — only the prompt text change itself, a
  full typecheck/test pass, and the request/response pipeline shape were
  verified. **You should run `npm run diagnose-model` (or the app itself)
  with a real key against the "handmade wall art" scenario to confirm
  `personal_meaning` reads more specifically before treating this as
  settled** — see the latest session log entry for exact wording and
  what was and wasn't checked.
- **"Whose is it?" reference field — investigated, no change made.**
  The dropdown (`web/src/components/ReferenceAttachment.tsx`,
  `subject_relationship`) renders whenever a candidate's chosen fidelity
  is `exact` or `closely_based_on` (`NEEDS_REFERENCE` in
  `ElementsDiscovery.tsx`), regardless of `source_category` or
  `material_type` — it fires identically for a photo of a living person
  and for a client's own handmade object. Its five options (Me / Someone
  else living / A child / Someone who has passed / Not sure) answer
  "whose personal information (likeness, handwriting, signature) does
  this reference material capture" — the question §15.2 attestation
  actually needs — not "who does this object belong to or was it made
  for." An object the client made themselves for a living family member
  has no clean answer among the five, because the field isn't asking
  about gift/dedication relationships at all; "Not sure" happens to be
  harmless there only because `requiresAttestation()` also skips it, not
  because it's the right answer. Left as-is pending your call on whether
  to adjust the options, make the field conditional on `material_type`,
  or leave it. **Update, stronger framing:** further live feedback now
  leans toward removing/skipping this field entirely for certain
  scenarios (an object the client made themselves for a living family
  member, per the finding above), not just gating it conditionally as
  first investigated. Still not built — the three options on the table
  are now: adjust the five options, make the field conditional on
  `material_type`, or drop it entirely for scenarios like this one.
- **§15.7 production launch blockers** (encrypted-at-rest storage,
  project-scoped access control, deletion/retention, training-use policy,
  legal review of the consent flow) are all still open — see README.md's
  "Production launch blockers" section for the full, unchanged list. None
  of this build's upload paths should be treated as production-ready
  until those are deliberately resolved.
- **If you see a bare "Needs refinement" or a raw "(undecided)" tag again,
  check your running code before reporting a new bug.** A live session
  reported both, on the same fresh Blueprint, immediately after 8c3a7fa
  shipped. Investigated (see the latest session log entry for the full
  trace): current code cannot produce either symptom -- both are
  byte-for-byte reproductions of 8c3a7fa's OLD, pre-fix formatting
  (confirmed by reconstructing the exact old template literals). This
  points to a stale dev server process, browser tab, or checkout that
  predated the fix, not a surviving code defect -- this project has hit
  exactly this class of issue before (`docs/dev-server-reliability.md`).
  No code change was made for this; two component-level regression tests
  now lock in the correct current behaviour
  (`web/src/screens/BlueprintView.test.tsx`). If it recurs against a
  verified-current checkout with a hard-refreshed browser, that would be
  a genuine new regression worth re-opening.

**Known, deliberately deferred issues (not lost, just not this chapter's scope):**
- **Overall Blueprint premium polish** beyond the Statement of Inspiration
  quote-box treatment (now shipped — see the latest session log entry) —
  deliberately deferred to a later, dedicated polish pass, not current
  work.
- **Free-text input + suggestion chips on binary confirmation screens**
  ("Here's what that suggests" style screens, e.g. `StyleReference.tsx`'s
  resolution step) — currently only right/try-again, no way to add
  nuance or see suggested phrasing. **Sharpened by later feedback:** the
  ask is for both together on the same screen, not either/or —
  multiple suggestion boxes (alternative phrasings/interpretations to
  pick from, not just the one shown) *and* a free-text input to type a
  correction/refinement directly, rather than only being able to accept
  or reject the single suggestion. Still not built.
- **Overall journey progress/timeline indicator** across all screens.

**Known risks:** the timeout numbers above are provisional (see the open
decision); nothing else newly introduced this session. See
`docs/session-summary.md` and the incident docs it links
(`docs/async-state-incident.md`, `docs/dev-server-reliability.md`,
`docs/timeout-matrix.md`) for the detailed history behind how the codebase
got to its current, tested state.

## Data-minimization / privacy audit

Tracked separately from the §15.7 production-launch-blockers list above
(those are pre-existing, known, deliberately-deferred items; this section
is a standing checklist against a specific 7-item data-minimization
audit, verified by reading the actual code — not assumed). Updated
2026-09-04; see that date's session log entry below for the full
investigation and fix detail.

| # | Item | Status |
|---|---|---|
| 1 | API key never reaches browser/client code | ✅ Verified clean, no gap |
| 2 | Server never logs full request/response bodies (story/image data) | ✅ Verified clean, no gap |
| 3 | Uploaded files never written to disk, even temporarily | ✅ Verified clean, no gap (no server-side upload path exists at all) |
| 4 | Uploaded images don't retain EXIF/GPS metadata | ❌ Was a gap — **fixed** (`web/src/imageSanitization.ts`) |
| 5 | Story/image/Blueprint data isn't in localStorage beyond in-memory state | ⚠️ True as described, but by deliberate §16.1 crash-recovery design — not changed, see below |
| 6 | A user-facing "Delete this session" action exists | ❌ Missing — confirmed, **not built** (reporting only, as instructed) |
| 7 | No third-party tool (error monitoring/analytics/hosting logs) sees story/prompt content | ✅ Verified clean, no gap (no third-party integration exists at all) |

**Items 5 and 6 together are the one real open product decision here**,
not a code fix: the journey's full state (story, reference images,
Blueprint) is deliberately persisted to `localStorage` so a crash or
accidental reload doesn't lose a client's answers (§16.1's own explicit
requirement, already relied on by `IntentionConfirmation`'s "Edit this"
and every other Back/Edit affordance in the app). That's a legitimate
design choice, not an oversight — but paired with the fact that nothing
today lets a client explicitly clear that persisted data, the two
together are a real gap in the full picture. Resolving it needs a
product/design decision (copy, placement, whether it's session-only or
project-scoped, whether it also needs to account for the §15.7
encrypted-at-rest/retention items), not just a code change — flagged
here for you to decide scope on, matching how other open decisions in
this document are tracked.

## Session log

### 2026-09-07 (later) — Screen 7 redesign + reference-photo relocation to Screen 13: Part 1 investigated, Part 3 proposed, nothing implemented

Per explicit instruction: investigate first, report Part 1's findings and
Part 3's proposed dropdown options, and do not implement Parts 2-4 without
a read on what the investigation found.

**PART 1 — WHERE fidelity/reference STATE ACTUALLY LIVES.**
`VisualElement.fidelity: ElementFidelity` (`"exact" | "closely_based_on" |
"interpretive" | "open"`, `engine/src/types.ts`) is the one field driving
everything; `reference_required`/`reference_status` sit alongside it on
the same record. The actual uploaded file lives separately in
`UIState.referenceAssets` (keyed by element id); consent/attestation
metadata lives in `ProjectState.consent_records` (`ConsentRecord[]`, also
keyed by element id via `reference_id`). All three are currently produced
in exactly one place: `ElementsDiscovery.tsx`'s `confirm()`, via four
helper functions private to that file (`NEEDS_REFERENCE`,
`statusFromDraft`, `draftToConsentRecord`, `draftFromExisting`).

**Everywhere `fidelity` is read downstream:**
- `engine/src/referenceChecklist.ts` — `buildReferenceChecklist()` filters
  on `fidelity === "exact" || "closely_based_on"` to decide which
  elements need a reference at all; `classifyReferenceFeatureKind()` also
  reads it to help set the reference's importance tier.
- `web/src/journey/deriveConceptSignals.ts` — `has_exact_fidelity_element`
  (`some(fidelity === "exact")`) feeds `ConceptSignals`.
- `web/src/screens/ArtisticDirection.tsx` (Screen 11) — reads
  `hasExactFidelityElement` to gate `fidelityTreatmentRequired()` (the
  "how faithful should the reproduction be?" micro-question,
  `engine/src/fidelity.ts`), and separately reads
  `some(fidelity === "interpretive" || "open")` for one artistic-dimension
  eligibility flag.
- `web/src/journey/blueprintSummary.ts` — writes
  `${description} (${hierarchy}, ${humanize(fidelity)})` into the prose
  `confirmed_project_summary` the Blueprint Writer model actually sees,
  plus a separate `Fidelity treatment: ...` line when
  `project.fidelity_treatment` is set. `server/src/schemas/blueprint.ts`'s
  prompt instructs the model to reproduce that fidelity-treatment
  instruction verbatim — it only ever sees this as prose, never a
  structured field.
- `web/src/inspector/EngineInspector.tsx` — dev-only display, not
  load-bearing.

**A real sequencing bug this redesign would silently introduce, if built
exactly as described.** `engine/src/screenFlow.ts`'s fixed order runs
`elements_discovery` (7) → ... → `artistic_direction` (11) → ... →
`design_confirmation` (13) — Screen 11 runs and finalizes
`fidelity_treatment` BEFORE Screen 13 exists in the flow. Screen 7's new
Keep/Build-upon control only ever writes the coarse `closely_based_on`/
`interpretive` values (deferring `exact`/`open` to Screen 13's dropdown,
per Part 3 below) — which means `hasExactFidelityElement` reads `false`
by the time Screen 11 runs, every time, for every journey. The
`fidelity_treatment` question (today's ONLY trigger for it) would never
fire in the normal forward flow again, even for a client whose element
genuinely needs literal handwriting/signature/drawing reproduction. The
existing §14 new-idea invalidation mechanism
(`engine/src/newIdea.ts`'s `computeInvalidatedQuestions`) doesn't cover
this either — it only re-opens `composition_type`/`density`/`realism`/
`background_decision`, never `fidelity_treatment`. Without a deliberate
fix, this is a genuine Blueprint-correctness regression, not just a
relocated UI control.

**Proposed fix:** re-run the exact same already-exported, pure
`fidelityTreatmentRequired()`/`FIDELITY_TREATMENT_OPTIONS`
(`engine/src/fidelity.ts` — zero engine changes needed) from Screen 13
too, triggered whenever its new dropdown sets an element to `exact` and
`project.fidelity_treatment` is still empty. (Noted in passing, not
proposed as something to fix now: `ArtisticDirection.tsx` already
hardcodes `"handwriting"` as the element-kind argument to that function
regardless of the element's real kind — a pre-existing simplification;
Screen 13's new call site should presumably match that same behavior for
consistency, but this is a separate, smaller question from the
sequencing bug itself.)

**DesignConfirmation.tsx (Screen 13) current structure.** A flat
`<dl className="summary-list">` of already-computed top-level fields
(Main subject / Supporting details / Composition / Treatment /
Placement / Creative control / Avoid / Still needed / Open decisions) —
it does NOT currently list each individual `visual_element` with its own
row. Adding a genuine per-candidate dropdown means a real new section:
looping over `project.visual_elements` (every element that reached this
screen was, by definition, Kept or Built-upon at Screen 7 — nothing else
survives to `visual_elements`) with its own inline controls, not editing
an existing `<dd>`.

**ReferenceAttachment.tsx reuse — confirmed clean, no duplication
needed.** It's a pure, self-contained, purely presentational component
(`value`/`onChange`/`elementDescription` props only) with exactly ONE
current call site (`ElementsDiscovery.tsx`). `Placement.tsx` and
`StyleReference.tsx` each have their OWN separate, independent upload
implementations — they only mention "mirrors ReferenceAttachment.tsx" in
a comment about sharing the same file-size cap value, never the actual
component — confirmed genuinely unrelated and untouched by this
investigation, exactly as instructed. Relocating/reusing the real
component from Screen 13 is clean; its supporting helpers
(`NEEDS_REFERENCE`, `statusFromDraft`, `draftToConsentRecord`,
`draftFromExisting`) need extracting out of `ElementsDiscovery.tsx` into
a shared module (e.g. `web/src/journey/referenceDraft.ts`) so Screen 13
can use them without copying logic.

**State-shape change plan.** No new fields needed anywhere in
`VisualElement`/`ProjectState`/`ConsentRecord` — every field this needs
already exists with the right shape; only WHICH SCREEN sets/finalizes
each one changes. Screen 7's `confirm()`: Keep → `fidelity:
"closely_based_on"`, Build upon → `fidelity: "interpretive"`, and
`reference_required: false` / `reference_status: "not_needed"`
unconditionally (deferred) — no `ConsentRecord`/`referenceAssets` writes
from Screen 7 at all anymore. Screen 13 gets new local component state
mirroring `ElementsDiscovery`'s existing `fidelityByIndex`/
`referenceByIndex` pattern, keyed by element id instead of candidate
index (Screen 13 only ever sees already-finalized `visual_elements`, not
raw candidates), seeded via the same (relocated) `draftFromExisting`.

**PART 3 — proposed Screen 13 dropdown options.** Reuse the exact same
four pre-existing `ElementFidelity` values rather than inventing new
ones — this is what keeps `referenceChecklist.ts`, `blueprintSummary.ts`,
and the fidelity-treatment gate all working unchanged, since they're
already built around exactly these four:
- **"Exactly as-is"** (`exact`) — needs a reference photo; triggers the
  fidelity-treatment micro-question inline for handwriting/signature/
  drawing elements (the sequencing fix above).
- **"Closely based on this"** (`closely_based_on`) — needs a reference
  photo. Pre-selected default for anything marked "Keep."
- **"Interpreted by the artist"** (`interpretive`) — no reference
  needed. Pre-selected default for anything marked "Build upon."
- **"Open — artist's call"** (`open`) — no reference needed.

Screen 7's Keep/Build-upon becomes the starting point this dropdown
defaults to, not a separate question asked twice — the coarse choice at
selection time, the deliberate final execution-fidelity call once the
whole design is assembled at Screen 13, same two underlying values
either way unless the client actively moves the dropdown.

**A real tension Part 2 surfaces with last night's already-shipped
decision.** Part 2 asks that a typed "Why" reason "get fed into the
re-roll's generation request" — reusing Story.tsx's `depth_prompt`
pattern (compose a richer input string, call the SAME endpoint again).
But last night's approved decision 2 specifically chose the client-only
reserve-pool swap over a real server round-trip *because* it can't touch
the async/staleness guards — a reserve pool holds candidates generated
up front from the original story, with no way to incorporate a
per-candidate dismissal reason after the fact. Honoring "feeds into
generation" literally means the Why-driven path needs a real per-slot
model call after all (a new optional `avoid_descriptions`/
`dismissal_reasons` field on the Association request, a small prompt
addition, and a keyed async-tracking hook for slots that can
independently be mid-generation) — while a plain re-roll with no reason
typed can keep using the existing free, instant reserve-pool swap. The
non-destructive pager unifies both cleanly under one per-slot
`history[]` + `historyIndex` (paging back is always free — it's just
re-showing an already-generated entry; only advancing past the end when
a Why is given costs a real call). This is more machinery than the pure
reserve-pool swap, on the Why-driven path specifically — flagging it
plainly rather than either quietly skipping "feeds into generation" or
building it without your read on the tradeoff first.

**Nothing in Parts 2-4 has been implemented.** Awaiting your response on
the sequencing fix and the Why/generation tension before writing any
code.

### 2026-09-07 — Both pending recommendations approved and shipped: per-candidate re-roll, and the Blueprint timeout budget raise

Two approvals from the same thread as the prior entry, both now built and
verified.

**APPROVAL 1 — SHIPPED: per-candidate individual re-roll (the recommended
client-only reserve-pool swap).** `web/src/screens/ElementsDiscovery.tsx`:

- The Association prompt (`server/src/schemas/association.ts`, rule 1)
  gained one instruction: propose "typically 4 to 8" candidates total when
  the story genuinely supports that many distinct strong ideas, never
  padded with weak filler — this is what gives the reserve pool real
  material; without it, most real responses would have nothing to
  re-roll into.
- Screen 7 now shows only the top `VISIBLE_CANDIDATE_COUNT` (3) ranked
  candidates by default; everything ranked beyond that, from the *same*
  already-fetched Association response, becomes that fetch's reserve pool.
  `slotOverrides` (keyed by SLOT POSITION, not candidate index, since a
  slot's occupant changes on re-roll while its screen position doesn't)
  and a shared `reserveCursor` track which reserve candidate each re-roll
  click hands out next, in rank order. **No new server call, no new
  async/staleness guard** — `rerollSlot()` is a synchronous local state
  update, exactly the property this approach was chosen for.
- **Two correctness details the naive version would have missed**, both
  now covered by dedicated tests:
  1. Re-rolling a candidate the client had already selected also
     deselects it — `selected` is keyed by original candidate index, not
     slot, so without this the swapped-out candidate would silently stay
     "confirmed" despite no longer being shown.
  2. `slotOverrides`/`reserveCursor`'s `useState` initializers seed
     themselves from `state.project.visual_elements` on mount: if a
     candidate the client already confirmed was originally a re-rolled-in
     reserve item (now ranked outside the default top 3), it stays
     visible on a fresh mount (e.g. navigating back to this screen via
     the panel) instead of silently reverting to the default ranking and
     hiding something the client already chose.
- Discoverability text: "Not quite right? Try another idea" renders under
  every visible candidate that still has reserve material behind it,
  styled as an understated inline link matching
  `.understood-row-edit`'s own restraint (no button chrome). Once the
  reserve is exhausted, every remaining candidate instead shows "No more
  alternatives to offer right now" — never a dead, permanently-disabled
  button.
- `test-integration/fakeAnthropic.mjs`'s Association fixture now returns
  5 candidates (the existing 3 from the three-mode fixture, scored
  highest, plus 2 more scored lower) so a live journey has real reserve
  material to exercise.

**Verification:** typecheck, full test suite (437 tests, up from 431 —
6 new tests in `ElementsDiscovery.test.tsx` covering the default cap,
the swap itself, the deselect-on-reroll fix, reserve exhaustion, the
no-reserve-at-all case, and the remount-seeding fix), and build all pass.
Live Playwright verification against the real dev stack: exactly 3
candidates shown by default with the reserve candidate hidden; selecting
then re-rolling the first candidate swapped it for the next-ranked
reserve item and correctly deselected it; re-rolling twice more exhausted
the reserve and replaced the affordance with the graceful exhausted-state
message on every remaining candidate. Screenshots confirm all three
states match the design.

**APPROVAL 2 — SHIPPED: Blueprint's model-call budget raised 30000ms →
45000ms**, per the real production evidence gathered in the prior entry
(a real timeout at 30003ms, a manual retry at 27507ms, both within ~2.5s
of the old ceiling). `engine/src/modelTimeouts.ts`'s
`MODEL_ROUTE_TIMEOUT_DEFAULTS_MS.blueprint` updated (now the highest
ceiling in the matrix, surpassing Association's 40000ms), plus
`.env.example`'s commented example. `docs/timeout-matrix.md` gained a new
"Real production incident" section carrying the full log excerpt, the
reasoning for why this is a genuine local-vs-production gap (real output
*volume* — a real Blueprint's twelve sections vs. a short local
diagnostic fixture — not network/infra drift, since throughput stayed
consistent across all three real production calls sampled), and an
explicit note for future timeout work in that doc: a local
`diagnose-model` run against a short fixture measures best-case output
volume, not the real distribution production traffic produces. **As
approved, automatic retry-on-timeout was NOT added** — the doc's existing
"Retry policy" section (a `model_timeout` is intentionally not treated as
a transient fault) is called out explicitly as the reason, unchanged.

**Verification:** typecheck, full test suite (`engine/test/
modelTimeouts.test.ts` updated: the "matches the documented timeout
matrix" assertion and the "never excessively high" ceiling both now
reflect 45000ms), and build all pass. One server-side test flake
(`modelClient.test.ts`'s real-timer-based timeout assertion, off by 1ms)
was observed and confirmed unrelated to this change — reran clean, same
as it would have before this session's edits; nothing in this round
touches that test's own logic.

### 2026-09-06 (later still) — Three-mode Association expansion shipped; re-roll recommendation given; a real production Blueprint timeout confirmed from live logs, not a one-off

Two decisions and one investigation from the same follow-up thread. Per
your explicit instruction, only decision 1 was implemented — decision 2
and the investigation are reported here for your sign-off, nothing else
was touched.

**DECISION 1 — SHIPPED: three-mode Association candidate expansion.**
Implemented exactly the approved zero-schema-change approach from the
earlier investigation. `server/src/schemas/association.ts`:
- Rule 1 (ASSOCIATIONS) now names the three legitimate candidate shapes up
  front — literal object, pure abstraction, illustrative sequence — with
  the same "never forced into a quota, never preferred by default" framing
  from the proposal.
- Rule 6 (NO INVENTION) gained one sentence: applies to every part of a
  sequence individually, not just the candidate as a whole.
- Rule 8 (CONCRETENESS) gained a new subsection for sequence candidates:
  one candidate, one description naming the whole cohesive sequence (never
  split across multiple `visual_candidates` entries, never a new schema
  shape), with the same BAD/BETTER discipline applied per-part instead of
  to the candidate as a whole, the worked panel example from the proposal,
  and an explicit note that format is open (panels, polaroid fragments,
  morph/collage, still scene, integrated figure) with the story's own arc
  left open to interpretation rather than narrating an invented event.
  **Mode A's existing grounding requirement is completely unchanged** —
  every line of the original BAD/BETTER framework stayed exactly as it
  was; the new subsection is purely additive.
- `test-integration/fakeAnthropic.mjs`'s Association fixture now returns
  one candidate per mode (including the exact three-panel compass example
  from rule 8 itself) so a live journey actually exercises all three.

**Verification:** typecheck, full test suite (431 tests, no test files
needed changes — this was a prompt-only change plus a fixture update),
and build all pass. Live Playwright run against the real dev stack: all
three modes rendered on Screen 7 in the same list, ranked by the existing
`rankVisualCandidates` weighting (the Mode C candidate ranked first on its
higher personal/story relevance and originality scores — no ranking logic
was touched, it just already does this), the Mode C candidate's full
multi-part description rendered intact as one candidate, and it selected
via the exact same single checkbox Modes A/B use — confirming the
zero-new-UI claim held in practice, not just in code. As with the earlier
`personal_meaning` prompt change, this sandbox has no real
`ANTHROPIC_API_KEY`, so the model's own real generation behavior under the
new rules couldn't be observed here — only that the pipeline, ranking, and
rendering handle a Mode C candidate correctly once one exists.

**DECISION 2 — RECOMMENDATION (not implemented): client-only reserve-pool
swap for Screen 7 per-candidate re-roll.** You asked for a plain
recommendation with reasoning rather than picking blind between the two
options from the earlier investigation. Recommending the **client-only
reserve-pool swap** over the real server round-trip, for three reasons
specific to this codebase:
1. **It cannot violate the async/staleness guards, because it isn't async
   at all.** `useAsyncAction` (`web/src/journey/useAsyncAction.ts`) exists
   because of a real production incident (its own top comment describes
   it) and deliberately serializes exactly one in-flight action per hook
   instance. A per-candidate re-roll via a real server call needs a new,
   keyed variant of that same guard discipline — genuinely new
   infrastructure in the one area of this codebase that has already been
   burned once by a subtle bug in exactly this class of problem. The
   reserve-pool swap is a synchronous array rotation; there is no guard to
   get wrong.
2. **It adds no new production model-call volume, at the moment that
   volume is specifically under scrutiny** — see the Blueprint timeout
   finding directly below. Adding a new per-candidate model call (however
   infrequently used) is the wrong direction to move in while actively
   confirming whether current call volume/latency is already marginal in
   production.
3. **It's the smaller, more reviewable change**, consistent with how
   narrow-scope this codebase's own recent additions have been (e.g.
   `resumeTracking.ts` from last session — a small synchronous derived-state
   helper, not a new subsystem).
The real downside — a reserve pool surfaces an already-generated,
lower-ranked candidate rather than a genuinely new idea — is manageable by
requesting a modestly larger batch up front (e.g. 6-8 candidates instead
of 2-3 shown) rather than needing the heavier real-round-trip machinery;
with three modes now live, a larger pool should also contain more genuine
variety across modes, not just near-duplicates of the top pick. If real
usage after shipping this shows people still find the alternatives too
similar, that's the natural, evidence-based trigger to revisit the real
round-trip approach later — not something to build speculatively now.
**Awaiting your approval before building either approach.**

**INVESTIGATION 3 — real production timing data found, no fix applied.**
Checked whether `npm run diagnose-model` (or an equivalent) can run
against the live Render deployment specifically: it can't directly as
written — it's a standalone script that calls the real Anthropic API
straight from wherever it's invoked (using local env vars), not through
the deployed server, so running it locally only ever measures latency from
this sandbox's own network path, not Render's. Running it as a genuine
Render-side job (SSH exec or a one-off Job resource) was considered but
**not done** — per your own standing instruction from an earlier session,
I don't make live-service changes to your Render account without your
separate go-ahead, and creating a new job/resource there counts as one.

The better option turned out to already exist and need no new code at
all: `server/src/modelTiming.ts`'s `[model-timing]` log line is
**unconditionally emitted in every environment, including production**
(its own comment says so explicitly — it predates this investigation).
Querying Render's own log history for the service (`list_logs`, read-only,
no live-service change) for `*model-timing*` in today's window surfaced
the exact incident, still there:
```
[model-timing] stage=blueprint attempt=1 outcome=model_timeout elapsed_ms=30003 budget_ms=30000
  (2026-09-06T22:52:52Z)
[model-timing] stage=blueprint attempt=1 outcome=success elapsed_ms=27507 budget_ms=30000 input_tokens=2550 output_tokens=2576 output_tokens_per_sec=93.6
  (2026-09-06T22:56:59Z -- the manual retry)
```
Also visible in the same window: `discovery` at 10.5-10.6s (budget
20000ms), `association` at 20.5s (budget 40000ms), `style_reference` at
3.0s, `avoidance` at 4.2s — all comfortably inside budget. **Blueprint is
the one outlier, and both real samples of it landed within ~2.5s of the
30000ms ceiling** — not "comfortable margin," which is what
`docs/timeout-matrix.md` assumed when Blueprint's budget was last
reviewed ("Not touched by the revision below — comfortable margin in the
one real run so far"). This is genuinely new evidence against that
assumption, not a re-confirmation of it.

**Is this a one-off or a real gap?** Both real samples we have ran close
to the edge, and the likely mechanism supports it being systemic, not a
fluke: throughput across all three real calls sits in the same ~90-110
tokens/sec band (100.8, 97.7, 93.6 — no outlier there), so the difference
isn't network/infra drift on this one call. What's different is *output
volume* — the successful Blueprint call generated 2576 output tokens, its
twelve written sections drawing on a real, detailed journey, versus
whatever a small generic diagnostic fixture produces locally (the
18.4s figure from an earlier session's local measurement almost certainly
reflects a shorter fixture summary, not a real journey's actual content
volume). At ~94-100 tokens/sec, a real Blueprint needing just a few
hundred more output tokens than this one did — an easy, plausible amount
for a richer real story — pushes back over 30s again.

**Recommendation (not applied):** raise Blueprint's budget, following the
exact precedent already in this codebase — Association's own budget was
raised 30000→40000ms after a single real timeout incident, the same shape
of evidence this is. Recommend AGAINST adding automatic retry-on-timeout
for Blueprint: `modelClient.ts` deliberately does not retry a
`model_timeout` (unlike `model_http_error`) — its own test asserts this
explicitly ("a timeout is not treated as a transient fault") — and
reversing that for one route doubles the worst-case wait and API cost per
timeout instead of just giving the single call enough room to finish, which
the data suggests is the actual, simpler fix. **Awaiting your decision on
the new Blueprint budget number** — `MODEL_TIMEOUT_BLUEPRINT_MS` in
`server/.env`/`engine/src/modelTimeouts.ts`'s default, plus updating
`docs/timeout-matrix.md`'s own table and its now-outdated "comfortable
margin" note, once you confirm.

### 2026-09-06 (later same day) — Five live-feedback items shipped, two investigated and reported (not built), plus the previously-proposed panel navigation fix now built

A follow-up round on the same day as the dark-mode panel fix below. Item 2
of this round replaces the *simpler* version from the investigation
earlier that day (a static generic tag) with a personalized, per-candidate
approach based on further live feedback that the simpler version read as
confusing and harsh — this entry supersedes that plan, not the fix itself.

**1. FIXED: "Your tattoo is about..." renamed to "Statement of
Inspiration".** `IntentionConfirmation.tsx`'s heading changed, plus a new
subtitle: "Worth remembering for when someone asks why you got it." No
content or logic changed — this screen still shows
`project.statement_of_intention` and the same Continue/Edit buttons it
always did.

**2. FIXED: weak-candidate flagging now routes through the existing
`resolution_state`/`follow_up_prompt` mechanism instead of writing a
judgment as prose.** Builds directly on the investigation from earlier
today (see below): rule 8's `personal_meaning` clause previously told the
model "if nothing grounds the meaning yet, say so plainly" with no
instruction on *where* that honesty should go, so the model wrote its
admission straight into the user-facing `personal_meaning` text (the exact
"No grounding yet in this story..." example from the investigation).
`server/src/schemas/association.ts`'s rule 8 now instructs: when
`personal_meaning` isn't grounded, do NOT write that into
`personal_meaning` itself — write it as a short, honest, neutral
description instead, mark `resolution_state: "needs_client_specific_detail"`
(the exact mechanism `description` already used, not a new one), and write
`follow_up_prompt` as a warm, per-candidate invitation that: references
something specific from the client's own story wherever possible, offers
one or two LOOSE illustrative examples framed as inspiration rather than
instructions, and explicitly says so ("just ideas, not instructions").
The prompt includes one worked example (the compass/self-trust story from
your own message) and explicitly tells the model never to reuse that exact
wording for a different candidate or story. No UI change was needed —
`ElementsDiscovery.tsx` already renders `follow_up_prompt` as an inline
marginalia prompt whenever `resolution_state` is
`needs_client_specific_detail` (added for `description`'s own concreteness
gate); this only extends which cases route into that same display. Because
this sandbox has no real `ANTHROPIC_API_KEY`, the actual model-generated
wording could not be observed here — only the prompt text change, and that
the existing `follow_up_prompt` rendering mechanism still works correctly
end to end (verified live, see below). **Run `npm run diagnose-model` (or
the app itself) with a real key against a story with at least one
plausible-but-thin candidate to confirm the generated invitations read
warm and specific, not generic, before treating this as fully settled.**

**3. INVESTIGATED (report only, NOT implemented, per your explicit
instruction): expanding Association's candidate range to three modes**
(literal object / pure abstraction / illustrative sequential storytelling).

Is there a structural cap? Partly, but it's a prompt-level bias, not a hard
schema wall. Rule 1 (ASSOCIATIONS) and rule 8 (CONCRETENESS)'s own
BAD/BETTER examples are ALL single-object propositions ("a small
hand-drawn motif...", "a new mark made by overlapping..."), which biases
the model toward one-object candidates even though nothing in the schema
actually prevents more. Two things already exist that make a genuinely
lightweight fix possible: `visual_candidates` is already an array (the
model can already propose several related candidates in one response,
which the UI already lets the client multi-select), and
`compositionFlow.ts`'s `reading_direction`/`density` questions already
activate off `element_count > 1` — a multi-element composition already has
real deterministic question support downstream, today, with no schema
change.

Two ways to represent Mode C were considered:
- **(a) Multiple related candidates, tied together by a new grouping
  field** (e.g. `sequence_group_id`) — real per-panel structure, but needs
  new schema fields, new UI grouping logic in `ElementsDiscovery.tsx`, and
  touches `rankVisualCandidates`.
- **(b) One candidate whose `description` names the whole small sequence
  as one cohesive multi-part proposition** (e.g. "Three small linked
  panels: [panel 1]; [panel 2]; [panel 3]"), with rule 8's concreteness bar
  extended to apply per-panel *inside* that one string rather than only to
  the description as a whole. **Recommended** — zero schema/UI/ranking
  changes, purely a rule 8 extension, and the existing single-VisualElement
  composition dimensions apply to it exactly as they do today for any
  other candidate.

Example candidate text per mode (illustrating format variety, both
character-driven and environment-driven approaches, and — per your
instruction — the story arc deliberately left open rather than narrating
one specific depicted event; every example still needs to trace to
something the actual client's story supports, same as any other
candidate):
- **Mode A (literal object, existing, unchanged):** "A small hand-drawn
  compass rose, its needle pointing toward a specific date etched at the
  rim."
- **Mode B (pure abstraction, existing via `new_materialisation`,
  unchanged):** "A new mark made by overlapping the outlines of both your
  initials, deliberately not resembling any literal object."
- **Mode C (illustrative sequence, the gap this investigates) — one
  example per requested format:**
  1. *Comic-strip panels, character-based:* "Three small linked panels, no
     border between them: a figure standing at a fork in a path; the same
     figure's hand resting on a compass; the figure walking forward alone,
     path behind now faded."
  2. *Polaroid-style environment fragments:* "Two overlapping
     polaroid-style frames: one showing a worn kitchen table's edge, the
     other a half-open door letting in light — no figure in either,
     environment carrying the memory."
  3. *Morphed collage/montage:* "A single form that reads as a compass
     rose from one angle and a folded letter from another, the two shapes
     blended at their edges rather than shown separately."
  4. *Still scene with implied character:* "An empty chair beside a
     window, coat still hung on its back — the person suggested only by
     what they left behind."
  5. *Character + environment integrated:* "A figure mid-step on a porch,
     one hand trailing along a railing worn smooth in one particular
     spot."

Mode A's existing grounding requirement is unchanged by this proposal —
the same concreteness bar just gets applied per-panel/fragment for Mode C
rather than only to the description as a whole, so a sequence doesn't get
a pass on rigor just because it's dressed up as art direction.
`rankVisualCandidates`'s existing six-dimension weighting needs no change;
a well-grounded Mode C candidate should score naturally on
`visual_potential`/`originality` without special-casing.
**Nothing here has been implemented — awaiting your follow-up
confirmation before touching the prompt or schema.**

**4. FIXED: Blueprint's Statement of Inspiration now renders as a quote
box — and, separately, now renders at all.** Investigating this surfaced a
real, previously-unnoticed gap: `blueprint.statement_of_inspiration` is a
required field on the Blueprint model's own output schema
(`server/src/schemas/blueprint.ts`), and its *content* was already fixed
in an earlier session (2026-09-02, "drew from aesthetics instead of
story/why") — but nothing in `BlueprintView.tsx` had ever actually
rendered it, on-screen or in the plain-text export. Fixed both at once:
added a `<blockquote className="blueprint-quote">` callout, positioned
right after "02 — Your intention" (deliberately NOT a 13th numbered
section — the twelve-section architecture stays exactly twelve; this is a
pull-quote callout, matching how a magazine treats one), styled with the
"studio ledger" `--ledger-*` tokens (left border rule in `--ledger-red`,
italic serif text in `--ledger-ink`) — the one deliberate, explicitly-
scoped exception to this file's own documented rule that the Blueprint
stays on the app's ordinary `--fg`/`--muted`/etc. tokens (see the comment
above `.blueprint-quote` in `styles.css`). The plain-text export gets the
same content as an indented, quoted line instead. Framing matches item 1
above ("why you got it").

**5. INVESTIGATED (report only, NOT built): per-candidate individual
re-roll on Screen 7.** Your own instruction was to report the approach
first if it needs new state beyond what already exists — it does, on both
approaches considered, so neither was built:
- **(a) Real re-roll via a new server round-trip.** Ask the model for
  exactly one fresh alternative, given the story and a list of descriptions
  to avoid (the ones already shown). Needs: a new optional request field
  (`avoid_descriptions`, or similar) and prompt extension on the server,
  PLUS new client-side state — `useAsyncAction` (the one sanctioned
  async-action hook, `web/src/journey/useAsyncAction.ts`) tracks exactly
  one in-flight action per hook instance by design (its whole purpose is
  serializing re-entrancy/staleness for a single action), so re-rolling
  candidate index 2 independently of index 0 needs a new, keyed variant of
  that same guard discipline — a real but small new piece of
  infrastructure, not a one-line change.
- **(b) Client-only reserve pool, no new server call.** Request a few more
  candidates than are shown on the initial fetch (already a single
  `visual_candidates` array response), keep the unshown ones as a
  client-side reserve, and "re-roll" swaps the current candidate for the
  next unused one in rank order — fully synchronous, so it never touches
  the async/staleness guards at all. Trade-off: a finite pool per fetch
  (needs a graceful "no more alternatives for this one" state), and it
  surfaces an existing lower-ranked idea rather than generating something
  new. **Recommended** as the lightweight default given the explicit ask
  to fit this in "without disrupting the async/staleness guards" — (a) is
  the more genuine feature if you'd rather have it.
Both would still need the discoverability text your instruction asked
for (e.g. "Not quite right? Re-roll for a different idea." near each
candidate); not yet written pending which approach you pick.
**Awaiting your choice of approach before any of it is built.**

**FIXED (approved last session, now built): "Resume where you left off"
panel navigation fix.** Implements the proposal from earlier today's first
entry exactly as specced: `web/src/journey/resumeTracking.ts` (new) tracks
`furthestScreenReached`/`furthestScreenFlags` (new `UIState` fields,
`state.ts`) as a high-water mark, updated forward-only by `Journey.tsx`'s
existing screen-change effect (the same one that already fires
`reportScreenReached` — this needed no new effect timing, just one more
alongside it). `resumableFlagKey()` returns the one flag to restore only
in the single unambiguous case: exactly one progress-gating flag has
diverged from the snapshot, and it diverged in the one direction an actual
backward click ever produces (`true` → `false`, never the reverse).
Anything else — zero divergence (already caught up), more than one flag
diverged (real invalidation logic, or genuine re-answering already
happened) — shows nothing, falling back to today's ordinary click-through
on purpose. `UnderstandingPanel.tsx` renders "Resume where you left off"
in both the rail and mobile variants when `resumableFlagKey()` finds a
match; clicking it just restores that one flag via the same `patchUI`
mechanism every other panel row already uses. No existing screen's own
Back/Edit call sites needed touching. Confirmed live: backed up via the
"Visual material" panel row, the affordance appeared, and clicking it
correctly jumped straight to "Who should shape the final design?" (the
CreativeControl screen the journey had already reached), not back through
every intermediate screen's own Continue button.

**Also included (approved separately): Screen 7 multi-select
discoverability subtitle.** Confirmed current behavior already is
multi-select (`ElementsDiscovery.tsx` renders one independent checkbox per
candidate, `<input type="checkbox" className="ledger-seal-input">` — no
radio-group exclusivity anywhere). Added: "Select as many as feel right —
you can choose more than one." right above the candidate list, shown only
once candidates exist.

**Verification:** typecheck, full test suite (431 tests — up from 418;
new coverage: `resumeTracking.test.ts`, new "Resume where you left off"
tests in `UnderstandingPanel.test.tsx`, new Blueprint quote-box tests in
`BlueprintView.test.tsx`), and build all pass for every implemented item
(1, 2, 4, the multi-select subtitle, and the navigation fix — items 3 and
5 were investigated and reported only, per instruction, and are not
included in this count). Live Playwright verification against the real
dev stack (real server + fake Anthropic double + real Vite) for every
implemented item, with screenshots: the renamed Statement of Inspiration
screen with its new subtitle; the Screen 7 multi-select subtitle; the
"Resume where you left off" affordance appearing after backing up exactly
one step via the panel, then correctly jumping forward past the
intervening screen on click; and the Blueprint's quote-box callout
rendering both its label and the actual `statement_of_inspiration` text
from the fixture, positioned between "02 — Your intention" and "03 — The
design you're imagining" with no thirteenth numbered section introduced.
Item 2's prompt-wording change itself could not be observed against a real
model in this sandbox (no `ANTHROPIC_API_KEY` configured here) — only that
its existing rendering mechanism still works correctly end to end.

### 2026-09-06 — Three live-production findings: dark-mode panel text fixed, Association grounding investigated (report only), panel navigation friction proposed (report only)

Three items from the first live production deploy, all explicitly scoped by
you as "report before implementing" for two of the three.

**1. FIXED: illegible dark-mode text in the "What we've understood" panel.**
Distinct from the earlier `::selection` fix (0f00fee) — that only covered
the text-*highlight* color; this was the normal rendered text color of the
panel's own content. Root cause, confirmed by reading the CSS then
live-verified (Chromium's `colorScheme: 'dark'` emulation — this sandbox's
Playwright install has no WebKit binary, so a literal Safari session
couldn't be launched here, but the bug turned out to be a pure CSS
media-query/cascade issue, not a WebKit-specific rendering quirk, so
Chromium's emulation reproduces it identically): `.understood-rail` sets no
background/color of its own, so it showed the `body` background through —
and `body { background: var(--bg) }` flipped dark under
`@media (prefers-color-scheme: dark)`. Meanwhile `.understood-rows dd` (the
actual answer values) use the hardcoded `--ledger-ink` (`#171614`) from the
"studio ledger" `.sites-tokens` palette, which has no dark variant at all —
so under a dark OS/browser preference, the panel's row values rendered
near-black text on a near-black background (`rgb(23,22,20)` on
`rgb(22,20,15)`), while row labels/heading (`--ledger-red`, a saturated
color) stayed visible-ish, exactly matching the reported symptom (headings
visible, values invisible).

**Correction to the fix you suggested:** `color-scheme: light` alone would
**not** have fixed this. `color-scheme` only affects the browser's default
styling of native form controls/scrollbars/canvas — it does not gate
whether `@media (prefers-color-scheme: dark)` matches; that media query
reflects the OS/browser preference regardless of the page's own
`color-scheme` value. The actual bug was this app's *own* dark-mode CSS
override for `--bg`/`--fg`/etc. running with no matching counterpart in the
"studio ledger" tokens. Since the whole design (Screen 7's "studio ledger"
direction, the understanding panel, all `.sites-tokens` consumers) is
already deliberately light-only with zero dark variants anywhere, the fix
was to remove that automatic dark-mode override entirely and set
`color-scheme: light` (the complementary, correct use of that property once
there genuinely is no dark mode) — making the whole app consistently
light, not just this one panel. This also forecloses the same class of bug
recurring anywhere else two token systems (root vs. ledger) meet.
`web/src/styles.css`: `:root`'s `@media (prefers-color-scheme: dark)` block
removed, `color-scheme: light dark` → `color-scheme: light`.

**Verification:** typecheck, full test suite (418 tests, unchanged — this
was a CSS-only fix, no test files touched), and build all pass. Live
Playwright reproduction against the real dev stack (real server + fake
Anthropic double + real Vite, per this project's established pattern),
forcing `colorScheme: 'dark'` at the browser-context level: before the fix,
`.understood-rows dd`'s computed color (`rgb(23,22,20)`) was read back
against a computed panel/body background of `rgb(22,20,15)` — functionally
invisible, screenshot confirms it; after the fix, body background stays
`rgb(250,248,245)` (the light `--bg`) even under forced dark-scheme
emulation, and the same screenshot shows all three row values ("Past", the
story excerpt, "family") fully legible. **Could not verify against the
actual production URL** — this sandbox's egress proxy rejects
`positive-inking-mvp.onrender.com` (organization policy; the same
limitation hit during the Render deploy investigation two sessions ago),
and separately, production is still crash-looping pending the Start
Command fix from that investigation, so it wouldn't be serving this build
yet regardless. The dev-stack reproduction above is the best available
substitute evidence, matching the rigor used for the original `::selection`
fix.

**2. INVESTIGATED (report only, no prompt change made): some Association
candidates read as generic/boilerplate rather than resonant.** Your live
example: the model wrote a `personal_meaning` that read as its own
meta-admission ("No grounding yet in this story... boilerplate rather than
drawn from the wearer's actual account") sitting in the same list as
genuinely specific candidates, with no visual distinction from them.

Root cause: this is rule 8 (CONCRETENESS, `server/src/schemas/association.ts`)
working as designed for *content* — the prompt's `personal_meaning` clause
(the "Option C" grounding extension from 2026-09-02) says: "If nothing in
the story grounds the meaning yet, say so plainly rather than reaching for
boilerplate phrasing." The model did exactly that — but the instruction
never says *where* that honesty should go. It has an existing, purpose-built
place to go: `resolution_state: "needs_client_specific_detail"` +
`follow_up_prompt`, the exact mechanism `description`'s own concreteness
gate already uses, which the UI already renders distinctly (Screen 7 shows
an inline follow-up-question marginalia label under any candidate marked
this way — `ElementsDiscovery.tsx` line ~566). Instead, the model wrote its
admission directly into `personal_meaning` itself, which is rendered
verbatim to the user (`<span className="ledger-candidate-meaning">`) — so
the "say so plainly" honesty became a different flavor of exactly the noise
rule 8 exists to prevent: text that isn't a real answer, undistinguished
from the candidates that are.

Two things do NOT already gate this: `rankVisualCandidates` (engine/src/
visualRanking.ts) orders candidates by six model-scored numeric dimensions
only (personal_relevance, story_relevance, originality, genericity,
visual_potential, reference_availability) — none of them reads
`resolution_state`/groundedness, so a weakly-grounded candidate isn't
reliably pushed down even if it should be. `suppressGeneratedSymbolicSuggestions`
(the one existing exclusion mechanism, §9.7) filters by `source_category`
+ `interpretation_confidence` only, not by grounding.

**Proposed approach (not implemented, no prompt wording touched):** extend
rule 8's `personal_meaning` clause to route an ungrounded meaning through
the *same* `resolution_state`/`follow_up_prompt` mechanism `description`
already uses, instead of writing the admission as prose: when nothing
grounds the meaning, set `resolution_state: "needs_client_specific_detail"`
with a `follow_up_prompt` that would ground it (e.g. "What does this
actually mean to you?"), and keep `personal_meaning` itself as a real,
honest, unresolved-but-not-apologetic placeholder — mirroring exactly how
`description` already handles this same situation. This keeps the
candidate offered (the user may still want it and can resolve it with one
answer) rather than silently excluding something they might have chosen,
while finally giving it the same visible "needs one more detail" treatment
strong candidates don't get, instead of sitting undistinguished among them.
A harder alternative (exclude/never offer a candidate with an
under-grounded meaning) was considered and not recommended — it risks
hiding a candidate whose `description` alone might still be worth the
client's attention, and there's no existing precedent for outright
exclusion keyed on content quality (only on category + confidence).
**Awaiting your sign-off before touching the prompt.**

**3. PROPOSED (report only, not implemented): "Resume where you left off"
for the understanding panel's backward-only navigation.** Confirmed real:
`web/src/journey/understandingPanel.ts`'s `editUiPatch` on every row clears
exactly one boolean gating flag (e.g. `elementsDiscovered: false`) to send
the journey back to that row's source screen — there is no "furthest screen
reached" tracked anywhere today; `screen = getNextScreen(deriveProgress(state))`
(`Journey.tsx`) is purely a live derivation from the current flags, with no
history.

Investigated whether the existing flag design already resolves this for
free in most cases: it partly does — since a backward click only clears the
*one* flag for its own row, every screen further ahead than the row you
edited keeps its own flag `true` and its own answer data untouched, so once
you re-answer just the row you went back to, `getNextScreen` walks straight
past every still-`true` downstream flag in one render — no separate "resume"
mechanism needed there. Two things break this: (a) real invalidation logic
(`ElementsDiscovery.tsx`'s confirm(), §14's new-idea loop) that legitimately
clears specific downstream answers when a change actually affects them —
correctly forcing real re-answering, which "resume" must never try to
bypass; and (b) simply wanting to bail out of a look-back *before*
re-answering anything, which is exactly your reported friction — right now
that still requires clicking Continue on the row's own screen at least once
to re-trigger the flag-skip, and Blueprint's own "Change something" clears
two flags at once (`blueprintReady` + `designConfirmed`), which won't
resolve to a single-step case either.

**Proposed mechanism**, sized to your explicit scope (not full
forward+backward navigation — just getting back to the furthest point
already reached):
- Track a **high-water mark**: `furthestScreenReached: ScreenId`, updated
  in `Journey.tsx`'s existing screen-change `useEffect` (the same one that
  already fires `reportScreenReached` on every screen transition) whenever
  the newly-derived `screen`'s ordinal position in `SCREEN_IDS` exceeds the
  stored one. Since a single journey only ever visits one of the two
  mutually-exclusive early-screen branches (full mode vs.
  attraction/expert), raw array-index comparison stays monotonic within any
  one journey — confirmed by reading `engine/src/screenFlow.ts`.
- Alongside it, snapshot the **progress-gating flags** (the ~13 booleans
  `deriveProgress` reads, not all of `UIState` and none of `ProjectState`)
  at the same moment the high-water mark advances.
- On every render, diff the live flags against that snapshot. If **exactly
  one** flag differs (the live one is `false` where the snapshot says
  `true`) — which is precisely the shape of "I clicked one panel row and
  haven't touched anything since" — show a small "Resume where you left
  off" affordance (understanding panel footer area is the natural spot,
  same place as the existing "Nothing here is fixed..." note) that simply
  restores that one flag (`patchUI({ [thatKey]: true })`), which by
  construction reproduces the exact pre-navigation state and lets
  `getNextScreen` snap straight back. If **more than one** flag differs —
  which only happens once real invalidation logic has actually fired, or
  the user has genuinely started re-answering something — deliberately show
  nothing and fall back to today's normal click-through; extending this to
  the multi-flag case would mean rebuilding real forward+backward
  navigation, explicitly out of scope.
- This needs no changes to any existing screen's own Back/Edit button
  call-sites — it's entirely new derived state plus one small affordance,
  same shape as the auto-finalize `useEffect` pattern just shipped for
  ArtisticDirection/CompositionBackground.
- **Compatibility check requested:** this is pure synchronous bookkeeping
  over booleans already in `UIState` — no network calls, nothing that
  touches `runFetchAssociations`/`guard.isStale()` or any other async
  invariant, and no interaction with the auto-finalize fix beyond both
  keying off the same `screen`-change effect in `Journey.tsx`.
**Awaiting your sign-off before building any of this.**

### 2026-09-05 — Fixed the ArtisticDirection/CompositionBackground dead end: auto-finalize a flow already resolved on render

Implements the fix proposed in the 2026-09-04 investigation below (commit
0f00fee), now confirmed live to resolve both the original hang and the
"Edit Composition" re-trap as one change, not two.

**The fix, exactly as scoped -- one small addition per screen, no rewrite
of the evaluation functions:** both `ArtisticDirection.tsx` and
`CompositionBackground.tsx` gained a `useEffect` that runs
`evaluateArtisticDimensions()`/`evaluateCompositionFlow()`'s own
finalization logic (setting `artisticFlowDone`/`compositionFlowDone` to
`true`, and for ArtisticDirection also applying every resolved
dimension's value via the existing `finalizeAllDimensions()`) whenever
`nextToAsk` is already `null` on render -- not only from inside the
screen's own `answer()` click handler, which is all that existed before.
`evaluateArtisticDimensions()`/`evaluateCompositionFlow()` themselves
were not touched at all -- confirmed correct, the investigation found
nothing wrong with their logic, only with how the screens reacted to it.

Both effects are guarded against redundant work (`!ui.artisticFlowDone`
/ `!state.ui.compositionFlowDone`) and, for ArtisticDirection, against
firing while `needsFidelityTreatment` is still true (that prerequisite
question takes priority; finalizing dimensions before it's answered
would be premature). `ArtisticDirection.tsx` needed a small structural
change beyond just adding the effect: its `needsFidelityTreatment` early
return previously happened *before* `result` was computed, which would
have made the new `useEffect` call conditional (a Rules-of-Hooks
violation -- React would see a different number of hooks called between
renders). Reordered so `result` and the effect are computed
unconditionally on every render, with the fidelity-treatment and
"settled" early returns both moved after the hook.

**Confirmed live: this fix resolves the navigation re-trap too, as a
side effect, with no separate addition needed.** Reproduced the exact
"Edit Composition" scenario from the investigation on top of the fix:
clicking that panel row while stuck on ArtisticDirection now
auto-finalizes Composition immediately (same effect, same mechanism),
which lets the journey's own `getNextScreen()` walk forward through
Style Reference and ArtisticDirection -- both auto-finalizing in turn
since neither's underlying answers changed -- landing cleanly back on
Avoidances rather than re-trapping. No forward-navigation UI was added
to the "What we've understood" panel, per instruction -- the panel's
rows are still backward-only; the fix simply means backward navigation
onto either of these two screens no longer gets stuck when it lands on
already-fully-resolved data.

**Verified:**
- `npm run typecheck`, `npm test` (418 tests -- engine 165, server 65,
  web 188 [+7 new: `ArtisticDirection.test.tsx` and
  `CompositionBackground.test.tsx`], up from 411 before this pass),
  `npm run build`, all pass.
- New regression tests seed a journey state landing directly on each
  screen with its flow already fully resolved (every dimension/question
  key pre-filled in `ui.artisticAnswers`/`ui.compositionAnswers`) and
  assert: the screen still renders its "settled" text (confirming the
  test genuinely reproduces the bug condition) but the completion flag
  and, for ArtisticDirection, every resolved project field, are set
  automatically with no click; the fix is idempotent (no error when the
  flag is already `true`); ArtisticDirection correctly does NOT
  auto-finalize while a pending fidelity-treatment question exists; and
  a companion "genuinely not yet resolved" case for
  `CompositionBackground.tsx` confirms the fix never skips a real,
  legitimate question.
- **Live browser reproduction of the exact original scenario** (small,
  non-exact-fidelity design + a confidently-recognized style like
  "American traditional" resolving all 7 style-resolvable dimensions,
  real server + real Vite + real components, only the one style-
  reference network response stubbed): confirmed the "settled" dead-end
  text never appears, the journey auto-advances straight to Avoidances
  with `ui.artisticFlowDone` correctly `true` in persisted state with no
  click, and the full journey completes end to end through Placement and
  Design Confirmation to a real, correctly-populated Blueprint (its
  "Concept-specific decisions"/"Artistic treatment" sections show every
  style-resolved value). **Separately re-verified the "Edit Composition"
  re-trap scenario** on the same fix: clicking that row from the stuck
  state no longer shows "Composition settled" or any other settled-
  fallback text, landing back on Avoidances instead. Zero uncaught JS
  errors throughout either run. Screenshots captured for both scenarios
  and the completed Blueprint.

### 2026-09-04 — Live-test bug: ArtisticDirection/CompositionBackground can hang with no way forward or back; dark-mode text selection was illegible (fixed)

Three related items from one live-testing session, investigated together
since the last two surfaced while trying to recover from the first.

**1-5. Confirmed real, reproduced live: "Artistic direction settled. Moving
on..." is a genuine dead end, not a false alarm or timing artifact --
investigated, not yet fixed (a fix was proposed but implementation was
deferred pending a product decision on item 7 below).** Root cause:
`ArtisticDirection.tsx`'s `!result.nextToAsk` fallback branch only ever
gets `ui.artisticFlowDone` set to `true` from inside its own `answer()`
handler -- which requires a question to have been shown and clicked.
`evaluateArtisticDimensions()` (`engine/src/artisticDimensions.ts`) can
legitimately return `nextToAsk: null` on the component's very *first*
render, before `answer()` has ever run once, whenever a named style
reference has already resolved most/all of the 7 resolvable dimensions
(`RESOLVABLE_STYLE_DIMENSIONS`, `server/src/schemas/styleReference.ts`)
and the remaining two (`visual_presence`, `rendering_references`) aren't
triggered for a small, non-exact-fidelity piece. When that happens, no
button is ever rendered, `answer()` is never called, and
`getNextScreen()` (`engine/src/screenFlow.ts`) keeps returning
`"artistic_direction"` forever, since nothing else ever sets the flag.
This is a distinct failure mode from the "Composition settled" case
investigated and ruled a false alarm on 2026-09-03 -- that investigation
only ruled out reaching the settled state *via* `answer()`'s own React 18
batching; it never considered reaching it already-settled on mount, with
no `answer()` call in the component's history at all.

The two `style_reference` calls visible in the original bug report's
server log are a legitimate two-step flow ("That's not right — try
again" resubmitting different text), not a hidden retry/duplicate bug --
confirmed by reading `StyleReference.tsx`'s `tryAgain()`. They're simply
what made full dimension resolution likely enough to trigger the latent
bug in this specific session.

Live-reproduced end to end (real server, real Vite, real
`ArtisticDirection.tsx`, only the one style-reference network response
stubbed to resolve all 7 dimensions for a small piece): the `.screen`
div's entire rendered content was exactly the one `<p>` from the
screenshot -- no heading, no button, no option chips -- confirmed to
persist 4+ seconds later (not a flash), with `ui.artisticFlowDone`
permanently `false` in the persisted journey state, zero uncaught JS
errors. `CompositionBackground.tsx` has the structurally identical flaw
(same `!flow.nextToAsk` -> only-set-via-`answer()` pattern) and is
equally reachable in principle, later actually reproduced live via item 7
below.

**6. UX bug, root-caused and fixed: illegible dark-mode text selection.**
No `::selection` CSS rule existed anywhere in `web/src/styles.css`
(confirmed by search, zero matches). The app's root `--bg`/`--fg` tokens
already correctly swap under `prefers-color-scheme: dark`
(`--bg: #16140f`), and the "What we've understood" panel
(`.understood-rail`) sets no background/color of its own -- it inherits
these root tokens directly (it only borrows `.sites-tokens` for
typography/spacing, per its own code comment). With no `::selection` rule
anywhere, the browser's default blue highlight painted against that
near-black background, illegible -- and this was global (anywhere text
could be selected), not panel-specific, exactly as reported. Fixed by
adding `--selection-bg`/`--selection-fg` at `:root` (literal copies of
the ledger palette's red/white values, not the scoped `--ledger-*`
tokens themselves, which stay deliberately confined to `.sites-tokens`
elements per the existing `--accent`/`--muted` collision reasoning
already documented there) plus one global `::selection` rule. Live-
verified in a real dark-color-scheme browser context: read back the
*actual computed* selection colors (not just that a rule exists) --
resolved to `rgb(142, 47, 42)` background / `rgb(255, 253, 248)` text.
Screenshot captured showing legible red-on-cream-text selection against
the dark page.

**7. Investigated and reported, NOT fixed (a product decision, not a bug
fix) -- and turns out to be the SAME root cause as items 1-5, not a
separate issue.** `understandingPanel.ts`'s `editUiPatch` mechanism is
structurally backward-only: every row sets a gating flag to `false`,
never forward. Nothing in that file's otherwise-thorough comments
addresses this as a considered tradeoff (every other omission there is
explicitly justified) -- reads as an unexamined gap, not a deliberate
constraint.

More importantly, live-reproduced that going back doesn't reliably work
either, for the same two screens: while stuck on ArtisticDirection,
clicking "Edit Composition" in the panel does NOT land on an editable
Composition screen -- it immediately re-triggers the identical dead-end
pattern one screen earlier ("Composition settled. Moving on...", no
heading, no button). This is mechanically guaranteed, not incidental:
going back only clears `compositionFlowDone`, never the underlying
answers, so `evaluateCompositionFlow()` re-runs against the exact same
already-fully-resolved `already_answered` data and immediately returns
`nextToAsk: null` again. Since `CompositionBackground.tsx` and
`ArtisticDirection.tsx` are the only two screens using this "evaluate a
flow, only advance via `answer()`" pattern, every other panel row
(Viewpoint, Story, Meaning, Placement -- simple one-shot forms) edits
normally; only these two are affected, and they're affected on both the
"stuck" side and the "going back" side by the identical structural flaw.
**Net effect, confirmed live:** once stuck, there is no way forward past
ArtisticDirection, and the one affordance that looks like it should help
(Edit Composition) produces a second identical trap instead. Recommended
(not implemented): the same fix that resolves items 1-5 -- auto-
finalizing a flow that's already fully resolved on render, not only via
`answer()` -- would resolve the "Edit Composition" trap as a side effect
too, likely without needing separate forward-navigation UI. Left as an
open decision pending direction, per instruction.

**Verified:** `npm run typecheck`, `npm test` (411 tests, unchanged count
-- items 1-5 and 7 were investigation-only, item 6 was a CSS-only
change with no logic to unit-test), `npm run build`, all pass. Live
Playwright reproductions (real server, real Vite, real components, only
network responses stubbed) for all three items, with screenshots
reviewed for each: the original hang, the dark-mode selection fix, and
the Composition re-trap. Console/network monitored throughout -- zero
uncaught JS errors at any transition; the one console 404 observed
during the original repro didn't correlate with any tracked failed
request (most consistent with a routine `favicon.ico` 404, unrelated to
the bug).

### 2026-09-04 — Render deployment prep + anonymous analytics moved from local file to Supabase Postgres

Two-part production-readiness pass: making this deployable as a single
Render web service, and swapping the anonymous-analytics store (added in
ebfa350) off a local file that can't survive Render's ephemeral
filesystem. Both parts were investigated before anything was changed, per
instruction.

**Part 1 -- Render deployment prep:**

- **PORT binding: already correct, no fix needed.** `server/src/env.ts`
  already read `Number(process.env.PORT ?? 8787)` -- confirmed by reading
  the file, not assumed.
- **Health check: reused the existing route rather than adding a
  redundant one.** `GET /api/health` already existed and already returns
  200 with a small diagnostic body (`{ ok, modelConfigured }`). Rather
  than add a second, functionally-identical `/healthz` route, `render.yaml`
  points its `healthCheckPath` at `/api/health` directly.
- **Static frontend serving in production: a real gap, found and fixed.**
  `server/src/app.ts` was API-only -- nothing served the built React
  frontend (`web/dist/`) at all. On Render, only this one process runs (no
  separate Vite dev server, which only exists locally), so without this
  fix the deployed app would have had a working API and no UI. Fixed by
  adding `express.static(WEB_DIST_DIR)` (resolved relative to this file
  via `import.meta.url`, not `process.cwd()`, the same convention
  `analyticsStore.ts` already uses) plus a catch-all SPA fallback for any
  other non-`/api/*` GET request, guarded with `existsSync` so a checkout
  without `web/dist` built (e.g. running server tests in isolation)
  degrades to Express's ordinary 404 rather than crashing.
- **`render.yaml` added** at the repo root: build command
  (`npm install && npm run build`), start command (`npm run start -w
  server`), health check path, and every required env var declared with
  `sync: false` (Render's own "must be set manually in the dashboard, not
  stored in this file" mechanism) plus an explanatory comment for each --
  no secret is stored in the file itself. **Flagged, not silently
  guessed:** this sandbox's network egress to render.com is blocked, so
  the exact current Blueprint schema could not be verified live against
  Render's docs -- the field names used match Render's long-documented
  spec, but the file's own header comment tells you to sanity-check it
  against Render's dashboard on first connect (which validates on
  connect and reports a clear error on any mismatched field name).
- **No hardcoded localhost/port found.** Every client-side API call
  already uses a relative path (`fetch("/api/...")`, confirmed in both
  `web/src/api/client.ts` and `web/src/instrumentation/analytics.ts`), so
  none of them would break pointing at a different origin. CORS
  (`cors()` with no options) is already permissive/origin-agnostic, not
  hardcoded to a specific origin -- left unchanged since narrowing it
  wasn't asked for and isn't required for correctness. The one
  `localhost` reference found (`server/src/index.ts`'s own startup log
  line) is cosmetic console output only, not a functional path.
- **Verified live**, not just by reading code: built the real production
  bundle (`npm run build`), then ran the actual compiled server
  (`node server/dist/index.js`) with `PORT`/`NODE_ENV=production` set
  exactly as Render would, and curled `/api/health` (200), `/` (the real
  SPA `index.html`, not an error), `/methodology.html` (a static AEO
  page), the hashed JS bundle referenced from `index.html` (200, not
  404), `/robots.txt`, an unknown non-API path (correctly served the SPA
  fallback), and an unknown `/api/...` path (correctly a real 404, not
  swallowed by the fallback).

**Part 2 -- analytics: local file -> Supabase Postgres:**

- **Env vars reported first, before implementing**, per instruction:
  `SUPABASE_URL` (Project Settings -> API -> Project URL) and
  `SUPABASE_SERVICE_ROLE_KEY` (Project Settings -> API -> service_role
  secret -- deliberately not the anon/public key, since a server-side
  insert needs to bypass Row Level Security and this key must never reach
  a browser).
- **Schema** (`docs/supabase-schema.sql`, to be run once in Supabase's SQL
  editor): one `analytics_events` table covering both existing event
  shapes (`screen_reached`, `journey_completed`) with nullable columns for
  whichever fields don't apply to a given row -- deliberately one table,
  not two, matching "keep it as simple as the current JSON structure" and
  mirroring how the existing JSONL stream already mixes both shapes. RLS
  is enabled with no policies (the server only ever writes via the
  service_role key, which bypasses RLS; nothing reads this table from a
  browser today, matching `analyticsStore.ts`'s existing "reads nothing
  back" design).
- **Client choice: `@supabase/supabase-js` (official JS client), not a
  raw `pg` connection.** Reasoning: this workload is simple single-row
  inserts with no transactions or complex SQL, the official client talks
  HTTPS/REST rather than a raw TCP connection, so there's no connection-
  pool lifecycle to manage on Render's free tier, and it's officially
  maintained rather than something to hand-roll connection handling for.
  Added as a new `server` dependency.
- **Local-dev fallback: automatic, based on whether both env vars are
  set** (`server/src/supabaseClient.ts`'s `getSupabaseClient()` returns
  `null` unless both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
  present; `analyticsStore.ts`'s `appendAnalyticsEvent()` writes to
  Supabase when it gets a real client back, otherwise falls back to the
  original local-file JSONL write, unchanged). No separate flag or config
  needed -- local dev with no Supabase project configured behaves exactly
  as it did before this change; only production (where both vars are set
  via Render) writes to Supabase.
- **Validation discipline unchanged, not weakened.** The route
  (`server/src/routes/analytics.ts`) and its zod schema were not touched
  at all -- `analyticsStore.ts`'s storage swap sits entirely behind the
  same `appendAnalyticsEvent()` call the route already made, so the
  schema still has no free-text field, and a bad/malicious payload still
  never reaches either storage backend.

**Part 3 -- documentation:**

- **`docs/positive-inking-privacy-notice.md`'s "Anonymous usage
  analytics" section** now states plainly that this data is stored via
  Supabase (a third-party database provider), with the same "cannot
  contain story/image content, cannot identify you" guarantee restated
  as still true and why (the validating schema has no free-text field at
  all, unchanged by this swap). **Also updated the notice's own
  "Third-party tools" line**, which previously read as "we do not use any
  third-party analytics... tools" without qualification -- technically
  still true in substance (Supabase never receives story/image content)
  but would have read as contradicting the new Supabase mention a few
  paragraphs later. Reworded to name Supabase explicitly while restating
  the actual guarantee (no third party ever receives story/image
  content), rather than leaving an apparent inconsistency in a document
  about to be read by real people. The published static page
  (`web/public/privacy.html`) was kept in sync with both changes, same
  discipline as the previous session's stale-hedge fix.
- **`docs/deployment.md` added**: Supabase setup steps (create project,
  run the schema SQL, where to find the two required credentials),
  Render setup steps (connect the repo, set the `sync: false` env vars,
  deploy, add the `discover.positiveinking.org` custom domain once live),
  a table of exactly which env vars are required vs. optional, and an
  explicit callout that forgetting to set the two Supabase vars in Render
  fails silently (falls back to the local file, which then loses data on
  every restart) rather than loudly -- worth knowing before wondering why
  analytics numbers look low after a deploy.

**Verified:**
- `npm run typecheck`, `npm test` (411 tests -- engine 165, server 65 [+5
  new in `analyticsStore.test.ts`], web 181, up from 406 before this
  pass), `npm run build`, all pass.
- `server/test/analyticsStore.test.ts` (new, 5 tests, mocking both
  `@supabase/supabase-js` and `node:fs/promises` so no real network call
  or disk write happens in the test suite): writes to Supabase (correct
  table name, correct row, correct client construction args) when both
  env vars are set; falls back to the local file when neither is set;
  falls back to the local file when only one of the two is set (proving
  the branch requires both, not just one); a Supabase insert error
  propagates as a thrown error so the route's existing fire-and-forget
  `202 { ok: false }` handling still applies; the Supabase client is
  constructed once and reused across multiple calls, not reconnected
  per-event.
- Existing `server/test/analyticsRoute.test.ts` (all 8 tests) required no
  changes at all and still passes unmodified -- it already mocked
  `analyticsStore.js` at the module boundary, so the internal storage
  swap is invisible to it, exactly the kind of seam that test was
  written against.
- **Live production-mode verification** (not just unit tests): described
  under Part 1 above -- the real compiled server, real `PORT`/
  `NODE_ENV=production`, real curl requests against every route category
  that matters (API, static SPA, static AEO pages, hashed assets, SPA
  fallback, real 404 on an unknown API path).
- **Not verified, and cannot be from this sandbox:** an actual write to a
  real Supabase project (no live Supabase credentials exist here) --
  `analyticsStore.test.ts` proves the client is called correctly with the
  right table/row shape when configured, and `docs/supabase-schema.sql`
  is the exact schema the row shape is designed against, but a real
  end-to-end write against your actual Supabase project needs to be
  checked once it's set up, per `docs/deployment.md`.

**Exactly what you need to do, as a numbered list:**
1. In Supabase: create a project, run `docs/supabase-schema.sql` once in
   its SQL editor, then copy the Project URL and the service_role secret
   from Project Settings -> API.
2. In Render: connect this repo (it will detect `render.yaml`), then set
   these env vars in its dashboard when prompted: `ANTHROPIC_API_KEY`
   (required), `ANTHROPIC_MODEL` (optional), `SUPABASE_URL` (required in
   production), `SUPABASE_SERVICE_ROLE_KEY` (required in production, the
   service_role secret specifically, not the anon key).
3. Deploy, confirm `/api/health` responds, then add
   `discover.positiveinking.org` as a custom domain in Render's dashboard
   once the service is live (Settings -> Custom Domains).

### 2026-09-04 — AEO/citation-authority initiative: Phase 1 (public content) and Phase 2 (machine readability) shipped

Content approved (methodology page, FAQ page, including the three
corrected entries from the prior round) and finalized as real static
pages, then Phase 2 built on top. Explicitly separate from, and does
not touch, the private intake journey (Screens 1-13) or its logic.

**Phase 1 — three static pages, served as real files via `web/public/`
(Vite copies this directory verbatim into `dist/` and serves it as-is
in dev), not more SPA routes:**
- `web/public/methodology.html` -- "The Provenance Method," the
  approved methodology draft, semantic HTML (single H1, one H2 per
  section, no skipped levels).
- `web/public/faq.html` -- the approved FAQ draft with all three
  corrected entries folded in in place of their originals (the voice-
  audio-routing disclosure, the 18+-matching "Who is Positive Inking
  for?" answer, and the new readiness-disclaimer entry), 13 Q&A pairs
  total, each as an H2 question with its answer immediately beneath
  (direct-answer format).
- `web/public/privacy.html` -- the privacy notice rendered as semantic
  HTML. **Also fixed two stale entries while doing this**: the
  markdown source (`docs/positive-inking-privacy-notice.md`) still had
  `[FILL IN before public launch]` hedges under "Sensitive information"
  and "Photographs of other people" describing gaps that were actually
  closed in commit b79a247 (the sensitive-info notice and the photo-
  rights checkbox both already ship). Publishing the notice publicly
  with those stale hedges still in place would have been inaccurate,
  so both sections were updated in the markdown source to state the
  now-true fact (the checkbox/notice already exist) before the HTML
  page was built from it -- the markdown and the new public page agree.

Each page has a `<title>`, an accurate (non-marketing) meta
description, a footer linking to the other two pages plus back to the
app ("Start your Blueprint" -> `/`), and a header nav. `web/src/screens/
Welcome.tsx` gained two plain `<a>` links ("How this works" ->
`/methodology.html`, "FAQ" -> `/faq.html`) -- ordinary anchor tags
causing a full navigation, not client-side routing, since these pages
live outside the SPA's render tree entirely.

**Filename format: flat `.html`, not directory-style `/methodology/` --
a real constraint found, not a style preference.** Directory-style
paths were tried first and worked correctly under `vite preview`
(production build) but **did not** work under `vite dev` (actual local
dev): Vite dev's SPA-fallback middleware intercepted `/methodology/`
navigation and served the app shell instead of the static file, proven
by a live Playwright click-through that landed on the real URL but
with the Welcome screen's own H1 still rendered. Switched to flat
filenames (`/methodology.html`, `/faq.html`, `/privacy.html`), which
resolve as literal static-file matches in every server involved (dev,
preview, and any eventual static host) with no dependency on a
particular server's directory-index behaviour -- confirmed by re-
running the same live click-through after the switch, which then
passed. All cross-links, canonical URLs, JSON-LD self-references,
`sitemap.xml`, and `llms.txt` were updated to match.

**Phase 2 — machine readability:**
- **Organization schema**, inline JSON-LD on all three pages (name,
  url, description only -- no founding date, employee count, or other
  unverifiable fact invented).
- **FAQPage schema** on `faq.html`, `mainEntity` built from the actual
  13 visible Q&A pairs -- verified programmatically (not just visually)
  that every JSON-LD question/answer string matches the page's own
  visible text exactly.
- **Article schema** on `methodology.html` (headline, description,
  `author: Christos Aravanis`, `publisher: Positive Inking`,
  `datePublished`/`dateModified: 2026-09-04`, `mainEntityOfPage`) --
  no invented credentials beyond what the privacy notice already
  establishes.
- **`web/public/llms.txt`**, following the emerging convention: an H1,
  a one-paragraph blockquote summary, links to all three pages, and a
  short "Notes for automated systems" section stating the 18+
  restriction and the provenance-principle constraint explicitly for
  machine readers.
- **`web/public/sitemap.xml`** listing all 4 URLs (`/`, `/methodology.html`,
  `/faq.html`, `/privacy.html`).
- **`web/public/robots.txt`**: `Allow: /` for `User-agent: *`
  (`Disallow: /api/` only, since those are JSON endpoints with nothing
  crawlable, not a privacy boundary), plus explicit `Allow: /` blocks
  for GPTBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot,
  anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended,
  Applebot-Extended, CCBot, and Amazonbot -- named individually so
  citation is a deliberate choice, not an accident of an unconfigured
  file -- plus a `Sitemap:` line.

**One grounded assumption, flagged rather than silently made:** no
production domain exists yet for this MVP, so `https://positiveinking.org`
was used as the base for canonical URLs and JSON-LD `url` fields --
inferred from the privacy notice's own existing contact email domain
(`Christos@positiveinking.org`), not invented. Worth confirming this is
the actual intended domain before real deployment.

**Verified:**
- `npm run typecheck`, `npm test` (406 tests, unchanged count -- no
  logic changed, only markup/content/config files added), `npm run
  build`, all pass.
- **Raw HTML without JS execution**: built the production bundle
  (`npm run build`) and served the real `dist/` output via `vite
  preview`; `curl`'d `/methodology.html`, `/faq.html`, `/privacy.html`
  directly and confirmed the real `<title>`, `<h1>`, and full body
  content are present in the raw response -- not an empty root div. All
  13 FAQ headings counted in the raw HTML. Single `<h1>` confirmed on
  each page.
- **Structured data validity**: extracted every `<script type=
  "application/ld+json">` block from each page's raw HTML and parsed
  it with `JSON.parse` (all valid), then checked each against its
  type's required fields (Organization: name/url; Article: headline/
  datePublished/author; FAQPage: non-empty `mainEntity` of well-formed
  Question/Answer pairs). Separately cross-checked, programmatically,
  that all 13 FAQPage JSON-LD question/answer strings match the page's
  own visible text exactly (a Google structured-data requirement, not
  just good practice).
- **`robots.txt`**: confirmed via the same served build that it allows
  everything except `/api/`, and that the root `/` (the private intake
  app's own entry point) still serves its real, untouched SPA shell
  (`<div id="root"></div>`) -- confirming this work never touched
  Screens 1-13.
- **Live browser, real click-through (not curl-only)**: a Playwright
  run against the actual `npm run dev`-equivalent Vite dev server
  confirmed both new Welcome-screen links are visible, clicking "How
  this works" performs a real navigation to `/methodology.html` with
  its own H1 rendered (this is the check that caught the directory-
  style routing bug above), `/faq.html` renders directly, and its
  "Start your Blueprint" footer link navigates back to the real intake
  app. Screenshots captured and reviewed.

### 2026-09-04 — AEO/citation-authority initiative: investigation + Phase 1 content drafts underway; voice-audio-routing claim verified and corrected

Kicked off a new initiative (separate from the private intake app):
public-facing, static, crawlable content explaining Positive Inking's
methodology, so AI answer engines (ChatGPT, Perplexity, Google AI
Overviews, Claude) can find and cite it. Explicitly does not touch the
private intake journey (Screens 1-13) or its logic.

**Investigation (Phase 0), reported before writing anything:**
- No public marketing/content site or public routes exist in this repo
  today -- `web/` is a single client-side SPA (`App.tsx` -> `JourneyProvider`
  -> `Journey`), no router, no `web/public/` directory. The private
  intake journey is the only thing currently public.
- Confirmed client-side-only, no SSR: `web/index.html` is an empty
  `<div id="root">` plus a module script tag, nothing else. A crawler
  that doesn't execute JS would see nothing. New public content pages
  need to ship as real static HTML, not more SPA routes -- recommended
  (not yet built) rather than assumed.
- No `robots.txt`, `sitemap.xml`, or `llms.txt` anywhere in the repo;
  `index.html`'s `<head>` has only a charset, viewport, and bare title
  -- nothing currently blocks AI crawlers, but nothing invites them
  either. A blank slate, not a fix.

**Phase 1 content drafted for review (methodology page + FAQ page),
grounded only in verifiable facts already in this codebase** (the real
Provenance system prompt's actual rules, `Viewpoint.tsx`'s real three
journey-mode entry points, the README's actual deterministic-engine-
vs-model-interpretation architecture claim, the Blueprint's real
12-section structure, the five-component Readiness system) -- no
invented user counts, credentials, or claims. **Not yet finalized or
committed as files** -- explicitly waiting on your sign-off per your
own instruction before Phase 2 (structured data, llms.txt, sitemap/
robots.txt) treats any of it as final.

**Content corrections applied this round, from your review:**
- **Voice-audio-routing claim, verified rather than assumed.** Read
  `web/src/components/VoiceInput.tsx`'s actual recognition setup: only
  `recognition.continuous`, `recognition.interimResults`, and
  `recognition.lang` are ever set (lines 148-150) -- no on-device/
  local-processing flag is requested anywhere in the file or
  elsewhere in `web/src`. Per MDN's own documentation, the default
  behaviour absent such a flag is server-based recognition (Chrome
  sends audio to Google's servers to perform the conversion). **Confirmed:
  this app does not request on-device mode, so the off-device default
  applies** -- the disclosure copy you provided was already accurate
  as stated, not the "unlikely" alternative case.
- **`docs/positive-inking-privacy-notice.md`'s "Voice input" section**
  updated to state this as a confirmed fact instead of the prior
  `[VERIFY before publishing]` hedge -- replaced "We have not
  independently verified whether your browser sends audio to its own
  cloud service" with the accurate, now-confirmed disclosure: browsers
  including Chrome send the audio to their own servers by default,
  this is the browser's behaviour rather than something Positive
  Inking controls, and only the resulting text (never audio) ever
  reaches this app.
- **FAQ draft corrections** (not yet a committed file, corrected in
  the draft under review): added the same accurate voice-audio-routing
  disclosure as a direct-answer FAQ entry; replaced "Who is Positive
  Inking for?"'s answer (which said "anyone," contradicting the 18+
  checkbox already shipped on Welcome per the b79a247/ebfa350 work) with
  wording that matches the actual 18+ gate; added a new entry
  clarifying that Blueprint "readiness" describes creative-brief
  completeness only -- not medical, legal, or technical suitability,
  and not final approval, which stays with the client and their artist.

**Explicitly not touched:** voice input itself (stays fully active, not
disabled or altered in any way -- this was a documentation-accuracy
task only); localStorage/session-storage behaviour (a settled decision
from the earlier data-minimization audit, not reopened here); nothing
already shipped in ebfa350 (18+ checkbox + anonymous analytics), b79a247
(sensitive-info notice + photo rights checkboxes), or bb1db2d was
re-touched or re-implemented.

**Verified:** this was a documentation/content correction task with one
investigation step, not a code change -- no logic changed, so no new
test coverage was needed and none was added. Confirmed by reading
`VoiceInput.tsx` in full (not just grepping) that no on-device
recognition flag exists anywhere in the file.

### 2026-09-04 — Two consent checkboxes from the privacy notice: sensitive-information disclosure on Story, third-party photo rights at all 3 upload sites

The privacy notice (added to the repo in the previous session-log entry
below) describes two more things that didn't exist in the UI yet: a
sensitive-information disclosure on the story input, and an explicit
confirmation at the point of uploading a reference photo of someone
else. Both added, minimally, no new screens.

**1. Sensitive-information notice on Story.tsx — disclosure, not a
gate.** A single `<p className="reference-note">` line ("Your story may
include sensitive information such as health, recovery, religion, or
sexuality. Including this is entirely optional.") sits directly above
the story textarea, always visible before submission. Deliberately no
checkbox, no state, no effect on the existing Continue disabled
condition (`text.trim().length === 0`) — purely informational, exactly
as instructed.

**2. Third-party photo rights checkbox — gates the upload itself, at
all 3 sites.** Investigated how upload works at each site before
touching anything (the same 3 sites the EXIF-stripping fix touched):
`ReferenceAttachment.tsx` (1 file input, reused twice inside
`ElementsDiscovery.tsx` for candidates and added ideas),
`StyleReference.tsx` (1 optional example-photo input, shown only when
a style resolution is under-specified), and `Placement.tsx` (2
independent optional inputs — nearby-tattoo reference and placement
photograph). None of `ReferenceAttachment.tsx`'s existing attestation
checkboxes cover this: those only render after `material_type`/
`subject_relationship` are chosen, and only for specific relationship
values (living/child/deceased) — they answer "does this specific
person consent," not "do you have the right to use this image at
all," and only StyleReference/Placement even use `ReferenceAttachment`
at one of their three sites. So this is a genuinely new, non-redundant
gate, not a duplicate of existing consent UI.

Built one small shared component, `web/src/components/
PhotoRightsCheckbox.tsx`, so the exact required wording ("I confirm I
have the right to use this image, and that any identifiable person in
it knows and agrees to it being used here.") lives in exactly one
place, reused at all 4 physical upload widgets across the 3 files.
Each site disables its own `<input type="file">` via `disabled={!
confirmed}` until its checkbox is checked — a real, literal block
(the browser's own file picker can't even open), not just a note. Each
site's file-processing function (`handleFile`/`attachExample`/
`attachFile`) also has a belt-and-braces guard (`if (!file ||
!confirmed) return;`) so the upload can never be processed even if the
`disabled` attribute were somehow bypassed — same defense-in-depth
discipline as the zod validation-error fix in the analytics work
above. `Placement.tsx`'s two upload slots are independently gated
(their own separate `nearbyRightsConfirmed`/`placementRightsConfirmed`
state) since they're genuinely different uploads that could show
different subjects — checking one never enables the other.
`ReferenceAttachment.tsx`'s `ReferenceDraft` gained one new field,
`rights_confirmed: boolean` (defaulted `false` in
`emptyReferenceDraft()`; `draftFromExisting()` — which rehydrates an
already-uploaded reference when navigating back via Screen 13's "Add
references" — sets it `true` only when an asset already exists, since
that upload could only have happened via this same gate the first
time, matching the function's own existing "don't make users
reconfirm what they just did" purpose).

**Confirmed not blocking anything it shouldn't:** uploads remain
entirely optional everywhere — none of the 3 screens' Continue buttons
changed their disabled conditions, and checking one photo's checkbox
never affects any other upload slot or the rest of the journey.

**Verified:**
- `npm run typecheck`, `npm test` (406 tests — engine 165, server 60,
  web 181, up from 394 before this pass), `npm run build`, all pass.
- `web/src/components/ReferenceAttachment.test.tsx` (new, 4 tests):
  the file input is disabled until the checkbox is checked; checking
  it updates `rights_confirmed` via `onChange` independent of other
  fields; a file selected while unconfirmed never reaches `onChange`
  (the belt-and-braces guard, exercised by dispatching a change event
  directly against the still-disabled input); the checkbox doesn't
  render once a file is already attached.
- `web/src/screens/StyleReference.test.tsx` (new, 2 tests): the
  example-photo input is disabled until confirmed; an unconfirmed file
  selection is never processed into a preview.
- `web/src/screens/Placement.test.tsx` (new, 4 tests): both file
  inputs start disabled; checking the nearby-tattoo checkbox enables
  only that input, not the placement-photo one; checking both enables
  both; Continue's own disabled condition (body area only) is
  unaffected by either checkbox.
- `web/src/screens/Story.test.tsx` gained a new describe block (2
  tests): the sensitive-information notice renders near the input;
  Continue's disabled state is driven purely by the existing
  empty-text rule, unaffected by the notice, and a real submission
  still goes through.
- **Live browser, full real journey (not seeded/shortcut) through all
  3 sites:** age-gated entry through Story (screenshotted the notice
  visible above the textarea, Continue still enabled once text is
  typed) into a real Association response, selected a candidate, set
  its fidelity to "Exactly as-is" to reveal `ReferenceAttachment` —
  confirmed the file input starts disabled ("Choose File" greyed out),
  enables the instant the checkbox is checked, and a real PNG upload
  then succeeds and previews correctly. Continued to StyleReference
  (network response stubbed for this one call only, to deterministically
  reach the under-specified-style branch that shows its optional
  example-photo upload — the fake Anthropic double itself and every
  other route were untouched) and confirmed the identical
  disabled → enabled → real-upload-succeeds sequence. Continued to
  Placement and confirmed both slots start disabled, checking the
  nearby-tattoo checkbox enables only that slot (placement-photo slot
  independently stays disabled), and both real uploads succeed once
  each is confirmed on its own — Continue stayed enabled throughout,
  driven only by the body-area field. All checks passed; screenshots
  captured and reviewed at each site.

### 2026-09-04 — Two additions from the finalized privacy notice: an 18+ checkbox, and anonymous cross-user analytics

The privacy notice is now finalized (copied verbatim into the repo at
`docs/positive-inking-privacy-notice.md`, alongside the code it
describes) and its "Age" and "Anonymous usage analytics" sections
describe two features that didn't exist yet. Built both, minimal and
non-intrusive as instructed.

**1. 18+ confirmation checkbox — no new screen.** Added directly to
`web/src/screens/Welcome.tsx`: a single checkbox ("I confirm I am 18 or
older.") next to the existing entry copy, no ID collected, no separate
step. `UIState` gained one new field, `ageConfirmed: boolean` (default
`false`), stored and persisted exactly like every other `ui` flag
through the existing `JourneyState`/localStorage mechanism — not a new
subsystem. The Continue button (`disabled={!state.ui.ageConfirmed}`)
stays disabled until it's checked.

**2. Anonymous usage analytics — proposed before implementing, per
instruction.** The existing `web/src/instrumentation/telemetry.ts` is
first-party and local-only (confirmed in the 2026-09-03 data-
minimization audit below — every event goes to `localStorage`, never a
network call), so it cannot produce the aggregate, cross-user
completion-rate/time-per-step data the privacy notice's own "Anonymous
usage analytics" section describes. Proposed and built the smallest
reasonable approach given this app's architecture (no accounts, no
database): a same-origin server endpoint,
`POST /api/analytics/event`, that accepts only two event shapes
(`screen_reached`, `journey_completed`) and appends each as one JSON
line to `server/data/analytics-events.jsonl` (git-ignored, no
dashboard/query endpoint — append-only). Chose self-hosted over a
third-party analytics service specifically so the notice's own "we do
not use any third-party analytics... tools" line stays true with zero
added verification burden, rather than becoming another thing to keep
in sync with vendor changes.

**Structurally, not just by convention, incapable of carrying story or
image content.** The request schema
(`server/src/routes/analytics.ts`, zod) has no free-text field at all —
every field is either an enum (`screen`/`from_screen`, validated
against a new `SCREEN_IDS` runtime const in `engine/src/screenFlow.ts`;
`journey_mode`) or a bounded, non-negative integer (`elapsed_ms`/
`elapsed_ms_on_previous_screen`, capped at 24h). There is no code path
by which a request body containing story text or image data could pass
validation, let alone reach the store — confirmed by
`server/test/analyticsRoute.test.ts`, not just asserted. `session_id`
is a client-generated UUID held only in a module-scope variable
(`web/src/instrumentation/analytics.ts`) — never written to
localStorage, regenerated on every page load — so events can't be
stitched across a reload or across visits; it exists solely to compute
per-attempt step timing, not as a durable identifier. **Confirmed: this
sends no story text, no image data, and nothing that could re-identify
a specific person's journey content — only step identifiers, a journey
mode, and timestamps/durations**, matching the privacy notice's own
description exactly.

**Wiring:** `Journey.tsx` reports `screen_reached` (current screen,
previous screen, elapsed ms since the previous screen was reached,
journey mode) from a `useEffect` keyed on the computed `screen` value
alone, so it fires exactly once per real screen transition and never on
unrelated state updates (typing, etc.). `DesignConfirmation.tsx` reports
`journey_completed` (journey mode, total elapsed ms) at the same point
it already logs the equivalent local-only telemetry event, reusing the
same already-computed `elapsed_ms` value rather than computing it
twice. Both calls are fire-and-forget (`fetch(...).catch(() => {})`,
`keepalive: true`) — analytics can never throw, retry, or surface a UI
error, the same non-negotiable rule `telemetry.ts` already follows.

**A real bug caught by the "never leaks content" test, then fixed.** The
route's first draft echoed `parsed.error.message` back in the 400
response on a validation failure, matching every other route in this
app. zod's own `invalid_enum_value` error message includes a
`"received": "<the submitted value>"` field — so a request that put
story-like text where the `screen` enum belongs would have had that
text reflected straight back in the error response, defeating the
entire point of this endpoint. Caught by
`analyticsRoute.test.ts`'s own "rejects free text smuggled into the
screen field" test before this ever shipped. Fixed by using a static
error message for this route specifically, instead of `parsed.error
.message` — left every other route's existing error-message pattern
unchanged, since their fields are legitimately free-text and don't
carry this specific risk.

**Verified:**
- `npm run typecheck`, `npm test` (394 tests — engine 165, server 60,
  web 169, up from 373 before this pass), `npm run build`, all pass.
- `server/test/analyticsRoute.test.ts` (8 tests): accepts well-formed
  `screen_reached`/`journey_completed` events; strips an unexpected
  extra field containing a story marker entirely before persisting;
  rejects free text smuggled into the `screen` enum field *and*
  confirms the 400 response body doesn't leak it (the test that caught
  the bug above); rejects an unknown event name, a malformed
  `session_id`, and an `elapsed_ms` over the 24h bound; accepts every
  real `SCREEN_IDS` value.
- `web/src/instrumentation/analytics.test.ts` (5 tests): both report
  functions POST exactly the expected field set and nothing else; the
  same session id is reused across multiple calls in one page load;
  never throws when the request fails; `from_screen`/
  `elapsed_ms_on_previous_screen` are `null` on the first screen.
- `web/src/screens/Welcome.test.tsx` (5 tests): Continue disabled until
  checked, re-disables on uncheck, confirmation stored as a plain
  boolean in the existing localStorage key, persists across a
  simulated reload, and clicking Continue leaves `ageConfirmed` itself
  untouched.
- `web/src/journey/Journey.test.tsx` gained 3 tests covering the
  analytics wiring: fires once on mount with `from_screen: null`; fires
  again with both screen names, a numeric elapsed value, and the
  journey mode when a click-to-edit row changes the screen; does not
  fire on an unrelated local-state update (typing in Story.tsx's
  textarea).
- **Live browser, real end-to-end journey (not seeded/shortcut):**
  drove a complete real click-through of the full "full"-mode journey,
  Welcome through Blueprint, against a real server + real Vite dev
  server + a fake Anthropic double, capturing every real
  `POST /api/analytics/event` request the browser actually sent. 19
  total analytics requests captured (18 `screen_reached`, 1
  `journey_completed`); zero of them contained the story text typed in
  along the way or its planted identifying detail; every captured
  request body's keys were a subset of the expected whitelist, nothing
  extra ever rode along. Separately verified the 18+ checkbox: Continue
  starts disabled, enables the moment the checkbox is checked, and both
  the checked state and the enabled button survive a page reload with
  no need to re-check. Screenshots captured for both.

**Privacy notice added to the repo.** Copied the finalized notice
verbatim into `docs/positive-inking-privacy-notice.md`. Its "Third-
party tools" claim ("we do not use any third-party analytics...
tools") remains true after this change: the analytics endpoint is
same-origin (`/api/analytics/event`, served by this app's own Express
server), not a third-party service — no other company receives any
data as a result of this addition.

### 2026-09-04 — Data-minimization/privacy audit: 7-item checklist verified, EXIF stripping fixed, two real gaps flagged

Investigated a specific 7-item data-minimization checklist by reading the
actual code (not assuming), reported findings, then fixed only the
confirmed gap. Full findings recorded in the new "Data-minimization /
privacy audit" section above; this entry is the detail behind it.

**Items verified clean, no code change needed (1, 2, 3, 7):**
- **API key (1):** read once in `server/src/env.ts`, used only in
  `server/src/modelClient.ts`'s outbound header. Never logged, never in
  a response body, never referenced anywhere in `web/`/`engine/` (the
  one hit -- `AsyncError.tsx` -- is static developer-facing help text
  naming the env var, never reading or containing a value).
- **Server logging (2):** no morgan/pino/winston, no request-logging
  middleware. The only `console.*` calls are `[model-timing]`
  (stage/timing/token counts, never prompt content), the Express
  fallback error handler (the `Error` object only, never `req.body`),
  and two process-crash handlers. No route file logs anything at all.
- **File uploads (3):** no multer/formidable/busboy dependency, no
  server-side upload endpoint anywhere. Reference images are handled
  entirely client-side (`FileReader`/canvas -> data URL) and never
  appear in any of the 6 client API modules' outgoing payloads --
  confirmed by reading each one.
- **Third-party tools (7):** no Sentry/Bugsnag/analytics/APM dependency
  in any `package.json`. `web/src/instrumentation/telemetry.ts` is
  explicitly first-party/local-only -- every event goes to
  `localStorage`, never a network call.

**Item 4 (EXIF metadata) -- the one genuine gap, fixed.** Images are
never sent to the model (nothing to strip on that path), but the data
URL held in state and persisted to `localStorage` previously carried
the original file's EXIF intact, GPS included, since
`FileReader.readAsDataURL()` copies bytes verbatim with no processing.
Added `web/src/imageSanitization.ts`: `readFileAsSanitizedDataUrl()`
re-encodes every image through a canvas before it ever reaches app
state -- canvas pixel data carries no metadata channel at all, so this
drops EXIF/GPS/orientation tags entirely rather than parsing and
selectively removing them (a JPEG's orientation tag is naturally "baked
in" correctly as a side effect, since the browser auto-orients the
source before the pixels are read). PNG stays PNG (lossless,
preserves transparency); every other type normalises to JPEG at 0.92
quality. Non-image files (the PDF `ReferenceAttachment.tsx` also
accepts) pass straight through unchanged -- EXIF doesn't apply to a
PDF. Rejects rather than silently falling back to unstripped data on
any failure (read error, decode error, no canvas context), so a caller
can never end up with EXIF-laden data by accident. Wired into all 3
upload sites: `ReferenceAttachment.tsx`, `StyleReference.tsx`,
`Placement.tsx` (both of its photo inputs).

**Items 5 and 6 -- reported, not code-fixed, per instruction.** See the
audit table above for the full reasoning; in short, persistence is
deliberate (§16.1 crash recovery) and the missing delete action is the
real gap in the combination, needing a product decision rather than a
code fix.

**Verified:**
- `npm run typecheck`, `npm test` (373 tests: engine 165, server 52, web
  156 -- up from 360 before this pass), `npm run build`, all pass.
- `web/src/imageSanitization.test.ts` (7 tests): routes image files
  through the canvas path and non-image files through the plain
  FileReader path with nothing ever touching canvas; PNG stays PNG,
  everything else normalises to JPEG; rejects (never falls back) when
  no canvas context is available or the image fails to decode; always
  revokes the object URL it creates, success or failure. jsdom has no
  real canvas 2D implementation without the native `canvas` npm package
  (not a dependency here, and adding one purely for a test double would
  be exactly the unnecessary weight this fix was meant to avoid) -- these
  tests verify the module's contract with fakes, the same pattern
  `VoiceInput.test.tsx` already uses for the Web Speech API; the actual
  pixel-level guarantee is proven by the live-browser run below instead.
- `server/test/dataMinimizationAudit.test.ts` (9 tests): a request
  carrying a distinctive story-text marker and a run against a
  distinctive fake API key, asserting neither ever appears in any
  response body (success, model-error, or the health check) or in
  anything passed to `console.log`/`error`/`warn` on any path; plus
  static checks that no upload-handling dependency or multipart/disk-
  write pattern exists in `package.json` or any route file.
- `web/src/dataMinimizationAudit.test.ts` (4 tests): scans every real
  `web/src` source file for the API key env var name or its server-side
  field name (one verified-harmless exception, `AsyncError.tsx`'s help
  text, explicitly allow-listed with its own test proving it's genuinely
  just static text); confirms no client API module sets an auth header
  or calls a non-relative Anthropic URL.
- **Live browser, real data:** built a real JPEG with real embedded GPS
  EXIF (San Francisco coordinates) and a distinctive camera-make tag
  using Pillow/piexif, uploaded it through the real Placement screen
  against a real server/Vite/fake-Anthropic-double stack. Confirmed the
  source file genuinely contained the EXIF bytes, then confirmed the
  resulting stored image (read back from its actual preview `<img>` src)
  contained neither the EXIF marker nor the camera-make tag --
  byte-for-byte, not inferred. Separately, ran a full session (99 real
  network responses collected, including a deliberately triggered
  model-error response) against a server configured with a
  realistic-looking API key, and confirmed that key never appeared in
  any response body the browser actually received. Screenshot captured
  showing the successfully re-encoded (stripped) image rendering
  correctly in its own preview.

### 2026-09-04 — "What we've understood" panel polish: click-to-edit rows + mobile interaction check (Sites migration polish pass)

Two small polish items on top of the Sites migration panel work.

**1. Click-to-edit panel rows.** Each row now jumps back to the screen
that produced it, reusing the exact Back/Edit mechanism every existing
affordance already uses (`patchUI({ someGatingFlag: false })` --
`IntentionConfirmation`'s "Edit this", `DesignConfirmation`'s "Add
references"/"Change something") -- no new navigation system, no new
state-invalidation logic added anywhere.

`understandingPanel.ts`'s `UnderstandingRow` gained an optional
`editUiPatch: Partial<UIState>` field, computed per row from an audit of
which screen(s) actually write that field:
- **Viewpoint, Visual material, Composition, Placement** -- clickable in
  every journey mode; each has exactly one screen that ever sets it
  (Viewpoint.tsx, ElementsDiscovery.tsx, CompositionBackground.tsx,
  Placement.tsx respectively -- Placement's row also includes size_class
  from RoughScale.tsx, but Placement.tsx is treated as the row's dominant
  source since it owns the majority of the displayed value).
- **Story** -- clickable, target depends on journey_mode: Story.tsx in
  full mode, ImageDescription.tsx in attraction/expert mode (both write
  raw_story, mode-exclusively, never both in the same journey).
- **Meaning** -- clickable only in full mode (MeaningReflection.tsx).
  Left non-clickable in attraction/expert mode: its only possible source
  there is ImageProvenance's one-time optional re-entry offer, which
  never re-offers once resolved (`reentryOffered` stays permanently
  true) -- there is no existing navigation path back to a state that
  could actually let the client revise it, so nothing was invented to
  fake one.
- **Treatment** -- intentionally left non-clickable. Its four fields can
  each independently arrive from StyleReference.tsx (auto-resolved) or
  ArtisticDirection.tsx (asked directly), and which came from which
  varies per journey -- exactly the "no single source screen" case the
  request itself allowed leaving alone.

`UnderstandingPanel.tsx`: a clickable row's dt+dd pair is wrapped in one
`<div role="button" tabIndex={0}>` (valid `<dl>` content per HTML5's
"optionally wrapped in div elements" grouping rule), with Enter/Space
keyboard activation and an `aria-label="Edit {label}"` for a clean
accessible name independent of the row's own text. Styling
(`.understood-row-edit` in `styles.css`) is deliberately understated,
matching the studio-ledger restraint elsewhere in this panel: no button
chrome, just a pointer cursor, an underline that appears only on
hover/focus, and a focus-visible ring -- plus a small negative-margin/
matching-padding pair that widens the actual tap target to the panel's
edges without shifting the visible text.

**2. Mobile interaction check (Task 3 had only confirmed the collapsed
`<details>` renders below 900px via a static screenshot, never actually
interacted with).** Tested for real, with a live browser: tapping the
collapsed `<summary>` expands smoothly (native `<details>` behaviour,
no custom JS needed); the now-clickable rows measured **310x57px** as
touch targets on a 390px-wide viewport, comfortably above the ~44px
comfortable-tap-size guideline; and the panel's expand/collapse state
persists correctly as the user moves between screens in either
direction (stays open after an edit-click navigation, stays collapsed
after a real Continue-driven navigation) -- because Journey.tsx only
`key`s the current *screen* component, not the panel, so the same
`<details>` DOM node survives every screen change within a session (a
full page reload does still reset it, same as any other un-persisted UI
toggle -- not a bug, an inherent property of state that was never
claimed to survive a reload). **No usability issues were found here --
nothing was changed for item 2 beyond what item 1 already delivers.**

**Verified:** `npm run typecheck`, `npm test` (353 tests: engine 165,
server 43, web 145 -- up from 338 before this pass), `npm run build`,
all pass. `understandingPanel.test.ts` gained a full
`editUiPatch` describe block covering every row's clickability decision
and its journey-mode branching; `UnderstandingPanel.test.tsx` gained
component-level tests for the button role, keyboard focus, and the
"only that row's own flag flips, nothing else" invariant; a new
`journey/Journey.test.tsx` (Journey.tsx had no prior test coverage)
proves a full click-to-edit round trip through the real screen router --
click a row, land on the real source screen, the already-confirmed
answer is still there to edit -- plus confirms Treatment never renders a
clickable affordance even mid-journey. Also added a `define` block to
`vitest.config.ts` for `__GIT_COMMIT__`/`__GIT_BRANCH__` (static
placeholder values) -- `vite.config.ts` already injects real git info
for `BuildIdentifier.tsx`/`TelemetryInspector.tsx`, both dev-only
components always mounted inside `Journey.tsx`; without a matching
define in the separate `vitest.config.ts`, any test rendering `Journey`
(none existed before this pass) would crash on those literal identifier
references. Live browser check at both desktop (1280px) and mobile
(390px) viewports confirmed the click-to-edit round trip, the hover/
focus affordance, and the actual mobile tap-to-expand + touch-target +
persistence behaviour described above. Screenshots captured for both
viewports.

### 2026-09-03 — Fixed the monotonic new-idea demotion dead end; two more silent-dead-end Continue buttons fixed the same way

The follow-up to the Screen 7 investigation's flagged-but-not-fixed item:
`classifyIdeaIteration()`'s two demotion triggers (iteration count >= 6,
elapsed-time ratio > 1.5) are both monotonically increasing and never
reset within a journey. A client who reached either threshold with zero
real visual elements and zero candidates selected had **no path left to
ever add a real element** — every subsequent "Add idea" would demote to
`artist_notes` forever, an unrecoverable dead end reachable from ordinary
slow, thoughtful use, not just an extreme edge case.

**Chosen fix, reported before implementing:** the smaller of the two
options offered — never demote while the client currently has zero real
visual elements, rather than building a "promote a note back to a real
element" recovery path. `classifyIdeaIteration()`
(`engine/src/newIdea.ts`) now takes a third parameter,
`hasRealVisualElement: boolean`; both demotion triggers are gated on it
being true, and iteration count / elapsed ratio behave exactly as before
once it is. `web/src/screens/ElementsDiscovery.tsx`'s one call site now
passes `state.project.visual_elements.length + addedIdeas.length > 0`.
The anti-thrash protection this function implements is unchanged for
every client who already has one real element on the table — it now only
ever stands down for the specific case of getting the *first* one.

**Also fixed, same pattern as the Screen 7 report:**
- `MeaningReflection.tsx` — Continue (`disabled={selected.length === 0}`)
  now shows "Select at least one theme above to continue." whenever
  disabled.
- `ImageProvenance.tsx`'s `finalizeElaboration` (the provenance re-entry
  theme-confirmation step) — same disabled condition, same message added.

**Verified:**
- `npm run typecheck`, `npm test` (338 tests: engine 165, server 43, web
  130 — up from 327 before this change), `npm run build`, all pass.
- `engine/test/newIdea.test.ts` gained a dedicated "core invariant" describe
  block: iteration >= 6 and elapsed ratio > 1.5 each independently, and
  both together, never return `"demoted_to_notes"` while
  `hasRealVisualElement` is false (falling back to the ordinary
  `"full"`/`"full_with_scope_reflection"` behaviour instead); and, the
  moment a real element exists, both triggers demote exactly as before —
  proving the anti-thrash protection was not weakened for the normal case.
- `web/src/screens/ElementsDiscovery.test.tsx` gained the same coverage at
  the UI level: a journey seeded 10 minutes past creation (past the 1.5x
  threshold for a 4-minute-target journey) with zero candidates and zero
  visual elements can still "Add idea" into a real, pending element with
  Continue enabling — the exact scenario that would have caught the
  original bug — plus a companion test confirming demotion still fires
  normally once one real element already exists.
- New `MeaningReflection.test.tsx` and `ImageProvenance.test.tsx` cover the
  two new disabled-reason messages appearing and disappearing correctly.
- Live browser reproduction (real server + real Vite + fake Anthropic
  double, journey state seeded via the app's own `createInitialJourneyState`
  with `created_at` set 10 minutes in the past) confirmed the fix
  end-to-end: adding an idea in the over-threshold, zero-element state no
  longer shows "Added to your artist notes" — the idea appears as a real
  pending element and Continue enables. Screenshots captured before/after.

**Closed the open decision** that flagged this bug and the two other
silent-dead-end screens for scope — removed from "Open decisions waiting
on you" in the current-status section above, since all three are now
fixed.

### 2026-09-03 — Closed the model-migration timeout open decision: real Sonnet 5 latency measured, budgets left unchanged

Follow-up to the model migration below. You ran `npm run diagnose-model`
for real against `claude-sonnet-5` with a real `ANTHROPIC_API_KEY` (one
sample per stage) and reported the numbers back:

| Stage | Sonnet 5 elapsed | Budget | Margin | Throughput |
|---|---|---|---|---|
| Discovery | 9553ms | 20000ms | 10.4s | 104.9 tok/sec (2704 in / 1002 out) |
| Association | 17403ms | 40000ms | 22.6s | 92.7 tok/sec (2834 in / 1613 out) |
| Blueprint | 18456ms | 30000ms | 11.5s | 86.2 tok/sec (2111 in / 1590 out) |

Recorded these in `docs/timeout-matrix.md`'s "Model migration" section
alongside the old Sonnet 4.5 figures they replace (Discovery 12937ms,
Association 32310ms, Blueprint 18718ms at ~40-55 tok/sec) as clearly
labelled historical context, per this doc's own convention of preserving
prior measurements rather than overwriting them. Updated
`engine/src/modelTimeouts.ts`'s comment to match, so the code and the
docs no longer disagree about whether re-measurement had happened.

**No timeout budget was changed.** Every route now has 10+ seconds of
margin against its existing ceiling under Sonnet 5 (up from as little as
~11s under the old model for Blueprint, and dramatically more for
Association, whose elapsed time nearly halved). Tightening any budget
would only add spurious-timeout risk for a real-world call that happens
to run slower than this one sample, for no actual benefit — nothing here
shows the current numbers causing any problem. This is recorded as a
deliberate decision, not an oversight: the reasoning is the same
diminishing-returns logic this document already applies elsewhere (see
"Revised from real diagnostic data" in `docs/timeout-matrix.md`).

**Closed the open decision** that asked for exactly this measurement (both
the original 2026-09-01 timeout-ceiling entry and the migration's own
"budgets are STALE" note) — removed from "Open decisions waiting on you"
in the current-status section above, since the work they were waiting on
is now done.

**Caveat carried forward, not resolved:** this is one sample per stage,
not an average — the same caveat every prior measurement in this document
carries. It confirms the existing budgets are safe with real headroom
against Sonnet 5; it does not establish a precise, stable ceiling. If
real production traffic later shows a stage running close to its budget,
that's the trigger to gather more samples and revisit, not this one run.

**Verified:** `npm run typecheck`, `npm test` (all suites, unchanged pass
count — no test asserts a specific elapsed-time number or throughput
figure), `npm run build`, all pass. No functional code was changed —
`MODEL_ROUTE_TIMEOUT_DEFAULTS_MS`'s values are untouched; only prose (two
docs files and one code comment) was updated.

### 2026-09-03 — Model migration: default model moved to claude-sonnet-5 ahead of the dated Sonnet 4.5 retirement

The dated Sonnet 4.5 release this app defaulted to is retiring
2026-09-29 -- a retired model returns an error rather than falling back,
so the app would have broken entirely on that date without action.
Migrated the default model everywhere it's referenced to
`claude-sonnet-5`, the current-generation, dateless model ID (not a
dated string -- no `-20250929`-style suffix exists for it).

**Full list of references found before changing anything** (grepped for
the model ID pattern across the repo): `.env.example`,
`server/src/env.ts` (the actual runtime default),
`scripts/validateLocal.mjs` (display fallback text), plus prose citing
the model in `engine/src/modelTimeouts.ts`'s comments,
`docs/timeout-matrix.md`, and two entries in this file and in
`docs/session-summary.md`. `server/.env` doesn't exist in this sandbox,
so there was nothing to change there. No test fixture hardcodes a model
ID literal -- `server/test/env.test.ts`, `engine/test/modelTimeouts.test.ts`,
and `server/test/modelClient.test.ts` all reference `env.anthropicModel`
dynamically, so none needed updating.

**Changed:** the three functional references (`.env.example`,
`server/src/env.ts`, `scripts/validateLocal.mjs`) now read
`claude-sonnet-5`. The historical prose in `engine/src/modelTimeouts.ts`,
`docs/timeout-matrix.md`, `docs/session-summary.md`, and this file's own
earlier entries was reworded rather than left with the literal retired ID
in place, per the instruction that no reference to the old ID should
survive anywhere in the repo -- each now describes the fact ("the model
configured as default at the time, a dated Sonnet 4.5 release, since
retired") without repeating the exact string. Confirmed via grep: zero
remaining matches for the retired ID (or any `-YYYYMMDD`-style dated
model string) anywhere in the repo.

**Date-suffix parsing checked, none found:** searched for any code that
parses, validates, or otherwise assumes a dated-suffix format for the
model ID string. There is none -- `server/src/modelClient.ts` and
`server/scripts/diagnostics.ts` both pass `env.anthropicModel` through as
an opaque string with no format assumptions, so the new dateless ID
format needed no code changes beyond the string literals themselves.

**Timeout budgets NOT touched, on purpose -- re-measurement required, open
decision waiting on you.** `engine/src/modelTimeouts.ts`'s per-route
budgets (Discovery 20000ms, Association 40000ms, Blueprint 30000ms, etc.)
were derived from a real `npm run diagnose-model` run against the
now-retired model (see `docs/timeout-matrix.md`). Sonnet 5 may have
different latency characteristics in either direction, and guessing new
numbers without a measurement would contradict this codebase's own
established methodology for these budgets. Flagged explicitly, in the
same style as this file's other open decisions, in both
`docs/timeout-matrix.md` (new "Model migration" section) and this file's
"Open decisions waiting on you" list: **run `npm run diagnose-model`
against `claude-sonnet-5` with a real API key** (this sandbox has none
configured) and compare against the existing budgets before treating them
as still correct.

**Verified:** `npm run typecheck`, `npm test` (all suites, unchanged pass
count -- no test asserted the old literal model ID), `npm run build`, all
pass. Confirmed via grep that no reference to the retired model ID
survives anywhere in the repo. **Not verified, and cannot be from this
sandbox:** whether `claude-sonnet-5` actually works against the real
Anthropic API -- there is no `ANTHROPIC_API_KEY` configured here. The
existing fake-Anthropic-double test infrastructure (`server/test/*`,
`test-integration/fakeAnthropic.mjs`) never sends real model IDs to a
real API in the first place, so it cannot and does not exercise this
either way; that check needs a real key, which only you have.

### 2026-09-03 — Screen 7 Continue: stated reason instead of a silent dead end when a new idea demotes to artist notes

Live-test report: no candidate selected, typed a new idea, clicked "Add".
The idea was captured as an artist note (§14's iteration-bound demotion),
the screen explained *that*, but Continue stayed disabled with no
explanation of *what to do next* -- a genuine dead end.

**Investigation finding, reported before any fix:** Continue's disable
condition (`ElementsDiscovery.tsx`) only checks selected candidates,
locally-added ideas, and existing visual elements --
`selected.size === 0 && addedIdeas.length === 0 &&
state.project.visual_elements.length === 0`. A demoted idea writes only to
`state.project.artist_notes` (`demoteIdea()`), which none of those three
check, so it can never satisfy the condition. Determined this is a
**messaging oversight, not a condition-logic bug**: requiring a real
visual element before advancing to composition/placement is correct --
artist notes are deliberately not design elements, consistent with the
Blueprint's own "further ideas the client raised" separation. Fix adds
the missing visible reason; the disable condition itself is unchanged.

**Fix:** `continueDisabled` is now a named derived value, and whenever
it's true a `<p className="supporting">` under the Continue button states
what to do -- worded conditionally on whether Association candidates
exist:
- Candidates present: "Select at least one starting point above, or add
  a new idea that becomes a design element, to continue."
- No candidates offered: "Add at least one idea that becomes a design
  element to continue — notes for the artist alone aren't enough to move
  forward."

**Other screens surveyed for the same silent-dead-end pattern** (grepped
every `disabled={` in `web/src/screens`, per the request's "list, don't
fix" scope): `DesignConfirmation.tsx`, `StyleReference.tsx`,
`ImageProvenance.tsx`'s text-entry Continue buttons, `ImageDescription.tsx`,
`Placement.tsx`, `RoughScale.tsx`, `Story.tsx`, `Clarification.tsx`,
`Avoidances.tsx` are all fine -- either self-evident (disabled tied to an
empty, visibly-adjacent input) or already explained (`RoughScale.tsx`'s
`.error-banner` shows a reason + resolutions). **Two further instances of
the same gap found, not fixed here -- open decision for scope:**
- `MeaningReflection.tsx:42` -- `disabled={selected.length === 0}`, no
  visible "select at least one theme" message.
- `ImageProvenance.tsx:166` (`finalizeElaboration`, the re-entry
  theme-confirmation step) -- same shape, same gap.

**Related edge case flagged, not addressed:** `elapsedOverTargetRatio()`
is monotonic (wall-clock elapsed / target minutes), so once a journey
crosses the 1.5x threshold every subsequent "Add idea" demotes to notes
for the rest of that journey. If no Association candidates exist at that
point, a client could have no path left to add a real visual element at
all. Open decision, not fixed in this task.

**Verified:** `npm run typecheck`, `npm test` (all suites pass, +3 new
tests in `web/src/screens/ElementsDiscovery.test.tsx` covering: candidates
present + demoted idea shows the candidates-aware reason; no candidates +
demoted idea shows the no-candidates reason; a real (non-demoted) idea
enables Continue with no message shown), `npm run build`. Live browser
reproduction (real server + real Vite + fake Anthropic double, journey
state seeded via the app's own `createInitialJourneyState` with
`idea_iteration_count` pre-set to the demotion threshold) reproduced the
exact reported scenario end to end -- confirmed the bug (idea demoted,
Continue disabled) then confirmed the fix (reason visible before and after
the demoted add, and it disappears once a candidate is selected and
Continue enables). Screenshots captured before/after.

### 2026-09-03 — One shared ModelWaitIndicator applied to every model-call wait in the journey
Addresses the deferred "timer/countdown UI during model-call waits" item
and the inconsistency it named: some waits were static text, Screen 7
alone had pulsing dots (added earlier the same session), none showed
elapsed time. Built one component, `web/src/components/
ModelWaitIndicator.tsx`, and applied it everywhere -- presentation only,
no async logic, model calls, or timeout budgets touched.

**Component:** takes a `label` prop (each screen's own existing copy,
unchanged) and renders it next to an always-visible pulsing-dots
animation -- the same animation Screen 7 already had, but now built on
the app's global `--accent` token rather than `--ledger-red` (which only
exists inside Screen 7's own `.sites-tokens` scope), so it renders
correctly whether or not the screen is ledger-scoped; confirmed live on
both. `prefers-reduced-motion` respected, carried over unchanged from the
original. A count-up elapsed-seconds line ("Still working — Ns") appears
only once the wait passes 5 seconds, computed from wall-clock elapsed
time each tick (not a naive per-tick increment, so it can't drift) --
never a countdown, since no route in this app can promise how long a
call will take (`docs/timeout-matrix.md`'s budgets run up to 40s), and a
countdown reaching zero while still waiting would read as broken. The
`setInterval` is unconditionally cleared on unmount -- this codebase has
been bitten by a leftover timer before (the voice-input rebuild's own
8-second "stuck detector").

**Applied to all 9 model-call wait locations found in the journey** (in
`web/src/screens/`, one shared component instance each):
1. `Story.tsx` -- main submit ("Understanding your story...")
2. `Story.tsx` -- depth-exercise "Share it" ("Following up on your story...")
3. `Clarification.tsx` -- ("Following up on your story...")
4. `ImageProvenance.tsx` -- main submit ("Recording where this comes from...")
5. `ImageProvenance.tsx` -- elaboration submit ("Making sense of what you added...")
6. `Avoidances.tsx` -- ("Thinking about what could go wrong for this concept...")
7. `ElementsDiscovery.tsx` (Screen 7, Association) -- ("Finding personal and visual directions...") -- replaces the bespoke inline dots markup added earlier the same session with the new shared component; the old `.ledger-loading`/`.ledger-loading-dots` CSS was removed, not left as dead code
8. `StyleReference.tsx` -- ("Working out what that points toward...")
9. `DesignConfirmation.tsx` (Blueprint generation) -- ("Building your Blueprint...")

**Explicitly not touched, and why:** `ArtisticDirection.tsx` has no
model-call wait state at all -- confirmed by grep, it has zero
`useAsyncAction`/`pending`/`fetching` usage anywhere in the file, because
its dimension questions come from `evaluateArtisticDimensions()`, a
deterministic engine function, exactly the honesty distinction already
established earlier this session (its own instruction copy avoids the
word "generated" for the same reason). No fake wait state was invented
there just because it was named in the request -- the codebase's real
shape took precedence. `MeaningReflection.tsx`'s "Interpretation
generated from your story." and `Avoidances.tsx`'s "Suggestions generated
for this specific concept." are both post-completion status lines, not
wait states, and were left alone; so was `CompositionBackground.tsx`/
`ArtisticDirection.tsx`'s own "...settled. Moving on..." transitional
text (already investigated and confirmed unreachable in normal operation
earlier this session).

**Verified:** `npm run typecheck`, `npm test` (324 tests -- 7 new in a
new `ModelWaitIndicator.test.tsx` covering the counter's absence before
5s, its appearance at 5s, counting up correctly across multiple ticks,
the label staying exactly as passed in once the counter appears, and the
interval being cleared on unmount with no further state updates
afterward), and `npm run build` all pass. Live-verified against a real
(artificially delayed, via the existing `__TEST_DELAY_N__` fake-model
convention) model call crossing the 5s threshold: screenshotted Screen 7
before 5s (dots only) and after (dots + "Still working — 5s"), confirmed
the indicator disappears cleanly the moment the call resolves with no
lingering dots or counter, and screenshotted the same component on a
plain non-ledger screen (Story) to confirm the `--accent`-based color
renders identically there.

### 2026-09-03 — Rebuilt voice input on the browser-native Web Speech API, closing both long-deferred voice issues
Closes out `docs/PROJECT_STATUS.md`'s own long-standing deferred items:
recording cutting off after ~10s, transcription only appearing after
stopping, and voice input sometimes not activating at all. Rebuilt
`web/src/components/VoiceInput.tsx` to match a known-good reference
implementation's exact Web Speech API configuration
(`continuous = true`, `interimResults = true`, `lang = "en-GB"`, nothing
else set) -- explicitly not a home-grown reinterpretation.

**Root cause of the ~10s cutoff, confirmed by reading the old code before
deleting it:** the prior component ran an 8-second `setTimeout` "stuck
detector" that called `recognition.stop()` unconditionally once elapsed,
regardless of whether the person was still actively speaking -- it was
never reset on incoming results. Removed entirely, per instruction: no
app-level silence or duration timer of any kind now exists; only the
browser's own `onend` ever stops a session.

**Root cause of "only appears after stopping":** the prior component set
`continuous = false, interimResults = false` and only ever read
`event.results` filtered to `isFinal`, so nothing reached the field until
the whole session ended. Rebuilt as a controlled component (`value`/
`onChange` instead of the old one-shot `onTranscript` callback) that
recomposes the full field value on every `onresult` event from three
layers -- `startingText` (whatever was in the field, captured once at
session start), `completedText` (this session's own running final-result
text), `interimText` (rebuilt from scratch every event, never committed) --
pushed to `onChange` immediately, no debounce. All 4 existing call sites
(`Story.tsx`, `ImageDescription.tsx`, `ImageProvenance.tsx` ×2) updated
from the old append-in-the-callback pattern to passing `value`/`onChange`
straight through.

**The reference implementation's own bug was identified and deliberately
NOT ported, per instruction:** it only flips its "isListening" flag
true inside the asynchronous `onstart` callback, so a rapid second tap
before `onstart` fires reads the still-false flag and can start a second
concurrent recognition instance -- the likely cause of the reported
"sometimes doesn't activate at all" failure (two instances fighting each
other, or the button reading a stale state). Fixed with a synchronous
`idle|starting|listening|stopping` guard (a ref, checked and updated
*before* any async callback can run) that a rapid second tap cannot get
past.

**Other behavior matched exactly, not approximated:** tap-to-toggle (not
press-and-hold), `aria-pressed` on the button; `stop()` for a normal
user-initiated stop (lets any in-flight final result finish returning)
versus `abort()` reserved for component unmount only; a brand new
`SpeechRecognition` instance created every session, never reused; on
browser auto-stop (`onend`) the existing text is preserved, no
auto-restart, and a `"Dictation stopped. You can edit the transcript
before continuing."` message shown -- the person taps again to resume,
and `startingText`'s own capture-at-session-start already carries
whatever was there forward. A new `VoiceInputHandle` (`useImperativeHandle`
+ `forwardRef`) exposes an imperative `stop()` so the four screens can
call it right before their own submit -- flushing any in-flight final
result before the story/description text is read for the model call.

**Feature detection and error messages, exactly as specified:** runtime
`window.SpeechRecognition ?? window.webkitSpeechRecognition`, never a
browser allowlist; when absent, the button still renders (disabled) with
`"Live dictation is not supported by this browser. You can still type
your story below."` rather than rendering nothing, which read identically
to "the button did nothing" -- indistinguishable from the very bug this
rebuild fixes. Errors mapped: `not-allowed`/`service-not-allowed` (mic
permission denied), `no-speech` (tap to try again), `aborted`
("Dictation stopped."), anything else ("Dictation paused unexpectedly.
Your existing transcript has been preserved."), and a synchronous throw
from `start()` itself (the exact Safari failure mode the prior version
was written to catch) mapped to "Microphone could not start." The
editable textarea remains the fallback in every one of these cases --
nothing about voice input ever blocks typing.

**Verified:** `npm run typecheck`, `npm test` (317 tests -- 23 new in a
new `VoiceInput.test.tsx`, covering the exact three reported failure
modes as named regression tests: the live-interim-text algorithm
including a case proving `startingText` is captured once and not
re-captured mid-session, the absence of any app-level timer across a
simulated 30-second wait, the synchronous re-entrancy guard against a
rapid double-tap, `onend`'s no-auto-restart behavior, every mapped error
code, the unsupported-browser render, and the imperative `stop()` handle
both while listening and as a safe no-op while idle), and `npm run build`
all pass. Live-verified in a real headless Chromium (not just mocked):
confirmed `SpeechRecognition` is genuinely exposed by the browser itself,
the button renders correctly idle, and -- since this sandbox has no
network path to the real speech-recognition backend -- exercised the
real error-resilience path end to end: a rapid double-tap smoke test
produced no crash and no stuck state, and after the real (network-less)
session failed, the button cleanly resolved to "Talk about it" with the
expected fallback message rather than hanging on "Starting…" indefinitely.
Screenshots reviewed directly. Full audio-transcription-accuracy testing
was not possible in this sandbox (no real microphone/network path to a
speech backend) -- the algorithm itself is the part under this rebuild's
control and is what the 23 new tests lock in.

### 2026-09-03 — Three live-test findings from the same night: a real raw-text leak fixed, Screen 7's wait made visible, one false-alarm investigated and cleared
Follow-up to the meaning-depth gate work earlier the same session. Three
items reported from live testing: two real, fixed; one investigated and
confirmed not to be a bug.

**1. Fixed — raw internal re-prompt text leaking into the "What we've
understood" panel's Story field.** After a depth-exercise "Share it"
round, the panel showed `I want a rose, roses are pretty What it's really
about (in response to: "Is there one moment this is rea...` -- the exact
internal scaffold text `Story.tsx`'s `answerDepthExercise` sends to
Discovery to give it question context, which was also being written
straight into `raw_story` itself. `raw_story`/`story_transcript` are read
directly by the understood panel, Working Notes, and the Association
Engine's own summary input -- none of them want the scaffold, all of them
got it. Root cause and fix: `raw_story` and the text sent to
`requestDiscovery()` were the same string; now built as two deliberately
separate strings -- `cleanCombined` (natural language: the original story
plus the reply, nothing else) stored in `raw_story`, and `modelInput`
(with the "in response to" scaffold) passed only to the model call. Same
fix applied to the identical pre-existing pattern in `Clarification.tsx`
(`submit()`), found while fixing this one -- it had the same two-purposed
string, just never reported because that path is used less. Same category
of bug as the raw-enum leaks fixed earlier this session: internal
composition/plumbing text must never double as client-facing display
text.

**2. Fixed — Screen 7's loading state had no visible activity.** Real
Association latency is 20-40s+ (`docs/timeout-matrix.md`); the existing
"Finding personal and visual directions..." text alone gave no sign
anything was happening, reading as stalled. Added three small pulsing
dots (`.ledger-loading-dots`, new CSS in `styles.css`) next to the
existing text, using the "studio ledger" token colors (`--ledger-red`),
with a `prefers-reduced-motion` fallback. This is the small, immediate
fix explicitly scoped separately from the larger, still-queued
placement-preference "productive waiting" MVP -- not a replacement for
it.

**3. Investigated, not fixed — "Composition settled" reported as a
possible hang.** Traced to `CompositionBackground.tsx`'s
`!flow.nextToAsk` fallback branch (`<p>Composition settled. Moving
on...</p>`) -- structurally identical to `ArtisticDirection.tsx`'s own
`!result.nextToAsk` branch (`Artistic direction settled. Moving on...`),
which an earlier investigation the same night already found to be a
discoverability false alarm, not a hang. Reasoned through the mechanism
before reproducing: `answer()` dispatches `patchProject` and `patchUI`
(the latter setting `compositionFlowDone: true`) synchronously in the same
handler; React 18's `createRoot` (confirmed in `main.tsx`) batches both
into one render, so by the time `flow.nextToAsk` is null,
`compositionFlowDone` is already true in that same render -- `Journey.tsx`
picks the next screen before this fallback JSX is ever painted. **Live-
reproduced to confirm, not just reasoned about**: a full journey
walkthrough through the composition flow, polling the rendered heading
every 80ms and logging every transition plus how long each screen was
visible. "Composition settled" was never observed on screen across the
full walkthrough (headings seen: "How should this come together?" for
111ms, "Should the tattoo itself include a background?" for 137ms,
straight through to Style reference). **Conclusion: not a genuine hang --
the same category of false alarm as the artistic-direction case, and
structurally can't be one, given React 18's automatic batching.** No code
changed for this item. If a real stall is ever caught with a screenshot at
the actual moment it happens, that would be a genuine new finding worth
reopening -- this investigation only rules out the code path named
"Composition settled" itself.

**Verified:** `npm run typecheck`, `npm test` (294 tests -- 1 new
regression test in `Story.test.tsx` rendering `Story` and
`UnderstandingPanel` together exactly as `Journey.tsx` composes them,
asserting the panel's Story field contains the natural combined text and
never the internal scaffold), and `npm run build` all pass. Live-verified
all three: the exact "rose" + depth-exercise scenario from the report,
confirming the panel's Story field is now clean; Screen 7's loading state
with the Association call artificially delayed, confirming the pulsing
dots render and are visible; and the composition-flow poll for item 3.
Screenshots reviewed directly.

### 2026-09-03 — Added a meaning-depth gate to Screen 3 (Story), after a proposal-first investigation
New feature, not part of the Sites migration. Investigated and proposed
before building, per instruction: where the gate could sit without
disrupting the existing async/staleness invariants, whether "substantively
thin" could be judged as part of the existing Discovery call rather than a
second one, and which of several candidate exercises (5 Whys, word
association, memory anchor, contrast prompt) fit this product. Proposal
was reviewed and approved with specific choices before any code was
written: schema extension on the existing Discovery call, a single
memory-anchor-style question with tappable chips, an interstitial on
Story.tsx (not a new screen), single round only, register calibrated to
plain, direct language that still provokes real thought.

**Key finding from the investigation:** a near-identical mechanism already
exists for a different purpose. The existing Clarification screen only
fires when visual confidence is *also* low, and Discovery's own prompt
already states "high visual confidence with low meaning confidence is a
complete state, not a deficiency, and must not trigger clarification." A
story like "I want a rose, roses are pretty" is exactly this case --
visually actionable, meaning-thin -- and the existing system deliberately
lets it through untouched. The new gate fills that specific, previously
open gap; it doesn't duplicate Clarification, and the two are mutually
exclusive by construction of the model's own rules (confirmed by a new
schema test).

**Detection — one call, not two, as preferred:** `discoveryResultSchema`/
`discoveryToolInputSchema` (`server/src/schemas/discovery.ts`) gained
`meaning_is_thin: boolean`, `depth_prompt: string | null`,
`depth_prompt_suggestions: string[]`. A new prompt item (MEANING DEPTH)
draws the true/false line explicitly: thin only when the stated reason is
generic enough to swap into any other story unchanged ("something
meaningful to me"), never when it's abstract but specific to this person
("marking the point I stopped drinking" -- no named person or object, but
concrete and specific, must classify false). The register instruction is
written as a standing rule, not a one-off example: short, common words,
never literary or clinical, never a "please elaborate" restatement, aimed
at making the reader actually search a memory -- with "Is there one moment
this is really about?" given as the target register for every story, not
only the example case.

**Placement — Story.tsx, not a new screen:** implemented entirely as local
component state (`pendingResult`/`depthAnswer`). A thin result isn't
applied to project/ui state immediately; the depth prompt renders inline
in its place, with "Share it" (folds the reply into raw_story, re-runs
Discovery once -- the same append-and-rerun pattern Clarification.tsx
already uses) and "Continue" (applies the already-fetched result exactly
as-is, at zero extra network cost, never disabled). Deliberately not built
into MeaningReflection.tsx, even though its existing `isLowConfidence`
framing looked like a natural fit: a Discovery re-run there could change
`discoveryThemeOptions` under a user already mid-selecting themes. Keeping
it on Story means MeaningReflection only ever renders one final, settled
result -- it required zero changes. This placement also meant **zero
changes to `engine/screenFlow.ts` or `deriveProgress.ts`** -- the screen ID
never changes, so the existing `clarificationRequired` state machine can't
interact with it.

**A real bug caught while writing the component test, not assumed
correct:** `pendingResult` was never cleared after applying the result via
either skip or the answered path, which would have left the inline prompt
rendered indefinitely instead of reflecting the settled state. Fixed
(`setPendingResult(null)` in both `skipDepthExercise` and
`answerDepthExercise`); the test that caught it
(`web/src/screens/Story.test.tsx`) is now a permanent regression guard.

**Verified:** `npm run typecheck`, `npm test` (293 tests -- 9 new in
`server/test/discoveryRoute.test.ts` covering schema pass-through, a
missing-field rejection, and the independence-from-clarification_required
case; 5 new in `web/src/screens/Story.test.tsx` covering both branches,
the never-disabled skip button, the max-one-round guarantee, and chip-tap
behavior), and `npm run build` all pass. Live-rendered both of the
example stories through a real server/Vite/fake-Anthropic stack: "I want a
rose, roses are pretty" showed the register-matched interstitial with
tappable chips and reached MeaningReflection normally after skip; "marking
the point I stopped drinking" skipped the prompt entirely; the answered
path was also verified (chip tap → editable → "Share it" → exactly two
Discovery calls confirmed via server logs → advanced normally).
Screenshots reviewed directly.

**Real-model verification still needed from you — see "Open decisions"
above.** This sandbox has no `ANTHROPIC_API_KEY`, so the two example
stories were driven through the fake model double via an explicit
`__TEST_THIN__` marker (mirroring the existing `__TEST_DELAY_N__`/
`__TEST_FAIL__` convention) to force each branch deterministically. This
proves the app's plumbing -- detection wiring, single-call cost, the
skip-never-blocks guarantee, the single-round limit -- is correct. It does
not and cannot prove the real model draws the true/false line where the
new prompt item asks it to for either story.

### 2026-09-03 — Restructured the Blueprint to the Sites migration spec's twelve-section architecture — migration COMPLETE
Fifth and final piece of the Sites migration (after tokens, Readiness, the
"What we've understood" panel, and question-flow copy). Read spec §7
("Blueprint output structure") in full first. Section 12 (Readiness) was
already done (a prior session's componentized-readiness work) and was left
untouched except for its position (confirmed last) and heading style.

**Section structure reconciled to spec's 12-section IA**, using only this
app's own already-collected fields — never inventing data Sites has but
this app doesn't:
- `01 — Your story` / `02 — Your intention` (now combines the previously
  separate "Your Why"/"What matters most" under one heading, with
  confirmed_themes as uppercase bordered chips per spec §7's own
  description) / `03 — The design you're imagining` (the model's
  visual_direction paragraph, pulled out of the old combined "Visual
  hierarchy" section into its own) / `04 — Confirmed visual subjects`
  (the existing personal/other/still-undecided decision map, unchanged
  content) / `07 — Artistic treatment` (the model's own combined
  composition+treatment paragraph) / `08 — Placement and body flow`
  (unchanged) / `11 — Artist Brief` (unchanged) / `12 — Readiness`
  (unchanged, repositioned last).
- `09 — Essential safeguards` (the "Avoid" section) moved from after the
  Artist Brief to before References, matching spec's own ordering — a real
  repositioning, not just a renumbering.
- `10 — References and open decisions` folds the existing reference
  checklist and the model's design_considerations (open decisions) under
  one heading, matching spec's own two-part structure for this section.
- `05 — Composition and arrangement` and `06 — Concept-specific
  decisions` are genuinely new: this app's Blueprint Writer schema has one
  combined free-text field for composition+treatment, not Sites' three
  separate deterministic templates, so there was nothing to port verbatim
  for these two. What ported instead is the DISCIPLINE — two new pure
  functions (`describeComposition`/`conceptSpecificDecisions`,
  `web/src/journey/blueprintSummary.ts`) build small deterministic fact
  sections from data this app already collects (composition_type/
  composition_background/design_density; the eight confirmed artistic-
  dimension answers), reusing the exact same label-function pattern as
  `visualElementSentence` — never raw-concatenating a stored token.
  `DIMENSION_QUESTIONS` moved from being ArtisticDirection.tsx-local to
  exported from `artisticDimensionLabels.ts` so Section 06 asks the exact
  same question text Screen 11 itself used.
- "Further ideas the client raised" (artist_notes, §14's new-idea loop)
  has no spec §7 slot at all — kept as its own unnumbered section rather
  than force-fit into References, which stays about referenced material
  and confirmed open decisions.

**Two real bugs found and fixed during live verification** (not assumed —
caught on an actual rendered Blueprint):
1. **Raw enum leak in the new Section 06.** `evaluateArtisticDimensions()`
   can resolve `edge_treatment` to its own engine-level default, the
   literal string `"not_specified_left_to_artist"`
   (`ARTISTIC_DIMENSION_DEFAULTS`, `engine/src/artisticDimensions.ts`) —
   which matches none of `DIMENSION_OPTIONS.edge_treatment`'s three
   selectable values, so `labelForDimensionValue` fell through to the raw
   string. Nothing had ever rendered `edge_treatment` to a user before
   Section 06 existed, so this was a real, previously-invisible leak of
   exactly the class this codebase has fixed before — live-rendered as
   "How should edges feel? not_specified_left_to_artist". Fixed with a
   small `DEFAULT_VALUE_LABEL` map in `artisticDimensionLabels.ts` for
   values that only ever arrive as an engine default, never a click (kept
   separate from `DIMENSION_OPTIONS` itself, which renders directly as
   Screen 11's own buttons — adding a default there would make it look
   like a fourth, user-selectable choice).
2. **Duplicated "no background" phrasing in the new Section 05.** Every
   `COMPOSITION_POOLS` option flagged `noBackground: true`
   (`engine/src/composition.ts`) already states "no background" in its own
   label ("Isolated, no background", ...) — `describeComposition`
   additionally appending the separate `composition_background` label
   produced the redundant, oddly comma-spliced "Isolated, no background,
   No background." live-rendered on the real Blueprint. Fixed by skipping
   the background label whenever composition_type's own text already
   contains the phrase "no background" (matched narrowly on that exact
   phrase, not just the word "background", so a genuinely different
   subtle/immersive answer — the two fields are asked separately, so they
   could in principle disagree — is never silently swallowed).

**Both Sites-build "current quirks" spec §7 names were investigated, not
assumed present, and neither reproduces in this app's real architecture** —
verified, not just asserted, and locked in as regression tests:
1. The verbatim-design-vision-duplicated-on-fallback quirk depends on a
   "design vision" field Sites has and this app does not (confirmed absent
   during the earlier "What we've understood" panel task) — there is no
   blockquote+fallback-interpretation pairing here that could ever
   duplicate.
2. The "Develop a {scale} tattoo..." → "a expandable" grammar quirk
   depends on an app-side template that prefixes a stored value with the
   article "a"/"an" — confirmed by grep across the whole codebase that no
   such `` `a ${...}` ``/`` `an ${...}` `` pattern exists anywhere. This
   app's Artist Brief is entirely model-written free prose
   (`blueprint.artist_brief`), rendered verbatim, never assembled from a
   template.

**Visual consistency:** the Blueprint is wrapped in `.sites-tokens`
(task 1's shared token scope) alongside `.screen`, reusing the same H2/
label typography scale the rest of the migrated journey uses rather than
one-off sizes — the exact "unconsumed foundation" the token system's own
session log flagged when it first shipped. The document header uses the
same `.screen-eyebrow`/`.screen-heading` pattern (task 4) as every other
screen, dark-mode-safe, no `--ledger-*` warm-palette color anywhere — the
"studio ledger" direction stays Screen-7-only, exactly as before. New
`.blueprint-section`/`.blueprint-section-number`/`.blueprint-section-
heading`/`.theme-chip` classes in `styles.css`.

**Print/PDF export — this app had none before this task**, only the
existing plain-text Copy/Save. Spec §7's own "Blueprint and print
presentation" subsection was read and applied as a genuinely new, additive
capability (not a change to an existing mechanism's "core logic", since
none existed): a "Print or save Blueprint" button calling the browser's
native `window.print()` (whose dialog offers Save as PDF, so no PDF
library dependency was added), plus `@media print` rules hiding app
chrome/action buttons and applying A4 margins with per-section
`break-inside: avoid`.

**Verified:** `npm run typecheck`, `npm test` (284 tests — 18 new: 12 in
`blueprintSummary.test.ts` for `describeComposition`/
`conceptSpecificDecisions` including both bug-regression cases above, plus
10 new component tests in `BlueprintView.test.tsx` covering section order,
the two new deterministic sections, the Section 9 repositioning, the
folded References section, the print button's existence, and both quirk
non-reproductions as standing regression guards), and `npm run build` all
pass. Live-rendered a full "Athena wire"-style journey (real server, real
Vite, fake Anthropic double) through to a built Blueprint: screenshotted
the full document (all 12 sections in correct order, no raw-value leaks
after the two fixes above), print-media emulation (chrome/actions
correctly hidden, A4 layout), and a 390px mobile viewport — all reviewed
directly. Also verified the plain-text Copy export
(`formatBlueprintAsText`) via a real clipboard read in the browser: every
new section marker (`05 — Composition and arrangement` through
`12 — Readiness`) present and correctly formatted, confirming the on-screen
and Copy/Save paths never drifted apart during the restructure.

**This closes the Sites UX migration chapter** that began with the Sites
cross-examination — tokens, Readiness, the understood panel, question-flow
copy, and now the Blueprint restructure are all live together, and the
"studio ledger" direction from earlier in the same broader arc remains a
deliberate, separate, not-yet-made decision to extend beyond Screen 7.

### 2026-09-03 — Migrated the Sites question-flow copy/structure pattern (spec §3) into 12 existing screens
Fourth piece of the Sites migration (after tokens, Readiness, and the
"What we've understood" panel). Scope was explicitly copy/structure only —
"HOW questions are framed and structured, not building new questions or
changing what data is collected" — no screen's data collection,
validation, storage, async logic, state management, or navigation was
touched.

**Read spec §3 in full first** (lines 243-668, "Full question flow, step
by step"): the unnumbered welcome screen plus Steps 1-10, each with its
own Eyebrow/Heading/Instruction/Type (FIXED|GENERATED|mixed) fields.

**Shared structural pattern, new CSS:** `.screen-eyebrow` (small caps
label) + `.screen-heading` (serif question, `clamp(26px, 3.6vw, 38px)`) +
existing `.supporting` instruction text — reusing the same eyebrow +
large-serif-question + instructional-subtext STRUCTURE already live on
Screen 7's "studio ledger" work, but deliberately smaller than Screen 7's
own dramatic H1 (`clamp(40px, 5.2vw, 68px)`) and without Screen 7's
background/palette/card-chrome — this is a shared structural pattern
applied app-wide, not an extension of Screen 7's own specific visual
direction, which stays Screen-7-only per its established scope. Also new:
`.option-chip.option-chip-card` / `.option-chip-title` /
`.option-chip-description` for the spec's choice-card pattern (bold title
+ lighter one-line description), reusing `.option-chip`'s existing
box/hover/click behavior.

**Applied to 12 screens** covered by spec §3 (mapped each of this app's 20
screen components against the spec's 10 numbered steps + welcome,
excluding Screen 7 and Blueprint per explicit instruction, and screens
with no Sites §3 equivalent — Clarification/Correction, ImageDescription/
ImageProvenance, StyleReference, WorkingNotesView): Welcome, Viewpoint,
Story, MeaningReflection, IntentionConfirmation, CreativeControl,
RoughScale, CompositionBackground, Placement, ArtisticDirection,
Avoidances, DesignConfirmation. Choice-card restructuring (title +
description) applied where this app's option data is static and Sites'
descriptions map directly — Viewpoint's four core viewpoints, all four
CreativeControl options. Explicitly **not** restructured:
CompositionBackground's `composition_type` options, since the engine's
`getCompositionOptionPool` has no description field and Sites' own
descriptions don't match this app's richer, concept-shape-specific option
pools — adding one would be an engine change, out of scope here.

**FIXED vs. GENERATED honesty — the one case that mattered:**
`ArtisticDirection.tsx`'s dimension questions (colour, realism, etc.) come
from `evaluateArtisticDimensions()`, a deterministic ENGINE function with
no model call — but Sites' equivalent Step 9 is genuinely a live LLM call.
Borrowed instruction wording was reworded from Sites' own "generated from
your subjects..." framing to "adapt to your subjects... not a fixed
tattoo-style questionnaire" specifically to avoid implying a model
generated these, with a code comment recording why. Avoidances' new status
line ("Suggestions generated for this specific concept") is the opposite
case and correctly says "generated," since `requestAvoidanceSuggestions`
is a genuine model call.

**Deliberately left untouched:** `VoiceInputButton`/`VoiceInput.tsx` (its
own copy already conveys the same idea; it carries substantial
cross-browser async error-handling logic explicitly protected by the "do
not touch async logic" constraint); IntentionConfirmation's hint text
(Sites describes an inline Save/Cancel edit, this app's "Edit this"
navigates back to theme selection — copying the hint verbatim would
misdescribe actual behavior).

**Verified:** `npm run typecheck`, `npm test` (266 tests — unchanged count;
confirmed via targeted grep that no test asserted on any of the old copy
strings that changed, so nothing needed updating), and `npm run build` all
pass. Live-rendered a full real journey (Welcome through Screen 13, real
server, real Vite, fake Anthropic double) and screenshotted 10 points
spanning early (Welcome, Viewpoint), middle (Story, MeaningReflection,
CreativeControl, CompositionBackground), and late (ArtisticDirection,
Avoidances, Placement, DesignConfirmation) journey — eyebrow/heading/
choice-card pattern renders correctly at every point, no console or page
errors. Confirmed the "What we've understood" panel (task 3) still
populates correctly alongside these copy changes: 14 rows present at
Screen 13, growing field-by-field at the same real state-driven timing as
before (Viewpoint/Story/Meaning present by CreativeControl; Composition/
Treatment/Placement added by DesignConfirmation) — the regression check
this task asked for, not a full re-verification.

**Blueprint restructure (spec's Blueprint-facing sections) is the final
piece, task 5 — still queued, not started.**

### 2026-09-03 — Built the "What we've understood" side panel (Sites migration spec §2), persistent across Screens 1-13
Third piece of the Sites migration (after tokens and Readiness). `docs/
sites-ux-migration-spec.md` now actually exists in the repo -- copied in
during this task from the uploaded copy read for the previous two, since
it had been referenced by that path twice without ever being committed.

**Field mapping (spec §2.2's 8-field table, this app's real state):**
Viewpoint (`project.user_viewpoint`), Story (`raw_story`, 105-char
truncation), Meaning (`confirmed_themes`), Visual material
(`visual_elements` descriptions), Composition (`composition_type` +
"(no background)" when applicable, matching Screen 13's own existing
convention), Treatment (`realism_level`/`linework_weight`/
`shading_method`/`colour_strategy` via the existing `labelForDimensionValue`
helper -- contrast omitted, exactly per spec), Placement (`side`/
`body_area`/`size_class`). "Emerging vision" (Sites' free-text "design
taking shape in your mind" field) has no equivalent anywhere in this
app's real data model -- no screen asks that question or stores that
text -- so per spec §2.3's own instruction ("add fields only as an
explicit product change; do not describe those additions as behavior
inherited from Sites"), that row is omitted rather than invented.

**Timing is real, not simulated, but not always literally "live":**
Viewpoint, Composition, and Treatment update the instant their source
screen's own existing `patchProject` call fires, because those screens
already patch global state on every individual click. Story, Meaning,
and Visual material only become visible at their source screen's
Continue, because *those* screens already buffer the answer in local
component state until then (Story's textarea, MeaningReflection's theme
chips, Screen 7's candidate checkboxes) -- changing that buffering to
make the panel more "live" would mean editing those screens' own state
management, which the task explicitly ruled out ("Do NOT modify the core
logic of any screen... this only reads existing state, it doesn't change
how that state is produced"). Every row is still driven entirely by real,
already-existing `patchProject`/`patchUI` calls -- nothing new was added
to any screen to produce this data, only new code that reads it.

**Layout:** a persistent 330px right rail on desktop (spec §1.3's
two-column workspace), collapsing to a `<details>` titled "What we've
understood" above the screen content below 900px (spec's own
breakpoint), reusing the exact token values from the design-token
migration via a new shared `.sites-tokens` CSS class -- split out of
`.ledger-screen`, which still carries it (alongside the panel's own
`.understood-rail`/`.understood-mobile`), so neither redefines the
values nor inherits from the other. Applied via a `.journey-with-panel`
modifier class on `.app-shell`, only for Screens 1-13 (Welcome, the
Blueprint, and Working Notes each have their own distinct layout in the
spec too, or aren't part of the ten numbered intake steps) -- every
other screen's existing single-column layout is untouched.

**Verified:** `npm run typecheck`, `npm test` (266 tests -- 22 new for
the row-derivation logic covering empty/mid/full states and every
field's exact timing and truncation rule, 6 new component-render tests),
and `npm run build` all pass, with zero changes to any existing test.
Live-rendered a full real journey start to finish (Welcome through
Screen 13, every screen's real buttons/inputs, real server, real Vite,
fake Anthropic double) and screenshotted the panel at four points
proving it accumulates real state correctly -- including the specific
"don't show a field before its source data exists" case (Visual material
absent while still on Screen 7, present the instant its own Continue
fires) -- plus mobile collapsed and expanded, confirming the footer
reassurance note is correctly absent from the mobile `<details>` (spec
§2.1). The full click-through of every screen in the journey completing
without error is itself the regression check this task asked for.

### 2026-09-03 — Replaced the single-sentence Readiness reason with the Sites migration spec's five-component model
Trigger: `docs/sites-ux-migration-spec.md` doesn't actually exist in this
repo — it was never committed, only uploaded to the assistant in an
earlier session and read from that path. Used that uploaded copy directly
(same document as the design-token migration); its §12 is the Blueprint's
own "12 — Readiness" subsection (not a top-level section 12 — the doc has
no top-level section 12 at all), which explicitly says to preserve the
five-row structure while sourcing statuses from this app's deterministic
engine and correcting the semantic defects §4.3 lists. Worth getting a
real copy into this repo before the next task references it by path.

**Replaced:** `engine/src/readiness.ts`'s `describeReadinessReason()`
(one sentence per readiness state) with `describeReadinessComponents()` --
five named, independently-statused components (Meaning, Visual direction,
References, Artist discussion, Final artwork), each a typed status enum
plus factual detail lines, never invented copy. Real signal per component,
all pre-existing:
- **Meaning** — non-empty `statement_of_intention` (full mode) or
  `attraction_origin` (other modes).
- **Visual direction** — `hasUnresolvedPrimaryImagery()` and the
  Association Engine's own `contradictions_noticed`, exactly as
  `computeReadiness`'s `hasUnresolvedContradiction` already used.
- **References** — the existing reference checklist
  (`buildReferenceChecklist`/`isReferenceEntrySatisfied`), now
  distinguishing three states instead of a binary: nothing in the concept
  requires one, everything required has been provided, or something
  required is still missing.
- **Artist discussion** — `creative_control` being set (Screen 9,
  mandatory in every journey mode from Screen 7 onward per §7's
  convergence rule).
- **Final artwork** — the already-computed overall `ReadinessState`;
  omitted entirely pre-Blueprint (Screen 13), since it only makes sense
  once a Blueprint exists to describe.

**Three of the Sites spec's six §4.3 semantic defects genuinely applied
here and are fixed, not ported:**
1. *"Intentional absence of exact references is mislabeled... displays
   'Available to provide' rather than 'Not required.'"* Fixed: References
   now has a real `not_required` status ("None required for this
   concept"), distinct from `available`.
2. *"Meaning and artist discussion are always declared complete/ready...
   presentation labels, not validated gates."* Fixed: both are now
   evidence-backed booleans (non-empty meaning text; `creative_control`
   actually set), not unconditional strings -- even though both are, by
   this app's own screen-flow rules, always true by the time Screen 13 or
   the Blueprint is reachable, so the fix's real value is architectural
   (a genuine gate instead of a string), not a currently-visible behavior
   change.
3. *"Final artwork readiness means 'ready to begin artwork.' No artwork
   is produced or verified."* Fixed: the copy never says artwork is ready
   to begin -- both of its states say "Not yet begun," differing only in
   whether the Blueprint itself is ready to hand to an artist.

The other three defects (model-returned open decisions not
auto-resolving; the recommendation path never reaching design-ready; no
reference files actually inspected) are specific to mechanisms this app
doesn't have in the same shape -- `hasUnresolvedPrimaryImagery`/
`contradictions` are genuinely recomputed here via §14.1's own
invalidation logic, and reference availability already only reads a real
uploaded-or-not signal -- so there was nothing to port or fix for those.

**Kept in sync deliberately:** Screen 13's "Open decisions" row now
renders the same Visual direction component (`readiness: null`, which is
what limits it to four of the five components pre-Blueprint) instead of
its own call into the old sentence function -- confirmed live that the
exact same contradiction wording appears on both screens. Its "Still
needed" row is unrelated (a pre-existing §8 bullet, never routed through
the old sentence function) and was left untouched.

**Verified:** `npm run typecheck`, `npm test` (238 tests -- 23 in
`engine/test/readiness.test.ts` covering every component reaching every
status, 5 new component-rendering tests in `BlueprintView.test.tsx`,
plus the existing "bare label with nothing else" regression test updated
for the new `<dl>` markup rather than the old `p.supporting` structure),
and `npm run build` all pass. Live-rendered both Screen 13 and the
Blueprint (real server, real Vite, fake Anthropic double) for an
"Athena wire" scenario -- a candidate with `fidelity: "exact"` and no
uploaded reference, plus a real contradiction record -- and confirmed
programmatically that the exact same contradiction text, missing-
reference description, and creative-control choice appear on both
screens. Screenshots sent for review.

### 2026-09-02 — Migrated the Sites design-token system into Screen 7's CSS (exact values, foundational)
Foundational visual work, not a full screen redesign — no component logic
touched, only `web/src/styles.css`. Trigger: the "studio ledger" direction
applied to Screen 7 earlier today used an *approximated* palette/sizing,
judged by eye against a preview; this migrates the Positive Inking Sites
UX migration spec's literal, audited values (typography scale, 8-color
palette, spacing rhythm) in their place.

**Built:** a full token system in `.ledger-screen` (Screen 7's scope):
- Typography scale as CSS custom properties (`--text-h1-*`, `--text-intro-*`,
  `--text-h2-*`, `--text-label-*`, `--text-choice-title-*`,
  `--text-choice-desc-*`, `--text-side-label-*`, `--text-side-value-*`,
  `--text-button-*`) — family/weight/size/line-height/tracking per the
  spec, system fonts only (`Georgia, "Times New Roman", serif` /
  `Arial, Helvetica, sans-serif`, no webfont load).
- The 8-token color palette (`--ledger-paper`, `--ledger-paper-deep`,
  `--ledger-ink`, `--ledger-muted`, `--ledger-line`, `--ledger-red`,
  `--ledger-white`, `--ledger-accent`) at the spec's exact hex values,
  replacing the earlier approximated `--ledger-ember`/`--ledger-paper`/etc.
- Spacing-rhythm tokens (`--space-intro-*`, `--space-question-block-top`,
  `--space-question-group-gap`, `--space-choice-grid-gap`,
  `--space-nav-*`) at the spec's exact values.

**Reconciliation, not duplication:** every rule in `.ledger-screen` that
previously referenced the old approximated `--ledger-*` set (colors) or a
hardcoded literal (typography/spacing) now consumes the new tokens instead
— confirmed by grep that no old approximated color variable remains
defined anywhere. Applied where an existing Screen 7 element's role
genuinely matches a given scale entry (the headline → Screen title/H1
scale including its literal `clamp(40px, 5.2vw, 68px)` — visibly larger
than before, by design, per the exact spec number, not preserved at the
old approximated size; the marginalia follow-up label → Question label/H3
scale; the fidelity pills → Choice-title scale; the CTA → Standard-button
scale; the footer nav → the spacing spec's bottom-navigation rhythm).
Scale entries with no current Screen 7 counterpart (Screen intro copy,
Screen H2, choice description, side-panel label/value) are defined but
unconsumed — foundation for when a matching element exists here or on
another screen, not applied speculatively.

**A real collision caught and avoided, not just checked for:** the spec's
own token names are bare (`--paper`, `--muted`, `--accent`, ...), but this
app's global `:root` already defines `--muted` and `--accent` for a
*different* concept at a *different* value — and, critically, the base
`button` rule and `.option-chip.selected` set `background`/`border` from
`var(--accent)`. Screen 7 wraps components deliberately left on that
ordinary app-wide styling (the "add your own idea" input/button,
`ReferenceAttachment`) per the earlier ledger work's own scope. CSS custom
properties cascade to every descendant regardless of class, so a
Screen-7-scoped bare `--accent` would have silently repainted those
buttons with the spec's pale ghost-hover color (`#DED6CA`) instead of the
app's real accent, making "Add"/"Add it anyway" nearly illegible —
reproduced this directly before catching it, not just reasoned about it
abstractly. Fix: the 8 color tokens keep a `--ledger-` prefix (exact spec
*values*, namespaced *names*); typography-scale and spacing-rhythm tokens
have no such collision (nothing else in the app uses `--text-h1-size`
etc.) and keep the spec's own naming. Full reasoning is in a CSS comment
directly above the token block.

**Verified:** `npm run typecheck`, `npm test` (226 tests), and
`npm run build` (including the production Vite build) all pass unchanged.
`grep` across `web/src/styles.css` confirms every `--ledger-*` token is
defined exactly once (no two competing reds/inks/etc.) — the only names
with two definitions anywhere in the file are the pre-existing, intentional
light/dark `prefers-color-scheme` pairs, not a duplicate/conflicting
definition of the same concept. Live-rendered Screen 7 (real server, real
Vite, fake Anthropic double, a real browser journey through Welcome →
Viewpoint → Story → Screen 7, one candidate selected to show the
marginalia/fidelity-pill state) at both desktop and 375px-mobile
viewports — screenshots sent for review. No structural regression: still
the same flowing hairline-separated list with no card chrome, hollow-ring
selection, and marginalia-style follow-ups; the exact-token pass reads as
a precision correction (crisper contrast, correct hex values) plus one
deliberate, spec-driven size change (the headline), not a redesign.

### 2026-09-02 — Local dev workflow/tooling chapter: start/stop/doctor, auto port-conflict recovery, always-visible build identifier
This is a workflow/tooling chapter, not a feature chapter — no
application logic, UI, or product behaviour changed. Trigger: a session
that repeatedly lost time to port conflicts, stale git pulls, and not
knowing whether the running app matched what was pushed — most costly of
all, four separate instances of debugging against stale code without
realizing it, because checking required leaving the browser and comparing
terminal output by hand.

**Built:**
1. **`npm run start`** — wraps the existing `startStack()` (unchanged;
   `npm run dev` is untouched and still works exactly as before) with:
   fail-fast `server/.env` / `ANTHROPIC_API_KEY` validation before
   spawning anything (value never printed); automatic reclaim of a stale
   copy of *this project's own* processes (from a previous `npm run
   start` that didn't shut down cleanly), with a printed explanation of
   what was killed and why; the existing named-PID `PortConflictError`
   behaviour preserved unchanged for anything that isn't provably this
   repo's own process; post-boot health checks (engine/server/web all
   actually responding, not just spawned); and a success banner that
   names the URL, the running commit, and the branch.
2. **`npm run stop`** — stops only this project's own processes, no
   manual PID-hunting. Two sources, both used: the PID marker
   `npm run start` writes (`.dev-stack.json`, git-ignored — this is what
   catches the engine watcher, which holds no port), and a live check of
   ports 8787/5173 as a fallback for a missing/stale marker. Anything not
   provably this repo's own process (working directory doesn't match) is
   reported and left alone, never killed.
3. **`npm run doctor`** — read-only diagnostic: git branch and whether
   it's behind origin (best-effort `git fetch`, degrades gracefully
   offline), port occupancy (and whether the occupant is this repo's own
   process), whether `server/.env`/`ANTHROPIC_API_KEY` are present
   (value never printed), and — new — a last-known-good-commit
   comparison: `npm run validate:local` now records the commit it last
   fully validated (`.last-known-good-commit.json`, git-ignored) on a
   full PASS, and `doctor` reports whether HEAD still matches it.
4. **Always-visible build identifier** — `web/vite.config.ts` now has a
   `define` block computing the short git commit hash and branch fresh
   from git at every dev-server start/build (`web/src/vite-env.d.ts`
   declares the injected `__GIT_COMMIT__`/`__GIT_BRANCH__` globals). A
   new dev-only `web/src/dev/BuildIdentifier.tsx` renders it as a small
   fixed footer badge — deliberately *not* inside `TelemetryInspector`'s
   collapsed `<details>`, so it never requires a click — and it's also
   echoed in that panel's `<summary>` line (visible without expanding)
   for redundancy. This directly targets the single most time-costly
   failure mode from tonight's session.
5. **`Start Positive Inking.command`** — a Mac double-click launcher
   (`cd` to the repo, run `npm run start`) so starting the stack never
   requires opening Terminal manually first.

**A real bug found and fixed along the way, in shared plumbing:**
`scripts/lib/devStack.mjs`'s `terminateManaged()` skipped signaling a
child's process group entirely once the *directly tracked* process (e.g.
the `npm` process for `npm run dev -w engine`) had already exited —
reasoning "nothing to do here." That's wrong when a grandchild it spawned
(`tsc --watch`, which retains the same process-group id) survives as an
orphan: nothing ever signals it. Found this directly while verifying the
stop→start cycle: a pre-existing, platform-timing-dependent race already
documented in `docs/dev-server-reliability.md` (not something this
chapter introduced — reproduced even against an unmodified `npm run dev`)
occasionally causes the engine watcher to receive an external SIGTERM
shortly after boot, which triggers the existing crash-cascade shutdown in
both `dev.mjs` and the new `start.mjs`; with the old `terminateManaged`,
that cascade left `tsc --watch` running orphaned, undetected by port
checks (it holds no port). Fixed by always signaling the process group,
regardless of whether the tracked child has already exited. This is a
tooling-only fix to shared process-lifecycle plumbing — the underlying
file-watcher race itself was not (and, per that doc, could not reliably
be) chased further; it remains an accepted, already-documented flake in
the dev stack, not a regression from this chapter.

**Verified live, not just read:**
- Stop→start cycled 5 times in a row (`npm run start` → confirm health →
  `npm run stop` → confirm ports free, repeat). All 5 stops fully cleaned
  up and every subsequent start succeeded — including the ~2/5 cycles
  where the pre-existing engine-watch race above fired mid-cycle, proving
  the tooling itself never gets stuck even when the underlying dev stack
  does.
- Port-conflict-recovery path: started the stack, `kill -9`'d the
  `npm run start` process directly (simulating a killed terminal — leaves
  engine/server/web running orphaned with a stale marker on disk), then
  ran `npm run start` again with no manual cleanup. It found the stale
  marker, confirmed each PID via working-directory ownership, printed
  what it was reclaiming and why, and came up clean — both ports
  responding — with zero manual intervention.
- `npm run doctor`'s stale-branch detection against real git history:
  `git reset --soft HEAD~1` (simulating a checkout behind its own
  remote-tracking ref) made `doctor` correctly report "1 commit(s)
  behind -- you are looking at OLD code, pull before debugging further";
  reset back to the real HEAD afterward.
- `npm run typecheck`, `npm test` (226 tests, unchanged), and
  `npm run test:dev-reliability` (the existing stress-edit regression
  test) all still pass after the `terminateManaged` change.

### 2026-09-02 — Investigated a reported style_reference "2+ minute hang": no code bug found
Trigger: a live report of a successful `style_reference` model call
(server log: `outcome=success elapsed_ms=5020 budget_ms=12000`, well
under budget) followed by 2+ minutes with no visible screen progression.

**Investigated, per instruction, before touching anything:**
1. Traced the client path: `StyleReference.tsx`'s `submit()` goes through
   the same `useAsyncAction` re-entrancy/staleness-guarded path as every
   other model-backed screen (`guard.isStale()` checked after the await,
   before the only state mutation, `setResolution(result)`) -- nothing
   unprotected. Re-read `useAsyncAction.ts` itself: `pending` clears in a
   `finally` keyed on the call's own token, independent of whether the
   guard reports stale, so there is no path that leaves it stuck `true`
   after a call this hook itself considers current.
2. Confirmed today's Screen 7 restyling touched exactly three files
   (`ElementsDiscovery.tsx`, `styles.css`, `docs/PROJECT_STATUS.md` --
   `git show --stat` on that commit) and introduced no class name outside
   an `ledger-`-prefixed set that exists nowhere else in `web/src`
   (grepped to confirm). No shared state file, `JourneyProvider.tsx`,
   `useAsyncAction.ts`, or `StyleReference.tsx` itself was touched --
   there is no mechanism by which it could affect this screen.
3. Live-reproduced the exact reported condition: intercepted
   `/api/style-reference` in a real browser (Playwright) to return a
   genuinely successful response instantly (isolating client behavior
   from real model latency, which the server log already cleared), landed
   on Screen 11's style-reference lead-in with seeded state, and
   submitted a real request through the real `useAsyncAction` path. No
   console or page errors. The screen correctly transitioned from the
   "Working out what that points toward..." spinner to a new heading,
   "Here's what that suggests," showing the resolution summary and a
   "That's right, continue" button; clicking it correctly advanced to
   the next screen (Artistic direction).

**Root cause: not a code bug.** `StyleReference.tsx`'s own docstring
states the intended design: "A resolution is always shown back once,
compactly, and is correctable before it's applied to anything" -- Screen
11 is a deliberate two-step confirm-before-apply flow, not
auto-advancing. A successful response correctly produces a *new*
screen (a confirmation summary), which then waits for an explicit user
click before the *next* screen appears. The reported "hang" most likely
happened at that confirmation step -- the screen did update, but not to
what was being watched for ("artistic direction"), and nothing in this
investigation found the confirmation screen failing to render or the
confirm action failing to fire. No code was changed. If this recurs
against a verified-current checkout, capturing what's actually on
screen at the moment of the "hang" (a screenshot, or which heading is
showing) would be the fastest way to tell a genuine regression from
this same UX read.

### 2026-09-02 — Applied the "studio ledger" design direction to Screen 7 (live, not a preview)
An earlier same-day exploration produced an isolated static-HTML preview of
a new visual direction for one representative screen, entirely outside the
app (no repo files touched): warm parchment background, a serif (Georgia)
headline over clean system-sans body/UI text, one ember-red accent reserved
only for selection state and a marginalia rule, candidates as a flowing
hairline-separated list instead of bordered "chip" cards, a hollow-ring
"wax seal" selection marker, expanded follow-ups styled as indented
marginalia (left rule, small-caps label, lined input), and a quiet 2px
progress hairline with a "0X / 13 · stage" label. That preview was
reviewed and approved. This session integrated it for real into
`ElementsDiscovery.tsx` (Screen 7) -- the only screen touched.

**What changed:** markup and CSS only, in two files --
`web/src/screens/ElementsDiscovery.tsx` (structure/classNames; the native
fidelity `<select>` became a segmented pill button group calling the exact
same `setFidelityByIndex`/`setAddedIdeas` state updates as before, just
from a `<button onClick>` instead of a `<select onChange>`) and
`web/src/styles.css` (a new block of `.ledger-*` classes and CSS custom
properties, purely additive -- no existing rule was edited or removed).
No state shape, handler, async/staleness guard (`useAsyncAction`,
`guard.isStale()`), or data flow changed anywhere.

**Scope discipline, deliberate:** the new palette/typography is scoped
under a `.ledger-screen` modifier applied alongside (never instead of) the
shared `.screen` class, so no other screen's look changed. Three things
inside Screen 7 itself were left on the app's ordinary shared styling on
purpose, since their CSS classes (`.reference-attachment`, `.reference-*`,
`.option-chip`) are reused independently by `Placement.tsx` and
`StyleReference.tsx`: the "add your own idea" input/button row, the
existing-sole-element/likeness/scene micro-questions, and the
`ReferenceAttachment` sub-component's own internals. The `.option-chip`
class itself (and its `.candidate-card` modifier from the earlier
layout-bug fix, task #52) is no longer used by Screen 7's own candidate
rendering at all -- Screen 7 now uses new `.ledger-candidate` markup
instead -- but the old rule is untouched in `styles.css` since every other
screen using plain `.option-chip` still needs it exactly as it was.

**Verification:** typecheck and build clean across all three workspaces;
full test suite passes unchanged (226 tests -- no existing test asserted
on Screen 7's specific markup/classNames, so none needed updating).
Live-browser-verified with the exact "handmade wall art / Athena"
scenario used throughout today's session, extended with a second
follow-up-bearing candidate: selection, expansion, typed follow-up text
(read via `inputValue()`, since a typed value never appears in
`innerText`), fidelity-pill selection, and the `ReferenceAttachment`
sub-component all work identically to before. Explicitly checked the
layout-bug class from task #52 does not recur: iterated the actual
rendered DOM order (Association's ranking can reorder candidates by
score, so array order isn't rendered order) and confirmed each
candidate's bounding box starts at or after the previous one's bottom --
no overlap anywhere, including with two candidates expanded
simultaneously with long typed answers. Screenshots reviewed directly,
both collapsed and with two candidates expanded.

Rolling this direction out to the remaining 12 screens is an explicit,
separate future decision -- not assumed or begun here.

### 2026-09-02 — Fixed the Screen 13 "Nothing outstanding" vs. post-Blueprint contradiction inconsistency
Follow-up to item #3 of the same day's earlier report, which the prior
session's summary omitted. Investigated as asked: "Still needed" on
Screen 13 (`DesignConfirmation.tsx`) is specifically the §8
reference-checklist bullet, computed only from `buildReferenceChecklist`/
`isReferenceEntrySatisfied` -- a genuinely different check from the
contradiction/`hasUnresolvedPrimaryImagery` signals that later drive the
Readiness reason. Confirmed this was a quick, well-scoped wording/display
fix, not new detection: both signals were already computed on that exact
screen (for the `has_unresolved_contradiction` boolean sent to the server
in `build()`), just never displayed. Added an "Open decisions" row next
to "Still needed" that calls `describeReadinessReason()` with the same
inputs, so its wording can never drift from what Readiness will actually
say -- shows "None noted" when clean, or the real contradiction
description(s) and their resolutions when not.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (226 tests, 3 new in a new
`web/src/screens/DesignConfirmation.test.tsx` -- one proving "Still
needed: Nothing outstanding" and a populated "Open decisions" can appear
together, the exact reported inconsistency, now resolved). Live-browser-
verified with the reported scenario (no outstanding references, one real
contradiction with two resolutions): Screen 13 shows both rows correctly,
screenshot reviewed directly.

### 2026-09-02 — Fixed a real duplication bug in the new Visual hierarchy decision map; readiness reason now names the contradiction and its next step
Follow-up to the same day's prior session (below): live browser evidence
confirmed the decision-map restructure and prior fixes were rendering
correctly overall, but surfaced two new, genuinely live bugs in the new
code itself -- unlike the earlier same-day report, these were NOT a stale
build.

**Fixed:**
1. **Duplication bug in `groupVisualElementsForHierarchySection`.** The
   prior session's own design treated `stillUndecided` as a
   cross-cutting flag an element could carry *alongside* its
   `personal`/`other` category bucket -- so a personal, unranked element
   appeared verbatim in both "Other elements" and "Still undecided" on a
   real Blueprint. Changed the grouping so every element lands in
   EXACTLY ONE of the three groups: `stillUndecided` now takes priority
   (an unranked element is flagged there and nowhere else); once
   resolved, it moves into `personal`/`other`, which remain exhaustive
   and mutually exclusive as before.
2. **"Still undecided" bypassed prose composition.** The same report
   correctly noticed the duplicated element's text read as raw,
   unprocessed input in that group, unlike "Personal reference"/"Other
   elements". Root cause: "Still undecided" rendered bare `e.description`
   directly instead of going through `visualElementSentence()`
   (`ElementLine` in `BlueprintView.tsx`) the way the other two groups
   already did. Now routed through the identical composition path in
   both the on-screen JSX and the plain-text export.
3. **Readiness reason too vague to act on.** "A noted contradiction in
   the design is still unresolved" named no contradiction and no next
   step. Root cause: the Association Engine's own `contradictions_noticed`
   (`{description, resolutions}` per §11 rule 7, "plain descriptions with
   one or two resolutions") was being flattened to a bare description
   string the moment it landed in `project.contradictions`
   (`ElementsDiscovery.tsx`), discarding the resolutions entirely before
   anything downstream could use them. `ProjectState.contradictions` is
   now `ContradictionRecord[]` (`{description, resolutions}`, a new
   engine type) end to end; `describeReadinessReason()`
   (`engine/src/readiness.ts`) takes the full records instead of a
   `hasOtherContradiction` boolean and composes one reason per
   contradiction naming its description and, when present, its own
   "Possible next step(s)" -- never an invented suggestion, only what the
   model itself already proposed.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (223 tests: 154 engine -- 8 new/rewritten covering the
new `ContradictionRecord`-based reasons -- 39 server, 30 web -- new/rewritten
tests in `blueprintSummary.test.ts` proving no element ever appears twice
across the three groups, and in `BlueprintView.test.tsx` proving the exact
live-test duplication no longer reproduces and the readiness reason names
real contradiction text). Live-browser-verified with the exact reported
"Athena wire" element (personal source category, unranked hierarchy, a
real contradiction with two resolutions attached): the element's text now
appears exactly once in Section 4, under "Still undecided" alone, composed
identically to the other groups; Section 12 now reads the actual
contradiction plus both possible next steps, never the old generic
sentence -- screenshot reviewed directly.

### 2026-09-02 — Investigated readiness/undecided-tag regression reports (stale build, not a code bug); fixed Statement of Inspiration sourcing; restructured Visual hierarchy into a decision map
Trigger: a live session reported two apparent regressions on a fresh
Blueprint, right after 8c3a7fa shipped -- Readiness showing bare "Needs
refinement" with nothing else, and "(undecided)" leaking into Visual
hierarchy in a *different* rendering shape than the bug 8c3a7fa fixed,
suggesting a second, uncaught code path. Instructed to investigate both
fully before touching anything.

**Investigation findings for #1 and #1b (report-first, as instructed):**
- Confirmed 8c3a7fa and its follow-up (3f2af40) are present on both the
  local working tree and `origin/claude/positive-inking-implementation-ckncmj`
  -- no stale branch, no uncommitted drift, no leftover dev process in this
  sandbox to have served old code.
- Proved algebraically that current code cannot produce either symptom:
  `describeReadinessReason()` always returns at least one string for
  `needs_refinement` (only `blueprint_ready`/`concept_visual_ready` -- a
  different label entirely -- return empty), and current
  `HIERARCHY_LABEL` has no entry for `"undecided"`, so no code path can
  emit a parenthetical `(undecided)` tag.
- Reconstructed the exact reported text byte-for-byte from 8c3a7fa's
  **pre-fix** `formatBlueprintAsText`: the OLD line
  `` `- ${e.description} (${e.hierarchy}) -- ${e.personal_meaning}` ``
  produces precisely `"(undecided) -- <meaning>"` for an unranked element
  (matching #1b's exact parens + double-hyphen formatting, which neither
  the old NOR new on-screen JSX -- both use a bare em-dash, no parens --
  could produce), and the OLD bare `section("Readiness",
  READINESS_LABEL[...])` call produces precisely #1's reported bare label.
- **Conclusion: not two bugs, and not a second rendering path.** Both
  symptoms are one root cause -- the live session that generated this
  Blueprint was running pre-8c3a7fa code (a stale dev server process,
  browser tab, or checkout predating the fix), consistent with this
  project's documented history of exactly this failure class. No code fix
  was made for #1/#1b themselves. Per the coverage gap the report
  correctly identified (only the pure helpers were unit-tested, nothing
  exercised BlueprintView's actual rendered output), added
  `web/src/screens/BlueprintView.test.tsx`: component-level regression
  tests rendering the real tree, so a future regression that stops calling
  `visualElementSentence()`/`describeReadinessReason()` from the JSX would
  actually be caught.

**Fixed:**
- **#2, Statement of Inspiration drew from aesthetics instead of
  story/why.** `server/src/schemas/blueprint.ts`'s
  `BLUEPRINT_SYSTEM_PROMPT` had zero guidance for `statement_of_inspiration`
  at all -- it was listed as a required schema field with no phrasing
  instruction, so the model defaulted to the richest available material
  (visual/aesthetic technique description) over the terser Story/Why
  fields. Added one paragraph: one or two sentences, drawn primarily from
  story and why, not from visual_direction/artistic_direction's execution
  detail. Prompt-only change (no schema/type change).
- **#3, Section 4 (Visual hierarchy) restructured into a decision map.**
  Proposed structure (Core concept / Personal reference / Other elements /
  Still undecided) implemented in both `BlueprintView.tsx`'s on-screen JSX
  and its plain-text export, backed by a new pure
  `groupVisualElementsForHierarchySection()` in `blueprintSummary.ts`:
  `personal`/`other` exhaustively partition every element by
  `isPersonalSourceCategory` (§22's own existing definition, not a second
  hand-maintained list) so nothing is silently dropped, and
  `stillUndecided` is a separate, cross-cutting flag list (an element can
  be both a personal reference and still-undecided -- those are two
  different facts about the same element). This directly serves the
  report's own observation: making "needs a decision" its own visibly
  separate list is what would have made #1b's kind of leak immediately
  obvious as a structural anomaly rather than a buried word.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (219 tests: 152 engine, 39 server, 28 web -- 12 new this
session: 5 pure-function tests for `groupVisualElementsForHierarchySection`
in `blueprintSummary.test.ts`, 7 component-level tests in the new
`BlueprintView.test.tsx` covering both the #1/#1b regression-proof and the
new decision-map structure). Live-browser-verified against the exact
"handmade wall art / Athena" scenario via a seeded journey state: Section 4
now shows Core concept / Personal reference / Still undecided cleanly with
no raw tags, and Section 12 shows the readiness reason inline -- screenshot
reviewed directly. #2's model-input change could not be live-verified
against a real model in this sandbox (no `ANTHROPIC_API_KEY` configured,
same limitation as the prior session's Association prompt change); the
prompt text itself and full test/typecheck pass were confirmed instead.

Per instruction, four items were noted rather than built this session --
now recorded above under "Known, deliberately deferred issues": free-text
input + suggestion chips on binary confirmation screens, a timer/countdown
during model-call waits (flagged as possibly overlapping the
placement-preference "productive waiting" MVP), an overall journey
progress indicator, and a second voice-input failure mode (no response to
activation at all, distinct from the earlier cutoff issue).

### 2026-09-02 — Association CONCRETENESS rule extended to personal_meaning (Option C)
Follow-up to the same day's live-test session below: item 4's investigation
proposed three prompt-change options at different strictness levels for
`server/src/schemas/association.ts`'s CONCRETENESS rule (which constrained
only `description`, not `personal_meaning` — the field where abstract
phrasing like "already carries the weight of connection" actually lives).
You chose **Option C**, a grounding requirement rather than a literalness
requirement: `personal_meaning` can stay honestly abstract when that's
what the story supports, but must be grounded in a specific detail from
the client's story or the candidate's own description, never a sentence
generic enough to fit any client — and the model should say plainly when
nothing yet grounds the meaning, rather than default to boilerplate.
Applied as one paragraph appended to rule 8, immediately after its
existing `description` guidance; no schema/type change, since this is
prompt wording only.

**Verified:** typecheck and build clean across all three workspaces; full
test suite passes (207 tests — unchanged, since no schema or behavior
contract changed, only prompt text the schema doesn't validate).
**Not verified — and could not be, in this environment:** whether
`personal_meaning` actually reads more specifically against the real
model. This sandbox has no `ANTHROPIC_API_KEY` configured (`server/.env`
does not exist; `npm run dev` reports "Model configured: NO"), and the
project's fake-model test double (`test-integration/fakeAnthropic.mjs`)
returns hardcoded canned text regardless of prompt content, so it cannot
demonstrate a wording-quality change either — running the app against it
would not have been a genuine check, so it wasn't staged as one. **Before
treating this change as validated, run `npm run diagnose-model` (or the
app itself) with a real `ANTHROPIC_API_KEY` against the "handmade wall
art" scenario and confirm `personal_meaning` no longer defaults to generic
phrasing like "already carries the weight of connection."** If it still
does, the next step is likely Option A (the stricter variant) rather than
further tweaking C's wording.

### 2026-09-02 — Live end-to-end test fixes: Screen 7 layout, readiness reasons, Blueprint prose leaks
Trigger: a real, full end-to-end browser test journey (screenshots and the
resulting Blueprint document reviewed directly — not `diagnose-model`)
surfaced three real bugs and two items worth investigating before touching.

**Fixed:**
1. **Screen 7 layout bug — expanded candidate card overlapped following
   content.** Root cause was not absolute positioning as suspected: `.option-chip`'s
   999px border-radius (correct for every other use of that class, a
   short single-line pill toggle) computed as an ellipse once
   `ElementsDiscovery.tsx` reused the same class for a tall, multi-line
   expandable container (follow-up field, fidelity select, reference
   attachment), so the curved corners bit into corner text once a
   candidate expanded. Fix: a scoped `.option-chip.candidate-card`
   modifier (`web/src/styles.css`) overriding the radius to 12px, applied
   only at ElementsDiscovery's two usages — every real pill-shaped
   `.option-chip` elsewhere is untouched. Verified visually (screenshots +
   bounding-box overlap checks) across two different follow-up-field
   candidates, individually and together, with realistic long typed text.
2. **Blueprint Readiness section gave no reason.** Added
   `describeReadinessReason()` (`engine/src/readiness.ts`) — a pure
   function reusing the exact same signals already driving Design
   considerations (the reference checklist, `hasUnresolvedPrimaryImagery`,
   `project.contradictions`) rather than inventing new logic or parsing
   the model's own prose. Wired into `BlueprintView.tsx`'s on-screen
   render and plain-text export via a thin `readinessReasons()` helper.
3. **Raw candidate/status strings leaking into Blueprint prose.** Live
   example: Section 4 rendered "...saying Athena undecided — A concrete
   thing from your shared world that already carries the weight of
   connection" — the literal `hierarchy: "undecided"` enum value and a
   raw `"to upload"` status were being concatenated straight into the
   on-screen sentence (`BlueprintView.tsx`'s Section 4/8 JSX and its
   plain-text export), the same class of bug as the earlier
   `confirmed_project_summary` raw-enum leak, just in the client-facing
   document instead of the model's input. Fix: moved the composition into
   `web/src/journey/blueprintSummary.ts` (`visualElementSentence`,
   `HIERARCHY_LABEL`, `REFERENCE_STATUS_LABEL`) — a hierarchy role is only
   ever shown once it names an actual value (never "undecided"), status is
   phrased as what happened ("Not yet uploaded", not "to upload"), and
   `personal_meaning` is only appended when it adds information the
   description doesn't already have. Status markers like "undecided"/
   "to upload" still reach the client through Design considerations' real
   sentences, exactly as the user asked — nothing there changed.

**Investigated only, per instruction — no code changed:**
4. **Association candidate wording too abstract.** Traced to
   `server/src/schemas/association.ts`'s CONCRETENESS rule constraining
   only `description`, not `personal_meaning` (where the abstract phrasing
   lives). Smallest proposed change documented in this file's "Open
   decisions" section above — deliberately not applied without
   confirmation, since it changes live model output for every user.
5. **"Whose is it?" reference field relevance.** Traced to
   `ReferenceAttachment`'s `subject_relationship` dropdown rendering
   whenever fidelity requires a reference, independent of
   `source_category`/`material_type` — it answers a consent-attestation
   question (whose likeness/handwriting/signature is this material) that
   doesn't map onto an object the client made themselves for a living
   family member. Full finding in "Open decisions" above; left as-is
   pending a decision on adjusting the options, gating them on
   `material_type`, or leaving them.

**Verification:** typecheck and build clean across engine/server/web; full
test suite passes (207 tests: 160 engine — including 8 new
`describeReadinessReason` cases — 39 server, 16 web — including new
`visualElementSentence`/`REFERENCE_STATUS_LABEL` regression coverage for
the exact "handmade wall art" scenario above). Live-browser-verified: the
Screen 7 CSS fix is unchanged and still in place; a seeded Blueprint state
reproducing the exact reported scenario rendered Section 4/8 cleanly (no
raw "undecided"/"to upload" tags) and a Readiness reason inline, screenshot
reviewed directly.

Two items were explicitly out of scope and only noted, not touched: voice
input timeout/cutoff behaviour, and Statement of Inspiration typography /
overall Blueprint visual formatting — both now recorded above under
"Known, deliberately deferred issues" so they aren't lost.

### 2026-09-01 — Raised Discovery/Association timeouts from real diagnostic data
A real `npm run diagnose-model` run against the model configured as
default at the time (a dated Sonnet 4.5 release, since retired 2026-09-29
and migrated off — see the later "Model migration" entry in this log)
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

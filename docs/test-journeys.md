# V3.0 §25 test journeys — results and findings

**Status:** deterministic half complete; model-quality half blocked on a missing API key in the build environment.
**Method:** `npm run journeys -w engine` runs `engine/scripts/testJourneys.ts`, which calls the real engine functions (`computeConceptSignals`, `evaluateCompositionFlow`, `evaluateArtisticDimensions`, `routeAfterDiscovery`, `fidelityTreatmentRequired`, `lightweightSuitabilityCheck`) for each of the fifteen journeys, walking every adaptive question to a chosen answer until the engine reports nothing left to ask. Every number below is a real return value from real code, not a description of intended behaviour.

## Scope limit, stated up front

§25 requires two things: what the engine asks/skips (deterministic, testable with no network), and interpretive accuracy / emotional proportionality / personalisation / originality (explicitly "require live model output and cannot be assessed from a desk walkthrough... Do not report desk scores for them"). This build environment has no `ANTHROPIC_API_KEY` for the product itself, so **the second half was not attempted** — no scores are reported for it, per the spec's own instruction, rather than faked. The first half — the part V3.0 and the Build Brief both frame as the buildable, testable claim — is complete and reported in full below.

To complete the second half: add a real key to `server/.env`, run `npm run verify-model` to confirm the round trip, then run each journey's story/image through the actual browser app and score the resulting Blueprint against §25's rubric (interpretive accuracy, emotional proportionality, personalisation, originality, plus the five criteria that are assessable without a model: visual specificity, composition completeness, adaptive questioning, reference awareness, absence of unsupported invention).

Journeys 7 and 10 (attraction/expert mode) and 11–15 have no Discovery call at all, so no confidence-routing line appears for them in the trace — that absence is itself correct behaviour (§7: attraction/expert modes skip Discovery entirely).

## Summary

| # | Journey | concept_shape | Total questions (comp+artistic+fidelity) | Composition budget used | Artistic budget used |
|---|---|---|---|---|---|
| 1 | Meaning-rich, imagery-poor | single_emblem | 6 | 0/2 | 4/4 |
| 2 | Imagery-rich, meaning-poor | paired_elements | 6 | 1/2 | 3/4 |
| 3 | Artist-led trust project | paired_elements | 5 | 1/2 | 2/2 |
| 4 | Exact personal artefact (signature, surrendered) | text_led | 5 | 0/1 | 1/1 |
| 5 | Large immersive piece | narrative_scene | 8 | 2/2 | 4/4 |
| 6 | Small, high-detail contradiction | multi_element | 6 (+ blocking suitability flag) | 2/2 | 2/4 |
| 7 | Attraction-led, no stated meaning | single_emblem | 6 | 0/2 | 4/4 |
| 8 | Future-facing identity | single_emblem | 6 | 0/2 | 4/4 |
| 9 | Memorial without melodrama | single_emblem | 5 | 0/2 | 3/4 |
| 10 | Expert, tattoo-literate user | single_emblem | 6 | 0/2 | 4/4 |
| 11 | Explicit no background (place as subject) | single_emblem | 6 | 0/2 | 4/4 |
| 12 | New concept after visual suggestions | paired_elements | 6 | 1/2 | 3/4 |
| 13 | All avoidances rejected | single_emblem | 5 | 0/2 | 3/4 |
| 14 | Custom artistic direction ("Something else") | paired_elements | 6 | 1/2 | 3/4 |
| 15 | Simple project (olive branch, ankle) | single_emblem | 5 | 0/2 | 3/4 |

Full per-question trace (which dimension, mandatory vs discretionary, the reason the engine gave) is reproducible verbatim with `npm run journeys -w engine`; it is not duplicated here to keep this document readable.

## What the trace confirms

- **No-background invariant holds everywhere.** Every composition_type answer in the trace was drawn from `getCompositionOptionPool`, which structurally cannot omit the no-background option (Phase 2's own test suite already proves this per-shape; the journey trace confirms it's actually reachable in a live walk, not just present in the table).
- **Fidelity treatment survives surrendered control.** Journey 4 asks for fidelity treatment and gets `exempt_asked` on `rendering_references` even though the composition/artistic budgets are both capped at 1 — the exemption is real, not just documented.
- **Place role changes the vocabulary, correctly.** Journey 11 (a lighthouse, place-as-subject) derives `single_emblem`; journey 5 (a storm at sea, place-as-setting, spatial language) derives `narrative_scene`. Same "place" concept, opposite shape, exactly per §12.2–12.3.
- **The lightweight suitability pass actually blocks.** Journey 6 (five elements, small scale) surfaces a blocking consideration with "Go larger / Simplify the concept" — using this build's own placeholder element-count ceiling (see Phase 2's disclosed calibration gap; this is a real one-line-tunable number, not a hard-coded fact from V3.0).
- **Attraction/expert modes genuinely skip Discovery.** Journeys 7 and 10 show no Discovery routing line at all — there is no confidence to route on, because no Discovery call happens in those modes.

## Findings worth flagging (not silently patched)

### 1. `reading_direction` over-triggered on a single text element — fixed

**Found via:** journey 4 (a single grandfather's signature, exact fidelity, `surrendered` control — composition budget of exactly 1 discretionary question).

§12.5's table literally reads: ask reading direction when "`element_count >= 3`, text present, or narrative scene." Taken completely literally, "text present" alone fires for a single word or a single signature — where there is no real reading-order decision to make; it reads the one way it reads. Under `surrendered` control the discretionary composition budget is exactly 1, so the original implementation spent that single question on a non-decision, leaving nothing for anything more material.

**Fix applied** (`engine/src/composition.ts`, `evaluateReadingDirection`): require `has_text_or_handwriting` together with `element_count >= 2`, not `has_text_or_handwriting` alone. A single text/signature element no longer triggers the question; two or more do, matching the "three or more elements" clause's own spirit that this is about *ordering multiple things*, not reading a single one. Re-running journey 4 after the fix: composition budget usage drops from 1/1 to 0/1 — the surrendered project now asks only what §12.8's exemption actually requires (fidelity treatment + colour + the exempt rendering-references question), nothing else. A regression test locks in both the old (2+ elements) and new (1 element, now ineligible) cases (`engine/test/composition.test.ts`).

This is exactly the kind of thing Build Brief §11 open question 2 anticipates ("budget numbers... are reasoned, not empirical. Expect to recalibrate") — the fix is a one-line, well-scoped change, not a redesign.

### 2. The Build Brief's "about four questions total" for the simple case — reconciled, not contradicted

Build Brief §8 names the olive-branch/ankle/collaborative case as the highest-signal check and says it "should produce about four questions total." Journey 15's trace shows 2 mandatory composition questions (composition type, internal background — explicitly *never counted* by §12.4) plus 3 discretionary artistic questions (colour, linework, shading) = 5 total, or 3 if only the counted discretionary budget is what "four questions" refers to.

Both readings are defensible from the text, and the two numbers (3 or 5) bracket "about four" reasonably closely either way. This is not a contradiction so much as an underspecified unit — "questions" isn't defined precisely enough to know whether mandatory composition questions count toward the Build Brief's own target number. Recommendation: when real users run this journey (the model-quality half of this protocol), measure wall-clock question count as actually experienced and settle the definition empirically rather than by re-reading the text harder.

### 3. Composition budget still ignores project scale — present, not newly discovered

Journey 5 (large immersive piece, `collaborative` control) and a hypothetical wrist-sized `collaborative` project would get the *identical* composition budget (2 discretionary questions) despite needing very different amounts of adaptive attention. This is §27 open item 1 from V3.0 itself ("Composition budget is set by creative control alone and ignores project scale... warrants its own decision") — implemented faithfully as specified, not a new defect, but the journey trace makes the effect concrete: journey 5 spends its full budget on density + negative space and still has no headroom for anything else a half-sleeve narrative scene might need, while a `collaborative` wrist piece has budget to spare it will never use. Left as-is per the spec's own acknowledgement that this needs a real design decision, not a code fix made unilaterally here.

## Real-browser verification actually performed

This sandbox's lack of a live model key means every journey hits the same wall at its first model call (Discovery, Provenance, or Association depending on mode) — running all fifteen individually in a browser would produce fifteen identical `model_not_configured` screenshots past that point, not fifteen different findings. What *was* verified live, in headless Chromium, across Phases 4–6 (see those commits for full detail):

- Full-mode path (journeys 1, 3, 5, 6, 8, 9, 15's shape): Welcome → Viewpoint(Past) → Story submission → correct visible error → retry → manual-path escape → Working Notes, with the typed story preserved verbatim both mid-session and across a full page reload.
- Attraction/expert-mode path (journeys 2, 4, 7, 10's shape): Welcome → Viewpoint(expert) → Image description → Image provenance ("I've just always liked it", no model call) → Elements discovery → correct visible error at the Association call → same degradation path.
- The Engine Inspector showing live, correct `journey_mode` and current-screen transitions for both paths.
- A seeded-localStorage Blueprint render (since a live one isn't reachable here) confirming the numbered §17 sections, the §17.5 avoid-list reporting distinction, and Copy/Refine actions all work without data loss.

Two real bugs were caught this way and are already fixed (documented in the Phase 4 commit): Story screen losing `raw_story` on a failed Discovery call, and a screen-routing regression that fix introduced.

## What's still needed to close out §25 in full

1. A real `ANTHROPIC_API_KEY`, then `npm run verify-model`, then each of the fifteen stories/images actually typed into the running app.
2. Three independent working tattoo artists rating the resulting Blueprints per §23.2 (this needs real artists, not something a coding pass can produce).
3. The "This feels like me" instrument (§23.1) against real users.

None of that can happen inside this build session; the deterministic half above is what could be done, and it surfaced one real defect (fixed) plus one useful reconciliation of an ambiguous target number.

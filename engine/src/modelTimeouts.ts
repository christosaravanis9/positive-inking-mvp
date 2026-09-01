/**
 * Per-route model-call timeout budgets and the client/server margin
 * invariant. This is not adaptive-engine domain logic (§12) -- it is
 * infrastructure config for the model layer -- but it lives here anyway
 * because engine/ is the one zero-dependency package server/ and web/
 * already both import, and the alternative (duplicating the same numbers
 * separately in a Node-only server config and a browser-bundled client
 * config, by hand, forever in sync) is exactly the kind of drift this
 * codebase's own conventions elsewhere go out of their way to avoid.
 *
 * Defaults were chosen by inspecting each route's actual prompt/schema
 * (server/src/schemas/*.ts), not picked arbitrarily -- see
 * docs/timeout-matrix.md for the full reasoning per route. Summary:
 *
 *  - provenance, avoidance: small schemas, short free-text/array output,
 *    default maxTokens (2048) never overridden by the route -- fastest.
 *  - style_reference: small fixed-vocabulary classification (<=7 dimension/
 *    value pairs against a closed vocab) -- fast, slightly more judgement
 *    than pure extraction.
 *  - discovery: many output fields, but all short strings/arrays; a
 *    genuine semantic-extraction call, not a heavy generation one --
 *    moderate.
 *  - association: the heaviest structured schema (an array of candidates,
 *    each carrying ~10 fields including 6 numeric ranking scores and a
 *    concreteness/follow-up judgement) -- maxTokens explicitly raised to
 *    4096 by the route, the only field-count-based justification needed
 *    for the largest ceiling.
 *  - blueprint: fewer fields but the most prose-heavy generation (up to
 *    ~10 written sections) -- also raised to maxTokens 4096 by the route,
 *    same ceiling as association for the same reason (generation volume,
 *    not field count, drives latency here).
 */

export type ModelRoute = "discovery" | "provenance" | "association" | "avoidance" | "style_reference" | "blueprint";

export const MODEL_ROUTES: readonly ModelRoute[] = [
  "discovery",
  "provenance",
  "association",
  "avoidance",
  "style_reference",
  "blueprint",
];

/**
 * Server-side total wall-clock budget per route (ms), across modelClient's
 * one shared-budget retry. Env-overridable per route -- see
 * server/src/env.ts.
 *
 * discovery (16000 -> 20000) and association (30000 -> 40000) were raised
 * from their original values after a real `npm run diagnose-model` run
 * against claude-sonnet-4-5-20250929 measured association at 32310ms
 * (already over its 30000ms budget) and discovery at 12937ms (under
 * budget, but only ~3s of margin against 16000ms) -- see
 * docs/timeout-matrix.md for the full run data and the explicit caveat
 * that this is one sample, not a confirmed stable ceiling yet.
 */
export const MODEL_ROUTE_TIMEOUT_DEFAULTS_MS: Record<ModelRoute, number> = {
  provenance: 10000,
  avoidance: 10000,
  style_reference: 12000,
  discovery: 20000,
  association: 40000,
  blueprint: 30000,
};

/**
 * Added on top of a route's server budget to get the client's own fetch
 * timeout, so the client never gives up while the server is still
 * legitimately working (see web/src/api/client.ts, docs/async-state-
 * incident.md). Comfortably covers network round-trip and Express
 * overhead on top of the server's own worst case.
 */
export const CLIENT_TIMEOUT_MARGIN_MS = 10000;

export function clientTimeoutForRoute(route: ModelRoute): number {
  return MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[route] + CLIENT_TIMEOUT_MARGIN_MS;
}

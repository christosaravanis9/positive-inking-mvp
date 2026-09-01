import { describe, it, expect } from "vitest";
import {
  MODEL_ROUTES,
  MODEL_ROUTE_TIMEOUT_DEFAULTS_MS,
  CLIENT_TIMEOUT_MARGIN_MS,
  clientTimeoutForRoute,
} from "../src/modelTimeouts.js";

describe("model route timeouts", () => {
  it("every route has a bounded, non-zero default -- never unlimited, never excessively high", () => {
    for (const route of MODEL_ROUTES) {
      const ms = MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[route];
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(30000);
    }
  });

  it("association and blueprint (the heaviest structured-output calls) have a strictly larger ceiling than every simple extraction route", () => {
    const heavy = ["association", "blueprint"] as const;
    const simple = ["discovery", "provenance", "avoidance", "style_reference"] as const;
    for (const h of heavy) {
      for (const s of simple) {
        expect(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[h]).toBeGreaterThan(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[s]);
      }
    }
  });

  it("client timeout for every route exceeds that route's server budget with real margin", () => {
    for (const route of MODEL_ROUTES) {
      const serverBudget = MODEL_ROUTE_TIMEOUT_DEFAULTS_MS[route];
      const clientTimeout = clientTimeoutForRoute(route);
      expect(clientTimeout).toBeGreaterThan(serverBudget);
      expect(clientTimeout - serverBudget).toBe(CLIENT_TIMEOUT_MARGIN_MS);
      expect(clientTimeout - serverBudget).toBeGreaterThanOrEqual(5000);
    }
  });

  it("matches the documented timeout matrix (docs/timeout-matrix.md) exactly", () => {
    expect(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS).toEqual({
      provenance: 10000,
      avoidance: 10000,
      style_reference: 12000,
      discovery: 16000,
      association: 30000,
      blueprint: 30000,
    });
  });
});

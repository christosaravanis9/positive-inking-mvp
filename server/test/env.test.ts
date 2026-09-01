import { describe, it, expect, vi } from "vitest";
import { MODEL_ROUTE_TIMEOUT_DEFAULTS_MS } from "@positive-inking/engine";

process.env.ANTHROPIC_API_KEY = "test-key";

describe("env.modelTimeouts", () => {
  it("defaults every route to engine's own MODEL_ROUTE_TIMEOUT_DEFAULTS_MS when no env override is set", async () => {
    const ROUTE_ENV_VARS = [
      "MODEL_TIMEOUT_DISCOVERY_MS",
      "MODEL_TIMEOUT_PROVENANCE_MS",
      "MODEL_TIMEOUT_ASSOCIATION_MS",
      "MODEL_TIMEOUT_AVOIDANCE_MS",
      "MODEL_TIMEOUT_STYLE_REFERENCE_MS",
      "MODEL_TIMEOUT_BLUEPRINT_MS",
    ];
    const saved = ROUTE_ENV_VARS.map((v) => process.env[v]);
    ROUTE_ENV_VARS.forEach((v) => delete process.env[v]);
    vi.resetModules();

    const { env } = await import("../src/env.js");
    expect(env.modelTimeouts).toEqual(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS);

    ROUTE_ENV_VARS.forEach((v, i) => {
      if (saved[i] !== undefined) process.env[v] = saved[i]!;
    });
    vi.resetModules();
  });

  it("overrides only the specific route named by its env var, leaving every other route at its default", async () => {
    const original = process.env.MODEL_TIMEOUT_ASSOCIATION_MS;
    process.env.MODEL_TIMEOUT_ASSOCIATION_MS = "12345";
    vi.resetModules();

    const { env } = await import("../src/env.js");
    expect(env.modelTimeouts.association).toBe(12345);
    expect(env.modelTimeouts.provenance).toBe(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS.provenance);
    expect(env.modelTimeouts.blueprint).toBe(MODEL_ROUTE_TIMEOUT_DEFAULTS_MS.blueprint);

    if (original === undefined) delete process.env.MODEL_TIMEOUT_ASSOCIATION_MS;
    else process.env.MODEL_TIMEOUT_ASSOCIATION_MS = original;
    vi.resetModules();
  });

  it("isDevelopment is true by default and false when NODE_ENV=production", async () => {
    const original = process.env.NODE_ENV;

    delete process.env.NODE_ENV;
    vi.resetModules();
    const { env: devEnv } = await import("../src/env.js");
    expect(devEnv.isDevelopment).toBe(true);

    process.env.NODE_ENV = "production";
    vi.resetModules();
    const { env: prodEnv } = await import("../src/env.js");
    expect(prodEnv.isDevelopment).toBe(false);

    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
    vi.resetModules();
  });
});

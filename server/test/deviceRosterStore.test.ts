import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Same mocking discipline as analyticsStore.test.ts: mock both
 * @supabase/supabase-js and node:fs/promises so no real network call or
 * disk write happens here. Focus is on the local-file branch (the
 * realistic path in this sandbox and in local dev), with one pair of
 * tests confirming the Supabase branch is at least reached correctly.
 */

const supabaseSelectMock = vi.fn();
const supabaseEqMock = vi.fn();
const supabaseMaybeSingleMock = vi.fn();
const supabaseUpsertMock = vi.fn();
const supabaseInMock = vi.fn();
const fromMock = vi.fn(() => ({
  select: supabaseSelectMock,
  upsert: supabaseUpsertMock,
}));
const createClientMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const readFileMock = vi.fn();
const writeFileMock = vi.fn().mockResolvedValue(undefined);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  mkdir: (...args: unknown[]) => mkdirMock(...args),
}));

const ORIGINAL_URL = process.env.SUPABASE_URL;
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  readFileMock.mockReset();
  writeFileMock.mockClear();
  mkdirMock.mockClear();
  fromMock.mockClear();
  createClientMock.mockClear();
  supabaseSelectMock.mockReset().mockReturnValue({ eq: supabaseEqMock, in: supabaseInMock });
  supabaseEqMock.mockReset().mockReturnValue({ maybeSingle: supabaseMaybeSingleMock });
  supabaseMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  supabaseUpsertMock.mockReset().mockResolvedValue({ error: null });
  supabaseInMock.mockReset().mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
});

describe("deviceRosterStore -- getDeviceRosterState / saveDeviceRosterState (local-file branch)", () => {
  it("creates and persists a fresh initial roster when no file exists yet", async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    vi.resetModules();
    const { getDeviceRosterState } = await import("../src/deviceRosterStore.js");
    const { INITIAL_ACTIVE_DEVICE_IDS } = await import("@positive-inking/engine");

    const state = await getDeviceRosterState();
    expect(state.activeDeviceIds).toEqual(INITIAL_ACTIVE_DEVICE_IDS);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("reads and reconciles a persisted roster rather than creating a new one", async () => {
    const persisted = {
      activeDeviceIds: ["literal_object", "negative_space", "layering", "lettering", "repetition"],
      reserveDeviceIds: [
        "material_substitution",
        "scale_contrast",
        "state_shift",
        "symbolic_object",
        "environmental_context",
        "sequence",
        "likeness",
        "geometric_abstraction",
        "colour_accent",
      ],
      eventsSinceLastReview: 42,
      lastReviewedAt: "2026-09-01T00:00:00.000Z",
      history: [],
    };
    readFileMock.mockResolvedValue(JSON.stringify(persisted));
    vi.resetModules();
    const { getDeviceRosterState } = await import("../src/deviceRosterStore.js");

    const state = await getDeviceRosterState();
    expect(state.activeDeviceIds).toEqual(persisted.activeDeviceIds);
    expect(state.eventsSinceLastReview).toBe(42);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("saveDeviceRosterState writes the exact state as JSON to the local file", async () => {
    vi.resetModules();
    const { saveDeviceRosterState } = await import("../src/deviceRosterStore.js");
    const { createInitialDeviceRosterState } = await import("@positive-inking/engine");

    const state = createInitialDeviceRosterState();
    await saveDeviceRosterState(state);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const written = writeFileMock.mock.calls[0]?.[1];
    expect(JSON.parse(written)).toEqual(state);
  });
});

describe("deviceRosterStore -- getDeviceRosterState (Supabase branch)", () => {
  it("reads from Supabase when configured, and creates+upserts a fresh roster when no row exists yet", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    supabaseMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    vi.resetModules();
    const { getDeviceRosterState } = await import("../src/deviceRosterStore.js");

    const state = await getDeviceRosterState();
    expect(fromMock).toHaveBeenCalledWith("device_roster_state");
    expect(supabaseUpsertMock).toHaveBeenCalledTimes(1);
    expect(state.activeDeviceIds.length).toBeGreaterThan(0);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("returns the persisted state from Supabase without upserting when a row already exists", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    const persisted = {
      activeDeviceIds: ["literal_object", "negative_space", "layering", "lettering", "repetition"],
      reserveDeviceIds: [
        "material_substitution",
        "scale_contrast",
        "state_shift",
        "symbolic_object",
        "environmental_context",
        "sequence",
        "likeness",
        "geometric_abstraction",
        "colour_accent",
      ],
      eventsSinceLastReview: 7,
      lastReviewedAt: null,
      history: [],
    };
    supabaseMaybeSingleMock.mockResolvedValue({ data: { state: persisted }, error: null });
    vi.resetModules();
    const { getDeviceRosterState } = await import("../src/deviceRosterStore.js");

    const state = await getDeviceRosterState();
    expect(state.activeDeviceIds).toEqual(persisted.activeDeviceIds);
    expect(supabaseUpsertMock).not.toHaveBeenCalled();
  });
});

describe("deviceRosterStore -- maybeReviewDeviceRoster", () => {
  async function freshStore() {
    vi.resetModules();
    return import("../src/deviceRosterStore.js");
  }

  it("below threshold: increments the counter and saves, without aggregating or reviewing", async () => {
    readFileMock.mockImplementation(async (filePath: string) => {
      if (String(filePath).includes("device-roster-state")) {
        return JSON.stringify({
          activeDeviceIds: ["literal_object", "material_substitution", "negative_space", "environmental_context", "geometric_abstraction"],
          reserveDeviceIds: ["scale_contrast", "state_shift", "layering", "symbolic_object", "lettering", "sequence", "likeness", "repetition", "colour_accent"],
          eventsSinceLastReview: 5,
          lastReviewedAt: null,
          history: [],
        });
      }
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    const { maybeReviewDeviceRoster } = await freshStore();

    await maybeReviewDeviceRoster();

    const written = JSON.parse(writeFileMock.mock.calls.at(-1)?.[1]);
    expect(written.eventsSinceLastReview).toBe(6);
    expect(written.activeDeviceIds).toEqual(["literal_object", "material_substitution", "negative_space", "environmental_context", "geometric_abstraction"]);
  });

  it("at threshold: aggregates real events from the events file and runs a genuine review", async () => {
    const rosterState = {
      activeDeviceIds: ["literal_object", "material_substitution", "negative_space", "environmental_context", "geometric_abstraction"],
      reserveDeviceIds: ["scale_contrast", "state_shift", "layering", "symbolic_object", "lettering", "sequence", "likeness", "repetition", "colour_accent"],
      eventsSinceLastReview: 149, // one more (this call's own increment) reaches the default threshold of 150
      lastReviewedAt: null,
      history: [],
    };
    // Build an events fixture: literal_object performs terribly (heavy
    // reasoned rejection), scale_contrast (reserve) performs excellently --
    // a genuine, data-backed swap should result.
    const events: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 20; i++) events.push({ event: "device_impression", device_id: "literal_object" });
    for (let i = 0; i < 18; i++) events.push({ event: "device_outcome", device_id: "literal_object", decision: "not_this_one", had_refinement_input: true });
    for (const id of ["material_substitution", "negative_space", "environmental_context", "geometric_abstraction"]) {
      for (let i = 0; i < 20; i++) events.push({ event: "device_impression", device_id: id });
      for (let i = 0; i < 10; i++) events.push({ event: "device_outcome", device_id: id, decision: "keep", had_refinement_input: false });
    }
    for (let i = 0; i < 20; i++) events.push({ event: "device_impression", device_id: "scale_contrast" });
    for (let i = 0; i < 19; i++) events.push({ event: "device_outcome", device_id: "scale_contrast", decision: "keep", had_refinement_input: false });

    readFileMock.mockImplementation(async (filePath: string) => {
      if (String(filePath).includes("device-roster-state")) return JSON.stringify(rosterState);
      if (String(filePath).includes("analytics-events")) return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    const { maybeReviewDeviceRoster } = await freshStore();

    await maybeReviewDeviceRoster();

    const written = JSON.parse(writeFileMock.mock.calls.at(-1)?.[1]);
    expect(written.eventsSinceLastReview).toBe(0); // reviewDeviceRoster always resets it
    expect(written.activeDeviceIds).toContain("scale_contrast");
    expect(written.activeDeviceIds).not.toContain("literal_object");
    expect(written.history).toHaveLength(1);
  });

  it("never throws, even when the underlying store write fails -- an analytics call must never surface a user-facing error from this", async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    writeFileMock.mockRejectedValueOnce(new Error("disk on fire"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { maybeReviewDeviceRoster } = await freshStore();

    await expect(maybeReviewDeviceRoster()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

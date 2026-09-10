/**
 * Device roster — the "6 artists" bandit system.
 *
 * 2026-09-09. Origin: a live-reported convergence bug (near-identical
 * candidates across unrelated stories, traced to the model over-imitating
 * this project's own worked examples) was first patched with a static,
 * hand-written DEVICE VOCABULARY list in the Association prompt. The
 * client's own framing for the real fix: rather than one person (or one
 * Claude session) guessing which visual devices are good, treat the
 * roster of devices shown to the model as something to learn from real
 * client outcomes — a small, fixed-size active roster (never one "winner"
 * — always enough live variety to keep comparing), periodically reviewed
 * against real Keep / Build upon / Not this one outcomes, with the
 * lowest performers rotated out for genuinely different devices from a
 * larger reserve pool. This is a multi-armed-bandit-style rotation, not
 * literal model training — no weights are trained anywhere in this
 * system; "training" here means this deterministic, auditable, periodic
 * roster review.
 *
 * Everything in this file is pure and deterministic — no I/O, no
 * randomness beyond what's explicitly seeded, no clock reads beyond what
 * the caller passes in. The server owns persistence (where the current
 * roster and accumulated stats actually live) and calls these functions
 * with that state; this file only ever computes the next state from the
 * current one.
 */

/** One visual technique a candidate can be built from. Never shown to the client verbatim — id/promptDescription are internal (prompt + analytics + audit trail); the client only ever sees the resulting candidate's own description/personal_meaning. */
export interface DeviceDefinition {
  id: string;
  /** Short internal name for logs/audit trail — never sent to the model or the client. */
  label: string;
  /** The instructional text that becomes part of the Association prompt when this device is in the active roster. */
  promptDescription: string;
}

/**
 * The full catalog. Deliberately more than the active roster size (see
 * DEFAULT_ROSTER_CONFIG) so there's always a genuine reserve to rotate in
 * from — a roster the same size as the catalog could never actually
 * rotate, just relabel. Adding a new device here makes it eligible to
 * enter the reserve pool on the next full-catalog reconciliation
 * (reconcileCatalogChange below) — it does not retroactively affect any
 * already-computed roster.
 */
export const DEVICE_CATALOG: DeviceDefinition[] = [
  { id: "literal_object", label: "Literal object", promptDescription: "a literal object or motif, rendered plainly" },
  {
    id: "material_substitution",
    label: "Material substitution",
    promptDescription: "one material or texture read as standing in for another (thread, wire, fabric, wood grain, water)",
  },
  {
    id: "scale_contrast",
    label: "Scale contrast",
    promptDescription: "a scale or proportion relationship (something small held within or beside something large)",
  },
  {
    id: "state_shift",
    label: "State or quality shift",
    promptDescription: "a state or quality shifting across the piece (density, weight, completeness, sharpness)",
  },
  { id: "negative_space", label: "Negative space", promptDescription: "negative space or deliberate absence carrying the meaning" },
  { id: "layering", label: "Layering", promptDescription: "overlapping or layered forms" },
  {
    id: "symbolic_object",
    label: "Symbolic object",
    promptDescription: "a real object's shape standing in for what it represents, kept concrete and specific",
  },
  {
    id: "environmental_context",
    label: "Environmental context",
    promptDescription: "a subject placed within a real setting the story actually supports",
  },
  { id: "lettering", label: "Lettering or handwriting", promptDescription: "handwriting or lettering worked directly into the mark" },
  { id: "sequence", label: "Linked sequence", promptDescription: "a small linked sequence of beats" },
  { id: "likeness", label: "Likeness or portrait", promptDescription: "a likeness or expression, where the story supports one" },
  { id: "repetition", label: "Pattern or repetition", promptDescription: "a motif repeated with deliberate variation" },
  { id: "geometric_abstraction", label: "Geometric abstraction", promptDescription: "a genuinely non-literal geometric or abstract mark" },
  {
    id: "colour_accent",
    label: "Colour accent",
    promptDescription: "one small, deliberate colour choice against an otherwise greyscale piece",
  },
];

/** A deliberately diverse starting five, not the first five in the catalog array — spans literal, material, spatial, contextual and abstract approaches so day one already has real variety to compare, not five similar devices. */
export const INITIAL_ACTIVE_DEVICE_IDS: string[] = [
  "literal_object",
  "material_substitution",
  "negative_space",
  "environmental_context",
  "geometric_abstraction",
];

export interface DeviceRosterConfig {
  /** Always exactly this many devices active at once -- "always 5 candidate styles," never converging to one winner. */
  activeRosterSize: number;
  /** Total device_outcome events accumulated (across every device) since the last review before another review triggers. */
  reviewThresholdEvents: number;
  /** A device's score is only trusted -- for staying active or for being promoted in -- once it has at least this many impressions. Below this, real variance in a handful of outcomes would look like a strong signal when it's actually noise. */
  minImpressionsPerDevice: number;
  /** At most this many devices swap per review -- gradual rotation, not wholesale replacement every time the threshold is hit. */
  maxSwapsPerReview: number;
}

export const DEFAULT_ROSTER_CONFIG: DeviceRosterConfig = {
  activeRosterSize: 5,
  reviewThresholdEvents: 150,
  minImpressionsPerDevice: 10,
  maxSwapsPerReview: 1,
};

export interface DeviceRosterSwap {
  at: string;
  swappedOut: string[];
  swappedIn: string[];
  /** Human-readable, references the actual scores/impression counts that drove the decision -- an audit trail, never invented after the fact. */
  reason: string;
}

export interface DeviceRosterState {
  activeDeviceIds: string[];
  reserveDeviceIds: string[];
  eventsSinceLastReview: number;
  lastReviewedAt: string | null;
  history: DeviceRosterSwap[];
}

/** The one place a brand-new server ever constructs a roster -- every device not in INITIAL_ACTIVE_DEVICE_IDS starts in reserve. */
export function createInitialDeviceRosterState(): DeviceRosterState {
  const activeSet = new Set(INITIAL_ACTIVE_DEVICE_IDS);
  return {
    activeDeviceIds: [...INITIAL_ACTIVE_DEVICE_IDS],
    reserveDeviceIds: DEVICE_CATALOG.map((d) => d.id).filter((id) => !activeSet.has(id)),
    eventsSinceLastReview: 0,
    lastReviewedAt: null,
    history: [],
  };
}

/** Per-device outcome counts, aggregated server-side from raw device_outcome events -- see server/src/routes/analytics.ts for the event shape these are summed from. */
export interface DevicePerformanceStats {
  deviceId: string;
  /** Every time a candidate built from this device was actually shown to a client -- not merely generated into the reserve pool and never seen. */
  impressions: number;
  keepCount: number;
  buildUponCount: number;
  /** "Not this one" with no reason typed -- a soft, low-information negative (could be "wanted to see something else" as much as "disliked this"). */
  notThisOneBlankCount: number;
  /** "Not this one" WITH a reason typed -- a deliberate, higher-information negative; weighted more heavily than a blank reroll below. */
  notThisOneWithReasonCount: number;
}

function emptyStats(deviceId: string): DevicePerformanceStats {
  return { deviceId, impressions: 0, keepCount: 0, buildUponCount: 0, notThisOneBlankCount: 0, notThisOneWithReasonCount: 0 };
}

/**
 * A single score per device, for ranking only -- never shown to the
 * client, same convention as the Association Engine's own hidden ranking
 * dimensions (§11). Null when the device doesn't yet have enough
 * impressions to trust (see minImpressionsPerDevice) -- a null score
 * excludes a device from being ranked at all, rather than defaulting it
 * to a misleadingly neutral number.
 *
 * Weighting: Keep counts double a Build-upon, since Keep is the
 * unambiguous "this device produced something I want" signal and
 * Build-upon is "close, but needed change" -- still positive, less so.
 * A reasoned rejection counts more than a blank one, since typing a
 * reason is a deliberate, informative negative rather than "show me
 * anything else." Divided by impressions so a device shown less often
 * isn't penalised or rewarded purely for sample size.
 */
export function scoreDevice(stats: DevicePerformanceStats, minImpressions: number): number | null {
  if (stats.impressions < minImpressions) return null;
  const positive = stats.keepCount * 2 + stats.buildUponCount * 1;
  const negative = stats.notThisOneBlankCount * 1 + stats.notThisOneWithReasonCount * 1.5;
  return (positive - negative) / stats.impressions;
}

/**
 * The periodic review itself. Called by the server once
 * eventsSinceLastReview >= config.reviewThresholdEvents (the server's own
 * responsibility to check and to decide when "now" is -- this function
 * takes the timestamp as an argument rather than reading a clock, so it
 * stays pure and testable). Returns the new state and, when a swap
 * happened, the audit record describing it -- null when nothing changed
 * (e.g. no eligible reserve device yet, and no active device is
 * confidently below par).
 *
 * The rotation logic, in order:
 * 1. Score every active device with enough impressions. If none has
 *    enough data yet, do nothing this review -- there's nothing to judge.
 * 2. Among reserve devices, prefer promoting one that ALREADY scores
 *    higher than the worst-scoring eligible active device -- a genuine,
 *    data-backed improvement (exploit).
 * 3. If no reserve device has enough impressions yet to be judged at all,
 *    promote the reserve device with the FEWEST impressions instead --
 *    pure exploration, giving an unsampled device its turn so the whole
 *    catalog eventually gets real data, not just whichever five started
 *    active. This is what keeps the system from settling on its initial
 *    five forever just because nothing else was ever tried.
 * 4. Swap out the worst-scoring eligible active device to make room.
 *    Never swap more than maxSwapsPerReview devices in one review, and
 *    never drop below activeRosterSize active devices.
 */
export function reviewDeviceRoster(
  current: DeviceRosterState,
  statsByDevice: Record<string, DevicePerformanceStats>,
  config: DeviceRosterConfig,
  now: string,
): { roster: DeviceRosterState; swap: DeviceRosterSwap | null } {
  const statFor = (id: string) => statsByDevice[id] ?? emptyStats(id);

  const activeScored = current.activeDeviceIds
    .map((id) => ({ id, score: scoreDevice(statFor(id), config.minImpressionsPerDevice) }))
    .filter((entry): entry is { id: string; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score);

  const resetCounter = { ...current, eventsSinceLastReview: 0, lastReviewedAt: now };

  if (activeScored.length === 0) {
    // Nothing active has enough data to judge yet -- reviewing now would
    // mean swapping blind. Reset the counter so the next review is a full
    // threshold away, not immediate, but change nothing else.
    return { roster: resetCounter, swap: null };
  }

  const reserveScored = current.reserveDeviceIds
    .map((id) => ({ id, score: scoreDevice(statFor(id), config.minImpressionsPerDevice) }))
    .filter((entry): entry is { id: string; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score);

  const worstActive = activeScored[0]!;
  let promote: { id: string; reasonNote: string } | null = null;

  if (reserveScored.length > 0 && reserveScored[0]!.score > worstActive.score) {
    const best = reserveScored[0]!;
    promote = {
      id: best.id,
      reasonNote: `scored ${best.score.toFixed(2)} over ${statFor(best.id).impressions} impressions, above the worst active device's ${worstActive.score.toFixed(2)}`,
    };
  } else {
    const unsampled = current.reserveDeviceIds
      .map((id) => statFor(id))
      .filter((s) => s.impressions < config.minImpressionsPerDevice)
      .sort((a, b) => a.impressions - b.impressions)[0];
    if (unsampled) {
      promote = { id: unsampled.deviceId, reasonNote: `has only ${unsampled.impressions} impressions -- promoted for exploration, not yet a proven performer` };
    }
  }

  if (!promote) {
    // Every reserve device already has enough data and none currently
    // beats the worst active performer -- correctly stable, not a bug.
    return { roster: resetCounter, swap: null };
  }

  const swappedOut = [worstActive.id];
  const swappedIn = [promote.id];
  const nextActive = [...current.activeDeviceIds.filter((id) => id !== worstActive.id), promote.id];
  const nextReserve = [...current.reserveDeviceIds.filter((id) => id !== promote.id), worstActive.id];

  const swap: DeviceRosterSwap = {
    at: now,
    swappedOut,
    swappedIn,
    reason: `Swapped out "${worstActive.id}" (scored ${worstActive.score.toFixed(2)} over ${statFor(worstActive.id).impressions} impressions) for "${promote.id}" (${promote.reasonNote}).`,
  };

  return {
    roster: {
      ...resetCounter,
      activeDeviceIds: nextActive,
      reserveDeviceIds: nextReserve,
      history: [...current.history, swap].slice(-50), // bounded audit trail -- see the store's own size-cap handling for the full-history case
    },
    swap,
  };
}

/**
 * Called once at server startup (or whenever the persisted roster is
 * loaded) to reconcile a persisted roster against DEVICE_CATALOG as it
 * exists in code NOW -- handles a device being added to or removed from
 * the catalog since the roster was last saved, without ever silently
 * dropping a device the roster still references or leaving a
 * newly-added device permanently unreachable.
 */
export function reconcileCatalogChange(state: DeviceRosterState): DeviceRosterState {
  const catalogIds = new Set(DEVICE_CATALOG.map((d) => d.id));
  const activeDeviceIds = state.activeDeviceIds.filter((id) => catalogIds.has(id));
  const knownIds = new Set([...activeDeviceIds, ...state.reserveDeviceIds.filter((id) => catalogIds.has(id))]);
  const newlyAdded = [...catalogIds].filter((id) => !knownIds.has(id));
  const reserveDeviceIds = [...state.reserveDeviceIds.filter((id) => catalogIds.has(id)), ...newlyAdded];

  // A device that was active got removed from the catalog entirely --
  // backfill from reserve (oldest-added first, i.e. array order) so the
  // roster never silently shrinks below activeRosterSize.
  const shortfall = state.activeDeviceIds.length - activeDeviceIds.length;
  if (shortfall > 0) {
    const backfill = reserveDeviceIds.splice(0, shortfall);
    activeDeviceIds.push(...backfill);
  }

  return { ...state, activeDeviceIds, reserveDeviceIds };
}

/** Look up a device's own prompt text by id -- the one place the Association route needs to go from a roster's ids to actual instructional text. Throws on an unknown id (a roster should never reference one) rather than silently omitting a device from the prompt. */
export function deviceById(id: string): DeviceDefinition {
  const device = DEVICE_CATALOG.find((d) => d.id === id);
  if (!device) throw new Error(`Unknown device id in roster: ${id}`);
  return device;
}

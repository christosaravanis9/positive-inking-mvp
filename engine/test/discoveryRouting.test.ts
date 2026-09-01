import { describe, it, expect } from "vitest";
import {
  routeAfterDiscovery,
  classifyClarificationResponse,
  shouldEnterLowConfidencePath,
} from "../src/discoveryRouting.js";

describe("routeAfterDiscovery (§9.3)", () => {
  it("high confidence proceeds without clarification", () => {
    expect(routeAfterDiscovery(0.7, 0.0, false)).toBe("proceed");
    expect(routeAfterDiscovery(0.95, 0.95, false)).toBe("proceed");
  });

  it("mid confidence proceeds and widens the theme set, never clarifies", () => {
    expect(routeAfterDiscovery(0.4, 0.0, false)).toBe("proceed_widen_themes");
    expect(routeAfterDiscovery(0.69, 0.1, false)).toBe("proceed_widen_themes");
  });

  it("low meaning confidence with high visual confidence routes to attraction, never clarifies (AC 6)", () => {
    expect(routeAfterDiscovery(0.1, 0.6, false)).toBe("route_to_attraction");
    expect(routeAfterDiscovery(0.0, 0.99, false)).toBe("route_to_attraction");
  });

  it("low confidence on both axes clarifies -- but only once", () => {
    expect(routeAfterDiscovery(0.1, 0.1, false)).toBe("clarify");
    expect(routeAfterDiscovery(0.1, 0.1, true)).toBe("low_confidence_path");
  });

  it("can never return clarify once the budget is used, regardless of how low confidence drops (AC 3)", () => {
    expect(routeAfterDiscovery(0.0, 0.0, true)).not.toBe("clarify");
  });
});

describe("classifyClarificationResponse (§9.5)", () => {
  it("classifies a resolving response", () => {
    expect(
      classifyClarificationResponse({ recomputedConfidence: 0.5, userDeclined: false, addressesAskedDimension: true }),
    ).toBe("resolving");
  });

  it("classifies a non-resolving response", () => {
    expect(
      classifyClarificationResponse({ recomputedConfidence: 0.2, userDeclined: false, addressesAskedDimension: true }),
    ).toBe("non_resolving");
  });

  it("classifies an explicit skip as skipped, regardless of confidence", () => {
    expect(
      classifyClarificationResponse({ recomputedConfidence: 0.9, userDeclined: true, addressesAskedDimension: true }),
    ).toBe("skipped");
  });

  it("classifies an off-topic response without re-asking", () => {
    expect(
      classifyClarificationResponse({ recomputedConfidence: 0.9, userDeclined: false, addressesAskedDimension: false }),
    ).toBe("off_topic");
  });
});

describe("shouldEnterLowConfidencePath", () => {
  it("only a resolving response avoids the correction interaction", () => {
    expect(shouldEnterLowConfidencePath("resolving")).toBe(false);
    expect(shouldEnterLowConfidencePath("non_resolving")).toBe(true);
    expect(shouldEnterLowConfidencePath("skipped")).toBe(true);
    expect(shouldEnterLowConfidencePath("off_topic")).toBe(true);
  });
});

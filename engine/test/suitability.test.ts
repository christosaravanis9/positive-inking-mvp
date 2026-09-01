import { describe, it, expect } from "vitest";
import { lightweightSuitabilityCheck } from "../src/suitability.js";

describe("lightweightSuitabilityCheck (§13.5)", () => {
  it("returns null (no blocking issue) within the size ceiling", () => {
    expect(lightweightSuitabilityCheck("small", 2)).toBeNull();
    expect(lightweightSuitabilityCheck("sleeve_or_panel", 50)).toBeNull();
  });

  it("flags a blocking contradiction beyond the size ceiling", () => {
    const result = lightweightSuitabilityCheck("small", 5);
    expect(result?.blocking).toBe(true);
  });

  it('offers "leave it to the artist" only when creative control is artist-led or surrendered (§13.2)', () => {
    const collaborative = lightweightSuitabilityCheck("small", 5, "collaborative");
    expect(collaborative?.resolutions).not.toContain("Leave the resolution to the artist");

    const artistLed = lightweightSuitabilityCheck("small", 5, "artist_led");
    expect(artistLed?.resolutions).toContain("Leave the resolution to the artist");
  });
});

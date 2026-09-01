import { describe, it, expect } from "vitest";
import { createEmptyProjectState, type ProjectState } from "@positive-inking/engine";
import { buildConfirmedProjectSummary } from "./blueprintSummary";

/**
 * Regression coverage for the Athena Blueprint incident: the summary sent to
 * the Blueprint Writer previously interpolated raw stored enum values
 * directly (e.g. "realism graphic", "client_led"), which is what produced
 * "Graphic realism style" and the "client-led ... collaborative"
 * contradiction -- the model was shown bare adjacent tokens with no
 * indication of which one names a dimension and which names one of several
 * alternative values for it, or what the creative-control token means.
 */

function projectFixture(overrides: Partial<ProjectState>): ProjectState {
  return { ...createEmptyProjectState("test-project", "2026-01-01T00:00:00.000Z"), ...overrides };
}

describe("buildConfirmedProjectSummary", () => {
  it("D: never sends a bare 'realism graphic' pair -- always a labelled 'Realism: Graphic'", () => {
    const summary = buildConfirmedProjectSummary(projectFixture({ realism_level: "graphic" }), []);
    expect(summary).toContain("Realism: Graphic");
    expect(summary).not.toMatch(/realism graphic\b/i);
  });

  it("D: never sends the bare client_led token -- names the term and its plain-English meaning together", () => {
    const summary = buildConfirmedProjectSummary(projectFixture({ creative_control: "client_led" }), []);
    expect(summary).toContain("client-led");
    expect(summary).not.toMatch(/\bclient_led\b/);
    // The plain-English meaning travels alongside the term, not as a bare token
    // the model has to interpret unaided.
    expect(summary).toMatch(/Creative control: client-led \(.+\)/);
  });

  it("no raw snake_case enum token leaks into the summary for any artistic dimension", () => {
    const summary = buildConfirmedProjectSummary(
      projectFixture({
        colour_strategy: "black_and_grey",
        realism_level: "illustrative",
        visual_presence: "clearly_present",
        linework_weight: "structured",
        shading_method: "smooth_greywash",
        contrast_level: "balanced",
      }),
      [],
    );
    expect(summary).not.toMatch(/black_and_grey|clearly_present|smooth_greywash/);
  });
});

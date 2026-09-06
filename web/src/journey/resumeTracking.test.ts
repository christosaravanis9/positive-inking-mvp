import { describe, it, expect } from "vitest";
import { createInitialJourneyState } from "./state";
import { screenOrdinal, snapshotProgressFlags, resumableFlagKey } from "./resumeTracking";

describe("resumeTracking", () => {
  it("screenOrdinal orders screens the same way SCREEN_IDS does, welcome first", () => {
    expect(screenOrdinal("welcome")).toBe(0);
    expect(screenOrdinal("viewpoint")).toBeGreaterThan(screenOrdinal("welcome"));
    expect(screenOrdinal("elements_discovery")).toBeGreaterThan(screenOrdinal("story"));
  });

  it("snapshotProgressFlags pulls exactly the progress-gating flags, nothing else", () => {
    const { ui } = createInitialJourneyState();
    const snapshot = snapshotProgressFlags({ ...ui, elementsDiscovered: true });
    expect(snapshot.elementsDiscovered).toBe(true);
    expect("associationCandidates" in snapshot).toBe(false);
    expect("blueprint" in snapshot).toBe(false);
  });

  describe("resumableFlagKey", () => {
    function furthestUi() {
      const { ui } = createInitialJourneyState();
      const withProgress = { ...ui, pastWelcome: true, viewpointSelected: true, imageDescribed: true, provenanceCaptured: true, elementsDiscovered: true, creativeControlSet: true };
      return { ...withProgress, furthestScreenReached: "creative_control" as const, furthestScreenFlags: snapshotProgressFlags(withProgress) };
    }

    it("returns null when there is no snapshot yet", () => {
      const { ui } = createInitialJourneyState();
      expect(resumableFlagKey(ui, "welcome")).toBeNull();
    });

    it("returns null when the current screen has already reached (or passed) the furthest one", () => {
      const ui = furthestUi();
      expect(resumableFlagKey(ui, "creative_control")).toBeNull();
    });

    it("returns the one diverged flag after backing up exactly one step", () => {
      const ui = { ...furthestUi(), elementsDiscovered: false };
      expect(resumableFlagKey(ui, "elements_discovery")).toBe("elementsDiscovered");
    });

    it("returns null when more than one flag has diverged", () => {
      const ui = { ...furthestUi(), elementsDiscovered: false, creativeControlSet: false };
      expect(resumableFlagKey(ui, "elements_discovery")).toBeNull();
    });

    it("returns null when the one diverged flag went the opposite direction of a backward step (live true, snapshot false)", () => {
      const base = furthestUi();
      // Exactly one flag diverges (elementsDiscovered), but live=true/snapshot=false
      // is backward from what an actual "went back one step" click ever produces
      // (that always leaves the live value false against a snapshot of true) --
      // must never be treated as something to restore.
      const ui = { ...base, furthestScreenFlags: { ...base.furthestScreenFlags!, elementsDiscovered: false } };
      expect(resumableFlagKey(ui, "elements_discovery")).toBeNull();
    });
  });
});

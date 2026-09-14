import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { ReadinessComponent } from "@positive-inking/engine";
import { ReadinessMeter } from "./ReadinessMeter";
import { readinessComponentLight } from "../journey/readinessComponentLabels";

/**
 * 2026-09-14, live-requested: "a visual indicator... more like a traffic
 * light system, maybe a meter." Additive alongside the existing detailed
 * Readiness status list (BlueprintView.tsx, DesignConfirmation.tsx), never
 * a replacement for it -- these tests cover the traffic-light mapping
 * itself and that the meter renders one dot per component with the right
 * colour class.
 */

function component(id: ReadinessComponent["id"], status: ReadinessComponent["status"]): ReadinessComponent {
  return { id, status, detail: [], nextSteps: [] };
}

describe("readinessComponentLight (traffic-light mapping)", () => {
  it("maps every genuinely resolved status to green", () => {
    for (const status of ["confirmed", "clear", "not_required", "ready", "not_yet_begun_brief_ready"] as const) {
      expect(readinessComponentLight(component("meaning", status)), status).toBe("green");
    }
  });

  it("maps every open-but-not-blocking status to amber", () => {
    for (const status of ["open_decisions", "available"] as const) {
      expect(readinessComponentLight(component("visual_direction", status)), status).toBe("amber");
    }
  });

  it("maps every genuinely blocking status to red", () => {
    for (const status of ["not_yet_captured", "still_needed", "not_yet_begun_pending_items"] as const) {
      expect(readinessComponentLight(component("references", status)), status).toBe("red");
    }
  });
});

describe("ReadinessMeter", () => {
  it("renders exactly one dot per component, in order", () => {
    const components = [
      component("meaning", "confirmed"),
      component("visual_direction", "open_decisions"),
      component("references", "still_needed"),
      component("artist_discussion", "ready"),
      component("final_artwork", "not_yet_begun_pending_items"),
    ];
    const { container } = render(<ReadinessMeter components={components} />);
    const dots = container.querySelectorAll(".readiness-meter-dot");
    expect(dots).toHaveLength(5);
    expect(dots[0]!.className).toContain("readiness-meter-dot-green");
    expect(dots[1]!.className).toContain("readiness-meter-dot-amber");
    expect(dots[2]!.className).toContain("readiness-meter-dot-red");
    expect(dots[3]!.className).toContain("readiness-meter-dot-green");
    expect(dots[4]!.className).toContain("readiness-meter-dot-red");
  });

  it("shows a correct 'X of N ready' count, counting only the green ones", () => {
    const components = [
      component("meaning", "confirmed"), // green
      component("visual_direction", "open_decisions"), // amber
      component("references", "still_needed"), // red
      component("artist_discussion", "ready"), // green
    ];
    const { getByText } = render(<ReadinessMeter components={components} />);
    getByText("2 of 4 ready");
  });

  it("handles the pre-Blueprint 4-component case (Screen 13, readiness: null) correctly -- no final_artwork dot, count still accurate", () => {
    const components = [
      component("meaning", "not_yet_captured"),
      component("visual_direction", "clear"),
      component("references", "not_required"),
      component("artist_discussion", "not_yet_captured"),
    ];
    const { container, getByText } = render(<ReadinessMeter components={components} />);
    expect(container.querySelectorAll(".readiness-meter-dot")).toHaveLength(4);
    getByText("2 of 4 ready");
  });

  it("all-green renders 'N of N ready', not a misleading fraction", () => {
    const components = [component("meaning", "confirmed"), component("artist_discussion", "ready")];
    const { getByText } = render(<ReadinessMeter components={components} />);
    getByText("2 of 2 ready");
  });

  it("each dot's title attribute names its own component and status, for anyone hovering/inspecting", () => {
    const { container } = render(<ReadinessMeter components={[component("meaning", "confirmed")]} />);
    const dot = container.querySelector(".readiness-meter-dot")!;
    expect(dot.getAttribute("title")).toBe("Meaning: Confirmed");
  });
});

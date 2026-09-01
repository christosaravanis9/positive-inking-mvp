import { describe, it, expect } from "vitest";
import { evaluateArtisticDimensions, isRecommendation, type ArtisticDimensionContext } from "../src/artisticDimensions.js";
import { computeQuestionBudget } from "../src/budget.js";

function baseContext(overrides: Partial<ArtisticDimensionContext> = {}): ArtisticDimensionContext {
  return {
    has_colour_signal: true,
    colour_signal_ambiguous: false,
    primary_is_likeness_place_or_animal: false,
    size_class: "small",
    concept_shape: "paired_elements",
    design_density: "",
    low_visibility_placement: false,
    has_exact_fidelity_element: false,
    user_is_tattoo_literate: false,
    advanced_controls_opened: false,
    creative_control: "collaborative",
    text_led_interpretive_or_open_fidelity: false,
    style_under_specified: false,
    style_resolves: [],
    style_reference: "",
    already_answered: {},
    priorBudgetSpent: 0,
    budget: computeQuestionBudget({ creative_control: "collaborative", user_is_tattoo_literate: false, literacy_bonus_eligible: false }),
    ...overrides,
  };
}

describe("evaluateArtisticDimensions (§12.8)", () => {
  it("asks colour first when there is no colour signal, stopping the pass there", () => {
    const result = evaluateArtisticDimensions(baseContext({ has_colour_signal: false }));
    expect(result.nextToAsk).toBe("colour");
    expect(result.dimensions[0]).toMatchObject({ key: "colour", status: "asked" });
    expect(result.dimensions.slice(1).every((d) => d.status === "pending")).toBe(true);
  });

  it("defaults colour to black_and_grey and moves on when a clear colour signal exists", () => {
    const result = evaluateArtisticDimensions(baseContext({ has_colour_signal: true, colour_signal_ambiguous: false }));
    expect(result.dimensions[0]).toMatchObject({ key: "colour", status: "skipped_defaulted", value: "black_and_grey" });
  });

  it("visual presence does not factor into the realism trigger (AC 29)", () => {
    // Large scale, but nothing likeness/place/animal -> realism must default, not be asked, regardless of size.
    const result = evaluateArtisticDimensions(
      baseContext({ has_colour_signal: true, size_class: "sleeve_or_panel", primary_is_likeness_place_or_animal: false }),
    );
    const realism = result.dimensions.find((d) => d.key === "realism")!;
    expect(realism.status).toBe("skipped_defaulted");
    expect(realism.value).toBe("illustrative");
  });

  it("shading defaults to minimal when realism resolves to graphic, smooth_greywash otherwise", () => {
    // Force realism to be skip-defaulted at "illustrative" (not likeness/place/animal), then shading should
    // trigger on realism=illustrative and, if beyond budget, default to smooth_greywash.
    const tightBudget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    const result = evaluateArtisticDimensions(
      baseContext({
        has_colour_signal: true,
        creative_control: "surrendered",
        budget: tightBudget,
        already_answered: { colour: "full" },
      }),
    );
    const shading = result.dimensions.find((d) => d.key === "shading")!;
    expect(shading.status).toBe("skipped_defaulted");
    expect(shading.value).toBe("smooth_greywash");
  });

  it("surrendered creative control asks colour only; every other dimension defaults (AC 10)", () => {
    const budget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    const result = evaluateArtisticDimensions(
      baseContext({
        has_colour_signal: false, // colour is triggered
        creative_control: "surrendered",
        budget,
      }),
    );
    const asked = result.dimensions.filter((d) => d.status === "asked" || d.status === "exempt_asked");
    expect(asked.map((d) => d.key)).toEqual(["colour"]);
  });

  it("text_led with interpretive fidelity suppresses surface_detail and rendering_references", () => {
    const result = evaluateArtisticDimensions(
      baseContext({
        concept_shape: "text_led",
        has_colour_signal: true,
        already_answered: { colour: "black_and_grey", realism: "illustrative", visual_presence: "clearly_present", linework: "structured", shading: "smooth_greywash", contrast: "balanced" },
        text_led_interpretive_or_open_fidelity: true,
      }),
    );
    const surfaceDetail = result.dimensions.find((d) => d.key === "surface_detail")!;
    const renderingRefs = result.dimensions.find((d) => d.key === "rendering_references")!;
    expect(surfaceDetail.status).toBe("skipped_defaulted");
    expect(renderingRefs.status).toBe("skipped_defaulted");
  });

  it("exact-fidelity text is excluded from the text_led suppression (surface_detail/rendering_references can still trigger)", () => {
    const result = evaluateArtisticDimensions(
      baseContext({
        concept_shape: "text_led",
        has_colour_signal: true,
        has_exact_fidelity_element: true,
        text_led_interpretive_or_open_fidelity: false, // exact fidelity -> suppression flag is false
        already_answered: {
          colour: "black_and_grey",
          realism: "illustrative",
          visual_presence: "clearly_present",
          linework: "structured",
          shading: "smooth_greywash",
          contrast: "balanced",
          // surface_detail is also triggered by has_exact_fidelity_element and would
          // otherwise consume this pass first (it precedes rendering_references in
          // priority order) — pre-answer it to isolate rendering_references below.
          surface_detail: "highly_textured",
        },
      }),
    );
    const renderingRefs = result.dimensions.find((d) => d.key === "rendering_references")!;
    // Triggered via has_exact_fidelity_element and NOT suppressed -> exempt_asked, regardless of budget/control.
    expect(renderingRefs.status).toBe("exempt_asked");
  });

  it("rendering_references exempt-asked even under surrendered control and exhausted budget, when tied to exact fidelity (AC 40/41-style exactness exemption)", () => {
    const budget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    const result = evaluateArtisticDimensions(
      baseContext({
        creative_control: "surrendered",
        budget,
        has_colour_signal: true,
        has_exact_fidelity_element: true,
        priorBudgetSpent: 1, // budget already exhausted (surrendered ceiling is 1)
        already_answered: { colour: "black_and_grey", realism: "illustrative", visual_presence: "clearly_present", linework: "structured", shading: "smooth_greywash", contrast: "balanced", surface_detail: "moderate" },
      }),
    );
    const renderingRefs = result.dimensions.find((d) => d.key === "rendering_references")!;
    expect(renderingRefs.status).toBe("exempt_asked");
    expect(result.budgetSpent).toBe(1); // exemption never counted against the budget
  });

  it("a dimension resolved by a named style reference is never asked", () => {
    const result = evaluateArtisticDimensions(
      baseContext({
        style_resolves: ["realism", "linework", "surface_detail"],
        style_reference: "Japanese woodblock print",
        // colour must resolve (default) this same pass so the walk reaches
        // realism at all -- otherwise colour itself would stop the pass first.
        has_colour_signal: true,
      }),
    );
    const realism = result.dimensions.find((d) => d.key === "realism")!;
    expect(realism.status).toBe("resolved_by_style");
  });

  it("budget exhaustion defaults remaining triggered dimensions and labels them recommendations, never confirmed (AC 8/31/63)", () => {
    const budget = computeQuestionBudget({ creative_control: "surrendered", user_is_tattoo_literate: false, literacy_bonus_eligible: false });
    const result = evaluateArtisticDimensions(
      baseContext({
        creative_control: "surrendered",
        budget,
        has_colour_signal: true, // colour not triggered, so budget stays untouched
        primary_is_likeness_place_or_animal: true, // triggers realism, but surrendered suppresses everything but colour
        already_answered: {},
      }),
    );
    const realism = result.dimensions.find((d) => d.key === "realism")!;
    expect(isRecommendation(realism.status)).toBe(true);
    expect(realism.status).not.toBe("confirmed");
  });

  it("§12.11: opening advanced controls triggers edge_treatment even for a non-literate user, and it stays defaulted while closed", () => {
    const answeredUpTo = {
      colour: "black_and_grey",
      realism: "illustrative",
      visual_presence: "clearly_present",
      linework: "structured",
      shading: "smooth_greywash",
      contrast: "balanced",
      surface_detail: "moderate",
    };
    const closed = evaluateArtisticDimensions(
      baseContext({ has_colour_signal: true, user_is_tattoo_literate: false, advanced_controls_opened: false, already_answered: answeredUpTo }),
    );
    expect(closed.dimensions.find((d) => d.key === "edge_treatment")!.status).toBe("skipped_defaulted");

    const opened = evaluateArtisticDimensions(
      baseContext({ has_colour_signal: true, user_is_tattoo_literate: false, advanced_controls_opened: true, already_answered: answeredUpTo }),
    );
    expect(opened.dimensions.find((d) => d.key === "edge_treatment")!.status).toBe("asked");
  });

  it("confirmed values from a prior pass are carried forward and never re-asked", () => {
    const result = evaluateArtisticDimensions(baseContext({ already_answered: { colour: "selective" } }));
    const colour = result.dimensions.find((d) => d.key === "colour")!;
    expect(colour).toMatchObject({ status: "confirmed", value: "selective" });
  });
});

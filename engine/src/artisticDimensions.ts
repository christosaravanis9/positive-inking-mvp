/**
 * §12.8 — artistic dimension materiality. Evaluated in priority order;
 * budget spends top-down so the most consequential decisions are always
 * asked first. This module makes one deliberate reading of an underspecified
 * corner of the spec, called out below at RENDERING_REFERENCES_EXEMPTION.
 */

import type { ConceptShape, CreativeControl, SizeClass, ArtisticDimensionKey } from "./types.js";
import type { QuestionBudget } from "./budget.js";

export const ARTISTIC_DIMENSION_PRIORITY: ArtisticDimensionKey[] = [
  "colour",
  "realism",
  "visual_presence",
  "linework",
  "shading",
  "contrast",
  "surface_detail",
  "edge_treatment",
  "rendering_references",
];

const REALISM_VALUES = ["graphic", "illustrative", "realistic"] as const;
type RealismValue = (typeof REALISM_VALUES)[number];

export const ARTISTIC_DIMENSION_DEFAULTS: Record<Exclude<ArtisticDimensionKey, "shading">, string> = {
  colour: "black_and_grey",
  realism: "illustrative",
  visual_presence: "clearly_present",
  linework: "structured",
  contrast: "balanced",
  surface_detail: "moderate",
  edge_treatment: "not_specified_left_to_artist",
  rendering_references: "not_specified",
};

function defaultShading(resolvedRealism: string | undefined): string {
  return resolvedRealism === "graphic" ? "minimal" : "smooth_greywash";
}

function defaultFor(key: ArtisticDimensionKey, resolvedRealism: string | undefined): string {
  if (key === "shading") return defaultShading(resolvedRealism);
  return ARTISTIC_DIMENSION_DEFAULTS[key];
}

export interface ArtisticDimensionContext {
  has_colour_signal: boolean;
  colour_signal_ambiguous: boolean;
  /** Likeness, place, or animal is the primary element (§12.8 priority 2). */
  primary_is_likeness_place_or_animal: boolean;
  size_class: SizeClass;
  concept_shape: ConceptShape;
  design_density: "" | "minimal" | "balanced" | "full";
  low_visibility_placement: boolean;
  has_exact_fidelity_element: boolean;
  user_is_tattoo_literate: boolean;
  advanced_controls_opened: boolean;
  creative_control: CreativeControl;
  /**
   * true only for a text_led concept whose text fidelity is interpretive or
   * open. Exact-fidelity text must NOT set this — §12.8's suppression names
   * that exclusion explicitly.
   */
  text_led_interpretive_or_open_fidelity: boolean;
  /** A named style is under-specified (e.g. an artist whose work varies widely) and needs a visual example rather than a guess (§12.10). */
  style_under_specified: boolean;
  /** Dimensions already resolved by a named style reference (§12.10) — removed from the eligible set entirely. */
  style_resolves: ArtisticDimensionKey[];
  style_reference: string;
  /** Values already confirmed by the user in a prior pass, keyed by dimension. Drives resolution of dependent dimensions (realism -> linework/shading) without re-asking. */
  already_answered: Partial<Record<ArtisticDimensionKey, string>>;
  /** Discretionary artistic budget points already spent in prior passes of this same journey. */
  priorBudgetSpent: number;
  budget: QuestionBudget;
}

export type ArtisticDimensionStatus =
  | "asked" // eligible, within budget, not suppressed, not yet answered — this is the question to show now
  | "exempt_asked" // eligible via the exact-fidelity exemption — always asked, never budget-counted, never suppressed
  | "confirmed" // already answered by the user in a prior pass
  | "resolved_by_style" // removed from the eligible set; a named style reference already settled it
  | "skipped_defaulted" // not triggered, suppressed, or budget-exhausted — becomes a labelled recommendation, never a confirmed parameter
  | "pending"; // priority-order successor to a dimension still awaiting an answer this pass; not yet decidable

export interface ArtisticDimensionValue {
  key: ArtisticDimensionKey;
  status: ArtisticDimensionStatus;
  /** The resolved or default value. null while status is "asked" / "exempt_asked" / "pending" (no answer exists yet). */
  value: string | null;
  reason: string;
}

export interface ArtisticDimensionsResult {
  dimensions: ArtisticDimensionValue[];
  /** The single next dimension to present to the user this pass, or null if nothing remains to ask. */
  nextToAsk: ArtisticDimensionKey | null;
  /** Cumulative discretionary artistic budget spent, including prior passes. */
  budgetSpent: number;
}

function isTriggered(
  key: ArtisticDimensionKey,
  ctx: ArtisticDimensionContext,
  resolvedRealism: string | undefined,
): boolean {
  switch (key) {
    case "colour":
      return !ctx.has_colour_signal || ctx.colour_signal_ambiguous;
    case "realism":
      return ctx.primary_is_likeness_place_or_animal;
    case "visual_presence":
      return ctx.size_class === "medium" || ctx.size_class === "large" || ctx.size_class === "sleeve_or_panel";
    case "linework":
      return (
        ctx.concept_shape === "text_led" ||
        ctx.concept_shape === "single_emblem" ||
        resolvedRealism === "graphic"
      );
    case "shading":
      return (
        resolvedRealism === "illustrative" ||
        resolvedRealism === "realistic" ||
        ctx.design_density === "balanced" ||
        ctx.design_density === "full"
      );
    case "contrast":
      return ctx.size_class === "large" || ctx.size_class === "sleeve_or_panel" || ctx.low_visibility_placement;
    case "surface_detail":
      return resolvedRealism === "realistic" || ctx.has_exact_fidelity_element;
    case "edge_treatment":
      return ctx.user_is_tattoo_literate || ctx.advanced_controls_opened;
    case "rendering_references":
      return ctx.has_exact_fidelity_element || ctx.style_under_specified;
    default:
      return false;
  }
}

/**
 * RENDERING_REFERENCES_EXEMPTION — a deliberate reading, not a literal one.
 *
 * §12.8 says fidelity treatment and rendering references are "exempt from
 * budget and from all control-level suppression" because "surrendering
 * creative control surrenders interpretation, not accuracy." That
 * justification is specifically about exactness. rendering_references can
 * also be triggered by a second, unrelated condition — "style reference
 * under-specified" — which is a stylistic completeness question, not an
 * accuracy one. Granting the same budget/suppression immunity there would
 * let an ordinary aesthetic question dodge a surrendered user's stated
 * preference to not be asked. So the exemption here applies only when
 * has_exact_fidelity_element is the trigger; when only style ambiguity
 * triggers it, it behaves as an ordinary discretionary dimension. If real
 * usage shows this split is wrong, it is a one-line change.
 */
function isExempt(key: ArtisticDimensionKey, ctx: ArtisticDimensionContext, triggered: boolean): boolean {
  return key === "rendering_references" && triggered && ctx.has_exact_fidelity_element;
}

function isSuppressed(key: ArtisticDimensionKey, ctx: ArtisticDimensionContext): { suppressed: boolean; reason: string } {
  if ((key === "surface_detail" || key === "rendering_references") && ctx.text_led_interpretive_or_open_fidelity) {
    return {
      suppressed: true,
      reason: "text_led with interpretive/open fidelity suppresses surface detail and rendering references (§12.8).",
    };
  }
  if (ctx.creative_control === "surrendered" && key !== "colour") {
    return {
      suppressed: true,
      reason: "Surrendered creative control asks colour only; everything else defaults and is left to the artist (§12.8).",
    };
  }
  return { suppressed: false, reason: "" };
}

export function evaluateArtisticDimensions(ctx: ArtisticDimensionContext): ArtisticDimensionsResult {
  const dimensions: ArtisticDimensionValue[] = [];
  let resolvedRealism: string | undefined;
  let budgetSpent = ctx.priorBudgetSpent;
  let nextToAsk: ArtisticDimensionKey | null = null;
  let stopped = false;

  for (const key of ARTISTIC_DIMENSION_PRIORITY) {
    if (ctx.already_answered[key] !== undefined) {
      const value = ctx.already_answered[key]!;
      if (key === "realism") resolvedRealism = value;
      dimensions.push({ key, status: "confirmed", value, reason: "Confirmed by the user." });
      continue;
    }

    if (stopped) {
      dimensions.push({
        key,
        status: "pending",
        value: null,
        reason: "Not yet decidable — waiting on an earlier answer in this pass.",
      });
      continue;
    }

    if (ctx.style_resolves.includes(key)) {
      dimensions.push({
        key,
        status: "resolved_by_style",
        value: null,
        reason: `Resolved by the style reference "${ctx.style_reference}" (§12.10) — shown back once, not asked.`,
      });
      continue;
    }

    const triggered = isTriggered(key, ctx, resolvedRealism);
    const exempt = isExempt(key, ctx, triggered);

    if (!triggered) {
      const value = defaultFor(key, resolvedRealism);
      if (key === "realism") resolvedRealism = value;
      dimensions.push({ key, status: "skipped_defaulted", value, reason: "Not materially triggered for this concept (§12.8)." });
      continue;
    }

    if (exempt) {
      dimensions.push({
        key,
        status: "exempt_asked",
        value: null,
        reason: "Exact-fidelity element present — exempt from budget and control-level suppression (§12.8 exemption).",
      });
      nextToAsk = key;
      stopped = true;
      continue;
    }

    const { suppressed, reason: suppressedReason } = isSuppressed(key, ctx);
    if (suppressed) {
      const value = defaultFor(key, resolvedRealism);
      if (key === "realism") resolvedRealism = value;
      dimensions.push({ key, status: "skipped_defaulted", value, reason: suppressedReason });
      continue;
    }

    if (budgetSpent < ctx.budget.discretionary_artistic) {
      dimensions.push({ key, status: "asked", value: null, reason: "Materially relevant and within the discretionary artistic budget (§12.8)." });
      budgetSpent += 1;
      nextToAsk = key;
      stopped = true;
      continue;
    }

    const value = defaultFor(key, resolvedRealism);
    if (key === "realism") resolvedRealism = value;
    dimensions.push({ key, status: "skipped_defaulted", value, reason: "Materially relevant, but the discretionary artistic budget is exhausted." });
  }

  return { dimensions, nextToAsk, budgetSpent };
}

export function isRecommendation(status: ArtisticDimensionStatus): boolean {
  return status === "skipped_defaulted";
}

export { REALISM_VALUES };
export type { RealismValue };

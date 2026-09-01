import { z } from "zod";
import { ARTISTIC_DIMENSION_PRIORITY, type ArtisticDimensionKey } from "@positive-inking/engine";

/**
 * §12.10 — style reference resolution. The user names a style, medium,
 * artistic tradition, or artist; this call determines which fixed-vocabulary
 * artistic dimensions (§12.8) that reference confidently settles, so
 * ArtisticDirection can remove them from the eligible/discretionary set
 * without ever guessing at a value the deterministic engine could not
 * derive on its own. Genuine interpretation of free text, which is why it
 * lives here and not in engine/.
 *
 * visual_presence and rendering_references are deliberately excluded from
 * the resolvable set: visual_presence is a placement/impact choice a named
 * style doesn't settle, and rendering_references is about whether the
 * client can supply an exact-rendering image, an orthogonal question a
 * style name doesn't answer either way.
 */
export const RESOLVABLE_STYLE_DIMENSIONS = [
  "colour",
  "realism",
  "linework",
  "shading",
  "contrast",
  "surface_detail",
  "edge_treatment",
] as const satisfies readonly ArtisticDimensionKey[];

export type ResolvableStyleDimension = (typeof RESOLVABLE_STYLE_DIMENSIONS)[number];

export const DIMENSION_VALUE_VOCAB: Record<ResolvableStyleDimension, readonly string[]> = {
  colour: ["black_and_grey", "selective", "full"],
  realism: ["graphic", "illustrative", "realistic"],
  linework: ["light", "structured", "heavy"],
  shading: ["minimal", "smooth_greywash", "richly_rendered"],
  contrast: ["soft", "balanced", "dramatic"],
  surface_detail: ["simplified", "moderate", "highly_textured"],
  edge_treatment: ["left_to_artist", "crisp_clean", "soft_blended"],
};

export const STYLE_REFERENCE_SYSTEM_PROMPT = `You are the Positive Inking Style Reference Resolver.

A client has named a style, medium, artistic tradition, or artist they'd like
their tattoo to draw on. Your job is narrow: decide which of a fixed set of
artistic dimensions that reference confidently settles, and what it settles
them to. You are not designing the tattoo.

1. RECOGNITION — If the text names nothing identifiable as a style, medium,
tradition, or artist (e.g. "something cool", "not sure", a description of
subject matter instead of style), set recognized to false and resolve
nothing. Do not force a resolution onto vague input.

2. ESTABLISHED STYLES, MEDIA AND TRADITIONS resolve confidently: e.g.
woodblock/ukiyo-e print, Japanese traditional (irezumi), American
traditional, blackwork, fineline/single-needle, watercolour, linocut,
dotwork, geometric, tribal, photorealism, chicano, new school,
biomechanical, minimalist. For these, set recognized true, under_specified
false, and resolve as many of the seven allowed dimensions as the style
genuinely implies. Leave any dimension it doesn't speak to unresolved —
never fill every dimension just because you can.

3. NAMED ARTISTS are usually under-specified: an individual's body of work
often spans a wide range, so a name alone rarely fixes concrete values.
Set recognized true, under_specified true, resolve only what the artist's
work is genuinely consistent about (sometimes nothing), and explain in
leaves_open_note that a visual example would help pin down the rest.

4. ONLY the following seven dimensions may be resolved: colour, realism,
linework, shading, contrast, surface_detail, edge_treatment. Never invent a
value outside the fixed vocabulary you're given for each dimension.

5. SUMMARY — Write one short, plain-language sentence a client would
understand, naming what the reference points toward. Never use the internal
dimension keys or enum values verbatim in the summary.

6. OUTPUT — valid structured data via the resolve_style_reference tool.`;

export const styleReferenceToolInputSchema = {
  type: "object",
  properties: {
    recognized: { type: "boolean" },
    under_specified: { type: "boolean" },
    summary: { type: "string" },
    leaves_open_note: { type: "string" },
    resolved: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", enum: [...RESOLVABLE_STYLE_DIMENSIONS] },
          value: { type: "string" },
        },
        required: ["dimension", "value"],
      },
    },
  },
  required: ["recognized", "under_specified", "summary", "leaves_open_note", "resolved"],
} as const;

const rawResultSchema = z.object({
  recognized: z.boolean(),
  under_specified: z.boolean(),
  summary: z.string(),
  leaves_open_note: z.string(),
  resolved: z.array(z.object({ dimension: z.string(), value: z.string() })),
});

export interface StyleReferenceResolution {
  recognized: boolean;
  under_specified: boolean;
  summary: string;
  leaves_open_note: string;
  style_resolves: ArtisticDimensionKey[];
  style_leaves_open: ArtisticDimensionKey[];
  resolved_values: Partial<Record<ArtisticDimensionKey, string>>;
}

/**
 * Validates the model's raw output against the fixed dimension/value
 * vocabulary, silently dropping (never erroring on) anything invalid —
 * an unrecognised dimension name or an out-of-vocabulary value is treated
 * as "not resolved" rather than failing the whole request, and a dimension
 * the client already confirmed is never overridden by a style guess.
 */
export function toStyleReferenceResolution(
  raw: unknown,
  alreadyConfirmed: Partial<Record<ArtisticDimensionKey, string>>,
): StyleReferenceResolution | null {
  const parsed = rawResultSchema.safeParse(raw);
  if (!parsed.success) return null;

  const resolved_values: Partial<Record<ArtisticDimensionKey, string>> = {};
  for (const { dimension, value } of parsed.data.resolved) {
    if (!(RESOLVABLE_STYLE_DIMENSIONS as readonly string[]).includes(dimension)) continue;
    const dim = dimension as ResolvableStyleDimension;
    if (alreadyConfirmed[dim] !== undefined) continue;
    if (!DIMENSION_VALUE_VOCAB[dim].includes(value)) continue;
    resolved_values[dim] = value;
  }

  const style_resolves = Object.keys(resolved_values) as ArtisticDimensionKey[];
  const style_leaves_open = ARTISTIC_DIMENSION_PRIORITY.filter((key) => !style_resolves.includes(key));

  return {
    recognized: parsed.data.recognized,
    under_specified: parsed.data.under_specified,
    summary: parsed.data.summary,
    leaves_open_note: parsed.data.leaves_open_note,
    style_resolves,
    style_leaves_open,
    resolved_values,
  };
}

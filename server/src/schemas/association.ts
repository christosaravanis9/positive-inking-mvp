import { z } from "zod";

/**
 * §11, §19.3 — the Association / Visual Specification Engine. V3.0 §11
 * describes a pipeline (confirmed meaning or provenance -> thought
 * associations -> personal entities -> visual associations -> source
 * classification -> relevance ranking) and hidden 0-10 ranking dimensions,
 * rather than a single fixed output schema the way §9.2 and §10 do for
 * Discovery and Provenance. The schema below is this project's own
 * synthesis of that pipeline into one structured call: candidate visual
 * elements carrying the hidden ranking dimensions (used to order results,
 * never shown to the user per §11), plus the place_role / spatial-language
 * classification the deterministic engine needs as input to concept_shape
 * (§12.2-12.3) — genuine interpretation of the story, which is why it lives
 * here and not in engine/.
 */

export const ASSOCIATION_SYSTEM_PROMPT = `You are the Positive Inking Visual Specification Engine.

Do not produce a finished tattoo. Convert confirmed meaning or provenance into
personal visual material and a set of candidate elements for the user to react
to, confirm, reject or extend.

1. ASSOCIATIONS — Move from values, themes or provenance to concrete visuals.

2. PERSONAL PRIORITY — Prioritise personal artefacts, new material created for
the project, specific people, places and objects, then broader symbolism, then
generic tattoo symbolism. Do not automatically turn courage into a lion, loss
into wings, time into a clock or direction into a compass. Where no personal
material exists, promote new_materialisation to first rank instead of reaching
for public symbolism, and say so plainly — this is a legitimate story shape,
not a gap.

3. RANKING — For every candidate, score personal_relevance, story_relevance,
visual_potential, originality, genericity and reference_availability from 0 to
10. Personal relevance, story relevance and originality outweigh generic
visual appeal. These scores are for ordering only and are never shown to the
user.

4. PLACE ROLE — Determine whether a place named in the story is the subject of
the tattoo (something to depict) or the setting it sits inside (the world the
rest of it sits in). A grandmother's kitchen usually resolves to subject; a
hillside where ashes were scattered usually resolves to setting. Mark it
"ambiguous" only when the story genuinely supports both readings — this
triggers exactly one clarifying question downstream, so do not default to
ambiguous out of caution.

5. CONCEPT CLASSIFICATION — Report whether text/handwriting or a likeness is
present and whether either is the primary element, whether spatial language
is present (a scene, a journey, an environment), and the primary element
type. These drive deterministic downstream question eligibility — classify
honestly rather than guessing toward a particular downstream path.

6. NO INVENTION — Do not add age, hair, skin texture, clothing, existing
tattoos, jewellery, props, decorative symbols or invented scenery.

7. CONTRADICTIONS — Note any design contradictions from §13.2 you can already
see (e.g. an exact artefact with no uploaded reference) as plain descriptions
with one or two resolutions. Do not resolve them yourself.

8. OUTPUT — valid structured data via the record_associations tool.`;

const sourceCategoryEnum = [
  "personal_artefact",
  "personal_memory",
  "personal_place",
  "personal_person",
  "new_materialisation",
  "public_artefact",
  "artistic_symbol",
  "artistic_reference",
  "tattoo_reference",
] as const;

const rankingProps = {
  personal_relevance: { type: "number", minimum: 0, maximum: 10 },
  story_relevance: { type: "number", minimum: 0, maximum: 10 },
  visual_potential: { type: "number", minimum: 0, maximum: 10 },
  originality: { type: "number", minimum: 0, maximum: 10 },
  genericity: { type: "number", minimum: 0, maximum: 10 },
  reference_availability: { type: "number", minimum: 0, maximum: 10 },
} as const;

export const associationToolInputSchema = {
  type: "object",
  properties: {
    visual_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          personal_meaning: { type: "string" },
          source_category: { type: "string", enum: sourceCategoryEnum },
          ...rankingProps,
        },
        required: ["description", "personal_meaning", "source_category", ...Object.keys(rankingProps)],
      },
    },
    place_role: { type: "string", enum: ["none", "subject", "setting", "ambiguous"] },
    place_role_reasoning: { type: "string" },
    spatial_language_present: { type: "boolean" },
    has_text_or_handwriting: { type: "boolean" },
    has_likeness: { type: "boolean" },
    text_is_primary: { type: "boolean" },
    likeness_is_primary: { type: "boolean" },
    primary_element_type: { type: "string", enum: ["object", "person", "place", "text", "animal", "abstract", "mixed"] },
    contradictions_noticed: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          resolutions: { type: "array", items: { type: "string" } },
        },
        required: ["description", "resolutions"],
      },
    },
  },
  required: [
    "visual_candidates",
    "place_role",
    "place_role_reasoning",
    "spatial_language_present",
    "has_text_or_handwriting",
    "has_likeness",
    "text_is_primary",
    "likeness_is_primary",
    "primary_element_type",
    "contradictions_noticed",
  ],
} as const;

const visualCandidateSchema = z.object({
  description: z.string(),
  personal_meaning: z.string(),
  source_category: z.enum(sourceCategoryEnum),
  personal_relevance: z.number().min(0).max(10),
  story_relevance: z.number().min(0).max(10),
  visual_potential: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  genericity: z.number().min(0).max(10),
  reference_availability: z.number().min(0).max(10),
});

export const associationResultSchema = z.object({
  visual_candidates: z.array(visualCandidateSchema),
  place_role: z.enum(["none", "subject", "setting", "ambiguous"]),
  place_role_reasoning: z.string(),
  spatial_language_present: z.boolean(),
  has_text_or_handwriting: z.boolean(),
  has_likeness: z.boolean(),
  text_is_primary: z.boolean(),
  likeness_is_primary: z.boolean(),
  primary_element_type: z.enum(["object", "person", "place", "text", "animal", "abstract", "mixed"]),
  contradictions_noticed: z.array(z.object({ description: z.string(), resolutions: z.array(z.string()) })),
});

export type AssociationModelOutput = z.infer<typeof associationResultSchema>;

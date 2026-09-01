/**
 * §25 test protocol — the fifteen required journeys, run against the real
 * deterministic engine (not a description of what it should do).
 *
 * IMPORTANT SCOPE NOTE: this script exercises only what the engine can
 * decide without a model. §25 explicitly requires live model output for
 * interpretive accuracy, emotional proportionality, personalisation and
 * originality ("Do not report desk scores for them") — this environment has
 * no ANTHROPIC_API_KEY, so that half of the protocol is not attempted here.
 * What follows is the other half: given plausible concept classification for
 * each premise (the kind of thing a real Association Engine call would
 * return), what does the deterministic engine actually ask, skip, and
 * default? That question needs no model at all, and this script answers it
 * by calling the same functions the app calls, in the same order, walking
 * each question to a chosen answer until the engine reports nothing left to
 * ask.
 *
 * Run with: npm run journeys -w engine
 */
import {
  computeConceptSignals,
  computeQuestionBudget,
  evaluateCompositionFlow,
  evaluateArtisticDimensions,
  fidelityTreatmentRequired,
  lightweightSuitabilityCheck,
  routeAfterDiscovery,
  getCompositionOptionPool,
  type ConceptSignals,
  type CreativeControl,
  type SizeClass,
  type PlaceRole,
  type CompositionQuestionKey,
  type ArtisticDimensionKey,
} from "../src/index.js";

interface JourneyInput {
  name: string;
  premise: string;
  element_count: number;
  place_role: PlaceRole;
  spatial_language_present: boolean;
  has_text_or_handwriting: boolean;
  has_likeness: boolean;
  text_is_primary: boolean;
  likeness_is_primary: boolean;
  primary_element_type: ConceptSignals["primary_element_type"];
  has_exact_fidelity_element: boolean;
  has_colour_signal: boolean;
  size_class: SizeClass;
  connects_to_other_work: boolean;
  creative_control: CreativeControl;
  user_is_tattoo_literate: boolean;
  literacyBonusEligible: boolean;
  meaningConfidence?: number;
  visualConfidence?: number;
  clarificationAlreadyUsed?: boolean;
  internalBackgroundChoice?: "none" | "subtle" | "immersive";
  notes: string[];
}

const JOURNEYS: JourneyInput[] = [
  {
    name: "1. Meaning-rich, imagery-poor",
    premise:
      "A long, detailed story about becoming a father, with no concrete visual idea offered at all.",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "abstract",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.85,
    visualConfidence: 0.15,
    notes: ["High meaning confidence -> proceed, no clarification, regardless of low visual confidence (§9.3)."],
  },
  {
    name: "2. Imagery-rich, meaning-poor",
    premise: "\"I want a wolf howling at a moon, black and grey, forearm.\" No stated reason.",
    element_count: 2,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "animal",
    has_exact_fidelity_element: false,
    has_colour_signal: true,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.2,
    visualConfidence: 0.9,
    notes: ["Low meaning confidence but high visual confidence -> route_to_attraction, never clarify (AC 6)."],
  },
  {
    name: "3. Artist-led trust project",
    premise: "\"I trust you completely with the meaning I've given you -- interpret it.\"",
    element_count: 2,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "artist_led",
    user_is_tattoo_literate: false,
    literacyBonusEligible: false,
    meaningConfidence: 0.8,
    visualConfidence: 0.4,
    notes: [],
  },
  {
    name: "4. Exact personal artefact",
    premise: "A grandfather's actual signature, reproduced exactly, from a scanned letter.",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: true,
    has_likeness: false,
    text_is_primary: true,
    likeness_is_primary: false,
    primary_element_type: "text",
    has_exact_fidelity_element: true,
    has_colour_signal: false,
    size_class: "small",
    connects_to_other_work: false,
    creative_control: "surrendered",
    user_is_tattoo_literate: false,
    literacyBonusEligible: false,
    meaningConfidence: 0.75,
    visualConfidence: 0.9,
    notes: [
      "creative_control=surrendered, but fidelity_treatment must still be asked (§12.8 exemption, AC 40).",
      "text_led + exact fidelity -> the text_led suppression on surface_detail/rendering_references must NOT apply (AC 39).",
    ],
  },
  {
    name: "5. Large immersive piece",
    premise: "A half-sleeve: a ship sailing through a storm, three supporting elements, immersive scene.",
    element_count: 4,
    place_role: "setting",
    spatial_language_present: true,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "mixed",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "sleeve_or_panel",
    connects_to_other_work: true,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.7,
    visualConfidence: 0.7,
    internalBackgroundChoice: "immersive",
    notes: ["place_role=setting + spatial language -> narrative_scene shape (§12.3); large scale should trigger the immersion/negative-space/contrast questions (§12.5, §12.8)."],
  },
  {
    name: "6. Small, high-detail contradiction",
    premise: "A tiny wrist piece with five distinct elements and photorealistic detail requested.",
    element_count: 5,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "mixed",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "small",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.6,
    visualConfidence: 0.6,
    notes: ["Expect the §13.5 lightweight suitability pass to flag a blocking contradiction (5 elements at 'small' exceeds this build's placeholder ceiling of 2)."],
  },
  {
    name: "7. Attraction-led, no stated meaning",
    premise: "\"I've just always liked koi fish. No particular reason.\"",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "animal",
    has_exact_fidelity_element: false,
    has_colour_signal: true,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: false,
    notes: ["Attraction mode -- provenance capture only, no Discovery call at all. Why/What-matters/Statement omitted from the eventual Blueprint (§17.2)."],
  },
  {
    name: "8. Future-facing identity",
    premise: "\"I'm becoming someone new after a big career change. I want to mark the start of that.\"",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "abstract",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.65,
    visualConfidence: 0.2,
    notes: ["Mid meaning confidence -> proceed_widen_themes (7 themes instead of 5-7 default), never clarify (§9.3 row 2). Floor rule (§3.2) likely promotes new_materialisation since no personal artefact is named."],
  },
  {
    name: "9. Memorial without melodrama",
    premise: "\"My mum passed last year. Something quiet, not dramatic.\"",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "small",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    meaningConfidence: 0.75,
    visualConfidence: 0.3,
    notes: ["Tone rule (§20): grounded language proportional to the user's tone -- this is a model-quality check, not assessable here (no live key)."],
  },
  {
    name: "10. Expert, tattoo-literate user",
    premise: "\"I know exactly what I want: bold traditional linework, selective red, no background.\" Skips discovery.",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: true,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: true,
    literacyBonusEligible: false,
    internalBackgroundChoice: "none",
    notes: ["Expert mode: literacy bonus must NOT apply (they skipped discovery, asked for less, not more -- §12.4). AC 11: should reach element capture within two screens."],
  },
  {
    name: "11. Explicit no background",
    premise: "A single lighthouse, isolated, no background, on the calf.",
    element_count: 1,
    place_role: "subject",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    internalBackgroundChoice: "none",
    notes: ["Place role 'subject' (not setting) despite being a place -- must derive single_emblem, not narrative_scene (§12.3 note)."],
  },
  {
    name: "12. New concept after visual suggestions",
    premise: "Started with one element; a visual suggestion prompts a second, unrelated idea to be added.",
    element_count: 2,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "mixed",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    notes: [
      "This scenario is really about §14's recomputation rules (element_count crossing 1->2 re-opens density if it was previously skipped) -- see engine/test/newIdea.test.ts for the isolated unit coverage; the Screen 7 UI does not yet call this path for a *later* addition (Phase 4 checkpoint gap).",
    ],
  },
  {
    name: "13. All suggested avoidances rejected",
    premise: "User selects 'Nothing specifically' for every avoidance prompt.",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "small",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    notes: ["Deterministic part: avoid_list_status must record 'asked_declined', distinct from 'not_asked' (§17.5, AC 34) -- verified structurally, not simulated numerically here."],
  },
  {
    name: "14. Custom artistic direction outside offered choices",
    premise: "User picks 'Something else' at every composition prompt and types a custom answer.",
    element_count: 2,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "medium",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: true,
    notes: ["'Something else' is a fixed pool member (composition.ts SOMETHING_ELSE_OPTION) accepted as a normal answer value -- the engine does not distinguish it from any other chosen label; free text capture is a UI concern."],
  },
  {
    name: "15. Simple project, advanced questions skipped",
    premise: "A small olive branch on the ankle, collaborative control -- the Build Brief's named simple case.",
    element_count: 1,
    place_role: "none",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    has_exact_fidelity_element: false,
    has_colour_signal: false,
    size_class: "small",
    connects_to_other_work: false,
    creative_control: "collaborative",
    user_is_tattoo_literate: false,
    literacyBonusEligible: false,
    internalBackgroundChoice: "none",
    notes: ["Build Brief §8: 'should produce about four questions total. If it inflates, the eligibility tables are wrong.' This is the single most load-bearing check in the whole protocol."],
  },
];

function pickCompositionAnswer(key: CompositionQuestionKey, journey: JourneyInput, shape: ConceptSignals["concept_shape"]): string {
  if (key === "place_disambiguation") return "subject";
  if (key === "composition_type") return getCompositionOptionPool(shape)[0]!.label;
  if (key === "internal_background") return journey.internalBackgroundChoice ?? "none";
  if (key === "density") return "balanced";
  if (key === "negative_space") return "generous_negative_space";
  if (key === "reading_direction") return "left_to_right";
  if (key === "containment_vs_wrap") return "contained";
  return "natural";
}

function pickArtisticAnswer(key: ArtisticDimensionKey): string {
  const defaults: Record<ArtisticDimensionKey, string> = {
    colour: "selective",
    realism: "illustrative",
    visual_presence: "clearly_present",
    linework: "structured",
    shading: "smooth_greywash",
    contrast: "balanced",
    surface_detail: "moderate",
    edge_treatment: "left_to_artist",
    rendering_references: "will_provide",
  };
  return defaults[key];
}

function runJourney(journey: JourneyInput) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(journey.name);
  console.log(journey.premise);
  console.log("-".repeat(70));

  const signals = computeConceptSignals({
    element_count: journey.element_count,
    primary_element_type: journey.primary_element_type,
    has_text_or_handwriting: journey.has_text_or_handwriting,
    has_likeness: journey.has_likeness,
    place_role: journey.place_role,
    has_exact_fidelity_element: journey.has_exact_fidelity_element,
    has_colour_signal: journey.has_colour_signal,
    size_class: journey.size_class,
    spatial_language_present: journey.spatial_language_present,
    connects_to_other_work: journey.connects_to_other_work,
    creative_control: journey.creative_control,
    user_is_tattoo_literate: journey.user_is_tattoo_literate,
    text_is_primary: journey.text_is_primary,
    likeness_is_primary: journey.likeness_is_primary,
  });
  console.log(`concept_shape: ${signals.concept_shape}  |  place_role: ${signals.place_role}  |  size_class: ${signals.size_class}`);

  if (journey.meaningConfidence !== undefined && journey.visualConfidence !== undefined) {
    const route = routeAfterDiscovery(journey.meaningConfidence, journey.visualConfidence, journey.clarificationAlreadyUsed ?? false);
    console.log(`Discovery routing: confidence=${journey.meaningConfidence} visual=${journey.visualConfidence} -> ${route}`);
  }

  const suitability = lightweightSuitabilityCheck(journey.size_class, journey.element_count, journey.creative_control);
  if (suitability) {
    console.log(`Screen 9 lightweight suitability: BLOCKING -- ${suitability.reason} Resolutions: ${suitability.resolutions.join(" / ")}`);
  }

  const budget = computeQuestionBudget({
    creative_control: journey.creative_control,
    user_is_tattoo_literate: journey.user_is_tattoo_literate,
    literacy_bonus_eligible: journey.literacyBonusEligible,
  });
  console.log(`Budget: composition=${budget.discretionary_composition} artistic=${budget.discretionary_artistic} advanced=${budget.advanced_controls}`);

  // Walk the composition flow to completion.
  let compositionAnswered: Partial<Record<CompositionQuestionKey, string>> = {};
  let compositionSpent = 0;
  let placeRole = journey.place_role;
  let compositionBackground: "none" | "subtle" | "immersive" | "undecided" = "undecided";
  const compositionLog: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const flow = evaluateCompositionFlow({
      concept_shape: signals.concept_shape,
      place_role: placeRole,
      element_count: journey.element_count,
      size_class: journey.size_class,
      connects_to_other_work: journey.connects_to_other_work,
      has_text_or_handwriting: journey.has_text_or_handwriting,
      composition_background: compositionBackground,
      already_answered: compositionAnswered,
      priorBudgetSpent: compositionSpent,
      budget,
    });
    compositionSpent = flow.budgetSpent;
    if (!flow.nextToAsk) break;
    const key = flow.nextToAsk;
    const answer = pickCompositionAnswer(key, journey, signals.concept_shape);
    compositionAnswered = { ...compositionAnswered, [key]: answer };
    if (key === "place_disambiguation") placeRole = answer as PlaceRole;
    if (key === "internal_background") compositionBackground = answer as typeof compositionBackground;
    const q = flow.questions.find((x) => x.key === key)!;
    compositionLog.push(`  [${q.mandatory ? "mandatory" : "discretionary"}] ${key} -> "${answer}"`);
  }
  console.log(`Composition questions asked (${compositionLog.length}):`);
  compositionLog.forEach((l) => console.log(l));
  console.log(`Composition discretionary budget spent: ${compositionSpent}/${budget.discretionary_composition}`);

  // Fidelity treatment (§12.9) -- separate from the artistic dimension walk, exempt from budget/suppression.
  if (journey.has_exact_fidelity_element) {
    const required = fidelityTreatmentRequired(true, journey.has_text_or_handwriting ? "handwriting" : "other");
    console.log(`Fidelity treatment required: ${required} (asked regardless of creative_control=${journey.creative_control})`);
  }

  // Walk the artistic dimension flow to completion.
  let artisticAnswered: Partial<Record<ArtisticDimensionKey, string>> = {};
  let artisticSpent = 0;
  const artisticLog: string[] = [];
  const skippedRecommendations: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const result = evaluateArtisticDimensions({
      has_colour_signal: journey.has_colour_signal,
      colour_signal_ambiguous: false,
      primary_is_likeness_place_or_animal: journey.has_likeness || journey.place_role === "subject" || journey.primary_element_type === "animal",
      size_class: journey.size_class,
      concept_shape: signals.concept_shape,
      design_density: (compositionAnswered.density as "" | "minimal" | "balanced" | "full") ?? "",
      low_visibility_placement: false,
      has_exact_fidelity_element: journey.has_exact_fidelity_element,
      user_is_tattoo_literate: journey.user_is_tattoo_literate,
      advanced_controls_opened: journey.user_is_tattoo_literate,
      creative_control: journey.creative_control,
      text_led_interpretive_or_open_fidelity: signals.concept_shape === "text_led" && !journey.has_exact_fidelity_element,
      style_under_specified: false,
      style_resolves: [],
      style_reference: "",
      already_answered: artisticAnswered,
      priorBudgetSpent: artisticSpent,
      budget,
    });
    artisticSpent = result.budgetSpent;
    if (i === 0) {
      for (const d of result.dimensions) {
        if (d.status === "skipped_defaulted") skippedRecommendations.push(`${d.key}=${d.value} (${d.reason})`);
      }
    }
    if (!result.nextToAsk) break;
    const key = result.nextToAsk;
    const answer = pickArtisticAnswer(key);
    artisticAnswered = { ...artisticAnswered, [key]: answer };
    const d = result.dimensions.find((x) => x.key === key)!;
    artisticLog.push(`  [${d.status}] ${key} -> "${answer}"`);
  }
  console.log(`Artistic questions asked (${artisticLog.length}):`);
  artisticLog.forEach((l) => console.log(l));
  console.log(`Artistic discretionary budget spent: ${artisticSpent}/${budget.discretionary_artistic}`);
  console.log(`Dimensions skipped and defaulted to a recommendation (${skippedRecommendations.length}):`);
  skippedRecommendations.forEach((s) => console.log(`  - ${s}`));

  const totalAsked = compositionLog.length + artisticLog.length + (journey.has_exact_fidelity_element ? 1 : 0);
  console.log(`\nTOTAL questions asked this journey (composition + artistic + fidelity): ${totalAsked}`);

  if (journey.notes.length > 0) {
    console.log("\nNotes:");
    journey.notes.forEach((n) => console.log(`  * ${n}`));
  }
}

console.log("Positive Inking -- §25 test journeys, deterministic engine trace");
console.log("NOT ASSESSED: interpretive accuracy, emotional proportionality, personalisation,");
console.log("originality (§25 requires live model output for these -- none available here).\n");

for (const journey of JOURNEYS) {
  runJourney(journey);
}

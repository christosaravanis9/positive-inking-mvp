import http from "node:http";

/**
 * A minimal, controllable double for the Anthropic Messages API. Used only
 * by test-integration scripts, never in normal dev/prod --
 * server/src/env.ts's ANTHROPIC_API_URL override exists specifically so an
 * integration test can point the REAL server at this instead of the real
 * endpoint, without touching any application code path.
 *
 * Delay and failure are controlled per-request by embedding a marker in the
 * story text itself (the userMessage the real server forwards verbatim),
 * so each request's behaviour is self-contained -- no separate control
 * channel or shared mutable state between requests.
 *
 * Returns a schema-valid fixture shaped to whichever tool was actually
 * requested (tool_choice.name), not just Discovery's -- needed so a real
 * browser journey can get past Screen 7 (record_associations) and reach
 * the Blueprint route (write_blueprint), not just the Story screen.
 */
const port = Number(process.argv[2] || 0);

function discoveryInput(rawStoryText) {
  const cleanText = rawStoryText.replace(/__TEST_[A-Z_0-9]+__/g, "").trim();
  // __TEST_THIN__/__TEST_NOT_THIN__ control the new meaning-depth judgement
  // the same way __TEST_DELAY_N__/__TEST_FAIL__ already control latency/
  // failure -- a marker embedded in the story text itself, stripped from
  // every displayed field by the regex above. This fake double cannot
  // reproduce the real model's actual judgement of a story's meaning depth
  // (there is no ANTHROPIC_API_KEY in this sandbox to check that against);
  // it only proves the app correctly branches on whichever value the
  // Discovery response carries -- see docs/PROJECT_STATUS.md's open
  // decisions for the real-model verification this still needs.
  const meaningIsThin = rawStoryText.includes("__TEST_THIN__");
  return {
    primary_viewpoint: "past",
    secondary_viewpoints: [],
    primary_intention: "memorial",
    secondary_intentions: [],
    deep_why: "test",
    key_themes: ["family"],
    candidate_core_values: ["connection"],
    personal_people: [],
    personal_places: [],
    personal_objects: [],
    personal_events: [],
    personal_memories: [],
    personal_phrases: [],
    open_threads: [],
    interpretation: `Response for: ${cleanText}`,
    // Echoes the RAW story text (delay/failure markers included, unlike
    // every other field here) so a downstream Association call fed from
    // this field can still be delay-controlled by the same
    // __TEST_DELAY_N__ marker convention -- see
    // localValidationJourney.mjs's mid-Association-request checks.
    statement_of_intention: `Test statement of intention: ${rawStoryText}`,
    clarification_required: false,
    clarification_reason: null,
    clarification_question: null,
    suggested_answers: [],
    confidence: 0.8,
    visual_confidence: 0.8,
    meaning_is_thin: meaningIsThin,
    depth_prompt: meaningIsThin ? "Is there one moment this is really about?" : null,
    depth_prompt_suggestions: meaningIsThin ? ["a person", "a place", "a change", "a promise", "a loss"] : [],
  };
}

function provenanceInput(rawStoryText) {
  const cleanText = rawStoryText.replace(/__TEST_[A-Z_0-9]+__/g, "").trim();
  return {
    attraction_origin: `Test-fixture origin for: ${cleanText}`,
    origin_period: "adulthood",
    origin_source: "media",
    personal_entities: [],
    significance_claimed: false,
    provenance_confidence: 0.8,
    reentry_candidate: { surfaced: false, subject: "" },
  };
}

function associationInput(text = "") {
  // "Build upon"'s direct-edit refinement (2026-09-07, later) posts a
  // distinct "the client wants to develop... further" instruction carrying
  // the client's own edit verbatim (see server/src/routes/association.ts)
  // -- branching on it here, and echoing the edit back with a visible
  // marker, lets a real browser journey clearly see the refined result is
  // genuinely built from what the client typed, not a generic alternative.
  const refineMatch = text.match(/The client's own edit or addition to it: "([^"]*)"/);
  if (refineMatch) {
    const edit = refineMatch[1];
    return {
      visual_candidates: [
        {
          description: `${edit}, refined: cleaner lines, more deliberate composition`,
          personal_meaning: "developed further from the client's own edit, not a fresh alternative",
          source_category: "personal_artefact",
          resolution_state: "concrete",
          personal_relevance: 8,
          story_relevance: 8,
          visual_potential: 7,
          originality: 7,
          genericity: 2,
          reference_availability: 4,
        },
      ],
      place_role: "none",
      place_role_reasoning: "No place named in the story.",
      spatial_language_present: false,
      has_text_or_handwriting: false,
      has_likeness: false,
      text_is_primary: false,
      likeness_is_primary: false,
      primary_element_type: "object",
      contradictions_noticed: [],
    };
  }
  // Screen 7's Why-driven per-slot re-roll (2026-09-07) posts a distinct
  // "propose exactly one fresh alternative" instruction (see
  // server/src/routes/association.ts) -- branching on it here lets a real
  // browser journey see a genuinely new candidate appear after a re-roll,
  // instead of the same fixture candidate it already rejected.
  if (text.includes("Propose exactly one fresh alternative")) {
    return {
      visual_candidates: [
        {
          description: "a hand-forged nail from the workshop",
          personal_meaning: "a small, deliberately-made object standing in for the same care",
          source_category: "personal_artefact",
          resolution_state: "concrete",
          personal_relevance: 7,
          story_relevance: 7,
          visual_potential: 6,
          originality: 6,
          genericity: 3,
          reference_availability: 4,
        },
      ],
      place_role: "none",
      place_role_reasoning: "No place named in the story.",
      spatial_language_present: false,
      has_text_or_handwriting: false,
      has_likeness: false,
      text_is_primary: false,
      likeness_is_primary: false,
      primary_element_type: "object",
      contradictions_noticed: [],
    };
  }
  return {
    visual_candidates: [
      // Mode A -- literal object (existing, unchanged by the three-mode expansion).
      {
        description: "a specific object tied to a shared memory",
        personal_meaning: "a tangible marker of the relationship",
        source_category: "personal_artefact",
        resolution_state: "needs_client_specific_detail",
        follow_up_prompt: "What object carries the most memory for you?",
        personal_relevance: 9,
        story_relevance: 8,
        visual_potential: 6,
        originality: 4,
        genericity: 6,
        reference_availability: 3,
      },
      // Mode B -- pure abstraction, deliberately not tied to a literal object
      // (existing, unchanged; rule 8 still requires the idea itself be real).
      {
        description: "a new mark made by overlapping the outlines of both your initials",
        personal_meaning: "a custom mark made specifically for this project",
        source_category: "new_materialisation",
        resolution_state: "concrete",
        personal_relevance: 8,
        story_relevance: 8,
        visual_potential: 7,
        originality: 8,
        genericity: 2,
        reference_availability: 5,
      },
      // Mode C -- illustrative sequence (the 2026-09-06 expansion this fixture now
      // covers): one candidate, one description naming a cohesive small sequence,
      // each part concrete on its own -- the exact worked example from rule 8 itself
      // (rule 9's plain-register rewrite, 2026-09-07, later still).
      {
        description:
          "Three small linked panels, no border between them: a figure at a fork in the path. A hand resting on a compass. The figure walking on alone, the path now faded behind them.",
        personal_meaning: "Imagine each panel a little softer than the last, fading toward the third — echoing how sure the choice feels the further you walk from it.",
        source_category: "new_materialisation",
        resolution_state: "concrete",
        personal_relevance: 9,
        story_relevance: 9,
        visual_potential: 8,
        originality: 9,
        genericity: 2,
        reference_availability: 2,
      },
      // Filler material so ranking always fills the default top 5 (existing,
      // unchanged in shape by the 2026-09-07 redesign). Rewritten to rule 9's
      // plain register (2026-09-07, later still) -- the exact before/after
      // pattern from that rule, on-story for a dog named Scout instead of a
      // generic keepsake.
      {
        description: "A drawing you made of Scout as a kid, kept exactly as you drew it — not cleaned up, not neater.",
        personal_meaning: "This is the actual drawing, not a symbol standing in for the memory.",
        source_category: "personal_artefact",
        resolution_state: "concrete",
        personal_relevance: 6,
        story_relevance: 6,
        visual_potential: 5,
        originality: 4,
        genericity: 5,
        reference_availability: 5,
      },
      {
        description: "a simple line drawing of a house",
        personal_meaning: "the place the memory actually happened",
        source_category: "personal_artefact",
        resolution_state: "concrete",
        personal_relevance: 5,
        story_relevance: 6,
        visual_potential: 5,
        originality: 4,
        genericity: 5,
        reference_availability: 5,
      },
      // Reserve material (2026-09-07, per-candidate re-roll; count raised
      // 2026-09-08 to match the Association prompt's own rule 1 -- "9 to 12
      // total," scaled for 5 visible slots not 3, after a live report that
      // only the first couple of "not this one" clicks anywhere on the
      // screen actually worked, regardless of which slot). Scored lower on
      // personal/story relevance and originality than the five above, so
      // rankVisualCandidates always places these beyond
      // VISIBLE_CANDIDATE_COUNT -- this is what lets a live journey
      // actually exercise a blank ("Not this one", no reason given)
      // re-roll pulling from the free reserve pool, on every visible slot,
      // not just the first two or three.
      {
        description: "a small linework paw print, rendered simply",
        personal_meaning: "a straightforward nod to the bond with your dog",
        source_category: "public_artefact",
        resolution_state: "concrete",
        personal_relevance: 3,
        story_relevance: 3,
        visual_potential: 5,
        originality: 3,
        genericity: 7,
        reference_availability: 6,
      },
      {
        description: "a folded paper crane resting in an open palm",
        personal_meaning: "something given and something received, held gently",
        source_category: "artistic_symbol",
        resolution_state: "concrete",
        personal_relevance: 2,
        story_relevance: 2,
        visual_potential: 6,
        originality: 4,
        genericity: 6,
        reference_availability: 6,
      },
      {
        description: "a leash coiled into a loose spiral",
        personal_meaning: "the shape of every walk you took together",
        source_category: "personal_artefact",
        resolution_state: "concrete",
        personal_relevance: 4,
        story_relevance: 4,
        visual_potential: 5,
        originality: 3,
        genericity: 6,
        reference_availability: 5,
      },
      {
        description: "a single dog bone, worn smooth at one end",
        personal_meaning: "a small, well-used thing, not a symbol standing in for it",
        source_category: "personal_artefact",
        resolution_state: "concrete",
        personal_relevance: 3,
        story_relevance: 3,
        visual_potential: 4,
        originality: 3,
        genericity: 7,
        reference_availability: 6,
      },
      {
        description: "a food bowl, empty, seen from directly above",
        personal_meaning: "the shape of what's missing now, not the dog itself",
        source_category: "new_materialisation",
        resolution_state: "concrete",
        personal_relevance: 3,
        story_relevance: 3,
        visual_potential: 5,
        originality: 5,
        genericity: 5,
        reference_availability: 4,
      },
      {
        description: "a single ear, upright, mid-alert",
        personal_meaning: "one small piece of him, not the whole picture",
        source_category: "personal_artefact",
        resolution_state: "concrete",
        personal_relevance: 3,
        story_relevance: 2,
        visual_potential: 5,
        originality: 4,
        genericity: 5,
        reference_availability: 5,
      },
      {
        description: "a gate left slightly open",
        personal_meaning: "not sad, just always a little bit waiting for him",
        source_category: "new_materialisation",
        resolution_state: "concrete",
        personal_relevance: 2,
        story_relevance: 2,
        visual_potential: 5,
        originality: 5,
        genericity: 5,
        reference_availability: 4,
      },
    ],
    place_role: "none",
    place_role_reasoning: "No place named in the story.",
    spatial_language_present: false,
    has_text_or_handwriting: false,
    has_likeness: false,
    text_is_primary: false,
    likeness_is_primary: false,
    primary_element_type: "object",
    contradictions_noticed: [],
  };
}

function avoidanceInput() {
  return {
    suggestions: [
      "Bright, saturated colour",
      "Photorealistic rendering",
      "A large, statement-piece scale",
      "Ornate decorative borders",
      "Bold, heavy blackwork linework",
    ],
  };
}

function styleReferenceInput() {
  return {
    recognized: false,
    under_specified: false,
    summary: "No identifiable style, medium, tradition, or artist named.",
    leaves_open_note: "Nothing resolved -- every artistic dimension stays open to ask.",
    resolved: [],
  };
}

/**
 * Blueprint Writer prose, in the plain register the WORDING rule targets
 * (server/src/schemas/blueprint.ts) and with the repetition-fix structure:
 * visual_direction is the one place the two candidate concepts get stated
 * in full; story/why and artist_brief reference them only briefly, never
 * re-narrating the design from scratch. Live-test evidence (2026-09-08)
 * found the same core concept described in near-full detail four separate
 * times (Sections 1, 3, 4, 11) and elaborate connective prose ("the piece
 * is meant to read clearly at a glance, not as a faint or subtle mark",
 * "Composition: confirmed as interlocking — the chosen concept... rather
 * than sit as separate isolated elements") -- this fixture is the AFTER
 * state for both, since this sandbox has no real ANTHROPIC_API_KEY to
 * verify actual model compliance with the new prompt (same limitation
 * noted for the Association WORDING fix). What real browser verification
 * *can* confirm: the document renders correctly, with no rendering
 * regression, in the register/structure the prompt now asks for.
 */
function blueprintInput() {
  return {
    story: "This tattoo honours years spent with a childhood dog named Scout.",
    why_this_image: "",
    why: "To carry a daily reminder of that companionship.",
    what_matters_most: "Loyalty and companionship.",
    visual_direction:
      "Two ideas: a dog-silhouette emblem in clean, structured linework, no background. Or the client's own childhood drawing of Scout, kept exactly as drawn -- not cleaned up, not restyled. The composition is interlocking: the elements should visually connect and overlap, not sit apart.",
    artistic_direction: "The piece should read clearly at a glance. Keep it bold, not faint. Black and grey. Illustrative style. Structured linework. Smooth greywash shading.",
    placement: "Forearm, medium scale, contained composition.",
    design_considerations: ["Keep linework structured enough to hold up at this scale."],
    statement_of_inspiration: "A quiet daily reminder of being greeted and loved.",
    artist_brief: {
      intro: "This is a client-led project.",
      confirmed_priorities: [
        "See the design above for the two candidate concepts.",
        "Whichever concept is finalised: black and grey, no background, medium forearm placement.",
      ],
      open_decisions: [],
      avoid: [],
      closing_notes: "",
    },
    readiness: "blueprint_ready",
  };
}

const FIXTURES_BY_TOOL = {
  record_discovery: (text) => discoveryInput(text),
  record_provenance: (text) => provenanceInput(text),
  record_associations: (text) => associationInput(text),
  suggest_avoidances: () => avoidanceInput(),
  resolve_style_reference: () => styleReferenceInput(),
  write_blueprint: () => blueprintInput(),
};

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(404);
    res.end();
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let requestBody;
    try {
      requestBody = JSON.parse(raw);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    const content = String(requestBody.messages?.[0]?.content ?? "");
    const delayMatch = content.match(/__TEST_DELAY_(\d+)__/);
    const delayMs = delayMatch ? Number(delayMatch[1]) : 0;
    const shouldFail = content.includes("__TEST_FAIL__");
    const toolName = requestBody.tool_choice?.name ?? "record_discovery";
    const buildInput = FIXTURES_BY_TOOL[toolName] ?? FIXTURES_BY_TOOL.record_discovery;

    // Note: deliberately does NOT listen for req's "close" event to cancel
    // this timer -- that event fires as soon as the request body has been
    // fully read in some Node/keep-alive configurations, well before the
    // response is sent, which would silently cancel every delayed response
    // before it ever went out (found the hard way: it hung every curl/test
    // request that used a non-zero delay). res.writableEnded below is a
    // sufficient guard against writing to an already-finished response.
    setTimeout(() => {
      if (res.writableEnded) return;
      if (shouldFail) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "simulated upstream failure" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          content: [{ type: "tool_use", name: toolName, input: buildInput(content) }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      );
    }, delayMs);
  });
});

server.listen(port, "127.0.0.1", () => {
  const actualPort = server.address().port;
  // Single line of machine-readable output the orchestrator waits on.
  console.log(`FAKE_ANTHROPIC_LISTENING ${actualPort}`);
});

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

function associationInput() {
  return {
    visual_candidates: [
      {
        description: "a small hand-drawn motif built from the client's own handwriting",
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

function blueprintInput() {
  return {
    story: "A tattoo to remember a childhood dog named Scout.",
    why_this_image: "",
    why: "To carry a small daily reminder of that companionship.",
    what_matters_most: "Loyalty and companionship.",
    visual_direction: "A single emblem, isolated, no background, minimal density.",
    artistic_direction: "Black and grey. Illustrative style. Clearly present. Structured linework. Smooth greywash shading. Balanced contrast.",
    placement: "Forearm, medium scale, contained composition.",
    design_considerations: ["Keep linework structured enough to hold up at this scale."],
    statement_of_inspiration: "A quiet daily reminder of being greeted and loved.",
    artist_brief: "Client-led project. Core brief: a single dog-silhouette emblem, black and grey, no background, medium forearm placement.",
    readiness: "blueprint_ready",
  };
}

const FIXTURES_BY_TOOL = {
  record_discovery: (text) => discoveryInput(text),
  record_provenance: (text) => provenanceInput(text),
  record_associations: () => associationInput(),
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

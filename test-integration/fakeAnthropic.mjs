import http from "node:http";

/**
 * A minimal, controllable double for the Anthropic Messages API. Used only
 * by test-integration/asyncStateRace.mjs, never in normal dev/prod --
 * server/src/env.ts's ANTHROPIC_API_URL override exists specifically so an
 * integration test can point the REAL server at this instead of the real
 * endpoint, without touching any application code path.
 *
 * Delay and failure are controlled per-request by embedding a marker in the
 * story text itself (the userMessage the real server forwards verbatim),
 * so each request's behaviour is self-contained -- no separate control
 * channel or shared mutable state between requests.
 */
const port = Number(process.argv[2] || 0);

function discoveryInput(storyText) {
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
    interpretation: `Response for: ${storyText}`,
    statement_of_intention: "Test statement of intention.",
    clarification_required: false,
    clarification_reason: null,
    clarification_question: null,
    suggested_answers: [],
    confidence: 0.8,
    visual_confidence: 0.8,
  };
}

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
    const cleanText = content.replace(/__TEST_[A-Z_0-9]+__/g, "").trim();
    const toolName = requestBody.tool_choice?.name ?? "record_discovery";

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
          content: [{ type: "tool_use", name: toolName, input: discoveryInput(cleanText) }],
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

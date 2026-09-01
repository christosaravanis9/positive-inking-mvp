/**
 * Real-API latency diagnostics -- the direct answer to "is 20s/30s/45s/90s
 * the right budget", measured instead of guessed. Run via `npm run
 * diagnose-model` (standalone) or as part of `npm run validate:local`
 * (server/scripts/diagnostics.ts is spawned as a child process and its
 * stdout parsed for `DIAGNOSTIC_*` lines).
 *
 * Calls the real Anthropic endpoint for Discovery, Association, and
 * Blueprint using small, non-sensitive fixture inputs -- never a real
 * user's story or prompt content, and this script never prints the fixture
 * text itself, only its length. Each call uses DIAGNOSTIC_TIMEOUT_MS
 * (default 120000), not the route's normal production budget
 * (env.modelTimeouts[stage]) -- the point is to observe real completion
 * time, not to reproduce the production timeout.
 *
 * Every result line is prefixed `DIAGNOSTIC_RESULT ` followed by one JSON
 * object, so a parent process can parse it reliably regardless of what
 * else gets printed to stdout (matching the `FAKE_ANTHROPIC_LISTENING`
 * single-line-of-machine-readable-output convention already used by
 * test-integration/fakeAnthropic.mjs).
 */
import { callModelForStructuredOutput } from "../src/modelClient.js";
import { env, isModelConfigured } from "../src/env.js";
import { DISCOVERY_SYSTEM_PROMPT, discoveryToolInputSchema } from "../src/schemas/discovery.js";
import { ASSOCIATION_SYSTEM_PROMPT, associationToolInputSchema } from "../src/schemas/association.js";
import { BLUEPRINT_SYSTEM_PROMPT, blueprintToolInputSchema } from "../src/schemas/blueprint.js";
import type { ModelRoute } from "@positive-inking/engine";

const DIAGNOSTIC_TIMEOUT_MS = Number(process.env.DIAGNOSTIC_TIMEOUT_MS ?? 120000);

// Small, generic, non-sensitive fixtures -- never printed verbatim, only their length.
const FIXTURE_STORY =
  "A tattoo to remember a childhood dog named Scout, who used to wait by the door every day after school. " +
  "He passed away two years ago. I keep a photo of him on the windowsill.";

const FIXTURE_CONFIRMED_MEANING =
  "A memorial piece for a childhood dog, Scout, who greeted the client at the door every day after school. " +
  "The client wants to carry that daily ritual of being greeted and loved forward.";

const FIXTURE_BLUEPRINT_SUMMARY = [
  "Story/why: A tattoo to remember a childhood dog named Scout.",
  "Themes: Loyalty, companionship, everyday love",
  "Elements: A dog silhouette resembling Scout waiting by a door (primary, interpretive)",
  "Composition: single emblem, background: none, density: minimal",
  "Artistic direction: Colour: Black and grey, Realism: Illustrative, Visual presence: Clearly present, Linework: Structured, Shading: Smooth greywash, Contrast: Balanced",
  "Placement: forearm, medium, contained, seen from the side",
  "Creative control: client-led (You're directing this closely)",
  "Avoid: none listed",
].join("\n");

interface DiagnosticSpec {
  stage: ModelRoute;
  system: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}

const SPECS: DiagnosticSpec[] = [
  {
    stage: "discovery",
    system: DISCOVERY_SYSTEM_PROMPT,
    userMessage: `Story:\n${FIXTURE_STORY}`,
    toolName: "record_discovery",
    toolDescription: "Record the structured Discovery analysis of the user's tattoo story.",
    inputSchema: discoveryToolInputSchema,
  },
  {
    stage: "association",
    system: ASSOCIATION_SYSTEM_PROMPT,
    userMessage: `Confirmed meaning or provenance:\n${FIXTURE_CONFIRMED_MEANING}\n\nNo personal material has surfaced yet in this story.`,
    toolName: "record_associations",
    toolDescription: "Record candidate visual associations and concept classification.",
    inputSchema: associationToolInputSchema,
    maxTokens: 4096,
  },
  {
    stage: "blueprint",
    system: BLUEPRINT_SYSTEM_PROMPT,
    userMessage: `Journey mode: full\n\nConfirmed project summary:\n${FIXTURE_BLUEPRINT_SUMMARY}`,
    toolName: "write_blueprint",
    toolDescription: "Write the structured Positive Inking Blueprint content.",
    inputSchema: blueprintToolInputSchema,
    maxTokens: 4096,
  },
];

interface UsageLike {
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function runOne(spec: DiagnosticSpec): Promise<void> {
  const start = Date.now();
  const productionBudgetMs = env.modelTimeouts[spec.stage];
  const base = {
    stage: spec.stage,
    model: env.anthropicModel,
    productionBudgetMs,
    diagnosticTimeoutMs: DIAGNOSTIC_TIMEOUT_MS,
    maxTokens: spec.maxTokens ?? 2048,
    inputChars: spec.userMessage.length,
  };

  try {
    const result = await callModelForStructuredOutput({
      stage: spec.stage,
      system: spec.system,
      userMessage: spec.userMessage,
      tool: { name: spec.toolName, description: spec.toolDescription, input_schema: spec.inputSchema },
      maxTokens: spec.maxTokens,
      timeoutMs: DIAGNOSTIC_TIMEOUT_MS,
    });
    const elapsedMs = Date.now() - start;
    const usage = (result.raw as UsageLike)?.usage ?? {};
    console.log(
      "DIAGNOSTIC_RESULT " +
        JSON.stringify({
          ...base,
          elapsedMs,
          outcome: "success",
          inputTokens: usage.input_tokens ?? null,
          outputTokens: usage.output_tokens ?? null,
        }),
    );
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const code = (err as { code?: string }).code ?? "unknown_error";
    console.log(
      "DIAGNOSTIC_RESULT " +
        JSON.stringify({ ...base, elapsedMs, outcome: code, inputTokens: null, outputTokens: null }),
    );
  }
}

async function main(): Promise<void> {
  console.log("DIAGNOSTIC_MODEL " + JSON.stringify({ model: env.anthropicModel }));

  if (!isModelConfigured()) {
    console.log("DIAGNOSTIC_BLOCKED " + JSON.stringify({ reason: "model_not_configured" }));
    return;
  }

  // Sequential, not parallel: real latency per stage, uncontaminated by
  // concurrent-request contention, and it mirrors how a real journey
  // actually calls these one at a time.
  for (const spec of SPECS) {
    await runOne(spec);
  }
}

main().catch((err) => {
  console.error("DIAGNOSTIC_FATAL", err);
  process.exitCode = 1;
});

/**
 * Manual, one-shot verification of the real model round trip.
 *
 * Run with `npm run verify-model` from the repo root (or `-w server`).
 * Requires ANTHROPIC_API_KEY in server/.env. Prints the parsed, validated
 * structured response to the terminal. This is the check the Build Brief
 * requires before any intake UI gets built: one round trip, one parsed JSON
 * response, printed and inspected.
 */
import { callModelForStructuredOutput } from "../src/modelClient.js";
import { DISCOVERY_SYSTEM_PROMPT, discoveryResultSchema, discoveryToolInputSchema } from "../src/schemas/discovery.js";
import { isModelConfigured } from "../src/env.js";

const SAMPLE_STORY =
  "I want something for my grandmother. She used to keep an olive tree in a pot on her kitchen windowsill in Athens, " +
  "and she'd tell me it was older than she was. She passed away last year. I keep thinking about that tree.";

async function main() {
  console.log("Positive Inking — model round-trip verification\n");

  if (!isModelConfigured()) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to server/.env and add a real key, then re-run this script.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Sending sample story to the Discovery Engine...\n");
  console.log(`"${SAMPLE_STORY}"\n`);

  try {
    const result = await callModelForStructuredOutput({
      system: DISCOVERY_SYSTEM_PROMPT,
      userMessage: `Story:\n${SAMPLE_STORY}`,
      tool: {
        name: "record_discovery",
        description: "Record the structured Discovery analysis of the user's tattoo story.",
        input_schema: discoveryToolInputSchema,
      },
    });

    const validated = discoveryResultSchema.parse(result.data);
    console.log("Round trip succeeded. Validated structured response:\n");
    console.log(JSON.stringify(validated, null, 2));
  } catch (err) {
    console.error("Round trip FAILED:\n");
    console.error(err);
    process.exitCode = 1;
  }
}

main();

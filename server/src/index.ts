import { env, isModelConfigured } from "./env.js";
import { createApp } from "./app.js";

// Installed as early as possible, before anything else can throw. A crash
// here must be loud in the terminal, not a silently dead process — see
// Build Brief §6, "Console showed only 'Script error.'"
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", reason);
});

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Positive Inking server listening on http://localhost:${env.port}`);
  // eslint-disable-next-line no-console
  console.log(`Model configured: ${isModelConfigured() ? "yes" : "NO — set ANTHROPIC_API_KEY in server/.env"}`);
});

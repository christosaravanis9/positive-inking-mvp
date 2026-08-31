import express from "express";
import cors from "cors";
import { env, isModelConfigured } from "./env.js";
import { discoveryRouter } from "./routes/discovery.js";

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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, modelConfigured: isModelConfigured() });
});

app.use(discoveryRouter);

// Express error middleware — catches anything a route handler throws
// synchronously or forwards via next(err), and always returns a visible,
// specific JSON error rather than a silent 500 with no body.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[express error]", err);
  res.status(500).json({
    error: { code: "internal_error", message: err instanceof Error ? err.message : "Unknown server error" },
  });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Positive Inking server listening on http://localhost:${env.port}`);
  // eslint-disable-next-line no-console
  console.log(`Model configured: ${isModelConfigured() ? "yes" : "NO — set ANTHROPIC_API_KEY in server/.env"}`);
});

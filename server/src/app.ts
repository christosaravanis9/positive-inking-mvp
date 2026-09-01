import express from "express";
import cors from "cors";
import { isModelConfigured } from "./env.js";
import { discoveryRouter } from "./routes/discovery.js";
import { provenanceRouter } from "./routes/provenance.js";
import { associationRouter } from "./routes/association.js";
import { blueprintRouter } from "./routes/blueprint.js";
import { avoidanceRouter } from "./routes/avoidance.js";
import { styleReferenceRouter } from "./routes/styleReference.js";

/** Separated from index.ts's `app.listen` so tests can exercise the app without binding a port. */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, modelConfigured: isModelConfigured() });
  });

  app.use(discoveryRouter);
  app.use(provenanceRouter);
  app.use(associationRouter);
  app.use(blueprintRouter);
  app.use(avoidanceRouter);
  app.use(styleReferenceRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("[express error]", err);
    res.status(500).json({
      error: { code: "internal_error", message: err instanceof Error ? err.message : "Unknown server error" },
    });
  });

  return app;
}

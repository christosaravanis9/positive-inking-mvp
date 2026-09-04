import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { isModelConfigured } from "./env.js";
import { discoveryRouter } from "./routes/discovery.js";
import { provenanceRouter } from "./routes/provenance.js";
import { associationRouter } from "./routes/association.js";
import { blueprintRouter } from "./routes/blueprint.js";
import { avoidanceRouter } from "./routes/avoidance.js";
import { styleReferenceRouter } from "./routes/styleReference.js";
import { analyticsRouter } from "./routes/analytics.js";

/**
 * web/'s production build output (index.html, the static AEO pages, and
 * hashed JS/CSS assets) -- resolved relative to this file (not
 * process.cwd()) so it's found regardless of where the server process is
 * started from, the same convention analyticsStore.ts already uses. In
 * local dev this directory doesn't exist (Vite serves the frontend
 * directly on its own port instead) -- every use of it below is guarded
 * with existsSync so that's a no-op, not a crash.
 */
const WEB_DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist");
const WEB_INDEX_HTML = path.join(WEB_DIST_DIR, "index.html");

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
  app.use(analyticsRouter);

  // Production static serving: in dev this is a same-origin proxy target
  // (Vite serves the frontend itself, see web/vite.config.ts's server.proxy),
  // but in production there is no separate frontend process -- Render runs
  // only this server, so it has to serve web/dist itself. express.static
  // matches real files directly (the hashed JS/CSS bundle, and the AEO pages
  // methodology.html/faq.html/privacy.html/robots.txt/sitemap.xml/llms.txt
  // published earlier); the catch-all below is only the SPA fallback for the
  // app's own root route and any other not-found GET path, mirroring what
  // Vite's dev-time appType:"spa" fallback already does locally. Both are
  // guarded by existsSync so a checkout without web/dist built (e.g. running
  // server tests in isolation) degrades to Express's ordinary 404, not a crash.
  if (existsSync(WEB_DIST_DIR)) {
    app.use(express.static(WEB_DIST_DIR));
  }
  app.get(/^(?!\/api\/).*/, (_req, res, next) => {
    if (!existsSync(WEB_INDEX_HTML)) {
      next();
      return;
    }
    res.sendFile(WEB_INDEX_HTML);
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("[express error]", err);
    res.status(500).json({
      error: { code: "internal_error", message: err instanceof Error ? err.message : "Unknown server error" },
    });
  });

  return app;
}

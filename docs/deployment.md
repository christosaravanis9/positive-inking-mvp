# Deployment (Render + Supabase)

This app deploys as a single Render web service: the compiled Express
server (`server/dist/`) serves both the API and the built React frontend
(`web/dist/`) from one process, on one port. See `server/src/app.ts` for
how static serving works, and `docs/PROJECT_STATUS.md`'s latest session log
entry for what was investigated/verified before this was written.

## 1. Supabase setup (do this first)

1. Create a Supabase project (free tier is sufficient for this table).
2. Open the SQL Editor and run `docs/supabase-schema.sql` once -- it creates
   the `analytics_events` table anonymous usage analytics writes to.
3. Go to Project Settings -> API and copy two values:
   - **Project URL** -> this is `SUPABASE_URL`.
   - **service_role secret** (not the `anon`/`public` key) -> this is
     `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses Row Level Security and
     must never be exposed to a browser -- it only ever lives in Render's
     server-side environment variables, never in any file committed to
     this repo.

## 2. Render setup

1. Connect this repository to a new Render web service. Render will detect
   `render.yaml` at the repo root and use it to configure the service
   (build command, start command, health check path) -- see that file's own
   comments for what each field does.
2. Render will prompt for the env vars `render.yaml` marks `sync: false`
   (it doesn't store real values, only the keys). Set:

   | Env var | Where to get it | Required? |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | Anthropic Console/API Platform | Required for real model calls -- without it the server starts in intentional degraded "model unavailable" mode (README.md) rather than failing to start |
   | `ANTHROPIC_MODEL` | -- | Optional, defaults to `claude-sonnet-5` |
   | `SUPABASE_URL` | Supabase Project Settings -> API -> Project URL | Required in production -- see "Why Supabase is required in production" below |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings -> API -> service_role secret | Required in production, same reason |

3. Deploy. Render's health check hits `GET /api/health` (already defined in
   `server/src/app.ts`) to confirm the service is alive.
4. Once the first deploy is live, add your custom domain: Render dashboard
   -> the service -> Settings -> Custom Domains -> add
   **discover.positiveinking.org**, then follow Render's DNS instructions
   (typically a CNAME record at your DNS provider) to point it there.

## Why Supabase is required in production

Render's free tier runs on an ephemeral filesystem -- anything written to
disk is lost on every restart or redeploy. The anonymous analytics store
(`server/src/analyticsStore.ts`) originally wrote to a local file
(`server/data/analytics-events.jsonl`), which is fine for local development
but cannot survive that. It now branches:

- **Both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set** -> writes go
  to the `analytics_events` table in Supabase Postgres (durable).
- **Either missing** -> falls back to the original local-file behaviour.
  This is deliberate, not a bug: it means local development needs no
  Supabase project at all, but it also means **forgetting to set these two
  vars in Render silently loses analytics data on every restart** rather
  than failing loudly. There is no server-side warning for this today --
  worth keeping in mind if analytics numbers ever look suspiciously low
  after a deploy.

The exact same zod validation (`server/src/routes/analytics.ts`) runs
before either storage path -- the schema has no free-text field at all, so
switching the storage backend changes nothing about what can reach it.

## What was checked before this was written

- The server already read `process.env.PORT` correctly (`server/src/env.ts`)
  -- Render assigns this dynamically, and no change was needed here.
- No new `/healthz` route was added -- the existing `GET /api/health`
  already returns 200 with a small diagnostic body and is reused as
  `render.yaml`'s `healthCheckPath`, rather than adding a redundant
  duplicate route.
- The production build previously had no static-file-serving path at all
  (`server/src/app.ts` was API-only) -- this was a real gap, now fixed:
  `express.static` serves `web/dist` directly, with a catch-all SPA
  fallback for any other non-`/api/*` GET request, verified by running the
  actual compiled server (`node server/dist/index.js`) with `PORT`/
  `NODE_ENV=production` set and curling `/`, a static AEO page, the hashed
  JS bundle, and an unknown path.
- No hardcoded `localhost`/port reference exists anywhere that would break
  once deployed -- every client-side API call already uses a relative path
  (`/api/...`), and CORS is already permissive (`cors()` with no origin
  restriction) rather than hardcoded to a specific origin.

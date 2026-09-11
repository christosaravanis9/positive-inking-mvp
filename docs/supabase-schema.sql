-- Positive Inking -- anonymous usage analytics table.
-- Run this once in the Supabase project's SQL editor (Project -> SQL Editor
-- -> New query) before setting SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
--
-- One table for both event shapes (screen_reached, journey_completed),
-- matching the existing local-file JSONL structure as closely as possible --
-- the columns each event type doesn't use are simply left NULL for that row,
-- exactly as they're already just absent keys in the JSON today.
--
-- No story text, image data, or any free-text field exists in this schema --
-- matching the server-side zod schema (server/src/routes/analytics.ts) that
-- validates every event before it ever reaches this table. session_id is a
-- random id generated fresh per browser page load (never persisted client-
-- side), not a durable identifier -- see web/src/instrumentation/
-- analytics.ts's own comment for the full reasoning.

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('screen_reached', 'journey_completed', 'device_impression', 'device_outcome', 'voice_input_used')),
  session_id uuid not null,
  journey_mode text,
  -- screen_reached only:
  screen text,
  from_screen text,
  elapsed_ms_on_previous_screen integer,
  -- journey_completed only:
  elapsed_ms integer,
  -- device_impression and device_outcome (2026-09-09, the "6 artists"
  -- device-rotation system -- see docs/PROJECT_STATUS.md session log and
  -- engine/src/deviceRoster.ts): device_id names which visual technique
  -- produced the candidate; decision/had_refinement_input are populated
  -- for device_outcome only. had_refinement_input is a boolean -- WHETHER
  -- the client typed something (a build-upon edit, a rejection reason, a
  -- follow-up detail), never the text itself.
  device_id text,
  decision text check (decision is null or decision in ('keep', 'build_upon', 'not_this_one')),
  had_refinement_input boolean,
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_event_idx on public.analytics_events (event);
create index if not exists analytics_events_received_at_idx on public.analytics_events (received_at);
create index if not exists analytics_events_device_id_idx on public.analytics_events (device_id) where device_id is not null;

-- Row Level Security is enabled with no policies -- the server writes using
-- the service_role key, which bypasses RLS entirely, so no anon/public
-- access exists to this table at all (no dashboard/query endpoint reads it
-- from the browser today, matching analyticsStore.ts's own "reads nothing
-- back" comment for the original two event shapes -- deviceRosterStore.ts
-- is the one exception, reading device_impression/device_outcome rows
-- back server-side only, to aggregate them for the periodic roster
-- review).
alter table public.analytics_events enable row level security;

-- 2026-09-09: the device roster's own persisted state -- one evolving
-- document (current active/reserve device ids, the review counter, an
-- audit trail of past swaps), not an event log. A single row (id = 1),
-- read-then-written whole by the server on every review -- see
-- server/src/deviceRosterStore.ts. The `state` column is the entire
-- DeviceRosterState object as JSON; nothing inside it is queried via SQL,
-- so a single jsonb column is the right shape here, unlike
-- analytics_events above.
create table if not exists public.device_roster_state (
  id integer primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.device_roster_state enable row level security;

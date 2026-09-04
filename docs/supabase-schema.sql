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
  event text not null check (event in ('screen_reached', 'journey_completed')),
  session_id uuid not null,
  journey_mode text not null check (journey_mode in ('full', 'attraction', 'expert', 'manual')),
  -- screen_reached only:
  screen text,
  from_screen text,
  elapsed_ms_on_previous_screen integer,
  -- journey_completed only:
  elapsed_ms integer,
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_event_idx on public.analytics_events (event);
create index if not exists analytics_events_received_at_idx on public.analytics_events (received_at);

-- Row Level Security is enabled with no policies -- the server writes using
-- the service_role key, which bypasses RLS entirely, so no anon/public
-- access exists to this table at all (no dashboard/query endpoint reads it
-- from the browser today, matching analyticsStore.ts's own "reads nothing
-- back" comment).
alter table public.analytics_events enable row level security;

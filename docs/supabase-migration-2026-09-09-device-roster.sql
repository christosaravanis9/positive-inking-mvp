-- Positive Inking -- migration for the "6 artists" device-rotation system.
-- Run this ONCE in an EXISTING Supabase project's SQL editor that already
-- has analytics_events from the original docs/supabase-schema.sql. A brand
-- new project should just run the (now-updated) docs/supabase-schema.sql
-- directly instead -- this file exists only because `create table if not
-- exists` cannot add columns or change constraints on a table that already
-- exists, and analytics_events.journey_mode's NOT NULL constraint has to
-- come off (device_impression/device_outcome events have no journey_mode).

alter table public.analytics_events
  alter column journey_mode drop not null;
alter table public.analytics_events
  drop constraint if exists analytics_events_event_check;
alter table public.analytics_events
  add constraint analytics_events_event_check
    check (event in ('screen_reached', 'journey_completed', 'device_impression', 'device_outcome'));

alter table public.analytics_events add column if not exists device_id text;
alter table public.analytics_events add column if not exists decision text;
alter table public.analytics_events
  drop constraint if exists analytics_events_decision_check;
alter table public.analytics_events
  add constraint analytics_events_decision_check
    check (decision is null or decision in ('keep', 'build_upon', 'not_this_one'));
alter table public.analytics_events add column if not exists had_refinement_input boolean;

create index if not exists analytics_events_device_id_idx on public.analytics_events (device_id) where device_id is not null;

create table if not exists public.device_roster_state (
  id integer primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.device_roster_state enable row level security;

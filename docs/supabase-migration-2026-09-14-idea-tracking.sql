-- Positive Inking -- migration adding the idea_added analytics event
-- (Screen 7's "add an idea" free-text box, bucketed, never the idea's own
-- text). Run this ONCE in an EXISTING Supabase project that already has
-- the 2026-09-09 device-roster and 2026-09-11 voice-input-tracking
-- migrations applied. A brand new project should just run the
-- (now-updated) docs/supabase-schema.sql directly instead.

alter table public.analytics_events
  drop constraint if exists analytics_events_event_check;
alter table public.analytics_events
  add constraint analytics_events_event_check
    check (event in ('screen_reached', 'journey_completed', 'device_impression', 'device_outcome', 'voice_input_used', 'idea_added'));

alter table public.analytics_events add column if not exists had_voice_input boolean;
alter table public.analytics_events add column if not exists replaces_existing boolean;
alter table public.analytics_events add column if not exists involves_likeness_or_place boolean;
alter table public.analytics_events add column if not exists adds_scene boolean;

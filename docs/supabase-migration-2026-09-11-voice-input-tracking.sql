-- Positive Inking -- migration adding the voice_input_used analytics event.
-- Run this ONCE in an EXISTING Supabase project that already has
-- analytics_events with the 2026-09-09 device-roster migration applied
-- (i.e. it already has device_id/decision/had_refinement_input columns).
-- A brand new project should just run the (now-updated)
-- docs/supabase-schema.sql directly instead.
--
-- No new columns needed -- voice_input_used reuses the existing `screen`
-- column (screen_reached already has one); this migration only widens the
-- `event` check constraint to allow the new value.

alter table public.analytics_events
  drop constraint if exists analytics_events_event_check;
alter table public.analytics_events
  add constraint analytics_events_event_check
    check (event in ('screen_reached', 'journey_completed', 'device_impression', 'device_outcome', 'voice_input_used'));

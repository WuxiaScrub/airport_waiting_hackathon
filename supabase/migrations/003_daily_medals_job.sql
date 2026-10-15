-- ============================================================================
-- Award yesterday's daily medals every day at 01:05 UTC.
--
-- Needs the pg_cron extension (Database → Extensions → pg_cron). The time must
-- stay later than 00:00 + app_config.daily_grace_minutes, or the award refuses
-- to run because the day is still open. Scheduling by name replaces any
-- earlier job of the same name, so re-running this file is safe.
-- ============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'award-daily-medals',
  '5 1 * * *',
  $$ select public.award_daily_medals(((now() at time zone 'utc')::date - 1)) $$
);

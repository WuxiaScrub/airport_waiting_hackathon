-- Run after 10_behaviour.sql: backdates the daily runs so they fall inside the
-- grace window, then checks the podium, the tie-break and idempotency.
\pset footer off
update public.runs set created_at = (current_date - 2) + interval '12 hours' + (id || ' seconds')::interval where mode = 'daily';
select public.award_daily_medals(current_date - 2) as awarded;
select public.award_daily_medals(current_date - 2) as awarded_again;
-- a late run after the cutoff must not change anything
update public.runs set score = 50000, created_at = current_date - 1 + interval '2 hours' where client_run_id = 'bbbbbbbb-0000-0000-0000-000000000005';
select daily_date, medal, score from public.daily_medals order by score desc;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select rank, name, score, medal, gold, silver, bronze, me from public.daily_top(current_date - 2);
select rank, name, score, gold, silver, bronze from public.endless_top();

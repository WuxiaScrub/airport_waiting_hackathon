-- Hardcore board (006). Run after 20_medals.sql.
\set ON_ERROR_STOP 0
\pset footer off
-- The helpers from 10_behaviour.sql (pg_temp lives only as long as a session).
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create or replace function pg_temp.run(cid text, mode text, score int, mines int, d text default null, ver text default '1.0.0', ms int default 60000, gen int default 2)
returns jsonb language sql as $$ select jsonb_build_object('client_run_id',cid,'mode',mode,'score',score,'mines_escaped',mines,
 'daily_date',d,'duration_ms',ms,'game_version',ver,'gen_version',gen,'max_depth',120,'gems',30,'result','cashout','played_at',now()) $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;

\echo == u1 hardcore: 9000, then 85000 (over the 1x per-mine cap, under 1.5x), then an older resend of 30000 is ignored
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000001','hardcore',9000,0));
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000001','hardcore',85000,0));
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000001','hardcore',30000,1));
\echo == hardcore cap is 1.5x per mine: 90001 with 0 mines refused (implausible_score)
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000002','hardcore',90001,0));
\echo == the same run id resent as endless is not moved across modes (id returned, row untouched)
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000001','endless',99000,1)) is not null as kept;
\echo == a daily date on a hardcore run is dropped, as on an endless one (stored, no date)
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000003','hardcore',900,0,current_date::text));

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_run(pg_temp.run('cccccccc-0000-0000-0000-000000000004','hardcore',12000,1));

\echo == hardcore board: u1 85000 first, u2 12000; endless board unchanged
select rank, name, score, mines_escaped, me from public.hardcore_top();
select rank, name, score from public.endless_top();
select * from public.my_ranks();
select public.my_profile()->'best_hardcore' as best_hc, public.my_profile()->'most_mines_hardcore' as mines_hc,
       public.my_profile()->'best_endless' as best_endless;

\echo == anon can read the hardcore board
reset role;
set role anon;
select count(*) from public.hardcore_top();
select public.hardcore_best();
reset role;

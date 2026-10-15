-- Behaviour tests for the core schema. Run on a LOCAL database only (see
-- supabase/README.md). Every ERROR line in the output is an expected rejection.
\set ON_ERROR_STOP 0
\pset footer off
insert into auth.users (id) values
 ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),
 ('33333333-3333-3333-3333-333333333333'),('44444444-4444-4444-4444-444444444444');
\echo == profiles created by trigger
select count(*) from public.profiles;

create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create or replace function pg_temp.run(cid text, mode text, score int, mines int, d text default null, ver text default '1.0.0', ms int default 60000, gen int default 1)
returns jsonb language sql as $$ select jsonb_build_object('client_run_id',cid,'mode',mode,'score',score,'mines_escaped',mines,
 'daily_date',d,'duration_ms',ms,'game_version',ver,'gen_version',gen,'max_depth',120,'gems',30,'result','cashout','played_at',now()) $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

\echo == anon can read boards, cannot submit
set role anon;
select * from public.endless_top();
select public.submit_run('{}');
reset role;

\echo == not signed in
set role authenticated;
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000001','endless',100,0));

\echo == u1 endless: 5000, then 12000 after escaping a mine, then a stale resend of 5000
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000001','endless',5000,0));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000001','endless',12000,1));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000001','endless',5000,0));
select score, mines_escaped from public.endless_top();

\echo == rejections (expect: implausible_score, too_fast, update_required, stale_daily, bad_run x3)
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000009','endless',999999,0));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000009','endless',900,0,null,'1.0.0',3000));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000009','endless',900,0,null,'0.9.9'));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000009','daily',900,0,(current_date+1)::text));
select public.submit_run('{"client_run_id":"aaaaaaaa-0000-0000-0000-000000000009","mode":"endless","score":"abc","gen_version":1,"game_version":"1.0.0"}');
select public.submit_run(pg_temp.run('not-a-uuid','endless',900,0));
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000009','daily',900,2,current_date::text));

\echo == u2 cannot hijack u1s run id (expect bad_run)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_run(pg_temp.run('aaaaaaaa-0000-0000-0000-000000000001','endless',50000,1));

\echo == direct table access denied
select * from public.runs;
insert into public.profiles (id) values (gen_random_uuid());
select public.award_daily_medals(current_date - 2);
select * from public.app_config where key = 'gen_version';

\echo == names
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.set_display_name('  Bob   the  Miner ');
select public.set_display_name('BOB THE MINER');         -- re-case: allowed
select public.set_display_name('Bobby');                  -- cooldown
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.set_display_name('bob the miner');          -- taken
select public.set_display_name('ｂｏｂ ｔｈｅ ｍｉｎｅｒ'); -- full-width, NFKC -> taken
select public.set_display_name('xX_FuCk_Xx');             -- banned
select public.set_display_name('Big Ass');                -- banned (word)
select public.set_display_name('Grape Peacock');          -- ok: the blocklist must not catch grape or peacock
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.set_display_name('a');                      -- length
select public.set_display_name('this name is way too long');
select public.set_display_name('hi!');                    -- chars
select public.set_display_name('gem😀');                  -- chars
select public.set_display_name(E'zero​width');       -- chars
select public.set_display_name('傻逼玩家');               -- banned
select public.set_display_name('王小明');                 -- ok
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.set_display_name('Admin_Real');             -- banned
select public.set_display_name('Ölgräber-7');             -- ok

\echo == dailies two days ago for 4 players (u3 ties u2 but later)
reset role;
create temp table d as select (current_date - 2) as day;
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.submit_run(pg_temp.run('bbbbbbbb-0000-0000-0000-000000000001','daily',3000,0,(current_date-2)::text));
select public.submit_run(pg_temp.run('bbbbbbbb-0000-0000-0000-000000000002','daily',9000,1,(current_date-2)::text));
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_run(pg_temp.run('bbbbbbbb-0000-0000-0000-000000000003','daily',4000,0,(current_date-2)::text));
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.submit_run(pg_temp.run('bbbbbbbb-0000-0000-0000-000000000004','daily',4000,0,(current_date-2)::text));
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.submit_run(pg_temp.run('bbbbbbbb-0000-0000-0000-000000000005','daily',2000,0,(current_date-2)::text));
reset role;
-- push u3's run later than u2's so the tie-break is deterministic
update public.runs set created_at = created_at + interval '1 second' where client_run_id = 'bbbbbbbb-0000-0000-0000-000000000004';
\echo == award (expect 3, then 0 when re-run); todays daily refuses
select public.award_daily_medals(current_date - 2);
select public.award_daily_medals(current_date - 2);
select public.award_daily_medals(current_date);
select daily_date, medal, score from public.daily_medals order by score desc;

set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
\echo == daily board for that day, with medals
select rank, name, tag, score, medal, gold, silver, bronze, me from public.daily_top(current_date - 2);
\echo == endless board + my ranks + profile
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select rank, name, score, mines_escaped, gold, me from public.endless_top();
select * from public.my_ranks();
select public.my_profile() - 'recent' as profile, jsonb_array_length(public.my_profile()->'recent') as recent;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select * from public.my_ranks();

\echo == delete account u4 cascades
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.delete_my_account();
reset role;
select (select count(*) from auth.users) users, (select count(*) from public.profiles) profiles,
       (select count(*) from public.runs where user_id='44444444-4444-4444-4444-444444444444') u4runs;

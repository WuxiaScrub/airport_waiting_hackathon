-- ============================================================================
-- Hardcore mode.
--
-- An endless campaign on harder terms (half the lanterns, no refill between
-- mines, a weaker revive) whose hauls score a bonus. It is ranked on a board
-- of its own, so runs are stored with mode = 'hardcore' and never mix with
-- the endless board.
--
-- This migration:
--   * lets runs.mode be 'hardcore' (no daily date, like endless);
--   * adds app_config.hardcore_score_pct (150 = +50%; keep it in step with
--     CFG.hardcore.scoreBonus) and raises the score ceiling for those runs;
--   * adds hardcore_top(n), the hardcore board;
--   * adds hardcore_rank / hardcore_best to my_ranks() and best_hardcore /
--     most_mines_hardcore to my_profile().
--
-- Apply it BEFORE the build with hardcore mode goes out: until then the
-- server refuses mode 'hardcore' as bad_run and the game drops the run.
-- ============================================================================


-- ---------------------------------------------------------------- tables ----

alter table public.runs drop constraint runs_mode_check;
alter table public.runs add constraint runs_mode_check
  check (mode in ('endless', 'daily', 'hardcore'));

create index runs_hardcore_board on public.runs (score desc, created_at) where mode = 'hardcore';

insert into public.app_config (key, value) values ('hardcore_score_pct', '150')
  on conflict (key) do nothing;


-- -------------------------------------------------------------- helpers ----

-- Each player's best hardcore run.
create function public.hardcore_best() returns table (
  user_id uuid, score int, mines_escaped smallint, max_depth int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (r.user_id) r.user_id, r.score, r.mines_escaped, r.max_depth, r.created_at
    from public.runs r
   where r.mode = 'hardcore' and r.score > 0
   order by r.user_id, r.score desc, r.created_at
$$;

revoke execute on function public.hardcore_best() from public, anon, authenticated;


-- ----------------------------------------------------------- submit_run ----

-- As in 001, with two changes: mode may be 'hardcore', and a hardcore run's
-- score ceiling is scaled by hardcore_score_pct. Grants carry over (create or
-- replace keeps them).
create or replace function public.submit_run(run jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid      uuid := auth.uid();
  v_mode   text := run ->> 'mode';
  v_daily  date;
  v_score  int;
  v_mines  int;
  v_ms     int;
  v_gen    int;
  v_cap    bigint;
  v_ver    text := coalesce(run ->> 'game_version', '');
  v_id     bigint;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  if not public.version_at_least(v_ver,
           (select value #>> '{}' from public.app_config where key = 'min_game_version')) then
    raise exception 'update_required';
  end if;

  begin
    v_daily := (run ->> 'daily_date')::date;
    v_score := (run ->> 'score')::int;
    v_mines := coalesce((run ->> 'mines_escaped')::int, 0);
    v_ms    := coalesce((run ->> 'duration_ms')::int, 0);
    v_gen   := (run ->> 'gen_version')::int;
  exception when others then
    raise exception 'bad_run';
  end;

  if v_mode not in ('endless', 'daily', 'hardcore') or v_score is null or v_score < 0
     or v_gen is null or (run ->> 'client_run_id') is null then
    raise exception 'bad_run';
  end if;

  if v_mode = 'daily' then
    -- A daily is one mine; it can be won once at most.
    if v_daily is null or v_mines > 1 then
      raise exception 'bad_run';
    end if;
    if v_daily > public.utc_today() or v_daily < public.utc_today() - 30
       or v_gen <> public.cfg_int('gen_version') then
      raise exception 'stale_daily';
    end if;
  else
    v_daily := null;
  end if;

  -- Hardcore hauls carry a bonus, so their ceiling is raised to match.
  v_cap := (v_mines + 1)::bigint * public.cfg_int('score_cap_per_mine');
  if v_mode = 'hardcore' then
    v_cap := v_cap * public.cfg_int('hardcore_score_pct') / 100;
  end if;
  if v_score > v_cap then
    raise exception 'implausible_score';
  end if;
  if v_score > 0 and v_ms < public.cfg_int('min_run_ms') then
    raise exception 'too_fast';
  end if;
  if (select count(*) from public.runs
       where user_id = uid and updated_at > now() - interval '1 minute')
     >= public.cfg_int('submits_per_minute') then
    raise exception 'rate_limited';
  end if;

  -- An account made before the profile trigger existed still gets a profile.
  insert into public.profiles (id) values (uid) on conflict do nothing;

  insert into public.runs as r (
    client_run_id, user_id, mode, daily_date, score, mines_escaped, max_depth,
    gems, heartstone, result, revived, duration_ms, game_version, gen_version, played_at)
  values (
    (run ->> 'client_run_id')::uuid, uid, v_mode, v_daily, v_score, v_mines,
    greatest(coalesce((run ->> 'max_depth')::int, 0), 0),
    greatest(coalesce((run ->> 'gems')::int, 0), 0),
    coalesce((run ->> 'heartstone')::boolean, false),
    coalesce(run ->> 'result', 'death'),
    coalesce((run ->> 'revived')::boolean, false),
    v_ms, v_ver, v_gen,
    (run ->> 'played_at')::timestamptz)
  on conflict (client_run_id) do update set
    score         = excluded.score,
    mines_escaped = excluded.mines_escaped,
    max_depth     = greatest(r.max_depth, excluded.max_depth),
    gems          = greatest(r.gems, excluded.gems),
    heartstone    = r.heartstone or excluded.heartstone,
    result        = excluded.result,
    revived       = r.revived or excluded.revived,
    duration_ms   = greatest(r.duration_ms, excluded.duration_ms),
    game_version  = excluded.game_version,
    updated_at    = now()
  -- Only the owner may move a run, only forward, and never across modes.
  where r.user_id = uid and r.mode = excluded.mode and excluded.score >= r.score
  returning r.id into v_id;

  if v_id is null then
    -- The update was refused (an older resend, or someone else's id).
    select id into v_id from public.runs
     where client_run_id = (run ->> 'client_run_id')::uuid and user_id = uid;
    if v_id is null then
      raise exception 'bad_run';
    end if;
  end if;
  return v_id;
exception
  when invalid_text_representation or datetime_field_overflow
    or invalid_datetime_format or check_violation then
    raise exception 'bad_run';
end $$;


-- ------------------------------------------------------------ the boards ----

-- Top `n` of the hardcore board. `me` marks the caller's row.
create function public.hardcore_top(n int default 50) returns table (
  rank bigint, name text, tag text, score int, mines_escaped smallint,
  max_depth int, gold int, silver int, bronze int, me boolean)
language sql stable security definer set search_path = '' as $$
  select row_number() over (order by b.score desc, b.created_at) as rank,
         p.display_name, public.anon_tag(b.user_id), b.score, b.mines_escaped,
         b.max_depth, coalesce(m.gold, 0), coalesce(m.silver, 0), coalesce(m.bronze, 0),
         b.user_id = auth.uid()
    from public.hardcore_best() b
    join public.profiles p on p.id = b.user_id
    left join public.medal_counts m on m.user_id = b.user_id
   order by b.score desc, b.created_at
   limit least(greatest(n, 1), 200)
$$;

-- my_ranks() gains two columns, so it is dropped and made again (a function's
-- result type cannot be changed in place). Older builds read only the columns
-- they know, so the new ones go on the end.
drop function public.my_ranks();
create function public.my_ranks() returns table (
  endless_rank bigint, endless_best int, daily_rank bigint, daily_best int,
  hardcore_rank bigint, hardcore_best int)
language sql stable security definer set search_path = '' as $$
  with e as (select * from public.endless_best()),
       d as (select * from public.daily_best(public.utc_today(), public.daily_cutoff(public.utc_today()))),
       h as (select * from public.hardcore_best())
  select (select 1 + (select count(*) from e x
                       where x.score > me.score
                          or (x.score = me.score and x.created_at < me.created_at))
            from e me where me.user_id = auth.uid()),
         (select me.score from e me where me.user_id = auth.uid()),
         (select 1 + (select count(*) from d x
                       where x.score > me.score
                          or (x.score = me.score and x.created_at < me.created_at))
            from d me where me.user_id = auth.uid()),
         (select me.score from d me where me.user_id = auth.uid()),
         (select 1 + (select count(*) from h x
                       where x.score > me.score
                          or (x.score = me.score and x.created_at < me.created_at))
            from h me where me.user_id = auth.uid()),
         (select me.score from h me where me.user_id = auth.uid())
$$;

-- The caller's own profile page, now with hardcore bests.
create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name',            p.display_name,
    'tag',             public.anon_tag(p.id),
    'name_changed_at', p.name_changed_at,
    'created_at',      p.created_at,
    'runs',            (select count(*) from public.runs where user_id = p.id),
    'dailies',         (select count(*) from public.runs where user_id = p.id and mode = 'daily'),
    'best_endless',    (select max(score) from public.runs where user_id = p.id and mode = 'endless'),
    'most_mines',      (select max(mines_escaped) from public.runs where user_id = p.id and mode = 'endless'),
    'best_hardcore',   (select max(score) from public.runs where user_id = p.id and mode = 'hardcore'),
    'most_mines_hardcore', (select max(mines_escaped) from public.runs where user_id = p.id and mode = 'hardcore'),
    'deepest',         (select max(max_depth) from public.runs where user_id = p.id),
    'gold',            coalesce(m.gold, 0),
    'silver',          coalesce(m.silver, 0),
    'bronze',          coalesce(m.bronze, 0),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select mode, daily_date, score, mines_escaped, max_depth, heartstone, result,
               revived, created_at
          from public.runs where user_id = p.id
         order by created_at desc limit 20) x), '[]'::jsonb))
    from public.profiles p
    left join public.medal_counts m on m.user_id = p.id
   where p.id = auth.uid()
$$;


-- ------------------------------------------------------------- grants ----

revoke execute on function public.hardcore_top(int), public.my_ranks()
  from public, anon, authenticated;
grant execute on function public.hardcore_top(int) to anon, authenticated;
grant execute on function public.my_ranks() to authenticated;

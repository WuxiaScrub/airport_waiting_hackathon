-- ============================================================================
-- Forever Mine: Gem Rush — core schema.
--
-- Profiles, run history, daily medals and the functions the game calls.
--
-- SECURITY MODEL: clients never touch a table directly. Row-level security is
-- on everywhere with no client policies (app_config aside, which is read-only),
-- and every read or write goes through a `security definer` function below
-- that checks auth.uid() and validates its input. The publishable key in the
-- client can therefore reach nothing but these functions.
--
-- Times are UTC. A "daily" belongs to the UTC date it was started on.
-- ============================================================================


-- ---------------------------------------------------------------- tables ----

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('min_game_version',     '"1.0.0"'),  -- older builds are told to update
  ('gen_version',          '1'),        -- world generator the daily board accepts
  ('daily_grace_minutes',  '60'),       -- late syncs still eligible for medals
  ('score_cap_per_mine',   '60000'),    -- sanity ceiling, Heartstone included
  ('min_run_ms',           '15000'),    -- a scoring run faster than this is fake
  ('submits_per_minute',   '30'),
  ('name_cooldown_days',   '30');

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,                  -- null until the player picks one
  name_key        text unique,           -- normalised form; uniqueness lives here
  name_changed_at timestamptz,
  created_at      timestamptz not null default now()
);

create table public.runs (
  id             bigint generated always as identity primary key,
  client_run_id  uuid not null unique,   -- made on the device: retries are no-ops
  user_id        uuid not null references public.profiles (id) on delete cascade,
  mode           text not null check (mode in ('endless', 'daily')),
  daily_date     date,
  score          integer  not null check (score >= 0),
  mines_escaped  smallint not null default 0 check (mines_escaped >= 0),
  max_depth      integer  not null default 0 check (max_depth >= 0),
  gems           integer  not null default 0 check (gems >= 0),
  heartstone     boolean  not null default false,
  result         text not null check (result in ('win', 'cashout', 'death', 'abandon')),
  revived        boolean  not null default false,
  duration_ms    integer  not null default 0 check (duration_ms >= 0),
  game_version   text not null,
  gen_version    smallint not null,
  played_at      timestamptz,            -- device clock: for display only
  created_at     timestamptz not null default now(),  -- server clock: rules and ties
  updated_at     timestamptz not null default now(),
  check ((mode = 'daily') = (daily_date is not null))
);

create index runs_endless_board on public.runs (score desc, created_at) where mode = 'endless';
create index runs_daily_board   on public.runs (daily_date, score desc, created_at) where mode = 'daily';
create index runs_by_user       on public.runs (user_id, created_at desc);

create table public.daily_medals (
  daily_date date not null,
  medal      text not null check (medal in ('gold', 'silver', 'bronze')),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  score      integer not null,
  run_id     bigint references public.runs (id) on delete set null,
  awarded_at timestamptz not null default now(),
  primary key (daily_date, medal),
  unique (daily_date, user_id)
);

create index daily_medals_by_user on public.daily_medals (user_id);

-- Display-name blocklist. `part` entries match anywhere in the normalised name
-- (spaces, _ and - ignored); `word` entries only as a whole word, for short
-- words that hide inside innocent names. Add rows from the dashboard any time.
create table public.banned_words (
  word  text primary key,
  match text not null default 'part' check (match in ('part', 'word'))
);


-- ------------------------------------------------------------------ RLS ----

alter table public.app_config   enable row level security;
alter table public.profiles     enable row level security;
alter table public.runs         enable row level security;
alter table public.daily_medals enable row level security;
alter table public.banned_words enable row level security;

revoke all on public.profiles, public.runs, public.daily_medals, public.banned_words
  from anon, authenticated;
revoke insert, update, delete on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

create policy "app_config is public" on public.app_config
  for select to anon, authenticated using (true);


-- -------------------------------------------------------------- helpers ----

create function public.cfg_int(k text) returns integer
language sql stable security definer set search_path = '' as $$
  select (value #>> '{}')::integer from public.app_config where key = k
$$;

create function public.utc_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date
$$;

-- The last moment a run for daily `d` can reach the server and still count:
-- the end of that UTC day plus the grace window for offline syncs.
create function public.daily_cutoff(d date) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select (d + 1)::timestamp at time zone 'utc'
         + make_interval(mins => public.cfg_int('daily_grace_minutes'))
$$;

-- '1.2.10' >= '1.2.9'. Anything unparsable compares as too old.
create function public.version_at_least(v text, min text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return string_to_array(v, '.')::int[] >= string_to_array(min, '.')::int[];
exception when others then
  return false;
end $$;

-- The four-digit tag shown as "Miner#1234" until a name is picked. Derived
-- from the id, so it is stable and needs no storage.
create function public.anon_tag(uid uuid) returns text
language sql immutable set search_path = '' as $$
  select lpad((abs(hashtext(uid::text)) % 10000)::text, 4, '0')
$$;

-- Every account gets a profile the moment it exists.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Medal tallies, always counted from the source so they can never drift.
create view public.medal_counts with (security_invoker = true) as
  select user_id,
         count(*) filter (where medal = 'gold')::int   as gold,
         count(*) filter (where medal = 'silver')::int as silver,
         count(*) filter (where medal = 'bronze')::int as bronze
    from public.daily_medals
   group by user_id;

revoke all on public.medal_counts from anon, authenticated;

-- Each player's best endless run.
create function public.endless_best() returns table (
  user_id uuid, score int, mines_escaped smallint, max_depth int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (r.user_id) r.user_id, r.score, r.mines_escaped, r.max_depth, r.created_at
    from public.runs r
   where r.mode = 'endless' and r.score > 0
   order by r.user_id, r.score desc, r.created_at
$$;

-- Each player's best run of daily `d`, counting only runs that reached the
-- server before `cutoff`, on the generator version the board currently uses.
create function public.daily_best(d date, cutoff timestamptz) returns table (
  user_id uuid, run_id bigint, score int, max_depth int, heartstone boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (r.user_id) r.user_id, r.id, r.score, r.max_depth, r.heartstone, r.created_at
    from public.runs r
   where r.mode = 'daily' and r.daily_date = d and r.score > 0
     and r.gen_version = public.cfg_int('gen_version')
     and r.created_at < cutoff
   order by r.user_id, r.score desc, r.created_at
$$;

revoke execute on function
  public.cfg_int(text), public.handle_new_user(),
  public.endless_best(), public.daily_best(date, timestamptz)
  from public, anon, authenticated;


-- ----------------------------------------------------------- submit_run ----

-- Record a finished endless campaign or daily attempt. An endless campaign
-- submits again after every mine it escapes with the same client_run_id; the
-- row only ever moves forward. Returns the stored row's id, or raises one of:
--   not_signed_in · update_required · bad_run · stale_daily · implausible_score
--   · too_fast · rate_limited
create function public.submit_run(run jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid      uuid := auth.uid();
  v_mode   text := run ->> 'mode';
  v_daily  date;
  v_score  int;
  v_mines  int;
  v_ms     int;
  v_gen    int;
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

  if v_mode not in ('endless', 'daily') or v_score is null or v_score < 0
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

  if v_score > (v_mines + 1) * public.cfg_int('score_cap_per_mine') then
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


-- ------------------------------------------------------ set_display_name ----

-- Pick or change the display name. Rules: Unicode NFKC, 2–15 characters,
-- letters/digits/spaces/_/- in any script, no emoji or invisible characters,
-- not on the blocklist, unique ignoring case, and — after the first pick —
-- at most one change per cooldown. Returns the stored name, or raises one of:
--   not_signed_in · name_length · name_chars · name_banned · name_taken
--   · name_cooldown
create function public.set_display_name(new_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  nm   text;
  key  text;
  bare text;
  prev timestamptz;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;

  nm := regexp_replace(btrim(normalize(coalesce(new_name, ''), nfkc)), '\s+', ' ', 'g');
  if char_length(nm) < 2 or char_length(nm) > 15 then
    raise exception 'name_length';
  end if;
  -- Control and invisible characters, ASCII punctuation (bar _ and -), and
  -- the common emoji and symbol blocks.
  if nm ~ '[\x01-\x1f\x7f ­͏؜ᅟᅠ឴឵᠎ -‏ -  -⁯ㅤ︀-️﻿ﾠ]'
     or nm ~ '[!-,./:-@\[-\^`{-~]'
     or nm ~ '[←-⯿　-〿！-／\U0001f000-\U0001faff\U000e0000-\U000e007f]' then
    raise exception 'name_chars';
  end if;

  key  := lower(nm);
  bare := regexp_replace(key, '[ _-]', '', 'g');
  if exists (
    select 1 from public.banned_words b
     where (b.match = 'part' and strpos(bare, b.word) > 0)
        or (b.match = 'word' and key ~ ('(^|[ _-])' || b.word || '($|[ _-])'))
  ) then
    raise exception 'name_banned';
  end if;

  select name_changed_at into prev from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid);
  elsif prev is not null
        and prev > now() - make_interval(days => public.cfg_int('name_cooldown_days'))
        and (select name_key from public.profiles where id = uid) is distinct from key then
    raise exception 'name_cooldown';
  end if;

  begin
    update public.profiles
       set display_name = nm, name_key = key,
           -- Re-casing your own name is free; the clock is for new names.
           name_changed_at = case when name_key is distinct from key then now() else name_changed_at end
     where id = uid;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return nm;
end $$;


-- ------------------------------------------------------------ the boards ----

-- Top `n` of the endless board. `me` marks the caller's row.
create function public.endless_top(n int default 50) returns table (
  rank bigint, name text, tag text, score int, mines_escaped smallint,
  max_depth int, gold int, silver int, bronze int, me boolean)
language sql stable security definer set search_path = '' as $$
  select row_number() over (order by b.score desc, b.created_at) as rank,
         p.display_name, public.anon_tag(b.user_id), b.score, b.mines_escaped,
         b.max_depth, coalesce(m.gold, 0), coalesce(m.silver, 0), coalesce(m.bronze, 0),
         b.user_id = auth.uid()
    from public.endless_best() b
    join public.profiles p on p.id = b.user_id
    left join public.medal_counts m on m.user_id = b.user_id
   order by b.score desc, b.created_at
   limit least(greatest(n, 1), 200)
$$;

-- Top `n` of a daily board (today when `d` is null), with medals already
-- awarded for that day. Uses the same cutoff as the medals, so a past day's
-- board never shows a late run above its podium.
create function public.daily_top(d date default null, n int default 50) returns table (
  rank bigint, name text, tag text, score int, max_depth int, heartstone boolean,
  medal text, gold int, silver int, bronze int, me boolean)
language sql stable security definer set search_path = '' as $$
  select row_number() over (order by b.score desc, b.created_at) as rank,
         p.display_name, public.anon_tag(b.user_id), b.score, b.max_depth, b.heartstone,
         dm.medal, coalesce(m.gold, 0), coalesce(m.silver, 0), coalesce(m.bronze, 0),
         b.user_id = auth.uid()
    from public.daily_best(coalesce(d, public.utc_today()),
                           public.daily_cutoff(coalesce(d, public.utc_today()))) b
    join public.profiles p on p.id = b.user_id
    left join public.medal_counts m on m.user_id = b.user_id
    left join public.daily_medals dm
           on dm.daily_date = coalesce(d, public.utc_today()) and dm.user_id = b.user_id
   order by b.score desc, b.created_at
   limit least(greatest(n, 1), 200)
$$;

-- Where the caller stands: endless rank and best, today's daily rank and best.
-- Ranks are null when there is no scoring run.
create function public.my_ranks() returns table (
  endless_rank bigint, endless_best int, daily_rank bigint, daily_best int)
language sql stable security definer set search_path = '' as $$
  with e as (select * from public.endless_best()),
       d as (select * from public.daily_best(public.utc_today(), public.daily_cutoff(public.utc_today())))
  select (select 1 + (select count(*) from e x
                       where x.score > me.score
                          or (x.score = me.score and x.created_at < me.created_at))
            from e me where me.user_id = auth.uid()),
         (select me.score from e me where me.user_id = auth.uid()),
         (select 1 + (select count(*) from d x
                       where x.score > me.score
                          or (x.score = me.score and x.created_at < me.created_at))
            from d me where me.user_id = auth.uid()),
         (select me.score from d me where me.user_id = auth.uid())
$$;

-- The caller's own profile page.
create function public.my_profile() returns jsonb
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


-- --------------------------------------------------------------- medals ----

-- Award gold/silver/bronze for daily `d`. Counts runs that reached the server
-- before the end of that UTC day plus the grace window. Safe to run twice.
-- Not callable by clients — the scheduled job runs it (see 003).
create function public.award_daily_medals(d date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := public.daily_cutoff(d);
  awarded int;
begin
  if now() < cutoff then
    raise exception 'daily % is still open until %', d, cutoff;
  end if;
  insert into public.daily_medals (daily_date, medal, user_id, score, run_id)
  select d, (array['gold', 'silver', 'bronze'])[t.place], t.user_id, t.score, t.run_id
    from (select b.*, row_number() over (order by b.score desc, b.created_at) as place
            from public.daily_best(d, cutoff) b) t
   where t.place <= 3
  on conflict do nothing;
  get diagnostics awarded = row_count;
  return awarded;
end $$;


-- ------------------------------------------------------- delete account ----

-- Wipes the caller's account. Cascades to profile, runs and medals. Required
-- by the App Store for any app that creates accounts.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;


-- ------------------------------------------------------------- grants ----

revoke execute on function
  public.submit_run(jsonb), public.set_display_name(text),
  public.endless_top(int), public.daily_top(date, int), public.my_ranks(),
  public.my_profile(), public.award_daily_medals(date), public.delete_my_account()
  from public, anon, authenticated;   -- Supabase grants new functions to both by default

grant execute on function public.endless_top(int), public.daily_top(date, int)
  to anon, authenticated;
grant execute on function
  public.submit_run(jsonb), public.set_display_name(text), public.my_ranks(),
  public.my_profile(), public.delete_my_account()
  to authenticated;
-- award_daily_medals: owner (postgres) and the scheduled job only.

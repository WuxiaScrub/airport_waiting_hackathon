# Supabase backend

Forever Mine's online layer: accounts, run history, the endless and daily
boards, daily medals, and account deletion. The game never needs it to play.

Project: `https://uyxpfuhedfqzvxmmjyti.supabase.co` (the URL and publishable
key live in `CFG.online` in `src/config.js`; both are public by design).

## Applying the migrations

Run each file in `migrations/`, **in order**, in the Supabase dashboard:
**SQL Editor → New query → paste the file → Run**.

| File | What it does |
|---|---|
| `001_core.sql` | Tables, row-level security, and every function the game calls. |
| `002_banned_words.sql` | Starter display-name blocklist (English + Chinese). |
| `003_daily_medals_job.sql` | Schedules the medal award at 01:05 UTC daily (needs pg_cron). |
| `004_name_regex_ascii.sql` | Rewrites `set_display_name`'s character checks as ASCII escapes, so a paste can't break them. |
| `005_gen_version_2.sql` | Moves the daily board to generator version 2 (gas pockets and the worm in the daily). |

Never edit a file that has already been run — add the next number instead. Keep
migrations plain ASCII: the SQL Editor can silently drop invisible characters
pasted into it, so write them as `\uXXXX` escapes.

Before running: **Authentication → Sign In / Providers → Allow anonymous
sign-ins** on, and **Database → Extensions → pg_cron** on.

### Checking it worked

Run this in the SQL editor afterwards:

```sql
select key, value from app_config order by key;          -- 7 rows
select count(*) from banned_words;                        -- 85
select jobname, schedule from cron.job;                   -- award-daily-medals | 5 1 * * *
select * from endless_top();                              -- empty, no error
```

## How it fits together

Clients never read or write tables. Everything goes through these functions
(called from the game with `supabase.rpc(name, args)`):

| Function | Who | Purpose |
|---|---|---|
| `submit_run(run jsonb)` | signed in | Store a finished endless campaign or daily attempt. Idempotent by `client_run_id`; an endless campaign re-submits after each mine and only moves forward. |
| `set_display_name(new_name)` | signed in | Unique, 2–15 chars, Unicode, filtered, one change per 30 days after the first pick. |
| `endless_top(n)` | anyone | Best endless run per player. |
| `daily_top(d, n)` | anyone | Best daily run per player for date `d` (today if null), with medals. |
| `my_ranks()` | signed in | Caller's endless and today's daily rank. |
| `my_profile()` | signed in | Caller's name, medals, bests and last 20 runs. |
| `delete_my_account()` | signed in | Deletes the account and everything attached. |
| `award_daily_medals(d)` | scheduled job only | Gold/silver/bronze for daily `d`. |

Errors come back as short codes in the message (`name_taken`,
`update_required`, `implausible_score`, …) so the game can translate them.

Tunables live in the `app_config` table — edit them in the table editor, no
deploy needed: minimum game version, daily generator version, grace window,
score ceiling per mine, minimum run time, submit rate limit, name cooldown.

### Moderation

* Add words to `banned_words` from the table editor (`part` = anywhere in the
  name, `word` = whole word only).
* Clear an offensive name: `update profiles set display_name = null, name_key = null where id = '<uuid>';`
* Remove a cheated run: `delete from runs where id = <id>;` (re-award a day's
  medals by deleting that day's `daily_medals` rows and running
  `select award_daily_medals('<date>');`).

## Testing locally

`tests/` runs the migrations against a plain local Postgres (15+) using a tiny
stand-in for Supabase's roles and `auth` schema:

```bash
createdb fm
psql -d fm -f supabase/tests/00_supabase_stub.sql
psql -d fm -f supabase/migrations/001_core.sql
psql -d fm -f supabase/migrations/002_banned_words.sql
psql -d fm -f supabase/migrations/004_name_regex_ascii.sql
psql -d fm -f supabase/migrations/005_gen_version_2.sql
psql -d fm -f supabase/tests/10_behaviour.sql   # ERROR lines are expected rejections
psql -d fm -f supabase/tests/20_medals.sql
```

`003` needs pg_cron and is not part of the local run.

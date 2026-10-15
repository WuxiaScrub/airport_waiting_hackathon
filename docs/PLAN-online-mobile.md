# Forever Mine: Gem Rush — online, daily mine, mobile app, revive ads

Status: **Phases 0–4 done.** Migrations applied by the owner; the online
client, boards, profile and daily mine are tested in the browser against a
mocked backend (this container cannot reach Supabase). The Capacitor projects
are generated and configured but have not been compiled yet; the first build
is on the owner's Mac (`docs/BUILD-mobile.md`). Next: Phase 5 (revive ads).
Each phase ends in something playable and testable, and the game must stay
fully playable offline at every step.

## Decisions already made

| Topic | Decision |
|---|---|
| Name | **Forever Mine: Gem Rush** (store title). Chinese title **矿世奇财：宝石狂潮**. Bundle / package ID `com.hdexpanse.forevermine` on both platforms. |
| Modes | **Endless** (today's campaign: Heartstone opens the next mine) and **Daily Mine**. |
| Endless board | Global, ranked by campaign score; shows mines escaped. The prestige board. |
| Daily mine | One single mine per UTC day. Same terrain seed for everyone; enemies stay random per attempt. Unlimited attempts; a player's **best** score of the day counts. Escaping with the Heartstone ends the daily (no next mine). |
| Daily medals | Gold / silver / bronze for daily top 3. Shown on the profile and next to names on every board. |
| Rollover | 00:00 UTC. Medals are awarded after a 1-hour grace window so offline runs can sync. |
| Accounts | Anonymous on first launch; optional link to **Sign in with Apple** (iOS) / **Google** (Android) to keep progress across devices. |
| Display names | Unique, max 15 characters, Unicode allowed, profanity-filtered (en + zh). |
| Offline | Finished runs queue locally and upload when the device is back online. |
| Revive | One rewarded-ad revive per run (once per **campaign** in Endless, once per daily attempt). |
| Ads | AdMob **Rewarded** units only. No interstitials, no banners. |
| Wrapper | Capacitor around the existing JS/Canvas game. Builds on the owner's Mac. |

### Identifiers (all safe to commit — none are secrets)

```
Supabase URL            https://uyxpfuhedfqzvxmmjyti.supabase.co
Supabase publishable    sb_publishable_acqASii6zBrNZ8vDSwbxgg_HfcQltjP
AdMob Android app ID    ca-app-pub-2298615637807323~3595318939
AdMob Android rewarded  ca-app-pub-2298615637807323/7422883305
AdMob iOS app ID        ca-app-pub-2298615637807323~7639514885
AdMob iOS rewarded      ca-app-pub-2298615637807323/8544393285
```

Never commit or paste the Supabase **service-role / secret** key. Dev builds use
Google's public test ad units; the real unit IDs are used only in release builds.

---

## Phase 0 — Rename and scope reset

1. Rename DEEPCUT → Forever Mine: Gem Rush: `<title>`, meta description,
   `noscript`, title screen, i18n strings (en + zh).
2. New storage keys `forevermine.*`; on first load, migrate `deepcut.save.*` and
   `deepcut.scores.v1` so existing local records survive.
3. Rewrite `CLAUDE.md` for the new scope:
   - Replace "No backend / no database / no authentication / GitHub Pages only"
     with: *optional online layer (Supabase); every online feature degrades to
     offline play; the game never blocks on the network.*
   - Add sections: Game modes (Endless, Daily), Accounts & names, Leaderboards &
     medals, Revive ads (rules below), Mobile app (Capacitor).
   - Keep everything about the core loop as is.
4. Centralise new tunables in `CFG`: `CFG.online`, `CFG.daily`, `CFG.revive`,
   `CFG.ads`.

## Phase 1 — Supabase schema

All SQL lives in `supabase/migrations/NNN_*.sql`, committed to the repo. The
owner runs each file in the Supabase SQL editor (or `supabase db push`).

### Tables

**`profiles`**: one per auth user, created by a trigger on `auth.users` insert.
- `id uuid pk → auth.users on delete cascade`
- `display_name text null` (null until chosen; boards show `Miner#` + 4 digits from the id)
- `name_key text unique null` (normalised form used for uniqueness, see below)
- `name_changed_at timestamptz null`
- `created_at timestamptz default now()`

**`runs`**: the game history, one row per endless campaign or daily attempt.
- `id bigint identity pk`
- `client_run_id uuid unique not null` (made on the device; makes retries and offline sync idempotent)
- `user_id uuid → profiles`
- `mode text check in ('endless','daily')`
- `daily_date date null` (set iff mode = daily)
- `score int ≥ 0`, `mines_escaped smallint`, `max_depth int`, `gems int`
- `heartstone bool`, `result text` (`win`/`cashout`/`death`/`abandon`), `revived bool`
- `duration_ms int`, `game_version text`, `gen_version smallint`
- `played_at timestamptz` (client clock, display only), `created_at timestamptz default now()` (server clock, used for rules and tie-breaks)
- Indexes: `(mode, score desc)`, `(daily_date, score desc)`, `(user_id, created_at desc)`

**`daily_medals`**
- `daily_date date`, `medal text check in ('gold','silver','bronze')`, `user_id`, `score int`, `run_id`
- `pk (daily_date, medal)`, `unique (daily_date, user_id)`

**`banned_words`**: `word text pk`. Seeded with English and Chinese lists; the
owner can add rows from the dashboard.

**`app_config`**: `key text pk, value jsonb`, readable by everyone.
- `min_game_version`: older clients are told to update and stop submitting.
- `daily_grace_minutes`: 60.
- `gen_version`: the world-generator version the daily uses.

No `daily_mines` table: the daily seed is derived from the date, so the daily
works offline.

### Security (RLS)

- RLS on for every table. Clients **cannot** insert, update or delete any table
  directly.
- Only `app_config` is readable directly. Every other read goes through
  functions that expose names, scores, mines, depth and medals, never ids.
- All writes go through `security definer` functions that check `auth.uid()`.

### Functions (RPC)

| Function | Purpose |
|---|---|
| `submit_run(payload jsonb)` | Upsert by `client_run_id`. An endless campaign re-submits after every mine and its score may only go up. Sanity checks: score ≤ a cap derived from `CFG` (max plausible haul per mine × mines + Heartstone value per escape); `daily_date` within ±1 day of server time; duration plausible; no more than ~30 submits per minute per user. A rejected run returns an error code; it is not stored. |
| `set_display_name(name text)` | Trim → Unicode NFKC normalise → strip control and zero-width characters → 1–15 characters, letters, digits, spaces, `_` and `-`, any script. `name_key = lower(normalised)`. Rejects banned-word substrings (checked on `name_key`). Uniqueness comes from the unique index, so a race returns `name_taken`. The first choice is free; after that, one change per 30 days. |
| `endless_top(n)` | Best run per user, top `n`, with names and medal counts. |
| `daily_top(d date, n)` | Best run per user for that date, ties broken by earliest `created_at`. |
| `my_ranks()` | The caller's endless rank and today's daily rank. |
| `my_profile()` | The caller's name, runs played, best endless score, most mines escaped, deepest depth, gold/silver/bronze counts and last 20 runs. |
| `award_daily_medals(d date)` | Takes the top 3 of `daily_top(d)`, counting only runs with `created_at < d + 1 day + grace`. Idempotent. |
| `delete_my_account()` | Deletes the caller's `auth.users` row, which cascades to everything. Required by the App Store. |

Medal counts come from a view over `daily_medals`. They are not cached
counters, so they can't drift.

### Scheduled job

Enable `pg_cron`. Every day at 01:05 UTC, run
`award_daily_medals(current_date - 1)`.

### Owner setup for this phase

- Authentication → Sign In / Providers → turn on **Anonymous sign-ins**.
- Database → Extensions → turn on **pg_cron**.
- Run the migration files.

## Phase 2 — Online client (tested in the browser)

- **`vendor/supabase.js`**: a pinned UMD build of `supabase-js`, vendored so
  there is still no bundler. The auth storage adapter uses Capacitor Preferences
  inside the app and localStorage on the web. iOS can evict WebView
  localStorage, and losing the session would orphan an anonymous account.
- **`src/online.js`**:
  - Starts the client. On first launch while online, signs in anonymously.
  - **Outbox**: finished runs go to `forevermine.outbox.v1`. The outbox is
    flushed on start, on the browser's `online` event, after every run and when
    the app resumes, retrying with backoff.
  - Fetches `app_config` and enforces `min_game_version`.
  - Plugs into the existing `Highscore.useBackend({ submit, top })` hook. The
    local board keeps working as before.
- **Run identity**: `newCampaign()` creates a `client_run_id`. `endRun()`
  already re-submits after every mine (`scoreId`), which maps directly to the
  server upsert.
- **UI**:
  - Title screen: two big buttons, **Daily Mine** and **Endless**.
  - **Leaderboards** screen with tabs: Endless · Today · Yesterday (with medals).
    Your own row is pinned at the bottom when you're off the visible list.
  - **Profile** screen: name (edit), medal tally, best scores, recent runs, link
    account, delete account.
  - First-time name prompt after the first finished run (skippable).
  - Offline, these screens show cached data and an "offline" badge.
- Every new string goes in `STRINGS.en` and `STRINGS.zh`.

## Phase 3 — Daily mine

- **Seed**: `hash('forevermine-daily|' + YYYY-MM-DD (UTC) + '|' + gen_version)`
  → `World` seed. Enemies keep `Math.random()`, so each attempt differs.
- **Rules**: mine-1 settings (Heartstone row and threat level); base stats; full
  satchel; shops work as normal. Score = whatever is carried out through the
  camp, plus 7,000 for the Heartstone. A death scores 0. The score is still
  recorded in your history, but it can't place on the board.
- **Rollover during a run**: the run counts for the day it **started**. The
  server accepts it until the grace window closes.
- **Title card**: today's date, a countdown to the next daily, your best today,
  your current rank, and yesterday's podium.
- **Version safety**: the board only accepts runs with the current
  `gen_version`. Changes to world generation bump it, and `min_game_version`
  makes old builds update.

## Phase 4 — Capacitor app

- `package.json` with `@capacitor/core`, `@capacitor/cli`, `ios`, `android`,
  `@capacitor/preferences`, `@capacitor/app` (back button and resume),
  `@capacitor/status-bar` and `@capacitor/splash-screen`.
- `npm run build` copies `index.html`, `styles.css`, `src/` and `vendor/` into
  `www/`. The game itself still has no bundler.
- `capacitor.config.json`: `appId com.hdexpanse.forevermine`,
  `appName "Forever Mine"` (the home-screen name; the store title adds
  "Gem Rush").
- Generate the `ios/` and `android/` projects and commit them.
- Handle safe-area insets (notch, home bar) for the HUD and joystick.
- Hardware back button on Android → the existing leave-the-mine panel.
- Pause on app background; resume where you left off.
- App icon and splash, generated in the game's own art style.
- Keep the GitHub Pages build as a **dev/test preview** (no ads, sign-in
  hidden). Confirmed by the owner.

## Phase 5 — Revive ads

- Plugin: `@capacitor-community/admob`.
- **Consent**: the Google UMP consent form at startup (EEA/UK). iOS App
  Tracking Transparency prompt, with an `NSUserTrackingUsageDescription` string
  in both languages.
- **Native config**:
  - Android: the app ID goes in `AndroidManifest.xml` metadata.
  - iOS: `GADApplicationIdentifier`, `SKAdNetworkItems` and the ATT string go
    in `Info.plist`.
- **Flow**:
  1. `killPlayer()` stops calling `endRun('death')` straight away.
  2. If the run hasn't used its revive, we're on the native app, and a rewarded
     ad is preloaded, show a **Revive?** panel. It has a 5-second countdown,
     **Watch ad** and **No thanks** buttons, and the pockets stay visible so the
     stakes are clear.
  3. The game stays paused while the ad plays, and `runTime` (the volcano fuse)
     is frozen.
  4. The revive is granted only on the ad's reward callback. On close without a
     reward, or on any failure → `endRun('death')`.
- **What a revive does** (values in `CFG.revive`):
  - restore full health
  - 3 seconds of invulnerability, shown with flashing
  - pockets kept
  - lava pushed down 6 rows below the player
  - spiders within 4 tiles knocked back and stunned
  - falling blocks around the player removed
  - a stolen gem already flying away stays stolen
- `revived = true` is recorded on the run.
- Preload the next ad when a run starts, so the button is ready at the moment of
  death.
- Dev and debug builds use Google test units (`…3940256099942544/5224354917`
  Android, `…/1712485313` iOS) and register test devices.

## Phase 6 — Sign in with Apple / Google, account deletion

- Plugin: one social-login plugin that covers both Apple and Google natively.
  Its ID token goes to Supabase, which links it to the current anonymous user so
  history and medals carry over.
- If that Apple or Google account already has a profile, ask: "Switch to that
  profile?" The local unsynced outbox re-uploads to the chosen account. The
  anonymous profile is left behind.
- The iOS build offers Apple (and Google). The Android build offers Google.
  Offering Google on iOS requires offering Apple too.
- **Delete account** on the Profile screen calls `delete_my_account()`, wipes
  local data and starts a new anonymous profile.

## Phase 7 — Store readiness

- **Privacy policy page**: data collected = anonymous ID, display name, scores,
  and advertising ID (via AdMob). Host it on the `wuxiascrub.github.io` user site.
- **`app-ads.txt`** at `https://wuxiascrub.github.io/app-ads.txt`, served by a
  GitHub *user site* repo named `wuxiascrub.github.io` (user sites serve from
  the domain root; project sites do not). The same site hosts the privacy
  policy and a one-page HD Expanse page. Both store listings use
  `https://wuxiascrub.github.io` as the developer website. A custom domain can
  replace it later.
- **Store forms**: Google Play Data safety form and Apple App Privacy labels.
  Age rating questionnaires (cartoon violence only, so it should rate low).
- **Store assets**: screenshots (en and zh), the short and long descriptions,
  and a Chinese store title.
- **Test release**: TestFlight and a Play internal testing track before going
  public.

---

## What the owner needs to do (and when)

| When | Task |
|---|---|
| Phase 1 | Turn on Anonymous sign-ins and pg_cron in Supabase; run the migration SQL files. |
| Phase 4 | Install Xcode and Android Studio. Apple Developer account and Google Play Console account. Register App ID `com.hdexpanse.forevermine` and reserve the name in App Store Connect. |
| Phase 5 | In AdMob: set up the GDPR consent message and the ATT explainer (Privacy & messaging); link the app store listings once they exist. |
| Phase 6 | **Apple**: create a Services ID and a Sign in with Apple key, then enter Team ID, Key ID and the key in Supabase → Auth → Apple. **Google**: in Google Cloud, create OAuth client IDs (Web, iOS, Android; the Android one needs the signing certificate SHA-1), then enter the Web client ID and secret in Supabase → Auth → Google. I'll write step-by-step instructions when we get there. |
| Phase 7 | Create the `wuxiascrub.github.io` repo (I fill it: privacy policy, `app-ads.txt`, company page) and enable Pages on it. Fill in the store forms. |

## Settled questions

1. **Chinese title**: 矿世奇财：宝石狂潮.
2. **Web build**: GitHub Pages stays as a dev/test preview.
3. **Domain**: no custom domain for now. `app-ads.txt` and the privacy policy live on the `wuxiascrub.github.io` user site. Apple organization enrollment and D-U-N-S are already done.

## Order of work and checkpoints

1. Phase 0 + Phase 1 → schema live. Check: a test anonymous user can submit a
   run and read the boards.
2. Phase 2 → playable on the web with online boards and offline sync.
3. Phase 3 → daily mine and medals working. Check by awarding medals for a test
   date by hand.
4. Phase 4 → app runs on your iPhone and Android device.
5. Phase 5 → revive with test ads on the devices.
6. Phase 6 → account linking and deletion.
7. Phase 7 → TestFlight and Play internal testing.

Each phase lands as its own PR.

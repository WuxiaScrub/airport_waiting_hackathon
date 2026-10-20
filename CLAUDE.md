CLAUDE.md

Game Overview

**Forever Mine: Gem Rush** (Chinese: **矿世奇财：宝石狂潮**), published by HD
Expanse LLC as a mobile app (bundle / package ID `com.hdexpanse.forevermine`).
A 2D mining roguelite inspired by classic grid-based mining games, with an
original presentation and identity.

The game itself runs entirely on the device. A thin, optional online layer
(Supabase) adds accounts, leaderboards, the daily mine's medals and run
history, and the native app adds a rewarded-ad revive — but the game must stay
fully playable offline, and nothing online may ever block or break a run.
Prioritize a polished, playable core loop over complexity.

The full roadmap for the online layer, the daily mine, the native app and ads
is `docs/PLAN-online-mobile.md`. Keep it current as phases land.

Core Loop

DESCEND → MINE → COLLECT → RISK GOING DEEPER → CHECKPOINT (SHOP) → REPEAT → CARRY IT OUT

The player starts at the surface and progressively digs deeper into a procedurally generated mine.

* Deeper = more valuable gems and greater danger.
* The player can voluntarily return upward and end the run; whatever they carry
  out through the surface camp is their score.
* There should NOT be an easy/instant return-to-surface mechanic.
* There is NO banking anywhere in the mine. Every gem the player carries is at
  risk until it reaches the surface camp, and dying loses all of it.
* Checkpoints are shops only. They are paid out of the carried gems, so every
  purchase comes straight off the final score.

Campaigns

* A campaign is a chain of mines. Escaping with the Heartstone opens the next,
  deeper mine: upgrades carry over, cash does not (what was carried out is
  score, never spendable).
* Walking out without the Heartstone, or dying, ends the campaign. Score from
  mines already escaped is kept; the current mine's pockets are lost on death.
* Nothing carries between campaigns — no vault, no permanent upgrades. Every
  campaign starts at mine 1 with base stats and 0 gems.
* Each later mine puts the Heartstone deeper (`CFG.campaign.heartstoneStep`)
  and sends more enemies (`CFG.campaign.threat`). Mine 1 is kept gentle.

Game Modes

* Endless — the campaign above. Ranked on the global endless board by campaign
  score, with mines escaped shown beside it. This is the prestige board.
* Daily Mine — one single mine per UTC day. Its TERRAIN comes from a seed
  derived from the date (and `CFG.online.genVersion`), so everyone digs the same
  mine; enemies stay random per attempt so they can't be memorised. Mine-1
  settings and base stats. The seed also rolls whether the day has gas pockets
  and/or the Tunneler (gentlest level of each), so a day has them for everyone
  or no one; the worm's timing and path stay random per attempt. Unlimited attempts; a player's best score of the day
  counts. Escaping with the Heartstone ends the daily — there is no next mine.
* The daily rolls over at 00:00 UTC. Gold, silver and bronze go to the day's
  top three once a short grace window has passed (so offline runs can sync).
  Medal counts show on the profile and beside names on every board.

Online Layer (Supabase)

* The schema lives in `supabase/migrations/`, one numbered SQL file per change,
  applied in order. Never edit a migration that has been applied — add a new one.
* Clients never write tables directly. Row-level security is on everywhere and
  every write goes through a `security definer` function that checks
  `auth.uid()` and sanity-checks its input.
* The publishable key and project URL live in `CFG.online` and are public. The
  service-role / secret key must never appear in the repo or the client.
* Players start anonymous and may link Sign in with Apple / Google later.
  Display names are unique, at most 15 characters, Unicode, profanity-filtered.
* Offline first: finished runs queue locally and upload when the device is back
  online. Uploads are idempotent (keyed by a client-made run id).
* `CFG.online.genVersion` must be bumped whenever world generation changes, or
  the same daily seed would build different mines on different builds.
* The project owner applies all Supabase changes by hand. Do not try to run
  SQL or change settings on the Supabase project yourself: write the migration
  file (tested against the local stand-in in `supabase/tests/`) and give the
  owner short step-by-step instructions — which file to paste into the SQL
  Editor, which dashboard toggle to flip, and a query to check it worked.

Revive Ads

* Native app only, AdMob rewarded units only (IDs in `CFG.ads`). No
  interstitials, no banners. Debug builds use Google's test ad units.
* One revive per run: once per campaign in Endless, once per daily attempt.
* The revive is granted only on the ad's reward callback, with the game paused
  and the eruption clock frozen while the ad plays.
* A revive must be survivable: full health, brief invulnerability, lava pushed
  back, nearby cave bugs knocked away. The pockets are kept.

Localization

The game ships in English and Simplified Chinese.

* Every user-facing string lives in `src/i18n.js`, keyed, with an entry in BOTH
  `STRINGS.en` and `STRINGS.zh`.
* Never write a display string inline. Read it with `loc('some.key')`, or mark
  static markup with `data-i18n` / `data-i18n-aria`.
* Any new feature must add both translations in the same change. A key missing
  from `zh` falls back to English and warns — it is a bug, not a default.
* The language follows the browser on first load, is switchable from every menu,
  and persists separately from the save file.

Mobile Controls

Design for smartphone touchscreens first.

* Virtual joystick: horizontal axis moves, vertical axis AIMS the tool. Aim
  snaps to 8 directions — a held diagonal targets the corner tile. The stick is
  always drawn on screen in a fixed spot (never under the thumb, which would
  hide it) with a
  knob for the push and a rim arrow for the direction being aimed at.
* Three action buttons, one verb each. There is NO tool selector and no
  equipped-tool state — the button you press is the thing that happens.
  - MINE — hold to swing the pickaxe at the tile you are aiming at.
  - JUMP — hold for height.
  - DYNAMITE — tap to place one stick on the aimed tile.
* Support keyboard/mouse on desktop as a secondary control scheme.

Controls should be simple, responsive, and comfortable on small screens.

Terrain

Initial terrain types:

1. Empty — walkable.
2. Soft Dirt/Clay — mineable and affected by gravity.
3. Rock — solid and cannot be mined.
4. Gem Tile — mineable tile containing a gem.

Soft Dirt

* Requires two pickaxe hits to completely destroy.
* First hit weakens the tile.
* A weakened tile falls after a delay if unsupported. The delay is deliberately
  generous (see `CFG.mining.fallDelay`) so a collapse can be read and dodged.
* Falling dirt settles onto the next solid tile below.
* A falling block damages the player — unless a hard hat absorbs it.
* Terrain manipulation should be an important part of gameplay.

Player Physics

* Gravity applies to the player as well as to dirt.
* The player can jump; jump height is upgradable.
* There is no fall damage — falling dirt is the punishment for careless digging.
* Climbing back up is work: a staircase, a jump, a pile of dirt the player
  knocked loose on purpose, or the grapple below. Never add a mechanic that
  trivializes the return to the surface — no teleports, no ropes to the camp,
  no free ascent.
* Grapple: holding the stick into an adjacent solid tile while falling hooks
  the player onto it, stopping the fall, and they may jump from there. A sheer
  shaft is therefore climbable, but only one jump at a time and only where
  there is wall to catch — the ascent still costs the time the mine can use to
  fall on them, and lava does not wait.

Dynamite

* Place on a nearby tile.
* Short fuse followed by an explosion.
* Destroys everything within a 1-tile radius, including diagonals (3×3 area).
  The Big Bang upgrade widens this to 2 tiles (5×5).
* Can be used for mining, escape, and combat.

Gems

Start with exactly four gem types:

* Sapphire — lowest value
* Emerald
* Ruby
* Diamond — highest value

Gem values should increase with depth.

Clearly distinguish carried (at-risk) loot from score already secured by escaping a mine.

Enemies

Start with two enemy types.

Cave Bug

The primary combat threat.

* Hunts the player.
* Can dig through soft dirt / navigate the mine.
* If it gets a clear path to the player, it aggressively pursues/pounces.
* Deals health damage.
* Behavior must be readable and fair.
* Simple stylized 2D sprite/animation is sufficient.

Gem Thief / Bat

The secondary economic threat.

* Small stylized bat.
* CANNOT dig. It flies, and steers around solid tiles — open air is the only
  route it has to the player. Only the Cave Bug digs.
* Does NOT directly damage the player.
* Can approach and steal one unbanked gem.
* When this happens, visibly animate the gem/score count decreasing.
* The stolen gem should visibly appear with the bat.
* The bat then attempts to flee.
* If killed before escaping, the stolen gem can be recovered.

This enemy threatens the player’s loot, rather than their health.

Later-Mine Hazards

Two hazards join the campaign gradually; mine 1 has neither. Each shows a
one-off "new danger" card the first time a player meets it on a device.

* Gas pockets (from mine 2, more in every later mine up to a cap) — seams of soft dirt hiding
  firedamp, told apart only by faint bubbles in the headlight. The first swing
  hisses; breaking one releases a cloud that drifts up the tunnels. Harmless
  until a dynamite blast or the lava lights it: the flame races through the
  cloud, bursts any pocket it touches, hurts the player and kills enemies.
  Gas is terrain, so it is part of seeded generation.
* The Tunneler (from mine 3: 1 pass, one more each mine up to 6, with the
  waits between passes shrinking too) — a great worm that
  crosses the mine side to side near the player's row, never during the
  eruption. It rumbles and shows a red band on its row before breaking in,
  bores through soft dirt (rock it slides past), hurts what it touches, and
  loosens the dirt over its tunnel so a collapse follows. It cannot be killed.

Do not add more enemy types until the core game is polished.

Player Progression

Checkpoints contain a simple shop, paid from carried gems.

Initial upgrades:

* Maximum health
* Movement speed
* Jump height
* Headlight/visibility range
* Dynamite capacity
* Hard hat — absorbs falling dirt, one charge per level, re-forms over time
* Big Bang — one expensive level; dynamite clears 5×5 instead of 3×3
* Sharpened Pick — chance a swing breaks soft dirt in one hit: 30% at the first
  level, +10% a level, 100% at the eighth

Keep upgrades simple and data-driven.

Dynamite is a consumable the shop SELLS. Reaching a checkpoint never refills
the satchel for free — spending gems on charges is part of the risk budget. A
mine still starts with a full satchel, and the hard hat still re-forms for free.

Headlights

Default visibility should be limited.

Better headlights:

* Reveal more of the mine.
* Reduce surprises.
* Help identify enemies and terrain earlier.

Visibility should be a meaningful gameplay mechanic rather than merely a visual effect.

Depth & Difficulty

As the player descends:

* Gem values increase.
* Enemy frequency/difficulty increases.
* Mine layouts become more challenging.
* Risk/reward increases.

Avoid arbitrary difficulty spikes. Difficulty should emerge from terrain, visibility, enemies, and the increasing value of unbanked loot.

Heartstone / Endgame

At extreme depth, the player can discover the Heartstone, an exceptionally valuable objective.

When collected:

THE VOLCANO AWAKENS

Immediately trigger a major escalation:

* Lava begins rising/spreading.
* The mine becomes increasingly dangerous.
* The player must escape upward.
* The player cannot teleport or instantly return to safety.
* The escape uses the mine that the player created during the run.

The Heartstone should be the game’s major climax. It is worth a flat
`CFG.gems.heartstoneValue` (7,000), paid only if it reaches the surface camp,
and it is never spendable at a lantern on the way up. Carrying it out opens
the next mine of the campaign.

Normal runs do not require an escape timer. The player can voluntarily cash out by returning upward, but the Heartstone creates the forced escape sequence.

Replayability

The game should be highly replayable through procedural generation.

Randomize:

* Mine layouts
* Gem placement
* Enemy placement
* Enemy encounters
* Difficulty progression
* Valuable/interesting areas

Use a strong “one more run” structure.

Make balancing values centralized and easy to tune.

Visual Style

Prioritize polish over asset quantity.

Use a clean, stylized 2D/pixel-art-inspired aesthetic.

Do NOT depend on external art assets for the initial version.

Claude should generate simple sprites, animations, particles, UI, and effects itself where practical.

Prioritize:

* Clear terrain readability
* Good animation
* Gem sparkle
* Mining effects
* Dirt falling
* Dynamite explosions
* Enemy hit/death effects
* Lava effects
* Screen shake
* Strong UI feedback
* Atmospheric lighting/visibility

The game should look intentional and polished despite using simple assets.

Audio

Audio is optional but encouraged.

Structure the code so external music/SFX can easily be added later.

Basic Web Audio synthesized effects are acceptable for:

* Mining
* Gem collection
* Dynamite
* Enemy attacks
* Damage
* UI
* Lava
* Alerts

Do not delay gameplay development waiting for audio assets.

Technical Requirements

* The game runs client-side. The only backend is Supabase (auth, leaderboards,
  history, medals); no other servers.
* No multiplayer beyond asynchronous leaderboards.
* Ships as a native iOS / Android app via Capacitor wrapping the same
  JS/Canvas code. GitHub Pages stays as a dev/test preview with no ads.
  `npm run build` copies the game into `www/`; `ios/` and `android/` are
  committed native projects whose copy of the game is generated, so never edit
  it. Everything app-only goes through `src/native.js`, which is a no-op in the
  browser. Build steps are in `docs/BUILD-mobile.md`.
* The game code itself still has no bundler: plain `<script>` tags. Third-party
  code is vendored at a pinned version.
* Optimize for modern smartphones.
* Avoid unnecessary dependencies.
* Keep architecture simple and maintainable.
* Keep game/balance values centralized.
* Use procedural generation rather than handcrafted levels.
* Prefer straightforward JavaScript/Canvas architecture over unnecessary game-engine complexity.

Implementation Priority

Build in this order:

1. Player movement + mobile joystick
2. Grid and mining
3. Falling dirt
4. Gems + scoring
5. Dynamite
6. Procedural mine generation
7. Visibility/headlights
8. Cave Bug
9. Bat gem thief
10. Checkpoints + banking
11. Shop/upgrades
12. Depth-based difficulty
13. Heartstone + volcano escape
14. Audio, particles, animation, and visual polish
15. Mobile performance/UX pass

The priority is a complete, fun playable loop—not a large amount of content.

Do not overengineer. When there are multiple implementation options, choose the simplest one that produces the intended gameplay.

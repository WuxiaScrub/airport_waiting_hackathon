# DEEPCUT

A mobile-first 2D mining roguelite that runs entirely in the browser. No build
step, no dependencies, no backend, no art assets — every sprite, particle and
sound effect is generated in code at runtime.

**Dig down. Bank what you find. Don't wake the volcano.** (Wake the volcano.)

Playable in English and Simplified Chinese (简体中文) — the language follows the
browser on first load and can be switched from any menu.

---

## Play it

**Locally** — any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from the filesystem also works: the scripts are
plain `<script>` tags rather than ES modules, precisely so `file://` is a valid
way to test.

**On GitHub Pages** — `.github/workflows/pages.yml` publishes the repository
root on every push to `main`. Enable it once under *Settings → Pages → Source →
GitHub Actions*.

## Controls

|            | Touch                                   | Keyboard                |
| ---------- | --------------------------------------- | ----------------------- |
| Move       | Drag left/right on the left half         | `A` / `D` or ← / →      |
| Aim        | Push the stick up or down                | `W` / `S` or ↑ / ↓      |
| Mine / hit | Hold **MINE**                            | Hold `J` / `Enter`      |
| Jump       | Tap **JUMP**                             | `Space` (hold for height) |
| Dynamite   | Tap **BOMB** (drops at your feet)        | `F`                     |
| Pause      | —                                        | `Esc`                   |
| Mute       | Pause menu                               | `M`                     |

Three buttons, three verbs, no mode to be in: there is no tool to select first,
so the button you press is the thing that happens.

The joystick is *floating*: it appears wherever your thumb lands, so you never
have to look down for it. The vertical axis **aims** rather than moves — gravity
owns up and down — so push down to dig the floor out from under yourself and up
to chew at the ceiling.

## The loop

Descend → mine → collect → risk going deeper → checkpoint → shop → repeat.

- **You start underground.** Somebody has already cut the first few rows; the
  run opens at the bottom of that shaft with the camp lantern a few tiles to one
  side, up a single step. The way out is the way back in.
- **You fall.** Gravity applies to the miner as well as the dirt. Getting back
  up is a jump, a staircase you cut on the way down, a pile of dirt you knocked
  loose on purpose, or the grapple — hold the stick into a wall while falling
  and the hook catches. Climbing is always work, which is what keeps "climb out
  the way you came" an actual decision.
- **Soft dirt** takes two pickaxe hits. The first hit only *weakens* it, and
  weakened dirt with nothing beneath it hangs for ~0.9 s before falling and
  settling on the next solid tile below. Intact dirt is structural and never
  falls, so collapses are something you cause on purpose — including onto a
  spider, or onto your own head. A **hard hat** from the shop absorbs a falling
  block outright and re-forms after a few seconds.
- **Rock** is immune to the pickaxe. Dynamite goes through it. Beyond the veins
  the noise lays down, loose boulders are scattered through every stretch
  between stations, and there are steadily more of them the deeper you go — the
  bottom of the mine is roughly five times as rocky as the top. Routing around
  them (or spending a stick) is most of what makes a deep shaft slower than a
  shallow one. The rows either side of a lantern stay clear, and no row is ever
  sealed wall to wall.
- **Dynamite** has a short fuse and flattens a 3×3, diagonals included. It is
  dropped *at your feet*, not at what you are aiming at, and it falls like
  everything else down here — so you place it and run, and a stick dropped over
  a shaft goes down the shaft. Mining tool, escape tool, and weapon.
- **Gems** — sapphire, emerald, ruby, diamond — are worth more the deeper you
  find them. What you carry is *unbanked* and lost if you die.
- **Checkpoint lanterns** span the full width of the mine every ~34 m, so any
  descent will run into one. They bank your gems and open the shop, which sells
  exactly two consumables — a full heal and a full satchel of dynamite, both
  expensive. A lantern down in the mine **lights once**: it burns out as you
  leave, so what you buy there is a single decision, not a refill station. Only
  the surface camp can be walked back into. Nothing blasts a lantern, either —
  dynamite goes straight through the rock around it and leaves the post standing.
  Their rock floors always keep a few soft patches, one of them within sight of
  the lantern, so an empty satchel never means a dead end.
- **Your headlamp is the only light.** Terrain you have already seen stays
  faintly visible as memory, but anything alive in an unlit tunnel is invisible.
  The lamp upgrades in small increments on purpose — a fully kitted miner still
  works in the dark, and the dark stays an opponent rather than a starter
  problem you buy your way out of.
- **The mountain is on a clock.** Ten minutes into a run the volcano erupts by
  itself, Heartstone or not. The HUD counts it down from the first second and
  warns at 5:00, 1:00 and 0:15, so every descent is a bet against a deadline you
  can see: bank early and surface, or push one more shaft and climb out ahead of
  the lava.

### What's down there

- **Spiders** hunt you, chew through soft dirt to reach you, and pounce when
  they have a clear line. Every pounce is preceded by a visible wind-up: they
  freeze, their eyes flare, and a dashed line shows exactly where they're going.
- **Bats** ignore your health and go for your wallet. One touch and they take
  your single most valuable unbanked gem, which then dangles visibly beneath
  them as they flee. Kill the thief before it escapes and the gem drops back
  into the mine. Unlike spiders they *cannot dig* — they fly, and they steer
  around solid tiles, so the only way one reaches you is through open air. Seal
  yourself in and your loot is safe from them.

### The Heartstone

At 150 m there is a rock-shelled chamber holding the Heartstone. Take it and
**the volcano awakens**: lava floods the mine from below and rises steadily. It
melts everything but bedrock, there is no teleport out, and the only route home
is the tunnel network you dug on the way down. The bounty pays out only at the
surface camp.

Taking the Heartstone is the *early* trigger. Left alone, the same eruption
arrives on the ten-minute clock anyway — the Heartstone just buys it forward in
exchange for the biggest payout in the game.

### Scores

A score is the gold a single run **banked** — wealth secured at a lantern or the
camp. Gems still in your pockets when the lava caught you never count, so the
board rewards cashing out rather than diving. The top five hauls show on the
title screen and again on the run summary, with the row you just set picked out.

Only a personal board exists today, kept in `localStorage`. `src/highscore.js`
is written so a **global board drops in without touching anything else**:

```js
Highscore.useBackend({
  name: 'my-board',
  submit(entry) { /* -> Promise<void> */ },
  top(n)        { /* -> Promise<entry[]> */ },
});
```

Every finished run is then handed to that backend alongside the local write, and
`Highscore.globalTop(n)` returns a promise the panel can render. There is no
network code in the file: the game is a static site, and a board that is down
must never break a run.

## Layout

```
index.html          markup + HUD + touch controls
styles.css          UI shell (the canvas draws only the mine)
src/config.js       ← every balance number in the game
src/i18n.js         ← every user-facing string, in English and 简体中文
src/util.js         math, seeded RNG, value noise
src/highscore.js    banked-haul board (local today, global backend ready)
src/guard.js        refresh / Back confirmation while a run is live
src/audio.js        Web Audio synthesis (swap for samples here)
src/world.js        tile grid, procedural generation, dirt physics, lava
src/particles.js    particles, floating text, screen-space gem flights
src/entities.js     gem pickups, lit dynamite, falling blocks
src/enemies.js      Spider, Bat
src/player.js       gravity, jumping, mining, tools, damage, hard hat
src/input.js        floating joystick, buttons, keyboard
src/render.js       procedural sprite atlas + the two-layer lighting composite
src/ui.js           HUD syncing and modal panels
src/game.js         state machine, run lifecycle, spawning, economy
src/main.js         boot
```

### Tuning

`src/config.js` holds everything: gem values and rarity by depth, enemy speeds
and telegraph timings, lava rise rate and eruption fuse, upgrade costs and level
counts, light radius, spawn rates. Nothing gameplay-facing is hard-coded
elsewhere. Two stats also carry a ceiling — `player.maxHealthCap` (10 hearts)
and `dynamite.capacityCap` (20 sticks) — and their upgrade `max` is tuned to
land exactly on it; `Player.maxHealthFor()` and friends are the single place a
level becomes a number, including for the price tags in the shop. The game object is exposed as
`window.game` for poking at from the console.

Two notes for anyone extending this:

- **Lighting is a composite, not an overlay.** `render.js` draws remembered
  terrain dim, draws everything else at full brightness into a second canvas,
  and masks that canvas with the union of all light sources. The lights must be
  unioned into their own buffer first — compositing them one at a time with
  `destination-in` intersects them instead, which blacks out the screen.
- **Audio is one function.** `Sfx.play(name)` maps names to synth recipes; point
  those names at decoded buffers to drop in real sound effects later.
- **A live run exists only in memory.** The save file holds banked gold and
  upgrades, nothing else, so `src/guard.js` stands between a stray tap and a
  lost descent: `beforeunload` covers a reload or a closed tab (the browser
  draws that prompt, and ignores our wording), while the Back button is caught
  by a spare same-document history entry the first press lands on, which lets
  the game ask in its own panel instead. Both ask `game.runAtRisk()`, so neither
  fires on the title screen or a finished run.
- **No string is written inline.** Every player-visible word lives in
  `src/i18n.js` under a key present in *both* `en` and `zh`, and is read with
  `loc('some.key')` (or a `data-i18n` attribute in `index.html`). Adding a
  feature means adding both translations — a key missing from `zh` falls back to
  English and warns in the console rather than failing quietly.

### Deliberately not built

Two enemies only, and no third until these two are properly tuned. No tool
selector — three buttons that each do one thing beat two buttons and a mode.
No fall damage on the player — falling *dirt* already punishes careless digging, and
stacking both makes vertical movement feel punitive rather than tense.

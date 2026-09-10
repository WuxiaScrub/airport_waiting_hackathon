CLAUDE.md

Game Overview

Build a mobile-first 2D browser mining roguelite inspired by classic grid-based mining games, but with an original presentation and identity.

The game must run entirely client-side and be deployable as a static site on GitHub Pages. Prioritize a polished, playable core loop over complexity.

Core Loop

DESCEND → MINE → COLLECT → RISK GOING DEEPER → CHECKPOINT → SHOP → REPEAT

The player starts at the surface and progressively digs deeper into a procedurally generated mine.

* Deeper = more valuable gems and greater danger.
* The player can voluntarily return upward and end the run, preserving their banked score.
* There should NOT be an easy/instant return-to-surface mechanic.
* Gems collected since the last checkpoint are unbanked and can be lost before being secured.
* Checkpoints bank the player’s collected wealth and provide access to the shop.

Mobile Controls

Design for smartphone touchscreens first.

* Virtual joystick for movement.
* One primary action button.
* Tool selector for switching equipment.
* Pickaxe is the default tool.
* Pickaxe + action button = mine adjacent tile.
* Dynamite + action button = place dynamite.
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
* A weakened tile falls after a short delay if unsupported.
* Falling dirt settles onto the next solid tile below.
* Terrain manipulation should be an important part of gameplay.

Dynamite

* Place on a nearby tile.
* Short fuse followed by an explosion.
* Destroys everything within a 1-tile radius, including diagonals (3×3 area).
* Can be used for mining, escape, and combat.

Gems

Start with exactly four gem types:

* Sapphire — lowest value
* Emerald
* Ruby
* Diamond — highest value

Gem values should increase with depth.

Clearly distinguish unbanked loot from banked wealth.

Enemies

Start with two enemy types.

Spider

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
* Does NOT directly damage the player.
* Can approach and steal one unbanked gem.
* When this happens, visibly animate the gem/score count decreasing.
* The stolen gem should visibly appear with the bat.
* The bat then attempts to flee.
* If killed before escaping, the stolen gem can be recovered.

This enemy threatens the player’s loot, rather than their health.

Do not add more enemy types until the core game is polished.

Player Progression

Checkpoints contain a simple shop.

Initial upgrades:

* Maximum health
* Movement speed
* Headlight/visibility range
* Dynamite capacity

Keep upgrades simple and data-driven.

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

The Heartstone should be the game’s major climax.

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

* Client-side only.
* No backend.
* No database.
* No authentication.
* No multiplayer.
* Static deployment to GitHub Pages.
* Mobile browser is the primary target.
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
8. Spider
9. Bat gem thief
10. Checkpoints + banking
11. Shop/upgrades
12. Depth-based difficulty
13. Heartstone + volcano escape
14. Audio, particles, animation, and visual polish
15. Mobile performance/UX pass

The priority is a complete, fun playable loop—not a large amount of content.

Do not overengineer. When there are multiple implementation options, choose the simplest one that produces the intended gameplay.

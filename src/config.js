/* ============================================================================
 * CFG — every balance number in the game lives here. Tune this file, not the
 * systems. Distances are in TILES, times in SECONDS, speeds in tiles/second.
 * ========================================================================== */

const CFG = {

  render: {
    tile: 32,            // world units per tile (the renderer scales from this)
    viewTiles: 13.5,     // tiles visible across the narrow screen axis
    maxDpr: 1.75,        // cap device pixel ratio — phones lie about their GPUs
    memoryAlpha: 0.19,   // brightness of remembered-but-unlit terrain
    camLerp: 9,          // camera follow stiffness
  },

  world: {
    width: 40,           // columns (walls are indestructible bedrock)
    surfaceRow: 6,       // first row of ground; rows above are open sky/camp
    checkpointEvery: 34, // rows between checkpoint stations
    heartstoneRow: 150,  // depth of the Heartstone chamber in the FIRST mine
                         // (later mines push it down — see `campaign`)
    bottomPad: 12,       // rows of mine below the chamber before bedrock
    floorRock: 25,       // rows of bedrock drawn under the floor so the camera
                         // keeps travelling past the bottom instead of stopping
    caveScale: 7.5,      // noise frequency for caverns
    rockScale: 4.5,      // noise frequency for rock veins

    // The run opens with the miner already down a pre-dug shaft, one step
    // below the camp. `startDepth` rows of it are cut out, and a single step
    // tile beside the shaft keeps the climb back out a two-jump affair.
    startDepth: 3,       // rows of shaft carved out under the surface lip
    campOffset: 3,       // tiles the camp lantern sits to one side of the shaft

    // A station floor that spans the full width with rock can strand a player
    // who has run out of dynamite. Every station keeps this many soft patches.
    stationGaps: 3,      // soft (mineable) patches punched through each floor
    stationGapWidth: 2,  // max tiles wide a single patch can be

    // Loose boulders scattered through the stretches BETWEEN stations, on top
    // of the noise veins. Rock cannot be mined, so this is the knob that makes
    // a descent read as tighter the further down it goes: more tiles to route
    // around or spend a stick on, and a slower climb back out.
    scatterRock: 0.03,       // chance a dirt tile is a lone boulder, at the top
    scatterRockDepth: 0.0013,// added per row of depth
    scatterRockMax: 0.30,    // ceiling — a row must never read as a wall
    scatterRockClear: 3,     // rows either side of a station left boulder-free
  },

  player: {
    radius: 0.34,        // collision radius, in tiles (fits a 1-tile corridor)
    speed: 4.5,
    maxHealth: 3,
    // Hard ceiling on hearts, however many vests get bought. The vest upgrade's
    // level count is tuned to land exactly here.
    maxHealthCap: 10,
    invuln: 1.1,         // i-frames after taking a hit
    swingTime: 0.28,     // action cooldown
    swingReach: 1.15,    // melee reach for hitting enemies
    knockback: 9,
    light: 4.3,          // headlamp radius
    magnet: 2.1,         // gem pickup attraction radius

    // --- gravity & jumping -------------------------------------------------
    gravity: 34,         // tiles/sec^2 pulling the miner down
    maxFall: 19,         // terminal velocity (must stay under 1 tile/step)
    // 12.2 clears ~2.2 tiles, which is what it takes to climb a two-tile step.
    // Drop it and the very first hole becomes a trap.
    jumpVel: 12.2,
    jumpCut: 0.50,       // vy kept when the button is released early
    // Jump forgiveness. These are the difference between "the jump feels
    // responsive" and "I have to frame-time it": leave yourself room to be late
    // (coyote), early (buffer), and slightly off the centre of a tile (probe,
    // nudge).
    coyote: 0.20,        // grace period to still jump after walking off a ledge
    jumpBuffer: 0.22,    // a jump pressed just before landing still fires
    airControl: 0.62,    // fraction of ground steering available mid-air
    groundProbe: 0.20,   // how far below the feet counts as "standing on it"
    groundWidth: 0.90,   // fraction of the collision radius the feet probe uses
    // Corner correction. A jump up a one-tile shaft must not die on the lip of
    // the tile next door just because the miner was standing slightly off
    // centre — if this much of a sideways scrape clears the ceiling, take it.
    cornerNudge: 0.42,   // tiles the miner is shifted sideways past a corner

    // --- grapple grip ------------------------------------------------------
    // Hold the stick into a wall while falling and the miner hooks on. This is
    // how a sheer shaft is climbed: grip, jump, grip again. It is still work —
    // you only rise one jump at a time, and only where there is wall to hook.
    gripDeadzone: 0.35,  // stick push toward the wall needed to hook on
    gripReach: 0.22,     // how far past the collision radius the hook bites
    gripSlide: 0,        // tiles/sec the miner sinks while hanging (0 = holds)
    gripJumpBoost: 1.0,  // launch speed multiplier for a jump off a grip

    // --- hard hat ----------------------------------------------------------
    hatRecharge: 11,     // seconds for one dented hard-hat charge to re-form
  },

  mining: {
    dirtHits: 2,         // pickaxe hits to destroy soft dirt
    gemHits: 2,
    // Aim snaps to 8 directions. The smaller stick axis must reach this
    // fraction of the larger one before a swing counts as diagonal, so a
    // slightly sloppy "left" still digs left.
    diagonalBand: 0.45,
    fallDelay: 0.90,     // how long weakened, unsupported dirt hangs in the air
    fallSpeed: 15,       // tiles/sec terminal velocity for falling blocks
    fallDamage: 1,
  },

  dynamite: {
    capacity: 3,
    // Hard ceiling on the satchel. The satchel upgrade still adds
    // `upgradeEffect.dynamite` a level; the final level simply stops here, so
    // the shop quotes the real gain rather than a full step.
    capacityCap: 20,
    fuse: 1.35,
    // A lit stick is dropped at the miner's feet and obeys the same gravity as
    // everything else down here — it never hangs in the air.
    gravity: 40,         // tiles/sec^2
    maxFall: 15,         // terminal velocity, tiles/sec
    radius: 1,           // tile radius of destruction (1 = 3x3, diagonals in)
    blastRadius: 1.75,   // entity damage radius, in tiles
    // The Big Bang upgrade adds this much to BOTH radii per level: one level
    // turns the 3x3 into a 5x5. It clears a lot of the mine, including the
    // ledges you were going to climb back out on.
    radiusPerLevel: 1,
    enemyDamage: 6,
    playerDamage: 1,
    shake: 14,
  },

  gems: {
    // Order matters: index is the gem id used everywhere else.
    // `name` is a designer-facing label only — it is never shown to the player,
    // so it does not go through i18n. Add a key to i18n.js if that changes.
    //
    // A gem is worth a flat `value` wherever it is found. These are the old
    // depth-scaled values averaged over the mine: base 10/26/62/150 at the top
    // and ~3x that at the floor (depth 154, +1.3% per row) average to ~2x. The
    // deep game pays through the rarity table below, not through inflation.
    types: [
      { name: 'Sapphire', value: 20,  color: '#4a8fe8', glow: '#9fd0ff' },
      { name: 'Emerald',  value: 52,  color: '#3fc47a', glow: '#a8ffcf' },
      { name: 'Ruby',     value: 124, color: '#e8465e', glow: '#ffa8ba' },
      { name: 'Diamond',  value: 300, color: '#7ef0ff', glow: '#e6ffff' },
    ],
    // Rarity weights by depth. First entry whose depth is <= current wins.
    table: [
      { depth: 130, w: [10, 24, 38, 28] },
      { depth: 90,  w: [24, 33, 31, 12] },
      { depth: 45,  w: [48, 34, 15,  3] },
      { depth: 0,   w: [78, 20,  2,  0] },
    ],
    density: 0.055,      // base chance a dirt tile hides a gem
    densityDepth: 0.00022,
    // Flat prize, paid only if the Heartstone reaches the surface. It is never
    // spendable on the way up — a lantern will not take it as payment.
    heartstoneValue: 7000,
  },

  caveBug: {
    hp: 2,
    speed: 2.15,
    chargeSpeed: 6.4,
    aggro: 7.5,          // starts hunting within this range
    pounceRange: 4.2,
    telegraph: 0.38,     // wind-up before the pounce — this is the "fair" part
    chargeTime: 0.42,
    cooldown: 0.9,
    digTime: 0.85,       // seconds to chew through one soft dirt tile
    damage: 1,
    radius: 0.38,
    contactRange: 0.72,
  },

  bat: {
    hp: 1,
    speed: 3.1,
    fleeSpeed: 4.3,
    aggro: 9,
    radius: 0.32,
    stealRange: 0.6,
    escapeTime: 6.5,     // survive this long while fleeing and the gem is gone
    lookAhead: 1.5,      // steering probe distance — a bat flies around, never through
    penWindow: 3.0,      // seconds of flying measured when checking for a pen
    penDistance: 2.0,    // less ground than this in a window = walled in, give up
  },

  // Firedamp. From `fromMine` on, some soft dirt hides a pocket of gas. The
  // first swing at one hisses (the tell); breaking it lets the gas out, and
  // the cloud drifts UP your tunnels. Gas is harmless until a dynamite blast,
  // the lava, or a burning neighbour lights it — then the flame races through
  // every cell of the cloud and bursts any pocket it touches.
  gas: {
    fromMine: 2,
    // Pockets per 100 rows of mine, by mine counted from `fromMine` (the last
    // entry repeats). A daily mine with gas uses the first entry.
    pockets: [5, 7, 9, 11],
    dailyChance: 0.5,    // chance a given day's daily mine has gas
    pocketSize: [3, 6],  // tiles in one pocket
    topClear: 12,        // rows under the surface kept free of pockets
    release: 1.0,        // gas let out by breaking one pocket tile
    leak: 0.3,           // ...of which this much escapes on the first (cracking) hit
    tick: 0.1,           // seconds per diffusion step
    rise: 0.42,          // share of a cell's gas that moves up each step
    spread: 0.12,        // share that moves to each open side each step
    decay: 0.045,        // share lost per second (a cloud lasts ~20s)
    surfaceDecay: 0.6,   // ...and per second once it reaches open sky
    ignite: 0.06,        // a cell needs at least this much gas to burn
    spreadDelay: 0.06,   // seconds before a burning cell lights its neighbours
    burn: 0.4,           // seconds a cell burns
    damage: 1,
    enemyDamage: 3,
  },

  // The Tunneler. From `fromMine` on, a great worm crosses the mine a few
  // times, side to side, boring a tunnel through soft dirt (rock it slides
  // past). It doesn't hunt and can't be killed — it is a terrain event. It
  // rumbles a warning first, hurts whatever it touches, and leaves loosened
  // dirt over its tunnel, so a collapse follows it.
  worm: {
    fromMine: 3,
    // Passes per mine counted from `fromMine` (last entry repeats). A daily
    // mine with the worm uses the first entry.
    passes: [1, 2, 3],
    dailyChance: 0.4,    // chance a given day's daily mine has the worm
    firstDelay: [45, 90],// seconds into a mine before the first pass may come
    interval: [60, 110], // seconds between passes
    minDepth: 15,        // rows under the surface the player must be
    offset: 5,           // its row is within this many of the player's
    warn: 2.2,           // seconds of rumble before it breaks through
    firstWarn: 3.6,      // ...the very first time a player meets one
    speed: 5.2,          // tiles/sec, a little faster than the miner runs
    length: 7,           // body segments
    wave: 1.3,           // tiles its path undulates up and down
    loosen: 0.5,         // chance each dirt tile over the tunnel is loosened
    damage: 1,
  },

  spawn: {
    interval: 7.0,       // base seconds between spawn attempts
    intervalDepth: 0.028,// shortened by this much per row of depth
    intervalMin: 2.0,
    maxAlive: 3,
    maxAliveDepth: 55,   // +1 concurrent enemy per this many rows
    minDist: 7,          // never spawn closer than this to the player
    maxDist: 15,
    batBias: 0.42,       // share of spawns that are bats when you're carrying
    volcanoMultiplier: 0.55, // spawn interval scale once the volcano wakes
  },

  // A CAMPAIGN is a chain of mines. Escaping with the Heartstone opens the
  // next, deeper one: upgrades carry on, cash does not (what you hauled out is
  // score). Walking out without it, or dying, ends the campaign — and the next
  // one starts from mine 1 with base stats. Nothing carries between campaigns.
  campaign: {
    heartstoneStep: 30,  // rows deeper the Heartstone sits in each later mine
    fusePerMine: 90,     // extra seconds on the eruption clock per later mine
    // Enemy pressure by mine (last entry repeats). Scales both how often
    // things spawn and how many may be alive at once. Mine 1 is played on base
    // stats with nothing banked, so it is deliberately gentle.
    threat: [0.5, 0.8, 1.0, 1.2, 1.4],
  },

  checkpoint: {
    radius: 0.9,
    // A lantern down in the mine is a SHOP, never a bank: it takes payment out
    // of the gems you carry, and it burns out the moment it is used — one
    // visit, one set of decisions. The only way to keep gems is to carry them
    // out through the surface camp.
    reopenDelay: 3,      // seconds of play before the camp can open again
    reopenDist: 3,       // ...and tiles the player must step away from it first
  },

  // Consumables a lantern sells. Both are all-or-nothing and deliberately
  // expensive: a cave lantern is single use, so this is one decision rather
  // than a tap-fest, and the price has to compete with going deeper. They come
  // straight out of the carried gems — i.e. out of the score — so a miner can
  // only afford one on a rich haul, and never often.
  supplies: {
    healCost: 900,       // restore to full health
    dynamiteCost: 850,   // refill the satchel to capacity
  },

  lava: {
    startOffset: 10,     // rows below the Heartstone where the lava begins
    // Every run is on a clock, Heartstone or not: the mountain wakes on its own
    // once this much play time has passed, and the HUD counts it down. Surfacing
    // early is therefore always a live option, never a wasted trip.
    fuse: 600,           // seconds of play before the volcano erupts by itself
                         // (first mine; later mines add campaign.fusePerMine)
    warnAt: [300, 60, 15], // seconds remaining that earn a toast (descending)
    // Climbing under gravity is slower than the old free-flight ascent, so the
    // escape was re-tuned to stay winnable rather than merely survivable.
    riseSpeed: 0.52,     // rows per second
    accel: 0.0015,       // rise speed gained per second (slow squeeze)
    damage: 99,
    shakeInterval: 2.6,
  },

  // Names and descriptions live in i18n.js under `up.<id>.name` / `.desc`.
  // `max` is how many times an upgrade can be bought; where a stat also has a
  // ceiling (hearts, dynamite) the two are tuned to meet exactly.
  upgrades: [
    { id: 'health',   max: 7, base: 70,  step: 1.85 },  // 3 + 7 = 10 hearts
    { id: 'speed',    max: 5, base: 60,  step: 1.80 },
    { id: 'jump',     max: 4, base: 65,  step: 1.85 },
    { id: 'light',    max: 5, base: 80,  step: 1.75 },
    { id: 'dynamite', max: 9, base: 90,  step: 1.90 },  // 3 + 2/lvl, capped at 20
    { id: 'helmet',   max: 3, base: 55,  step: 2.00 },
    { id: 'blast',    max: 1, base: 1000, step: 1 },    // 3x3 -> 5x5 dynamite
    { id: 'pick',     max: 8, base: 500, step: 1.40 },  // 30% -> 100% one-swing dirt
  ],

  upgradeEffect: {
    health: 1,           // hearts per level
    speed: 0.11,         // fractional speed per level
    light: 0.6,          // tiles per level — light is the scarcest stat, so it
                         // climbs slowly and the dark stays a real opponent
    dynamite: 2,         // sticks per level
    helmet: 1,           // hard-hat charges per level
    jump: 1.15,          // extra launch speed per level (~+0.6 tiles of height)
    // Sharpened Pick: chance a swing breaks soft dirt outright. The first level
    // buys `pickBase`, each further level adds `pick`; 8 levels reach 100%.
    pickBase: 0.30,
    pick: 0.10,
  },

  audio: {
    master: 0.32,          // sound effects
    // Background music (see Music in src/audio.js). `volume` is each track's
    // full level; `duck` scales it while the game is paused; `fade` is the
    // crossfade in seconds.
    music: {
      tracks: {
        menu: { src: 'assets/audio/menu_loop.mp3', volume: 0.35 },
        game: { src: 'assets/audio/bgm.mp3', volume: 0.32 },
      },
      duck: 0.45,
      fade: 1.2,
    },
  },

  // The rewarded-ad revive: once per run, and it has to be survivable.
  revive: {
    delay: 0.9,          // seconds of death animation before the offer
    offer: 6,            // seconds the offer stays up before it declines itself
    invuln: 3,           // seconds of invulnerability after getting back up
    lavaPush: 7,         // rows of clear air the lava is pushed below the miner
    clearRadius: 4,      // tiles: cave bugs knocked away, falling dirt removed
    stun: 2.5,           // seconds knocked-away cave bugs stay dazed
  },

  // The miner who plays behind the title screen (src/demo.js). A fresh mine
  // replaces the demo's after `maxTime` seconds, below `maxDepth`, or once the
  // miner has been stuck for `stuckReset` seconds.
  demo: {
    maxTime: 110,
    maxDepth: 45,
    stuckReset: 5,
    fightRange: 1.9,     // tiles: an enemy this close gets the pickaxe
    gemReach: 3,         // tiles sideways the miner will tunnel for a gem
    tunnelEvery: 6,      // tiles of depth between exploratory side tunnels
    boomEvery: [16, 26], // seconds between sticks of dynamite
    volume: 0.35,        // the demo's sound effects, relative to the real game's
    // Enemies come sooner and more often than in a real run, so the demo
    // shows a fight or a theft most times round.
    spawnDepth: 3,       // rows down before anything spawns (a real run: 6)
    spawnRate: 3,        // spawn attempts this many times as often
    extraAlive: 2,       // more enemies allowed at once
    batBias: 0.5,        // share of spawns that are bats once the miner carries gems
    camLift: 0.23,       // the miner sits this fraction of the screen above centre, clear of the menu
  },

  // Lifetime achievements. Each reads one counter from the save (see
  // Stats.value in src/stats.js) and one bar per level, I, II, III… in order.
  // Add a bar to the end of a list to give that achievement another level.
  // `lower` marks a time in seconds, where coming in under the bar counts.
  // Names and descriptions live in i18n.js under `ach.<id>.name` / `.desc`.
  achievements: [
    { id: 'sapphire', stat: 'sapphire',      levels: [50, 300, 1500] },
    { id: 'emerald',  stat: 'emerald',       levels: [25, 150, 750] },
    { id: 'ruby',     stat: 'ruby',          levels: [10, 75, 400] },
    { id: 'diamond',  stat: 'diamond',       levels: [5, 40, 200] },
    { id: 'heart',    stat: 'hearts',        levels: [1, 10, 50] },
    { id: 'caveBug',  stat: 'caveBugs',      levels: [10, 50, 250] },
    { id: 'bat',      stat: 'bats',          levels: [5, 25, 100] },
    { id: 'pick',     stat: 'pickKills',     levels: [10, 75, 300] },
    { id: 'blast',    stat: 'dynamiteKills', levels: [5, 40, 150] },
    { id: 'dirt',     stat: 'dirtKills',     levels: [1, 15, 60] },
    { id: 'thief',    stat: 'recovered',     levels: [1, 10, 50] },
    { id: 'speed',    stat: 'fastest',       levels: [480, 360, 270], lower: true },
    { id: 'loss',     stat: 'biggestLoss',   levels: [5000, 10000, 20000] },
  ],

  // The optional online layer (Supabase). Both values are public by design —
  // the publishable key only reaches what the database's row-level security
  // allows. NEVER put the service-role / secret key anywhere in this repo.
  online: {
    url: 'https://uyxpfuhedfqzvxmmjyti.supabase.co',
    key: 'sb_publishable_acqASii6zBrNZ8vDSwbxgg_HfcQltjP',
    gameVersion: '1.0.0',  // compared against app_config.min_game_version
    genVersion: 2,         // bump whenever world generation changes: the same
                           // daily seed must build the same mine for everyone
    nameCooldownDays: 30,  // mirrors app_config.name_cooldown_days (display only)
  },

  // "Save your progress": Sign in with Apple (iOS) / Google (Android). The
  // Google button only appears once the Web OAuth client ID is filled in.
  // Public value — see docs/BUILD-mobile.md for where it comes from.
  signin: {
    googleWebClientId: '',
  },

  // Pages the game links to. Hosted on the developer's GitHub user site.
  links: {
    privacy: 'https://wuxiascrub.github.io/forevermine/privacy.html',
  },

  // AdMob, used only inside the native app (rewarded revive). Public IDs.
  ads: {
    // true = Google's test ads. Keep it true for every build you run yourself
    // (tapping your own live ads can get the AdMob account banned); set it
    // to false only for the build you upload to the stores.
    test: true,
    android: { app: 'ca-app-pub-2298615637807323~3595318939', rewarded: 'ca-app-pub-2298615637807323/7422883305' },
    ios:     { app: 'ca-app-pub-2298615637807323~7639514885', rewarded: 'ca-app-pub-2298615637807323/8544393285' },
  },

  // Records and settings only. Older keys from the game's working title
  // (deepcut.save.v2 / v1) are read as a fallback until the next save; a v1 save's gold
  // belongs to an old economy and is dropped on the way.
  saveKey: 'forevermine.save.v1',
  legacySaveKeys: ['deepcut.save.v2', 'deepcut.save.v1'],
};

/* Tile ids. Anything >= DIRT that isn't LAVA/CHECKPOINT blocks movement. */
const T = {
  EMPTY: 0,
  DIRT: 1,
  ROCK: 2,
  GEM: 3,
  CHECKPOINT: 4,
  LAVA: 5,
  HEART: 6,
  BEDROCK: 7,
  GAS: 8,       // soft dirt with a pocket of firedamp inside
};

const SOLID = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 };
const MINEABLE = { 1: 1, 3: 1, 6: 1, 8: 1 };

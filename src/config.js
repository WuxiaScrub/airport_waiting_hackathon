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
    heartstoneRow: 150,  // depth of the Heartstone chamber
    bottomPad: 12,       // rows of mine below the chamber before bedrock
    caveScale: 7.5,      // noise frequency for caverns
    rockScale: 4.5,      // noise frequency for rock veins
  },

  player: {
    radius: 0.34,        // collision radius, in tiles (fits a 1-tile corridor)
    speed: 4.5,
    maxHealth: 3,
    invuln: 1.1,         // i-frames after taking a hit
    swingTime: 0.28,     // action cooldown
    swingReach: 1.15,    // melee reach for hitting enemies
    knockback: 9,
    light: 4.3,          // headlamp radius
    magnet: 2.1,         // gem pickup attraction radius

    // --- gravity & jumping -------------------------------------------------
    gravity: 34,         // tiles/sec^2 pulling the miner down
    maxFall: 19,         // terminal velocity (must stay under 1 tile/step)
    // 12.2 clears ~2.2 tiles, which is what it takes to climb out of the
    // two-deep starting shaft. Drop it and the very first hole becomes a trap.
    jumpVel: 12.2,
    jumpCut: 0.50,       // vy kept when the button is released early
    // Jump forgiveness. These three are the difference between "the jump feels
    // responsive" and "I have to frame-time it": leave yourself room to be late
    // (coyote), early (buffer), and slightly off the edge of a tile (probe).
    coyote: 0.20,        // grace period to still jump after walking off a ledge
    jumpBuffer: 0.22,    // a jump pressed just before landing still fires
    airControl: 0.62,    // fraction of ground steering available mid-air
    groundProbe: 0.20,   // how far below the feet counts as "standing on it"
    groundWidth: 0.90,   // fraction of the collision radius the feet probe uses

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
    fuse: 1.35,
    radius: 1,           // tile radius of destruction (1 = 3x3, diagonals in)
    blastRadius: 1.75,   // entity damage radius, in tiles
    enemyDamage: 6,
    playerDamage: 1,
    shake: 14,
  },

  gems: {
    // Order matters: index is the gem id used everywhere else.
    // `name` is a designer-facing label only — it is never shown to the player,
    // so it does not go through i18n. Add a key to i18n.js if that changes.
    types: [
      { name: 'Sapphire', value: 10,  color: '#4a8fe8', glow: '#9fd0ff' },
      { name: 'Emerald',  value: 26,  color: '#3fc47a', glow: '#a8ffcf' },
      { name: 'Ruby',     value: 62,  color: '#e8465e', glow: '#ffa8ba' },
      { name: 'Diamond',  value: 150, color: '#7ef0ff', glow: '#e6ffff' },
    ],
    // Rarity weights by depth. First entry whose depth is <= current wins.
    table: [
      { depth: 130, w: [10, 24, 38, 28] },
      { depth: 90,  w: [24, 33, 31, 12] },
      { depth: 45,  w: [48, 34, 15,  3] },
      { depth: 0,   w: [78, 20,  2,  0] },
    ],
    depthBonus: 0.013,   // value multiplier gained per row of depth
    density: 0.055,      // base chance a dirt tile hides a gem
    densityDepth: 0.00022,
    heartstoneValue: 4000,
    escapeBonus: 3000,   // paid on top for surfacing with the Heartstone
  },

  spider: {
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

  checkpoint: {
    radius: 0.9,
  },

  healItems: [
    { id: 'bandage', cost: 40,  amount: 1 },   // cheap: +1 HP
    { id: 'medpack', cost: 120, amount: 999 },  // expensive: restore to full HP
  ],

  // Dynamite is a consumable, not a free refill: a lantern sells it, it does
  // not hand it out. Spending the run's gems on charges is the trade.
  restock: {
    dynamiteCost: 20,    // gold per stick bought at a lantern
  },

  lava: {
    startOffset: 10,     // rows below the Heartstone where the lava begins
    // Climbing under gravity is slower than the old free-flight ascent, so the
    // escape was re-tuned to stay winnable rather than merely survivable.
    riseSpeed: 0.52,     // rows per second
    accel: 0.0015,       // rise speed gained per second (slow squeeze)
    damage: 99,
    shakeInterval: 2.6,
  },

  // Names and descriptions live in i18n.js under `up.<id>.name` / `.desc`.
  upgrades: [
    { id: 'health',   max: 5, base: 70,  step: 1.85 },
    { id: 'speed',    max: 5, base: 60,  step: 1.80 },
    { id: 'jump',     max: 4, base: 65,  step: 1.85 },
    { id: 'light',    max: 5, base: 80,  step: 1.75 },
    { id: 'dynamite', max: 5, base: 90,  step: 1.90 },
    { id: 'helmet',   max: 3, base: 55,  step: 2.00 },
  ],

  upgradeEffect: {
    health: 1,           // hearts per level
    speed: 0.11,         // fractional speed per level
    light: 1.3,          // tiles per level
    dynamite: 2,         // sticks per level
    helmet: 1,           // hard-hat charges per level
    jump: 1.15,          // extra launch speed per level (~+0.6 tiles of height)
  },

  audio: { master: 0.32 },

  saveKey: 'deepcut.save.v1',
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
};

const SOLID = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 0, 5: 0, 6: 1, 7: 1 };
const MINEABLE = { 1: 1, 3: 1, 6: 1 };

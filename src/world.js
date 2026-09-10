/* ============================================================================
 * World — the tile grid, its procedural generation, and dirt physics.
 *
 * The whole mine (40 x ~170 tiles) is generated up front: it is only ~7k cells,
 * so chunk streaming would be pure overhead.
 * ========================================================================== */

class World {
  constructor(seed, game) {
    this.game = game;
    this.seed = seed >>> 0;
    this.rng = new RNG(seed);
    this.w = CFG.world.width;
    this.h = CFG.world.heartstoneRow + CFG.world.bottomPad;
    this.surface = CFG.world.surfaceRow;

    const n = this.w * this.h;
    this.t = new Uint8Array(n);          // tile id
    this.hp = new Uint8Array(n);         // remaining pickaxe hits (dirt/gem)
    this.gem = new Uint8Array(n);        // gem type + 1, 0 = none
    this.explored = new Uint8Array(n);   // fog-of-war memory
    this.variant = new Uint8Array(n);    // visual variant index

    this.pendingFalls = new Map();       // tile index -> seconds until it drops
    this.checkpoints = [];               // {x, y} of every station anchor
    this.heartstone = { x: 0, y: 0 };
    this.spawnPoint = { x: 0, y: 0 };
    this.lavaRow = this.h + 4;           // above this row is safe; starts off-map

    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  get(x, y) {
    if (!this.inBounds(x, y)) return T.BEDROCK;
    return this.t[y * this.w + x];
  }

  set(x, y, type, hp = 0, gem = 0) {
    if (!this.inBounds(x, y)) return;
    const i = y * this.w + x;
    this.t[i] = type; this.hp[i] = hp; this.gem[i] = gem;
  }

  isSolid(x, y) { return SOLID[this.get(x, y)] === 1; }
  isMineable(x, y) { return MINEABLE[this.get(x, y)] === 1; }

  /** Is a circle of `r` tiles at world-tile position (px,py) free of walls? */
  isFree(px, py, r) {
    const x0 = Math.floor(px - r), x1 = Math.floor(px + r);
    const y0 = Math.floor(py - r), y1 = Math.floor(py + r);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (this.isSolid(x, y)) return false;
    return true;
  }

  /* ------------------------------------------------------------ generation */

  generate() {
    const { w, h, rng } = this;
    const cfg = CFG.world;
    const seed = this.seed;

    for (let y = 0; y < h; y++) {
      const depth = y - this.surface;
      // Caves open up slightly with depth; rock veins thicken.
      const caveT = 0.615 - clamp(depth, 0, 200) * 0.00035;
      const rockT = 0.775 - clamp(depth, 0, 200) * 0.00085;
      const gemP = CFG.gems.density + Math.max(0, depth) * CFG.gems.densityDepth;

      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        this.variant[i] = (hash2(x, y, seed ^ 0x1234) * 4) | 0;

        if (x === 0 || x === w - 1 || y === h - 1) { this.t[i] = T.BEDROCK; continue; }
        if (y < this.surface) { this.t[i] = T.EMPTY; continue; }

        const cave = fbm2(x / cfg.caveScale, y / cfg.caveScale, seed);
        if (cave > caveT && y > this.surface + 2) { this.t[i] = T.EMPTY; continue; }

        const rock = fbm2(x / cfg.rockScale + 40, y / cfg.rockScale + 40, seed ^ 0x77);
        if (rock > rockT && y > this.surface + 1) { this.t[i] = T.ROCK; continue; }

        if (y > this.surface && rng.chance(gemP)) {
          this.t[i] = T.GEM;
          this.hp[i] = CFG.mining.gemHits;
          this.gem[i] = this.rollGem(depth) + 1;
          continue;
        }

        this.t[i] = T.DIRT;
        this.hp[i] = CFG.mining.dirtHits;
      }
    }

    this.carveSurface();
    this.carveCheckpoints();
    this.carveHeartstoneChamber();
  }

  /** Gem rarity by depth — the deeper you push, the better the odds. */
  rollGem(depth) {
    const table = CFG.gems.table;
    for (let i = 0; i < table.length; i++) {
      if (depth >= table[i].depth) return this.rng.weighted(table[i].w);
    }
    return 0;
  }

  /** The camp: an open shelf with the home checkpoint the run cashes out at. */
  carveSurface() {
    const cx = (this.w / 2) | 0;
    for (let x = 1; x < this.w - 1; x++) {
      // A rocky lip along the surface so the camp reads as a solid ledge.
      const i = this.idx(x, this.surface);
      if (this.t[i] !== T.BEDROCK) { this.t[i] = T.ROCK; this.hp[i] = 0; this.gem[i] = 0; }
    }
    // Punch a starting shaft so the first dig is obvious.
    for (let y = this.surface; y < this.surface + 2; y++) this.set(cx, y, T.DIRT, CFG.mining.dirtHits);

    this.set(cx, this.surface - 1, T.CHECKPOINT);
    this.checkpoints.push({ x: cx, y: this.surface - 1, home: true });
    this.spawnPoint = { x: cx + 0.5, y: this.surface - 1 + 0.5 };
  }

  /**
   * Checkpoints span the full width of the mine. That guarantees the player
   * finds one on any descent — no hunting for a hidden room in the dark.
   */
  carveCheckpoints() {
    const every = CFG.world.checkpointEvery;
    for (let r = this.surface + every; r < CFG.world.heartstoneRow - 12; r += every) {
      for (let x = 1; x < this.w - 1; x++) {
        this.set(x, r, T.EMPTY);
        this.set(x, r + 1, T.EMPTY);
        this.set(x, r + 2, T.ROCK);   // station floor
      }
      const cx = this.rng.int(5, this.w - 6);
      this.set(cx, r + 1, T.CHECKPOINT);
      this.checkpoints.push({ x: cx, y: r + 1, home: false });
    }
  }

  /** The Heartstone sits in a rock-ringed cavern at the bottom of the mine. */
  carveHeartstoneChamber() {
    const cy = CFG.world.heartstoneRow;
    const cx = this.rng.int(8, this.w - 9);
    const rx = 6.5, ry = 4.2;

    for (let y = cy - 7; y <= cy + 7; y++) {
      for (let x = cx - 9; x <= cx + 9; x++) {
        if (!this.inBounds(x, y) || this.get(x, y) === T.BEDROCK) continue;
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1) this.set(x, y, T.EMPTY);
        else if (d < 1.75) this.set(x, y, T.ROCK);   // the shell you must blast
      }
    }
    // A pedestal of rock under the prize.
    for (let x = cx - 2; x <= cx + 2; x++) this.set(x, cy + 1, T.ROCK);
    this.set(cx, cy, T.HEART, 3);
    this.heartstone = { x: cx, y: cy };

    // A ring of high-tier gems as bait.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      const gx = Math.round(cx + Math.cos(a) * 5.4);
      const gy = Math.round(cy + Math.sin(a) * 3.4);
      if (this.get(gx, gy) === T.ROCK) {
        this.set(gx, gy, T.GEM, CFG.mining.gemHits, this.rng.int(2, 3) + 1);
      }
    }
  }

  /* --------------------------------------------------------------- mining */

  /**
   * Apply one pickaxe hit. Returns 'broke' | 'hit' | 'hard' | null.
   * Weakened dirt becomes a fall candidate — that is the whole gravity rule.
   */
  damage(x, y, amount = 1) {
    if (!this.inBounds(x, y)) return null;
    const i = this.idx(x, y);
    const type = this.t[i];
    if (type === T.ROCK || type === T.BEDROCK) return 'hard';
    if (!MINEABLE[type]) return null;

    this.hp[i] -= amount;
    if (this.hp[i] <= 0) { this.destroy(x, y); return 'broke'; }
    this.queueFall(x, y);
    return 'hit';
  }

  /** Remove a tile, drop whatever it held, and re-check nearby supports. */
  destroy(x, y, opt) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    const type = this.t[i];
    if (type === T.BEDROCK) return;

    const g = this.game;
    if (type === T.GEM && this.gem[i] > 0) {
      g.spawnGem(x + 0.5, y + 0.5, this.gem[i] - 1);
    } else if (type === T.HEART) {
      g.spawnHeartstone(x + 0.5, y + 0.5);
    }

    if (g && g.fx) {
      const pal = type === T.ROCK ? ['#8b8f9c', '#6b6f7c', '#a9adb8']
                : type === T.GEM  ? [CFG.gems.types[Math.max(0, this.gem[i] - 1)].color, '#7a5a3a', '#5d4429']
                : ['#8a6440', '#6f4f31', '#a97c4f'];
      g.fx.burst(x + 0.5, y + 0.5, 9, pal);
    }

    this.t[i] = T.EMPTY; this.hp[i] = 0; this.gem[i] = 0;
    this.pendingFalls.delete(i);
    this.checkNeighbours(x, y);
  }

  /** Any weakened dirt around a change might now be unsupported. */
  checkNeighbours(x, y) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        this.queueFall(x + dx, y + dy);
  }

  /** Only *weakened* dirt falls; intact dirt is structural. */
  queueFall(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if (this.t[i] !== T.DIRT || this.hp[i] >= CFG.mining.dirtHits) return;
    if (this.isSolid(x, y + 1)) { this.pendingFalls.delete(i); return; }
    if (!this.pendingFalls.has(i)) this.pendingFalls.set(i, CFG.mining.fallDelay);
  }

  update(dt) {
    if (this.pendingFalls.size === 0) return;
    const drop = [];
    for (const [i, t] of this.pendingFalls) {
      const nt = t - dt;
      const x = i % this.w, y = (i / this.w) | 0;
      if (this.t[i] !== T.DIRT || this.isSolid(x, y + 1)) { drop.push(i); continue; }
      if (nt <= 0) { drop.push(i); this.releaseBlock(x, y); }
      else this.pendingFalls.set(i, nt);
    }
    for (const i of drop) this.pendingFalls.delete(i);
  }

  releaseBlock(x, y) {
    const i = this.idx(x, y);
    this.t[i] = T.EMPTY; this.hp[i] = 0;
    this.game.spawnFallingBlock(x, y);
    this.checkNeighbours(x, y);
  }

  /** Dynamite: flatten a 3x3, bedrock excepted. */
  explode(cx, cy) {
    const r = CFG.dynamite.radius;
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (this.get(x, y) !== T.BEDROCK && this.get(x, y) !== T.EMPTY) this.destroy(x, y);
    this.checkNeighbours(cx, cy);
  }

  /* ----------------------------------------------------------------- lava */

  /** Uniformly floods the mine from below. Nothing but bedrock survives. */
  riseLava(toRow) {
    const from = Math.min(this.h - 1, Math.ceil(this.lavaRow));
    const to = Math.max(0, Math.floor(toRow));
    for (let y = from; y >= to; y--) {
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.t[i] === T.BEDROCK || this.t[i] === T.LAVA) continue;
        if (this.t[i] === T.GEM || this.t[i] === T.HEART) { this.gem[i] = 0; }
        this.t[i] = T.LAVA; this.hp[i] = 0;
      }
    }
    this.lavaRow = toRow;
  }
}

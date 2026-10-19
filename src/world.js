/* ============================================================================
 * World — the tile grid, its procedural generation, and dirt physics.
 *
 * The whole mine (40 x ~170 tiles) is generated up front: it is only ~7k cells,
 * so chunk streaming would be pure overhead.
 * ========================================================================== */

class World {
  /**
   * `heartRow` is where this mine's Heartstone sits — deeper in later mines.
   * `gasPockets` is how many gas pockets per 100 rows it hides (0 = none).
   */
  constructor(seed, game, heartRow, gasPockets) {
    this.game = game;
    this.seed = seed >>> 0;
    this.rng = new RNG(seed);
    this.heartRow = heartRow || CFG.world.heartstoneRow;
    this.gasPockets = gasPockets || 0;
    this.w = CFG.world.width;
    this.h = this.heartRow + CFG.world.bottomPad;
    this.surface = CFG.world.surfaceRow;

    const n = this.w * this.h;
    this.t = new Uint8Array(n);          // tile id
    this.hp = new Uint8Array(n);         // remaining pickaxe hits (dirt/gem)
    this.gem = new Uint8Array(n);        // gem type + 1, 0 = none
    this.explored = new Uint8Array(n);   // fog-of-war memory
    this.variant = new Uint8Array(n);    // visual variant index
    this.gas = new Float32Array(n);      // loose firedamp in open cells
    this.gasNext = new Float32Array(n);  // scratch buffer for a diffusion step
    this.fire = new Float32Array(n);     // seconds a cell has left to burn
    this.fireSpread = new Uint8Array(n); // 1 once a burning cell lit its neighbours
    this.burning = [];                   // indices of burning cells
    this.gasLive = false;                // any loose gas at all? (skip the sim if not)
    this.gasClock = 0;

    this.pendingFalls = new Map();       // tile index -> seconds until it drops
    this.checkpoints = [];               // {x, y, home, spent} of every station
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

  /** The station record on a tile, if there is one. */
  checkpointAt(x, y) {
    for (const c of this.checkpoints) if (c.x === x && c.y === y) return c;
    return null;
  }

  /** A burnt-out lantern still draws, but it is scenery from here on. */
  isSpent(x, y) {
    const c = this.checkpointAt(x, y);
    return !!(c && c.spent);
  }

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

        // Gems are rolled first on purpose: a boulder replaces dirt that would
        // have been plain, so scattering more of them never thins the loot.
        if (this.scatterRock(y, depth)) { this.t[i] = T.ROCK; continue; }

        this.t[i] = T.DIRT;
        this.hp[i] = CFG.mining.dirtHits;
      }
    }

    this.carveSurface();
    this.carveCheckpoints();
    this.carveHeartstoneChamber();
    this.ensureRowsPassable();
    if (this.gasPockets > 0) this.placeGasPockets();
  }

  /**
   * Firedamp pockets: small blobs of soft dirt turned to gas tiles. They roll
   * on their own RNG, after everything else, so a mine without gas is built
   * exactly as it was before gas existed. Station bands, the opening shaft
   * and the Heartstone chamber stay clear.
   */
  placeGasPockets() {
    const G = CFG.gas;
    const rng = new RNG(this.seed ^ 0x6a5d39e1);
    const top = this.surface + G.topClear;
    const bottom = this.heartRow - 9;
    const n = Math.round((bottom - top) / 100 * this.gasPockets);
    for (let k = 0; k < n; k++) {
      let x = rng.int(2, this.w - 3), y = rng.int(top, bottom);
      const rel = (y - this.surface) % CFG.world.checkpointEvery;
      if (rel <= 4 || rel >= CFG.world.checkpointEvery - 2) continue;
      const size = rng.int(G.pocketSize[0], G.pocketSize[1]);
      for (let j = 0, guard = 0; j < size && guard < size * 4; guard++) {
        if (this.get(x, y) === T.DIRT) { this.set(x, y, T.GAS, CFG.mining.dirtHits); j++; }
        // Wander to a neighbour, mostly sideways, so a pocket reads as a seam.
        if (rng.chance(0.7)) x = clamp(x + (rng.chance(0.5) ? 1 : -1), 1, this.w - 2);
        else y = clamp(y + (rng.chance(0.5) ? 1 : -1), top, bottom);
      }
    }
  }

  /**
   * No row of the mine may be sealed off by rock from wall to wall — a player
   * who has spent their last stick of dynamite would have nowhere to go. The
   * bedrock floor at the very bottom is the one exception; it is the end of
   * the mine, not a wall across it.
   */
  ensureRowsPassable() {
    for (let y = this.surface; y < this.h - 1; y++) {
      let soft = 0;
      for (let x = 1; x < this.w - 1; x++) {
        const t = this.t[y * this.w + x];
        if (t !== T.ROCK && t !== T.BEDROCK) soft++;
      }
      if (soft > 0) continue;
      // Punch a couple of soft patches through, well clear of the walls.
      const n = 1 + this.rng.int(0, 1);
      for (let k = 0; k < n; k++) {
        const gx = this.rng.int(3, this.w - 4);
        this.set(gx, y, T.DIRT, CFG.mining.dirtHits);
      }
    }
  }

  /**
   * Lone boulders, sprinkled through the stretches between stations. The noise
   * veins give the mine its shape; these give it grit — single unmineable tiles
   * that have to be walked around or blasted, and there are steadily more of
   * them the deeper the shaft goes.
   *
   * Two places stay clear of them. The pre-dug shaft the run opens in, so the
   * first few swings are always soft, and a band either side of every station
   * floor, so the approach to a lantern reads the same at any depth. Rows that
   * end up sealed wall to wall are reopened later by `ensureRowsPassable()`.
   */
  scatterRock(y, depth) {
    const cfg = CFG.world;
    if (y <= this.surface + cfg.startDepth + 1) return false;

    // Station floors sit at rows surface + n*checkpointEvery .. +2.
    const rel = (y - this.surface) % cfg.checkpointEvery;
    if (rel <= 2 + cfg.scatterRockClear) return false;
    if (rel >= cfg.checkpointEvery - cfg.scatterRockClear) return false;

    const p = Math.min(cfg.scatterRockMax,
      cfg.scatterRock + Math.max(0, depth) * cfg.scatterRockDepth);
    return this.rng.chance(p);
  }

  /** Gem rarity by depth — the deeper you push, the better the odds. */
  rollGem(depth) {
    const table = CFG.gems.table;
    for (let i = 0; i < table.length; i++) {
      if (depth >= table[i].depth) return this.rng.weighted(table[i].w);
    }
    return 0;
  }

  /**
   * The camp: an open shelf with the home lantern the run cashes out at, and
   * the shaft the run starts at the bottom of.
   *
   * The miner begins underground — somebody has already cut the first few rows
   * out — with the camp a few tiles to one side rather than straight overhead,
   * so the hole reads as a hole and the lantern as a destination. A single step
   * beside the shaft keeps the climb home to two ordinary jumps.
   */
  carveSurface() {
    const cfg = CFG.world;
    const cx = (this.w / 2) | 0;
    const side = this.rng.chance(0.5) ? 1 : -1;   // which way the camp sits
    const bottom = this.surface + cfg.startDepth - 1;

    for (let x = 1; x < this.w - 1; x++) {
      // A rocky lip along the surface so the camp reads as a solid ledge.
      const i = this.idx(x, this.surface);
      if (this.t[i] !== T.BEDROCK) { this.t[i] = T.ROCK; this.hp[i] = 0; this.gem[i] = 0; }
    }

    // The shaft itself, already dug, plus a step out of it on the camp side.
    for (let y = this.surface; y <= bottom; y++) this.set(cx, y, T.EMPTY);
    for (let y = this.surface; y < bottom; y++) this.set(cx + side, y, T.EMPTY);
    // Guarantee footing: the noise pass is free to open a cavern directly under
    // the shaft, and spawning into a fall is a rotten first second.
    if (!this.isSolid(cx, bottom + 1)) this.set(cx, bottom + 1, T.DIRT, CFG.mining.dirtHits);

    const hx = cx + side * cfg.campOffset;
    this.set(hx, this.surface - 1, T.CHECKPOINT);
    this.checkpoints.push({ x: hx, y: this.surface - 1, home: true, spent: false });
    this.spawnPoint = { x: cx + 0.5, y: bottom + 0.5 };
  }

  /**
   * Checkpoints span the full width of the mine. That guarantees the player
   * finds one on any descent — no hunting for a hidden room in the dark.
   *
   * The floor under one is rock, but never solid rock from wall to wall: a
   * handful of soft patches are punched through it so a player who has run out
   * of dynamite always has somewhere to dig.
   */
  carveCheckpoints() {
    const cfg = CFG.world;
    const every = cfg.checkpointEvery;
    for (let r = this.surface + every; r < this.heartRow - 12; r += every) {
      for (let x = 1; x < this.w - 1; x++) {
        this.set(x, r, T.EMPTY);
        this.set(x, r + 1, T.EMPTY);
        this.set(x, r + 2, T.ROCK);   // station floor
      }
      const cx = this.rng.int(5, this.w - 6);
      this.set(cx, r + 1, T.CHECKPOINT);
      this.checkpoints.push({ x: cx, y: r + 1, home: false, spent: false });

      // The first soft patch is always within sight of the lantern, so the way
      // on is somewhere the player is already standing. The rest are scattered,
      // so the route down is never quite the same twice.
      for (let k = 0; k < cfg.stationGaps; k++) {
        const gw = this.rng.int(1, cfg.stationGapWidth);
        const gx = k === 0 ? clamp(cx + this.rng.int(-4, 4), 2, this.w - 2 - gw)
          : this.rng.int(2, this.w - 2 - gw);
        for (let x = gx; x < gx + gw; x++) this.set(x, r + 2, T.DIRT, CFG.mining.dirtHits);
      }
    }
  }

  /** The Heartstone sits in a rock-ringed cavern at the bottom of the mine. */
  carveHeartstoneChamber() {
    const cy = this.heartRow;
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

    // Compare before subtracting: hp is unsigned, so overshooting would wrap.
    if (this.hp[i] <= amount) { this.destroy(x, y); return 'broke'; }
    this.hp[i] -= amount;
    if (type === T.GAS) { this.leakGas(x, y); return 'hiss'; }
    this.queueFall(x, y);
    return 'hit';
  }

  /** Remove a tile, drop whatever it held, and re-check nearby supports. */
  destroy(x, y, opt) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    const type = this.t[i];
    // Bedrock is the edge of the world; a station is the one landmark a run
    // navigates by, so neither is blastable. Losing a lantern to a stray stick
    // of dynamite would strand a miner who came back up to shop.
    if (type === T.BEDROCK || type === T.CHECKPOINT) return;

    const g = this.game;
    if (type === T.GEM && this.gem[i] > 0) {
      g.spawnGem(x + 0.5, y + 0.5, this.gem[i] - 1);
    } else if (type === T.HEART) {
      g.spawnHeartstone(x + 0.5, y + 0.5);
    }

    if (g && g.fx) {
      const pal = type === T.ROCK ? ['#8b8f9c', '#6b6f7c', '#a9adb8']
                : type === T.GEM  ? [CFG.gems.types[Math.max(0, this.gem[i] - 1)].color, '#7a5a3a', '#5d4429']
                : type === T.GAS  ? ['#8a6440', '#6f4f31', '#c8d870']
                : ['#8a6440', '#6f4f31', '#a97c4f'];
      g.fx.burst(x + 0.5, y + 0.5, 9, pal);
    }

    this.t[i] = T.EMPTY; this.hp[i] = 0; this.gem[i] = 0;
    this.pendingFalls.delete(i);
    if (type === T.GAS) this.releaseGas(x, y, CFG.gas.release);
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
    this.updateGas(dt);
    this.updateFire(dt);
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

  /** Dynamite: flatten a square of radius `r` (1 = 3x3). Bedrock and stations ride it out. */
  explode(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const t = this.get(x, y);
        if (t === T.EMPTY || t === T.BEDROCK || t === T.CHECKPOINT) continue;
        this.destroy(x, y);
      }
    this.checkNeighbours(cx, cy);
  }

  /* ------------------------------------------------------------------ gas */

  /** Open air that gas can drift through. */
  isOpen(i) { const t = this.t[i]; return t === T.EMPTY || t === T.CHECKPOINT; }

  /** Put loose gas into a cell (the cell must already be open). */
  releaseGas(x, y, amount) {
    if (!this.inBounds(x, y)) return;
    this.gas[this.idx(x, y)] += amount;
    this.gasLive = true;
    const g = this.game;
    if (g && g.onGasReleased) g.onGasReleased(x + 0.5, y + 0.5, amount);
  }

  /** The tell: a cracked pocket hisses a little gas into the open air nearby. */
  leakGas(x, y) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      if (this.inBounds(x + dx, y + dy) && this.isOpen(this.idx(x + dx, y + dy))) {
        this.releaseGas(x + dx, y + dy, CFG.gas.leak);
        return;
      }
    }
  }

  /**
   * One diffusion step every `CFG.gas.tick`: gas rises, spreads sideways a
   * little, and thins out. A whole-grid pass is ~10k cells, ten times a
   * second, and only while there is gas at all.
   */
  updateGas(dt) {
    if (!this.gasLive) return;
    const G = CFG.gas;
    this.gasClock += dt;
    if (this.gasClock < G.tick) return;
    const k = this.gasClock;
    this.gasClock = 0;

    const { w, gas } = this;
    const next = this.gasNext;
    next.set(gas);
    for (let i = 0; i < gas.length; i++) {
      const g = gas[i];
      if (g <= 0) continue;
      const x = i % w;
      if (!this.isOpen(i)) {
        // Dirt landed in it: the gas is squeezed upward, or lost.
        next[i] -= g;
        if (i >= w && this.isOpen(i - w)) next[i - w] += g;
        continue;
      }
      let out = 0;
      if (i >= w && this.isOpen(i - w)) { const m = g * G.rise; next[i - w] += m; out += m; }
      if (x > 0 && this.isOpen(i - 1)) { const m = g * G.spread; next[i - 1] += m; out += m; }
      if (x < w - 1 && this.isOpen(i + 1)) { const m = g * G.spread; next[i + 1] += m; out += m; }
      next[i] -= out;
    }

    let any = false;
    const sky = this.surface * w;
    for (let i = 0; i < next.length; i++) {
      let g = next[i];
      if (g <= 0) { next[i] = 0; continue; }
      g *= 1 - (i < sky ? G.surfaceDecay : G.decay) * k;
      if (g < 0.004) g = 0; else any = true;
      next[i] = g;
    }
    this.gasNext = gas;
    this.gas = next;
    this.gasLive = any;
  }

  /** Light every gas cell inside a square of radius `r` — a blast's reach. */
  igniteArea(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (this.gas[i] >= CFG.gas.ignite) this.ignite(i);
      }
  }

  /** Set one cell burning; it lights its neighbours a moment later. */
  ignite(i) {
    if (this.fire[i] > 0) return;
    this.fire[i] = CFG.gas.burn;
    this.fireSpread[i] = 0;
    this.gas[i] = 0;
    this.burning.push(i);
    const g = this.game;
    if (g && g.onGasIgnited) g.onGasIgnited((i % this.w) + 0.5, ((i / this.w) | 0) + 0.5);
  }

  /**
   * The flame front. A burning cell lights any neighbour holding enough gas,
   * and bursts any gas pocket it touches — so a pocket next to a fire is a
   * fire too.
   */
  updateFire(dt) {
    if (this.burning.length === 0) return;
    const G = CFG.gas;
    const list = this.burning;
    for (let n = list.length - 1; n >= 0; n--) {
      const i = list[n];
      this.fire[i] -= dt;
      if (!this.fireSpread[i] && this.fire[i] <= G.burn - G.spreadDelay) {
        this.fireSpread[i] = 1;
        const x = i % this.w, y = (i / this.w) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy) || !this.inBounds(x + dx, y + dy)) continue;
            const j = this.idx(x + dx, y + dy);
            if (this.t[j] === T.GAS) this.destroy(x + dx, y + dy);
            if (this.gas[j] >= G.ignite) this.ignite(j);
          }
      }
      if (this.fire[i] <= 0) {
        this.fire[i] = 0;
        this.fireSpread[i] = 0;
        list[n] = list[list.length - 1];
        list.pop();
      }
    }
  }

  /** Is the cell under a world position on fire? */
  burningAt(px, py) {
    const x = Math.floor(px), y = Math.floor(py);
    return this.inBounds(x, y) && this.fire[this.idx(x, y)] > 0;
  }

  /* ----------------------------------------------------------------- lava */

  /**
   * The revive: drain the lava back down to `toRow`. The lava had already
   * burned the ground away, so draining to open air would just drop the
   * miner back in — instead it cools into soft dirt below `floorRow` (the
   * miner's feet), and only the rows the miner stands in are left clear.
   * The crust is ordinary dirt: it can be dug, and it will need to be.
   */
  lowerLava(toRow, floorRow) {
    if (toRow <= this.lavaRow) return;
    const to = Math.min(this.h - 1, Math.ceil(toRow) - 1);
    for (let y = Math.max(0, Math.floor(this.lavaRow)); y <= to; y++) {
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.t[i] !== T.LAVA) continue;
        if (y > floorRow) this.set(x, y, T.DIRT, CFG.mining.dirtHits);
        else { this.t[i] = T.EMPTY; this.hp[i] = 0; }
      }
    }
    this.lavaRow = toRow;
  }

  /** Uniformly floods the mine from below. Nothing but bedrock survives. */
  riseLava(toRow) {
    const from = Math.min(this.h - 1, Math.ceil(this.lavaRow));
    const to = Math.max(0, Math.floor(toRow));
    for (let y = from; y >= to; y--) {
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.t[i] === T.BEDROCK || this.t[i] === T.LAVA) continue;
        if (this.t[i] === T.GEM || this.t[i] === T.HEART) { this.gem[i] = 0; }
        // The lava lights any gas it reaches, and a sealed pocket it swallows
        // goes up in a burst of flame into the air above it.
        if (this.gas[i] >= CFG.gas.ignite) this.ignite(i);
        if (this.t[i] === T.GAS && y > 0 && this.isOpen(i - this.w)) {
          this.gas[i - this.w] += CFG.gas.release;
          this.ignite(i - this.w);
        }
        this.t[i] = T.LAVA; this.hp[i] = 0;
      }
    }
    this.lavaRow = toRow;
  }
}

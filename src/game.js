/* ============================================================================
 * Game — state machine, run lifecycle, spawning, economy, and the fixed-step
 * update loop. This is the only module that knows about all the others.
 * ========================================================================== */

class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.ui = new UI(this);
    this.input = new Input(this);
    this.fx = new FX(this);

    this.state = 'title';          // title | play | paused | over
    this.time = 0;
    this.acc = 0;
    this.shakeAmt = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.cam = { x: 0, y: 0 };
    this.lights = [];
    this.tempLights = [];

    this.world = null;
    this.player = null;
    this.enemies = [];
    this.gems = [];
    this.dynamites = [];
    this.blocks = [];
    this.carry = [];
    this.checkpointLock = null;

    this.save = this.load();
    this.resetRunStats();
    // A live mine sits behind the title panel instead of a black rectangle.
    this.startRun(true);
    this.state = 'title';

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 260));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.togglePause();
    });

    this.ui.title(this.save);
  }

  /* ------------------------------------------------------------ persistence */

  load() {
    const blank = { gold: 0, best: 0, upgrades: {}, audio: true };
    try {
      const raw = localStorage.getItem(CFG.saveKey);
      if (!raw) return blank;
      const s = JSON.parse(raw);
      return {
        gold: s.gold || 0,
        best: s.best || 0,
        upgrades: s.upgrades || {},
        audio: s.audio !== false,
      };
    } catch (e) { return blank; }
  }

  persist() {
    try { localStorage.setItem(CFG.saveKey, JSON.stringify(this.save)); } catch (e) { /* private mode */ }
  }

  wipeSave() {
    this.save = { gold: 0, best: 0, upgrades: {}, audio: Sfx.enabled };
    this.persist();
    Highscore.reset();
    this.ui.title(this.save);
  }

  /* ---------------------------------------------------------- run lifecycle */

  // `score` is filled in by endRun with whatever Highscore made of the haul.
  resetRunStats() { this.runStats = { banked: 0, depth: 0, gems: 0, lost: 0, score: null }; }

  startRun(quiet) {
    if (!quiet) Sfx.init();
    Sfx.setEnabled(this.save.audio !== false);
    Sfx.stopRumble();

    this.world = new World((Math.random() * 0xffffffff) >>> 0, this);
    this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y, this.save.upgrades);
    this.enemies.length = 0;
    this.gems.length = 0;
    this.dynamites.length = 0;
    this.blocks.length = 0;
    this.carry.length = 0;
    this.fx.clear();
    this.tempLights.length = 0;

    this.volcano = false;
    this.lavaSpeed = CFG.lava.riseSpeed;
    this.lavaShakeTimer = 0;
    this.deathAnim = 0;
    this.spawnTimer = CFG.spawn.interval;
    // The eruption clock. It only advances while the mine is actually being
    // played, so a paused game or the title-screen mine never burns it down.
    this.runTime = 0;
    this.nextWarn = 0;
    this.resetRunStats();

    // Standing on the home lantern at spawn shouldn't instantly open the shop.
    this.lockCheckpoint(Math.floor(this.player.x), Math.floor(this.player.y));

    this.cam.x = this.player.x;
    this.cam.y = this.player.y;

    this.ui.hide();
    this.ui.syncHealth(this.player);
    this.ui.syncHat(this.player);
    this.ui.syncDynamite(this.player);
    this.ui.syncWallet(this);
    this.ui.syncTimer(this);
    this.input.reset();
    this.state = 'play';
    if (!quiet) this.ui.toast(loc('toast.digDown'), 1600);
  }

  endRun(kind) {
    if (this.state === 'over') return;
    const lost = this.carryValue();
    if (kind === 'death' || kind === 'abandon') {
      this.runStats.lost = lost;
      this.carry.length = 0;
      this.player.hasHeartstone = false;
    }
    this.save.best = Math.max(this.save.best || 0, this.runStats.depth);
    // The score is what the run BANKED — loot that was still in the miner's
    // pockets never made it out, so it never makes the board.
    this.runStats.score = Highscore.submit({
      value: this.runStats.banked,
      depth: this.runStats.depth,
      gems: this.runStats.gems,
      kind,
    });
    this.persist();
    Sfx.stopRumble();
    this.state = 'over';
    this.input.reset();
    this.ui.syncWallet(this);
    this.ui.syncTimer(this);
    this.ui.summary(this, kind);
  }

  killPlayer() {
    if (this.player.dead) return;
    this.player.dead = true;
    this.deathAnim = 0;
    Sfx.play('death');
    this.shake(18);
    this.fx.burst(this.player.x, this.player.y, 26, ['#ff5d5d', '#ffd08a', '#3d6fb4'], { speed: 8, life: 0.9, size: 0.2 });
    this.ui.banner(loc('sum.died'),
      this.carryValue() > 0 ? loc('banner.lostInDark', { v: fmt(this.carryValue()) }) : '');
    setTimeout(() => { if (this.state === 'play') this.endRun('death'); }, 1500);
  }

  /* --------------------------------------------------------------- economy */

  depth() { return Math.max(0, Math.floor(this.player.y) - this.world.surface); }

  gemValue(type, depth) {
    return Math.round(CFG.gems.types[type].value * (1 + Math.max(0, depth) * CFG.gems.depthBonus));
  }

  carryValue() {
    let v = 0;
    for (const g of this.carry) v += g.value;
    if (this.player && this.player.hasHeartstone) v += CFG.gems.heartstoneValue;
    return v;
  }

  collectGem(g) {
    g.dead = true;
    const scr = this.worldToScreen(g.x, g.y);

    if (g.heart) {
      this.player.hasHeartstone = true;
      this.fx.flyToHud(scr.x, scr.y, '#ff7a3c', CFG.gems.heartstoneValue);
      this.awakenVolcano();
    } else {
      const value = this.gemValue(g.type, this.depth());
      this.carry.push({ type: g.type, value });
      this.runStats.gems++;
      Sfx.play('gem', { tier: g.type });
      this.fx.flyToHud(scr.x, scr.y, CFG.gems.types[g.type].color, value);
      this.fx.text(g.x, g.y - 0.4, '+' + fmt(value), CFG.gems.types[g.type].glow, { size: 11, life: 0.8 });
    }
    this.ui.syncWallet(this);
  }

  /** Bats take the single most valuable gem — losing junk wouldn't sting. */
  stealGem() {
    if (this.carry.length === 0) return null;
    let bi = 0;
    for (let i = 1; i < this.carry.length; i++) if (this.carry[i].value > this.carry[bi].value) bi = i;
    const gem = this.carry.splice(bi, 1)[0];
    this.ui.syncWallet(this);
    return gem;
  }

  bankAt(cp) {
    const gemTotal = this.carry.reduce((s, g) => s + g.value, 0);
    const home = !!cp.home;
    const winning = home && this.player.hasHeartstone;

    if (gemTotal > 0) {
      this.save.gold += gemTotal;
      this.runStats.banked += gemTotal;
      this.carry.length = 0;
      Sfx.play('bank');
      this.fx.text(this.player.x, this.player.y - 0.8, loc('fx.banked', { v: fmt(gemTotal) }), '#ffc95e', { size: 14, life: 1.5 });
      this.fx.burst(this.player.x, this.player.y, 16, ['#ffc95e', '#fff0c0'], { speed: 5, life: 0.8, size: 0.15, glow: true, grav: -2 });
    }

    if (winning) {
      const total = CFG.gems.heartstoneValue + CFG.gems.escapeBonus;
      this.save.gold += total;
      this.runStats.banked += total;
      this.player.hasHeartstone = false;
      this.volcano = false;
      Sfx.stopRumble();
      Sfx.play('win');
      this.ui.banner(loc('sum.escaped'), loc('banner.bounty', { v: fmt(total) }));
      this.persist();
      this.ui.syncWallet(this);
      setTimeout(() => { if (this.state === 'play') this.endRun('win'); }, 2200);
      return;
    }

    // Dynamite is NOT topped up here — it is stock the lantern sells, and the
    // shop below is where you buy it. The hard hat still re-forms for free;
    // it does that on a timer out in the mine anyway.
    const rehatted = this.player.refillHat(this);
    this.ui.syncDynamite(this.player);
    this.ui.syncWallet(this);
    this.persist();

    // A lantern out in the mine burns out as it is used: whatever you buy, you
    // buy now. Only the surface camp can be walked back into.
    if (!home) cp.spent = true;

    // Thunks, not strings: the panel re-runs them if the language is switched
    // while it is open.
    const sub = () => {
      const bits = [];
      if (gemTotal > 0) bits.push(loc('shop.secured', { v: fmt(gemTotal) }));
      if (rehatted > 0) bits.push(loc('shop.hatRepaired'));
      return bits.join(' · ') || loc('shop.nothingToBank');
    };

    if (home) {
      this.openPanel(() => this.ui.shop(this, {
        title: () => loc('shop.surfaceCamp'),
        sub,
        closeLabel: () => loc('shop.backDown'),
        extra: () => `<button class="btn ghost" id="newMine">${loc('shop.abandonMine')}</button>`,
        wire: (ui) => ui.on('#newMine', () => this.endRun('abandon')),
      }));
    } else {
      this.openPanel(() => this.ui.shop(this, {
        title: () => loc('shop.supplyLantern'),
        sub,
        note: () => loc('shop.singleUse'),
      }));
      if (this.player.hasHeartstone) {
        setTimeout(() => this.ui.toast(loc('toast.heartstoneAtSurface'), 2600), 400);
      }
    }
  }

  upgradeCost(u, level) { return Math.round(u.base * Math.pow(u.step, level)); }

  /**
   * Placeholders for an upgrade's shop description. Most upgrades hand out a
   * flat step and need none; the satchel's last level runs into the capacity
   * ceiling, so it quotes what that level actually buys rather than the step.
   */
  upgradeDescParams(u, level) {
    if (u.id === 'dynamite') {
      // A maxed row has no "next" level; quote the last one it sold instead of
      // an honest but useless "+0".
      const lv = Math.min(level, u.max - 1);
      return { n: Player.dynCapacityFor(lv + 1) - Player.dynCapacityFor(lv) };
    }
    return null;
  }

  buyUpgrade(id) {
    const u = CFG.upgrades.find(x => x.id === id);
    if (!u) return;
    const lvl = this.save.upgrades[id] || 0;
    if (lvl >= u.max) return;
    const cost = this.upgradeCost(u, lvl);
    if (this.save.gold < cost) { this.ui.toast(loc('toast.notEnoughGold')); return; }

    this.save.gold -= cost;
    this.save.upgrades[id] = lvl + 1;
    this.persist();
    Sfx.play('buy');

    // Apply live so the purchase is felt immediately, not next run. Each stat
    // is recomputed from its level rather than nudged, so a capped level adds
    // exactly what it is worth instead of a full step.
    const p = this.player;
    if (p && !p.dead) {
      const lv = this.save.upgrades;
      if (id === 'health') {
        const gain = Player.maxHealthFor(lv.health) - p.maxHealth;
        p.maxHealth += gain; p.health += gain;
        this.ui.syncHealth(p);
      }
      if (id === 'speed') p.speed = Player.speedFor(lv.speed);
      if (id === 'light') p.light = Player.lightFor(lv.light);
      // A bigger satchel comes with the sticks it adds, but it is not a free
      // refill of the ones you already spent.
      if (id === 'dynamite') {
        const gain = Player.dynCapacityFor(lv.dynamite) - p.dynMax;
        p.dynMax += gain; p.dynamite += gain;
        this.ui.syncDynamite(p);
      }
      if (id === 'jump') p.jumpVel = Player.jumpVelFor(lv.jump);
      if (id === 'helmet') { p.hatMax += CFG.upgradeEffect.helmet; p.hat = p.hatMax; this.ui.syncHat(p); }
    }
    this.ui.syncWallet(this);

    // Every panel knows how to rebuild itself, so prices and pips refresh
    // without this having to work out which shop is on screen.
    this.ui.repaint();
  }

  /**
   * Sticks are bought, never handed out, and only by the satchel-full. One
   * price for a full reload keeps the decision at the lantern a single one —
   * which matters now that a lantern in the mine is good for one visit.
   */
  buyDynamite() {
    const p = this.player;
    if (!p || p.dead) return;
    const missing = p.dynMax - p.dynamite;
    if (missing <= 0) { this.ui.toast(loc('toast.satchelFull')); return; }

    const cost = CFG.supplies.dynamiteCost;
    if (this.save.gold < cost) { this.ui.toast(loc('toast.notEnoughGold')); return; }

    this.save.gold -= cost;
    p.dynamite = p.dynMax;
    this.persist();
    Sfx.play('buy');
    this.ui.syncDynamite(p);
    this.ui.syncWallet(this);
    this.ui.repaint();
  }

  /** One heal, and it is the whole bar. There is no cheap top-up any more. */
  buyHeal() {
    const p = this.player;
    if (!p || p.dead || p.health >= p.maxHealth) { this.ui.toast(loc('toast.alreadyFull')); return; }

    const cost = CFG.supplies.healCost;
    if (this.save.gold < cost) { this.ui.toast(loc('toast.notEnoughGold')); return; }

    this.save.gold -= cost;
    this.persist();
    Sfx.play('buy');
    p.heal(p.maxHealth, this);
    this.ui.syncWallet(this);
    this.ui.repaint();
  }

  /* ---------------------------------------------------------------- panels */

  openPanel(builder) {
    this.state = 'paused';
    this.input.reset();
    builder();
  }

  closePanel() {
    if (this.state !== 'paused') return;
    this.ui.hide();
    this.input.reset();
    this.state = 'play';
  }

  togglePause() {
    if (this.state === 'play') this.openPanel(() => this.ui.pause(this));
    else if (this.state === 'paused') this.closePanel();
  }

  toggleAudio() {
    this.save.audio = !Sfx.enabled;
    Sfx.setEnabled(this.save.audio);
    this.persist();
    this.ui.toast(loc('toast.sound', { s: loc(this.save.audio ? 'common.on' : 'common.off') }));
  }

  /* -------------------------------------------------------------- spawning */

  spawnGem(x, y, type, opt) { this.gems.push(new GemPickup(x, y, type, opt)); }
  spawnHeartstone(x, y) { this.gems.push(new GemPickup(x, y, 0, { heart: true, speed: 1.2 })); }
  spawnFallingBlock(x, y) { this.blocks.push(new FallingBlock(x, y)); }

  shake(amount) { this.shakeAmt = Math.min(26, this.shakeAmt + amount); }

  addLight(x, y, r, life) { this.tempLights.push({ x, y, r, life, max: life }); }

  updateSpawns(dt) {
    const depth = this.depth();
    if (depth < 6) return;

    const maxAlive = CFG.spawn.maxAlive + Math.floor(depth / CFG.spawn.maxAliveDepth) + (this.volcano ? 2 : 0);
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    let interval = Math.max(CFG.spawn.intervalMin, CFG.spawn.interval - depth * CFG.spawn.intervalDepth);
    if (this.volcano) interval *= CFG.spawn.volcanoMultiplier;
    this.spawnTimer = interval * (0.7 + Math.random() * 0.6);
    if (this.enemies.length >= maxAlive) return;

    const spot = this.findSpawnSpot();
    if (!spot) return;

    // Bats show up when there is something worth stealing.
    const wantBat = this.carry.length > 0 && Math.random() < CFG.spawn.batBias;
    this.enemies.push(wantBat ? new Bat(spot.x, spot.y) : new Spider(spot.x, spot.y));
  }

  findSpawnSpot() {
    const w = this.world, p = this.player;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      const d = CFG.spawn.minDist + Math.random() * (CFG.spawn.maxDist - CFG.spawn.minDist);
      const x = Math.floor(p.x + Math.cos(a) * d);
      const y = Math.floor(p.y + Math.sin(a) * d);
      if (y <= w.surface + 1 || y >= w.h - 2) continue;
      if (w.get(x, y) !== T.EMPTY) continue;
      if (!w.isFree(x + 0.5, y + 0.5, 0.4)) continue;
      // Never pop into existence inside the player's lamp light.
      if (dist(x + 0.5, y + 0.5, p.x, p.y) < p.light + 1.5) continue;
      return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  }

  /* -------------------------------------------------------------- volcano */

  /** `cause` is 'heartstone' (the climax) or 'timer' (the clock ran out). */
  awakenVolcano(cause) {
    if (this.volcano) return;
    this.volcano = true;
    this.lavaSpeed = CFG.lava.riseSpeed;
    this.world.lavaRow = Math.min(this.world.h, CFG.world.heartstoneRow + CFG.lava.startOffset);
    Sfx.play('heart');
    setTimeout(() => Sfx.play('awaken'), 300);
    Sfx.startRumble();
    this.shake(26);
    this.ui.banner(loc('banner.volcano'), loc(cause === 'timer' ? 'banner.timeUp' : 'banner.climbNow'));
    this.ui.toast(loc('toast.getToSurface'), 3000);
    this.ui.syncTimer(this);
  }

  /** Seconds left on the eruption clock. Zero once the mountain is awake. */
  fuseLeft() {
    if (this.volcano) return 0;
    return Math.max(0, CFG.lava.fuse - this.runTime);
  }

  /**
   * The run is on a clock whether or not the Heartstone has been found: sit in
   * the mine long enough and the mountain wakes by itself. Warnings fire on the
   * way down so the deadline is read, never sprung.
   */
  updateFuse(dt) {
    if (this.volcano) return;
    this.runTime += dt;

    const warns = CFG.lava.warnAt;
    const left = this.fuseLeft();
    while (this.nextWarn < warns.length && left <= warns[this.nextWarn]) {
      const at = warns[this.nextWarn++];
      // A warning the clock skipped past (a long frame) is not worth shouting.
      if (left > at - 2) {
        Sfx.play('alert', { v: 0.8 });
        this.ui.toast(loc('toast.eruptionWarn', { t: fmtTime(left) }), 2400);
      }
    }

    if (left <= 0) this.awakenVolcano('timer');
  }

  updateLava(dt) {
    if (!this.volcano) return;
    this.lavaSpeed += CFG.lava.accel * dt * 60 * dt;
    // The lava floods the whole mine but stops at the surface shelf, so a
    // last-second sprint to the camp is always a legitimate win.
    const next = Math.max(this.world.surface, this.world.lavaRow - this.lavaSpeed * dt);
    this.world.riseLava(next);

    this.lavaShakeTimer -= dt;
    if (this.lavaShakeTimer <= 0) {
      this.lavaShakeTimer = CFG.lava.shakeInterval * (0.6 + Math.random() * 0.8);
      this.shake(5);
    }
    // Embers along the lava front, near the player only.
    if (Math.random() < dt * 26) {
      const x = clamp(this.player.x + (Math.random() - 0.5) * 16, 1, this.world.w - 2);
      this.fx.drift(x, this.world.lavaRow - 0.2, 1, ['#ffb03a', '#ff6a1e', '#fff0c0'],
        { life: 1.6, size: 0.16, rise: 2.6, glow: true });
    }
  }

  /* ------------------------------------------------------------ main update */

  step(dt) {
    this.time += dt;

    // Shake decays fast; the offset is re-rolled each frame for a punchy feel.
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 42);
    const s = this.shakeAmt * this.renderer.dpr * 0.5;
    this.shakeX = (Math.random() - 0.5) * s;
    this.shakeY = (Math.random() - 0.5) * s;

    this.ui.syncTimer(this);

    // Paused / title / summary still animate the mine behind the panel.
    if (this.state !== 'play') {
      this.fx.update(dt);
      if (this.world) { this.updateCamera(dt); this.markExplored(); this.buildLights(); }
      return;
    }

    this.input.update();
    this.player.update(dt, this, this.input);
    if (this.player.dead) this.deathAnim += dt;

    this.world.update(dt);
    this.updateFuse(dt);
    this.updateLava(dt);
    this.updateSpawns(dt);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      // Cull anything that wandered far off-screen; keeps the sim cheap.
      if (e.dead || dist(e.x, e.y, this.player.x, this.player.y) > 34) {
        this.enemies[i] = this.enemies[this.enemies.length - 1];
        this.enemies.pop();
      }
    }
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.update(dt, this);
      if (g.dead) { this.gems[i] = this.gems[this.gems.length - 1]; this.gems.pop(); }
    }
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const d = this.dynamites[i];
      d.update(dt, this);
      if (d.dead) { this.dynamites[i] = this.dynamites[this.dynamites.length - 1]; this.dynamites.pop(); }
    }
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.update(dt, this);
      if (b.dead) { this.blocks[i] = this.blocks[this.blocks.length - 1]; this.blocks.pop(); }
    }

    this.fx.update(dt);
    this.checkCheckpoint();

    const d = this.depth();
    if (d > this.runStats.depth) this.runStats.depth = d;
    this.ui.syncDepth(d, this.world, this.player);

    this.updateCamera(dt);
    this.markExplored();
    this.buildLights();
  }

  /** Shut a lantern until the player has both waited and walked away. */
  lockCheckpoint(x, y) { this.checkpointLock = { x, y, t: this.time }; }

  checkCheckpoint() {
    const p = this.player;
    if (p.dead) return;

    // A lantern you just used stays shut until the cooldown has run out AND
    // you have stepped away from it. Stepping off the tile alone used to be
    // enough to re-arm it, so digging down from on top of a station reopened
    // the shop on every swing.
    const lock = this.checkpointLock;
    if (lock) {
      const dx = p.x - (lock.x + 0.5), dy = p.y - (lock.y + 0.5);
      const clear = this.time - lock.t >= CFG.checkpoint.reopenDelay &&
        Math.hypot(dx, dy) >= CFG.checkpoint.reopenDist;
      if (!clear) return;
      this.checkpointLock = null;
    }

    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.world.get(tx, ty) !== T.CHECKPOINT) return;
    const cp = this.world.checkpointAt(tx, ty);
    if (!cp) return;
    this.lockCheckpoint(tx, ty);
    // A lantern down in the mine is good for exactly one visit. Locking first
    // means the "it's spent" toast fires once rather than on every step.
    if (cp.spent) { this.ui.toast(loc('toast.lanternSpent')); return; }
    this.bankAt(cp);
  }

  updateCamera(dt) {
    const p = this.player;
    const view = CFG.render.viewTiles;
    const aspect = this.renderer.cw / this.renderer.ch;
    const halfW = (aspect >= 1 ? view * aspect : view) / 2;
    const halfH = (aspect >= 1 ? view : view / aspect) / 2;

    // Lead the camera slightly toward where the player is heading. The vertical
    // lead is gentler than the horizontal one — gravity makes vy spike, and a
    // camera that snaps down on every fall is nauseating on a phone.
    const tx = p.x + clamp(p.vx * 0.16, -1.2, 1.2);
    const ty = p.y + clamp(p.vy * 0.09, -1.0, 1.4);
    const k = clamp(dt * CFG.render.camLerp, 0, 1);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);

    const w = this.world;
    if (w.w > halfW * 2) this.cam.x = clamp(this.cam.x, halfW, w.w - halfW);
    else this.cam.x = w.w / 2;
    this.cam.y = clamp(this.cam.y, halfH - CFG.world.surfaceRow, w.h - halfH);
  }

  markExplored() {
    const w = this.world, p = this.player;
    const r = Math.ceil(p.light) + 1;
    const px = Math.floor(p.x), py = Math.floor(p.y);
    const r2 = (p.light + 0.7) * (p.light + 0.7);
    for (let y = py - r; y <= py + r; y++) {
      if (y < 0 || y >= w.h) continue;
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || x >= w.w) continue;
        if (dist2(x + 0.5, y + 0.5, p.x, p.y) <= r2) w.explored[y * w.w + x] = 1;
      }
    }
  }

  buildLights() {
    const L = this.lights;
    L.length = 0;
    const p = this.player;
    if (!p) return;

    L.push({ x: p.x, y: p.y, r: p.light * (0.97 + p.lampFlicker * 0.06), a: 1 });
    // A tight, always-on pool so you can never be blind on your own tile.
    L.push({ x: p.x, y: p.y, r: 1.5, a: 1 });

    for (const c of this.world.checkpoints) {
      if (Math.abs(c.x - p.x) >= 26 || Math.abs(c.y - p.y) >= 20) continue;
      // A spent lantern keeps a stub of a glow — enough to recognise it as the
      // one you already used, not enough to light the room by.
      L.push({ x: c.x + 0.5, y: c.y + 0.5, r: c.spent ? 2.2 : 5.2, a: c.spent ? 0.5 : 0.9 });
    }
    for (const d of this.dynamites) L.push({ x: d.x, y: d.y, r: 2.6, a: 0.8 });
    for (const g of this.gems) L.push({ x: g.x, y: g.y, r: g.heart ? 5 : 1.5, a: 0.75 });

    for (let i = this.tempLights.length - 1; i >= 0; i--) {
      const t = this.tempLights[i];
      t.life -= 1 / 60;
      if (t.life <= 0) { this.tempLights[i] = this.tempLights[this.tempLights.length - 1]; this.tempLights.pop(); continue; }
      L.push({ x: t.x, y: t.y, r: t.r * (t.life / t.max), a: 1 });
    }

    if (this.volcano) {
      const row = this.world.lavaRow;
      if (Math.abs(row - p.y) < 26) {
        for (let x = Math.max(1, Math.floor(p.x) - 16); x < Math.min(this.world.w - 1, Math.floor(p.x) + 16); x += 4) {
          L.push({ x: x + 0.5, y: row + 0.5, r: 7, a: 0.85 });
        }
      }
    }
  }

  worldToScreen(wx, wy) {
    const r = this.renderer;
    return {
      x: (r.ox + wx * r.ppt) / r.dpr,
      y: (r.oy + wy * r.ppt) / r.dpr,
    };
  }

  /* ------------------------------------------------------------- game loop */

  frame(nowMs) {
    const t = nowMs / 1000;
    if (this.last === undefined) this.last = t;
    // Clamp so a backgrounded tab doesn't fast-forward the whole mine.
    let dt = Math.min(0.25, t - this.last);
    this.last = t;

    this.acc += dt;
    const fixed = 1 / 60;
    let steps = 0;
    while (this.acc >= fixed && steps < 5) { this.step(fixed); this.acc -= fixed; steps++; }
    if (steps === 5) this.acc = 0;

    if (this.world) this.renderer.draw(this);
    requestAnimationFrame(this.frame.bind(this));
  }

  start() { requestAnimationFrame(this.frame.bind(this)); }
}

/* ============================================================================
 * Enemies. The Cave Bug threatens your health, the Bat threatens your loot.
 * Both are deliberately readable — the Cave Bug always telegraphs before it
 * pounces, the Bat always shows you what it stole.
 *
 * Only the Cave Bug digs. The Bat flies, and flies *around* solid tiles, so the
 * open air it can reach you through is the tunnel network you cut yourself.
 *
 * The Tunneler, at the bottom, is a terrain event more than an enemy: it does
 * not hunt, cannot be killed, and lives in its own list rather than among the
 * enemies the spawner counts.
 * ========================================================================== */

class Enemy {
  constructor(x, y, r) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = r;
    this.dead = false;
    this.hurtFlash = 0;
    this.anim = Math.random() * 10;
    this.face = 1;
  }

  /** Axis-separated circle-vs-tile movement. Returns which axes were blocked. */
  move(dt, world, canDig) {
    const blocked = { x: false, y: false };
    const nx = this.x + this.vx * dt;
    if (world.isFree(nx, this.y, this.r)) this.x = nx; else blocked.x = true;
    const ny = this.y + this.vy * dt;
    if (world.isFree(this.x, ny, this.r)) this.y = ny; else blocked.y = true;
    return blocked;
  }

  /** `cause` is how a killing blow landed — one of KILL_CAUSES, for the stats. */
  hurt(amount, game, kx, ky, cause) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtFlash = 0.18;
    const d = Math.hypot(kx || 0, ky || 0) || 1;
    this.vx += ((kx || 0) / d) * 9;
    this.vy += ((ky || 0) / d) * 9;
    if (this.hp <= 0) this.die(game, cause);
    else { Sfx.play('hit'); game.fx.burst(this.x, this.y, 6, ['#ff8fa0', '#c8324a'], { speed: 5, life: 0.3, size: 0.13 }); }
  }

  die(game, cause) {
    this.dead = true;
    game.recordKill(this, cause);
    Sfx.play('squish');
    game.fx.burst(this.x, this.y, 16, this.gore || ['#7a2a3a', '#c8324a', '#3a1420'], { speed: 7, life: 0.55, size: 0.17 });
    game.shake(4);
  }

  /** Tile-walk line of sight. Used to decide whether a pounce is fair. */
  hasSight(world, tx, ty) {
    let x0 = Math.floor(this.x), y0 = Math.floor(this.y);
    const x1 = Math.floor(tx), y1 = Math.floor(ty);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    while (guard++ < 64) {
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      if (world.isSolid(x0, y0)) return false;
    }
    return false;
  }
}

/* ------------------------------------------------------------------ Cave Bug */

class CaveBug extends Enemy {
  constructor(x, y) {
    super(x, y, CFG.caveBug.radius);
    this.hp = CFG.caveBug.hp;
    this.state = 'wander';
    this.timer = 0;
    this.digTile = null;
    this.digTimer = 0;
    this.wanderDir = { x: Math.random() < 0.5 ? -1 : 1, y: 0 };
    this.gore = ['#4a2233', '#8e2f46', '#22101a'];
    this.legPhase = Math.random() * TAU;
  }

  update(dt, game) {
    const p = game.player;
    const w = game.world;
    this.anim += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.timer -= dt;

    const d = dist(this.x, this.y, p.x, p.y);
    const sees = !p.dead && d < CFG.caveBug.aggro;

    switch (this.state) {
      case 'wander': {
        if (sees) { this.state = 'hunt'; Sfx.play('screech', { v: 0.5 }); break; }
        if (this.timer <= 0) {
          this.timer = 0.8 + Math.random() * 1.4;
          this.wanderDir = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
        }
        this.steer(this.wanderDir.x, this.wanderDir.y, CFG.caveBug.speed * 0.5, dt);
        break;
      }
      case 'hunt': {
        if (!sees && d > CFG.caveBug.aggro * 1.4) { this.state = 'wander'; this.timer = 0; break; }
        const clear = this.hasSight(w, p.x, p.y);
        if (clear && d < CFG.caveBug.pounceRange && d > 0.9) {
          this.state = 'wind';
          this.timer = CFG.caveBug.telegraph;
          this.aim = { x: (p.x - this.x) / d, y: (p.y - this.y) / d };
          this.vx *= 0.2; this.vy *= 0.2;
          Sfx.play('screech', { v: 0.7 });
          break;
        }
        this.pursue(dt, game, p);
        break;
      }
      case 'wind': {
        // Frozen wind-up. The player gets a clear, consistent tell here.
        this.vx *= 0.86; this.vy *= 0.86;
        if (this.timer <= 0) {
          this.state = 'pounce';
          this.timer = CFG.caveBug.chargeTime;
          this.vx = this.aim.x * CFG.caveBug.chargeSpeed;
          this.vy = this.aim.y * CFG.caveBug.chargeSpeed;
          game.fx.burst(this.x, this.y, 6, ['#59304a'], { speed: 4, life: 0.3, size: 0.12 });
        }
        break;
      }
      case 'pounce': {
        const b = this.move(dt, w, false);
        if (b.x) this.vx = 0;
        if (b.y) this.vy = 0;
        if (this.timer <= 0 || (b.x && b.y)) { this.state = 'rest'; this.timer = CFG.caveBug.cooldown; }
        this.contact(game, p);
        return;
      }
      case 'rest': {
        this.vx *= 0.82; this.vy *= 0.82;
        if (this.timer <= 0) this.state = sees ? 'hunt' : 'wander';
        break;
      }
    }

    this.move(dt, w, true);
    this.contact(game, p);
    if (Math.abs(this.vx) > 0.2) this.face = this.vx > 0 ? 1 : -1;

    if (w.get(this.x | 0, this.y | 0) === T.LAVA) this.die(game, 'lava');
  }

  /** Head toward the player, chewing through soft dirt when the way is blocked. */
  pursue(dt, game, p) {
    const w = game.world;
    const dx = p.x - this.x, dy = p.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;

    if (this.digTile) {
      this.digTimer -= dt;
      this.vx *= 0.7; this.vy *= 0.7;
      const { x, y } = this.digTile;
      if (!w.isMineable(x, y)) { this.digTile = null; return; }
      if (this.digTimer <= 0) {
        w.destroy(x, y);
        Sfx.play('break', { v: 0.35 });
        this.digTile = null;
      } else if (Math.random() < dt * 14) {
        game.fx.burst(x + 0.5, y + 0.5, 2, ['#6f4f31'], { speed: 2.4, life: 0.25, size: 0.1 });
      }
      return;
    }

    // Blocked? Pick the adjacent tile most in the player's direction and chew it.
    const ahead = cardinal(ux, uy);
    const tx = Math.floor(this.x) + ahead.x;
    const ty = Math.floor(this.y) + ahead.y;
    const willHit = !w.isFree(this.x + ux * 0.45, this.y + uy * 0.45, this.r);
    if (willHit) {
      const cands = [
        { x: tx, y: ty },
        { x: Math.floor(this.x) + (ahead.x ? 0 : sign(ux) || 1), y: Math.floor(this.y) + (ahead.y ? 0 : sign(uy) || 1) },
      ];
      for (const c of cands) {
        if (w.isMineable(c.x, c.y)) { this.digTile = c; this.digTimer = CFG.caveBug.digTime; return; }
      }
    }
    this.steer(ux, uy, CFG.caveBug.speed, dt);
  }

  steer(ux, uy, speed, dt) {
    const len = Math.hypot(ux, uy) || 1;
    const tvx = (ux / len) * speed, tvy = (uy / len) * speed;
    this.vx = lerp(this.vx, tvx, clamp(dt * 8, 0, 1));
    this.vy = lerp(this.vy, tvy, clamp(dt * 8, 0, 1));
  }

  contact(game, p) {
    if (p.dead) return;
    if (dist(this.x, this.y, p.x, p.y) < CFG.caveBug.contactRange) {
      if (p.hurt(CFG.caveBug.damage, game, p.x - this.x, p.y - this.y)) {
        this.vx = -(p.x - this.x) * 5; this.vy = -(p.y - this.y) * 5;
        this.state = 'rest'; this.timer = CFG.caveBug.cooldown;
      }
    }
  }
}

/* --------------------------------------------------------------------- Bat */

class Bat extends Enemy {
  constructor(x, y) {
    super(x, y, CFG.bat.radius);
    this.hp = CFG.bat.hp;
    this.state = 'approach';
    this.stolen = null;        // { type, value }
    this.fleeTimer = 0;
    this.bob = Math.random() * TAU;
    this.stuck = 0;
    this.travel = 0;           // path length flown in the current pen window
    this.penWindow = 0;
    this.gore = ['#3b2c46', '#6a5482', '#241a2e'];
  }

  update(dt, game) {
    const p = game.player;
    const w = game.world;
    this.anim += dt;
    this.bob += dt * 9;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.state === 'approach') {
      const d = dist(this.x, this.y, p.x, p.y);
      // Only interested if there is loot worth taking.
      if (game.carry.length === 0 || p.dead || d > CFG.bat.aggro * 1.6) {
        this.wander(dt, w);
      } else {
        this.fly(p.x, p.y + Math.sin(this.bob) * 0.5, CFG.bat.speed, dt, w);
        if (d < CFG.bat.stealRange) this.steal(game);
      }
    } else if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const dx = this.x - p.x, dy = this.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      // Break away from the player and climb — you can still chase it down.
      this.fly(this.x + (dx / len) * 4, this.y + (dy / len) * 2 - 6, CFG.bat.fleeSpeed, dt, w);
      if (this.fleeTimer <= 0) { this.escape(game); return; }
    }

    const px = this.x, py = this.y;
    const b = this.move(dt, w, false);
    if (b.x || b.y) {
      // Bats do not dig. Bounce off, and if a corner really has it pinned,
      // shake loose with a random heading rather than eating the wall.
      this.stuck += dt;
      if (b.x) this.vx *= -0.4;
      if (b.y) this.vy *= -0.4;
      if (this.stuck > 0.8) {
        const a = Math.random() * TAU;
        this.vx = Math.cos(a) * CFG.bat.speed;
        this.vy = Math.sin(a) * CFG.bat.speed;
        this.wx = Math.cos(a); this.wy = Math.sin(a);
        this.stuck = 0;
      }
    } else this.stuck = 0;

    if (this.penned(dt, px, py) && !game.onScreen(this.x, this.y, 1)) { this.dead = true; return; }

    if (Math.abs(this.vx) > 0.2) this.face = this.vx > 0 ? 1 : -1;
    if (w.get(this.x | 0, this.y | 0) === T.LAVA) this.die(game, 'lava');
  }

  /**
   * Give up if walled into a pocket. Without digging, a sealed bat would rattle
   * around holding a spawn slot for the rest of the run. Path length, not net
   * displacement, is the test: a bat circling a room covers plenty of ground,
   * a bat wedged in one tile covers almost none. One carrying loot never gives
   * up, so you always get your shot at taking the gem back — and one the
   * player can see never does either: bats do not blink out of existence.
   */
  penned(dt, px, py) {
    this.travel += dist(this.x, this.y, px, py);
    this.penWindow += dt;
    if (this.penWindow < CFG.bat.penWindow) return false;
    const flown = this.travel;
    this.travel = 0;
    this.penWindow = 0;
    return flown < CFG.bat.penDistance && !this.stolen;
  }

  wander(dt, world) {
    if (Math.random() < dt * 1.4) {
      this.wx = Math.random() * 2 - 1;
      this.wy = Math.random() * 2 - 1;
    }
    const wx = this.wx === undefined ? 0.4 : this.wx;
    const wy = (this.wy || 0) + Math.sin(this.bob) * 0.4;
    this.fly(this.x + wx * 4, this.y + wy * 4, CFG.bat.speed * 0.55, dt, world);
  }

  /**
   * Fly toward a point, going *around* solid tiles rather than through them.
   * The bat is a thief, not a digger: it can only reach you along open air —
   * the tunnels you cut on the way down are its road in.
   */
  fly(tx, ty, speed, dt, world) {
    let ux = tx - this.x, uy = ty - this.y;
    const len = Math.hypot(ux, uy) || 1;
    ux /= len; uy /= len;

    if (!this.clearAhead(world, ux, uy)) {
      // Fan out from the blocked heading and take the first open one. Sweeping
      // both ways keeps it from committing to a single wall-hugging direction.
      const base = Math.atan2(uy, ux);
      let found = false;
      for (let i = 1; i <= 5 && !found; i++) {
        for (const s of [-1, 1]) {
          const a = base + s * i * 0.42;
          const nx = Math.cos(a), ny = Math.sin(a);
          if (this.clearAhead(world, nx, ny)) { ux = nx; uy = ny; found = true; break; }
        }
      }
    }
    this.steer(ux, uy, speed, dt);
  }

  /** Is there open air a bat's length along this heading? */
  clearAhead(world, ux, uy) {
    const d = CFG.bat.lookAhead;
    return world.isFree(this.x + ux * d, this.y + uy * d, this.r) &&
           world.isFree(this.x + ux * d * 0.5, this.y + uy * d * 0.5, this.r);
  }

  steer(ux, uy, speed, dt) {
    const len = Math.hypot(ux, uy) || 1;
    this.vx = lerp(this.vx, (ux / len) * speed, clamp(dt * 5, 0, 1));
    this.vy = lerp(this.vy, (uy / len) * speed, clamp(dt * 5, 0, 1));
  }

  steal(game) {
    if (this.dead || this.stolen) return;
    const gem = game.stealGem();
    if (!gem) return;
    this.stolen = gem;
    this.state = 'flee';
    this.fleeTimer = CFG.bat.escapeTime;
    Sfx.play('steal');
    game.shake(6);
    game.ui.flashLoss();
    game.fx.text(this.x, this.y - 0.6, '-' + fmt(gem.value), '#ff6b6b', { size: 13, life: 1.1 });
    game.fx.burst(this.x, this.y, 10, [CFG.gems.types[gem.type].color, '#ffffff'], { speed: 5, life: 0.4, size: 0.13, glow: true });
  }

  /** Got away clean — the gem is gone for good. */
  escape(game) {
    this.dead = true;
    if (this.stolen) {
      game.track(s => { s.stolen++; });
      game.fx.text(this.x, this.y, loc('fx.gone'), '#ff6b6b', { size: 12, life: 1.2 });
      this.stolen = null;
    }
    game.fx.burst(this.x, this.y, 5, ['#3b2c46'], { speed: 3, life: 0.4, size: 0.12 });
  }

  die(game, cause) {
    // Killed in the act: the loot drops back into the mine.
    if (this.stolen) {
      game.dropStolenGem(this.x, this.y, this.stolen);
      // Sits above the "-value" the theft just floated, so a bat killed in the
      // act reads as both: stolen, then won back.
      game.fx.text(this.x, this.y - 1.3, loc('fx.recovered') + ' +' + fmt(this.stolen.value), '#7ef0d0', { size: 12, life: 1.4 });
      this.stolen = null;
    }
    super.die(game, cause);
  }
}

/* --------------------------------------------------------------- Tunneler */

class Tunneler {
  /**
   * One pass of the great worm: in through one wall, along `row` with a slow
   * undulation, and out through the other. `warn` is the seconds of rumble
   * before it breaks through.
   */
  constructor(world, row, dir, warn) {
    this.row = row;
    this.dir = dir;                  // +1 travels left to right
    this.warn = warn;
    this.warnMax = warn;
    this.phase = Math.random() * TAU;
    this.x = dir > 0 ? -1 : world.w + 1;   // the head starts inside the wall
    this.y = this.pathY(this.x);
    this.trail = [];                 // past head positions, newest first
    this.last = null;                // the last tile it carved
    this.dead = false;
    this.anim = 0;
    this._rumble = 0;
  }

  pathY(x) { return this.row + 0.5 + Math.sin(this.phase + x * 0.42) * CFG.worm.wave; }

  /** Body segment positions, head first, spaced along the trail. */
  segments() {
    const out = [{ x: this.x, y: this.y }];
    for (let k = 1; k < CFG.worm.length; k++) {
      const p = this.trail[Math.min(this.trail.length - 1, k * 3)];
      if (p) out.push(p);
    }
    return out;
  }

  update(dt, game) {
    const W = CFG.worm, w = game.world;
    this.anim += dt;

    if (this.warn > 0) {
      this.warn -= dt;
      this.rumble(dt, game);
      return;
    }

    this.x += this.dir * W.speed * dt;
    this.y = this.pathY(this.x);
    const prev = this.trail[0];
    if (!prev || Math.abs(prev.x - this.x) >= 0.25) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > W.length * 3 + 1) this.trail.pop();
    }

    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!this.last || this.last.x !== tx || this.last.y !== ty) {
      this.carve(game, tx, ty);
      // A step up or down leaves the tunnel joined only at a corner, which no
      // miner fits through — cut the tile that joins it properly.
      if (this.last && this.last.y !== ty) this.carve(game, tx, this.last.y);
      this.last = { x: tx, y: ty };
      if (tx > 0 && tx < w.w - 1 && game.onScreen(this.x, this.y, 2)) {
        game.shake(1.6);
        if (Math.random() < 0.35) Sfx.play('break', { v: 0.35 });
      }
    }

    this.contact(game);
    const out = W.length + 3;
    if (this.x < -out || this.x > w.w + out) this.dead = true;
  }

  /**
   * The warning: the mine shakes, dust sifts down along the row it is coming
   * through, thickest on the side it will break in from.
   */
  rumble(dt, game) {
    const w = game.world;
    this._rumble -= dt;
    if (this._rumble <= 0) {
      this._rumble = 0.55;
      Sfx.play('rumble');
      game.shake(3.5);
    }
    if (Math.random() < dt * 30) {
      const near = Math.random() < 0.6;
      const x = near ? (this.dir > 0 ? 1 + Math.random() * 6 : w.w - 1 - Math.random() * 6)
                     : 1 + Math.random() * (w.w - 2);
      game.fx.burst(x, this.row - 0.4, 1, ['#8a6440', '#a97c4f', '#6f4f31'],
        { speed: 0.6, life: 0.7, size: 0.1, grav: 9 });
    }
  }

  /** Bore through soft ground; rock, stations and the Heartstone it slides past. */
  carve(game, x, y) {
    const w = game.world;
    if (x < 1 || x > w.w - 2 || y <= w.surface || y >= w.h - 1) return;
    const t = w.get(x, y);
    if (t === T.DIRT || t === T.GEM || t === T.GAS) w.destroy(x, y);
    // Loosen the roof: a collapse comes down behind it.
    const roof = w.get(x, y - 1);
    if ((roof === T.DIRT || roof === T.GAS) && Math.random() < CFG.worm.loosen) {
      w.hp[w.idx(x, y - 1)] = Math.min(w.hp[w.idx(x, y - 1)], CFG.mining.dirtHits - 1);
      w.queueFall(x, y - 1);
    }
  }

  /** Anything in its way gets hurt: the miner, and any bug or bat. */
  contact(game) {
    const p = game.player;
    for (const s of this.segments()) {
      if (!p.dead && Math.abs(p.x - s.x) < 0.8 && Math.abs(p.y - s.y) < 0.8) {
        p.hurt(CFG.worm.damage, game, this.dir, -0.8);
      }
      for (const e of game.enemies) {
        if (!e.dead && Math.abs(e.x - s.x) < 0.8 && Math.abs(e.y - s.y) < 0.8) {
          e.hurt(99, game, this.dir, -0.5, 'worm');
        }
      }
    }
  }
}

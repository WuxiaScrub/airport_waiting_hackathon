/* ============================================================================
 * Non-enemy actors: loose gems, lit dynamite, and falling dirt.
 * Positions are in TILE units (1.0 = one tile), origin at the tile grid.
 * ========================================================================== */

class GemPickup {
  constructor(x, y, type, opt) {
    this.x = x; this.y = y;
    this.type = type;
    const o = opt || {};
    const a = o.angle !== undefined ? o.angle : -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const s = o.speed !== undefined ? o.speed : 2.6;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.age = 0;
    this.dead = false;
    this.heart = !!o.heart;
    this.grace = 0.12;      // brief window before the magnet can grab it
  }

  update(dt, game) {
    this.age += dt;
    this.grace -= dt;
    const w = game.world;
    const p = game.player;
    const r = 0.22;

    const d = dist(this.x, this.y, p.x, p.y);
    if (this.grace <= 0 && d < CFG.player.magnet && !p.dead) {
      // Magnet pull, strongest up close.
      const pull = (1 - d / CFG.player.magnet) * 46;
      this.vx += ((p.x - this.x) / (d || 1)) * pull * dt;
      this.vy += ((p.y - this.y) / (d || 1)) * pull * dt;
      if (d < 0.45) { game.collectGem(this); return; }
    } else {
      this.vy += 16 * dt;
    }
    this.vx *= 0.94;
    this.vy = clamp(this.vy, -14, 14);

    // Axis-separated collision so a gem slides along the floor instead of stopping dead.
    let nx = this.x + this.vx * dt;
    if (!w.isFree(nx, this.y, r)) { this.vx *= -0.32; } else this.x = nx;
    let ny = this.y + this.vy * dt;
    if (!w.isFree(this.x, ny, r)) { this.vy *= -0.22; if (Math.abs(this.vy) < 1.2) this.vy = 0; }
    else this.y = ny;

    if (w.get(this.x | 0, this.y | 0) === T.LAVA) this.dead = true;
  }
}

class Dynamite {
  constructor(x, y) {
    this.x = x; this.y = y;      // tile-centre position
    this.tx = x | 0; this.ty = y | 0;
    this.fuse = CFG.dynamite.fuse;
    this.dead = false;
    this._beep = 0;
  }

  update(dt, game) {
    this.fuse -= dt;
    this._beep -= dt;
    if (this._beep <= 0) {
      this._beep = clamp(this.fuse * 0.32, 0.07, 0.3);
      Sfx.play('fuse', { v: 0.8 });
      game.fx.drift(this.x, this.y - 0.3, 2, ['#ffd97a', '#ff9a3c'], { life: 0.4, size: 0.09, rise: 1.8 });
    }
    if (this.fuse <= 0) { this.detonate(game); }
  }

  detonate(game) {
    if (this.dead) return;
    this.dead = true;
    const { x, y } = this;
    game.world.explode(this.tx, this.ty);

    game.fx.burst(x, y, 34, ['#fff3c4', '#ffb03a', '#ff5a1e', '#8a3410'], { speed: 12, life: 0.6, size: 0.24, grav: 4, glow: true });
    game.fx.drift(x, y, 14, ['#4a4048', '#2e272f'], { life: 1.5, size: 0.4, spread: 1.6, rise: 1.0, glow: false });
    game.fx.ring(x, y, 3.2, '#ffd08a', 0.34);
    game.shake(CFG.dynamite.shake);
    game.addLight(x, y, 9, 0.35);
    Sfx.play('boom');

    const R = CFG.dynamite.blastRadius;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (dist(e.x, e.y, x, y) <= R) e.hurt(CFG.dynamite.enemyDamage, game, e.x - x, e.y - y);
    }
    for (const d of game.dynamites) {
      if (d !== this && !d.dead && dist(d.x, d.y, x, y) <= R + 0.6) d.fuse = Math.min(d.fuse, 0.12);
    }
    const p = game.player;
    if (!p.dead && dist(p.x, p.y, x, y) <= R) {
      p.hurt(CFG.dynamite.playerDamage, game, p.x - x, p.y - y);
    }
  }
}

class FallingBlock {
  constructor(x, y) {
    this.x = x + 0.5;
    this.y = y + 0.5;
    this.vy = 0;
    this.dead = false;
    this.hitPlayer = false;
  }

  update(dt, game) {
    const w = game.world;
    this.vy = Math.min(this.vy + 42 * dt, CFG.mining.fallSpeed);
    this.y += this.vy * dt;

    const tx = this.x | 0;
    const below = Math.floor(this.y + 0.5);

    if (!this.hitPlayer) {
      const p = game.player;
      if (!p.dead && Math.abs(p.x - this.x) < 0.7 && Math.abs(p.y - this.y) < 0.7) {
        this.hitPlayer = true;
        p.hurt(CFG.mining.fallDamage, game, 0, 1);
      }
    }
    for (const e of game.enemies) {
      if (!e.dead && Math.abs(e.x - this.x) < 0.7 && Math.abs(e.y - this.y) < 0.7) {
        e.hurt(2, game, 0, 1);
      }
    }

    if (w.isSolid(tx, below) || below >= w.h) {
      const restY = below - 1;
      this.settle(game, tx, restY);
    }
  }

  settle(game, tx, ty) {
    this.dead = true;
    const w = game.world;
    if (w.get(tx, ty) === T.EMPTY) {
      // Lands weakened, so a stack of settled dirt stays collapsible.
      w.set(tx, ty, T.DIRT, CFG.mining.dirtHits - 1);
      w.checkNeighbours(tx, ty);
    }
    game.fx.burst(tx + 0.5, ty + 0.5, 8, ['#8a6440', '#6f4f31', '#a97c4f'], { speed: 3.4, life: 0.4, size: 0.14 });
    game.shake(3.2);
    Sfx.play('break', { v: 0.5 });
  }
}

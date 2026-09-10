/* ============================================================================
 * Player — a miner who walks freely through the tunnels. Gravity in this mine
 * applies to dirt, not to people: that keeps the joystick honest and makes
 * "climb back up the shaft you dug" the natural escape route.
 * ========================================================================== */

class Player {
  constructor(x, y, upgrades) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = CFG.player.radius;

    this.maxHealth = CFG.player.maxHealth + (upgrades.health || 0) * CFG.upgradeEffect.health;
    this.health = this.maxHealth;
    this.speed = CFG.player.speed * (1 + (upgrades.speed || 0) * CFG.upgradeEffect.speed);
    this.light = CFG.player.light + (upgrades.light || 0) * CFG.upgradeEffect.light;
    this.dynMax = CFG.dynamite.capacity + (upgrades.dynamite || 0) * CFG.upgradeEffect.dynamite;
    this.dynamite = this.dynMax;

    this.facing = { x: 0, y: 1 };
    this.tool = 0;               // 0 = pickaxe, 1 = dynamite
    this.swing = 0;              // counts down during a swing
    this.swingAnim = 0;          // 0..1 for drawing the arc
    this.invuln = 0;
    this.walk = 0;               // leg animation phase
    this.moving = false;
    this.dead = false;
    this.hasHeartstone = false;
    this.lampFlicker = 0;
  }

  get tile() { return { x: Math.floor(this.x), y: Math.floor(this.y) }; }

  /** The tile the pickaxe / dynamite will act on. */
  targetTile() {
    return { x: Math.floor(this.x) + this.facing.x, y: Math.floor(this.y) + this.facing.y };
  }

  update(dt, game, input) {
    if (this.dead) return;
    this.invuln = Math.max(0, this.invuln - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.2);
    this.lampFlicker = lerp(this.lampFlicker, Math.random(), dt * 9);

    const ix = input.dir.x, iy = input.dir.y;
    const mag = Math.hypot(ix, iy);
    this.moving = mag > 0.12;

    if (this.moving) {
      const s = this.speed * clamp(mag, 0, 1);
      this.vx = lerp(this.vx, (ix / mag) * s, clamp(dt * 18, 0, 1));
      this.vy = lerp(this.vy, (iy / mag) * s, clamp(dt * 18, 0, 1));
      this.facing = cardinal(ix, iy);
      this.walk += dt * (6 + s);
    } else {
      this.vx = lerp(this.vx, 0, clamp(dt * 20, 0, 1));
      this.vy = lerp(this.vy, 0, clamp(dt * 20, 0, 1));
    }

    const w = game.world;
    const nx = this.x + this.vx * dt;
    if (w.isFree(nx, this.y, this.r)) this.x = nx; else this.vx = 0;
    const ny = this.y + this.vy * dt;
    if (w.isFree(this.x, ny, this.r)) this.y = ny; else this.vy = 0;

    this.x = clamp(this.x, 1 + this.r, w.w - 1 - this.r);
    this.y = clamp(this.y, this.r, w.h - 1 - this.r);

    // Action: pickaxe auto-repeats while held; dynamite is one per press.
    if (this.tool === 0) {
      if (input.actionHeld && this.swing <= 0) this.doSwing(game);
    } else if (input.consumeAction()) {
      this.placeDynamite(game);
    }

    if (w.get(Math.floor(this.x), Math.floor(this.y)) === T.LAVA) {
      this.hurt(CFG.lava.damage, game, 0, -1, true);
    }
  }

  /** One swing both mines the tile in front and hits anything standing there. */
  doSwing(game) {
    this.swing = CFG.player.swingTime;
    this.swingAnim = 1;

    const t = this.targetTile();
    const cx = t.x + 0.5, cy = t.y + 0.5;
    let didSomething = false;

    for (const e of game.enemies) {
      if (e.dead) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (Math.hypot(dx, dy) > CFG.player.swingReach) continue;
      // Only count enemies roughly in front of the swing.
      if (dx * this.facing.x + dy * this.facing.y < -0.15) continue;
      e.hurt(1, game, dx, dy);
      didSomething = true;
    }

    const res = game.world.damage(t.x, t.y);
    if (res === 'broke') {
      Sfx.play('break');
      game.shake(3);
      didSomething = true;
    } else if (res === 'hit') {
      Sfx.play('mine');
      game.fx.burst(cx - this.facing.x * 0.35, cy - this.facing.y * 0.35, 5,
        ['#8a6440', '#a97c4f', '#5d4429'], { speed: 4, life: 0.32, size: 0.12 });
      game.shake(1.4);
      didSomething = true;
    } else if (res === 'hard') {
      Sfx.play('clink');
      game.fx.burst(cx - this.facing.x * 0.4, cy - this.facing.y * 0.4, 4,
        ['#ffe9a8', '#ffffff', '#9aa1ad'], { speed: 5, life: 0.22, size: 0.09, glow: true });
      didSomething = true;
    }

    if (!didSomething) Sfx.play('mine', { v: 0.4 });
  }

  placeDynamite(game) {
    if (this.dynamite <= 0) { Sfx.play('clink', { v: 0.5 }); game.ui.toast('NO DYNAMITE'); return; }
    const t = this.targetTile();
    if (game.world.get(t.x, t.y) === T.BEDROCK) { game.ui.toast('CAN’T PLACE THERE'); return; }
    if (game.dynamites.some(d => d.tx === t.x && d.ty === t.y && !d.dead)) return;

    this.dynamite--;
    game.dynamites.push(new Dynamite(t.x + 0.5, t.y + 0.5));
    game.ui.syncTools(this);
    Sfx.play('place');
  }

  setTool(i) {
    this.tool = i;
    Sfx.play('ui');
  }

  /** Returns true if the hit actually landed (i-frames can eat it). */
  hurt(amount, game, kx, ky, ignoreInvuln) {
    if (this.dead) return false;
    if (this.invuln > 0 && !ignoreInvuln) return false;

    this.health -= amount;
    this.invuln = CFG.player.invuln;
    const d = Math.hypot(kx || 0, ky || 0) || 1;
    this.vx += ((kx || 0) / d) * CFG.player.knockback;
    this.vy += ((ky || 0) / d) * CFG.player.knockback;

    Sfx.play('hurt');
    game.shake(9);
    game.ui.flashHurt();
    game.ui.syncHealth(this);
    game.fx.burst(this.x, this.y, 10, ['#ff5d5d', '#ffb0b0'], { speed: 6, life: 0.4, size: 0.14 });

    if (this.health <= 0) { this.health = 0; game.killPlayer(); }
    return true;
  }

  heal(n, game) {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + n);
    if (this.health !== before) game.ui.syncHealth(this);
    return this.health - before;
  }
}

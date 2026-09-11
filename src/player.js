/* ============================================================================
 * Player — a miner subject to the same gravity as the dirt around them.
 *
 * The stick steers horizontally and *aims* vertically: push down to dig the
 * floor out from under yourself, push up to chew at the ceiling. Getting back
 * up is a jump, a staircase, or a pile of dirt you knocked loose on purpose —
 * which is exactly the "no instant return to the surface" the design asks for.
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
    this.jumpVel = CFG.player.jumpVel + (upgrades.jump || 0) * CFG.upgradeEffect.jump;
    this.hatMax = (upgrades.helmet || 0) * CFG.upgradeEffect.helmet;
    this.hat = this.hatMax;
    this.hatTimer = 0;

    this.facing = { x: 0, y: 1 };
    this.swing = 0;              // counts down during a swing
    this.swingAnim = 0;          // 0..1 for drawing the arc
    this.throwAnim = 0;          // 0..1 for the off-hand dynamite toss
    this.invuln = 0;
    this.walk = 0;               // leg animation phase
    this.moving = false;
    this.dead = false;
    this.hasHeartstone = false;
    this.lampFlicker = 0;

    this.grounded = true;
    this.coyote = 0;             // grace window after leaving the ground
    this.buffer = 0;             // jump pressed slightly before landing
    this.jumping = false;        // true while the launch can still be cut short
    this.airTime = 0;

    this.gripping = false;       // hooked onto a wall with the grapple
    this.gripDir = 0;            // -1 / +1 — which side the hook bit into
    this.gripTile = null;        // {x, y} of the tile being held, for drawing
    this.gripAnim = 0;           // 0..1, hook-fires flourish
  }

  get tile() { return { x: Math.floor(this.x), y: Math.floor(this.y) }; }

  /**
   * The tile the pickaxe / dynamite will act on. `facing` is an 8-way snap, so
   * this reaches the diagonal neighbour when the stick is held on a diagonal.
   */
  targetTile() {
    return { x: Math.floor(this.x) + this.facing.x, y: Math.floor(this.y) + this.facing.y };
  }

  update(dt, game, input) {
    if (this.dead) return;
    this.invuln = Math.max(0, this.invuln - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.2);
    this.throwAnim = Math.max(0, this.throwAnim - dt * 3.4);
    this.gripAnim = Math.max(0, this.gripAnim - dt * 3.6);
    this.lampFlicker = lerp(this.lampFlicker, Math.random(), dt * 9);
    this.rechargeHat(dt, game);

    const P = CFG.player;
    const w = game.world;
    const ix = input.dir.x, iy = input.dir.y;

    // The stick still sets facing on both axes — that is how you aim a swing.
    // Eight directions: a held diagonal reaches the corner tile.
    if (Math.hypot(ix, iy) > 0.12) this.facing = aimDir(ix, iy);

    /* ---- horizontal steering ---- */
    const drive = Math.abs(ix) > 0.14 ? clamp(ix, -1, 1) : 0;
    this.moving = drive !== 0;
    const control = this.grounded ? 1 : P.airControl;
    if (drive) {
      this.vx = lerp(this.vx, drive * this.speed, clamp(dt * 18 * control, 0, 1));
      this.walk += dt * (6 + Math.abs(this.vx));
    } else {
      this.vx = lerp(this.vx, 0, clamp(dt * (this.grounded ? 20 : 5), 0, 1));
    }

    /* ---- grapple grip ---- */
    this.updateGrip(w, ix, game);

    /* ---- jumping ---- */
    this.coyote = this.grounded ? P.coyote : Math.max(0, this.coyote - dt);
    this.buffer = input.consumeJump() ? P.jumpBuffer : Math.max(0, this.buffer - dt);
    if (this.buffer > 0 && (this.coyote > 0 || this.gripping)) this.jump(game);
    // Releasing early clips the arc, so a tap is a hop and a hold is a leap.
    if (this.jumping && !input.jumpHeld && this.vy < 0) {
      this.vy *= P.jumpCut;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    /* ---- gravity (a grip holds you against it) ---- */
    if (this.gripping) this.vy = Math.min(this.vy, P.gripSlide);
    else this.vy = Math.min(this.vy + P.gravity * dt, P.maxFall);

    /* ---- collision, axis at a time ---- */
    const nx = this.x + this.vx * dt;
    if (w.isFree(nx, this.y, this.r)) this.x = nx; else this.vx = 0;
    const ny = this.y + this.vy * dt;
    if (w.isFree(this.x, ny, this.r)) this.y = ny;
    else if (this.vy < 0 && this.squeezePast(w, ny)) { /* scraped past a corner */ }
    else {
      if (this.vy > 3.5) this.land(game);
      this.vy = 0;
    }

    this.x = clamp(this.x, 1 + this.r, w.w - 1 - this.r);
    this.y = clamp(this.y, this.r, w.h - 1 - this.r);

    const wasGrounded = this.grounded;
    this.grounded = this.vy >= 0 && this.standingOn(w);
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    if (this.grounded && !wasGrounded) this.jumping = false;

    // Two independent verbs, no mode to be in: the pickaxe auto-repeats while
    // its button is held, dynamite drops one stick per press.
    if (input.mineHeld && this.swing <= 0) this.doSwing(game);
    if (input.consumeDynamite()) this.placeDynamite(game);

    if (w.get(Math.floor(this.x), Math.floor(this.y)) === T.LAVA) {
      this.hurt(CFG.lava.damage, game, 0, -1, true);
    }
  }

  /**
   * Feet probe. Still narrower than the collision radius — a full-width probe
   * brushes the wall you are pressed against and hands you a free wall-jump —
   * but wide and deep enough that standing on the lip of a tile counts.
   */
  standingOn(w) {
    return !w.isFree(this.x, this.y + CFG.player.groundProbe, this.r * CFG.player.groundWidth);
  }

  /**
   * Corner correction for a rising jump. A one-tile shaft is barely wider than
   * the miner, so being a hand's width off centre used to bury the jump in the
   * lip of the tile next door — you were standing under the hole and still
   * bounced off the ceiling. If a small sideways scrape clears it, take it.
   *
   * The nudge only happens on the way *up*: catching a lip on the way down is
   * a ledge you landed on, which is exactly what should happen.
   */
  squeezePast(w, ny) {
    const max = CFG.player.cornerNudge;
    const step = 0.07;
    // Favour the side you are already drifting toward — that is almost always
    // the one the opening is on.
    const order = this.vx >= 0 ? [1, -1] : [-1, 1];
    for (let d = step; d <= max + 1e-4; d += step) {
      for (const s of order) {
        const nx = this.x + s * d;
        // Legal at both heights, or the shift would post the miner through a
        // wall instead of round a corner.
        if (w.isFree(nx, this.y, this.r) && w.isFree(nx, ny, this.r)) {
          this.x = nx;
          this.y = ny;
          return true;
        }
      }
    }
    return false;
  }

  /* ---------------------------------------------------------- grapple grip */

  /**
   * Push the stick into a wall while falling and the grapple bites: the miner
   * hangs off that tile instead of dropping past it, and can jump from there.
   * Climbing a sheer shaft becomes grip → jump → grip, which is deliberate
   * work rather than a free ride to the surface.
   */
  updateGrip(w, ix, game) {
    const was = this.gripping;
    const tile = this.gripTarget(w, ix);
    this.gripping = !!tile;
    this.gripTile = tile;
    if (!tile) { this.gripDir = 0; return; }

    this.gripDir = ix > 0 ? 1 : -1;
    if (!was) {
      this.gripAnim = 1;
      this.vy = Math.min(this.vy, CFG.player.gripSlide);
      Sfx.play('grip', { v: 0.9 });
      game.fx.burst(tile.x + 0.5 - this.gripDir * 0.4, tile.y + 0.5, 4,
        ['#c8a06a', '#8a6440', '#cfd6df'], { speed: 2.6, life: 0.3, size: 0.09 });
    }
  }

  /**
   * The tile the hook would catch, or null. Head, waist and feet all count, so
   * a ledge caught at any height on the way past is a grip.
   */
  gripTarget(w, ix) {
    const P = CFG.player;
    // Only while airborne, and only once you have stopped rising: a grip must
    // never eat the jump that is carrying you up the shaft.
    if (this.dead || this.grounded || this.vy < 0) return null;
    if (Math.abs(ix) < P.gripDeadzone) return null;

    const dir = ix > 0 ? 1 : -1;
    const tx = Math.floor(this.x + dir * (this.r + P.gripReach));
    for (const off of [-this.r * 0.9, 0, this.r * 0.9]) {
      const ty = Math.floor(this.y + off);
      if (w.isSolid(tx, ty)) return { x: tx, y: ty };
    }
    return null;
  }

  jump(game) {
    const fromGrip = this.gripping;
    this.vy = -this.jumpVel * (fromGrip ? CFG.player.gripJumpBoost : 1);
    this.jumping = true;
    this.grounded = false;
    this.gripping = false;
    this.gripTile = null;
    this.coyote = 0;
    this.buffer = 0;
    Sfx.play('jump');
    const px = fromGrip ? this.x + this.gripDir * 0.3 : this.x;
    const py = fromGrip ? this.y : this.y + 0.35;
    game.fx.burst(px, py, 5, ['#8a6440', '#a97c4f', '#5d4429'],
      { speed: 2.6, life: 0.28, size: 0.1, grav: 16 });
  }

  /** Landing puff — no fall damage, the falling dirt already punishes you. */
  land(game) {
    const hard = this.vy > 13;
    game.fx.burst(this.x, this.y + 0.34, hard ? 7 : 4, ['#8a6440', '#6f4f31', '#a97c4f'],
      { speed: hard ? 3.4 : 2.2, life: 0.3, size: 0.11, grav: 18 });
    if (hard) { game.shake(2.4); Sfx.play('land', { v: 0.7 }); }
  }

  /* ------------------------------------------------------------- hard hat */

  rechargeHat(dt, game) {
    if (this.hatMax <= 0 || this.hat >= this.hatMax) return;
    this.hatTimer -= dt;
    if (this.hatTimer > 0) return;
    this.hat++;
    this.hatTimer = CFG.player.hatRecharge;
    Sfx.play('ui', { v: 0.5 });
    game.ui.syncHat(this);
  }

  refillHat(game) {
    const before = this.hat;
    this.hat = this.hatMax;
    this.hatTimer = 0;
    if (this.hat !== before) game.ui.syncHat(this);
    return this.hat - before;
  }

  /**
   * A block of dirt landing on your head. The hard hat eats the hit outright —
   * that is the whole point of buying one — and then re-forms over time.
   */
  takeFallingDirt(game) {
    if (this.dead) return;
    if (this.hat > 0) {
      this.hat--;
      this.hatTimer = CFG.player.hatRecharge;
      Sfx.play('clink');
      game.shake(6);
      game.fx.burst(this.x, this.y - 0.45, 9, ['#ffd66b', '#ffffff', '#e8a63c'],
        { speed: 5, life: 0.35, size: 0.11, glow: true });
      game.fx.text(this.x, this.y - 0.8, loc('fx.clunk'), '#ffd66b', { size: 12, life: 0.8 });
      game.ui.syncHat(this);
      return;
    }
    this.hurt(CFG.mining.fallDamage, game, 0, 1);
  }

  /* --------------------------------------------------------------- actions */

  /** One swing both mines the tile in front and hits anything standing there. */
  doSwing(game) {
    this.swing = CFG.player.swingTime;
    this.swingAnim = 1;

    const tt = this.targetTile();
    const cx = tt.x + 0.5, cy = tt.y + 0.5;
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

    const res = game.world.damage(tt.x, tt.y);
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

  /**
   * The stick goes where the miner is standing, never where they are aiming:
   * you drop it at your feet and then run. It falls under gravity from there,
   * so dropping one over a shaft sends it down the shaft rather than leaving
   * it hanging in mid-air.
   */
  placeDynamite(game) {
    if (this.dynamite <= 0) { Sfx.play('clink', { v: 0.5 }); game.ui.toast(loc('toast.noDynamite')); return; }
    const tt = this.tile;
    if (game.world.get(tt.x, tt.y) === T.BEDROCK) { game.ui.toast(loc('toast.cantPlace')); return; }
    if (game.dynamites.some(d => d.tx === tt.x && d.ty === tt.y && !d.dead)) return;

    this.dynamite--;
    game.dynamites.push(new Dynamite(tt.x + 0.5, tt.y + 0.5));
    this.throwAnim = 1;
    game.ui.syncDynamite(this);
    Sfx.play('place');
  }

  /** Returns true if the hit actually landed (i-frames can eat it). */
  hurt(amount, game, kx, ky, ignoreInvuln) {
    if (this.dead) return false;
    if (this.invuln > 0 && !ignoreInvuln) return false;

    this.health -= amount;
    this.invuln = CFG.player.invuln;
    const d = Math.hypot(kx || 0, ky || 0) || 1;
    this.vx += ((kx || 0) / d) * CFG.player.knockback;
    this.vy += ((ky || 0) / d) * CFG.player.knockback * 0.45;   // gravity does the rest

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

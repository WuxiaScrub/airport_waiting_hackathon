/* ============================================================================
 * Demo — the miner that plays behind the title screen.
 *
 * The title's mine is a real one, run by the real simulation; this file only
 * stands in for the thumbs. It feeds the player the same { dir, mineHeld,
 * jumpHeld } a joystick would, from a handful of simple habits: walk off the
 * camp, dig down, tunnel sideways toward gems, swing at whatever comes close,
 * and now and then light a stick of dynamite and back away from it.
 *
 * While the demo runs (game.demo is set) the game keeps it harmless: no
 * damage, no stats or achievements, no shop, no eruption clock, no HUD, and
 * its sounds play through a quieter bus. When the miner gets deep, stuck, or
 * has been at it long enough, a fresh mine takes its place.
 * ========================================================================== */

const demoRand = (a, b) => a + Math.random() * (b - a);

class Demo {
  constructor() {
    // The input a Player reads — same shape as Input's.
    this.input = {
      dir: { x: 0, y: 0 },
      mineHeld: false,
      jumpHeld: false,
      _jump: false,
      _dyn: false,
      consumeJump() { const j = this._jump; this._jump = false; return j; },
      consumeDynamite() { const d = this._dyn; this._dyn = false; return d; },
    };
    this.mode = 'walk';
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.goalX = null;          // column the walk / tunnel is heading for
    this.timer = 0;             // seconds in the current mode
    this.age = 0;               // seconds this mine has been demoed
    this.stuck = 0;
    this.last = null;           // position a moment ago, for stuck detection
    this.lastDig = 0;           // depth of the last sideways tunnel
    this.nextBoom = demoRand(14, 22);
  }

  /** Decide this step's input. Returns false when the mine should be replaced. */
  think(dt, game) {
    const D = CFG.demo, p = game.player, w = game.world, inp = this.input;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    const depth = game.depth();
    this.age += dt;
    this.timer += dt;
    this.nextBoom -= dt;
    if (this.age > D.maxTime || depth > D.maxDepth) return false;

    // Stuck: barely moved for a while although we are trying to.
    if (!this.last || dist(p.x, p.y, this.last.x, this.last.y) > 0.6) {
      this.last = { x: p.x, y: p.y }; this.stuck = 0;
    } else if ((this.stuck += dt) > D.stuckReset) return false;

    let dx = 0, dy = 0, mine = false, jump = false;

    // Something close enough to hit: hit it. This beats every other habit.
    const foe = this.nearestFoe(game, D.fightRange);
    if (foe && this.mode !== 'retreat') {
      dx = foe.x - p.x; dy = foe.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      mine = true;
      if (dy < -0.5 && p.grounded && Math.random() < dt * 2) jump = true;
      this.set(inp, dx, dy, mine, jump);
      return true;
    }

    // In the air: hands off. Pushing sideways now would hook the grapple into
    // the shaft wall and leave the miner hanging there.
    if (!p.grounded && this.mode !== 'walk') {
      this.set(inp, 0, 0, false, false);
      return true;
    }

    switch (this.mode) {
      case 'walk': {
        // Off the camp shelf to a spot to start digging.
        if (this.goalX === null) this.goalX = clamp(tx + this.side * Math.round(demoRand(5, 9)), 3, w.w - 4);
        if (Math.abs(p.x - (this.goalX + 0.5)) < 0.3) { this.to('dig'); break; }
        dx = Math.sign(this.goalX + 0.5 - p.x);
        mine = w.isSolid(tx + dx, ty);
        if (mine && !w.isMineable(tx + dx, ty)) jump = p.grounded;
        if (this.stuck > 1.2 && p.grounded) jump = true;
        break;
      }

      case 'dig': {
        // A gem beside or just below: tunnel over to it.
        const gem = this.gemNear(w, tx, ty);
        if (gem !== null && this.timer > 0.4) { this.tunnel(tx, gem - tx, Math.abs(gem - tx)); break; }
        // Every so often, a side tunnel just to see what is there.
        if (depth - this.lastDig >= D.tunnelEvery && w.isMineable(tx + this.side, ty)) {
          this.lastDig = depth;
          this.tunnel(tx, this.side, Math.round(demoRand(3, 6)));
          break;
        }
        const below = w.get(tx, ty + 1);
        if (below === T.ROCK || below === T.BEDROCK) {
          // Can't go down here: step over to a column that can.
          const s = w.isSolid(tx + this.side, ty + 1) && w.get(tx + this.side, ty + 1) === T.ROCK ? -this.side : this.side;
          this.tunnel(tx, s, 2);
          break;
        }
        dy = 1; mine = w.isSolid(tx, ty + 1);
        // Centre over the shaft so the miner drops cleanly down it.
        const off = tx + 0.5 - p.x;
        if (Math.abs(off) > 0.15) dx = Math.sign(off) * 0.5;
        break;
      }

      case 'tunnel': {
        if (Math.abs(p.x - (this.goalX + 0.5)) < 0.3 || this.timer > 6) {
          // A tunnel long enough to back down is a good place for a blast.
          if (this.nextBoom <= 0 && p.dynamite > 0 && Math.abs(this.goalX - this.startX) >= 3 && w.isMineable(tx + this.side, ty)) {
            this.input._dyn = true;
            this.nextBoom = demoRand(D.boomEvery[0], D.boomEvery[1]);
            this.backX = this.startX;
            this.blastX = tx;
            this.to('retreat');
          } else {
            this.to('dig');
          }
          break;
        }
        dx = this.side;
        const ahead = w.get(tx + dx, ty);
        if (ahead === T.ROCK || ahead === T.BEDROCK) { this.to('dig'); break; }
        mine = w.isSolid(tx + dx, ty);
        break;
      }

      case 'retreat': {
        // Back up the tunnel, wait for the bang, then go and look at the hole.
        if (this.timer < CFG.dynamite.fuse + 0.5) {
          if (Math.abs(this.backX + 0.5 - p.x) > 0.3) dx = Math.sign(this.backX + 0.5 - p.x);
        } else {
          this.tunnel(tx, this.side, Math.abs(this.blastX - tx) + 1);
        }
        break;
      }
    }

    this.set(inp, dx, dy, mine, jump);
    return true;
  }

  set(inp, dx, dy, mine, jump) {
    inp.dir.x = dx; inp.dir.y = dy;
    inp.mineHeld = mine;
    if (jump && !inp.jumpHeld) inp._jump = true;
    inp.jumpHeld = jump;
  }

  to(mode) { this.mode = mode; this.timer = 0; }

  /** Dig sideways from column `from`, `len` tiles in direction `dir`. */
  tunnel(from, dir, len) {
    this.side = Math.sign(dir) || this.side;
    this.startX = from;
    this.goalX = from + this.side * Math.max(1, len);
    this.to('tunnel');
  }

  /** Column of a gem tile on this row or the next, within reach of a tunnel. */
  gemNear(w, tx, ty) {
    for (let d = 1; d <= CFG.demo.gemReach; d++) {
      for (const s of [this.side, -this.side]) {
        if (w.get(tx + s * d, ty) === T.GEM) return tx + s * d;
      }
    }
    return null;
  }

  nearestFoe(game, range) {
    let best = null, bd = range;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, game.player.x, game.player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}

/* ============================================================================
 * FX — particles, floating text, screen-space gem flights, screen shake.
 * All pooled into flat arrays; nothing allocates per frame after warm-up.
 * ========================================================================== */

class FX {
  constructor(game) {
    this.game = game;
    this.parts = [];      // world-space particles (tile units)
    this.texts = [];      // world-space floating labels
    this.flights = [];    // screen-space gems flying to the HUD
    this.rings = [];      // expanding shock rings
  }

  clear() { this.parts.length = 0; this.texts.length = 0; this.flights.length = 0; this.rings.length = 0; }

  burst(x, y, n, colors, opt) {
    const o = opt || {};
    const spd = o.speed || 5.5;
    const life = o.life || 0.55;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = spd * (0.25 + Math.random() * 0.9);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s + (o.vx || 0),
        vy: Math.sin(a) * s + (o.vy || 0),
        life: life * (0.6 + Math.random() * 0.8), max: life,
        size: (o.size || 0.16) * (0.5 + Math.random()),
        color: colors[(Math.random() * colors.length) | 0],
        grav: o.grav === undefined ? 13 : o.grav,
        glow: !!o.glow,
      });
    }
  }

  /** Long-lived, buoyant motes — smoke, embers, dust hanging in a lamp beam. */
  drift(x, y, n, colors, opt) {
    const o = opt || {};
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * (o.spread || 0.6),
        y: y + (Math.random() - 0.5) * (o.spread || 0.6),
        vx: (Math.random() - 0.5) * (o.speed || 1.2),
        vy: -(o.rise || 1.4) * (0.5 + Math.random()),
        life: (o.life || 1.1) * (0.6 + Math.random()), max: o.life || 1.1,
        size: (o.size || 0.2) * (0.6 + Math.random()),
        color: colors[(Math.random() * colors.length) | 0],
        grav: o.grav === undefined ? -1.5 : o.grav,
        glow: o.glow !== false,
      });
    }
  }

  text(x, y, str, color, opt) {
    const o = opt || {};
    this.texts.push({ x, y, str, color, life: o.life || 1.0, max: o.life || 1.0, size: o.size || 12, vy: o.vy || -1.4 });
  }

  ring(x, y, r, color, life) {
    this.rings.push({ x, y, r0: 0.3, r: r, life: life || 0.4, max: life || 0.4, color });
  }

  /** A collected gem streaking up to the carry counter. Pure feedback. */
  flyToHud(sx, sy, color, value) {
    this.flights.push({
      x: sx, y: sy, sx, sy, t: 0, dur: 0.42, color, value,
      cx: sx + (Math.random() - 0.5) * 120, cy: sy - 100 - Math.random() * 60,
    });
  }

  update(dt) {
    const p = this.parts;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) { p[i] = p[p.length - 1]; p.pop(); continue; }
      q.vy += q.grav * dt;
      q.vx *= 0.985;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    const tx = this.texts;
    for (let i = tx.length - 1; i >= 0; i--) {
      const q = tx[i];
      q.life -= dt;
      if (q.life <= 0) { tx[i] = tx[tx.length - 1]; tx.pop(); continue; }
      q.y += q.vy * dt; q.vy *= 0.93;
    }
    const rg = this.rings;
    for (let i = rg.length - 1; i >= 0; i--) {
      const q = rg[i];
      q.life -= dt;
      if (q.life <= 0) { rg[i] = rg[rg.length - 1]; rg.pop(); }
    }
    const fl = this.flights;
    for (let i = fl.length - 1; i >= 0; i--) {
      const q = fl[i];
      q.t += dt;
      if (q.t >= q.dur) { fl[i] = fl[fl.length - 1]; fl.pop(); continue; }
      const k = q.t / q.dur;
      const tgt = this.game.ui.carryAnchor();
      // Quadratic bezier: launch outward, then curve into the HUD counter.
      const inv = 1 - k;
      q.x = inv * inv * q.sx + 2 * inv * k * q.cx + k * k * tgt.x;
      q.y = inv * inv * q.sy + 2 * inv * k * q.cy + k * k * tgt.y;
    }
  }
}

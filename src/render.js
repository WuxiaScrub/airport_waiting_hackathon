/* ============================================================================
 * Renderer — every sprite is drawn procedurally at boot into a small atlas of
 * offscreen canvases; nothing is loaded from disk.
 *
 * Lighting is a two-layer composite:
 *   1. a dim "memory" layer showing terrain you have already explored,
 *   2. a full-brightness layer (terrain + actors) masked by the light sources.
 * That is what makes darkness a mechanic: you remember the walls, but a spider
 * standing in an unlit tunnel is genuinely invisible.
 * ========================================================================== */

/* Flat colours for the remembered-terrain layer. */
const MEM_COLOR = {
  // Excavated space gets its own (very dark) colour so the tunnels you dug are
  // still legible on the way back up — that is the whole escape route.
  [T.EMPTY]: '#2a2038',
  [T.DIRT]: '#4b3724',
  [T.ROCK]: '#43474f',
  [T.GEM]: '#54402a',
  [T.CHECKPOINT]: '#6a5a2a',
  [T.LAVA]: '#7a2408',
  [T.HEART]: '#7a2436',
  [T.BEDROCK]: '#1b1b22',
};

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lit = document.createElement('canvas');
    this.lctx = this.lit.getContext('2d');
    // The light mask is a union of soft gradients, so half resolution is free.
    this.mask = document.createElement('canvas');
    this.mctx = this.mask.getContext('2d');
    this.maskScale = 0.5;
    this.atlas = null;
    this.cw = 0; this.ch = 0; this.ppt = 32;
    this.buildAtlas();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.render.maxDpr);
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.cssW = w; this.cssH = h;
    this.cw = Math.round(w * dpr); this.ch = Math.round(h * dpr);
    for (const c of [this.canvas, this.lit]) { c.width = this.cw; c.height = this.ch; }
    this.mask.width = Math.max(1, Math.round(this.cw * this.maskScale));
    this.mask.height = Math.max(1, Math.round(this.ch * this.maskScale));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.ppt = Math.min(this.cw, this.ch) / CFG.render.viewTiles;

    // Vignette never changes between resizes — build it once.
    const g = this.ctx.createRadialGradient(
      this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.32,
      this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.55)');
    this.vignette = g;
  }

  /* --------------------------------------------------------------- atlas */

  buildAtlas() {
    const S = CFG.render.tile * 2;
    const make = (fn) => {
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      fn(c.getContext('2d'), S);
      return c;
    };
    const a = { dirt: [], dirtCracked: [], rock: [], bedrock: [], gem: [] };

    for (let v = 0; v < 4; v++) {
      const rng = new RNG(1000 + v);
      a.dirt.push(make((c, s) => this.paintDirt(c, s, rng.next())));
      a.dirtCracked.push(make((c, s) => { this.paintDirt(c, s, 1000 + v); this.paintCracks(c, s, 2000 + v); }));
      a.rock.push(make((c, s) => this.paintRock(c, s, 3000 + v)));
      a.bedrock.push(make((c, s) => this.paintBedrock(c, s, 4000 + v)));
    }
    for (let t = 0; t < CFG.gems.types.length; t++) {
      a.gem.push(make((c, s) => { this.paintDirt(c, s, 5000 + t); this.paintGemInTile(c, s, t); }));
    }
    this.atlas = a;
  }

  paintDirt(c, s, seed) {
    const rng = new RNG(seed);
    c.fillStyle = '#7a5735';
    c.fillRect(0, 0, s, s);
    // Clumped clay, then a few pebbles. Enough texture to read as soft ground.
    for (let i = 0; i < 26; i++) {
      const x = rng.float() * s, y = rng.float() * s, r = rng.range(s * 0.05, s * 0.17);
      c.fillStyle = rng.chance(0.5) ? 'rgba(140,101,63,.55)' : 'rgba(92,66,40,.55)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = rng.float() * s, y = rng.float() * s, r = rng.range(s * 0.03, s * 0.06);
      c.fillStyle = 'rgba(58,42,26,.8)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = 'rgba(178,140,96,.45)';
      c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,.22)';
    c.lineWidth = Math.max(1, s * 0.04);
    c.strokeRect(0, 0, s, s);
  }

  paintCracks(c, s, seed) {
    const rng = new RNG(seed);
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(20,12,6,.92)';
    c.lineWidth = Math.max(1.4, s * 0.055);
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      let x = rng.range(s * 0.2, s * 0.8), y = rng.range(s * 0.15, s * 0.85);
      c.beginPath(); c.moveTo(x, y);
      for (let i = 0; i < 3; i++) {
        x += rng.range(-s * 0.3, s * 0.3);
        y += rng.range(-s * 0.3, s * 0.3);
        c.lineTo(clamp(x, 2, s - 2), clamp(y, 2, s - 2));
      }
      c.stroke();
    }
    c.strokeStyle = 'rgba(200,160,110,.28)';
    c.lineWidth = Math.max(1, s * 0.02);
    c.stroke();
  }

  paintRock(c, s, seed) {
    const rng = new RNG(seed);
    c.fillStyle = '#6b707c';
    c.fillRect(0, 0, s, s);
    // Faceted chunks read as "you cannot dig this".
    for (let i = 0; i < 7; i++) {
      const x = rng.float() * s, y = rng.float() * s, r = rng.range(s * 0.13, s * 0.3);
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + rng.float() * 0.4;
        const rr = r * rng.range(0.7, 1.15);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      c.fillStyle = rng.chance(0.5) ? 'rgba(133,140,153,.85)' : 'rgba(76,81,91,.85)';
      c.fill();
    }
    c.fillStyle = 'rgba(168,176,190,.35)';
    c.fillRect(0, 0, s, s * 0.09);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.fillRect(0, s * 0.9, s, s * 0.1);
    c.strokeStyle = 'rgba(0,0,0,.32)';
    c.lineWidth = Math.max(1, s * 0.045);
    c.strokeRect(0, 0, s, s);
  }

  paintBedrock(c, s, seed) {
    const rng = new RNG(seed);
    c.fillStyle = '#26262f';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(70,70,88,.5)';
    c.lineWidth = Math.max(1, s * 0.035);
    for (let i = -1; i < 5; i++) {
      c.beginPath();
      c.moveTo(i * s * 0.3, 0); c.lineTo(i * s * 0.3 + s * 0.4, s);
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(12,12,16,.7)';
      c.fillRect(rng.float() * s, rng.float() * s, rng.range(3, s * 0.2), rng.range(3, s * 0.12));
    }
  }

  paintGemInTile(c, s, type) {
    const g = CFG.gems.types[type];
    c.save();
    c.translate(s / 2, s / 2);
    // A socket of shadow so the crystal reads as embedded, not stuck on.
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath(); c.arc(0, s * 0.03, s * 0.3, 0, TAU); c.fill();
    this.gemPath(c, s * 0.3);
    c.fillStyle = g.color; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1, s * 0.025); c.stroke();
    // Facets.
    c.beginPath();
    c.moveTo(0, -s * 0.3); c.lineTo(-s * 0.19, -s * 0.05); c.lineTo(0, s * 0.3);
    c.closePath();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
    c.restore();
  }

  /** Shared crystal silhouette: cut top, tapered bottom. */
  gemPath(c, r) {
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r * 0.72, -r * 0.28);
    c.lineTo(0, r);
    c.lineTo(-r * 0.72, -r * 0.28);
    c.closePath();
  }

  /* ---------------------------------------------------------------- frame */

  draw(game) {
    const ctx = this.ctx, lctx = this.lctx;
    const cam = game.cam;
    const ppt = this.ppt;
    const cw = this.cw, ch = this.ch;
    const w = game.world;

    const ox = cw / 2 - cam.x * ppt + game.shakeX;
    const oy = ch / 2 - cam.y * ppt + game.shakeY;
    this.ox = ox; this.oy = oy;

    const x0 = Math.max(0, Math.floor(-ox / ppt) - 1);
    const x1 = Math.min(w.w - 1, Math.ceil((cw - ox) / ppt) + 1);
    const y0 = Math.max(0, Math.floor(-oy / ppt) - 1);
    const y1 = Math.min(w.h - 1, Math.ceil((ch - oy) / ppt) + 1);

    /* ---- background + sky ---- */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, cw, ch);
    this.drawSky(ctx, game, oy, ppt, cw, ch);

    /* ---- memory layer ---- */
    ctx.globalAlpha = CFG.render.memoryAlpha;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w.w + x;
        if (!w.explored[i]) continue;
        const col = MEM_COLOR[w.t[i]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(ox + x * ppt), Math.floor(oy + y * ppt), Math.ceil(ppt) + 1, Math.ceil(ppt) + 1);
      }
    }
    ctx.globalAlpha = 1;

    /* ---- lit layer ---- */
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, cw, ch);
    lctx.globalCompositeOperation = 'source-over';
    this.drawTerrain(lctx, game, x0, y0, x1, y1, ox, oy, ppt);
    this.drawActors(lctx, game, ox, oy, ppt);
    this.drawParticles(lctx, game, ox, oy, ppt);
    this.applyLightMask(lctx, game, ox, oy, ppt, cw, ch);
    ctx.drawImage(this.lit, 0, 0);

    /* ---- always-visible overlays ---- */
    this.drawLavaGlow(ctx, game, oy, ppt, cw, ch);
    this.drawFloatingText(ctx, game, ox, oy, ppt);
    this.drawFlights(ctx, game);
    this.drawVignette(ctx, game, cw, ch);
  }

  drawSky(ctx, game, oy, ppt, cw, ch) {
    const groundY = oy + game.world.surface * ppt;
    if (groundY <= 0) return;
    const g = ctx.createLinearGradient(0, Math.max(0, groundY - ppt * 14), 0, groundY);
    g.addColorStop(0, '#141033');
    g.addColorStop(0.6, '#241a44');
    g.addColorStop(1, '#3a2450');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, Math.min(ch, groundY));
    // A handful of deterministic stars — cheap, and it sells "you are outside".
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 40; i++) {
      const sx = hash2(i, 7, 99) * cw;
      const sy = hash2(i, 13, 99) * Math.min(ch, groundY) * 0.85;
      const tw = 0.5 + 0.5 * Math.sin(game.time * 2 + i);
      ctx.globalAlpha = 0.25 + tw * 0.45;
      ctx.fillRect(sx, sy, 2 * this.dpr, 2 * this.dpr);
    }
    ctx.globalAlpha = 1;
  }

  drawTerrain(c, game, x0, y0, x1, y1, ox, oy, ppt) {
    const w = game.world;
    const A = this.atlas;
    const S = Math.ceil(ppt) + 1;

    // Batched floor pass for open space — one fillStyle, many rects.
    c.fillStyle = '#1b1526';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (w.t[y * w.w + x] !== T.EMPTY) continue;
        c.fillRect(Math.floor(ox + x * ppt), Math.floor(oy + y * ppt), S, S);
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w.w + x;
        const t = w.t[i];
        if (t === T.EMPTY) continue;
        const px = Math.floor(ox + x * ppt), py = Math.floor(oy + y * ppt);
        const v = w.variant[i];

        switch (t) {
          case T.DIRT:
            c.drawImage(w.hp[i] < CFG.mining.dirtHits ? A.dirtCracked[v] : A.dirt[v], px, py, S, S);
            break;
          case T.ROCK:    c.drawImage(A.rock[v], px, py, S, S); break;
          case T.BEDROCK: c.drawImage(A.bedrock[v], px, py, S, S); break;
          case T.GEM:
            c.drawImage(A.gem[Math.max(0, w.gem[i] - 1)], px, py, S, S);
            this.sparkle(c, px + ppt / 2, py + ppt / 2, ppt, game.time + i * 0.37,
              CFG.gems.types[Math.max(0, w.gem[i] - 1)].glow);
            break;
          case T.LAVA:    this.drawLavaTile(c, px, py, S, game.time, x, y); break;
          case T.CHECKPOINT: this.drawCheckpoint(c, px, py, ppt, game.time); break;
          case T.HEART:   this.drawHeartstone(c, px + ppt / 2, py + ppt / 2, ppt, game.time); break;
        }

        // Lit rim on any solid tile with open air above, and a soft drop
        // shadow under an overhang. Together they give the tunnels depth.
        if (SOLID[t] && y > 0 && w.t[i - w.w] === T.EMPTY) {
          c.fillStyle = 'rgba(255,222,170,.16)';
          c.fillRect(px, py, S, Math.max(1, ppt * 0.11));
        }
        if (SOLID[t] && y < w.h - 1 && w.t[i + w.w] === T.EMPTY) {
          c.fillStyle = 'rgba(0,0,0,.35)';
          c.fillRect(px, py + ppt, S, Math.max(1, ppt * 0.18));
        }
      }
    }
  }

  drawLavaTile(c, px, py, S, time, x, y) {
    const k = 0.5 + 0.5 * Math.sin(time * 2.4 + x * 0.7 + y * 0.4);
    c.fillStyle = `rgb(${210 + k * 45}, ${60 + k * 70}, ${18})`;
    c.fillRect(px, py, S, S);
    c.fillStyle = `rgba(255, ${210 + k * 40}, 120, ${0.18 + k * 0.35})`;
    const bh = S * (0.16 + k * 0.16);
    c.fillRect(px, py + S * 0.3 + Math.sin(time * 3 + x) * S * 0.12, S, bh);
    c.fillStyle = 'rgba(90,20,6,.35)';
    c.fillRect(px, py + S * 0.78, S, S * 0.22);
  }

  drawCheckpoint(c, px, py, ppt, time) {
    const cx = px + ppt / 2, cy = py + ppt / 2;
    const pulse = 0.72 + 0.28 * Math.sin(time * 2.6);
    // Halo.
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, ppt * 1.5);
    g.addColorStop(0, `rgba(255,208,110,${0.45 * pulse})`);
    g.addColorStop(1, 'rgba(255,208,110,0)');
    c.fillStyle = g;
    c.fillRect(cx - ppt * 1.5, cy - ppt * 1.5, ppt * 3, ppt * 3);
    // Post + lantern.
    c.fillStyle = '#4b3a2a';
    c.fillRect(cx - ppt * 0.05, cy - ppt * 0.1, ppt * 0.1, ppt * 0.55);
    c.fillStyle = '#6b5340';
    c.fillRect(cx - ppt * 0.22, cy + ppt * 0.42, ppt * 0.44, ppt * 0.08);
    c.fillStyle = '#2c2118';
    c.fillRect(cx - ppt * 0.19, cy - ppt * 0.42, ppt * 0.38, ppt * 0.36);
    c.fillStyle = `rgba(255,214,120,${pulse})`;
    c.fillRect(cx - ppt * 0.13, cy - ppt * 0.36, ppt * 0.26, ppt * 0.24);
    c.fillStyle = `rgba(255,255,220,${pulse})`;
    c.fillRect(cx - ppt * 0.06, cy - ppt * 0.3, ppt * 0.12, ppt * 0.12);
  }

  drawHeartstone(c, cx, cy, ppt, time) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 3.4);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, ppt * 2.4);
    g.addColorStop(0, `rgba(255,90,40,${0.55 * pulse})`);
    g.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = g;
    c.fillRect(cx - ppt * 2.4, cy - ppt * 2.4, ppt * 4.8, ppt * 4.8);
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.sin(time * 0.8) * 0.12);
    const r = ppt * 0.42 * (0.94 + pulse * 0.1);
    this.gemPath(c, r);
    const gg = c.createLinearGradient(0, -r, 0, r);
    gg.addColorStop(0, '#ffd08a');
    gg.addColorStop(0.45, '#ff5a2a');
    gg.addColorStop(1, '#8e1208');
    c.fillStyle = gg; c.fill();
    c.strokeStyle = `rgba(255,230,180,${pulse})`;
    c.lineWidth = Math.max(1, ppt * 0.05); c.stroke();
    c.restore();
  }

  sparkle(c, cx, cy, ppt, t, color) {
    const k = Math.sin(t * 2.1);
    if (k < 0.72) return;
    const a = (k - 0.72) / 0.28;
    const r = ppt * 0.3 * a;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = color;
    c.lineWidth = Math.max(1, ppt * 0.045);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - r, cy); c.lineTo(cx + r, cy);
    c.moveTo(cx, cy - r); c.lineTo(cx, cy + r);
    c.stroke();
    c.restore();
  }

  /* --------------------------------------------------------------- actors */

  drawActors(c, game, ox, oy, ppt) {
    for (const b of game.blocks) {
      const px = ox + (b.x - 0.5) * ppt, py = oy + (b.y - 0.5) * ppt;
      c.save();
      c.globalAlpha = 0.95;
      c.drawImage(this.atlas.dirtCracked[0], px, py, ppt, ppt);
      c.restore();
    }
    for (const g of game.gems) this.drawGemPickup(c, g, ox, oy, ppt, game.time);
    for (const d of game.dynamites) this.drawDynamite(c, d, ox, oy, ppt, game.time);
    for (const e of game.enemies) {
      if (e instanceof Spider) this.drawSpider(c, e, ox, oy, ppt, game.time);
      else this.drawBat(c, e, ox, oy, ppt, game.time);
    }
    if (!game.player.dead || game.deathAnim < 0.6) this.drawPlayer(c, game, ox, oy, ppt);
  }

  drawGemPickup(c, g, ox, oy, ppt, time) {
    const cx = ox + g.x * ppt, cy = oy + g.y * ppt + Math.sin(time * 4 + g.age * 3) * ppt * 0.06;
    if (g.heart) { this.drawHeartstone(c, cx, cy, ppt * 0.9, time); return; }
    const t = CFG.gems.types[g.type];
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.sin(time * 2 + g.age) * 0.25);
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, ppt * 0.7);
    glow.addColorStop(0, t.glow + 'aa');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(-ppt * 0.7, -ppt * 0.7, ppt * 1.4, ppt * 1.4);
    this.gemPath(c, ppt * 0.24);
    c.fillStyle = t.color; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, ppt * 0.03); c.stroke();
    c.restore();
    this.sparkle(c, cx, cy, ppt, time * 1.7 + g.age * 4, t.glow);
  }

  drawDynamite(c, d, ox, oy, ppt, time) {
    const cx = ox + d.x * ppt, cy = oy + d.y * ppt;
    const blink = d.fuse < 0.55 && Math.sin(time * 34) > 0;
    c.save();
    c.translate(cx, cy);
    const squash = 1 + Math.max(0, (0.35 - d.fuse)) * 0.7;
    c.scale(squash, 1 / squash);
    c.fillStyle = blink ? '#ff9a86' : '#c94b3c';
    c.fillRect(-ppt * 0.16, -ppt * 0.2, ppt * 0.32, ppt * 0.44);
    c.fillStyle = '#f0e2c2';
    c.fillRect(-ppt * 0.16, -ppt * 0.06, ppt * 0.32, ppt * 0.09);
    c.strokeStyle = '#e0c88a';
    c.lineWidth = Math.max(1, ppt * 0.05);
    c.beginPath();
    c.moveTo(0, -ppt * 0.2);
    c.quadraticCurveTo(ppt * 0.14, -ppt * 0.34, ppt * 0.1, -ppt * 0.44);
    c.stroke();
    c.fillStyle = '#ffd66b';
    c.beginPath();
    c.arc(ppt * 0.1, -ppt * 0.46, ppt * (0.06 + Math.random() * 0.05), 0, TAU);
    c.fill();
    c.restore();
  }

  drawSpider(c, s, ox, oy, ppt, time) {
    const cx = ox + s.x * ppt, cy = oy + s.y * ppt;
    const wind = s.state === 'wind';
    const pounce = s.state === 'pounce';
    const r = ppt * 0.30 * (wind ? 1.14 : 1);

    c.save();
    c.translate(cx, cy);
    if (wind) c.translate(0, -ppt * 0.06 * Math.sin(time * 40));

    // Legs — eight of them, phase-offset so the gait reads at a glance.
    c.strokeStyle = s.hurtFlash > 0 ? '#ffdede' : '#2b1c2c';
    c.lineWidth = Math.max(1.2, ppt * 0.05);
    c.lineCap = 'round';
    const speed = Math.hypot(s.vx, s.vy);
    const swing = Math.sin(s.anim * (5 + speed * 2)) * (0.2 + Math.min(speed, 6) * 0.045);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const base = (-0.75 + k * 0.5) * side + (side < 0 ? Math.PI : 0);
      const a = base + swing * (k % 2 ? 1 : -1) + (pounce ? -0.3 : 0);
      const l1 = r * 1.05, l2 = r * 1.2;
      const kx = Math.cos(a) * l1, ky = Math.sin(a) * l1 * 0.7;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(kx, ky - r * 0.3);
      c.lineTo(kx + Math.cos(a) * l2 * 0.6, ky + r * 0.5);
      c.stroke();
    }

    // Body.
    c.fillStyle = s.hurtFlash > 0 ? '#ffffff' : (wind ? '#7a2c50' : '#50294a');
    c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.88, 0, 0, TAU); c.fill();
    c.fillStyle = s.hurtFlash > 0 ? '#ffffff' : '#64365c';
    c.beginPath(); c.ellipse(s.face * r * 0.85, -r * 0.1, r * 0.5, r * 0.44, 0, 0, TAU); c.fill();

    // Eyes: brighten during the wind-up so the tell is unmissable.
    const eye = wind ? '#ff3b3b' : '#ff8a5c';
    c.fillStyle = eye;
    c.shadowColor = eye;
    c.shadowBlur = ppt * (wind ? 0.5 : 0.22);
    for (let i = -1; i <= 1; i += 2) {
      c.beginPath();
      c.arc(s.face * r * 1.05, -r * 0.24 + i * r * 0.16, r * 0.11, 0, TAU);
      c.fill();
    }
    c.shadowBlur = 0;
    c.restore();

    if (wind) {
      // Aim line: the player can see exactly where the pounce is going.
      c.save();
      c.globalAlpha = 0.35 + 0.25 * Math.sin(time * 24);
      c.strokeStyle = '#ff5d5d';
      c.lineWidth = Math.max(1, ppt * 0.05);
      c.setLineDash([ppt * 0.14, ppt * 0.12]);
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + s.aim.x * ppt * 2.4, cy + s.aim.y * ppt * 2.4);
      c.stroke();
      c.restore();
    }
  }

  drawBat(c, b, ox, oy, ppt, time) {
    const cx = ox + b.x * ppt, cy = oy + b.y * ppt;
    const flap = Math.sin(b.anim * 17);
    const r = ppt * 0.26;
    c.save();
    c.translate(cx, cy);
    c.scale(b.face, 1);

    c.fillStyle = b.hurtFlash > 0 ? '#ffffff' : '#4a3a5e';
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.beginPath();
      c.moveTo(0, -r * 0.1);
      c.quadraticCurveTo(r * 1.5, -r * (0.9 + flap * 0.7), r * 1.85, r * (0.1 + flap * 0.5));
      c.quadraticCurveTo(r * 1.1, r * 0.1, r * 0.75, r * 0.45);
      c.quadraticCurveTo(r * 0.4, r * 0.05, 0, r * 0.35);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.fillStyle = b.hurtFlash > 0 ? '#ffffff' : '#332845';
    c.beginPath(); c.ellipse(0, 0, r * 0.5, r * 0.62, 0, 0, TAU); c.fill();
    // Ears.
    c.beginPath();
    c.moveTo(-r * 0.28, -r * 0.45); c.lineTo(-r * 0.12, -r * 0.95); c.lineTo(0, -r * 0.42);
    c.moveTo(r * 0.28, -r * 0.45); c.lineTo(r * 0.12, -r * 0.95); c.lineTo(0, -r * 0.42);
    c.fill();
    c.fillStyle = '#ffd66b';
    c.beginPath(); c.arc(-r * 0.18, -r * 0.12, r * 0.09, 0, TAU); c.fill();
    c.beginPath(); c.arc(r * 0.18, -r * 0.12, r * 0.09, 0, TAU); c.fill();
    c.restore();

    // The loot it took, dangling in plain sight.
    if (b.stolen) {
      const gy = cy + r * 1.5 + Math.sin(time * 6) * ppt * 0.05;
      const t = CFG.gems.types[b.stolen.type];
      c.save();
      c.translate(cx, gy);
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, ppt * 0.6);
      glow.addColorStop(0, t.glow + 'cc');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = glow;
      c.fillRect(-ppt * 0.6, -ppt * 0.6, ppt * 1.2, ppt * 1.2);
      this.gemPath(c, ppt * 0.2);
      c.fillStyle = t.color; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, ppt * 0.028); c.stroke();
      c.restore();
    }
  }

  drawPlayer(c, game, ox, oy, ppt) {
    const p = game.player;
    const cx = ox + p.x * ppt, cy = oy + p.y * ppt;
    const r = ppt * 0.34;
    const blink = p.invuln > 0 && Math.sin(game.time * 40) > 0;

    c.save();
    c.translate(cx, cy);
    if (p.dead) c.rotate(clamp(game.deathAnim * 3, 0, 1) * 1.4);
    c.globalAlpha = blink ? 0.42 : 1;

    const air = !p.grounded && !p.dead;
    const rising = air && p.vy < 0;
    const step = (p.moving && !air) ? Math.sin(p.walk) : 0;
    const bob = (p.moving && !air) ? Math.abs(Math.sin(p.walk)) * ppt * 0.045 : 0;
    c.translate(0, -bob);
    // Stretch on the way up, squash on the way down: the whole read of "I am
    // airborne" in one transform.
    if (air) {
      const k = clamp(p.vy / CFG.player.maxFall, -0.6, 0.6);
      c.scale(1 - k * 0.12, 1 + k * 0.12);
    }

    // Legs — tucked while airborne, striding on the ground.
    c.strokeStyle = '#2f3550';
    c.lineWidth = Math.max(1.6, ppt * 0.09);
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * r * 0.28, r * 0.35);
      if (air) {
        const tuck = rising ? 0.62 : 0.86;
        c.lineTo(side * r * (0.28 + 0.3), r * tuck);
      } else {
        c.lineTo(side * r * 0.28 + step * side * r * 0.42, r * 0.92);
      }
      c.stroke();
    }
    // Torso.
    c.fillStyle = '#3d6fb4';
    c.beginPath();
    c.roundRect(-r * 0.52, -r * 0.25, r * 1.04, r * 0.78, r * 0.24);
    c.fill();
    c.fillStyle = '#2c5390';
    c.fillRect(-r * 0.52, r * 0.22, r * 1.04, r * 0.16);
    // Head + helmet. An intact hard hat rides higher and is trimmed white, so
    // "I still have a dent to spend" is visible without checking the HUD.
    const hatted = p.hat > 0;
    c.fillStyle = '#e8c9a4';
    c.beginPath(); c.arc(0, -r * 0.5, r * 0.36, 0, TAU); c.fill();
    c.fillStyle = hatted ? '#ffcf5c' : '#e8a63c';
    c.beginPath();
    c.arc(0, -r * 0.56, r * (hatted ? 0.48 : 0.44), Math.PI, TAU);
    c.closePath(); c.fill();
    c.fillRect(-r * 0.5 + p.facing.x * r * 0.16, -r * 0.62, r, r * 0.14);
    if (hatted) {
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.fillRect(-r * 0.06, -r * 1.02, r * 0.12, r * 0.42);
    }

    // Headlamp — the light itself is drawn in the mask pass.
    const lampX = p.facing.x * r * 0.42, lampY = -r * 0.62;
    c.fillStyle = `rgba(255,240,190,${0.75 + p.lampFlicker * 0.25})`;
    c.beginPath(); c.arc(lampX, lampY, r * 0.16, 0, TAU); c.fill();

    // Pickaxe / dynamite in hand, arcing through the swing.
    const sw = p.swingAnim;
    const ang = Math.atan2(p.facing.y, p.facing.x) - 0.9 + sw * 1.9;
    c.save();
    c.rotate(ang);
    if (p.tool === 0) {
      c.strokeStyle = '#c8a06a';
      c.lineWidth = Math.max(1.6, ppt * 0.075);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.15, 0); c.stroke();
      c.strokeStyle = '#cfd6df';
      c.lineWidth = Math.max(1.6, ppt * 0.085);
      c.beginPath();
      c.arc(r * 1.15, 0, r * 0.42, -1.25, 1.25);
      c.stroke();
    } else {
      c.fillStyle = '#c94b3c';
      c.fillRect(r * 0.7, -r * 0.16, r * 0.6, r * 0.32);
      c.fillStyle = '#f0e2c2';
      c.fillRect(r * 0.7, -r * 0.05, r * 0.6, r * 0.1);
    }
    c.restore();
    c.restore();

    // Mining reticle on the target tile.
    if (!p.dead) {
      const t = p.targetTile();
      const solid = SOLID[game.world.get(t.x, t.y)];
      const px = ox + t.x * ppt, py = oy + t.y * ppt;
      c.save();
      c.globalAlpha = 0.28 + sw * 0.5;
      c.strokeStyle = p.tool === 1 ? '#ff8a5c' : (solid ? '#ffe6a8' : '#8fa4c8');
      c.lineWidth = Math.max(1, ppt * 0.05);
      const m = ppt * 0.16;
      c.beginPath();
      for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const bx = px + sx * ppt, by = py + sy * ppt;
        c.moveTo(bx + (sx ? -m : m), by);
        c.lineTo(bx, by);
        c.lineTo(bx, by + (sy ? -m : m));
      }
      c.stroke();
      c.restore();
    }
  }

  drawParticles(c, game, ox, oy, ppt) {
    for (const p of game.fx.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a;
      c.fillStyle = p.color;
      if (p.glow) { c.shadowColor = p.color; c.shadowBlur = ppt * 0.4; }
      const s = p.size * ppt * (0.4 + a * 0.6);
      c.fillRect(ox + p.x * ppt - s / 2, oy + p.y * ppt - s / 2, s, s);
      if (p.glow) c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
    for (const r of game.fx.rings) {
      const k = 1 - r.life / r.max;
      c.globalAlpha = (1 - k) * 0.8;
      c.strokeStyle = r.color;
      c.lineWidth = Math.max(1, ppt * 0.12 * (1 - k));
      c.beginPath();
      c.arc(ox + r.x * ppt, oy + r.y * ppt, (r.r0 + (r.r - r.r0) * k) * ppt, 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- masking */

  /**
   * Build the union of every light into its own buffer first, then apply that
   * once. Compositing lights straight onto the lit layer with `destination-in`
   * would intersect them instead of adding them — i.e. near-total darkness.
   */
  applyLightMask(c, game, ox, oy, ppt, cw, ch) {
    const m = this.mctx, s = this.maskScale;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, this.mask.width, this.mask.height);
    m.globalCompositeOperation = 'lighter';

    for (const L of game.lights) {
      const x = (ox + L.x * ppt) * s, y = (oy + L.y * ppt) * s, r = L.r * ppt * s;
      if (r <= 0 || x + r < 0 || x - r > this.mask.width || y + r < 0 || y - r > this.mask.height) continue;
      const a = L.a === undefined ? 1 : L.a;
      const g = m.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.55, `rgba(255,255,255,${a * 0.88})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = g;
      m.beginPath(); m.arc(x, y, r, 0, TAU); m.fill();
    }
    m.globalCompositeOperation = 'source-over';

    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.mask, 0, 0, cw, ch);
    c.globalCompositeOperation = 'source-over';
  }

  /** Hot bloom from the lava, drawn above the mask so it warns from far off. */
  drawLavaGlow(ctx, game, oy, ppt, cw, ch) {
    if (!game.volcano) return;
    const ly = oy + game.world.lavaRow * ppt;
    if (ly > ch + ppt * 4) return;
    const g = ctx.createLinearGradient(0, Math.max(-ppt * 8, ly - ppt * 7), 0, ly);
    g.addColorStop(0, 'rgba(255,80,20,0)');
    g.addColorStop(1, 'rgba(255,110,30,.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, ly - ppt * 7), cw, Math.min(ch, ppt * 7));
    if (ly < ch) { ctx.fillStyle = 'rgba(255,120,40,.35)'; ctx.fillRect(0, ly, cw, ch - ly); }
  }

  drawFloatingText(ctx, game, ox, oy, ppt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of game.fx.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${t.size * this.dpr}px ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = 4 * this.dpr;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const x = ox + t.x * ppt, y = oy + t.y * ppt;
      ctx.strokeText(t.str, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawFlights(ctx, game) {
    const d = this.dpr;
    for (const f of game.fx.flights) {
      const k = f.t / f.dur;
      const r = (9 - k * 3) * d;
      ctx.save();
      ctx.translate(f.x * d, f.y * d);
      ctx.globalAlpha = 1 - k * 0.25;
      ctx.shadowColor = f.color; ctx.shadowBlur = 14 * d;
      this.gemPath(ctx, r);
      ctx.fillStyle = f.color; ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawVignette(ctx, game, cw, ch) {
    if (game.volcano) {
      const a = 0.10 + 0.06 * Math.sin(game.time * 3);
      ctx.fillStyle = `rgba(180,30,10,${a})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, cw, ch);
  }
}

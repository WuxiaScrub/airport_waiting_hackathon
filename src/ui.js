/* ============================================================================
 * UI — HUD syncing and the modal panels (title, shop, summary, death, win).
 * The canvas never draws text-heavy UI; the DOM is sharper and cheaper.
 * ========================================================================== */

class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hearts: document.getElementById('hearts'),
      depth: document.getElementById('depth'),
      banked: document.getElementById('banked'),
      unbanked: document.getElementById('unbanked'),
      dynCount: document.getElementById('dynCount'),
      tools: Array.from(document.querySelectorAll('.tool')),
      actionLabel: document.getElementById('actionLabel'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('banner'),
      hurt: document.getElementById('hurt'),
      panel: document.getElementById('panel'),
      panelInner: document.getElementById('panelInner'),
    };
    this._heartCount = -1;
    this._toastTimer = 0;
  }

  /* --------------------------------------------------------------- syncing */

  syncHealth(p) {
    const el = this.el.hearts;
    if (this._heartCount !== p.maxHealth) {
      el.innerHTML = '';
      for (let i = 0; i < p.maxHealth; i++) {
        const d = document.createElement('div');
        d.className = 'heart';
        el.appendChild(d);
      }
      this._heartCount = p.maxHealth;
    }
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('empty', i >= p.health);
  }

  syncWallet(game) {
    this.setVal(this.el.banked, game.save.gold);
    this.setVal(this.el.unbanked, game.carryValue());
  }

  setVal(el, v) {
    const s = fmt(v);
    if (el.textContent === s) return;
    el.textContent = s;
    el.classList.remove('bump');
    void el.offsetWidth;      // restart the CSS animation
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 110);
  }

  syncTools(p) {
    this.el.dynCount.textContent = p.dynamite;
    this.el.tools[1].classList.toggle('depleted', p.dynamite <= 0);
    this.el.tools.forEach((b, i) => b.classList.toggle('active', i === p.tool));
    this.el.actionLabel.textContent = p.tool === 0 ? 'MINE' : 'PLACE';
  }

  syncDepth(depth, world, player) {
    let label;
    if (depth <= 0) label = 'SURFACE CAMP';
    else label = depth + ' m DEEP';
    if (this.game.volcano) {
      const gap = Math.max(0, Math.round(world.lavaRow - player.y));
      label += `  ·  LAVA ${gap} m BELOW`;
    }
    if (this.el.depth.textContent !== label) this.el.depth.textContent = label;
  }

  /* -------------------------------------------------------------- feedback */

  toast(msg, ms) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms || 1400);
  }

  banner(title, sub) {
    const b = this.el.banner;
    b.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  flashHurt() {
    const h = this.el.hurt;
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 90);
  }

  flashLoss() {
    const el = this.el.unbanked;
    el.classList.add('lose');
    setTimeout(() => el.classList.remove('lose'), 320);
  }

  /** Screen position of the carry counter — gem flights home in on this. */
  carryAnchor() {
    const r = this.el.unbanked.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ---------------------------------------------------------------- panels */

  show(html) {
    this.el.panelInner.innerHTML = html;
    this.el.panel.classList.remove('hidden');
    this.el.panel.scrollTop = 0;
  }

  hide() { this.el.panel.classList.add('hidden'); }
  get isOpen() { return !this.el.panel.classList.contains('hidden'); }

  on(sel, fn) {
    const el = this.el.panelInner.querySelector(sel);
    if (el) el.addEventListener('click', (e) => { Sfx.init(); Sfx.play('ui'); fn(e); });
  }
  onAll(sel, fn) {
    this.el.panelInner.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', (e) => { Sfx.init(); fn(el, e); }));
  }

  title(save) {
    const best = save.best || 0;
    this.show(`
      <div class="logo">DEEPCUT</div>
      <div class="tagline">DIG · BANK · SURVIVE</div>
      <div class="stats">
        <div class="stat"><div class="k">VAULT</div><div class="v gold">${fmt(save.gold || 0)}</div></div>
        <div class="stat"><div class="k">DEEPEST</div><div class="v">${best} m</div></div>
      </div>
      <div class="help">
        <div class="row"><span>MOVE</span><span>Drag anywhere on the left half. <b>WASD</b> on desktop.</span></div>
        <div class="row"><span>MINE</span><span>Hold the big button. Soft dirt takes two hits — and cracked dirt <b>falls</b>.</span></div>
        <div class="row"><span>TOOLS</span><span>Tap ⛏ / 🧨 to swap. Dynamite clears a 3×3 and blasts rock.</span></div>
        <div class="row"><span>BANK IT</span><span>Loot you carry is <b>lost if you die</b>. Lanterns bank it and restock you.</span></div>
        <div class="row"><span>DARK</span><span>Your lamp is all you have. Something down there wants your gems.</span></div>
      </div>
      <button class="btn" id="startBtn">START DIGGING</button>
      ${save.gold ? '<button class="btn ghost" id="wipeBtn">ERASE SAVE</button>' : ''}
    `);
    this.on('#startBtn', () => this.game.startRun());
    this.on('#wipeBtn', () => this.game.wipeSave());
  }

  shop(game, opts) {
    const o = opts || {};
    const items = CFG.upgrades.map(u => {
      const lvl = game.save.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = game.upgradeCost(u, lvl);
      const afford = game.save.gold >= cost;
      const pips = Array.from({ length: u.max }, (_, i) =>
        `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('');
      return `
        <div class="shop-item">
          <div class="info">
            <div class="nm">${u.name}</div>
            <div class="ds">${u.desc}</div>
            <div class="pips">${pips}</div>
          </div>
          <button class="buy ${maxed ? 'max' : ''}" data-up="${u.id}"
            ${maxed || !afford ? 'disabled' : ''}>${maxed ? 'MAX' : fmt(cost)}</button>
        </div>`;
    }).join('');

    this.show(`
      <h2>${o.title || 'SUPPLY LANTERN'}</h2>
      <div class="sub">${o.sub || 'WEALTH SECURED'}</div>
      <div class="stats">
        <div class="stat"><div class="k">VAULT</div><div class="v gold">${fmt(game.save.gold)}</div></div>
        <div class="stat"><div class="k">DEPTH</div><div class="v">${game.depth()} m</div></div>
      </div>
      <div class="shop-list">${items}</div>
      <button class="btn" id="closeShop">${o.closeLabel || 'BACK TO THE MINE'}</button>
      ${o.extra || ''}
    `);
    this.onAll('[data-up]', (el) => game.buyUpgrade(el.dataset.up));
    this.on('#closeShop', () => game.closePanel());
    if (o.wire) o.wire(this);
  }

  summary(game, kind) {
    const s = game.runStats;
    const isWin = kind === 'win';
    const isDeath = kind === 'death';
    const title = isWin ? 'ESCAPED' : isDeath ? 'YOU DIED' : 'RUN COMPLETE';
    const sub = isWin ? 'THE HEARTSTONE IS YOURS'
      : isDeath ? `${fmt(s.lost)} IN UNBANKED LOOT LOST`
      : 'HAULED OUT SAFE';
    this.show(`
      <h2>${title}</h2>
      <div class="sub">${sub}</div>
      <div class="stats">
        <div class="stat"><div class="k">BANKED THIS RUN</div><div class="v gold">${fmt(s.banked)}</div></div>
        <div class="stat"><div class="k">DEEPEST</div><div class="v">${s.depth} m</div></div>
        <div class="stat"><div class="k">GEMS</div><div class="v carry">${s.gems}</div></div>
        <div class="stat"><div class="k">VAULT</div><div class="v gold">${fmt(game.save.gold)}</div></div>
      </div>
      <button class="btn" id="shopBtn">SPEND AT CAMP</button>
      <button class="btn ghost" id="againBtn">NEW MINE</button>
    `);
    this.on('#shopBtn', () => this.shop(game, {
      title: 'CAMP OUTFITTER',
      sub: 'GEAR UP FOR THE NEXT DESCENT',
      closeLabel: 'NEW MINE',
      wire: (ui) => ui.on('#closeShop', () => game.startRun()),
    }));
    this.on('#againBtn', () => game.startRun());
  }

  pause(game) {
    this.show(`
      <h2>PAUSED</h2>
      <div class="sub">${game.depth()} m DEEP · ${fmt(game.carryValue())} CARRIED</div>
      <button class="btn" id="resumeBtn">RESUME</button>
      <button class="btn ghost" id="audioBtn">SOUND: ${Sfx.enabled ? 'ON' : 'OFF'}</button>
      <button class="btn ghost" id="abandonBtn">ABANDON RUN (LOSE CARRIED LOOT)</button>
    `);
    this.on('#resumeBtn', () => game.closePanel());
    this.on('#audioBtn', () => { game.toggleAudio(); this.pause(game); });
    this.on('#abandonBtn', () => game.endRun('abandon'));
  }
}

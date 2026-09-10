/* ============================================================================
 * UI — HUD syncing and the modal panels (title, shop, summary, death, win).
 * The canvas never draws text-heavy UI; the DOM is sharper and cheaper.
 *
 * Every string here goes through loc() — see src/i18n.js.
 * ========================================================================== */

class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hearts: document.getElementById('hearts'),
      helmet: document.getElementById('helmet'),
      depth: document.getElementById('depth'),
      banked: document.getElementById('banked'),
      unbanked: document.getElementById('unbanked'),
      dynCount: document.getElementById('dynCount'),
      dynBtn: document.getElementById('dynamite'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('banner'),
      hurt: document.getElementById('hurt'),
      panel: document.getElementById('panel'),
      panelInner: document.getElementById('panelInner'),
    };
    this._heartCount = -1;
    this._hatCount = -1;
    this._toastTimer = 0;
    this._repaint = null;      // redraws the open panel after a language change

    I18N.onChange(() => this.onLanguageChange());
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

  /** Hard-hat dents. The row only exists once the player owns a hat. */
  syncHat(p) {
    const el = this.el.helmet;
    el.classList.toggle('hidden', p.hatMax <= 0);
    if (this._hatCount !== p.hatMax) {
      el.innerHTML = '';
      for (let i = 0; i < p.hatMax; i++) {
        const d = document.createElement('div');
        d.className = 'hardhat';
        el.appendChild(d);
      }
      this._hatCount = p.hatMax;
    }
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('empty', i >= p.hat);
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

  syncDynamite(p) {
    this.el.dynCount.textContent = p.dynamite;
    this.el.dynBtn.classList.toggle('depleted', p.dynamite <= 0);
  }

  syncDepth(depth, world, player) {
    let label = depth <= 0 ? loc('hud.surfaceCamp') : loc('hud.deep', { d: depth });
    if (this.game.volcano) {
      const gap = Math.max(0, Math.round(world.lavaRow - player.y));
      label += '  ·  ' + loc('hud.lavaBelow', { d: gap });
    }
    if (this.el.depth.textContent !== label) this.el.depth.textContent = label;
  }

  /**
   * Redraw the open panel from scratch. Every panel registers how to rebuild
   * itself, so callers never have to sniff the DOM to work out which one it is.
   */
  repaint() { if (this.isOpen && this._repaint) this._repaint(); }

  /** Re-render everything language-dependent that is on screen right now. */
  onLanguageChange() {
    const g = this.game;
    if (g.player && g.world) this.syncDepth(g.depth(), g.world, g.player);
    this.repaint();
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

  hide() { this.el.panel.classList.add('hidden'); this._repaint = null; }
  get isOpen() { return !this.el.panel.classList.contains('hidden'); }

  on(sel, fn) {
    const el = this.el.panelInner.querySelector(sel);
    if (el) el.addEventListener('click', (e) => { Sfx.init(); Sfx.play('ui'); fn(e); });
  }
  onAll(sel, fn) {
    this.el.panelInner.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', (e) => { Sfx.init(); fn(el, e); }));
  }

  /** The language button every panel carries, plus its handler. */
  langButton() { return `<button class="btn ghost" id="langBtn">${loc('lang.switch')}</button>`; }
  wireLang() { this.on('#langBtn', () => I18N.cycle()); }

  title(save) {
    const best = save.best || 0;
    const rows = ['move', 'mine', 'jump', 'grip', 'boom', 'bank', 'dark'].map(k =>
      `<div class="row"><span>${loc('help.' + k + '.k')}</span><span>${loc('help.' + k + '.v')}</span></div>`).join('');

    this._repaint = () => this.title(save);
    this.show(`
      <div class="logo">DEEPCUT</div>
      <div class="tagline">${loc('title.tagline')}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('title.vault')}</div><div class="v gold">${fmt(save.gold || 0)}</div></div>
        <div class="stat"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: best })}</div></div>
      </div>
      <div class="help">${rows}</div>
      <button class="btn" id="startBtn">${loc('title.start')}</button>
      ${this.langButton()}
      ${save.gold ? `<button class="btn ghost" id="wipeBtn">${loc('title.wipe')}</button>` : ''}
    `);
    this.on('#startBtn', () => this.game.startRun());
    this.on('#wipeBtn', () => this.game.wipeSave());
    this.wireLang();
  }

  /**
   * `opts.title` / `.sub` / `.closeLabel` / `.extra` may be plain strings or
   * thunks. Pass a thunk for anything localized: the panel re-runs it when the
   * language changes, so labels fixed at open time still follow the switch.
   */
  shop(game, opts) {
    const o = opts || {};
    const res = (v, key) => (typeof v === 'function' ? v() : v !== undefined ? v : loc(key));

    const p = game.player;
    const inRun = game.state === 'paused' && p && !p.dead;

    // Consumables. Dynamite is stock the lantern sells — walking in no longer
    // refills the satchel, so this row is the only way to top it back up.
    const missing = inRun ? p.dynMax - p.dynamite : 0;
    const one = CFG.restock.dynamiteCost;
    const fill = missing * one;
    const dynSection = inRun ? `
      <div class="shop-item">
        <div class="info">
          <div class="nm">${loc('supply.dynamite.name')}</div>
          <div class="ds">${loc('supply.dynamite.desc', { cur: p.dynamite, max: p.dynMax })}</div>
        </div>
        <div class="buys">
          <button class="buy" data-dyn="one"
            ${missing <= 0 || game.save.gold < one ? 'disabled' : ''}>${loc('supply.buyOne', { v: fmt(one) })}</button>
          ${missing > 1 ? `<button class="buy" data-dyn="all"
            ${game.save.gold < fill ? 'disabled' : ''}>${loc('supply.buyFill', { v: fmt(fill) })}</button>` : ''}
        </div>
      </div>` : '';

    const healSection = inRun ? CFG.healItems.map(h => {
      const atMax = p.health >= p.maxHealth;
      const afford = game.save.gold >= h.cost;
      return `
        <div class="shop-item">
          <div class="info">
            <div class="nm">${loc('heal.' + h.id + '.name')}</div>
            <div class="ds">${loc('heal.' + h.id + '.desc', { cur: p.health, max: p.maxHealth })}</div>
          </div>
          <button class="buy" data-heal="${h.id}"
            ${atMax || !afford ? 'disabled' : ''}>${fmt(h.cost)}</button>
        </div>`;
    }).join('') : '';

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
            <div class="nm">${loc('up.' + u.id + '.name')}</div>
            <div class="ds">${loc('up.' + u.id + '.desc')}</div>
            <div class="pips">${pips}</div>
          </div>
          <button class="buy ${maxed ? 'max' : ''}" data-up="${u.id}"
            ${maxed || !afford ? 'disabled' : ''}>${maxed ? loc('shop.max') : fmt(cost)}</button>
        </div>`;
    }).join('');

    this._repaint = () => this.shop(game, o);
    this.show(`
      <h2>${res(o.title, 'shop.supplyLantern')}</h2>
      <div class="sub">${res(o.sub, 'shop.wealthSecured')}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('title.vault')}</div><div class="v gold">${fmt(game.save.gold)}</div></div>
        <div class="stat"><div class="k">${loc('shop.depth')}</div><div class="v">${loc('common.metres', { n: game.depth() })}</div></div>
      </div>
      <div class="shop-list">${dynSection}${healSection}${items}</div>
      <button class="btn" id="closeShop">${res(o.closeLabel, 'shop.back')}</button>
      ${o.extra ? res(o.extra) : ''}
      ${this.langButton()}
    `);
    this.onAll('[data-dyn]', (el) => game.buyDynamite(el.dataset.dyn === 'all'));
    this.onAll('[data-heal]', (el) => game.buyHeal(el.dataset.heal));
    this.onAll('[data-up]', (el) => game.buyUpgrade(el.dataset.up));
    this.on('#closeShop', () => game.closePanel());
    if (o.wire) o.wire(this);
    this.wireLang();
  }

  summary(game, kind) {
    const s = game.runStats;
    const isWin = kind === 'win';
    const isDeath = kind === 'death';
    const title = isWin ? loc('sum.escaped') : isDeath ? loc('sum.died') : loc('sum.complete');
    const sub = isWin ? loc('sum.heartstoneYours')
      : isDeath ? loc('sum.lootLost', { v: fmt(s.lost) })
      : loc('sum.hauledOut');

    this._repaint = () => this.summary(game, kind);
    this.show(`
      <h2>${title}</h2>
      <div class="sub">${sub}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('sum.bankedThisRun')}</div><div class="v gold">${fmt(s.banked)}</div></div>
        <div class="stat"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: s.depth })}</div></div>
        <div class="stat"><div class="k">${loc('sum.gems')}</div><div class="v carry">${s.gems}</div></div>
        <div class="stat"><div class="k">${loc('title.vault')}</div><div class="v gold">${fmt(game.save.gold)}</div></div>
      </div>
      <button class="btn" id="shopBtn">${loc('sum.spend')}</button>
      <button class="btn ghost" id="againBtn">${loc('shop.newMine')}</button>
      ${this.langButton()}
    `);
    this.on('#shopBtn', () => this.shop(game, {
      title: loc('shop.campOutfitter'),
      sub: loc('shop.gearUp'),
      closeLabel: loc('shop.newMine'),
      wire: (ui) => ui.on('#closeShop', () => game.startRun()),
    }));
    this.on('#againBtn', () => game.startRun());
    this.wireLang();
  }

  pause(game) {
    this._repaint = () => this.pause(game);
    this.show(`
      <h2>${loc('pause.title')}</h2>
      <div class="sub">${loc('pause.sub', { d: game.depth(), v: fmt(game.carryValue()) })}</div>
      <button class="btn" id="resumeBtn">${loc('pause.resume')}</button>
      <button class="btn ghost" id="audioBtn">${loc('pause.sound', { s: loc(Sfx.enabled ? 'common.on' : 'common.off') })}</button>
      ${this.langButton()}
      <button class="btn ghost" id="abandonBtn">${loc('pause.abandon')}</button>
    `);
    this.on('#resumeBtn', () => game.closePanel());
    this.on('#audioBtn', () => { game.toggleAudio(); this.pause(game); });
    this.on('#abandonBtn', () => game.endRun('abandon'));
    this.wireLang();
  }
}

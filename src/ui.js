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
      timer: document.getElementById('timer'),
      score: document.getElementById('score'),
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

  /** SCORE is what the campaign already carried out; CARRYING is at risk. */
  syncWallet(game) {
    this.setVal(this.el.score, game.campaign.score);
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
    const mine = this.game.campaign.mine;
    if (mine > 1) label = loc('hud.mineN', { n: mine }) + '  ·  ' + label;
    if (this.game.volcano) {
      const gap = Math.max(0, Math.round(world.lavaRow - player.y));
      label += '  ·  ' + loc('hud.lavaBelow', { d: gap });
    }
    if (this.el.depth.textContent !== label) this.el.depth.textContent = label;
  }

  /**
   * The eruption clock. It is only on screen while there is still time on it —
   * once the mountain is awake the depth line takes over with the lava gap,
   * which is the number that matters from then on.
   */
  syncTimer(game) {
    const el = this.el.timer;
    const live = (game.state === 'play' || game.state === 'paused') && !game.volcano;
    el.classList.toggle('hidden', !live);
    if (!live) return;

    const left = game.fuseLeft();
    const label = loc('hud.eruption', { t: fmtTime(left) });
    if (el.textContent !== label) el.textContent = label;

    // Amber at the second-to-last warning, red at the last one, so the colour
    // follows the toasts instead of a second set of magic numbers.
    const w = CFG.lava.warnAt;
    el.classList.toggle('soon', left <= w[Math.max(0, w.length - 2)]);
    el.classList.toggle('warn', left <= w[w.length - 1]);
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

  /**
   * The personal haul board. `highlightId` marks the row a run just set.
   *
   * A global board slots in here unchanged: register a backend with
   * Highscore.useBackend() and render Highscore.globalTop() into a second list
   * beside this one — see src/highscore.js.
   */
  scoreBoard(highlightId) {
    const list = Highscore.list();
    const body = list.length
      ? list.map((e, i) => `
          <div class="score-row${e.id && e.id === highlightId ? ' you' : ''}">
            <span class="rk">${i + 1}</span>
            <span class="vv">${fmt(e.value)}</span>
            <span class="dd">${loc('score.mineDepth', { n: e.mine, d: e.depth })}</span>
          </div>`).join('')
      : `<div class="score-empty">${loc('score.empty')}</div>`;
    return `<div class="scores">
      <div class="score-head">${loc('score.title')}</div>${body}
    </div>`;
  }

  title(save) {
    const best = save.best || 0;
    const rows = ['move', 'mine', 'jump', 'grip', 'boom', 'bank', 'heart', 'clock', 'dark'].map(k =>
      `<div class="row"><span>${loc('help.' + k + '.k')}</span><span>${loc('help.' + k + '.v', { m: Math.round(CFG.lava.fuse / 60), h: fmt(CFG.gems.heartstoneValue) })}</span></div>`).join('');

    this._repaint = () => this.title(save);
    this.show(`
      <div class="logo">DEEPCUT</div>
      <div class="tagline">${loc('title.tagline')}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('title.bestHaul')}</div><div class="v gold">${fmt(Highscore.best())}</div></div>
        <div class="stat"><div class="k">${loc('title.furthestMine')}</div><div class="v carry">${save.bestMine || 0}</div></div>
        <div class="stat wide"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: best })}</div></div>
      </div>
      ${this.scoreBoard()}
      <div class="help">${rows}</div>
      <button class="btn" id="startBtn">${loc('title.start')}</button>
      ${this.langButton()}
      ${best || Highscore.list().length ? `<button class="btn ghost" id="wipeBtn">${loc('title.wipe')}</button>` : ''}
    `);
    this.on('#startBtn', () => this.game.newCampaign());
    this.on('#wipeBtn', () => this.game.wipeSave());
    this.wireLang();
  }

  /**
   * `opts.title` / `.sub` / `.note` / `.closeLabel` / `.extra` may be plain
   * strings or thunks. Pass a thunk for anything localized: the panel re-runs it
   * when the language changes, so labels fixed at open time follow the switch.
   */
  shop(game, opts) {
    const o = opts || {};
    const res = (v, key) => (typeof v === 'function' ? v() : v !== undefined ? v : loc(key));

    const p = game.player;
    const inRun = game.state === 'paused' && p && !p.dead;

    // Consumables, both all-or-nothing. Walking in refills nothing, and a
    // lantern in the mine only opens once, so each of these is a single
    // decision rather than something to tap at. Everything is paid for out of
    // the carried gems — which is to say, out of the score.
    const S = CFG.supplies;
    const cash = game.purse();
    const dynSection = inRun ? `
      <div class="shop-item">
        <div class="info">
          <div class="nm">${loc('supply.dynamite.name')}</div>
          <div class="ds">${loc('supply.dynamite.desc', { cur: p.dynamite, max: p.dynMax })}</div>
        </div>
        <button class="buy" data-dyn="1"
          ${p.dynamite >= p.dynMax || cash < S.dynamiteCost ? 'disabled' : ''}
        >${fmt(S.dynamiteCost)}</button>
      </div>` : '';

    const healSection = inRun ? `
      <div class="shop-item">
        <div class="info">
          <div class="nm">${loc('supply.heal.name')}</div>
          <div class="ds">${loc('supply.heal.desc', { cur: p.health, max: p.maxHealth })}</div>
        </div>
        <button class="buy" data-heal="1"
          ${p.health >= p.maxHealth || cash < S.healCost ? 'disabled' : ''}
        >${fmt(S.healCost)}</button>
      </div>` : '';

    const items = CFG.upgrades.map(u => {
      const lvl = game.campaign.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = game.upgradeCost(u, lvl);
      const afford = cash >= cost;
      const pips = Array.from({ length: u.max }, (_, i) =>
        `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('');
      return `
        <div class="shop-item">
          <div class="info">
            <div class="nm">${loc('up.' + u.id + '.name')}</div>
            <div class="ds">${loc('up.' + u.id + '.desc', game.upgradeDescParams(u, lvl))}</div>
            <div class="pips">${pips}</div>
          </div>
          <button class="buy ${maxed ? 'max' : ''}" data-up="${u.id}"
            ${maxed || !afford ? 'disabled' : ''}>${maxed ? loc('shop.max') : fmt(cost)}</button>
        </div>`;
    }).join('');

    this._repaint = () => this.shop(game, o);
    this.show(`
      <h2>${res(o.title, 'shop.supplyLantern')}</h2>
      <div class="sub">${res(o.sub, 'shop.paysFromCarry')}</div>
      ${o.note ? `<div class="note">${res(o.note)}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="k">${loc('hud.carrying')}</div><div class="v carry">${fmt(cash)}</div></div>
        <div class="stat"><div class="k">${loc('shop.depth')}</div><div class="v">${loc('score.mineDepth', { n: game.campaign.mine, d: game.depth() })}</div></div>
      </div>
      <div class="shop-list">${dynSection}${healSection}${items}</div>
      <button class="btn" id="closeShop">${res(o.closeLabel, 'shop.back')}</button>
      ${o.extra ? res(o.extra) : ''}
      ${this.langButton()}
    `);
    this.onAll('[data-dyn]', () => game.buyDynamite());
    this.onAll('[data-heal]', () => game.buyHeal());
    this.onAll('[data-up]', (el) => game.buyUpgrade(el.dataset.up));
    this.on('#closeShop', () => game.closePanel());
    if (o.wire) o.wire(this);
    this.wireLang();
  }

  /**
   * The end of a mine. After an escape the campaign goes on and the panel
   * offers the next mine; anything else ends the campaign and shows how the
   * final score was made — found, plus Heartstones, minus what was spent and
   * lost. The lost line is whatever makes the sum come out, so it covers bats,
   * death, and dropped gems alike without any of them being tracked twice.
   */
  summary(game, kind) {
    const c = game.campaign;
    const s = game.runStats;
    const isWin = kind === 'win';
    const isDeath = kind === 'death' || kind === 'abandon';
    const title = isWin ? loc('sum.escaped') : isDeath ? loc('sum.died') : loc('sum.complete');
    const sub = isWin ? loc('sum.nextMine', { n: c.mine + 1 })
      : isDeath ? (s.lost > 0 ? loc('sum.lootLost', { v: fmt(s.lost) }) : loc('sum.nothingLost'))
      : loc('sum.hauledOut');

    const r = c.result || null;
    const note = isDeath && c.mine > 1 && c.score > 0 ? loc('sum.escapedKept')
      : r && r.record ? loc('score.newBest')
      : r && r.rank ? loc('score.ranked', { n: r.rank })
      : '';

    const heartsValue = c.hearts * CFG.gems.heartstoneValue;
    const lost = Math.max(0, c.found + heartsValue - c.spent - c.score);
    const line = (k, v, cls) => `<div class="row"><span>${loc(k)}</span><span class="${cls || ''}">${v}</span></div>`;
    const ledger = `
      <div class="help ledger">
        ${line('sum.found', '+' + fmt(c.found))}
        ${c.hearts ? line('sum.heartstones', '+' + fmt(heartsValue)) : ''}
        ${line('sum.spent', '−' + fmt(c.spent))}
        ${lost ? line('sum.lost', '−' + fmt(lost)) : ''}
        ${line(isWin ? 'sum.scoreSoFar' : 'sum.finalScore', fmt(c.score), 'total')}
      </div>`;

    this._repaint = () => this.summary(game, kind);
    this.show(`
      <h2>${title}</h2>
      <div class="sub">${sub}</div>
      ${note ? `<div class="note">${note}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="k">${loc(isWin ? 'sum.hauledThisMine' : 'sum.score')}</div><div class="v gold">${fmt(isWin ? s.hauled : c.score)}</div></div>
        <div class="stat"><div class="k">${loc('sum.mine')}</div><div class="v">${c.mine}</div></div>
        <div class="stat"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: c.depth })}</div></div>
        <div class="stat"><div class="k">${loc('sum.gems')}</div><div class="v carry">${c.gems}</div></div>
      </div>
      ${ledger}
      ${isWin ? '' : this.scoreBoard(r ? r.id : 0)}
      ${isWin
        ? `<div class="note">${loc('sum.gearCarries')}</div>
           <button class="btn" id="nextBtn">${loc('sum.descend', { n: c.mine + 1 })}</button>
           <button class="btn ghost" id="retireBtn">${loc('sum.retire')}</button>`
        : `<button class="btn" id="againBtn">${loc('sum.newCampaign')}</button>`}
      ${this.langButton()}
    `);
    this.on('#nextBtn', () => game.nextMine());
    this.on('#retireBtn', () => this.summary(game, 'cashout'));
    this.on('#againBtn', () => game.newCampaign());
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

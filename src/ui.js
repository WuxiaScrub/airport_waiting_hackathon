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
   * The personal haul board. `highlightId` marks the row a run just set. The
   * global boards have their own panel — see leaderboards() below.
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
    const rows = ['move', 'mine', 'dirt', 'jump', 'grip', 'boom', 'bank', 'shop', 'heart', 'clock', 'dark'].map(k =>
      `<div class="row"><span>${loc('help.' + k + '.k')}</span><span>${loc('help.' + k + '.v', { m: Math.round(CFG.lava.fuse / 60), h: fmt(CFG.gems.heartstoneValue) })}</span></div>`).join('');

    this._repaint = () => this.title(save);
    this.show(`
      <div class="logo">${loc('title.logo')}</div>
      <div class="logo-sub">${loc('title.logoSub')}</div>
      <div class="tagline">${loc('title.tagline')}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('title.bestHaul')}</div><div class="v gold">${fmt(Highscore.best())}</div></div>
        <div class="stat"><div class="k">${loc('title.furthestMine')}</div><div class="v carry">${save.bestMine || 0}</div></div>
        <div class="stat wide"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: best })}</div></div>
      </div>
      ${this.scoreBoard()}
      <div class="help">${rows}</div>
      <button class="btn" id="startBtn">${loc('title.start')}</button>
      ${this.onlineButtons()}
      ${this.langButton()}
      ${best || Highscore.list().length ? `<button class="btn ghost" id="wipeBtn">${loc('title.wipe')}</button>` : ''}
    `);
    this.on('#startBtn', () => this.game.newCampaign());
    this.on('#wipeBtn', () => this.game.wipeSave());
    this.wireOnlineButtons();
    this.wireLang();
  }

  /* ---------------------------------------------------------------- online */

  /** LEADERBOARDS / PROFILE, plus the update notice. Nothing when offline-only. */
  onlineButtons() {
    if (!Online.enabled) return '';
    return `${Online.updateRequired ? `<div class="note">${loc('online.update')}</div>` : ''}
      <div class="btn-row">
        <button class="btn ghost" id="boardsBtn">${loc('title.boards')}</button>
        <button class="btn ghost" id="profileBtn">${loc('title.profile')}</button>
      </div>`;
  }

  wireOnlineButtons() {
    this.on('#boardsBtn', () => this.openOnline(() => this.leaderboards('endless')));
    this.on('#profileBtn', () => this.openOnline(() => this.profile()));
  }

  /** Remember the panel underneath so BACK returns to it, then open `draw`. */
  openOnline(draw) {
    this._back = this._repaint || (() => this.title(this.game.save));
    draw();
  }

  backButton() { return `<button class="btn" id="backBtn">${loc('common.back')}</button>`; }
  wireBack() { this.on('#backBtn', () => { const b = this._back; this._back = null; b(); }); }

  /** A name on a board: the player's pick, or Miner#1234 until they pick one. */
  playerName(name, tag) { return name ? esc(name) : loc('name.anon', { tag: esc(tag) }); }

  medalTally(r) {
    const m = ['gold', 'silver', 'bronze'].filter(k => r[k] > 0)
      .map(k => `<span class="medal ${k}">${r[k]}</span>`).join('');
    return m ? `<span class="medals">${m}</span>` : '';
  }

  /** Loading / offline / error line shared by the online panels. */
  onlineStatus(res, emptyKey, isEmpty) {
    if (!res) return `<div class="score-empty">${loc('board.loading')}</div>`;
    if (!res.ok) return `<div class="score-empty">${loc(res.offline ? 'board.offline' : 'board.error')}</div>`;
    const stale = res.cached ? `<div class="board-stale">${loc('board.cached')}</div>` : '';
    return isEmpty ? stale + `<div class="score-empty">${loc(emptyKey)}</div>` : stale;
  }

  /**
   * The global boards: Endless (all time), Today's daily, Yesterday's daily
   * with its podium. Draws at once with a loading line, then again when the
   * data lands — but only if the player is still looking at this panel.
   */
  leaderboards(tab) {
    const st = { tab, res: null, ranks: null };
    const draw = () => {
      this._repaint = draw;
      const rows = st.res && st.res.ok && Array.isArray(st.res.data) ? st.res.data : [];
      const daily = tab !== 'endless';
      const list = rows.map(r => `
        <div class="score-row board-row${r.me ? ' you' : ''}">
          <span class="rk">${r.medal ? `<span class="medal ${r.medal}"></span>` : r.rank}</span>
          <span class="nm">${this.playerName(r.name, r.tag)}${this.medalTally(r)}</span>
          <span class="vv">${fmt(r.score)}</span>
          <span class="dd">${daily
            ? loc('common.metres', { n: r.max_depth }) + (r.heartstone ? ' <span class="hs">◆</span>' : '')
            : loc(r.mines_escaped === 1 ? 'board.mine' : 'board.mines', { n: r.mines_escaped })}</span>
        </div>`).join('');

      // Your own standing when you are off the bottom of the list.
      const rk = st.ranks && st.ranks.ok && Array.isArray(st.ranks.data) ? st.ranks.data[0] : null;
      const myRank = rk && (tab === 'endless' ? rk.endless_rank : tab === 'today' ? rk.daily_rank : null);
      const myBest = rk && (tab === 'endless' ? rk.endless_best : rk.daily_best);
      const pinned = myRank && !rows.some(r => r.me) ? `
        <div class="score-row board-row you pinned">
          <span class="rk">${myRank}</span><span class="nm">${loc('board.you')}</span>
          <span class="vv">${fmt(myBest)}</span><span class="dd"></span>
        </div>` : '';

      const tabBtn = (k) => `<button class="tab${k === tab ? ' on' : ''}" data-tab="${k}">${loc('board.' + k)}</button>`;
      this.show(`
        <h2>${loc('board.title')}</h2>
        <div class="sub">${loc(daily ? 'board.dailySub' : 'board.endlessSub', { d: tab === 'today' ? utcDate(0) : utcDate(-1) })}</div>
        <div class="tabs">${tabBtn('endless')}${tabBtn('today')}${tabBtn('yesterday')}</div>
        <div class="scores board">
          ${this.onlineStatus(st.res, daily ? 'board.emptyDaily' : 'board.empty', !rows.length)}
          ${list}${pinned}
        </div>
        ${this.backButton()}
        ${this.langButton()}
      `);
      this.onAll('[data-tab]', (el) => { Sfx.play('ui'); if (el.dataset.tab !== tab) this.leaderboards(el.dataset.tab); });
      this.wireBack();
      this.wireLang();
    };
    draw();

    const req = tab === 'endless' ? Online.endlessTop(50) : Online.dailyTop(utcDate(tab === 'today' ? 0 : -1), 50);
    Promise.all([req, Online.myRanks()]).then(([res, ranks]) => {
      st.res = res; st.ranks = ranks;
      if (this._repaint === draw && this.isOpen) draw();
    });
  }

  /**
   * The player's profile: name (editable), medals, bests and recent runs, and
   * account deletion behind a second confirmation.
   */
  profile() {
    const st = { res: null, editing: false, draft: '', err: '', busy: false, confirmDelete: false };
    const p = () => (st.res && st.res.ok && st.res.data) || null;

    const load = () => Online.myProfile().then(res => {
      st.res = res;
      if (this._repaint === draw && this.isOpen) draw();
    });

    const save = () => {
      const v = st.draft.trim();
      if (st.busy || !v) return;
      st.busy = true; st.err = ''; draw();
      Online.setName(v).then(res => {
        st.busy = false;
        if (res.ok) { st.editing = false; load(); }
        else st.err = this.nameError(res.error, p());
        if (this._repaint === draw && this.isOpen) draw();
      });
    };

    const remove = () => {
      if (st.busy) return;
      st.busy = true; draw();
      Online.deleteAccount().then(res => {
        st.busy = false;
        if (res.ok) { this._back = null; this.game.wipeSave(); this.toast(loc('prof.deleted'), 2200); return; }
        st.err = loc(res.offline ? 'name.err.offline' : 'board.error');
        st.confirmDelete = false;
        if (this._repaint === draw && this.isOpen) draw();
      });
    };

    const draw = () => {
      this._repaint = draw;
      const d = p();
      const pending = Online.pending();
      let body;
      if (!d) {
        body = this.onlineStatus(st.res, 'board.error', true);
      } else {
        const nameBlock = st.editing ? `
          <div class="name-edit">
            <input id="nameInput" maxlength="15" autocomplete="off" autocapitalize="off" spellcheck="false"
                   placeholder="${loc('prof.placeholder')}" value="${esc(st.draft)}" ${st.busy ? 'disabled' : ''} />
            <div class="name-rules">${loc('prof.rules')}</div>
            ${st.err ? `<div class="name-err">${st.err}</div>` : ''}
            <div class="btn-row">
              <button class="btn" id="saveName" ${st.busy ? 'disabled' : ''}>${loc('prof.save')}</button>
              <button class="btn ghost" id="cancelName">${loc('prof.cancel')}</button>
            </div>
          </div>` : `
          <div class="name-show">
            <span class="nm">${this.playerName(d.name, d.tag)}</span>
            <button class="btn ghost small" id="editName">${loc(d.name ? 'prof.edit' : 'prof.pick')}</button>
          </div>
          ${d.name ? '' : `<div class="name-rules">${loc('prof.noName')}</div>`}`;

        const recent = (d.recent || []).slice(0, 10).map(r => `
          <div class="score-row">
            <span class="dd wide">${loc(r.mode === 'daily' ? 'run.daily' : 'run.endless')} · ${this.shortDate(r.created_at)}</span>
            <span class="vv">${fmt(r.score)}</span>
            <span class="dd">${loc('run.res.' + r.result)}</span>
          </div>`).join('');

        const stat = (k, v, cls) => `<div class="stat"><div class="k">${loc(k)}</div><div class="v ${cls || ''}">${v}</div></div>`;
        body = `
          ${this.onlineStatus(st.res, '', false)}
          ${nameBlock}
          <div class="medal-row">
            <div class="medal-big gold"><span></span>${d.gold}</div>
            <div class="medal-big silver"><span></span>${d.silver}</div>
            <div class="medal-big bronze"><span></span>${d.bronze}</div>
          </div>
          <div class="stats">
            ${stat('prof.bestEndless', fmt(d.best_endless || 0), 'gold')}
            ${stat('prof.mostMines', d.most_mines || 0, 'carry')}
            ${stat('prof.deepest', loc('common.metres', { n: d.deepest || 0 }))}
            ${stat('prof.runs', loc('prof.runsValue', { n: d.runs, d: d.dailies }))}
          </div>
          <div class="scores">
            <div class="score-head">${loc('prof.recent')}</div>
            ${recent || `<div class="score-empty">${loc('prof.noRuns')}</div>`}
          </div>
          ${st.confirmDelete ? `
            <div class="note danger">${loc('prof.deleteBody')}</div>
            <button class="btn hot" id="deleteYes" ${st.busy ? 'disabled' : ''}>${loc('prof.deleteYes')}</button>
            <button class="btn ghost" id="deleteNo">${loc('prof.cancel')}</button>`
          : `<button class="btn ghost" id="deleteBtn">${loc('prof.delete')}</button>`}`;
        if (!st.editing && st.err) body = `<div class="name-err">${st.err}</div>` + body;
      }

      this.show(`
        <h2>${loc('prof.title')}</h2>
        ${pending ? `<div class="sub">${loc('prof.pending', { n: pending })}</div>` : ''}
        ${body}
        ${this.backButton()}
        ${this.langButton()}
      `);
      const input = this.el.panelInner.querySelector('#nameInput');
      if (input) {
        input.addEventListener('input', () => { st.draft = input.value; });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); e.stopPropagation(); });
        if (!st.busy) input.focus();
      }
      this.on('#editName', () => { st.editing = true; st.err = ''; st.draft = (p() && p().name) || ''; draw(); });
      this.on('#cancelName', () => { st.editing = false; st.err = ''; draw(); });
      this.on('#saveName', save);
      this.on('#deleteBtn', () => { st.confirmDelete = true; st.err = ''; draw(); });
      this.on('#deleteNo', () => { st.confirmDelete = false; draw(); });
      this.on('#deleteYes', remove);
      this.wireBack();
      this.wireLang();
    };
    draw();
    load();
  }

  /** Words for a set_display_name refusal. */
  nameError(code, prof) {
    if (code === 'name_cooldown' && prof && prof.name_changed_at) {
      const next = new Date(Date.parse(prof.name_changed_at) + CFG.online.nameCooldownDays * 86400000);
      return loc('name.err.name_cooldown', { date: this.shortDate(next) });
    }
    const known = ['name_length', 'name_chars', 'name_banned', 'name_taken', 'offline'];
    return loc('name.err.' + (known.indexOf(code) >= 0 ? code : code === 'network' ? 'offline' : 'unknown'));
  }

  shortDate(d) {
    try {
      return new Date(d).toLocaleDateString(I18N.lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  /** The summary's one-line upload status, refreshed as the upload goes. */
  onlineLine(game) {
    const o = game.campaign.online;
    if (!o) return '';
    const key = o.state === 'sent' ? (o.rank ? 'sum.globalRank' : 'sum.uploaded')
      : o.state === 'queued' ? 'sum.uploadLater'
      : o.state === 'refused' ? (Online.updateRequired ? 'online.update' : 'sum.uploadRefused')
      : 'sum.uploading';
    return loc(key, { n: o.rank });
  }

  syncOnline(game) {
    const el = this.el.panelInner.querySelector('#onlineLine');
    if (el) el.textContent = this.onlineLine(game);
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
      ${Online.enabled ? `<div class="online-line" id="onlineLine">${this.onlineLine(game)}</div>` : ''}
      ${isWin ? '' : this.scoreBoard(r ? r.id : 0)}
      ${isWin
        ? `<div class="note">${loc('sum.gearCarries')}</div>
           <button class="btn" id="nextBtn">${loc('sum.descend', { n: c.mine + 1 })}</button>
           <button class="btn ghost" id="retireBtn">${loc('sum.retire')}</button>`
        : `<button class="btn" id="againBtn">${loc('sum.newCampaign')}</button>`}
      ${this.onlineButtons()}
      ${this.langButton()}
    `);
    this.on('#nextBtn', () => game.nextMine());
    this.on('#retireBtn', () => this.summary(game, 'cashout'));
    this.on('#againBtn', () => game.newCampaign());
    this.wireOnlineButtons();
    this.wireLang();
  }

  /**
   * "Leave the mine?" — raised by the exit guard when the Back button would
   * throw a live mine away. It covers whatever panel is already on screen (the
   * shop, say) and puts it back untouched if the player stays, so a stray press
   * costs nothing but a tap.
   *
   * Returns the "put it back" function, so the guard can also dismiss the
   * prompt itself if the exit it asked about never actually happens.
   */
  confirmLeave(opts) {
    const game = this.game;
    const back = this._repaint;          // the panel underneath, if there is one
    const restore = () => {
      if (back) { this._repaint = back; back(); } else game.closePanel();
    };

    const draw = () => {
      this._repaint = draw;
      this.show(`
        <h2>${loc('confirm.leaveTitle')}</h2>
        <div class="sub">${loc('confirm.leaveBody')}</div>
        <div class="stats">
          <div class="stat"><div class="k">${loc('shop.depth')}</div>
            <div class="v">${loc('score.mineDepth', { n: game.campaign.mine, d: game.depth() })}</div></div>
          <div class="stat"><div class="k">${loc('hud.carrying')}</div>
            <div class="v carry">${fmt(game.carryValue())}</div></div>
        </div>
        <button class="btn" id="stayBtn">${loc('confirm.stay')}</button>
        <button class="btn ghost" id="leaveBtn">${loc('confirm.leave')}</button>
        ${this.langButton()}
      `);
      this.on('#stayBtn', () => { restore(); opts.onStay(); });
      this.on('#leaveBtn', () => opts.onLeave());
      this.wireLang();
    };

    // Pause the mine if it was running; if a panel was already up the game is
    // paused already and opening a second one would only re-lock the input.
    if (game.state === 'play') game.openPanel(draw);
    else draw();
    return restore;
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

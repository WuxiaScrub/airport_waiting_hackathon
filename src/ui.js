/* ============================================================================
 * UI — HUD syncing and the modal panels (title, shop, summary, death, win).
 * The canvas never draws text-heavy UI; the DOM is sharper and cheaper.
 *
 * Every string here goes through loc() — see src/i18n.js.
 * ========================================================================== */

/**
 * Shop icons, drawn here rather than shipped as art: 24×24, self-coloured,
 * keyed by upgrade id (plus the two supplies).
 */
const SHOP_ICONS = {
  supplyDynamite: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="9" width="11" height="12.5" rx="2.2" fill="#c94b3c"/><rect x="6.5" y="12.5" width="11" height="2.6" fill="#f0e2c2"/><path d="M12 9V6.4c0-2 2.2-2.1 3.2-3.4" stroke="#e0c88a" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="16" cy="2.6" r="1.9" fill="#ffcf5c"/></svg>',
  supplyHeal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3" fill="#e9e3f5"/><rect x="9" y="2.5" width="6" height="3.5" rx="1" fill="none" stroke="#e9e3f5" stroke-width="1.6"/><path d="M12 8.5v8M8 12.5h8" stroke="#ff5d5d" stroke-width="3" stroke-linecap="round"/></svg>',
  health: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3.3 12.2A5 5 0 0 1 12 6a5 5 0 0 1 8.7 6.2z" fill="#ff5d5d"/><path d="M12 10.5v6M9 13.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  speed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h5v8.5l6 2.2c1 .4 1.5 1.2 1.5 2.3V19H9z" fill="#c9905a"/><rect x="9" y="17.5" width="12.5" height="2.5" rx="1" fill="#6b4a2c"/><path d="M2.5 9h4.5M1.5 13h5.5M2.5 17h4.5" stroke="#7ef0d0" stroke-width="1.8" stroke-linecap="round"/></svg>',
  jump: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 17.5 9H14v3h-4V9H6.5z" fill="#7ef0d0"/><path d="M7 14.5h10M7 14.5l10 3M17 17.5l-10 3M7 20.5h10" stroke="#b9a8ff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 0 1 17 0z" fill="#6a53c9"/><circle cx="12" cy="12" r="3.6" fill="#ffe7a3"/><path d="M12 15.6V22M8.5 15l-2.8 5.3M15.5 15l2.8 5.3" stroke="#ffc95e" stroke-width="1.7" stroke-linecap="round" opacity=".85"/></svg>',
  dynamite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7c0-2.6 1.8-4 4-4s4 1.4 4 4" stroke="#8a6040" stroke-width="2" fill="none"/><rect x="3.5" y="7" width="17" height="14" rx="3.5" fill="#a5723f"/><rect x="3.5" y="7" width="17" height="5" rx="2.5" fill="#c9905a"/><rect x="10.5" y="10.5" width="3" height="3.5" rx="1" fill="#ffc95e"/></svg>',
  helmet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17.5h20V20H2zM5 17.5V13a7 7 0 0 1 14 0v4.5z" fill="#ffc95e"/><path d="M10.5 6.2h3v6h-3z" fill="#e0a63c"/></svg>',
  blast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.4 5.6 5.5-2.6-2.3 5.6 5.4 2-5.4 2 2.3 5.6-5.5-2.6L12 22.7l-2.4-5.6-5.5 2.6 2.3-5.6-5.4-2 5.4-2-2.3-5.6 5.5 2.6z" fill="#ff7a3c"/><circle cx="12" cy="12" r="4.2" fill="#ffd08a"/></svg>',
};

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
      pauseBtn: document.getElementById('pauseBtn'),
      achieve: document.getElementById('achieve'),
    };
    this._achQueue = [];       // achievement pop-ups waiting their turn
    this._back = [];           // panels to return to, innermost last — see open()
    this._heartCount = -1;
    this._hatCount = -1;
    this._toastTimer = 0;
    this._repaint = null;      // redraws the open panel after a language change

    I18N.onChange(() => this.onLanguageChange());

    this.el.pauseBtn.addEventListener('click', () => {
      Sfx.init(); Sfx.play('ui', { ui: true });
      // Drop focus, or the next Space (jump) would press it again on desktop.
      this.el.pauseBtn.blur();
      if (game.state === 'play') game.togglePause();
    });
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
    if (this.game.campaign.daily) label = loc('hud.daily') + '  ·  ' + label;
    else if (mine > 1) label = loc('hud.mineN', { n: mine }) + '  ·  ' + label;
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

  /** The pause button is only there while a mine is live and in hand. */
  syncPause(game) {
    const on = game.state === 'play' && !!game.player && !game.player.dead;
    if (this._pauseOn === on) return;
    this._pauseOn = on;
    this.el.pauseBtn.classList.toggle('hidden', !on);
  }

  /**
   * Redraw the open panel from scratch. Every panel registers how to rebuild
   * itself, so callers never have to sniff the DOM to work out which one it is.
   */
  repaint() {
    if (!this.isOpen || !this._repaint) return;
    // A redraw is the same panel with fresh numbers (a purchase, a language
    // switch), so it keeps the player's place instead of jumping to the top.
    const keep = this.scrollers().map(el => el.scrollTop);
    this._repaint();
    this.scrollers().forEach((el, i) => { if (keep[i] !== undefined) el.scrollTop = keep[i]; });
  }

  /** Everything in the open panel that scrolls: the panel, plus any inner list. */
  scrollers() {
    return [this.el.panel, ...this.el.panelInner.querySelectorAll('.shop-scroll')];
  }

  /** Re-render everything language-dependent that is on screen right now. */
  onLanguageChange() {
    const g = this.game;
    if (g.player && g.world) this.syncDepth(g.depth(), g.world, g.player);
    this.repaint();
  }

  /* -------------------------------------------------------------- feedback */

  // The title-screen demo is silent on the HUD: no toasts, banners or flashes.
  toast(msg, ms) {
    if (this.game.demo) return;
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms || 1400);
  }

  banner(title, sub) {
    if (this.game.demo) return;
    const b = this.el.banner;
    b.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  /**
   * "ACHIEVEMENT UNLOCKED — Exterminator II". One at a time: a dynamite blast
   * that finishes two achievements at once shows both, one after the other.
   */
  achievement(a, level) {
    this._achQueue.push({ a, level });
    if (this._achQueue.length === 1) this.nextAchievement();
  }

  nextAchievement() {
    const item = this._achQueue[0];
    if (!item) return;
    const el = this.el.achieve;
    el.innerHTML = `${this.levelBadge(item.level, 'done')}<span class="achieve-txt">
      <span class="achieve-k">${loc('ach.unlocked')}</span>
      <span class="achieve-v">${this.achName(item.a, item.level)}</span></span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    Sfx.play('bank');
    setTimeout(() => { this._achQueue.shift(); this.nextAchievement(); }, 2700);
  }

  flashHurt() {
    if (this.game.demo) return;
    const h = this.el.hurt;
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 90);
  }

  flashLoss() {
    if (this.game.demo) return;
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

  show(html, cls) {
    // The title alone is see-through, so the demo mine shows around it.
    this.el.panel.classList.toggle('demo', cls === 'title');
    this.el.panelInner.className = 'panel-inner' + (cls ? ' ' + cls : '');
    this.el.panelInner.innerHTML = html;
    this.el.panel.classList.remove('hidden');
    this.el.panel.scrollTop = 0;
  }

  hide() { this.el.panel.classList.add('hidden'); this._repaint = null; }
  /** The title is up and the demo behind it should be drawn at full rate. */
  get showingDemo() { return this.isOpen && this.el.panel.classList.contains('demo'); }
  get isOpen() { return !this.el.panel.classList.contains('hidden'); }

  on(sel, fn) {
    const el = this.el.panelInner.querySelector(sel);
    if (el) el.addEventListener('click', (e) => { Sfx.init(); Sfx.play('ui', { ui: true }); fn(e); });
  }
  onAll(sel, fn) {
    this.el.panelInner.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', (e) => { Sfx.init(); fn(el, e); }));
  }

  /** The language chip every panel carries in its corner, plus its handler. */
  langButton() {
    return `<button class="lang-chip" id="langBtn" aria-label="${loc('lang.switch')}">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>
      ${loc('lang.short')}</button>`;
  }
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

  /**
   * The title: two ways to play and two doors (boards, profile). Records,
   * stats and the save itself all live behind PROFILE.
   */
  title() {
    const save = this.game.save;
    this._back = [];
    this._repaint = () => this.title();
    this.show(`
      ${this.musicButton()}
      ${this.langButton()}
      <div class="logo">${loc('title.logo')}</div>
      <div class="logo-sub">${loc('title.logoSub')}</div>
      <div class="tagline">${loc('title.tagline')}</div>
      ${Online.enabled && Online.updateRequired ? `<div class="note">${loc('online.update')}</div>` : ''}
      ${this.dailyCard(save)}
      <button class="btn" id="startBtn">${loc('title.endless')}</button>
      <div class="btn-row${Online.enabled ? '' : ' one'}">
        ${Online.enabled ? `<button class="btn ghost" id="boardsBtn">${loc('title.boards')}</button>` : ''}
        <button class="btn ghost" id="profileBtn">${loc('title.profile')}</button>
      </div>
      <div class="title-links">
        <button class="link-btn" id="helpBtn">${loc('help.title')}</button>
        ${this.privacyLink()}
      </div>
    `, 'title');
    this.on('#startBtn', () => this.game.newCampaign());
    this.on('#dailyBtn', () => this.game.newCampaign(false, 'daily'));
    this.on('#helpBtn', () => this.help());
    this.on('#musicBtn', () => { this.game.toggleMusic(); this.title(); });
    this.wirePrivacy();
    this.wireOnlineButtons();
    this.wireLang();
  }

  /** Music on/off, the title's other corner chip. */
  musicButton() {
    const on = Music.enabled;
    return `<button class="lang-chip music-chip${on ? '' : ' off'}" id="musicBtn"
      aria-label="${loc('pause.music', { s: loc(on ? 'common.on' : 'common.off') })}" aria-pressed="${on}">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>${on ? '' : '<path d="M3 3l18 18"/>'}
      </svg></button>`;
  }

  /** How to play: one row per rule. Opens by itself on a first launch. */
  help() {
    const save = this.game.save;
    const first = !save.seenHelp;
    const rows = ['move', 'mine', 'dirt', 'jump', 'grip', 'boom', 'bank', 'shop', 'heart', 'clock', 'dark'].map(k =>
      `<div class="row"><span>${loc('help.' + k + '.k')}</span><span>${loc('help.' + k + '.v', { m: Math.round(CFG.lava.fuse / 60), h: fmt(CFG.gems.heartstoneValue) })}</span></div>`).join('');

    this._repaint = () => this.help();
    this.show(`
      ${this.langButton()}
      <h2>${loc('help.title')}</h2>
      <div class="help" style="margin-top: 12px">${rows}</div>
      <div class="credits">${loc('help.credits')}</div>
      <button class="btn" id="helpDone">${loc(first ? 'help.gotIt' : 'common.back')}</button>
    `);
    this.on('#helpDone', () => {
      if (first) { save.seenHelp = true; this.game.persist(); }
      this.title();
    });
    this.wireLang();
  }

  /** "Exterminator II" — an achievement's name at a level (none at 0). */
  achName(a, level) {
    const name = loc('ach.' + a.id + '.name');
    return level ? loc('ach.nameLevel', { name, n: roman(level) }) : name;
  }

  /** The Roman-numeral badge for one level: 'done', 'now' (being worked on) or 'locked'. */
  levelBadge(level, state) {
    return `<span class="lv-badge ${state}">${roman(level)}</span>`;
  }

  /** What level `i` (0-based) of an achievement asks for. */
  achDesc(a, i) {
    const bar = a.levels[i];
    const key = 'ach.' + a.id + '.desc';
    return a.lower ? loc(key, { t: fmtTime(bar) })
      : loc(bar === 1 && STRINGS.en[key + '1'] ? key + '1' : key, { n: fmt(bar) });
  }

  /** Levels unlocked across every achievement, and how many there are. */
  achCount() {
    const s = this.game.save.stats;
    return {
      n: CFG.achievements.reduce((n, a) => n + Stats.level(a, s), 0),
      max: CFG.achievements.reduce((n, a) => n + a.levels.length, 0),
    };
  }

  /**
   * Achievements, then the lifetime counters behind them. Each achievement is
   * a row of level cards — I, II, III… — that scrolls sideways, opened on the
   * level being worked on: the ones before it are done, the ones after locked.
   */
  achievements() {
    const save = this.game.save;
    const s = save.stats;
    const time = (secs) => (secs ? fmtTime(secs) : loc('stats.none'));

    const rows = CFG.achievements.map(a => {
      const level = Stats.level(a, s);
      const v = Stats.value(s, a.stat);
      const done = level >= a.levels.length;
      const cards = a.levels.map((bar, i) => {
        const state = i < level ? 'done' : i === level ? 'now' : 'locked';
        let foot = '';
        if (state === 'done') foot = `<div class="lv-pg">${loc('ach.done')}</div>`;
        else if (state === 'now') {
          // A time fills as it comes down toward the bar; a count as it climbs.
          const pct = a.lower ? (v ? clamp(bar / v, 0, 1) * 100 : 0) : clamp(v / bar, 0, 1) * 100;
          foot = `<div class="ach-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
            <div class="lv-pg">${a.lower ? loc('ach.best', { t: time(v) }) : loc('ach.progress', { v: fmt(v), n: fmt(bar) })}</div>`;
        }
        return `<div class="lv-card ${state}">
          ${this.levelBadge(i + 1, state)}
          <div class="lv-ds">${this.achDesc(a, i)}</div>${foot}</div>`;
      }).join('');
      return `
        <div class="ach${done ? ' done' : ''}">
          <div class="ach-head">
            <span class="ach-nm">${loc('ach.' + a.id + '.name')}</span>
            <span class="ach-lv">${level ? loc('ach.level', { n: roman(level), max: roman(a.levels.length) }) : loc('ach.none')}</span>
          </div>
          <div class="lv-strip" data-at="${Math.min(level, a.levels.length - 1)}">${cards}</div>
        </div>`;
    }).join('');

    const line = (k, v) => `<div class="row"><span>${loc(k)}</span><span>${v}</span></div>`;
    const kills = (who) => KILL_CAUSES.map(c => line('stats.by.' + c, fmt(s.kills[who][c]))).join('');
    // A section's total rides in its heading; the rows under it break it down.
    const section = (k, total, body) => `<div class="scores">
      <div class="score-head split"><span>${loc(k)}</span><span>${total === undefined ? '' : fmt(total)}</span></div>
      <div class="help ledger stat-list">${body}</div></div>`;
    const stats =
      section('stats.gems', s.gems.reduce((a, b) => a + b, 0),
        ['sapphire', 'emerald', 'ruby', 'diamond'].map((k, i) => line('stats.' + k, fmt(s.gems[i]))).join('') +
        line('stats.hearts', fmt(s.hearts))) +
      section('stats.caveBugs', Stats.kills(s, 'caveBug'), kills('caveBug')) +
      section('stats.bats', Stats.kills(s, 'bat'), kills('bat')) +
      section('stats.other', undefined, `
        ${line('stats.fastest', time(s.fastest))}
        ${line('stats.bestHaul', fmt(Highscore.best()))}
        ${line('stats.bestMine', fmt(save.bestMine || 0))}
        ${line('stats.deepest', loc('common.metres', { n: save.best || 0 }))}
        ${line('stats.recovered', fmt(s.recovered))}
        ${line('stats.stolen', fmt(s.stolen))}
        ${line('stats.dynamite', fmt(s.dynamite))}
        ${line('stats.runs', fmt(s.runs))}
        ${line('stats.deaths', fmt(s.deaths))}`);

    this._repaint = () => this.achievements();
    this.show(`
      ${this.langButton()}
      <h2>${loc('ach.title')}</h2>
      <div class="sub">${loc('ach.sub', this.achCount())}</div>
      <div class="ach-list">${rows}</div>
      <h2 class="stats-h">${loc('stats.title')}</h2>
      ${stats}
      ${this.backButton()}
    `);
    // Open each strip on the level being worked on; the finished ones are a
    // swipe back to the left.
    this.el.panelInner.querySelectorAll('.lv-strip').forEach(strip => {
      const card = strip.children[+strip.dataset.at];
      if (card) strip.scrollLeft = card.offsetLeft;
    });
    this.wireBack();
    this.wireLang();
  }

  /** Today's daily mine: the date, your best on it, and when the next one opens. */
  dailyCard(save) {
    const today = utcDate(0);
    const best = save.daily && save.daily.date === today ? save.daily.best : 0;
    const left = Math.max(0, Date.parse(utcDate(1) + 'T00:00:00Z') - Date.now()) / 1000;
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
    return `
      <button class="btn daily" id="dailyBtn">
        <span class="daily-k">${loc('title.daily')}</span>
        <span class="daily-v">${loc('title.dailyInfo', { d: today, h, m })}</span>
        ${best ? `<span class="daily-v best">${loc('title.dailyBest', { v: fmt(best) })}</span>` : ''}
      </button>`;
  }

  /* ---------------------------------------------------------------- online */

  /** LEADERBOARDS / PROFILE on the summary, plus the update notice. Nothing when offline-only. */
  onlineButtons() {
    if (!Online.enabled) return '';
    return `${Online.updateRequired ? `<div class="note">${loc('online.update')}</div>` : ''}
      <div class="btn-row">
        <button class="btn ghost" id="boardsBtn">${loc('title.boards')}</button>
        <button class="btn ghost" id="profileBtn">${loc('title.profile')}</button>
      </div>`;
  }

  wireOnlineButtons() {
    // From a daily's summary, open on today's board; everywhere else, endless.
    const tab = this.game.state === 'over' && this.game.campaign.daily ? 'today' : 'endless';
    this.on('#boardsBtn', () => this.open(() => this.leaderboards(tab)));
    this.on('#profileBtn', () => this.open(() => this.profile()));
  }

  /**
   * Open `draw` over the current panel. BACK returns to the panel underneath,
   * one level at a time (title → profile → achievements and back again).
   */
  open(draw) {
    this._back.push(this._repaint || (() => this.title()));
    draw();
  }

  /** Apple requires the privacy policy to be reachable from inside the app. */
  privacyLink() { return `<button class="link-btn" id="privacyBtn">${loc('common.privacy')}</button>`; }
  wirePrivacy() { this.on('#privacyBtn', () => Native.openUrl(CFG.links.privacy)); }

  backButton() { return `<button class="btn" id="backBtn">${loc('common.back')}</button>`; }
  wireBack() { this.on('#backBtn', () => (this._back.pop() || (() => this.title()))()); }

  /** A name on a board: the player's pick, or Miner#1234 until they pick one. */
  playerName(name, tag) { return name ? esc(name) : loc('name.anon', { tag: esc(tag) }); }

  /**
   * Medals won on past dailies, as "● ×2". The count sits beside the medal,
   * never on it: a number on a gold disc reads as a placing, not a tally.
   */
  medalTally(r) {
    const m = ['gold', 'silver', 'bronze'].filter(k => r[k] > 0)
      .map(k => `<span class="medal-count ${k}"><span class="medal ${k}"></span>×${r[k]}</span>`).join('');
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
      this.onAll('[data-tab]', (el) => { Sfx.play('ui', { ui: true }); if (el.dataset.tab !== tab) this.leaderboards(el.dataset.tab); });
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
   * The player's profile. Online: name (editable), medals, bests, sign-in and
   * recent runs. Always, from this device: achievements & stats, the personal
   * haul board, and erasing the save. Erasing and account deletion each sit
   * behind a second confirmation.
   */
  profile() {
    const st = { res: null, editing: false, draft: '', err: '', busy: false, confirmDelete: false, confirmWipe: false,
      // Save-your-progress: who this account is linked to, and any switch on offer.
      acct: { linked: null, busy: false, err: '', cred: null } };
    const p = () => (st.res && st.res.ok && st.res.data) || null;

    const load = () => Online.enabled && Promise.all([Online.myProfile(), Account.linked()]).then(([res, linked]) => {
      st.res = res;
      st.acct.linked = linked;
      if (this._repaint === draw && this.isOpen) draw();
    });

    const link = () => {
      const a = st.acct;
      if (a.busy) return;
      a.busy = true; a.err = ''; draw();
      Account.link().then(res => {
        a.busy = false;
        if (res.ok) { this.toast(loc('acct.done'), 1800); load(); }
        else if (res.error === 'already_linked') a.cred = res.cred;
        else if (res.error !== 'cancelled') a.err = loc(res.error === 'offline' ? 'name.err.offline' : 'acct.failed');
        if (this._repaint === draw && this.isOpen) draw();
      });
    };

    const switchOver = () => {
      const a = st.acct;
      if (a.busy || !a.cred) return;
      a.busy = true; draw();
      Account.switchTo(a.cred).then(res => {
        a.busy = false; a.cred = null;
        if (res.ok) { this.toast(loc('acct.switched'), 2000); st.res = null; load(); }
        else a.err = loc('acct.failed');
        if (this._repaint === draw && this.isOpen) draw();
      });
    };

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
        if (res.ok) { this.game.wipeSave(); this.title(); this.toast(loc('prof.deleted'), 2200); return; }
        st.err = loc(res.offline ? 'name.err.offline' : 'board.error');
        st.confirmDelete = false;
        if (this._repaint === draw && this.isOpen) draw();
      });
    };

    const wipe = () => {
      this.game.wipeSave();
      st.confirmWipe = false;
      this.toast(loc('prof.wiped'), 1800);
      draw();
    };

    const draw = () => {
      this._repaint = draw;
      const d = p();
      const pending = Online.enabled ? Online.pending() : 0;
      let body = '';
      if (!Online.enabled) {
        body = '';
      } else if (!d) {
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
            <div class="medal-big gold"><span></span>×${d.gold}</div>
            <div class="medal-big silver"><span></span>×${d.silver}</div>
            <div class="medal-big bronze"><span></span>×${d.bronze}</div>
          </div>
          <div class="stats">
            ${stat('prof.bestEndless', fmt(d.best_endless || 0), 'gold')}
            ${stat('prof.mostMines', d.most_mines || 0, 'carry')}
            ${stat('prof.deepest', loc('common.metres', { n: d.deepest || 0 }))}
            ${stat('prof.runs', loc('prof.runsValue', { n: d.runs, d: d.dailies }))}
          </div>
          ${this.accountBlock(st.acct)}
          <div class="scores">
            <div class="score-head">${loc('prof.recent')}</div>
            ${recent || `<div class="score-empty">${loc('prof.noRuns')}</div>`}
          </div>`;
        if (!st.editing && st.err) body = `<div class="name-err">${st.err}</div>` + body;
      }

      // Both destructive buttons wait at the bottom, each behind a second tap.
      const ach = this.achCount();
      const danger = st.confirmWipe ? `
          <div class="note danger">${loc('prof.wipeBody')}</div>
          <button class="btn quit" id="wipeYes">${loc('prof.wipeYes')}</button>
          <button class="btn ghost" id="wipeNo">${loc('prof.cancel')}</button>`
        : st.confirmDelete ? `
          <div class="note danger">${loc('prof.deleteBody')}</div>
          <button class="btn quit" id="deleteYes" ${st.busy ? 'disabled' : ''}>${loc('prof.deleteYes')}</button>
          <button class="btn ghost" id="deleteNo">${loc('prof.cancel')}</button>`
        : `<div class="btn-row${d ? '' : ' one'}">
            <button class="btn ghost quit" id="wipeBtn">${loc('prof.wipe')}</button>
            ${d ? `<button class="btn ghost quit" id="deleteBtn">${loc('prof.delete')}</button>` : ''}
          </div>`;

      this.show(`
        <h2>${loc('prof.title')}</h2>
        ${pending ? `<div class="sub">${loc('prof.pending', { n: pending })}</div>` : ''}
        ${body}
        <button class="btn ach-btn" id="achBtn">
          <span>${loc('prof.achievements')}</span><span class="ach-count">${ach.n} / ${ach.max}</span>
        </button>
        ${this.scoreBoard()}
        <div class="danger-zone">${danger}</div>
        ${this.backButton()}
        ${this.langButton()}
        ${this.privacyLink()}
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
      this.on('#achBtn', () => this.open(() => this.achievements()));
      this.on('#wipeBtn', () => { st.confirmWipe = true; st.confirmDelete = false; draw(); });
      this.on('#wipeNo', () => { st.confirmWipe = false; draw(); });
      this.on('#wipeYes', wipe);
      this.on('#deleteBtn', () => { st.confirmDelete = true; st.confirmWipe = false; st.err = ''; draw(); });
      this.on('#deleteNo', () => { st.confirmDelete = false; draw(); });
      this.wirePrivacy();
      this.on('#deleteYes', remove);
      this.on('#linkBtn', link);
      this.on('#switchYes', switchOver);
      this.on('#switchNo', () => { st.acct.cred = null; draw(); });
      this.wireBack();
      this.wireLang();
    };
    draw();
    load();
  }

  /**
   * "Save your progress" on the profile: the sign-in button for this
   * platform, the account it is linked to, or the switch-profile prompt.
   * Nothing at all where sign-in isn't offered (the browser, or Android
   * before a Google client ID is configured).
   */
  accountBlock(a) {
    const provider = Account.provider();
    if (!provider) return '';
    const name = loc(provider === 'apple' ? 'acct.apple' : 'acct.google');
    let body;
    if (a.linked) {
      body = `<div class="acct-linked">✓ ${loc('acct.linked', { p: loc(a.linked.provider === 'apple' ? 'acct.pApple' : 'acct.pGoogle') })}
        ${a.linked.email ? `<span class="acct-email">${esc(a.linked.email)}</span>` : ''}</div>`;
    } else if (a.cred) {
      body = `<div class="note">${loc('acct.existsBody', { p: name })}</div>
        <div class="btn-row">
          <button class="btn" id="switchYes" ${a.busy ? 'disabled' : ''}>${loc('acct.switch')}</button>
          <button class="btn ghost" id="switchNo">${loc('prof.cancel')}</button>
        </div>`;
    } else {
      const logo = provider === 'apple'
        ? '<span class="sso-logo apple">\uF8FF</span>'
        : '<svg class="sso-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
      body = `<div class="name-rules">${loc('acct.why')}</div>
        <button class="sso ${provider}" id="linkBtn" ${a.busy ? 'disabled' : ''}>${logo}<span>${a.busy ? loc('acct.busy') : name}</span></button>`;
    }
    return `<div class="scores acct">
      <div class="score-head">${loc('acct.title')}</div>
      ${body}
      ${a.err ? `<div class="name-err">${a.err}</div>` : ''}
    </div>`;
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
    const key = o.state === 'sent' ? (o.rank ? (game.campaign.daily ? 'sum.dailyRank' : 'sum.globalRank') : 'sum.uploaded')
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

    // One buy button, four states: MAX, FULL, too dear (red price), or buyable.
    const gem = '<svg class="gem" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l4.5 4L6 11 1.5 5z" fill="currentColor"/></svg>';
    const buy = (attr, cost, state) => {
      const label = state === 'max' ? loc('shop.max') : state === 'full' ? loc('shop.full') : gem + fmt(cost);
      return `<button class="buy ${state || ''}" ${attr} ${state ? 'disabled' : ''}>${label}</button>`;
    };
    const row = (icon, name, desc, extra, button) => `
      <div class="shop-item">
        <div class="ico">${SHOP_ICONS[icon] || ''}</div>
        <div class="info">${name}<div class="ds">${desc}</div>${extra}</div>
        ${button}
      </div>`;

    const supplies = !inRun ? '' : [
      row('supplyDynamite', `<div class="nm">${loc('supply.dynamite.name')}</div>`,
        loc('supply.dynamite.desc', { cur: p.dynamite, max: p.dynMax }), '',
        buy('data-dyn="1"', S.dynamiteCost,
          p.dynamite >= p.dynMax ? 'full' : cash < S.dynamiteCost ? 'poor' : '')),
      row('supplyHeal', `<div class="nm">${loc('supply.heal.name')}</div>`,
        loc('supply.heal.desc', { cur: p.health, max: p.maxHealth }), '',
        buy('data-heal="1"', S.healCost,
          p.health >= p.maxHealth ? 'full' : cash < S.healCost ? 'poor' : '')),
    ].join('');

    const items = CFG.upgrades.map(u => {
      const lvl = game.campaign.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = game.upgradeCost(u, lvl);
      const pips = Array.from({ length: u.max }, (_, i) =>
        `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('');
      return row(u.id,
        `<div class="nm-row"><span class="nm">${loc('up.' + u.id + '.name')}</span>` +
          (u.max > 1 ? `<span class="lv">${loc('shop.level', { n: lvl, max: u.max })}</span>` : '') + '</div>',
        loc('up.' + u.id + '.desc', game.upgradeDescParams(u, lvl)),
        `<div class="pips">${pips}</div>`,
        buy(`data-up="${u.id}"`, cost, maxed ? 'max' : cash < cost ? 'poor' : ''));
    }).join('');

    // Header and the way out stay put; only the list between them scrolls.
    this._repaint = () => this.shop(game, o);
    this.show(`
      ${this.langButton()}
      <div class="shop-head">
        <h2>${res(o.title, 'shop.supplyLantern')}</h2>
        <div class="sub">${res(o.sub, 'shop.paysFromCarry')}</div>
        ${o.note ? `<div class="note">${res(o.note)}</div>` : ''}
        <div class="stats">
          <div class="stat"><div class="k">${loc('hud.carrying')}</div><div class="v carry">${fmt(cash)}</div></div>
          <div class="stat"><div class="k">${loc('shop.depth')}</div><div class="v">${loc('score.mineDepth', { n: game.campaign.mine, d: game.depth() })}</div></div>
        </div>
      </div>
      <div class="shop-scroll">
        ${supplies ? `<div class="shop-section">${loc('shop.supplies')}</div><div class="shop-list">${supplies}</div>` : ''}
        <div class="shop-section">${loc('shop.upgrades')}</div>
        <div class="shop-list">${items}</div>
      </div>
      <div class="shop-foot">
        <button class="btn" id="closeShop">${res(o.closeLabel, 'shop.back')}</button>
        ${o.extra ? res(o.extra) : ''}
      </div>
    `, 'shop');
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
    const daily = !!c.daily;
    const nextMine = isWin && !daily;      // a daily is one mine: escaping it ends the attempt
    const title = isWin ? loc('sum.escaped') : kind === 'abandon' ? loc('sum.quit') : isDeath ? loc('sum.died') : loc('sum.complete');
    const sub = daily && isWin ? loc('sum.dailyConquered')
      : isWin ? loc('sum.nextMine', { n: c.mine + 1 })
      : isDeath ? (s.lost > 0 ? loc('sum.lootLost', { v: fmt(s.lost) }) : loc('sum.nothingLost'))
      : loc('sum.hauledOut');

    const r = c.result || null;
    const dayBest = daily && game.save.daily && game.save.daily.date === c.daily ? game.save.daily.best : 0;
    const note = daily ? (c.dailyRecord ? loc('sum.dailyRecord') : '')
      : isDeath && c.mine > 1 && c.score > 0 ? loc('sum.escapedKept')
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
        ${line(nextMine ? 'sum.scoreSoFar' : 'sum.finalScore', fmt(c.score), 'total')}
      </div>`;

    this._repaint = () => this.summary(game, kind);
    this.show(`
      <h2>${title}</h2>
      <div class="sub">${sub}</div>
      ${note ? `<div class="note">${note}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="k">${loc(nextMine ? 'sum.hauledThisMine' : 'sum.score')}</div><div class="v gold">${fmt(nextMine ? s.hauled : c.score)}</div></div>
        ${daily
          ? `<div class="stat"><div class="k">${loc('sum.dailyBest')}</div><div class="v carry">${fmt(dayBest)}</div></div>`
          : `<div class="stat"><div class="k">${loc('sum.mine')}</div><div class="v">${c.mine}</div></div>`}
        <div class="stat"><div class="k">${loc('title.deepest')}</div><div class="v">${loc('common.metres', { n: c.depth })}</div></div>
        <div class="stat"><div class="k">${loc('sum.gems')}</div><div class="v carry">${c.gems}</div></div>
      </div>
      ${ledger}
      ${Online.enabled ? `<div class="online-line" id="onlineLine">${this.onlineLine(game)}</div>` : ''}
      ${isWin || daily ? '' : this.scoreBoard(r ? r.id : 0)}
      ${daily
        ? `<button class="btn" id="dailyAgainBtn">${loc('sum.dailyAgain')}</button>
           <button class="btn ghost" id="menuBtn">${loc('sum.menu')}</button>`
        : isWin
        ? `<div class="note">${loc('sum.gearCarries')}</div>
           <button class="btn" id="nextBtn">${loc('sum.descend', { n: c.mine + 1 })}</button>
           <button class="btn ghost" id="retireBtn">${loc('sum.retire')}</button>`
        : `<button class="btn" id="againBtn">${loc('sum.newCampaign')}</button>
           <button class="btn ghost" id="menuBtn">${loc('sum.menu')}</button>`}
      ${this.onlineButtons()}
      ${this.langButton()}
    `);
    this.on('#nextBtn', () => game.nextMine());
    this.on('#retireBtn', () => this.summary(game, 'cashout'));
    this.on('#againBtn', () => game.newCampaign());
    this.on('#dailyAgainBtn', () => game.newCampaign(false, 'daily'));
    this.on('#menuBtn', () => game.toTitle());
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
        <div class="sub">${loc(opts.bodyKey || 'confirm.leaveBody')}</div>
        <div class="stats">
          <div class="stat"><div class="k">${loc('shop.depth')}</div>
            <div class="v">${loc('score.mineDepth', { n: game.campaign.mine, d: game.depth() })}</div></div>
          <div class="stat"><div class="k">${loc('hud.carrying')}</div>
            <div class="v carry">${fmt(game.carryValue())}</div></div>
        </div>
        <button class="btn" id="stayBtn">${loc('confirm.stay')}</button>
        <button class="btn quit" id="leaveBtn">${loc('confirm.leave')}</button>
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

  /**
   * The one-time revive offer. It declines itself when the countdown runs
   * out, so a player who looks away is never left on a frozen screen.
   * `opts.onWatch` / `opts.onDecline` are called at most once between them.
   */
  revive(game, opts) {
    let left = CFG.revive.offer;
    let state = 'offer';                 // offer | ad | done
    const carry = game.carryValue();

    const finish = (fn) => {
      if (state === 'done') return;
      clearInterval(timer);
      state = 'done';
      fn();
    };
    const timer = setInterval(() => {
      if (state !== 'offer') return;
      left -= 1;
      const el = this.el.panelInner.querySelector('#reviveCount');
      if (el) el.textContent = Math.max(0, left);
      if (left <= 0) finish(opts.onDecline);
    }, 1000);

    const draw = () => {
      this._repaint = draw;
      this.show(`
        <h2>${loc('revive.title')}</h2>
        <div class="sub">${carry > 0 ? loc('revive.subCarry', { v: fmt(carry) }) : loc('revive.sub')}</div>
        ${state === 'ad'
          ? `<div class="note">${loc('revive.loading')}</div>`
          : `<div class="revive-count" id="reviveCount">${Math.max(0, left)}</div>
             <button class="btn daily" id="reviveYes"><span class="daily-k">${loc('revive.watch')}</span>
               <span class="daily-v">${loc('revive.once')}</span></button>
             <button class="btn ghost" id="reviveNo">${loc('revive.decline')}</button>`}
        ${this.langButton()}
      `);
      this.on('#reviveYes', () => {
        if (state !== 'offer') return;
        state = 'ad';
        clearInterval(timer);
        draw();
        opts.onWatch();
      });
      this.on('#reviveNo', () => finish(opts.onDecline));
      this.wireLang();
    };
    draw();
  }

  pause(game) {
    const onOff = (v) => loc(v ? 'common.on' : 'common.off');
    this._repaint = () => this.pause(game);
    this.show(`
      ${this.langButton()}
      <h2>${loc('pause.title')}</h2>
      <div class="sub">${loc('pause.sub', { d: game.depth(), v: fmt(game.carryValue()) })}</div>
      ${Native.app && CFG.ads.test ? `<div class="note">${loc('pause.adsStatus', { s: esc(Ads.status) })}</div>` : ''}
      <button class="btn" id="resumeBtn">${loc('pause.resume')}</button>
      <div class="btn-row">
        <button class="btn ghost" id="audioBtn">${loc('pause.sound', { s: onOff(Sfx.enabled) })}</button>
        <button class="btn ghost" id="musicBtn">${loc('pause.music', { s: onOff(Music.enabled) })}</button>
      </div>
      <button class="btn ghost" id="shakeBtn">${loc('pause.shake', { s: onOff(game.save.shake !== false) })}</button>
      <button class="btn ghost quit" id="quitBtn">${loc('pause.quit')}</button>
    `);
    this.on('#resumeBtn', () => game.closePanel());
    this.on('#audioBtn', () => { game.toggleAudio(); this.pause(game); });
    this.on('#musicBtn', () => { game.toggleMusic(); this.pause(game); });
    this.on('#shakeBtn', () => { game.toggleShake(); this.pause(game); });
    this.on('#quitBtn', () => this.confirmQuit(game));
    this.wireLang();
  }

  /**
   * "Quit this run?" — a second tap between the pause menu and losing every
   * gem in the pockets. Staying puts the pause menu back.
   */
  confirmQuit(game) {
    const c = game.campaign;
    const body = loc(c.daily ? 'confirm.quitDaily' : 'confirm.quitBody') +
      (!c.daily && c.score > 0 ? ' ' + loc('confirm.quitKept') : '');
    this._repaint = () => this.confirmQuit(game);
    this.show(`
      ${this.langButton()}
      <h2>${loc('confirm.quitTitle')}</h2>
      <div class="sub">${body}</div>
      <div class="stats">
        <div class="stat"><div class="k">${loc('shop.depth')}</div>
          <div class="v">${loc('score.mineDepth', { n: c.mine, d: game.depth() })}</div></div>
        <div class="stat"><div class="k">${loc('hud.carrying')}</div>
          <div class="v carry">${fmt(game.carryValue())}</div></div>
      </div>
      <button class="btn" id="stayBtn">${loc('confirm.stay')}</button>
      <button class="btn quit" id="quitGo">${loc('confirm.quitGo')}</button>
    `);
    this.on('#stayBtn', () => this.pause(game));
    this.on('#quitGo', () => game.endRun('abandon'));
    this.wireLang();
  }
}

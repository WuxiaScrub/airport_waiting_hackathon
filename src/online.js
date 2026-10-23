/* ============================================================================
 * Online — the optional Supabase layer: an anonymous account, an outbox of
 * finished runs, and the leaderboard / profile reads.
 *
 * THE RULE: nothing here may block or break a run. Every call resolves (never
 * rejects) to { ok: true, data } or { ok: false, error, offline }, and the game
 * carries on exactly the same whether the network is fast, slow, or gone.
 *
 * Runs go into a local outbox first and are uploaded from there, so a run
 * finished on a plane uploads when the phone lands. Uploads are idempotent on
 * the server (keyed by client_run_id), so retrying is always safe, and an
 * endless campaign simply replaces its outbox entry as it escapes mine after
 * mine.
 *
 * Errors from the database arrive as short codes (`name_taken`,
 * `update_required`, …) — see supabase/migrations/001_core.sql. The UI turns
 * them into words through i18n.
 * ========================================================================== */

const Online = {
  client: null,
  enabled: false,
  updateRequired: false,
  outboxKey: 'forevermine.outbox.v1',
  cacheKey: 'forevermine.boards.v1',
  _auth: null,            // in-flight sign-in, so concurrent callers share it
  _flushing: false,
  _retryTimer: 0,
  _retryDelay: 5000,

  // A run the server refused for good. Retrying would only be refused again.
  dropCodes: ['bad_run', 'stale_daily', 'implausible_score', 'too_fast', 'update_required'],

  init() {
    const o = CFG.online;
    if (!o || !o.url || !o.key || typeof supabase === 'undefined') return;
    try {
      this.client = supabase.createClient(o.url, o.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'forevermine.auth.v1',
          // Native Preferences inside the app; localStorage in the browser.
          ...(Native.authStorage() ? { storage: Native.authStorage() } : {}),
        },
        global: { fetch: (url, opts) => this.fetchWithTimeout(url, opts) },
      });
      this.enabled = true;
    } catch (e) {
      console.warn('[online] disabled:', e);
      return;
    }

    window.addEventListener('online', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.flush(); });
    this.checkVersion();
    this.flush();
  },

  /** A dead connection must not hang a request (and a spinner) forever. */
  fetchWithTimeout(url, opts) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    return fetch(url, Object.assign({}, opts, { signal: ctl.signal }))
      .finally(() => clearTimeout(t));
  },

  online() { return this.enabled && navigator.onLine !== false; },

  /** The current session, signing in anonymously the first time. */
  ensureSession() {
    if (!this.online()) return Promise.resolve(null);
    if (this._auth) return this._auth;
    this._auth = (async () => {
      try {
        const got = await this.client.auth.getSession();
        if (got.data && got.data.session) return got.data.session;
        const res = await this.client.auth.signInAnonymously();
        if (res.error) throw res.error;
        return res.data.session;
      } catch (e) {
        console.warn('[online] sign-in failed:', e && e.message);
        return null;
      } finally {
        this._auth = null;
      }
    })();
    return this._auth;
  },

  /** Call a database function. Always resolves; see THE RULE above. */
  async rpc(name, args, needsAuth) {
    if (!this.online()) return { ok: false, offline: true, error: 'offline' };
    if (needsAuth && !(await this.ensureSession())) {
      return { ok: false, offline: !navigator.onLine, error: 'not_signed_in' };
    }
    try {
      const res = await this.client.rpc(name, args || {});
      if (res.error) {
        const msg = res.error.message || '';
        // Our own codes are single snake_case words. Status 0 means the
        // request never got an answer; anything else is the platform (a
        // missing function, a permission, a SQL error). Both are worth
        // trying again later, but only the first is "offline".
        const code = /^[a-z_]+$/.test(msg) ? msg : res.status === 0 ? 'network' : 'server';
        if (code === 'server') console.warn('[online] ' + name + ' failed:', res.status, res.error.code, msg);
        if (code === 'update_required') this.updateRequired = true;
        return { ok: false, offline: code === 'network', error: code };
      }
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: false, offline: true, error: 'network' };
    }
  },

  async checkVersion() {
    if (!this.online()) return;
    try {
      const res = await this.client.from('app_config').select('value').eq('key', 'min_game_version').maybeSingle();
      const min = res.data && res.data.value;
      if (typeof min === 'string') this.updateRequired = !versionAtLeast(CFG.online.gameVersion, min);
    } catch (e) { /* offline — try again next launch */ }
  },

  /* ---------------------------------------------------------------- outbox */

  readOutbox() {
    try {
      const o = JSON.parse(localStorage.getItem(this.outboxKey) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch (e) { return {}; }
  },

  writeOutbox(o) {
    try { localStorage.setItem(this.outboxKey, JSON.stringify(o)); } catch (e) { /* private mode */ }
  },

  pending() { return Object.keys(this.readOutbox()).length; },

  /**
   * Queue a finished run (or an endless campaign's latest state) and try to
   * upload it. Resolves to the rpc result for this run, or { queued } when it
   * is waiting for the network.
   */
  submitRun(run) {
    const box = this.readOutbox();
    box[run.client_run_id] = run;
    this.writeOutbox(box);
    return this.flush(run.client_run_id);
  },

  /** Upload everything queued. `want` is a run id whose result to return. */
  async flush(want) {
    if (this._flushing || !this.online()) return { ok: false, queued: true, offline: !this.online() };
    this._flushing = true;
    let mine = { ok: false, queued: true };
    let retry = false;
    try {
      const box = this.readOutbox();
      for (const id of Object.keys(box)) {
        const res = await this.rpc('submit_run', { run: box[id] }, true);
        if (res.ok || this.dropCodes.indexOf(res.error) >= 0) {
          const now = this.readOutbox();
          // Only clear it if a newer state of the same run hasn't arrived meanwhile.
          if (now[id] && now[id].score === box[id].score) { delete now[id]; this.writeOutbox(now); }
          if (!res.ok) console.warn('[online] run refused:', res.error);
        } else {
          retry = true;
        }
        if (id === want) mine = res.ok ? res : { ok: false, queued: !this.dropCodes.includes(res.error), error: res.error };
      }
    } finally {
      this._flushing = false;
    }

    clearTimeout(this._retryTimer);
    if (retry) {
      this._retryTimer = setTimeout(() => this.flush(), this._retryDelay);
      this._retryDelay = Math.min(this._retryDelay * 2, 5 * 60 * 1000);
    } else {
      this._retryDelay = 5000;
    }
    return mine;
  },

  /* ----------------------------------------------------------------- reads */

  /**
   * A board read that falls back to the last good copy when offline, so the
   * screen still shows something. `cached: true` marks stale data.
   */
  async board(key, name, args, needsAuth) {
    const res = await this.rpc(name, args, needsAuth);
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(this.cacheKey) || '{}') || {}; } catch (e) { cache = {}; }
    if (res.ok) {
      cache[key] = { at: Date.now(), data: res.data };
      try { localStorage.setItem(this.cacheKey, JSON.stringify(cache)); } catch (e) { /* full */ }
      return res;
    }
    if (cache[key]) return { ok: true, cached: true, data: cache[key].data, error: res.error };
    return res;
  },

  endlessTop(n) { return this.board('endless', 'endless_top', { n: n || 50 }, true); },
  hardcoreTop(n) { return this.board('hardcore', 'hardcore_top', { n: n || 50 }, true); },

  /** `d` is a 'YYYY-MM-DD' UTC date. */
  dailyTop(d, n) { return this.board('daily:' + d, 'daily_top', { d, n: n || 50 }, true); },

  myRanks() { return this.board('ranks', 'my_ranks', {}, true); },
  myProfile() { return this.board('profile', 'my_profile', {}, true); },

  /** After a sign-in changes who this device is, cached boards are stale. */
  forgetCache() {
    try { localStorage.removeItem(this.cacheKey); } catch (e) { /* private mode */ }
  },

  setName(name) { return this.rpc('set_display_name', { new_name: name }, true); },

  /** Delete the account server-side, then forget it here. */
  async deleteAccount() {
    const res = await this.rpc('delete_my_account', {}, true);
    if (!res.ok) return res;
    try { await this.client.auth.signOut({ scope: 'local' }); } catch (e) { /* already gone */ }
    try {
      localStorage.removeItem(this.outboxKey);
      localStorage.removeItem(this.cacheKey);
    } catch (e) { /* private mode */ }
    return res;
  },
};

/** UTC calendar date as 'YYYY-MM-DD', `offsetDays` from today. */
function utcDate(offsetDays) {
  return new Date(Date.now() + (offsetDays || 0) * 86400000).toISOString().slice(0, 10);
}

/**
 * The daily mine's world seed. Same date + same generator version = same mine
 * for everyone (FNV-1a over a fixed string). Bumping CFG.online.genVersion
 * deliberately changes every daily, so it must ship with any change to
 * world generation — and with the matching app_config.gen_version.
 */
function dailySeed(date) {
  const s = 'forevermine-daily|' + date + '|' + CFG.online.genVersion;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** '1.2.10' >= '1.2.9' */
function versionAtLeast(v, min) {
  const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
}

/** RFC 4122 v4 id for a run, made on the device. */
function newRunId() {
  if (crypto.randomUUID) return crypto.randomUUID();   // needs a secure context
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

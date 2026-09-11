/* ============================================================================
 * Highscore — the ledger of hauls that actually made it out of the mine.
 *
 * A score is the gold a single run BANKED: wealth secured at a lantern or the
 * surface camp. Gems still in the miner's pockets when the lava caught them
 * never count, which is the whole point — the board rewards cashing out.
 *
 * Only the personal board exists today, and it is stored in localStorage under
 * its own key so it survives a save wipe policy change. A GLOBAL board is meant
 * to drop straight in on top of it: register a backend with
 *
 *   Highscore.useBackend({
 *     name: 'my-board',
 *     submit(entry)  -> Promise<void>   // entry is the shape written below
 *     top(n)         -> Promise<entry[]>
 *   });
 *
 * ...and every finished run is handed to it alongside the local write, while
 * Highscore.globalTop(n) returns a promise the UI can render. Nothing else in
 * the game needs to know. There is deliberately no network code in this file:
 * the game is a static site, and a board that is down must never break a run.
 * ========================================================================== */

const Highscore = {
  key: 'deepcut.scores.v1',
  keep: 5,                 // rows the personal board holds
  entries: null,           // lazily loaded
  backend: null,           // global board, if one was ever registered

  /* ------------------------------------------------------------- personal */

  load() {
    if (this.entries) return this.entries;
    this.entries = [];
    try {
      const raw = localStorage.getItem(this.key);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        this.entries = arr
          .filter(e => e && isFinite(e.value) && e.value > 0)
          .map(e => this.clean(e))
          .sort(this.byValue)
          .slice(0, this.keep);
      }
    } catch (e) { this.entries = []; }   // corrupt or private mode — start fresh
    return this.entries;
  },

  /** Never trust what came out of storage; a hand-edited row must not crash UI. */
  clean(e) {
    const int = (v) => Math.max(0, Math.round(Number(v) || 0));
    return {
      id: int(e.id),
      value: int(e.value),
      depth: int(e.depth),
      gems: int(e.gems),
      kind: typeof e.kind === 'string' ? e.kind : 'run',
      at: int(e.at),
    };
  },

  byValue(a, b) { return b.value - a.value || b.at - a.at; },

  persist() {
    try { localStorage.setItem(this.key, JSON.stringify(this.entries)); } catch (e) { /* private mode */ }
  },

  list() { return this.load(); },
  best() { const l = this.load(); return l.length ? l[0].value : 0; },

  /**
   * Record a finished run. `run` is { value, depth, gems, kind }.
   * Returns { id, rank, record } when the haul made the board, or null when it
   * did not — an empty-handed run is not a score and never clutters the list.
   */
  submit(run) {
    const value = Math.max(0, Math.round(run.value || 0));
    if (value <= 0) return null;

    const list = this.load();
    const prevBest = list.length ? list[0].value : 0;
    const entry = this.clean({
      // Unique enough for "is this the row I just set?" — it is never a key.
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      value, depth: run.depth, gems: run.gems, kind: run.kind, at: Date.now(),
    });

    list.push(entry);
    list.sort(this.byValue);
    const rank = list.indexOf(entry) + 1;
    if (list.length > this.keep) list.length = this.keep;
    this.persist();
    this.push(entry);

    return { id: entry.id, rank: rank <= this.keep ? rank : 0, record: value > prevBest };
  },

  reset() { this.entries = []; this.persist(); },

  /* --------------------------------------------------------------- global */

  useBackend(b) { this.backend = b || null; },

  /** Fire-and-forget. A board that is slow, down, or absent changes nothing. */
  push(entry) {
    const b = this.backend;
    if (!b || typeof b.submit !== 'function') return;
    try { Promise.resolve(b.submit(entry)).catch(() => {}); } catch (e) { /* ignore */ }
  },

  /** Promise of the global top N, or null when no backend is registered. */
  globalTop(n) {
    const b = this.backend;
    if (!b || typeof b.top !== 'function') return null;
    try { return Promise.resolve(b.top(n || this.keep)).catch(() => []); }
    catch (e) { return null; }
  },
};

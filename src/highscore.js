/* ============================================================================
 * Highscore — the ledger of hauls that actually made it out of the mine.
 *
 * A score is what a CAMPAIGN carried out of the mines, less whatever it spent
 * at the lanterns on the way. Gems still in the miner's pockets when the lava
 * caught them never count — the board rewards getting out. A campaign writes
 * one row and updates it as it escapes mine after mine.
 *
 * This is the PERSONAL board, kept on the device. The global boards live on
 * the server (see src/online.js) and are fed separately by Game.submitOnline,
 * so a board that is down can never touch this one.
 *
 * Hardcore campaigns keep a board of their own: their hauls carry a bonus, so
 * mixing them in would bury every normal run.
 * ========================================================================== */

const Highscore = {
  keys: { endless: 'forevermine.scores.v1', hardcore: 'forevermine.scores.hardcore.v1' },
  legacyKey: 'deepcut.scores.v1',   // the game's working title (endless only)
  keep: 5,                 // rows each personal board holds
  entries: {},             // by mode, lazily loaded

  /* ------------------------------------------------------------- personal */

  /** `mode` is 'endless' (the default) or 'hardcore'. */
  load(mode) {
    const m = mode === 'hardcore' ? 'hardcore' : 'endless';
    if (this.entries[m]) return this.entries[m];
    this.entries[m] = [];
    try {
      const raw = localStorage.getItem(this.keys[m]) || (m === 'endless' ? localStorage.getItem(this.legacyKey) : null);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        this.entries[m] = arr
          .filter(e => e && isFinite(e.value) && e.value > 0)
          .map(e => this.clean(e))
          .sort(this.byValue)
          .slice(0, this.keep);
      }
    } catch (e) { this.entries[m] = []; }   // corrupt or private mode — start fresh
    return this.entries[m];
  },

  /** Never trust what came out of storage; a hand-edited row must not crash UI. */
  clean(e) {
    const int = (v) => Math.max(0, Math.round(Number(v) || 0));
    return {
      id: int(e.id),
      value: int(e.value),
      depth: int(e.depth),
      gems: int(e.gems),
      mine: Math.max(1, int(e.mine)),
      kind: typeof e.kind === 'string' ? e.kind : 'run',
      at: int(e.at),
    };
  },

  byValue(a, b) { return b.value - a.value || b.at - a.at; },

  persist(mode) {
    const m = mode === 'hardcore' ? 'hardcore' : 'endless';
    try { localStorage.setItem(this.keys[m], JSON.stringify(this.load(m))); } catch (e) { /* private mode */ }
  },

  list(mode) { return this.load(mode); },
  best(mode) { const l = this.load(mode); return l.length ? l[0].value : 0; },

  /**
   * Record a result. `run` is { value, depth, gems, mine, kind }. `replaceId`
   * is a row this campaign wrote earlier, which the new one supersedes.
   * `mode` picks the board: 'endless' (the default) or 'hardcore'.
   * Returns { id, rank, record } when the haul made the board, or null when it
   * did not — an empty-handed run is not a score and never clutters the list.
   */
  submit(run, replaceId, mode) {
    const value = Math.max(0, Math.round(run.value || 0));
    if (value <= 0) return null;

    const m = mode === 'hardcore' ? 'hardcore' : 'endless';
    let list = this.load(m);
    if (replaceId) {
      list = this.entries[m] = list.filter(e => e.id !== replaceId);
    }
    const prevBest = list.length ? list[0].value : 0;
    const entry = this.clean({
      // Unique enough for "is this the row I just set?" — it is never a key.
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      value, depth: run.depth, gems: run.gems, mine: run.mine, kind: run.kind, at: Date.now(),
    });

    list.push(entry);
    list.sort(this.byValue);
    const rank = list.indexOf(entry) + 1;
    if (list.length > this.keep) list.length = this.keep;
    this.persist(m);

    return { id: entry.id, rank: rank <= this.keep ? rank : 0, record: value > prevBest };
  },

  reset() {
    for (const m of Object.keys(this.keys)) { this.entries[m] = []; this.persist(m); }
  },
};

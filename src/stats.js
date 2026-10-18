/* ============================================================================
 * Stats & achievements — lifetime counters kept in the save, and the tiered
 * achievements read off them. Like the rest of the save these are records on
 * this device only: they never feed back into a run.
 *
 * Achievements are pure data (CFG.achievements): each names one counter and
 * three thresholds, bronze → silver → gold. Nothing about an achievement is
 * stored — its tier is worked out from the counters whenever it is needed.
 * ========================================================================== */

/** How an enemy died. Lava is the volcano's kill, so no achievement reads it. */
const KILL_CAUSES = ['pick', 'dynamite', 'dirt', 'lava'];

const Stats = {
  blank() {
    const kills = () => ({ pick: 0, dynamite: 0, dirt: 0, lava: 0 });
    return {
      gems: [0, 0, 0, 0],        // mined, by gem type (recovered gems don't count twice)
      hearts: 0,                 // Heartstones carried out of a mine
      kills: { spider: kills(), bat: kills() },
      recovered: 0,              // stolen gems won back from bats
      stolen: 0,                 // gems bats got away with
      dynamite: 0,               // sticks lit
      runs: 0,                   // campaigns + daily attempts finished
      deaths: 0,
      fastest: 0,                // seconds, quickest Heartstone escape from any mine
    };
  },

  /** Whatever a save holds, made into a well-formed counter set. */
  from(raw) {
    const s = this.blank();
    if (!raw || typeof raw !== 'object') return s;
    const n = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
    for (let i = 0; i < s.gems.length; i++) s.gems[i] = n(raw.gems && raw.gems[i]);
    for (const who of ['spider', 'bat']) {
      for (const c of KILL_CAUSES) s.kills[who][c] = n(raw.kills && raw.kills[who] && raw.kills[who][c]);
    }
    for (const k of ['hearts', 'recovered', 'stolen', 'dynamite', 'runs', 'deaths', 'fastest']) s[k] = n(raw[k]);
    return s;
  },

  kills(s, who) {
    const k = s.kills[who];
    return k.pick + k.dynamite + k.dirt + k.lava;
  },

  /** The number an achievement's `stat` names. */
  value(s, key) {
    switch (key) {
      case 'sapphire': return s.gems[0];
      case 'emerald': return s.gems[1];
      case 'ruby': return s.gems[2];
      case 'diamond': return s.gems[3];
      case 'spiders': return this.kills(s, 'spider');
      case 'bats': return this.kills(s, 'bat');
      case 'pickKills': return s.kills.spider.pick + s.kills.bat.pick;
      case 'dynamiteKills': return s.kills.spider.dynamite + s.kills.bat.dynamite;
      case 'dirtKills': return s.kills.spider.dirt + s.kills.bat.dirt;
      default: return s[key] || 0;
    }
  },

  /** Tiers reached, 0–3. A `lower` achievement is a time: under the bar counts. */
  tier(a, s) {
    const v = this.value(s, a.stat);
    let t = 0;
    for (const bar of a.tiers) {
      if (a.lower ? v > 0 && v <= bar : v >= bar) t++;
    }
    return t;
  },

  tiers(s) { return CFG.achievements.map(a => this.tier(a, s)); },
};

/** Tier names, lowest first — they double as the medal colour classes. */
const ACH_TIERS = ['bronze', 'silver', 'gold'];

/* ============================================================================
 * Stats & achievements — lifetime counters kept in the save, and the levelled
 * achievements read off them. Like the rest of the save these are records on
 * this device only: they never feed back into a run.
 *
 * Achievements are pure data (CFG.achievements): each names one counter and
 * a list of thresholds, one per level (I, II, III…). Nothing about an
 * achievement is stored — its level is worked out from the counters whenever
 * it is needed, so adding a level later needs no save migration.
 * ========================================================================== */

/** How an enemy died. Lava is the volcano's kill, so no achievement reads it. */
const KILL_CAUSES = ['pick', 'dynamite', 'dirt', 'lava'];

const Stats = {
  blank() {
    const kills = () => ({ pick: 0, dynamite: 0, dirt: 0, lava: 0 });
    return {
      gems: [0, 0, 0, 0],        // mined, by gem type (recovered gems don't count twice)
      hearts: 0,                 // Heartstones carried out of a mine
      kills: { caveBug: kills(), bat: kills() },
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
    const kills = raw.kills || {};
    // Saves from before the rename count cave bugs under their old name.
    const from = { caveBug: kills.caveBug || kills.spider, bat: kills.bat };
    for (const who of ['caveBug', 'bat']) {
      for (const c of KILL_CAUSES) s.kills[who][c] = n(from[who] && from[who][c]);
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
      case 'caveBugs': return this.kills(s, 'caveBug');
      case 'bats': return this.kills(s, 'bat');
      case 'pickKills': return s.kills.caveBug.pick + s.kills.bat.pick;
      case 'dynamiteKills': return s.kills.caveBug.dynamite + s.kills.bat.dynamite;
      case 'dirtKills': return s.kills.caveBug.dirt + s.kills.bat.dirt;
      default: return s[key] || 0;
    }
  },

  /** Levels reached, 0 to levels.length. A `lower` achievement is a time: under the bar counts. */
  level(a, s) {
    const v = this.value(s, a.stat);
    let n = 0;
    for (const bar of a.levels) {
      if (a.lower ? v > 0 && v <= bar : v >= bar) n++;
    }
    return n;
  },

  levels(s) { return CFG.achievements.map(a => this.level(a, s)); },
};

/** 1 → "I", 4 → "IV". Achievement levels are counted in these. */
function roman(n) {
  const marks = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, m] of marks) while (n >= v) { out += m; n -= v; }
  return out;
}

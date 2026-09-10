/* ============================================================================
 * Small math / RNG / noise helpers. No dependencies, no cleverness.
 * ========================================================================== */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const sign = Math.sign;
const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/** Deterministic, seedable xorshift32. Same seed => same mine, every time. */
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;  x >>>= 0;
    this.s = x;
    return x;
  }
  float() { return this.next() / 4294967296; }
  range(a, b) { return a + this.float() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[Math.floor(this.float() * arr.length)]; }
  /** Weighted index pick from an array of numbers. */
  weighted(w) {
    let total = 0;
    for (let i = 0; i < w.length; i++) total += w[i];
    let r = this.float() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return w.length - 1;
  }
}

/** Stable hash -> [0,1). Used as the lattice for value noise. */
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967296;
}

/** Bilinear value noise. Cheap, smooth enough for cave carving. */
function noise2(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** Two octaves is plenty for a 40-wide mine. */
function fbm2(x, y, seed) {
  return noise2(x, y, seed) * 0.65 + noise2(x * 2.1, y * 2.1, seed ^ 0x5bf03635) * 0.35;
}

/** Snap a direction vector to the nearest cardinal. Grid mining stays legible. */
function cardinal(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return { x: dx >= 0 ? 1 : -1, y: 0 };
  return { x: 0, y: dy >= 0 ? 1 : -1 };
}

/** Format a currency-ish number with thin separators. */
function fmt(n) {
  n = Math.round(n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ============================================================================
 * Sfx — Web Audio synthesis. No asset files. (Music, at the bottom of this
 * file, is the one thing that plays recordings.)
 *
 * Every sound is a named recipe below. To swap in real samples later, replace
 * the body of play() with a buffer lookup keyed by the same names.
 * ========================================================================== */

const Sfx = {
  ctx: null,
  master: null,
  noiseBuf: null,
  enabled: true,
  _rumble: null,

  /** Must be called from a user gesture or mobile browsers keep us muted. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = CFG.audio.master;
    this.master.connect(this.ctx.destination);

    // One second of white noise, reused by every percussive sound.
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? CFG.audio.master : 0;
  },

  _tone(type, freq, endFreq, dur, gain, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq && endFreq !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  _noise(dur, gain, filterType, freq, endFreq, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType; f.Q.value = 1.1;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq && endFreq !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },

  play(name, opt) {
    if (!this.enabled || !this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const v = (opt && opt.v) || 1;
    switch (name) {
      case 'mine':      this._noise(0.10, 0.42 * v, 'bandpass', 900, 260); break;
      case 'break':     this._noise(0.20, 0.50 * v, 'lowpass', 1500, 240);
                        this._tone('triangle', 150, 70, 0.14, 0.14 * v); break;
      case 'clink':     this._tone('square', 1500, 900, 0.05, 0.10 * v);
                        this._noise(0.05, 0.14 * v, 'highpass', 3000, 2200); break;
      case 'gem': {
        const base = 660 + (opt && opt.tier ? opt.tier * 130 : 0);
        this._tone('sine', base, base * 1.5, 0.10, 0.20 * v);
        this._tone('sine', base * 1.5, base * 2.02, 0.16, 0.15 * v, 0.055);
        break;
      }
      case 'bank':
        for (let i = 0; i < 4; i++) this._tone('sine', 520 * Math.pow(1.26, i), 0, 0.24, 0.15, i * 0.075);
        break;
      case 'buy':       this._tone('square', 380, 760, 0.11, 0.15); break;
      case 'ui':        this._tone('square', 520, 660, 0.05, 0.09); break;
      case 'fuse':      this._noise(0.07, 0.10 * v, 'highpass', 5200, 4200); break;
      case 'boom':
        this._noise(0.75, 0.92, 'lowpass', 1400, 60);
        this._tone('sine', 110, 26, 0.62, 0.55);
        this._tone('sawtooth', 220, 40, 0.32, 0.18);
        break;
      case 'place':     this._tone('triangle', 300, 200, 0.07, 0.13); break;
      case 'jump':      this._tone('sine', 300, 520, 0.11, 0.16 * v);
                        this._noise(0.07, 0.10 * v, 'highpass', 2400, 1400); break;
      case 'grip':      this._noise(0.09, 0.22 * v, 'bandpass', 620, 220);
                        this._tone('triangle', 210, 330, 0.07, 0.11 * v); break;
      case 'land':      this._noise(0.13, 0.26 * v, 'lowpass', 700, 160);
                        this._tone('sine', 130, 70, 0.10, 0.13 * v); break;
      case 'hurt':
        this._tone('sawtooth', 300, 90, 0.28, 0.32);
        this._noise(0.20, 0.24, 'lowpass', 900, 200);
        break;
      case 'hit':       this._noise(0.09, 0.30 * v, 'bandpass', 1700, 700); break;
      case 'squish':    this._tone('sawtooth', 420, 100, 0.16, 0.24);
                        this._noise(0.18, 0.26, 'lowpass', 2200, 400); break;
      case 'screech':   this._tone('sawtooth', 1500, 640, 0.20, 0.13);
                        this._tone('square', 1900, 900, 0.14, 0.07, 0.04); break;
      case 'steal':
        this._tone('square', 800, 200, 0.26, 0.24);
        this._tone('sawtooth', 400, 120, 0.30, 0.14, 0.05);
        break;
      case 'alert':
        for (let i = 0; i < 3; i++) this._tone('square', 880, 660, 0.16, 0.16, i * 0.19);
        break;
      case 'awaken':
        this._tone('sawtooth', 60, 28, 2.6, 0.55);
        this._tone('sawtooth', 91, 42, 2.4, 0.34);
        this._noise(2.4, 0.42, 'lowpass', 600, 90);
        for (let i = 0; i < 4; i++) this._tone('square', 220, 110, 0.5, 0.14, i * 0.3);
        break;
      case 'death':
        this._tone('sawtooth', 380, 44, 1.15, 0.42);
        this._noise(0.9, 0.34, 'lowpass', 1200, 90);
        break;
      case 'win':
        [0, 4, 7, 12, 16, 19].forEach((s, i) =>
          this._tone('triangle', 330 * Math.pow(2, s / 12), 0, 0.5, 0.19, i * 0.12));
        break;
      case 'heart':
        this._tone('sine', 160, 640, 0.9, 0.34);
        this._tone('sine', 240, 960, 1.1, 0.22, 0.08);
        break;
    }
  },

  /** Continuous low rumble for the lava. Idempotent. */
  startRumble() {
    if (!this.enabled || !this.ctx || this._rumble) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 150;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.30, c.currentTime + 3);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
    this._rumble = { s, g };
  },

  stopRumble() {
    if (!this._rumble) return;
    try {
      this._rumble.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
      this._rumble.s.stop(this.ctx.currentTime + 0.5);
    } catch (e) { /* already stopped */ }
    this._rumble = null;
  },
};

/* ============================================================================
 * Music — two looping tracks: one for the menus, one for the mine.
 *
 * The files are minutes long, so they stream through <audio> elements rather
 * than being decoded whole into memory. Each element feeds the Sfx context
 * through its own gain, which is what lets the tracks crossfade (iOS ignores
 * an <audio> element's own volume). Music has its own on/off, separate from
 * the sound effects.
 *
 * play() only says which track SHOULD be on; nothing is heard until the first
 * tap unlocks audio (browsers refuse to autoplay sound before one).
 * ========================================================================== */

const Music = {
  els: {},
  gains: {},
  want: null,              // track the game is in: 'menu' | 'game'
  enabled: true,
  unlocked: false,
  ducked: false,           // paused game: the track carries on, quieter
  held: false,             // an ad is playing: silence, and resume after

  /** Switch to `name`. `fromStart` rewinds it if it wasn't already on. */
  play(name, fromStart) {
    if (fromStart && this.want !== name && this.els[name]) this.els[name].currentTime = 0;
    this.want = name;
    this.apply();
  },

  setEnabled(on) { this.enabled = on; this.apply(); },
  duck(on) { this.ducked = on; this.apply(); },
  hold(on) { this.held = on; this.apply(); },

  /** The track that should be audible now, or null. */
  current() { return this.enabled && !this.held && !document.hidden ? this.want : null; },

  /**
   * Called on every tap and key press. The first one is the moment music is
   * allowed to start; after that it only retries a track the browser refused.
   */
  unlock() {
    if (!this.unlocked) {
      Sfx.init();
      this.unlocked = true;
      document.addEventListener('visibilitychange', () => this.apply());
      this.apply();
      return;
    }
    const on = this.current();
    if (on && this.els[on] && this.els[on].paused) { Sfx.init(); this.apply(); }
  },

  track(name) {
    if (this.els[name]) return this.els[name];
    const el = new Audio(CFG.audio.music.tracks[name].src);
    el.loop = true;
    el.preload = 'auto';
    const c = Sfx.ctx;
    if (c && c.createMediaElementSource) {
      const g = c.createGain();
      g.gain.value = 0;
      c.createMediaElementSource(el).connect(g);
      g.connect(c.destination);
      this.gains[name] = g;
    } else {
      el.volume = 0;
    }
    this.els[name] = el;
    return el;
  },

  /** Fade every track toward where it should be right now. */
  apply() {
    if (!this.unlocked) return;
    const M = CFG.audio.music;
    const on = this.current();
    for (const name of Object.keys(M.tracks)) {
      if (name !== on && !this.els[name]) continue;
      const el = this.track(name);
      const vol = name === on ? M.tracks[name].volume * (this.ducked ? M.duck : 1) : 0;
      this.fade(name, vol);
      if (name === on) {
        clearTimeout(el._stop);
        if (el.paused) el.play().catch(() => { /* no gesture yet: the next tap retries */ });
      } else if (!el.paused) {
        clearTimeout(el._stop);
        el._stop = setTimeout(() => { if (this.current() !== name) el.pause(); }, M.fade * 1000 + 100);
      }
    }
  },

  fade(name, vol) {
    const g = this.gains[name], fade = CFG.audio.music.fade;
    if (g) {
      const t = Sfx.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(vol, t + fade);
    } else {
      this.els[name].volume = vol;
    }
  },
};

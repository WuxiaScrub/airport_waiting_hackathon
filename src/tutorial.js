/* ============================================================================
 * Tutorial — the practice mine's script. The mine itself is a fixed map
 * (`CFG.tutorial.map`) played by the ordinary game; this only decides which
 * prompt is on the coach card and when the player has done what it asks.
 *
 * The game reports what happens through notify('swing' | 'blast' | 'fall' |
 * 'gem' | 'shop' | 'heart'). A step is a test run every frame: most count
 * events since the step began, a few look at where the miner is standing, so
 * a player who got ahead of the prompts is never left stuck on one.
 * Prompts live in i18n.js under `tut.<id>`.
 * ========================================================================== */

class Tutorial {
  constructor() {
    this.events = {};    // event -> how many times it has happened this tutorial
    this.mark = {};      // the counts when the previous step was done
    this.step = 0;
    this.pause = 0;      // the tick is showing between two prompts
    this.bug = null;     // the scripted enemies, once spawned
    this.bat = null;
    this.started = false;
    this.deadFor = 0;    // seconds the miner has been down
  }

  /** Something happened in the mine. `info` narrows a swing down to its aim. */
  notify(ev, info) {
    if (ev === 'swing') {
      if (!info.hit) return;
      ev = info.dx && info.dy ? 'diag' : info.dx ? 'side' : 'swing';
    }
    this.events[ev] = (this.events[ev] || 0) + 1;
  }

  count(ev) { return this.events[ev] || 0; }
  since(ev) { return this.count(ev) - (this.mark[ev] || 0); }

  /** The final step is the climb home: reaching the camp before it is a visit, not the end. */
  get onLastStep() { return this.step === Tutorial.STEPS.length - 1; }

  update(dt, game) {
    if (!this.started) { this.started = true; this.begin(game); }
    // A death here is free: after a beat the miner gets up where they fell,
    // pockets intact, and is told what a real run would have taken. Counted
    // in play time, so pausing mid-death can't strand them.
    if (game.player.dead) {
      this.deadFor += dt;
      if (this.deadFor < CFG.tutorial.reviveDelay) return;
      this.deadFor = 0;
      game.revivePlayer();
      game.ui.toast(loc('tut.died'), 3200);
      return;
    }
    if (this.step >= Tutorial.STEPS.length) return;
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.begin(game);
      return;
    }
    const s = Tutorial.STEPS[this.step];
    if (s.keep) s.keep(this, game);
    if (!s.done(this, game)) return;
    Sfx.play('ui', { v: 0.8 });
    game.ui.coachDone();
    this.step++;
    // Counted from here, not from when the next prompt shows: a swing made
    // while the tick is still up belongs to the next step.
    this.mark = Object.assign({}, this.events);
    // The last step has no "done" of its own: the camp ends the tutorial.
    if (this.step < Tutorial.STEPS.length) this.pause = CFG.tutorial.stepPause;
  }

  /** Show the current step's prompt and run whatever it sets up. */
  begin(game) {
    const s = Tutorial.STEPS[this.step];
    if (s.start) s.start(this, game);
    this.show(game);
  }

  /** (Re)draw the coach card — also after a language switch. */
  show(game) {
    if (this.step >= Tutorial.STEPS.length) return;
    game.ui.coach(loc('tut.' + Tutorial.STEPS[this.step].id), this.step + 1, Tutorial.STEPS.length);
  }

  /** Put a scripted enemy on the map marker `key`. */
  spawn(game, key, Kind) {
    const m = game.world.markers[key];
    const e = new Kind(m.x, m.y);
    game.enemies.push(e);
    return e;
  }

  /** Gone from the mine: killed, fled, or wandered out of range. */
  static gone(game, e) { return !e || e.dead || game.enemies.indexOf(e) < 0; }
}

/**
 * The lessons, in the order the map lays them out. `done` is checked every
 * frame; `start` runs as the prompt appears; `keep` runs while it is up.
 */
Tutorial.STEPS = [
  // Walk along the surface.
  { id: 'move', done: (t, g) => Math.abs(g.player.x - g.world.spawnPoint.x) >= 2 || g.player.y > 7 },
  // Dig through the dirt patch in the ground.
  { id: 'dig', done: (t, g) => g.player.y > 7 },
  // A dirt wall across the first room. Its corner tile first, while the wall
  // still stops the miner: a diagonal push walks as well as aims...
  { id: 'diag', done: (t, g) => t.since('diag') > 0 || g.player.y > 11 },
  // ...then straight through it.
  { id: 'side', done: (t, g) => t.since('side') > 0 || g.player.x > 12 || g.player.y > 11 },
  // Up onto the rock ledge (or past it).
  {
    id: 'jump',
    done: (t, g) => {
      const p = g.player;
      return (p.grounded && Math.floor(p.y) === 8 && p.x >= 14) || p.y > 11;
    },
  },
  // Crack the dirt overhead and get out from under it.
  { id: 'collapse', done: (t) => t.since('fall') > 0 },
  // Rock: only dynamite moves it. A player who wasted their sticks gets more.
  {
    id: 'dynamite',
    done: (t) => t.since('blast') > 0,
    keep: (t, g) => {
      const p = g.player;
      if (p.dynamite === 0 && g.dynamites.length === 0) { p.dynamite = p.dynMax; g.ui.syncDynamite(p); }
    },
  },
  // The seam behind the rock. Counted over the whole tutorial: there are only four.
  { id: 'gems', done: (t) => t.count('gem') >= 3 },
  // A bat comes for the best of them.
  {
    id: 'bat',
    start: (t, g) => { t.bat = t.spawn(g, 'V', Bat); },
    done: (t, g) => Tutorial.gone(g, t.bat),
  },
  // The lantern in the room below (or the player is already past it).
  { id: 'lantern', done: (t, g) => t.count('shop') > 0 || g.player.y > 21 },
  // A cave bug in the same room.
  {
    id: 'bug',
    start: (t, g) => { t.bug = t.spawn(g, 'B', CaveBug); },
    done: (t, g) => Tutorial.gone(g, t.bug),
  },
  // Down to the Heartstone.
  { id: 'heart', done: (t) => t.count('heart') > 0 },
  // The climb home. Reaching the camp is what finishes it (Game.reachCamp).
  { id: 'climb', done: () => false },
];

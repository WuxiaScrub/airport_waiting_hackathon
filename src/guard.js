/* ============================================================================
 * ExitGuard — a stray refresh or Back press must not swallow a live run.
 *
 * Nothing about a run in progress is on disk: only banked gold and upgrades are
 * saved, so reloading mid-descent throws away the mine, the climb and every gem
 * still in the miner's pockets. Two browser mechanisms cover the two ways out,
 * both asking the same question — is there a run to lose?
 *
 *   · reload / tab close  → `beforeunload`. Only the browser may draw this one,
 *                           and modern browsers ignore our wording entirely.
 *   · Back button         → a spare history entry the first press lands on, so
 *                           the game stays loaded and asks in its own panel.
 *
 * The spare entry is same-document and reuses the current URL, so the address
 * bar never changes and a bookmark still points at the game.
 * ========================================================================== */

const ExitGuard = {
  game: null,
  armed: false,     // is our spare history entry currently on the stack?
  asking: false,    // the confirm panel is on screen
  leaving: false,   // a confirmed exit is in flight — stop guarding it
  restore: null,    // puts the screen back if that exit never happens

  install(game) {
    this.game = game;

    window.addEventListener('beforeunload', (e) => {
      if (!this.atRisk()) return;
      // Setting returnValue is what arms the browser's own prompt; the text is
      // for the handful of old browsers that still show it.
      e.preventDefault();
      e.returnValue = loc('confirm.leaveBody');
      return e.returnValue;
    });

    window.addEventListener('popstate', () => this.onPop());
    this.sync();
  },

  atRisk() { return !!this.game && this.game.runAtRisk(); },

  /**
   * Keep the spare history entry in step with the run. Called whenever a run
   * starts or ends; cheap and idempotent, so callers never have to think about
   * whether the guard is already up.
   */
  sync() {
    if (this.armed || this.leaving || !this.atRisk()) return;
    try {
      history.pushState({ deepcut: 'guard' }, '', location.href);
      this.armed = true;
    } catch (e) { /* file:// and friends — beforeunload still covers reloads */ }
  },

  /** Back was pressed and our spare entry took the hit. */
  onPop() {
    this.armed = false;
    if (this.leaving) return;
    if (!this.atRisk()) { this.leave(); return; }   // nothing to lose — let them go

    this.sync();                                    // a second press lands here too
    if (this.asking) return;
    this.asking = true;
    this.restore = this.game.ui.confirmLeave({
      onStay: () => { this.asking = false; this.restore = null; },
      onLeave: () => this.leave(),
    });
  },

  /** Finish the navigation the player asked for: past our entry, then the page. */
  leave() {
    this.leaving = true;
    history.go(this.armed ? -2 : -1);
    // If there is nothing behind this page to go back to — opened in a fresh
    // tab, say — that call does nothing at all. Put the mine back rather than
    // stranding the player on a prompt for an exit that never happened, and
    // don't leave the guard switched off for the rest of the session.
    setTimeout(() => {
      this.leaving = false;
      this.asking = false;
      if (this.restore) { this.restore(); this.restore = null; }
      this.sync();
    }, 800);
  },
};

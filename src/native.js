/* ============================================================================
 * Native — the thin layer between the game and the iOS / Android app shell
 * (Capacitor). In a browser every method here is a no-op, so the web preview
 * runs the exact same code.
 *
 * The game has no bundler, so plugins are reached through the vendored
 * Capacitor core (vendor/capacitor-core-*.js): Capacitor.registerPlugin(name)
 * returns a proxy to the native side. Every plugin call is a promise; a
 * failure is logged and ignored — the shell must never take a run down.
 *
 * Two entry points, because they are needed at different times:
 *   Native.detect()       before Online.init — the login lives in native storage
 *   Native.install(game)  once the game exists — back button, app pause/resume
 * ========================================================================== */

const Native = {
  app: false,              // running inside the iOS / Android app
  platform: 'web',         // 'ios' | 'android' | 'web'
  plugins: {},

  detect() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;
    this.app = true;
    this.platform = cap.getPlatform();
    for (const name of ['App', 'Preferences', 'StatusBar', 'SplashScreen', 'AdMob', 'SocialLogin']) {
      this.plugins[name] = cap.registerPlugin(name);
    }
    document.documentElement.classList.add('native', 'native-' + this.platform);
  },

  /** Run a plugin call without letting a failure escape. */
  call(plugin, method, args) {
    const p = this.plugins[plugin];
    if (!p) return Promise.resolve(null);
    try {
      return Promise.resolve(p[method](args)).catch(e => { console.warn('[native]', plugin, method, e); return null; });
    } catch (e) {
      console.warn('[native]', plugin, method, e);
      return Promise.resolve(null);
    }
  },

  install(game) {
    if (!this.app) return;
    this.call('StatusBar', 'hide');
    const app = this.plugins.App;
    app.addListener('backButton', () => this.onBack(game));
    // Backgrounded mid-mine (a call, the home button): pause, never lose time.
    app.addListener('pause', () => { if (game.state === 'play') game.togglePause(); });
    // Back in the app: restart the music, whose audio the system stopped.
    app.addListener('resume', () => { Online.flush(); Music.apply(); });
  },

  /**
   * Android's back button, walked from the most specific screen outwards:
   * close a prompt, step back out of an online panel, offer to leave a live
   * mine, return to the title — and only at the title, leave the app.
   */
  onBack(game) {
    const ui = game.ui;
    const btn = (sel) => ui.isOpen && ui.el.panelInner.querySelector(sel);

    const stay = btn('#stayBtn');                 // the leave prompt is already up
    if (stay) { stay.click(); return; }
    const noRevive = btn('#reviveNo');            // back on the revive offer = no thanks
    if (noRevive) { noRevive.click(); return; }
    if (game.player && game.player.dead) return;  // mid-death or mid-ad: wait for it
    const back = btn('#backBtn');                 // leaderboards / profile
    if (back) { back.click(); return; }

    // The practice mine has nothing to lose: back simply leaves it.
    if (game.tutorial && game.state !== 'over') { game.toTitle(); return; }
    if (game.runAtRisk()) {
      ui.confirmLeave({
        bodyKey: 'confirm.leaveBodyApp',
        onStay: () => {},
        onLeave: () => game.endRun('abandon'),
      });
      return;
    }
    if (game.state === 'over') { game.toTitle(); return; }
    this.call('App', 'exitApp');
  },

  /**
   * Open a web page outside the game. In the app, navigating the main frame
   * to an outside address makes Capacitor hand it to the system browser; in a
   * browser tab, a new tab keeps the game where it was.
   */
  openUrl(url) {
    if (this.app) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  },

  /**
   * Where Supabase keeps the login. WebView localStorage can be cleared by the
   * OS under storage pressure, which would orphan an anonymous account and its
   * medals; native Preferences survive until the app is uninstalled.
   * Returns null in the browser so supabase-js uses localStorage as usual.
   */
  authStorage() {
    if (!this.app) return null;
    return {
      getItem: (key) => this.call('Preferences', 'get', { key }).then(r => (r ? r.value : null)),
      setItem: (key, value) => this.call('Preferences', 'set', { key, value }),
      removeItem: (key) => this.call('Preferences', 'remove', { key }),
    };
  },
};

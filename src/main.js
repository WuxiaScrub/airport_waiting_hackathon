/* ============================================================================
 * Boot. Keep this file boring.
 * ========================================================================== */

(function () {
  function boot() {
    I18N.init();                     // before any panel or HUD label is drawn
    Native.detect();                 // before Online: the login lives in native storage
    Online.init();                   // optional; the game never waits on it
    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    window.game = game;              // handy for tuning from the console
    // Refresh / Back must not eat a live run. In the app there is no page to
    // reload or history to pop — the hardware back button is Native's job.
    if (Native.app) Native.install(game);
    else ExitGuard.install(game);
    Ads.init();                      // app only: consent, then preload the revive ad
    Sfx.setEnabled(game.save.audio !== false);
    game.start();
  }

  // Kill the pinch-zoom / double-tap-zoom that would wreck a canvas game.
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================================
 * Boot. Keep this file boring.
 * ========================================================================== */

(function () {
  function boot() {
    I18N.init();                     // before any panel or HUD label is drawn
    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    window.game = game;              // handy for tuning from the console
    ExitGuard.install(game);         // refresh / Back must not eat a live run
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

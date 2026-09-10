/* ============================================================================
 * Boot. Keep this file boring.
 * ========================================================================== */

(function () {
  function boot() {
    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    window.game = game;              // handy for tuning from the console
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

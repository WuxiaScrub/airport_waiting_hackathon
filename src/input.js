/* ============================================================================
 * Input — a floating virtual joystick + action/tool buttons for touch, with
 * keyboard as the desktop fallback. Exposes one normalised { dir, action }.
 * ========================================================================== */

class Input {
  constructor(game) {
    this.game = game;
    this.dir = { x: 0, y: 0 };
    this.actionHeld = false;
    this._actionEdge = false;

    this.keys = Object.create(null);
    this.stickId = null;
    this.origin = { x: 0, y: 0 };

    this.zone = document.getElementById('stickzone');
    this.base = document.getElementById('stickbase');
    this.knob = document.getElementById('stickknob');
    this.actionBtn = document.getElementById('action');
    this.toolBtns = Array.from(document.querySelectorAll('.tool'));

    this.bindStick();
    this.bindButtons();
    this.bindKeys();
  }

  /** Consume a single action press (used by one-shot tools like dynamite). */
  consumeAction() {
    if (!this._actionEdge) return false;
    this._actionEdge = false;
    return true;
  }

  reset() {
    this.dir.x = 0; this.dir.y = 0;
    this.actionHeld = false;
    this._actionEdge = false;
    this.stickId = null;
    this.base.classList.remove('on');
    this.actionBtn.classList.remove('held');
  }

  /* ------------------------------------------------------------- joystick */

  bindStick() {
    const z = this.zone;
    const radius = 52;

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (this.stickId !== null) return;
      this.stickId = t.identifier !== undefined ? t.identifier : 'mouse';
      this.origin.x = t.clientX; this.origin.y = t.clientY;
      this.base.style.left = t.clientX + 'px';
      this.base.style.top = t.clientY + 'px';
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(0px, 0px)';
      Sfx.init();
      e.preventDefault();
    };

    const move = (e) => {
      if (this.stickId === null) return;
      const t = this.findTouch(e);
      if (!t) return;
      let dx = t.clientX - this.origin.x;
      let dy = t.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, radius);
      const ux = len ? dx / len : 0, uy = len ? dy / len : 0;
      this.knob.style.transform = `translate(${ux * clamped}px, ${uy * clamped}px)`;
      // Dead zone keeps the miner from twitching when a thumb rests on glass.
      const mag = len < 9 ? 0 : Math.min(1, (len - 9) / (radius - 9));
      this.dir.x = ux * mag;
      this.dir.y = uy * mag;
      e.preventDefault();
    };

    const end = (e) => {
      if (this.stickId === null) return;
      if (e.changedTouches && !this.findTouch(e, true)) return;
      this.stickId = null;
      this.dir.x = 0; this.dir.y = 0;
      this.base.classList.remove('on');
      this.knob.style.transform = 'translate(0px, 0px)';
    };

    z.addEventListener('touchstart', start, { passive: false });
    z.addEventListener('touchmove', move, { passive: false });
    z.addEventListener('touchend', end);
    z.addEventListener('touchcancel', end);
    z.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  findTouch(e, changed) {
    const list = changed ? e.changedTouches : (e.touches || e.changedTouches);
    if (!list) return this.stickId === 'mouse' ? e : null;
    for (let i = 0; i < list.length; i++) if (list[i].identifier === this.stickId) return list[i];
    return null;
  }

  /* -------------------------------------------------------------- buttons */

  bindButtons() {
    const press = (on) => (e) => {
      e.preventDefault();
      Sfx.init();
      this.actionHeld = on;
      if (on) this._actionEdge = true;
      this.actionBtn.classList.toggle('held', on);
    };
    const a = this.actionBtn;
    a.addEventListener('touchstart', press(true), { passive: false });
    a.addEventListener('touchend', press(false));
    a.addEventListener('touchcancel', press(false));
    a.addEventListener('mousedown', press(true));
    window.addEventListener('mouseup', () => {
      if (!this.actionHeld) return;
      this.actionHeld = false;
      this.actionBtn.classList.remove('held');
    });
    a.addEventListener('contextmenu', e => e.preventDefault());

    for (const b of this.toolBtns) {
      const pick = (e) => {
        e.preventDefault();
        Sfx.init();
        this.game.selectTool(parseInt(b.dataset.tool, 10));
      };
      b.addEventListener('touchstart', pick, { passive: false });
      b.addEventListener('mousedown', pick);
    }
  }

  /* ------------------------------------------------------------- keyboard */

  bindKeys() {
    const map = {
      ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
      ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (map[e.code]) e.preventDefault(); return; }
      Sfx.init();
      if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
      else if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'Enter') {
        this.actionHeld = true; this._actionEdge = true; e.preventDefault();
      } else if (e.code === 'Digit1') this.game.selectTool(0);
      else if (e.code === 'Digit2') this.game.selectTool(1);
      else if (e.code === 'KeyQ' || e.code === 'Tab') { this.game.selectTool(this.game.player.tool ^ 1); e.preventDefault(); }
      else if (e.code === 'KeyM') this.game.toggleAudio();
      else if (e.code === 'Escape') this.game.togglePause();
    });
    window.addEventListener('keyup', (e) => {
      if (map[e.code]) this.keys[map[e.code]] = false;
      else if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'Enter') this.actionHeld = false;
    });
    window.addEventListener('blur', () => this.reset());
  }

  /** Fold keyboard state into `dir` — the joystick wins if it is in use. */
  update() {
    if (this.stickId !== null) return;
    const k = this.keys;
    const kx = (k.r ? 1 : 0) - (k.l ? 1 : 0);
    const ky = (k.d ? 1 : 0) - (k.u ? 1 : 0);
    if (kx || ky) {
      const len = Math.hypot(kx, ky);
      this.dir.x = kx / len; this.dir.y = ky / len;
    } else if (!this.dir.locked) {
      this.dir.x = 0; this.dir.y = 0;
    }
  }
}

/* ============================================================================
 * Input — a floating virtual joystick plus three verb buttons (mine, jump,
 * dynamite) for touch, with keyboard as the desktop fallback. There is no tool
 * to select: the button you press is the thing that happens.
 *
 * Exposes one normalised { dir, mineHeld, jumpHeld, + edges } read each step.
 * ========================================================================== */

class Input {
  constructor(game) {
    this.game = game;
    this.dir = { x: 0, y: 0 };
    this.mineHeld = false;
    this.jumpHeld = false;
    this._mineEdge = false;
    this._jumpEdge = false;
    this._dynEdge = false;

    this.keys = Object.create(null);
    this.stickId = null;
    this.origin = { x: 0, y: 0 };

    this.zone = document.getElementById('stickzone');
    this.base = document.getElementById('stickbase');
    this.knob = document.getElementById('stickknob');
    this.aim = document.getElementById('stickaim');
    this.mineBtn = document.getElementById('action');
    this.jumpBtn = document.getElementById('jump');
    this.dynBtn = document.getElementById('dynamite');

    this.bindStick();
    this.bindButtons();
    this.bindKeys();
  }

  /** Consume a single jump press. The player buffers it for a few frames. */
  consumeJump() {
    if (!this._jumpEdge) return false;
    this._jumpEdge = false;
    return true;
  }

  /** Consume a single dynamite press — one stick per tap, never on repeat. */
  consumeDynamite() {
    if (!this._dynEdge) return false;
    this._dynEdge = false;
    return true;
  }

  reset() {
    this.dir.x = 0; this.dir.y = 0;
    this.mineHeld = false;
    this.jumpHeld = false;
    this._mineEdge = false;
    this._jumpEdge = false;
    this._dynEdge = false;
    this.stickId = null;
    this.park();
    this.syncStick();
    for (const b of [this.mineBtn, this.jumpBtn, this.dynBtn]) b.classList.remove('held');
  }

  /* ------------------------------------------------------------- joystick */

  /** Drop the inline anchor so the stick falls back to its parked corner. */
  park() {
    this.base.style.left = '';
    this.base.style.top = '';
  }

  /**
   * Push the current heading into the on-screen stick: the knob shows how hard
   * you are pushing, the arrow shows the snapped 8-way direction the pickaxe
   * will actually swing at. Keyboard input drives it too.
   */
  syncStick() {
    const R = Input.KNOB_TRAVEL;
    const dx = this.dir.x, dy = this.dir.y;
    this.knob.style.transform = `translate(${(dx * R).toFixed(1)}px, ${(dy * R).toFixed(1)}px)`;
    const live = Math.hypot(dx, dy) > 0.12;
    if (live) {
      const a = aimDir(dx, dy);
      const deg = Math.atan2(a.y, a.x) * 180 / Math.PI + 90;
      this.aim.style.transform = `rotate(${deg.toFixed(0)}deg)`;
    }
    this.aim.classList.toggle('on', live);
    // Bright while a thumb is on it or while any input is coming in (keyboard
    // included); dimmed back to a parked outline the rest of the time.
    this.base.classList.toggle('on', this.stickId !== null || live);
  }

  bindStick() {
    const z = this.zone;
    const radius = Input.STICK_RADIUS;

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (this.stickId !== null) return;
      this.stickId = t.identifier !== undefined ? t.identifier : 'mouse';
      this.origin.x = t.clientX; this.origin.y = t.clientY;
      this.base.style.left = t.clientX + 'px';
      this.base.style.top = t.clientY + 'px';
      this.dir.x = 0; this.dir.y = 0;
      this.syncStick();
      Sfx.init();
      e.preventDefault();
    };

    const move = (e) => {
      if (this.stickId === null) return;
      const t = this.findTouch(e);
      if (!t) return;
      const dx = t.clientX - this.origin.x;
      const dy = t.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      const ux = len ? dx / len : 0, uy = len ? dy / len : 0;
      // Dead zone keeps the miner from twitching when a thumb rests on glass.
      const mag = len < 9 ? 0 : Math.min(1, (len - 9) / (radius - 9));
      this.dir.x = ux * mag;
      this.dir.y = uy * mag;
      this.syncStick();
      e.preventDefault();
    };

    const end = (e) => {
      if (this.stickId === null) return;
      if (e.changedTouches && !this.findTouch(e, true)) return;
      this.stickId = null;
      this.dir.x = 0; this.dir.y = 0;
      this.park();
      this.syncStick();
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
    // Mine auto-repeats while held; jump and dynamite fire on the press only.
    this.bindHold(this.mineBtn, 'mineHeld', '_mineEdge');
    this.bindHold(this.jumpBtn, 'jumpHeld', '_jumpEdge');
    this.bindHold(this.dynBtn, '_dynHeld', '_dynEdge');
  }

  /** Wire one hold-style button to a `held` flag plus a rising-edge flag. */
  bindHold(btn, heldKey, edgeKey) {
    const press = (on) => (e) => {
      e.preventDefault();
      Sfx.init();
      this[heldKey] = on;
      if (on) this[edgeKey] = true;
      btn.classList.toggle('held', on);
    };
    btn.addEventListener('touchstart', press(true), { passive: false });
    btn.addEventListener('touchend', press(false));
    btn.addEventListener('touchcancel', press(false));
    btn.addEventListener('mousedown', press(true));
    window.addEventListener('mouseup', () => {
      if (!this[heldKey]) return;
      this[heldKey] = false;
      btn.classList.remove('held');
    });
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ------------------------------------------------------------- keyboard */

  bindKeys() {
    // W/S (and up/down) *aim* rather than move now that gravity owns the
    // vertical axis, so jumping gets its own key: the platformer default.
    const map = {
      ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
      ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
    };
    const isMine = (c) => c === 'KeyJ' || c === 'Enter' || c === 'KeyE';
    const isJump = (c) => c === 'Space' || c === 'KeyK';
    const isDyn = (c) => c === 'KeyF' || c === 'KeyL' || c === 'Digit2';

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (map[e.code] || isJump(e.code)) e.preventDefault(); return; }
      Sfx.init();
      if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
      else if (isJump(e.code)) { this.jumpHeld = true; this._jumpEdge = true; e.preventDefault(); }
      else if (isMine(e.code)) { this.mineHeld = true; this._mineEdge = true; e.preventDefault(); }
      else if (isDyn(e.code)) { this._dynEdge = true; e.preventDefault(); }
      else if (e.code === 'KeyM') this.game.toggleAudio();
      else if (e.code === 'Escape') this.game.togglePause();
    });
    window.addEventListener('keyup', (e) => {
      if (map[e.code]) this.keys[map[e.code]] = false;
      else if (isJump(e.code)) this.jumpHeld = false;
      else if (isMine(e.code)) this.mineHeld = false;
    });
    window.addEventListener('blur', () => this.reset());
  }

  /** Fold keyboard state into `dir` — the joystick wins if it is in use. */
  update() {
    if (this.stickId === null) {
      const k = this.keys;
      const kx = (k.r ? 1 : 0) - (k.l ? 1 : 0);
      const ky = (k.d ? 1 : 0) - (k.u ? 1 : 0);
      if (kx || ky) {
        const len = Math.hypot(kx, ky);
        this.dir.x = kx / len; this.dir.y = ky / len;
      } else {
        this.dir.x = 0; this.dir.y = 0;
      }
      this.syncStick();
    }
  }
}

/** Thumb travel, in CSS pixels, that counts as a full push. */
Input.STICK_RADIUS = 52;
/** How far the drawn knob slides at a full push — it stays inside the ring, so
 *  the aim arrow on the rim is never covered by it. */
Input.KNOB_TRAVEL = 32;

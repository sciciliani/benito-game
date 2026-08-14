// Mobile touch controls: on a detected phone/tablet, adds a rotate-device
// gate (portrait blocks play — real orientation LOCK isn't reliably
// available outside fullscreen/PWA contexts, so this is the actual
// mechanism, not just a nicety), a thumb joystick + action buttons that
// drive the exact same Input key-state the keyboard does (see
// Input.setDown in input.js), and swipe-to-look camera control (feeds
// Input.lookDeltaX/Y, consumed by updateCamera() in main.js). Entirely a
// no-op on desktop — nothing here runs unless isMobileDevice() is true.
(function () {
  function isMobileDevice() {
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
    const touchCapable = (navigator.maxTouchPoints || 0) > 1 || 'ontouchstart' in window;
    return uaMobile || (touchCapable && Math.min(window.innerWidth, window.innerHeight) < 900);
  }

  if (typeof window === 'undefined' || !isMobileDevice()) return;

  document.body.classList.add('mobile-device');

  // --- Rotate-device gate -------------------------------------------------
  const rotateOverlay = document.createElement('div');
  rotateOverlay.id = 'rotateOverlay';
  rotateOverlay.innerHTML = '<div class="rotateIcon">📱</div><div>Girá el teléfono para jugar en horizontal</div>';
  document.body.appendChild(rotateOverlay);

  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }
  function syncOrientation() {
    rotateOverlay.classList.toggle('visible', isPortrait());
  }
  window.addEventListener('resize', syncOrientation);
  window.addEventListener('orientationchange', syncOrientation);
  syncOrientation();

  // Best-effort real lock: only works in some Android/Chrome contexts
  // (usually needs fullscreen or an installed PWA) and silently no-ops
  // everywhere else — the overlay above is the mechanism that's actually
  // reliable across devices.
  document.addEventListener('click', () => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }, { once: true });

  // --- Touch UI: joystick + buttons ---------------------------------------
  const controls = document.createElement('div');
  controls.id = 'mobileControls';
  controls.innerHTML =
    '<div id="joyBase"><div id="joyKnob"></div></div>' +
    '<div id="touchButtons">' +
    '<button id="btnAction" class="touchBtn" type="button">Acción</button>' +
    '<button id="btnAttack" class="touchBtn" type="button">Atacar</button>' +
    '<button id="btnJump" class="touchBtn" type="button">Saltar</button>' +
    '<button id="btnRun" class="touchBtn" type="button">Correr</button>' +
    '<button id="btnSuper" class="touchBtn" type="button">Super</button>' +
    '</div>';
  document.body.appendChild(controls);

  // Joystick: drag distance/direction maps onto the same Arrow key state
  // the keyboard uses — movement is already digital (ix/iz in {-1,0,1} in
  // player.js), so a deadzone-gated direction is the natural fit.
  const joyBase = document.getElementById('joyBase');
  const joyKnob = document.getElementById('joyKnob');
  const JOY_RADIUS = 45, JOY_DEADZONE = 12;
  let joyTouchId = null, joyCenterX = 0, joyCenterY = 0;

  function joyStart(e) {
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    const rect = joyBase.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    e.preventDefault();
  }
  function joyMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      let dx = t.clientX - joyCenterX, dy = t.clientY - joyCenterY;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_RADIUS) {
        dx = (dx / dist) * JOY_RADIUS;
        dy = (dy / dist) * JOY_RADIUS;
      }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      Input.setDown('ArrowLeft', dx < -JOY_DEADZONE);
      Input.setDown('ArrowRight', dx > JOY_DEADZONE);
      Input.setDown('ArrowUp', dy < -JOY_DEADZONE);
      Input.setDown('ArrowDown', dy > JOY_DEADZONE);
      e.preventDefault();
    }
  }
  function joyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      joyTouchId = null;
      joyKnob.style.transform = 'translate(0px, 0px)';
      Input.setDown('ArrowLeft', false);
      Input.setDown('ArrowRight', false);
      Input.setDown('ArrowUp', false);
      Input.setDown('ArrowDown', false);
      e.preventDefault();
    }
  }
  joyBase.addEventListener('touchstart', joyStart, { passive: false });
  joyBase.addEventListener('touchmove', joyMove, { passive: false });
  joyBase.addEventListener('touchend', joyEnd, { passive: false });
  joyBase.addEventListener('touchcancel', joyEnd, { passive: false });

  // Buttons all just forward to Input.setDown — press-and-hold works
  // identically to a held key (Input.down), and a quick tap works
  // identically to a keydown/keyup pair (Input.pressed), matching whichever
  // style each action already expects on desktop.
  function wireButton(id, code) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => { Input.setDown(code, true); e.preventDefault(); };
    const end = (e) => { Input.setDown(code, false); e.preventDefault(); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
  }
  wireButton('btnJump', 'Space');
  wireButton('btnAttack', 'KeyZ');
  wireButton('btnSuper', 'KeyX');
  wireButton('btnRun', 'ShiftLeft');
  // Accion drives both KeyF (doors) and KeyE (climbing) — a player is never
  // meaningfully at a door and a climbable wall at the same time, so one
  // contextual button covers both instead of needing two separate ones.
  wireButton('btnAction', 'KeyF');
  wireButton('btnAction', 'KeyE');

  // --- Swipe-to-look camera ------------------------------------------------
  // Any touch that doesn't start on the joystick/buttons drags the camera,
  // feeding Input.lookDeltaX/Y (consumed each frame by updateCamera() in
  // main.js) — the same accumulator the desktop KeyA/D/W/S path doesn't
  // use, so the two never conflict.
  const LOOK_SENSITIVITY = 0.004;
  let lookTouchId = null, lastLookX = 0, lastLookY = 0;

  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (controls.contains(t.target)) continue;
      if (lookTouchId !== null) continue;
      lookTouchId = t.identifier;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    let handled = false;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      handled = true;
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
      Input.lookDeltaX += dx * LOOK_SENSITIVITY;
      Input.lookDeltaY += dy * LOOK_SENSITIVITY;
    }
    if (handled) e.preventDefault();
  }, { passive: false });

  function releaseLook(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
  }
  window.addEventListener('touchend', releaseLook, { passive: true });
  window.addEventListener('touchcancel', releaseLook, { passive: true });
})();

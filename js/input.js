// Simple global keyboard state tracker.
const Input = {
  keys: {},
  justPressed: {},
  // Accumulated camera-look drag (see js/mobile.js's swipe handling and
  // updateCamera() in main.js, which consumes and resets these each frame).
  // Always 0 on desktop — nothing ever writes to them there.
  lookDeltaX: 0,
  lookDeltaY: 0,
  bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    // If the window/tab loses focus while a key is physically held down
    // (alt-tab, clicking a browser UI element, a stray OS shortcut...), no
    // keyup ever fires for it, so it stays stuck "down" forever — reads as
    // the character continuing to move/turn on its own with no key held.
    // Dropping all key state on any focus loss clears that out.
    window.addEventListener('blur', () => {
      this.keys = {};
      this.justPressed = {};
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys = {};
        this.justPressed = {};
      }
    });
  },
  down(code) { return !!this.keys[code]; },
  pressed(code) {
    if (this.justPressed[code]) return true;
    return false;
  },
  // Same down/up transition a real keydown/keyup would produce — lets
  // touch controls (js/mobile.js) drive the exact same code paths as the
  // keyboard instead of needing separate touch-aware branches everywhere.
  setDown(code, isDown) {
    if (isDown) {
      if (!this.keys[code]) this.justPressed[code] = true;
      this.keys[code] = true;
    } else {
      this.keys[code] = false;
    }
  },
  clearFrame() {
    this.justPressed = {};
  }
};
Input.bind();

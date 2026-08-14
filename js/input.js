// Simple global keyboard state tracker.
const Input = {
  keys: {},
  justPressed: {},
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
  clearFrame() {
    this.justPressed = {};
  }
};
Input.bind();

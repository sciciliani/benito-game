// heartCapForTuna() drives Player.addTuna(): every 3 tuna collected grows
// the heart cap by one. Testing the milestone math directly (rather than
// only through the full Player class, which needs a live Three.js scene,
// Silverpaw, Input, SFX, etc. to construct) keeps this fast and focused.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { heartCapForTuna } = require(path.join(__dirname, '..', 'js', 'player.js'));

test('no tuna means the base cap', () => {
  assert.equal(heartCapForTuna(0), 5);
});

test('cap only grows on exact multiples of 3', () => {
  assert.equal(heartCapForTuna(1), 5);
  assert.equal(heartCapForTuna(2), 5);
  assert.equal(heartCapForTuna(3), 6);
  assert.equal(heartCapForTuna(4), 6);
  assert.equal(heartCapForTuna(5), 6);
  assert.equal(heartCapForTuna(6), 7);
});

test('keeps growing linearly for larger counts', () => {
  assert.equal(heartCapForTuna(30), 15);
});

test('respects a custom base (in case a future level starts Benito with a different max)', () => {
  assert.equal(heartCapForTuna(3, 3), 4);
});

// separateCircles() is the shared push-apart used to keep Enemy/Boss (and
// Destructible-vs-player) from visually overlapping. MELEE_VERTICAL_REACH
// and AGGRO_VERTICAL_REACH are the height gates that stop e.g. a rooftop
// enemy from hitting/aggroing a player standing on the ground far below.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { separateCircles, MELEE_VERTICAL_REACH, AGGRO_VERTICAL_REACH } = require(path.join(__dirname, '..', 'js', 'level.js'));

test('two overlapping circles get pushed apart to exactly touching', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 1, y: 0, z: 0 };
  separateCircles(a, 1, b, 1); // radii sum to 2, but they're only 1 apart
  const dist = Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(Math.abs(dist - 2) < 1e-9, `expected them exactly 2 apart, got ${dist}`);
});

test('the push is symmetric — both circles move, evenly', () => {
  const a = { x: -0.2, y: 0, z: 0 };
  const b = { x: 0.2, y: 0, z: 0 };
  const aStart = { ...a };
  separateCircles(a, 1, b, 1);
  const aMoved = Math.hypot(a.x - aStart.x, a.z - aStart.z);
  const bMoved = Math.hypot(b.x - 0.2, b.z - 0);
  assert.ok(Math.abs(aMoved - bMoved) < 1e-9, `expected an even split, moved ${aMoved} vs ${bMoved}`);
});

test('circles far enough apart are left untouched', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 10, y: 0, z: 0 };
  separateCircles(a, 1, b, 1);
  assert.equal(a.x, 0);
  assert.equal(b.x, 10);
});

test('exact-same-position (degenerate) case still resolves instead of leaving them stuck', () => {
  const a = { x: 5, y: 0, z: 5 };
  const b = { x: 5, y: 0, z: 5 };
  separateCircles(a, 0.5, b, 0.5);
  const dist = Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(dist > 0.9, `expected them pushed apart from a dead-center overlap, got dist=${dist}`);
});

test('vertical reach constants are sane relative to each other', () => {
  // Aggro (chase-worthiness) should be looser than melee (can-actually-hit)
  // — otherwise an enemy could chase from a height it could never attack from.
  assert.ok(AGGRO_VERTICAL_REACH > MELEE_VERTICAL_REACH);
});

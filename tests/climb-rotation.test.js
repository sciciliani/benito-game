// Regression test for a real bug: while climbing, Benito's model is pitched
// -90° (rotation.x) to read as scrambling up the wall, while rotation.y
// keeps tracking his horizontal facing. With the default Euler order
// ('XYZ'), those two axes are coupled — the pitch only actually pointed
// "up" when facing was near 0; at other facing angles it could tip him
// past vertical into upside-down, face-to-the-floor. Fixed in player.js by
// setting mesh.rotation.order = 'YXZ' (yaw applied outermost, so pitching
// the local +Z axis to world +Y stays world +Y no matter the yaw).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const THREE = require(path.join(__dirname, '..', 'js', 'vendor', 'three.min.js'));

const CLIMB_PITCH = -Math.PI / 2;

function noseDirection(facing, order) {
  const obj = new THREE.Object3D();
  obj.rotation.order = order;
  obj.rotation.y = facing;
  obj.rotation.x = CLIMB_PITCH;
  return new THREE.Vector3(0, 0, 1).applyEuler(obj.rotation);
}

test('climbing pose points up regardless of facing angle (order = YXZ, the fix)', () => {
  const facings = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.9, Math.PI, -Math.PI / 3, -Math.PI * 0.75, 2.5];
  for (const facing of facings) {
    const nose = noseDirection(facing, 'YXZ');
    assert.ok(nose.y > 0.99, `facing=${facing}: expected nose pointing up (y≈1), got y=${nose.y.toFixed(3)}`);
    assert.ok(Math.abs(nose.x) < 0.01 && Math.abs(nose.z) < 0.01, `facing=${facing}: expected x/z≈0, got (${nose.x.toFixed(3)}, ${nose.z.toFixed(3)})`);
  }
});

test('documents the bug: default order (XYZ) flips upside-down at wide facing angles', () => {
  // Not exhaustive — just enough to prove the old default was actually
  // broken, so this test suite would have caught the regression.
  const nose = noseDirection(Math.PI * 0.9, 'XYZ');
  assert.ok(nose.y < 0, `expected the unfixed order to point downward at facing≈162°, got y=${nose.y.toFixed(3)}`);
});

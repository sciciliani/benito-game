// Regression test for a real bug: the camera-relative movement transform's
// cross terms had their signs swapped, so movement only matched the
// camera's actual forward/right vectors at the default camera angle
// (cameraYaw = PI, where sin(yaw) happens to be 0 and hides the bug) —
// turning the camera at all made left/right (and forward/back) invert.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { cameraRelativeMove } = require(path.join(__dirname, '..', 'js', 'player.js'));

function approxEqual(a, b, msg, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `${msg}: expected ${b}, got ${a}`);
}

test('forward input (iz=-1) moves away from the camera at the default angle', () => {
  const yaw = Math.PI;
  const { x, z } = cameraRelativeMove(0, -1, yaw);
  approxEqual(x, 0, 'x');
  approxEqual(z, 1, 'z (away from camera, +z, matches the level laid out along +z)');
});

test('right input (ix=1) matches the camera\'s actual right vector at any yaw, not just the default', () => {
  // The camera's right vector (see main.js desiredCameraOffset) is
  // (cos(yaw), 0, -sin(yaw)). ix=1 alone should reproduce exactly that.
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.1, -1.4]) {
    const { x, z } = cameraRelativeMove(1, 0, yaw);
    approxEqual(x, Math.cos(yaw), `x at yaw=${yaw}`);
    approxEqual(z, -Math.sin(yaw), `z at yaw=${yaw}`);
  }
});

test('rotating the camera 90° does not reproduce the old (buggy) formula', () => {
  const yaw = Math.PI / 2;
  const fixed = cameraRelativeMove(1, 0, yaw);
  // The old code: moveX = ix*cos - iz*sin; moveZ = ix*sin + iz*cos —
  // correct only at yaw=PI (where sin(yaw)=0 hid the sign-flip bug), wrong
  // everywhere else, including here.
  const buggy = { x: 1 * Math.cos(yaw) - 0 * Math.sin(yaw), z: 1 * Math.sin(yaw) + 0 * Math.cos(yaw) };
  assert.notStrictEqual(fixed.z, buggy.z, `fixed.z (${fixed.z}) should differ from the old buggy formula's z (${buggy.z}) at a turned camera`);
});

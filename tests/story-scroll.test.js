// computeScrollEndPercent() decides where the story crawl's text stops —
// the point where its LAST LINE lands at the frame's vertical middle.
// Regression coverage for a bug where a fixed guess (~-230%) was used
// instead, which put the actual stopping point nowhere near the middle for
// any text whose height didn't happen to match what that guess assumed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { computeScrollEndPercent } = require(path.join(__dirname, '..', 'js', 'story.js'));

test('short text (half the frame height) stops with its top right at the middle', () => {
  // textH = containerH/2 (50% of frame) -> top = 50 - 50 = 0: the block's
  // top edge sits at the frame's own top, so its bottom (top + 50%) lands
  // exactly on the 50% mark.
  assert.equal(computeScrollEndPercent(240, 480), 0);
});

test('text exactly as tall as the frame needs its top pulled up to -50%', () => {
  // textH = containerH (100% of frame) -> top = 50 - 100 = -50.
  assert.equal(computeScrollEndPercent(480, 480), -50);
});

test('text taller than the frame needs a negative (above-frame) stop, proportional to its height', () => {
  // A long caption, ~2.2x the frame height (a real example measured from
  // the actual story panels).
  const end = computeScrollEndPercent(1071, 480);
  assert.ok(end < -170 && end > -180, `expected roughly -173%, got ${end}`);
});

test('the fixed -230% guess this replaced was wrong for shorter text', () => {
  const shortTextEnd = computeScrollEndPercent(240, 480);
  assert.notStrictEqual(shortTextEnd, -230, 'a fixed guess would have left a long dead scroll for short captions');
});

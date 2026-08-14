// A tiny procedural background tune for the story intro. Browsers don't
// natively play .mid files (that needs a bundled synthesizer/soundfont), so
// this just plays a simple looping melody with oscillators the same way
// SFX's sound effects work — a "midi-style" 8-bit tune, synthesized rather
// than an actual MIDI file. Shares SFX's AudioContext.
const Music = (function () {
  const NOTES = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  };
  // [note, length in steps]; a gentle, slightly playful storybook melody.
  const MELODY = [
    ['C5', 1], ['E5', 1], ['G5', 1], ['E5', 1],
    ['F5', 1], ['A5', 1], ['G5', 2],
    ['E5', 1], ['D5', 1], ['C5', 1], ['D5', 1],
    ['E5', 1], ['C5', 1], [null, 2],
    ['A4', 1], ['C5', 1], ['E5', 1], ['D5', 1],
    ['C5', 4],
  ];
  const STEP = 0.26;
  const LOOP_SECONDS = MELODY.reduce((sum, [, steps]) => sum + steps, 0) * STEP;

  let playing = false;
  let timer = null;
  let activeNodes = [];

  function scheduleLoop() {
    const ctx = SFX.getContext();
    let t = ctx.currentTime + 0.05;
    for (const [name, steps] of MELODY) {
      const dur = STEP * steps;
      if (name) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = NOTES[name];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        activeNodes.push({ osc, g });
        osc.onended = () => { activeNodes = activeNodes.filter((n) => n.osc !== osc); };
      }
      t += dur;
    }
    if (playing) timer = setTimeout(scheduleLoop, LOOP_SECONDS * 1000);
  }

  return {
    play() {
      if (playing) return;
      playing = true;
      scheduleLoop();
    },
    // Called once the AudioContext gets genuinely unlocked by a real user
    // gesture (see audio.js) after play() already ran while it was still
    // suspended. Notes scheduled against a context that wasn't actually
    // running yet aren't reliably timed once it resumes, so this just
    // throws those out and starts a clean loop from right now instead of
    // trying to salvage them.
    kick() {
      if (!playing) return;
      clearTimeout(timer);
      for (const { osc } of activeNodes) {
        try { osc.stop(); } catch (e) { /* already stopped */ }
      }
      activeNodes = [];
      scheduleLoop();
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearTimeout(timer);
      const ctx = SFX.getContext();
      const now = ctx.currentTime;
      for (const { osc, g } of activeNodes) {
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + 0.08);
          osc.stop(now + 0.1);
        } catch (e) { /* already stopped */ }
      }
      activeNodes = [];
    },
  };
})();

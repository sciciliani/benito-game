// Tiny procedural sound effects via the Web Audio API — no external audio
// files needed. Call SFX.unlock() from a user-gesture handler (a click)
// before anything else, since browsers block audio until then.
const SFX = (function () {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freqStart, freqEnd, duration, type = 'sine', gain = 0.2, delay = 0 }) {
    const ac = ensureCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    const t0 = ac.currentTime + delay;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    }
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noiseBurst({ duration = 0.12, gain = 0.25, filterFreq = 2000 }) {
    const ac = ensureCtx();
    const bufferSize = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ac.createGain();
    const t0 = ac.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(t0);
  }

  // A run of short pitch-wobbling "syllables" — pseudo-words with no real
  // phonemes, just a cadence of tones that reads as mumbled speech. Used
  // for Granny's voice instead of a scream/roar.
  function gibberish({ syllables = 4, baseFreq = 340, freqVariance = 90, gain = 0.11, speed = 0.15, type = 'sawtooth' }) {
    const ac = ensureCtx();
    let t = ac.currentTime + 0.02;
    for (let i = 0; i < syllables; i++) {
      const f = baseFreq + (Math.random() * 2 - 1) * freqVariance;
      const dur = speed * (0.7 + Math.random() * 0.6);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(f * (0.75 + Math.random() * 0.5), 60), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + speed * 0.3 * Math.random();
    }
  }

  return {
    unlock() { ensureCtx(); },
    // Exposed so other modules (Music) can share this same AudioContext
    // instead of each needing their own unlock step.
    getContext() { return ensureCtx(); },
    playJump() {
      tone({ freqStart: 320, freqEnd: 680, duration: 0.16, type: 'triangle', gain: 0.16 });
    },
    playAttack() {
      noiseBurst({ duration: 0.11, gain: 0.28, filterFreq: 2400 });
    },
    playPickup() {
      tone({ freqStart: 620, freqEnd: 880, duration: 0.09, type: 'sine', gain: 0.18 });
      tone({ freqStart: 880, freqEnd: 1320, duration: 0.12, type: 'sine', gain: 0.16, delay: 0.08 });
    },
    // A short cat hiss/yowl, layered under playAttack() for a proper
    // "fighting cat" sound on every swipe.
    playHiss() {
      tone({ freqStart: 900, freqEnd: 260, duration: 0.22, type: 'sawtooth', gain: 0.13 });
      noiseBurst({ duration: 0.18, gain: 0.16, filterFreq: 3500 });
    },
    // Low warning growl, used during the boss's wind-up before it fires gas.
    playGrowl() {
      tone({ freqStart: 150, freqEnd: 85, duration: 0.5, type: 'sawtooth', gain: 0.11 });
      noiseBurst({ duration: 0.45, gain: 0.07, filterFreq: 350 });
    },
    // A big dramatic cat-fight yowl for the Super Zarpazo explosion: a
    // rising screech, a falling wail, then a low growling tail-off, layered
    // with a noise burst for texture — an intensified/exaggerated playHiss.
    playSuperRoar() {
      tone({ freqStart: 500, freqEnd: 1100, duration: 0.16, type: 'sawtooth', gain: 0.24 });
      tone({ freqStart: 1000, freqEnd: 320, duration: 0.32, type: 'sawtooth', gain: 0.22, delay: 0.14 });
      tone({ freqStart: 260, freqEnd: 120, duration: 0.3, type: 'sine', gain: 0.16, delay: 0.42 });
      noiseBurst({ duration: 0.55, gain: 0.26, filterFreq: 2200 });
      noiseBurst({ duration: 0.3, gain: 0.14, filterFreq: 600 });
    },
    // Granny's idle chatter while she patrols — calm gibberish "words" in
    // an old-lady register, nothing intelligible, just cadence and pitch.
    playGrannyMutter() {
      gibberish({ syllables: 3 + Math.floor(Math.random() * 2), baseFreq: 320, freqVariance: 70, gain: 0.08, speed: 0.17, type: 'triangle' });
    },
    // The instant she notices the fish is gone: same gibberish "voice" but
    // faster, louder, and harsher — reads as angry shouting without being
    // an unrelated cat-style scream.
    playGrannyAngryShout() {
      gibberish({ syllables: 6, baseFreq: 420, freqVariance: 140, gain: 0.19, speed: 0.1, type: 'sawtooth' });
      noiseBurst({ duration: 0.3, gain: 0.14, filterFreq: 2800 });
    },
  };
})();

// Browsers only actually let an AudioContext run if resume() happens to be
// called from inside a genuine user-gesture handler. The story intro can
// auto-open (and call Music.play()) before the player has interacted with
// the page at all, so that first Music.play() silently stays suspended —
// this listens for the very first click/key/touch anywhere on the page and
// unlocks right there, then kicks Music's loop immediately (rather than
// waiting for its own next scheduled note, up to several seconds later) so
// sound starts right at that first interaction instead of being delayed.
(function () {
  const events = ['pointerdown', 'keydown', 'touchstart'];
  const handler = () => {
    SFX.unlock();
    if (typeof Music !== 'undefined') Music.kick();
    events.forEach((e) => document.removeEventListener(e, handler));
  };
  events.forEach((e) => document.addEventListener(e, handler));
})();

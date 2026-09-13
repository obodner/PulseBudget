// Super Mario Retro Sound Synthesizer (NES-style chiptune via Web Audio API)

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Super Mario Jump Sound:
 * Classic ascending pitch sweep using a square wave
 */
export function playMarioJump() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const now = ctx.currentTime;
    
    // Jump pitch glide: 150Hz -> 600Hz
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.14);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {
    // ignore
  }
}

/**
 * Super Mario Coin Sound:
 * Note 1: B5 (987.77 Hz) for ~0.06s
 * Note 2: E6 (1318.51 Hz) for ~0.35s
 */
export function playMarioCoin() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Note 1: B5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(987.77, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Note 2: E6
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1318.51, now + 0.07);
    gain2.gain.setValueAtTime(0.12, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.4);
  } catch (e) {
    // ignore
  }
}

/**
 * Super Mario 1-UP / Power-Up Arpeggio:
 * E5, G5, E6, C6, D6, G6
 */
export function playMario1Up() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [
      659.25, // E5
      783.99, // G5
      1318.51, // E6
      1046.50, // C6
      1174.66, // D6
      1567.98  // G6
    ];

    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.075;
      const duration = 0.08;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Super Mario Bump / Warning Tone:
 * Low square-wave bump sound
 */
export function playMarioWarning() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.16);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {
    // ignore
  }
}

/**
 * Super Mario Game Over / Death Jingle:
 * B4, F5, (pause), F5, F5, E5, D5, C5
 */
export function playMarioGameOver() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const sequence = [
      { freq: 493.88, dur: 0.12, pause: 0.02 }, // B4
      { freq: 698.46, dur: 0.12, pause: 0.08 }, // F5
      { freq: 698.46, dur: 0.10, pause: 0.02 }, // F5
      { freq: 698.46, dur: 0.10, pause: 0.02 }, // F5
      { freq: 659.25, dur: 0.10, pause: 0.02 }, // E5
      { freq: 587.33, dur: 0.10, pause: 0.02 }, // D5
      { freq: 523.25, dur: 0.28, pause: 0.05 }  // C5
    ];

    let t = ctx.currentTime;
    sequence.forEach(item => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(item.freq, t);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + item.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + item.dur);

      t += item.dur + item.pause;
    });
  } catch (e) {
    // ignore
  }
}

// Aliases for compatibility
export const playTechClick = playMarioJump;
export const playSuccessChime = playMarioCoin;
export const playWarningTone = playMarioWarning;
export const playDangerAlert = playMarioGameOver;

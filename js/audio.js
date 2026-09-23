/**
 * audio.js
 * ---------------------------------------------------------------------------
 * All sound effects, generated live with the Web Audio API (no audio files).
 *
 * Two building blocks make every sound:
 *   tone()  — a musical note (oscillator) that fades out
 *   noise() — a burst of static, shaped by a filter (whooshes, swishes, thuds)
 *
 * Browsers only allow sound after the player touches/clicks something, so
 * main.js calls unlock() on the first tap.
 *
 * To add a new sound: write a new method that calls tone() and/or noise(),
 * then call it from main.js.
 */
import { CONFIG } from './config.js';
import { loadBool, saveBool } from './storage.js';

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = loadBool(CONFIG.storageKeys.muted, false);
    this.lastPlayed = {}; // stops the same sound spamming many times per frame
  }

  /** Create/resume the audio engine. Must be called from a tap or click. */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);

      // One second of random noise, reused by every noise() sound
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    saveBool(CONFIG.storageKeys.muted, muted);
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Returns false if audio isn't ready, or `name` played less than `gap` seconds ago. */
  ready(name, gap = 0.05) {
    if (!this.ctx || this.muted) return false;
    const now = this.ctx.currentTime;
    if (name && now - (this.lastPlayed[name] ?? -1) < gap) return false;
    if (name) this.lastPlayed[name] = now;
    return true;
  }

  // -------------------------------------------------------------------------
  // Building blocks
  // -------------------------------------------------------------------------

  tone({ freq, freqEnd = freq, type = 'sine', duration = 0.2, volume = 0.3, attack = 0.005, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  noise({ filter = 'bandpass', freq = 1000, freqEnd = freq, q = 1, duration = 0.2, volume = 0.3, attack = 0.005, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, t);
    if (freqEnd !== freq) biquad.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(biquad).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
  }

  // -------------------------------------------------------------------------
  // Game sounds
  // -------------------------------------------------------------------------

  /** Ball leaves the hand. */
  whoosh() {
    if (!this.ready('whoosh')) return;
    this.noise({ freq: 300, freqEnd: 1400, q: 0.8, duration: 0.22, volume: 0.25, attack: 0.04 });
  }

  /** Metallic clang — several high notes that die away quickly. */
  rim(speed = 3) {
    if (!this.ready('rim', 0.08)) return;
    const v = Math.min(0.28, 0.05 + speed * 0.04);
    for (const [freq, len] of [[520, 0.35], [1190, 0.22], [1960, 0.16], [2870, 0.1]]) {
      this.tone({ freq, type: 'sine', duration: len, volume: v / 2 });
    }
    this.noise({ filter: 'highpass', freq: 3000, duration: 0.04, volume: v / 2 });
  }

  /** Dull thump off the glass. */
  board(speed = 3) {
    if (!this.ready('board', 0.08)) return;
    const v = Math.min(0.4, 0.1 + speed * 0.05);
    this.tone({ freq: 170, freqEnd: 90, duration: 0.14, volume: v });
    this.noise({ filter: 'lowpass', freq: 900, duration: 0.07, volume: v * 0.6 });
  }

  /** Ball bouncing on the floor. */
  bounce(speed = 3) {
    if (!this.ready('bounce', 0.08)) return;
    const v = Math.min(0.45, 0.08 + speed * 0.06);
    this.tone({ freq: 120, freqEnd: 55, duration: 0.16, volume: v });
    this.noise({ filter: 'lowpass', freq: 500, duration: 0.05, volume: v * 0.5 });
  }

  /** The sweet sound of nothing but net. */
  swish() {
    if (!this.ready('swish')) return;
    this.noise({ freq: 5000, freqEnd: 1800, q: 1.2, duration: 0.35, volume: 0.35, attack: 0.03 });
  }

  /** Happy two-note chime; pitch climbs with the streak. */
  score(streak = 1) {
    if (!this.ready('score')) return;
    const base = 660 * Math.pow(2, Math.min(streak - 1, 7) / 12);
    this.tone({ freq: base, type: 'triangle', duration: 0.14, volume: 0.22 });
    this.tone({ freq: base * 1.5, type: 'triangle', duration: 0.28, volume: 0.22, delay: 0.09 });
  }

  /** Rising roar when the player catches fire. */
  fire() {
    if (!this.ready('fire')) return;
    this.noise({ filter: 'lowpass', freq: 300, freqEnd: 3000, q: 2, duration: 0.6, volume: 0.3, attack: 0.1 });
    [523, 659, 784, 1046].forEach((freq, i) => {
      this.tone({ freq, type: 'square', duration: 0.12, volume: 0.08, delay: i * 0.07 });
    });
  }

  /** Countdown beep. `go` = the higher, longer final beep. */
  beep(go = false) {
    if (!this.ready()) return;
    this.tone({ freq: go ? 988 : 660, type: 'square', duration: go ? 0.35 : 0.12, volume: 0.12 });
  }

  /** Clock tick for the last few seconds. */
  tick() {
    if (!this.ready('tick')) return;
    this.tone({ freq: 1400, duration: 0.05, volume: 0.12 });
  }

  /** End-of-game buzzer. */
  buzzer() {
    if (!this.ready('buzzer')) return;
    this.tone({ freq: 190, type: 'sawtooth', duration: 0.8, volume: 0.18, attack: 0.02 });
    this.tone({ freq: 196, type: 'square', duration: 0.8, volume: 0.08, attack: 0.02 });
  }

  /** Can crack + fizz when an energy drink is opened. */
  powerUp() {
    if (!this.ready('powerUp')) return;
    this.noise({ filter: 'highpass', freq: 2500, duration: 0.05, volume: 0.3 });
    this.noise({ filter: 'bandpass', freq: 6000, freqEnd: 3000, q: 0.7, duration: 0.5, volume: 0.15, attack: 0.03, delay: 0.04 });
    this.tone({ freq: 440, freqEnd: 1320, type: 'triangle', duration: 0.3, volume: 0.12, delay: 0.05 });
  }

  /** Short click when a specialty ball is loaded. */
  select() {
    if (!this.ready('select')) return;
    this.tone({ freq: 880, type: 'triangle', duration: 0.08, volume: 0.15 });
    this.tone({ freq: 1320, type: 'triangle', duration: 0.12, volume: 0.12, delay: 0.05 });
  }

  /** Shimmer when a rare multiplier (5× or 10×) appears on the hoop. */
  rareMultiplier() {
    if (!this.ready('rare')) return;
    [1046, 1318, 1568, 2093].forEach((freq, i) => {
      this.tone({ freq, type: 'sine', duration: 0.3, volume: 0.1, delay: i * 0.05 });
    });
  }

  /** Reward jingle for a completed mission. */
  missionComplete() {
    if (!this.ready('mission')) return;
    [784, 988, 1175, 1568].forEach((freq, i) => {
      this.tone({ freq, type: 'square', duration: 0.18, volume: 0.07, delay: i * 0.08 });
      this.tone({ freq: freq / 2, type: 'triangle', duration: 0.2, volume: 0.1, delay: i * 0.08 });
    });
  }

  /** Little fanfare for a new best score. */
  newBest() {
    if (!this.ready('newBest')) return;
    [523, 659, 784, 1046, 1318].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', duration: 0.25, volume: 0.18, delay: i * 0.09 });
    });
  }
}

// VOIDPRISM — WebAudio synthesised SFX and a pulsing bassline.
// Everything is generated at runtime: oscillators, a shared noise buffer and a
// step sequencer. No audio files. The context is created on first user gesture.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noise = null;
    this.musicOn = false;
    this.nextNoteTime = 0;
    this.step = 0;
    this.tempo = 0.115; // seconds per eighth
    this._pattern = [0, 0, 7, 0, 3, 0, 7, 5, 0, 0, 7, 0, 10, 7, 5, 3];
  }

  // Called on the first click/key. Safe to call repeatedly.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    // Shared white-noise buffer for explosions/hits.
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _env(node, t0, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  _tone(freq, type, peak, attack, decay, slideTo = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + attack + decay);
    this._env(o, t0, peak, attack, decay);
    o.start(t0);
    o.stop(t0 + attack + decay + 0.02);
  }

  _noiseBurst(peak, attack, decay, filterFreq, q = 1) {
    if (!this.ctx || !this.noise) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    f.Q.value = q;
    src.connect(f);
    this._env(f, t0, peak, attack, decay);
    src.start(t0);
    src.stop(t0 + attack + decay + 0.02);
  }

  shoot() {
    if (!this.ctx) return;
    this._tone(760, 'square', 0.05, 0.002, 0.055, 320);
    this._noiseBurst(0.03, 0.001, 0.03, 2600);
  }

  enemyShoot() {
    if (!this.ctx) return;
    this._tone(300, 'sawtooth', 0.035, 0.005, 0.12, 160);
  }

  hit() {
    if (!this.ctx) return;
    this._noiseBurst(0.06, 0.001, 0.05, 3400, 2);
    this._tone(520, 'square', 0.03, 0.001, 0.03, 380);
  }

  explode() {
    if (!this.ctx) return;
    this._noiseBurst(0.22, 0.004, 0.28, 1400);
    this._tone(140, 'sawtooth', 0.12, 0.004, 0.24, 40);
  }

  bigExplode() {
    if (!this.ctx) return;
    this._noiseBurst(0.34, 0.01, 0.6, 900);
    this._tone(90, 'sawtooth', 0.2, 0.01, 0.7, 28);
    this._tone(180, 'square', 0.08, 0.01, 0.4, 60);
  }

  pickup() {
    if (!this.ctx) return;
    this._tone(880, 'triangle', 0.09, 0.005, 0.09);
    setTimeout(() => this.ctx && this._tone(1320, 'triangle', 0.08, 0.005, 0.12), 55);
  }

  dash() {
    if (!this.ctx) return;
    this._noiseBurst(0.09, 0.002, 0.14, 5000, 0.7);
    this._tone(220, 'sine', 0.06, 0.002, 0.14, 660);
  }

  bomb() {
    if (!this.ctx) return;
    this._noiseBurst(0.4, 0.005, 0.7, 700);
    this._tone(120, 'sawtooth', 0.24, 0.005, 0.6, 30);
    this._tone(600, 'square', 0.1, 0.002, 0.2, 100);
  }

  hurt() {
    if (!this.ctx) return;
    this._tone(200, 'sawtooth', 0.14, 0.002, 0.2, 70);
    this._noiseBurst(0.1, 0.001, 0.12, 1200);
  }

  ui() {
    if (!this.ctx) return;
    this._tone(660, 'square', 0.05, 0.002, 0.05, 990);
  }

  startMusic() {
    if (!this.ctx) return;
    this.musicOn = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
  }

  stopMusic() {
    this.musicOn = false;
  }

  // Called each frame: schedules a few steps ahead so the bassline stays steady.
  update() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const now = this.ctx.currentTime;
    while (this.nextNoteTime < now + 0.12) {
      this._scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.tempo;
      this.step = (this.step + 1) % this._pattern.length;
    }
  }

  _scheduleStep(step, t) {
    const semi = this._pattern[step];
    const freq = 55 * Math.pow(2, semi / 12);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(step % 4 === 0 ? 420 : 240, t);
    f.Q.value = 6;
    o.connect(f);
    const g = this.ctx.createGain();
    const peak = step % 4 === 0 ? 0.16 : 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + this.tempo * 0.95);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + this.tempo);
    // hi-hat tick on off-beats
    if (step % 2 === 1) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noise;
      const hf = this.ctx.createBiquadFilter();
      hf.type = 'highpass';
      hf.frequency.value = 7000;
      n.connect(hf);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.03, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      hf.connect(ng);
      ng.connect(this.master);
      n.start(t);
      n.stop(t + 0.04);
    }
  }
}
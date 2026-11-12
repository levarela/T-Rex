// Sonido 100% sintetizado con WebAudio (sin archivos).
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    // la cinta se come los agudos
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    this.master.connect(lp).connect(ctx.destination);
    // buffer de ruido compartido
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // lluvia + zumbido de cinta
    const rain = this.src(true);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.35;
    const g = ctx.createGain();
    g.gain.value = 0.11;
    rain.connect(hp).connect(g).connect(this.master);
    rain.start();
    const hum = ctx.createOscillator();
    hum.frequency.value = 60;
    const hg = ctx.createGain();
    hg.gain.value = 0.012;
    hum.connect(hg).connect(this.master);
    hum.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  src(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  env(g, t, a, peak, hold, rel) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  step(vol = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.25);
    this.env(g, t, 0.005, 0.7 * vol, 0.02, 0.35);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.5);
    const n = this.src(), f = c.createBiquadFilter(), ng = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 500;
    this.env(ng, t, 0.005, 0.25 * vol, 0.01, 0.18);
    n.connect(f).connect(ng).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.3);
  }

  roar(pitch = 1, vol = 1, dur = 1.9) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const out = c.createGain();
    this.env(out, t, 0.12, 0.55 * vol, dur * 0.55, dur * 0.4);
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); }
    shaper.curve = curve;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(900 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(380 * pitch, t + dur);
    for (const det of [1, 1.51, 2.02]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 * pitch * det, t);
      o.frequency.exponentialRampToValueAtTime(62 * pitch * det, t + dur);
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 23 + det * 7; lg.gain.value = 18 * pitch;
      lfo.connect(lg).connect(o.frequency);
      const og = c.createGain(); og.gain.value = 0.33;
      o.connect(og).connect(shaper);
      o.start(t); o.stop(t + dur + 0.2); lfo.start(t); lfo.stop(t + dur + 0.2);
    }
    const n = this.src(), ng = c.createGain();
    ng.gain.value = 0.5;
    n.connect(ng).connect(shaper);
    n.start(t, Math.random()); n.stop(t + dur + 0.2);
    shaper.connect(bp).connect(out).connect(this.master);
  }

  bite() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.22;
    const n = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2;
    this.env(g, t, 0.003, 0.6, 0.02, 0.12);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.25);
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    this.env(og, t, 0.003, 0.5, 0.01, 0.12);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  scream() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(880, t + 0.12);
    o.frequency.linearRampToValueAtTime(540, t + 0.6);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 9; lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
    this.env(g, t, 0.03, 0.16, 0.3, 0.3);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.8); lfo.start(t); lfo.stop(t + 0.8);
  }

  thunder() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.35;
    const n = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 2.5);
    this.env(g, t, 0.03, 0.75, 0.25, 2.6);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random() * 0.5); n.stop(t + 3.2);
  }

  beep(freq = 880, vol = 0.12) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = freq;
    this.env(g, t, 0.004, vol, 0.05, 0.05);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }

  hurt() {
    if (!this.ctx) return;
    this.roar(1.7, 0.45, 0.45);
  }
}

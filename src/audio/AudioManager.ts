import type { Settings } from '../game/GameTypes';

export type Sfx =
  | 'pistol'
  | 'shotgun'
  | 'enemyShot'
  | 'reload'
  | 'empty'
  | 'melee'
  | 'hit'
  | 'hurt'
  | 'step'
  | 'interact'
  | 'ui'
  | 'uiBack'
  | 'success'
  | 'failure'
  | 'alert'
  | 'pickup'
  | 'door'
  | 'evidence'
  | 'death';

/**
 * Fully synthesised sound (Web Audio). No copyrighted or external files; starts after the
 * first user gesture to satisfy autoplay policies, and silently no-ops if unavailable.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ambienceStarted = false;
  private settings: Settings;
  private lastPlayed = new Map<Sfx, number>();

  constructor(settings: Settings) {
    this.settings = settings;
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get available(): boolean {
    return this.ctx !== null;
  }

  private init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings(this.settings);
    this.startAmbience();
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.6, t, 0.05);
  }

  suspend(v: boolean): void {
    if (!this.ctx) return;
    if (v) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private noise(dur: number, filterType: BiquadFilterType, freq: number, q: number, gain: number, when = 0, bus?: AudioNode): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number, bus?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime + when;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** volume: 0..1 attenuation (e.g. by distance). */
  play(s: Sfx, volume = 1): void {
    if (!this.ctx || this.ctx.state !== 'running' || volume <= 0.02) return;
    // Rate-limit identical sounds to avoid phasing.
    const now = performance.now();
    if (now - (this.lastPlayed.get(s) ?? 0) < 25) return;
    this.lastPlayed.set(s, now);
    const v = volume;
    switch (s) {
      case 'pistol':
        this.noise(0.18, 'lowpass', 2600, 0.7, 0.9 * v);
        this.noise(0.05, 'highpass', 3000, 0.5, 0.5 * v);
        this.tone(140, 0.12, 'sine', 0.5 * v, 0, 50);
        break;
      case 'shotgun':
        this.noise(0.35, 'lowpass', 1500, 0.6, 1.0 * v);
        this.tone(90, 0.25, 'sine', 0.7 * v, 0, 35);
        this.noise(0.08, 'highpass', 2000, 0.6, 0.3 * v, 0.45);
        break;
      case 'enemyShot':
        this.noise(0.16, 'lowpass', 1800, 0.7, 0.6 * v);
        this.tone(120, 0.1, 'sine', 0.3 * v, 0, 45);
        break;
      case 'reload':
        this.noise(0.04, 'bandpass', 2500, 4, 0.5 * v);
        this.noise(0.05, 'bandpass', 1800, 4, 0.5 * v, 0.35);
        this.noise(0.04, 'bandpass', 3200, 5, 0.6 * v, 0.6);
        break;
      case 'empty':
        this.noise(0.03, 'bandpass', 4000, 6, 0.4 * v);
        break;
      case 'melee':
        this.noise(0.12, 'bandpass', 600, 1.2, 0.6 * v);
        break;
      case 'hit':
        this.noise(0.08, 'lowpass', 900, 1, 0.7 * v);
        this.tone(220, 0.06, 'square', 0.08 * v, 0, 120);
        break;
      case 'hurt':
        this.noise(0.15, 'lowpass', 500, 1, 0.8 * v);
        this.tone(160, 0.18, 'sawtooth', 0.12 * v, 0, 80);
        break;
      case 'step':
        this.noise(0.05, 'lowpass', 380 + Math.random() * 120, 1, 0.22 * v);
        break;
      case 'interact':
        this.noise(0.05, 'bandpass', 1200, 3, 0.25 * v);
        this.tone(660, 0.06, 'sine', 0.08 * v);
        break;
      case 'ui':
        this.tone(880, 0.07, 'sine', 0.08 * v);
        break;
      case 'uiBack':
        this.tone(520, 0.08, 'sine', 0.07 * v, 0, 420);
        break;
      case 'pickup':
        this.tone(740, 0.08, 'triangle', 0.12 * v);
        this.tone(988, 0.1, 'triangle', 0.1 * v, 0.07);
        break;
      case 'evidence':
        this.tone(523, 0.18, 'triangle', 0.12 * v);
        this.tone(659, 0.18, 'triangle', 0.1 * v, 0.1);
        this.tone(784, 0.3, 'triangle', 0.1 * v, 0.2);
        break;
      case 'door':
        this.noise(0.3, 'lowpass', 300, 1, 0.4 * v);
        this.tone(90, 0.25, 'sawtooth', 0.04 * v, 0, 70);
        break;
      case 'alert':
        this.tone(300, 0.12, 'square', 0.06 * v);
        this.tone(450, 0.18, 'square', 0.06 * v, 0.1);
        break;
      case 'success':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.1 * v, i * 0.12));
        break;
      case 'failure':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.12 * v, i * 0.18));
        break;
      case 'death':
        this.tone(200, 0.6, 'sawtooth', 0.06 * v, 0, 60);
        this.noise(0.4, 'lowpass', 400, 1, 0.4 * v);
        break;
    }
  }

  /** Distant city: filtered rumble, occasional passing cars and a slow minor drone. */
  private startAmbience(): void {
    if (!this.ctx || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = c.createGain();
    g.gain.value = 0.22;
    src.connect(lp).connect(g).connect(this.musicBus);
    src.start();

    // Drone pad: two detuned oscillators through a slow filter sweep.
    const pad = c.createGain();
    pad.gain.value = 0.035;
    const pf = c.createBiquadFilter();
    pf.type = 'lowpass';
    pf.frequency.value = 500;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(pf.frequency);
    lfo.start();
    for (const f of [55, 82.4, 110.5]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(pf);
      o.start();
    }
    pf.connect(pad).connect(this.musicBus);

    const car = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'running') this.noise(2.5, 'bandpass', 300 + Math.random() * 200, 0.8, 0.12, 0, this.musicBus);
      setTimeout(car, 6000 + Math.random() * 12000);
    };
    setTimeout(car, 4000);
  }
}

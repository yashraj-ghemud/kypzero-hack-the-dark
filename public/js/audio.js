// Every sound is synthesized with WebAudio. No audio files.

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = store.get('kz_muted') === '1';
    this.hbTimer = null;
    this.drone = null;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(3.4, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    this.verb.connect(wet).connect(this.master);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.send = ctx.createGain(); this.send.gain.value = 0.6;
    this.bus.connect(this.send).connect(this.verb);
    this.noise = this._noiseBuffer(3);
  }

  resume() { this.ctx?.resume(); }

  setMuted(m) {
    this.muted = m;
    store.set('kz_muted', m ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15);
  }

  _impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noiseBuffer(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noise(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = loop;
    return s;
  }

  _filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  _gain(v = 0.0001) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  _env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /* ---------------- beds ---------------- */
  startDrone(level = 0.22) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.drone) {
      const out = this._gain(0.0001);
      out.connect(this.bus);
      const lp = this._filter('lowpass', 220, 4);
      lp.connect(out);
      [[41.2, 'sawtooth', 0.3], [41.9, 'sawtooth', 0.3], [61.8, 'triangle', 0.25], [82.1, 'sine', 0.2]].forEach(([f, type, v]) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f;
        o.connect(this._gain(v)).connect(lp);
        o.start();
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lg = this._gain(120);
      lfo.connect(lg).connect(lp.frequency);
      lfo.start();
      const n = this._noise(true);
      n.connect(this._filter('lowpass', 110)).connect(this._gain(0.5)).connect(out);
      n.start();
      const hi = ctx.createOscillator();
      hi.frequency.value = 1864;
      const trem = ctx.createOscillator(); trem.frequency.value = 0.3;
      const hg = this._gain(0.004);
      const tg = this._gain(0.003);
      trem.connect(tg).connect(hg.gain);
      hi.connect(hg).connect(out);
      hi.start(); trem.start();
      this.drone = { out };
    }
    this.setDrone(level, 1.2);
  }

  setDrone(level, tc = 0.5) {
    if (!this.drone) return;
    const g = this.drone.out.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(Math.max(level, 0), t, tc);
  }

  startHeartbeat(bpm = 60) {
    this.stopHeartbeat();
    if (!this.ctx) return;
    const beat = () => this.heartbeat(Math.min(1, bpm / 100));
    beat();
    this.hbTimer = setInterval(beat, 60000 / bpm);
  }

  stopHeartbeat() { clearInterval(this.hbTimer); this.hbTimer = null; }

  silence() {
    this.stopHeartbeat();
    this.musicBox(false);
    this.breathing(false);
    this.staticNoise(false);
    this.setDrone(0, 0.03);
    if (this.alarmNode) { try { this.alarmNode.stop(); } catch { /* already stopped */ } this.alarmNode = null; }
  }

  /* ---------------- one-shots ---------------- */
  heartbeat(v = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [0, 0.26].forEach((o, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i ? 58 : 66, t + o);
      osc.frequency.exponentialRampToValueAtTime(32, t + o + 0.18);
      const g = this._gain();
      this._env(g, t + o, 0.012, 0.95 * v * (i ? 0.7 : 1), 0.28);
      osc.connect(g).connect(this.master);
      osc.start(t + o); osc.stop(t + o + 0.4);
      const n = this._noise();
      const ng = this._gain();
      this._env(ng, t + o, 0.005, 0.35 * v, 0.08);
      n.connect(this._filter('lowpass', 160)).connect(ng).connect(this.master);
      n.start(t + o); n.stop(t + o + 0.15);
    });
  }

  buzz(dur = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 120;
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < dur * 14; k++) g.gain.setValueAtTime(Math.random() * 0.06, t + k / 14);
    g.gain.setValueAtTime(0.0001, t + dur);
    o.connect(this._filter('lowpass', 1200)).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  whisper(v = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 1.9;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    let tt = t;
    while (tt < t + dur) {
      const syl = 0.08 + Math.random() * 0.18;
      g.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.25 * v, tt + syl * 0.3);
      g.gain.linearRampToValueAtTime(0.01, tt + syl);
      tt += syl + Math.random() * 0.06;
    }
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    const n = this._noise();
    const b1 = this._filter('bandpass', 2600, 1.6);
    const b2 = this._filter('bandpass', 900, 3);
    const mix = this._gain(1);
    n.connect(b1).connect(mix);
    n.connect(b2).connect(this._gain(0.6)).connect(mix);
    mix.connect(g);
    if (pan) {
      pan.pan.setValueAtTime(-0.9, t);
      pan.pan.linearRampToValueAtTime(0.9, t + dur);
      g.connect(pan).connect(this.bus);
    } else g.connect(this.bus);
    n.start(t); n.stop(t + dur + 0.2);
  }

  rumble() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise();
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    n.connect(this._filter('lowpass', 70, 2)).connect(g).connect(this.bus);
    n.start(t); n.stop(t + 3);
  }

  hit(v = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    const g = this._gain();
    this._env(g, t, 0.005, v, 0.9);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 1);
    const n = this._noise();
    const ng = this._gain();
    this._env(ng, t, 0.002, v * 0.5, 0.25);
    n.connect(this._filter('bandpass', 400, 0.8)).connect(ng).connect(this.bus);
    n.start(t); n.stop(t + 0.3);
  }

  stinger(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 1.6;
    const out = this._gain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.015);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.bus);
    const hs = this._filter('highshelf', 2500); hs.gain.value = 6;
    hs.connect(out);
    [1, 1.06, 1.41, 1.5, 2.12, 2.83, 3.9].forEach((m) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(440 * m, t);
      o.frequency.exponentialRampToValueAtTime(440 * m * 1.35, t + dur);
      o.connect(this._gain(0.14)).connect(hs);
      o.start(t); o.stop(t + dur);
    });
    const n = this._noise();
    const bp = this._filter('bandpass', 800, 1.2);
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(3800, t + 0.9);
    n.connect(bp).connect(this._gain(0.9)).connect(out);
    n.start(t); n.stop(t + dur);
    this.hit(1);
  }

  alarm(dur = 4) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    for (let k = 0; k < dur * 2; k++) {
      o.frequency.setValueAtTime(620, t + k * 0.5);
      o.frequency.linearRampToValueAtTime(880, t + k * 0.5 + 0.45);
    }
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.setValueAtTime(0.06, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(this._filter('bandpass', 900, 0.7)).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur);
    this.alarmNode = o;
  }

  door() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 2.4;
    const n = this._noise(true);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const bp = this._filter('bandpass', 180, 3);
    bp.frequency.setValueAtTime(140, t);
    bp.frequency.linearRampToValueAtTime(320, t + dur);
    n.connect(bp).connect(g).connect(this.bus);
    n.start(t); n.stop(t + dur);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(38, t);
    o.frequency.linearRampToValueAtTime(52, t + dur);
    const og = this._gain();
    this._env(og, t, 0.3, 0.25, dur - 0.3);
    o.connect(this._filter('lowpass', 300)).connect(og).connect(this.bus);
    o.start(t); o.stop(t + dur);
    const c = this._noise();
    const cg = this._gain();
    this._env(cg, t, 0.002, 0.6, 0.12);
    c.connect(this._filter('highpass', 2000)).connect(cg).connect(this.bus);
    c.start(t); c.stop(t + 0.2);
  }

  boom() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 2.8);
    const g = this._gain();
    this._env(g, t, 0.02, 0.9, 3);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 3.2);
    const n = this._noise();
    const ng = this._gain();
    this._env(ng, t, 0.01, 0.6, 2.2);
    n.connect(this._filter('lowpass', 90, 1)).connect(ng).connect(this.bus);
    n.start(t); n.stop(t + 2.5);
  }

  whoosh(dur = 1.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise();
    const bp = this._filter('bandpass', 300, 0.9);
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(this.bus);
    n.start(t); n.stop(t + dur);
  }

  tick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(2200 + Math.random() * 600, t);
    const g = this._gain();
    this._env(g, t, 0.001, 0.025, 0.03);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.05);
  }

  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const g = this._gain();
    this._env(g, t, 0.002, 0.25, 0.14);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.2);
  }

  sealed() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.boom();
    [220, 261.63, 311.13, 415.3, 440].forEach((f, i) => {
      [0, 3].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = det + (Math.random() - 0.5) * 8;
        const g = this._gain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 1 + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
        o.connect(g).connect(this.bus);
        o.start(t); o.stop(t + 4.6);
      });
    });
  }

  /* ---------------- tape / found footage ---------------- */
  staticNoise(on, vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on) {
      if (this.hiss) return;
      const n = this._noise(true);
      const g = this._gain();
      g.gain.setTargetAtTime(vol, t, 0.05);
      n.connect(this._filter('highpass', 1200)).connect(g).connect(this.master);
      n.start(t);
      this.hiss = { n, g };
    } else if (this.hiss) {
      const { n, g } = this.hiss;
      g.gain.setTargetAtTime(0, t, 0.08);
      n.stop(t + 0.5);
      this.hiss = null;
    }
  }

  screenBurst(v = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise();
    const g = this._gain();
    this._env(g, t, 0.005, v, 0.35);
    n.connect(this._filter('highpass', 900)).connect(g).connect(this.bus);
    n.start(t); n.stop(t + 0.4);
  }

  tapeStart() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(30, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    const g = this._gain();
    this._env(g, t, 0.3, 0.12, 0.8);
    o.connect(this._filter('lowpass', 500)).connect(g).connect(this.bus);
    o.start(t); o.stop(t + 1.2);
    this.hit(0.3);
  }

  tapeStop() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(18, t + 1.1);
    const g = this._gain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(this._filter('lowpass', 1400)).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.25);
    this.screenBurst(0.5);
  }

  /* ---------------- the lullaby ---------------- */
  musicBox(on) {
    clearTimeout(this.mbTimer);
    if (!on || !this.ctx) { this.mb = null; return; }
    const notes = [81, 84, 88, 81, 79, 83, 88, 79, 77, 81, 86, 77, 76, 80, 83, 88];
    this.mb = { i: 0, rate: 1, detune: 0 };
    const play = () => {
      if (!this.mb) return;
      const mb = this.mb;
      this._bell(440 * Math.pow(2, (notes[mb.i % notes.length] - 69) / 12), mb.detune);
      mb.i++;
      this.mbTimer = setTimeout(play, 330 / mb.rate);
    };
    play();
  }

  musicBoxBend(rate, detune, duration) {
    if (!this.mb) return;
    const mb = this.mb, r0 = mb.rate, d0 = mb.detune, t0 = performance.now();
    const step = () => {
      if (this.mb !== mb) return;
      const k = Math.min(1, (performance.now() - t0) / (duration * 1000));
      mb.rate = r0 + (rate - r0) * k;
      mb.detune = d0 + (detune - d0) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  _bell(f, detune = 0) {
    const ctx = this.ctx, t = ctx.currentTime;
    [[1, 0.09, 1.4], [2.76, 0.025, 0.4], [5.4, 0.01, 0.2]].forEach(([m, v, d]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      o.detune.value = detune + (Math.random() - 0.5) * 10;
      const g = this._gain();
      this._env(g, t, 0.003, v, d);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + d + 0.05);
    });
  }

  /* ---------------- the body in the dark ---------------- */
  typing(n = 10, spread = 0.09) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    let tt = t;
    for (let i = 0; i < n; i++) {
      tt += spread * (0.5 + Math.random());
      const s = this._noise();
      const g = this._gain();
      this._env(g, tt, 0.001, 0.18, 0.03);
      s.connect(this._filter('bandpass', 2500 + Math.random() * 1500, 2)).connect(g).connect(this.bus);
      s.start(tt); s.stop(tt + 0.05);
    }
  }

  crtOn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(7800, t);
    o.frequency.exponentialRampToValueAtTime(6200, t + 0.5);
    const g = this._gain();
    this._env(g, t, 0.01, 0.02, 0.6);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.7);
    const n = this._noise();
    const ng = this._gain();
    this._env(ng, t, 0.002, 0.12, 0.08);
    n.connect(this._filter('lowpass', 300)).connect(ng).connect(this.bus);
    n.start(t); n.stop(t + 0.12);
  }

  creak(dur = 1.4) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    for (let k = 0; k < dur * 10; k++) o.frequency.setValueAtTime(55 + Math.random() * 60, t + k / 10);
    const g = this._gain();
    this._env(g, t, 0.2, 0.12, dur);
    o.connect(this._filter('bandpass', 750, 9)).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.3);
  }

  relay() {
    if (!this.ctx) return;
    this.hit(0.5);
    const t = this.ctx.currentTime;
    const n = this._noise();
    const g = this._gain();
    this._env(g, t, 0.001, 0.4, 0.03);
    n.connect(this._filter('highpass', 2500)).connect(g).connect(this.bus);
    n.start(t); n.stop(t + 0.05);
  }

  breathing(on, rate = 1) {
    clearTimeout(this.brTimer);
    if (!on || !this.ctx) return;
    const cycle = () => {
      const t = this.ctx.currentTime, len = 1.1 / rate;
      [[0, 1100, 0.14], [len, 700, 0.18]].forEach(([o, f, v]) => {
        const n = this._noise();
        const g = this._gain();
        g.gain.setValueAtTime(0.0001, t + o);
        g.gain.linearRampToValueAtTime(v, t + o + len * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + o + len * 0.95);
        n.connect(this._filter('bandpass', f, 1.2)).connect(g).connect(this.master);
        n.start(t + o); n.stop(t + o + len);
      });
      this.brTimer = setTimeout(cycle, len * 2000 + 80);
    };
    cycle();
  }

  crack(v = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const count = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < count; i++) {
      const tt = t + i * (0.015 + Math.random() * 0.03);
      const n = this._noise();
      const g = this._gain();
      this._env(g, tt, 0.001, v * (0.5 + Math.random() * 0.5), 0.02);
      n.connect(this._filter('bandpass', 1500 + Math.random() * 2500, 3)).connect(g).connect(this.bus);
      n.start(tt); n.stop(tt + 0.04);
    }
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const og = this._gain();
    this._env(og, t, 0.002, v * 0.5, 0.1);
    o.connect(og).connect(this.bus);
    o.start(t); o.stop(t + 0.15);
  }

  drip() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.07);
    const g = this._gain();
    this._env(g, t, 0.002, 0.3, 0.1);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.15);
  }

  skitter(dur = 0.8) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < dur * 40; i++) {
      const tt = t + Math.random() * dur;
      const n = this._noise();
      const g = this._gain();
      this._env(g, tt, 0.001, 0.25, 0.015);
      n.connect(this._filter('bandpass', 1800 + Math.random() * 2000, 4)).connect(g).connect(this.bus);
      n.start(tt); n.stop(tt + 0.03);
    }
  }

  footstep(v = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise();
    const g = this._gain();
    this._env(g, t, 0.004, v, 0.14);
    n.connect(this._filter('lowpass', 180, 1)).connect(g).connect(this.bus);
    n.start(t); n.stop(t + 0.2);
    const s = this._noise();
    const sg = this._gain();
    this._env(sg, t + 0.02, 0.01, v * 0.12, 0.2);
    s.connect(this._filter('bandpass', 1200, 1)).connect(sg).connect(this.bus);
    s.start(t); s.stop(t + 0.3);
  }

  fall() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.hit(1);
    const n = this._noise();
    const g = this._gain();
    this._env(g, t + 0.05, 0.001, 0.5, 0.45);
    n.connect(this._filter('highpass', 4000)).connect(g).connect(this.bus);
    n.start(t); n.stop(t + 0.6);
    [3100, 4300, 5200].forEach((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = this._gain();
      this._env(og, t + 0.05, 0.001, 0.05, 0.3);
      o.connect(og).connect(this.bus);
      o.start(t); o.stop(t + 0.5);
    });
  }

  scream(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 2;
    this.stinger(v);
    const out = this._gain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.03);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.bus);
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vg = this._gain(25);
    vib.connect(vg);
    [0, 7, -12].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(620, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(380, t + dur);
      o.detune.value = det * 10;
      vg.connect(o.frequency);
      const f1 = this._filter('bandpass', 950, 6);
      const f2 = this._filter('bandpass', 2600, 7);
      o.connect(f1).connect(out);
      o.connect(f2).connect(out);
      o.start(t); o.stop(t + dur);
    });
    vib.start(t); vib.stop(t + dur);
  }
}

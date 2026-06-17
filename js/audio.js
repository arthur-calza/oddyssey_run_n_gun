/* ============================================================
   audio.js — procedural sound via WebAudio (no asset files)
   Created lazily on first user gesture (autoplay policy).
   ============================================================ */
const Sound = {
  ctx: null, master: null, enabled: true,
  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  _osc(type, f0, f1, dur, vol, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(dur, vol, lp, hp) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    let node = src;
    if (lp) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (hp) { const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    node.connect(g); g.connect(this.master);
    src.start(t);
  },

  // ---- named sfx (throttled to avoid spam) ----
  _last: {},
  _throttle(name, ms) { const t = performance.now(); if ((this._last[name] || 0) + ms > t) return false; this._last[name] = t; return true; },

  shot(kind) {
    if (!this.enabled || !this._throttle('shot', 35)) return;
    this.ensure();
    if (kind === 'rifle')        { this._osc('square', 680, 120, 0.10, 0.25); this._noise(0.06, 0.18, 2500); }
    else if (kind === 'mg')      { this._osc('square', 520, 180, 0.05, 0.16); this._noise(0.03, 0.12, 3000); }
    else if (kind === 'shotgun') { this._noise(0.16, 0.34, 1600); this._osc('square', 240, 60, 0.16, 0.22); }
    else if (kind === 'flame')   { this._noise(0.10, 0.10, 900, 200); }
    else if (kind === 'lob')     { this._osc('sine', 420, 700, 0.10, 0.16); }
    else                         { this._osc('square', 500, 140, 0.08, 0.2); }
  },
  hit()   { if (!this._throttle('hit', 25)) return; this.ensure(); this._noise(0.05, 0.16, 3500, 800); },
  flesh() { if (!this._throttle('flesh', 30)) return; this.ensure(); this._osc('sawtooth', 180, 60, 0.10, 0.18); this._noise(0.05, 0.12, 1200); },
  explode() {
    this.ensure();
    this._noise(0.5, 0.5, 800);
    this._osc('sine', 160, 30, 0.5, 0.4);
    this._osc('square', 90, 20, 0.4, 0.25);
  },
  crumble() { if (!this._throttle('crumble', 40)) return; this.ensure(); this._noise(0.12, 0.18, 1400); },
  jump()  { this.ensure(); this._osc('square', 320, 620, 0.12, 0.14); },
  rescue(){ this.ensure(); this._osc('square', 440, 660, 0.10, 0.2); setTimeout(() => this._osc('square', 660, 990, 0.16, 0.2), 90); },
  hurt()  { this.ensure(); this._osc('sawtooth', 300, 90, 0.2, 0.25); },
  die()   { this.ensure(); this._osc('sawtooth', 260, 40, 0.5, 0.3); this._noise(0.3, 0.2, 900); },
  swap()  { this.ensure(); this._osc('square', 500, 800, 0.08, 0.16); },
  win()   { this.ensure(); [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._osc('square', f, f, 0.18, 0.2), i * 130)); },
  // --- fantasy combat ---
  slash() { if (!this._throttle('slash', 30)) return; this.ensure(); this._noise(0.10, 0.20, 5000, 1200); this._osc('triangle', 700, 200, 0.08, 0.10); },
  cast()  { if (!this._throttle('cast', 30)) return; this.ensure(); this._osc('sine', 300, 900, 0.16, 0.16); this._osc('triangle', 600, 1400, 0.12, 0.08); },
  bow()   { if (!this._throttle('bow', 30)) return; this.ensure(); this._osc('square', 300, 90, 0.10, 0.12); this._noise(0.05, 0.10, 4000, 1500); },
  zap()   { if (!this._throttle('zap', 30)) return; this.ensure(); this._osc('sawtooth', 1200, 200, 0.14, 0.14); this._noise(0.08, 0.12, 6000, 2000); },
  thump() { this.ensure(); this._osc('sine', 120, 28, 0.5, 0.4); this._noise(0.4, 0.35, 600); },
  note()  { if (!this._throttle('note', 40)) return; this.ensure(); this._osc('triangle', pick([523, 587, 659, 784, 880]), 0, 0.18, 0.10); },
  heal()  { this.ensure(); [523, 659, 880].forEach((f, i) => setTimeout(() => this._osc('sine', f, f * 1.3, 0.2, 0.12), i * 70)); },
  coin()  { if (!this._throttle('coin', 25)) return; this.ensure(); this._osc('square', 880, 1320, 0.07, 0.10); this._osc('square', 1320, 1760, 0.06, 0.07); },
};

/* ============================================================
   Sound.music — trilha épica procedural (sem arquivos)
   Loop heróico em Lá menor (i–VI–III–VII): baixo + acordes +
   bateria + melodia. Ajuste tempo/volume/notas para refinar.
   ============================================================ */
Sound.music = {
  playing: false, _timer: null, beat: 0, gain: null, spb: 0.6,
  bpm: 100, vol: 0.5,                 // <<< volume da trilha (relativo ao master)
  // notas (Hz)
  N: { 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.0, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81,
       'F3': 174.61, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
       'F4': 349.23, 'G4': 392.0, 'A4': 440.0 },
  // 1 acorde por compasso (4 compassos): Am – F – C – G
  bassN:   ['A2', 'F2', 'C3', 'G2'],
  chordsN: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']],
  // melodia heróica (16 beats; null = pausa)
  melN: ['E4', null, 'A4', 'C4', 'F4', null, 'C4', 'D4', 'E4', null, 'G4', 'E4', 'D4', null, 'B3', 'D4'],

  start() {
    Sound.ensure(); Sound.resume();
    if (!Sound.ctx || this.playing) return;
    this.playing = true; this.beat = 0; this.spb = 60 / this.bpm;
    this.gain = Sound.ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, Sound.ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(this.vol, Sound.ctx.currentTime + 1.5);  // fade-in
    this.gain.connect(Sound.master);
    this._beat();
    this._timer = setInterval(() => this._beat(), this.spb * 1000);
  },
  stop() {
    if (!this.playing) return;
    this.playing = false; clearInterval(this._timer); this._timer = null;
    if (this.gain && Sound.ctx) {
      const g = this.gain, t = Sound.ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 700);
    }
    this.gain = null;
  },

  _tone(t, type, f, dur, vol, attack) {
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + 0.03);
  },
  _drum(t, kind) {
    const c = Sound.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.18);
    } else { // snare
      const n = Math.floor(c.sampleRate * 0.13), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1100;
      const g = c.createGain(); g.gain.value = 0.22;
      s.connect(f); f.connect(g); g.connect(this.gain); s.start(t);
    }
  },
  _beat() {
    const c = Sound.ctx; if (!c || !this.playing || !this.gain) return;
    const t = c.currentTime + 0.03, spb = this.spb, b = this.beat % 16, bar = (b / 4) | 0, bib = b % 4;
    const N = this.N;
    this._tone(t, 'triangle', N[this.bassN[bar]], spb * 0.95, 0.5, 0.01);          // baixo pulsante
    if (bib === 0) this.chordsN[bar].forEach(nm => this._tone(t, 'triangle', N[nm], spb * 4 * 0.96, 0.085, 0.06)); // pad do compasso
    if (bib === 0 || bib === 2) this._drum(t, 'kick');
    if (bib === 1 || bib === 3) this._drum(t, 'snare');
    const mel = this.melN[b];
    if (mel) this._tone(t, 'square', N[mel], spb * 0.9, 0.14, 0.01);                // melodia heróica
    this.beat++;
  },
};

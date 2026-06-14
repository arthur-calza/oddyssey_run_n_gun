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

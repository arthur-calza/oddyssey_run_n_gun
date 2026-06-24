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
   Sound.music — trilha procedural de BATALHA, uma por nível.
   Step-sequencer em colcheias: baixo motor + tambores tribais
   (bumbo, caixa, toms graves/agudos, chocalho) + pad de poder
   + melodia modal. Cada faixa usa um modo/clima diferente para
   soar épica, tensa e única.  start(levelIndex) escolhe a faixa.
   ============================================================ */
Sound.music = {
  // DESLIGADA a pedido: a trilha procedural não combina com o clima do jogo.
  // (As faixas/sequenciador ficam aqui para uma futura trilha própria; basta
  //  pôr `enabled: true` para reativar o sequenciador antigo.)
  enabled: false,
  playing: false, _timer: null, step: 0, gain: null, stepDur: 0.22, cur: 0,

  // frequência (Hz) a partir do nome da nota, ex.: 'A2', 'C#3'
  _SEMI: { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 },
  _f(name) {
    if (!name) return 0;
    const o = +name.slice(-1), n = name.slice(0, -1);
    return 440 * Math.pow(2, ((o + 1) * 12 + this._SEMI[n] - 69) / 12);
  },

  // === FAIXAS (uma por fase) — len 16 colcheias (2 compassos). drum: K bumbo, S caixa,
  // T tom agudo, t tom grave, H chocalho/prato, C palma; '.' = silêncio (combine, ex. 'Kt') ===
  tracks: [
    { // 0 — PORTÃO DE FERRO: marcha marcial heroica (Lá menor)
      name: 'iron', bpm: 130, vol: 0.5, bassType: 'sawtooth', melType: 'square',
      bass: ['A1','A2','A1','E2','F1','F2','F1','C2','C2','C3','C2','G2','G1','G2','D2','E2'],
      chord: { 0:['A3','C4','E4'], 4:['F3','A3','C4'], 8:['C4','E4','G4'], 12:['G3','B3','D4'] },
      mel:  ['E4',null,'A4','E4','F4',null,'C4','D4','E4',null,'G4','E4','D4','B3',null,'E4'],
      drum: ['K','H','S','t','K','H','S','T','K','H','S','t','K','T','S','t'],
    },
    { // 1 — VILA DOS LAMENTOS: tensão sombria e lamentosa (Ré menor harmônica)
      name: 'lament', bpm: 116, vol: 0.5, bassType: 'triangle', melType: 'triangle',
      bass: ['D2','D2','A2','D2','Bb1','Bb1','F2','Bb1','C2','C2','G2','C2','A1','A1','E2','A1'],
      chord: { 0:['D3','F3','A3'], 4:['Bb2','D3','F3'], 8:['C3','E3','G3'], 12:['A2','C#3','E3'] },
      mel:  ['D4',null,'F4','E4','D4',null,'A3',null,'C4',null,'E4','D4','C#4',null,'A3',null],
      drum: ['K','.','S','.','t','.','S','.','K','.','S','t','t','.','S','.'],
    },
    { // 2 — CATACUMBAS: drone exótico e ritualístico (Mi frígio)
      name: 'crypt', bpm: 110, vol: 0.48, bassType: 'sawtooth', melType: 'triangle',
      bass: ['E2','E2','E2','F2','E2','E2','C2','D2','E2','E2','E2','F2','G2','G2','F2','E2'],
      chord: { 0:['E3','G3','B3'], 4:['F3','A3','C4'], 8:['E3','G3','B3'], 12:['D3','F3','A3'] },
      mel:  ['E4',null,null,'F4',null,'E4',null,null,'G4',null,'F4','E4',null,'D4',null,null],
      drum: ['K','.','.','t','.','.','S','.','K','.','t','.','.','.','S','.'],
    },
    { // 3 — O TRONO DO DEVORADOR: batalha frenética de chefe (Dó menor harmônica)
      name: 'boss', bpm: 148, vol: 0.52, bassType: 'sawtooth', melType: 'square',
      bass: ['C2','C2','G2','C2','Ab1','Ab1','Eb2','Ab1','F2','F2','C3','F2','G2','G2','B2','G2'],
      chord: { 0:['C3','Eb3','G3'], 4:['Ab2','C3','Eb3'], 8:['F2','Ab2','C3'], 12:['G2','B2','D3'] },
      mel:  ['C5',null,'G4','C5','Ab4',null,'Eb4','F4','G4',null,'C5','B4','C5',null,'G4','B4'],
      drum: ['K','H','S','K','K','H','S','H','K','H','S','K','T','t','S','T'],
    },
    { // 4 — A PRISÃO DE PEDRA: tambores tribais motores (Sol menor)
      name: 'stone', bpm: 126, vol: 0.5, bassType: 'sawtooth', melType: 'square',
      bass: ['G1','G2','D2','G2','Eb2','Eb2','Bb1','Eb2','F1','F2','C2','F2','D2','D2','A2','D2'],
      chord: { 0:['G3','Bb3','D4'], 4:['Eb3','G3','Bb3'], 8:['Bb2','D3','F3'], 12:['D3','F#3','A3'] },
      mel:  ['G4',null,'Bb4','G4','D4',null,'Eb4','F4','G4',null,'D5','Bb4','A4',null,'F#4','A4'],
      drum: ['K','t','S','t','K','T','S','t','K','t','S','t','T','t','S','T'],
    },
    { // 5 — O ARSENAL: caos exótico e veloz (Lá frígio dominante)
      name: 'arsenal', bpm: 152, vol: 0.52, bassType: 'sawtooth', melType: 'square',
      bass: ['A1','A2','A1','E2','Bb1','Bb1','F2','Bb1','A1','A2','C#2','E2','D2','D2','A1','E2'],
      chord: { 0:['A2','C#3','E3'], 4:['Bb2','D3','F3'], 8:['D3','F3','A3'], 12:['E3','G#3','B3'] },
      mel:  ['A4','Bb4','C#5','A4','E4',null,'F4','E4','D4','C#4','D4','E4','F4',null,'E4','A4'],
      drum: ['K','H','S','H','K','H','S','K','K','H','S','H','K','T','S','T'],
    },
    { // 6 — TEMPLO NA SELVA: ritmo tribal de toms na mata (Mi dórico)
      name: 'jungle', bpm: 122, vol: 0.5, bassType: 'triangle', melType: 'triangle',
      bass: ['E2','E2','B2','E2','A1','A1','E2','A1','D2','D2','A2','D2','B1','B1','F#2','B1'],
      chord: { 0:['E3','G3','B3'], 4:['A2','C#3','E3'], 8:['D3','F#3','A3'], 12:['B2','D3','F#3'] },
      mel:  ['E4',null,'G4','A4','B4',null,'A4','G4','E4',null,'D4','E4','G4',null,'B4','A4'],
      drum: ['K','T','t','T','S','T','t','T','K','T','t','T','S','T','t','T'],
    },
  ],

  start(idx = 0) {
    if (!this.enabled) return;   // trilha desligada (ver acima)
    Sound.ensure(); Sound.resume();
    if (!Sound.ctx || this.playing) return;
    this.cur = ((idx % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const tk = this.tracks[this.cur];
    this.playing = true; this.step = 0; this.stepDur = 60 / tk.bpm / 2;   // colcheias
    this.gain = Sound.ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, Sound.ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(tk.vol != null ? tk.vol : 0.5, Sound.ctx.currentTime + 1.8);  // fade-in
    this.gain.connect(Sound.master);
    this._tick();
    this._timer = setInterval(() => this._tick(), this.stepDur * 1000);
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
    if (!f) return;
    const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + 0.03);
  },
  _noiseSrc(dur) {
    const c = Sound.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf; return s;
  },
  _env(node, t, v, dur) { const g = Sound.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(g); g.connect(this.gain); return g; },
  _drum(t, kind) {
    const c = Sound.ctx;
    if (kind === 'K') {                                   // bumbo de guerra
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
      this._env(o, t, 0.75, 0.2); o.start(t); o.stop(t + 0.22);
    } else if (kind === 'S') {                            // caixa
      const n = this._noiseSrc(0.18), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
      n.connect(f); this._env(f, t, 0.3, 0.16); n.start(t);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 190; this._env(o, t, 0.12, 0.1); o.start(t); o.stop(t + 0.12);
    } else if (kind === 'T' || kind === 't') {            // toms tribais (agudo / grave)
      const f0 = kind === 'T' ? 250 : 140, o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.22);
      this._env(o, t, 0.5, 0.26); o.start(t); o.stop(t + 0.3);
      const n = this._noiseSrc(0.1), lf = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = f0 * 3.5;
      n.connect(lf); this._env(lf, t, 0.07, 0.1); n.start(t);
    } else if (kind === 'H') {                            // chocalho / prato
      const n = this._noiseSrc(0.05), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
      n.connect(f); this._env(f, t, 0.1, 0.05); n.start(t);
    } else if (kind === 'C') {                            // palma
      const n = this._noiseSrc(0.12), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 1.2;
      n.connect(f); this._env(f, t, 0.22, 0.12); n.start(t);
    }
  },
  _tick() {
    const c = Sound.ctx; if (!c || !this.playing || !this.gain) return;
    const t = c.currentTime + 0.04, tk = this.tracks[this.cur], sd = this.stepDur, s = this.step % 16;
    // baixo motor
    this._tone(t, tk.bassType || 'sawtooth', this._f(tk.bass[s % tk.bass.length]), sd * 1.35, 0.32, 0.005);
    // pad de poder (sustentado por compasso, nos passos marcados)
    const ch = tk.chord && tk.chord[s];
    if (ch) ch.forEach(nm => this._tone(t, 'triangle', this._f(nm), sd * 8 * 0.96, 0.06, 0.05));
    // melodia modal
    const mn = tk.mel[s % tk.mel.length];
    if (mn) this._tone(t, tk.melType || 'square', this._f(mn), sd * 1.5, 0.12, 0.008);
    // percussão tribal
    const dr = tk.drum[s % tk.drum.length];
    if (dr && dr !== '.') for (const k of dr) this._drum(t, k);
    this.step++;
  },
};

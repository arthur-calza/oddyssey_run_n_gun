/* ============================================================
   spritelab.js — ANIMAÇÕES DOS PERSONAGENS
   Ambiente para INSPECIONAR, quadro a quadro, todas as sprites que
   um personagem (herói ou inimigo) exibe na tela, separadas por AÇÃO
   (Parado / Correndo / Pulo / Queda / Dano / Morte / Arma).

   Mostra UM quadro de cada vez, ampliado com grade de pixels — base
   para, no futuro, ajustes finos manuais (edição de pixels) e para
   adicionar/duplicar quadros dando mais fluidez às animações.

   Renderiza no MESMO canvas do jogo; controlado por main.js
   (SpriteLab.open / SpriteLab.close / SpriteLab.tick).
   ============================================================ */

const SpriteLab = {
  active: false, canvas: null, ctx: null, onBack: null, time: 0,
  panel: null, listEl: null, infoEl: null, ctrlEl: null,
  charKey: null, charName: '', action: 'idle', frameIdx: 0,
  playing: false, playT: 0, grid: true, zoomK: 1, showWeaponOverlay: false,

  ACTIONS: [
    { id: 'idle',   label: 'Parado',   fps: 4 },
    { id: 'run',    label: 'Correndo', fps: 12 },
    { id: 'jump',   label: 'Pulo',     fps: 1 },
    { id: 'fall',   label: 'Queda',    fps: 1 },
    { id: 'hurt',   label: 'Dano',     fps: 6 },
    { id: 'death',  label: 'Morte',    fps: 8 },
    { id: 'weapon', label: 'Arma',     fps: 2 },
  ],
  ENEMY_LABEL: {
    zombie: 'Zumbi', werewolf: 'Lobisomem', dragonman: 'Homem-Dragão', demon: 'Demônio',
    wolf: 'Lobo', direwolf: 'Lobo-Gigante', flayer: 'Devorador (Chefe)',
  },

  open(canvas, onBack) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.onBack = onBack; this.active = true; this.time = 0;
    if (!SPR.ready) SPR.build();
    this._buildDOM();
    this._buildList();
    // seleciona o primeiro herói por padrão
    if (!this.charKey) this.selectChar(HEROES[0].spr, HEROES[0].name);
    else this.selectChar(this.charKey, this.charName);
    this._key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); this.onBack && this.onBack(); } };
    addEventListener('keydown', this._key, true);
  },
  close() {
    this.active = false; this.playing = false;
    if (this.panel) this.panel.style.display = 'none';
    removeEventListener('keydown', this._key, true);
  },

  // ---------- helpers ----------
  _isHero(key) { return HEROES.some(h => h.spr === key); },
  _actionLabel(id) { const a = this.ACTIONS.find(x => x.id === id); return a ? a.label : id; },

  // quadros (canvas) da ação atual: corpo (sheets) OU arma (braço+arma pixelizado)
  _frames(action) {
    const key = this.charKey, def = SPR.defs[key]; if (!def) return [];
    if (action === 'weapon') {
      if (!def.weapon) return [];
      const PXF = def.pxf || SPR.PXF;
      const out = [{ cv: SPR._pixWeaponFrame(def, null, 0, PXF, def.weapon), label: 'Arma → (mira p/ direita)' }];
      if (this._isHero(key)) out.push({ cv: SPR._pixWeaponFrame(def, 'sword', 0, PXF, def.weapon), label: 'Modo lâmina (investida)' });
      return out;
    }
    const arr = (SPR.sheets[key] && SPR.sheets[key][action]) || [];
    return arr.map((cv, i) => ({ cv, label: 'Quadro ' + (i + 1) }));
  },

  // ---------- DOM ----------
  _buildDOM() {
    if (this.panel) { this.panel.style.display = 'block'; return; }
    if (!document.getElementById('spritelabCSS')) {
      const st = document.createElement('style'); st.id = 'spritelabCSS';
      st.textContent = `
        #spritelab{position:fixed;inset:0;pointer-events:none;z-index:50;
          font-family:"Trebuchet MS","Segoe UI",sans-serif;color:#e8e0cf;}
        #spritelab .gpanel{pointer-events:auto;background:rgba(20,15,10,0.86);
          border:2px solid #5a4326;border-radius:8px;box-shadow:0 0 0 2px #000,0 6px 24px #000;}
        #spritelab .gtop{position:absolute;top:12px;left:50%;transform:translateX(-50%);
          display:flex;gap:10px;align-items:center;padding:8px 14px;}
        #spritelab .gtitle{color:#e8b94a;font-weight:bold;font-size:16px;letter-spacing:2px;}
        #spritelab .gback{cursor:pointer;font:inherit;font-weight:bold;font-size:14px;color:#e8e0cf;
          background:linear-gradient(#3a2c1c,#241a10);border:2px solid #b1322c;border-radius:6px;padding:6px 12px;}
        #spritelab .gback:hover{background:#4a2018;}
        #spritelab .glist{position:absolute;top:62px;left:12px;bottom:12px;width:212px;overflow-y:auto;padding:8px;}
        #spritelab .ggroup{color:#caa86a;font-size:11px;letter-spacing:1px;margin:6px 2px 4px;text-transform:uppercase;}
        #spritelab .gitem{display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;font:inherit;text-align:left;
          color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 9px;margin-bottom:5px;transition:.1s;}
        #spritelab .gitem:hover{background:#3a2c1c;}
        #spritelab .gitem.on{border-color:#e8b94a;color:#e8b94a;}
        #spritelab .gitem .gem{font-size:16px;width:20px;text-align:center;}
        #spritelab .gitem .gname{font-size:13px;font-weight:bold;}
        #spritelab .gitem .gsub{font-size:10px;color:#9a8f7d;}
        #spritelab .ginfo{position:absolute;top:62px;right:12px;width:236px;bottom:12px;overflow-y:auto;padding:12px 12px;}
        #spritelab .ginfo h3{color:#e8b94a;font-size:17px;margin-bottom:4px;letter-spacing:1px;}
        #spritelab .ginfo .gsub{color:#9a8f7d;font-size:12px;margin-bottom:8px;}
        #spritelab .filmlabel{color:#caa86a;font-size:11px;letter-spacing:1px;margin:8px 0 5px;text-transform:uppercase;}
        #spritelab .film{display:flex;flex-wrap:wrap;gap:6px;}
        #spritelab .fcell{position:relative;cursor:pointer;border:2px solid #4a3826;border-radius:5px;background:
          repeating-conic-gradient(#15110e 0% 25%, #1d1813 0% 50%) 0/14px 14px;padding:0;line-height:0;transition:.1s;}
        #spritelab .fcell:hover{border-color:#caa86a;}
        #spritelab .fcell.on{border-color:#e8b94a;box-shadow:0 0 8px rgba(232,185,74,.5);}
        #spritelab .fcell canvas{width:48px;height:54px;image-rendering:pixelated;display:block;}
        #spritelab .fcell .fn{position:absolute;bottom:1px;right:2px;font-size:9px;color:#fff;text-shadow:0 0 3px #000,1px 1px 0 #000;}
        #spritelab .gctrl{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
          display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;padding:8px 12px;max-width:64vw;}
        #spritelab .gsep{width:1px;height:22px;background:#5a4326;margin:0 4px;}
        #spritelab .gsbtn{cursor:pointer;font:inherit;font-size:13px;font-weight:bold;color:#e8e0cf;
          background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 11px;transition:.1s;}
        #spritelab .gsbtn:hover{background:#3a2c1c;} #spritelab .gsbtn.on{border-color:#6fd0ff;color:#6fd0ff;}
        #spritelab .ghint{position:absolute;bottom:60px;right:18px;color:#9a8f7d;font-size:12px;pointer-events:none;max-width:220px;text-align:right;}
      `;
      document.head.appendChild(st);
    }
    const g = document.createElement('div'); g.id = 'spritelab';
    g.innerHTML = `
      <div class="gpanel gtop">
        <button class="gback" data-back>‹ Menu</button>
        <span class="gtitle">🎞 ANIMAÇÕES DOS PERSONAGENS</span>
      </div>
      <div class="gpanel glist" id="slList"></div>
      <div class="gpanel ginfo" id="slInfo"></div>
      <div class="gpanel gctrl" id="slCtrl"></div>
      <div class="ghint">Cada ação é uma sequência de quadros. Veja-os um a um — base para ajustes finos e novos quadros.</div>`;
    document.body.appendChild(g);
    this.panel = g;
    this.listEl = g.querySelector('#slList');
    this.infoEl = g.querySelector('#slInfo');
    this.ctrlEl = g.querySelector('#slCtrl');
    g.querySelector('[data-back]').onclick = () => { this.close(); this.onBack && this.onBack(); };
  },

  _buildList() {
    const L = this.listEl; L.innerHTML = '';
    const mk = (title) => { const d = document.createElement('div'); d.className = 'ggroup'; d.textContent = title; L.appendChild(d); };
    const item = (key, name, sub, icon, on, onclick) => {
      const b = document.createElement('button'); b.className = 'gitem' + (on ? ' on' : '');
      b.innerHTML = `<span class="gem">${icon}</span><span><div class="gname">${name}</div><div class="gsub">${sub}</div></span>`;
      b.onclick = onclick; L.appendChild(b);
    };
    mk('Heróis');
    HEROES.forEach(h => item(h.spr, h.name, h.spr, h.icon || '♟', this.charKey === h.spr, () => this.selectChar(h.spr, h.name)));
    mk('Inimigos');
    for (const key in ENEMY_TYPES) {
      const spr = ENEMY_TYPES[key].spr, name = this.ENEMY_LABEL[key] || key;
      item(spr, name, key, ENEMY_TYPES[key].boss ? '★' : ENEMY_TYPES[key].mini ? '✦' : '•', this.charKey === spr, () => this.selectChar(spr, name));
    }
  },

  selectChar(key, name) {
    this.charKey = key; this.charName = name;
    // mantém a ação se existir quadros; senão volta p/ idle
    if (!this._frames(this.action).length) this.action = 'idle';
    this.frameIdx = 0; this.playT = 0;
    this._buildList(); this._buildCtrl(); this._buildInfo();
  },
  setAction(id) { this.action = id; this.frameIdx = 0; this.playT = 0; this._buildCtrl(); this._buildInfo(); },
  setFrame(i) { const n = this._frames(this.action).length; if (!n) return; this.frameIdx = ((i % n) + n) % n; this._highlightFilm(); },

  _buildCtrl() {
    const c = this.ctrlEl; c.innerHTML = '';
    const def = SPR.defs[this.charKey];
    this.ACTIONS.forEach(a => {
      if (a.id === 'weapon' && (!def || !def.weapon)) return;       // só personagens armados têm "Arma"
      const b = document.createElement('button'); b.className = 'gsbtn' + (this.action === a.id ? ' on' : '');
      b.textContent = a.label + ' (' + this._frames(a.id).length + ')';
      b.onclick = () => this.setAction(a.id); c.appendChild(b);
    });
    const sep = () => { const s = document.createElement('div'); s.className = 'gsep'; c.appendChild(s); };
    sep();
    const nav = (txt, fn) => { const b = document.createElement('button'); b.className = 'gsbtn'; b.textContent = txt; b.onclick = fn; c.appendChild(b); return b; };
    nav('◄', () => { this.playing = false; this.setFrame(this.frameIdx - 1); this._buildCtrl(); });
    const play = nav(this.playing ? '⏸' : '▶', () => { this.playing = !this.playing; this.playT = 0; this._buildCtrl(); });
    play.classList.toggle('on', this.playing);
    nav('►', () => { this.playing = false; this.setFrame(this.frameIdx + 1); this._buildCtrl(); });
    sep();
    const gr = nav('▦ Grade', () => { this.grid = !this.grid; this._buildCtrl(); }); gr.classList.toggle('on', this.grid);
    nav('－', () => { this.zoomK = clamp(this.zoomK - 0.34, 0.5, 3); });
    nav('＋', () => { this.zoomK = clamp(this.zoomK + 0.34, 0.5, 3); });
    const flip = nav('⇄ Virar', () => { this._flip = !this._flip; });
    flip.classList.toggle('on', !!this._flip);
  },

  _buildInfo() {
    const I = this.infoEl; if (!I) return;
    const def = SPR.defs[this.charKey];
    const counts = this.ACTIONS.filter(a => a.id !== 'weapon' || (def && def.weapon)).map(a => `${a.label}: ${this._frames(a.id).length}`).join(' · ');
    I.innerHTML = `<h3>${this.charName}</h3>
      <div class="gsub">${this.charKey} · ${def && def.weapon ? 'arma: ' + def.weapon : 'sem arma'}</div>
      <div class="gsub">${counts}</div>
      <div class="filmlabel">${this._actionLabel(this.action)} — quadros</div>
      <div class="film" id="slFilm"></div>`;
    const film = I.querySelector('#slFilm');
    const frames = this._frames(this.action);
    frames.forEach((f, i) => {
      const cell = document.createElement('button'); cell.className = 'fcell' + (i === this.frameIdx ? ' on' : '');
      cell.dataset.idx = i; cell.title = f.label;
      const cv = document.createElement('canvas'); cv.width = f.cv.width; cv.height = f.cv.height;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(f.cv, 0, 0);
      cell.appendChild(cv);
      const fn = document.createElement('span'); fn.className = 'fn'; fn.textContent = (i + 1); cell.appendChild(fn);
      cell.onclick = () => { this.playing = false; this.frameIdx = i; this._highlightFilm(); this._buildCtrl(); };
      film.appendChild(cell);
    });
  },
  _highlightFilm() {
    if (!this.infoEl) return;
    this.infoEl.querySelectorAll('.fcell').forEach(el => el.classList.toggle('on', +el.dataset.idx === this.frameIdx));
  },

  // ---------- loop ----------
  tick(dt) {
    if (!this.active) return;
    this.time += dt;
    if (this.playing) {
      const a = this.ACTIONS.find(x => x.id === this.action), n = this._frames(this.action).length;
      if (n > 1) { this.playT += dt; const step = 1 / (a ? a.fps : 6); if (this.playT >= step) { this.playT -= step; this.setFrame(this.frameIdx + 1); } }
    }
    this._draw();
  },

  _draw() {
    const ctx = this.ctx, W = CONFIG.W, H = CONFIG.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241c14'); bg.addColorStop(1, '#0c0a08'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const frames = this._frames(this.action);
    if (!frames.length) {
      ctx.fillStyle = '#9a8f7d'; ctx.font = '18px "Trebuchet MS"'; ctx.textAlign = 'center';
      ctx.fillText('Sem quadros para esta ação.', W / 2, H / 2); ctx.textAlign = 'left'; return;
    }
    this.frameIdx = clamp(this.frameIdx, 0, frames.length - 1);
    const f = frames[this.frameIdx], cv = f.cv, fw = cv.width, fh = cv.height;
    const fit = Math.max(1, Math.floor(Math.min((W * 0.42) / fw, (H * 0.6) / fh)));
    const Z = Math.max(1, Math.round(fit * this.zoomK));
    const dw = fw * Z, dh = fh * Z;
    const cx0 = 244, cx1 = W - 256, centerX = (cx0 + cx1) / 2;
    const ox = Math.round(centerX - dw / 2), oy = Math.round(H * 0.52 - dh / 2);

    // xadrez de transparência atrás da sprite
    const cs = Math.max(6, Z);
    for (let yy = 0; yy < dh; yy += cs) for (let xx = 0; xx < dw; xx += cs) {
      ctx.fillStyle = (((xx / cs) | 0) + ((yy / cs) | 0)) % 2 ? '#1d1813' : '#15110e';
      ctx.fillRect(ox + xx, oy + yy, Math.min(cs, dw - xx), Math.min(cs, dh - yy));
    }
    // sprite ampliada (nearest)
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this._flip) { ctx.translate(ox + dw, oy); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, fw, fh, 0, 0, dw, dh); }
    else ctx.drawImage(cv, 0, 0, fw, fh, ox, oy, dw, dh);
    ctx.restore();
    // grade de pixels
    if (this.grid && Z >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= fw; x++) { ctx.moveTo(ox + x * Z + 0.5, oy); ctx.lineTo(ox + x * Z + 0.5, oy + dh); }
      for (let y = 0; y <= fh; y++) { ctx.moveTo(ox, oy + y * Z + 0.5); ctx.lineTo(ox + dw, oy + y * Z + 0.5); }
      ctx.stroke();
    }
    ctx.strokeStyle = '#5a4326'; ctx.lineWidth = 2; ctx.strokeRect(ox - 1, oy - 1, dw + 2, dh + 2);

    // textos
    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 17px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText(`${this.charName}  ·  ${this._actionLabel(this.action)}  ·  ${this.frameIdx + 1} / ${frames.length}`, centerX, oy - 16);
    ctx.fillStyle = '#9a8f7d'; ctx.font = '12px "Trebuchet MS"';
    ctx.fillText(`${fw}×${fh}px  ·  ampliada ${Z}×  ·  ${f.label}`, centerX, oy + dh + 22);
    ctx.textAlign = 'left';
  },
};

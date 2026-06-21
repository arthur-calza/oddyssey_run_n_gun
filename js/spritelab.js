/* ============================================================
   spritelab.js — ESTÚDIO DE SPRITES & EFEITOS
   Duas frentes:
     • SPRITES  — inspeciona e EDITA, pixel a pixel, os quadros de cada
                  personagem por ação (Parado/Correndo/Pulo/Queda/Agachado/
                  Dano/Morte/Arma). Pinta direto nas folhas (o jogo reflete
                  na hora), duplica/cria/limpa/remove quadros, salva no
                  navegador (localStorage) e exporta PNG. Especiais (que são
                  procedurais) têm prévia AO VIVO.
     • EFEITOS  — toca, em loop, todos os efeitos dinâmicos (explosões,
                  fogo, sangue, raios, projéteis…), inclusive os ainda não
                  usados, para inspeção.
   Renderiza no MESMO canvas do jogo (SpriteLab.open/close/tick).
   ============================================================ */

const SpriteLab = {
  active: false, canvas: null, ctx: null, onBack: null, time: 0,
  panel: null, listEl: null, infoEl: null, ctrlEl: null, editEl: null, tabsEl: null,
  mode: 'sprite',                 // 'sprite' | 'effects'
  charKey: null, charName: '', action: 'idle', frameIdx: 0,
  playing: false, playT: 0, grid: true, zoomK: 1, slowmo: false, _flip: false,
  editing: false, tool: 'pencil', color: '#e8b94a', brush: 1, recent: [],
  _view: null, _painting: false, _hover: null,
  _sandbox: null, _sbHero: null, _sbT: 0,
  effectKey: null, _stageObj: null,

  ACTIONS: [
    { id: 'idle',        label: 'Parado',    fps: 4 },
    { id: 'run',         label: 'Correndo',  fps: 12 },
    { id: 'jump',        label: 'Pulo',      fps: 10 },
    { id: 'fall',        label: 'Queda',     fps: 10 },
    { id: 'crouch',      label: 'Agachado',  fps: 3 },
    { id: 'crouchwalk',  label: 'Agach.+anda', fps: 10 },
    { id: 'crouchshoot', label: 'Agach.+atira', fps: 8 },
    { id: 'attack',      label: 'Ataque',    fps: 14 },
    { id: 'hurt',        label: 'Dano',      fps: 6 },
    { id: 'death',       label: 'Morte',     fps: 8 },
    { id: 'weapon',      label: 'Arma',      fps: 2 },
    { id: 'special',     label: 'Especial',  fps: 1 },
  ],
  EDITABLE: { idle: 1, run: 1, jump: 1, fall: 1, crouch: 1, crouchwalk: 1, crouchshoot: 1, attack: 1, hurt: 1, death: 1 },
  _NOINPUT: {
    left: false, right: false, up: false, down: false, jumpHeld: false, fire: false, special: false,
    jumpPressed: () => false, meleePressed: () => false, swapNext: () => false, swapPrev: () => false,
  },
  ENEMY_LABEL: {
    zombie: 'Zumbi', werewolf: 'Lobisomem', dragonman: 'Homem-Dragão', demon: 'Demônio',
    wolf: 'Lobo', direwolf: 'Lobo-Gigante', flayer: 'Devorador (Chefe)',
    skeleton: 'Esqueleto', ghoul: 'Carniçal', imp: 'Diabrete', ogre: 'Ogro',
    musketeer: 'Mosqueteiro', cultist: 'Cultista', specter: 'Espectro', hellhound: 'Cão Infernal',
  },

  // ---------- catálogo de EFEITOS dinâmicos ----------
  EFFECTS: [
    { id: 'explosion',  g: 'Partículas', label: 'Explosão',        run: (s, x, y) => { s.fx.explosion(x, y, 48); } },
    { id: 'muzzle',     g: 'Partículas', label: 'Fogo de cano',    run: (s, x, y) => { s.fx.muzzle(x, y, 0); } },
    { id: 'flame',      g: 'Partículas', label: 'Jato de chamas',  run: (s, x, y) => { s.fx.flame(x - 30, y, 0, 96); }, hold: true },
    { id: 'spark',      g: 'Partículas', label: 'Faíscas',         run: (s, x, y) => { s.fx.spark(x, y, '#ffd86b', 18); } },
    { id: 'magic',      g: 'Partículas', label: 'Magia',           run: (s, x, y) => { s.fx.magic(x, y, '#b07bff', 20); } },
    { id: 'smoke',      g: 'Partículas', label: 'Fumaça',          run: (s, x, y) => { s.fx.smoke(x, y, 12); } },
    { id: 'blood',      g: 'Partículas', label: 'Sangue',          run: (s, x, y) => { s.fx.blood(x, y, 1, 16); } },
    { id: 'gib',        g: 'Partículas', label: 'Esguicho (gib)',  run: (s, x, y) => { s.fx.gib(x, y, '#7a1a14', 22); } },
    { id: 'goreBurst',  g: 'Partículas', label: 'Carne & ossos',   run: (s, x, y) => { s.fx.goreBurst(x, y, 1, 36, '#7a1a14'); } },
    { id: 'goreChunks', g: 'Partículas', label: 'Pedaços grandes', run: (s, x, y) => { s.fx.goreChunks(x, y, 1, 18, '#7a1a14'); } },
    { id: 'chips',      g: 'Partículas', label: 'Estilhaços',      run: (s, x, y) => { s.fx.chips(x, y, '#7a6a4a', 10); } },
    { id: 'debris',     g: 'Partículas', label: 'Detritos',        run: (s, x, y) => { s.fx.debrisBurst(x, y, '#3a2c1c', 140); } },
    { id: 'slash',      g: 'Partículas', label: 'Corte (melee)',   run: (s, x, y) => { s.fx.slash(x, y, 0, 46, 'rgba(255,255,255,0.95)'); } },
    { id: 'bolt',       g: 'Partículas', label: 'Relâmpago',       run: (s, x, y) => { s.fx.bolt(x - 50, y - 46, x + 50, y + 30, '#bfe8ff'); } },
    { id: 'beam',       g: 'Partículas', label: 'Raio (feixe)',    run: (s, x, y) => { s.fx.beam(x - 60, y, x + 130, y, '#9be86a', 16); } },
    { id: 'shock',      g: 'Partículas', label: 'Onda de choque',  run: (s, x, y) => { s.fx.shock(x, y, 84, '#7fd8ff'); } },
    { id: 'bloodPool',  g: 'Partículas', label: 'Poça de sangue',  run: (s, x, y) => { s.fx.bloodPool(x, y + 30, '#6a160e', 10); } },
    { id: 'scorch',     g: 'Partículas', label: 'Queimadura',      run: (s, x, y) => { s.fx.scorch(x, y + 28, 44); } },
    { id: 'rubble',     g: 'Partículas', label: 'Entulho',         run: (s, x, y) => { s.fx.rubble(x, y + 28, '#6a5a4a'); } },
    { id: 'text',       g: 'Partículas', label: 'Texto flutuante', run: (s, x, y) => { s.fx.text(x, y, 'EXEMPLO!', '#ffd86b'); } },
    // ---- projéteis (kinds de Bullet) ----
    { id: 'p_pellet',   g: 'Projéteis', label: 'Chumbo/pellet',  proj: { kind: 'pellet', color: '#ffe27a', speed: 700, r: 3 } },
    { id: 'p_rifle',    g: 'Projéteis', label: 'Bala (rifle)',   proj: { kind: 'rifle', color: '#ffe9a8', speed: 800, r: 2.6 } },
    { id: 'p_slug',     g: 'Projéteis', label: 'Traçante/slug',  proj: { kind: 'slug', color: '#bfe8ff', speed: 800, r: 3.2 } },
    { id: 'p_arrow',    g: 'Projéteis', label: 'Flecha',         proj: { kind: 'arrow', color: '#caa45a', speed: 700, r: 3 } },
    { id: 'p_dagger',   g: 'Projéteis', label: 'Adaga',          proj: { kind: 'dagger', color: '#cfd2d6', speed: 600, r: 3, spin: 18 } },
    { id: 'p_thorn',    g: 'Projéteis', label: 'Espinho',        proj: { kind: 'thorn', color: '#8ef06a', speed: 600, r: 4 } },
    { id: 'p_note',     g: 'Projéteis', label: 'Nota musical',   proj: { kind: 'note', color: '#ffd86b', speed: 500, r: 4 } },
    { id: 'p_fireball', g: 'Projéteis', label: 'Bola de fogo',   proj: { kind: 'fireball', color: '#ff7a2c', speed: 520, r: 5 } },
    { id: 'p_ice',      g: 'Projéteis', label: 'Gelo',           proj: { kind: 'ice', color: '#bfe8ff', speed: 620, r: 3.4 } },
    { id: 'p_spark',    g: 'Projéteis', label: 'Raio elétrico',  proj: { kind: 'spark', color: '#bff0ff', speed: 900, r: 3 } },
    { id: 'p_disc',     g: 'Projéteis', label: 'Disco/chakram',  proj: { kind: 'disc', color: '#d8dee6', speed: 520, r: 6, spin: 30 } },
    { id: 'p_cannon',   g: 'Projéteis', label: 'Bala de canhão', proj: { kind: 'cannon', color: '#ffb060', speed: 460, r: 6, explosive: 60, life: 1.2, spin: 8 } },
    { id: 'p_grenade',  g: 'Projéteis', label: 'Granada (arco)', proj: { kind: 'grenade', color: '#3a3a2c', speed: 420, r: 5, explosive: 60, grav: 700, life: 1.4, spin: 12 } },
    { id: 'p_flask',    g: 'Projéteis', label: 'Frasco de ácido', proj: { kind: 'flask', color: '#8ef06a', speed: 420, r: 5, explosive: 36, grav: 560, life: 1.4, spin: 8 } },
    { id: 'p_flame',    g: 'Projéteis', label: 'Brasa (flame)',  proj: { kind: 'flame', color: '#ff8a3c', speed: 480, r: 4, life: 0.5 } },
  ],

  open(canvas, onBack) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.onBack = onBack; this.active = true; this.time = 0;
    if (!SPR.ready) SPR.build();
    if (typeof TEX !== 'undefined' && !TEX.ready) TEX.build();
    this._buildDOM();
    this.setMode(this.mode || 'sprite');
    this._key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this._exit(); } };
    addEventListener('keydown', this._key, true);
    // pintura no canvas
    this._onDown = (e) => { if (!this._canPaint()) return; e.preventDefault(); this._painting = true; this._paintAt(e); };
    this._onMove = (e) => { if (this._painting) this._paintAt(e); else if (this._canPaint()) this._hover = this._pixelAt(e); };
    this._onUp = () => { this._painting = false; };
    canvas.addEventListener('mousedown', this._onDown);
    canvas.addEventListener('mousemove', this._onMove);
    addEventListener('mouseup', this._onUp);
  },
  _exit() { if (SPR._dirty && Object.keys(SPR._dirty).length) SPR.saveEdits(); this.close(); this.onBack && this.onBack(); },
  close() {
    this.active = false; this.playing = false;
    this._sandbox = null; this._sbHero = null; this._stageObj = null;
    if (this.panel) this.panel.style.display = 'none';
    removeEventListener('keydown', this._key, true);
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mousemove', this._onMove);
    removeEventListener('mouseup', this._onUp);
  },

  // ---------- helpers ----------
  _isHero(key) { return HEROES.some(h => h.spr === key); },
  _heroIndex(key) { return HEROES.findIndex(h => h.spr === key); },
  _actionLabel(id) { const a = this.ACTIONS.find(x => x.id === id); return a ? a.label : id; },
  _actionAvailable(id) {
    const def = SPR.defs[this.charKey];
    if (id === 'weapon') return !!(def && def.weapon);
    if (id === 'special') return this._isHero(this.charKey);
    return true;
  },
  _canPaint() { return this.mode === 'sprite' && this.editing && this.EDITABLE[this.action] && this._view; },

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
        #spritelab{position:fixed;inset:0;pointer-events:none;z-index:50;font-family:"Trebuchet MS","Segoe UI",sans-serif;color:#e8e0cf;}
        #spritelab .gpanel{pointer-events:auto;background:rgba(20,15,10,0.88);border:2px solid #5a4326;border-radius:8px;box-shadow:0 0 0 2px #000,0 6px 24px #000;}
        #spritelab .gtop{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:7px 12px;}
        #spritelab .gtitle{color:#e8b94a;font-weight:bold;font-size:14px;letter-spacing:1px;margin-right:4px;}
        #spritelab .gback{cursor:pointer;font:inherit;font-weight:bold;font-size:13px;color:#e8e0cf;background:linear-gradient(#3a2c1c,#241a10);border:2px solid #b1322c;border-radius:6px;padding:6px 11px;}
        #spritelab .gback:hover{background:#4a2018;}
        #spritelab .gtab{cursor:pointer;font:inherit;font-weight:bold;font-size:13px;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 11px;}
        #spritelab .gtab.on{border-color:#e8b94a;color:#e8b94a;box-shadow:0 0 8px rgba(232,185,74,.35);}
        #spritelab .glist{position:absolute;top:58px;left:12px;bottom:12px;width:208px;overflow-y:auto;padding:8px;}
        #spritelab .ggroup{color:#caa86a;font-size:11px;letter-spacing:1px;margin:6px 2px 4px;text-transform:uppercase;}
        #spritelab .gitem{display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;font:inherit;text-align:left;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 9px;margin-bottom:5px;}
        #spritelab .gitem:hover{background:#3a2c1c;} #spritelab .gitem.on{border-color:#e8b94a;color:#e8b94a;}
        #spritelab .gitem .gem{font-size:15px;width:18px;text-align:center;}
        #spritelab .gitem .gname{font-size:13px;font-weight:bold;} #spritelab .gitem .gsub{font-size:10px;color:#9a8f7d;}
        #spritelab .ginfo{position:absolute;top:58px;right:12px;width:232px;bottom:12px;overflow-y:auto;padding:11px;}
        #spritelab .ginfo h3{color:#e8b94a;font-size:16px;margin-bottom:4px;}
        #spritelab .ginfo .gsub{color:#9a8f7d;font-size:12px;margin-bottom:7px;line-height:1.45;}
        #spritelab .filmlabel{color:#caa86a;font-size:11px;letter-spacing:1px;margin:8px 0 5px;text-transform:uppercase;}
        #spritelab .film{display:flex;flex-wrap:wrap;gap:6px;}
        #spritelab .fcell{position:relative;cursor:pointer;border:2px solid #4a3826;border-radius:5px;background:repeating-conic-gradient(#15110e 0% 25%, #1d1813 0% 50%) 0/14px 14px;padding:0;line-height:0;}
        #spritelab .fcell:hover{border-color:#caa86a;} #spritelab .fcell.on{border-color:#e8b94a;box-shadow:0 0 8px rgba(232,185,74,.5);}
        #spritelab .fcell canvas{width:44px;height:50px;image-rendering:pixelated;display:block;}
        #spritelab .fcell .fn{position:absolute;bottom:1px;right:2px;font-size:9px;color:#fff;text-shadow:0 0 3px #000,1px 1px 0 #000;}
        #spritelab .gctrl{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;padding:7px 10px;max-width:62vw;}
        #spritelab .gsep{width:1px;height:20px;background:#5a4326;margin:0 3px;}
        #spritelab .gsbtn{cursor:pointer;font:inherit;font-size:12px;font-weight:bold;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:5px 9px;}
        #spritelab .gsbtn:hover{background:#3a2c1c;} #spritelab .gsbtn.on{border-color:#6fd0ff;color:#6fd0ff;}
        #spritelab .gsbtn.warn.on,#spritelab .gsbtn.warn{border-color:#b1322c;}
        #spritelab .gedit{position:absolute;top:56px;left:228px;right:252px;display:none;flex-wrap:wrap;gap:5px;align-items:center;padding:7px 9px;}
        #spritelab .gedit.on{display:flex;}
        #spritelab .sw{width:18px;height:18px;border-radius:4px;border:2px solid #000;cursor:pointer;padding:0;}
        #spritelab .sw.on{outline:2px solid #e8b94a;}
        #spritelab .gedit input[type=color]{width:28px;height:24px;border:2px solid #5a4326;border-radius:5px;background:#241a10;cursor:pointer;padding:0;}
        #spritelab .ghint{position:absolute;bottom:56px;right:16px;color:#9a8f7d;font-size:12px;pointer-events:none;max-width:230px;text-align:right;}
      `;
      document.head.appendChild(st);
    }
    const g = document.createElement('div'); g.id = 'spritelab';
    g.innerHTML = `
      <div class="gpanel gtop">
        <button class="gback" data-back>‹ Menu</button>
        <span class="gtitle">🎨 ESTÚDIO</span>
        <button class="gtab" data-mode="sprite">🎞 Sprites</button>
        <button class="gtab" data-mode="effects">✨ Efeitos</button>
      </div>
      <div class="gpanel glist" id="slList"></div>
      <div class="gpanel ginfo" id="slInfo"></div>
      <div class="gpanel gctrl" id="slCtrl"></div>
      <div class="gpanel gedit" id="slEdit"></div>
      <div class="ghint" id="slHint"></div>`;
    document.body.appendChild(g);
    this.panel = g;
    this.tabsEl = g.querySelector('.gtop');
    this.listEl = g.querySelector('#slList');
    this.infoEl = g.querySelector('#slInfo');
    this.ctrlEl = g.querySelector('#slCtrl');
    this.editEl = g.querySelector('#slEdit');
    this.hintEl = g.querySelector('#slHint');
    g.querySelector('[data-back]').onclick = () => this._exit();
    g.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => this.setMode(b.dataset.mode));
  },

  setMode(m) {
    this.mode = m; this.editing = false;
    this.tabsEl.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    this.editEl.classList.remove('on');
    if (m === 'sprite') {
      if (!this.charKey) { this.charKey = HEROES[0].spr; this.charName = HEROES[0].name; }
      if (!this._actionAvailable(this.action)) this.action = 'idle';
      this.hintEl.textContent = 'Selecione “✏ Editar” para pintar pixels. Edições aplicam no jogo e são salvas no navegador.';
    } else {
      if (!this.effectKey) this.effectKey = this.EFFECTS[0].id;
      this.hintEl.textContent = 'Efeitos dinâmicos (não-pixels) tocados em loop — inclusive os ainda não usados no jogo.';
    }
    this._buildList(); this._buildCtrl(); this._buildInfo();
  },

  // ---------- listas ----------
  _buildList() {
    const L = this.listEl; L.innerHTML = '';
    const grp = (t) => { const d = document.createElement('div'); d.className = 'ggroup'; d.textContent = t; L.appendChild(d); };
    const item = (name, sub, icon, on, onclick) => {
      const b = document.createElement('button'); b.className = 'gitem' + (on ? ' on' : '');
      b.innerHTML = `<span class="gem">${icon}</span><span><div class="gname">${name}</div><div class="gsub">${sub}</div></span>`;
      b.onclick = onclick; L.appendChild(b);
    };
    if (this.mode === 'sprite') {
      grp('Heróis');
      HEROES.forEach(h => item(h.name, h.spr, h.icon || '♟', this.charKey === h.spr, () => this.selectChar(h.spr, h.name)));
      grp('Inimigos');
      for (const key in ENEMY_TYPES) { const spr = ENEMY_TYPES[key].spr, name = this.ENEMY_LABEL[key] || key; item(name, key, ENEMY_TYPES[key].boss ? '★' : ENEMY_TYPES[key].mini ? '✦' : '•', this.charKey === spr, () => this.selectChar(spr, name)); }
    } else {
      let lastG = null;
      this.EFFECTS.forEach(fx => { if (fx.g !== lastG) { grp(fx.g); lastG = fx.g; } item(fx.label, fx.id, fx.proj ? '➶' : '✦', this.effectKey === fx.id, () => this.selectEffect(fx.id)); });
    }
  },

  selectChar(key, name) {
    this.charKey = key; this.charName = name;
    this._sandbox = null; this._sbHero = null;
    if (!this._actionAvailable(this.action)) this.action = 'idle';
    this.frameIdx = 0; this.playT = 0;
    this._buildList(); this._buildCtrl(); this._buildInfo();
  },
  selectEffect(id) { this.effectKey = id; if (this._stageObj) this._stageObj.t = 999; this._buildList(); this._buildInfo(); },
  setAction(id) { this.action = id; this.frameIdx = 0; this.playT = 0; if (!this.EDITABLE[id]) { this.editing = false; this.editEl.classList.remove('on'); } this._buildCtrl(); this._buildInfo(); },
  setFrame(i) { const n = this._frames(this.action).length; if (!n) return; this.frameIdx = ((i % n) + n) % n; this._highlightFilm(); this._buildInfo(); },

  // ---------- controles (rodapé) ----------
  _buildCtrl() {
    const c = this.ctrlEl; c.innerHTML = '';
    const sep = () => { const s = document.createElement('div'); s.className = 'gsep'; c.appendChild(s); };
    const nav = (txt, fn, on, cls) => { const b = document.createElement('button'); b.className = 'gsbtn' + (cls ? ' ' + cls : '') + (on ? ' on' : ''); b.textContent = txt; b.onclick = fn; c.appendChild(b); return b; };
    if (this.mode === 'effects') {
      nav('↻ Repetir', () => { if (this._stageObj) this._stageObj.t = 999; });
      nav('🐢 Lento', () => { this.slowmo = !this.slowmo; this._buildCtrl(); }, this.slowmo);
      return;
    }
    this.ACTIONS.forEach(a => {
      if (!this._actionAvailable(a.id)) return;
      const b = document.createElement('button'); b.className = 'gsbtn' + (this.action === a.id ? ' on' : '');
      const n = a.id === 'special' ? null : this._frames(a.id).length;
      b.textContent = a.label + (n != null ? ' (' + n + ')' : '');
      b.onclick = () => this.setAction(a.id); c.appendChild(b);
    });
    sep();
    if (this.action === 'special') { nav('↻ Repetir', () => { if (this._sandbox) this._resetSandbox(this._sandbox); }); nav('🐢 Lento', () => { this.slowmo = !this.slowmo; this._buildCtrl(); }, this.slowmo); return; }
    nav('◄', () => { this.playing = false; this.setFrame(this.frameIdx - 1); this._buildCtrl(); });
    nav(this.playing ? '⏸' : '▶', () => { this.playing = !this.playing; this.playT = 0; this._buildCtrl(); }, this.playing);
    nav('►', () => { this.playing = false; this.setFrame(this.frameIdx + 1); this._buildCtrl(); });
    sep();
    nav('▦', () => { this.grid = !this.grid; this._buildCtrl(); }, this.grid);
    nav('－', () => { this.zoomK = clamp(this.zoomK - 0.34, 0.5, 4); });
    nav('＋', () => { this.zoomK = clamp(this.zoomK + 0.34, 0.5, 4); });
    if (this.EDITABLE[this.action]) { sep(); nav('✏ Editar', () => { this.editing = !this.editing; this._flip = false; this.editEl.classList.toggle('on', this.editing); this._buildEditBar(); this._buildCtrl(); }, this.editing); }
  },

  // ---------- barra de EDIÇÃO ----------
  _buildEditBar() {
    const e = this.editEl; e.innerHTML = '';
    if (!this.editing || !this.EDITABLE[this.action]) { e.classList.remove('on'); return; }
    e.classList.add('on');
    const btn = (txt, fn, on, cls) => { const b = document.createElement('button'); b.className = 'gsbtn' + (cls ? ' ' + cls : '') + (on ? ' on' : ''); b.textContent = txt; b.onclick = fn; e.appendChild(b); return b; };
    const sep = () => { const s = document.createElement('div'); s.className = 'gsep'; e.appendChild(s); };
    btn('✏', () => { this.tool = 'pencil'; this._buildEditBar(); }, this.tool === 'pencil').title = 'Pincel';
    btn('🧽', () => { this.tool = 'eraser'; this._buildEditBar(); }, this.tool === 'eraser').title = 'Borracha';
    btn('💧', () => { this.tool = 'eyedropper'; this._buildEditBar(); }, this.tool === 'eyedropper').title = 'Conta-gotas';
    btn('🪣', () => { this.tool = 'bucket'; this._buildEditBar(); }, this.tool === 'bucket').title = 'Balde (preencher)';
    sep();
    [1, 2, 3].forEach(b => btn('●' + b, () => { this.brush = b; this._buildEditBar(); }, this.brush === b));
    sep();
    // cor atual + seletor + paleta
    const cur = document.createElement('button'); cur.className = 'sw on'; cur.style.background = this.color; cur.style.width = '24px'; cur.style.height = '22px'; e.appendChild(cur);
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = /^#([0-9a-f]{6})$/i.test(this.color) ? this.color : '#e8b94a';
    inp.oninput = () => { this.color = inp.value; this.tool = 'pencil'; cur.style.background = this.color; this._buildEditBar(); };
    e.appendChild(inp);
    const pal = this._palette();
    pal.forEach(col => { const sw = document.createElement('button'); sw.className = 'sw' + (col === this.color ? ' on' : ''); sw.style.background = col; sw.title = col; sw.onclick = () => { this.color = col; this.tool = 'pencil'; this._buildEditBar(); }; e.appendChild(sw); });
    sep();
    btn('⧉ Duplicar', () => { const i = SPR.addFrame(this.charKey, this.action, false); if (i >= 0) { this.frameIdx = i; this._buildCtrl(); this._buildInfo(); } });
    btn('▢ Vazio', () => { const i = SPR.addFrame(this.charKey, this.action, true); if (i >= 0) { this.frameIdx = i; this._buildCtrl(); this._buildInfo(); } });
    btn('↺ Limpar', () => { SPR.revertFrame(this.charKey, this.action, this.frameIdx); this._buildInfo(); });
    btn('🗑 Remover', () => { if (SPR.removeFrame(this.charKey, this.action, this.frameIdx)) { this.frameIdx = Math.max(0, this.frameIdx - 1); this._buildCtrl(); this._buildInfo(); } }, false, 'warn');
    sep();
    btn('💾 Salvar', () => { SPR.saveEdits(); this._flash('Salvo no navegador'); });
    btn('⬇ PNG', () => this._exportPng());
    btn('♻ Restaurar tudo', () => { if (confirm('Descartar TODAS as edições de sprite e voltar ao original?')) { SPR.clearAllEdits(); this.frameIdx = 0; this._buildCtrl(); this._buildInfo(); } }, false, 'warn');
  },
  _palette() {
    const set = new Set(['#000000', '#ffffff', '#e8e0cf', '#9a8f7d', '#caa33a', '#b1322c', '#7be08a', '#6fd0ff', '#b07bff', '#ff8a3c']);
    const d = SPR.defs[this.charKey]; if (d && d.pal) for (const k in d.pal) { const v = d.pal[k]; if (typeof v === 'string' && v[0] === '#') set.add(v); }
    this.recent.forEach(c => set.add(c));
    return Array.from(set).slice(0, 30);
  },
  _flash(msg) { this._flashMsg = msg; this._flashT = 1.4; },
  _exportPng() {
    const cv = SPR.frameCanvas(this.charKey, this.action, this.frameIdx); if (!cv) return;
    const a = document.createElement('a'); a.download = `${this.charKey}_${this.action}_${this.frameIdx + 1}.png`; a.href = cv.toDataURL(); a.click();
  },

  // ---------- pintura ----------
  _pixelAt(e) {
    const v = this._view; if (!v) return null;
    const r = this.canvas.getBoundingClientRect();
    const ix = (e.clientX - r.left) * (this.canvas.width / r.width);
    const iy = (e.clientY - r.top) * (this.canvas.height / r.height);
    const px = Math.floor((ix - v.ox) / v.Z), py = Math.floor((iy - v.oy) / v.Z);
    if (px < 0 || py < 0 || px >= v.fw || py >= v.fh) return null;
    return { px, py };
  },
  _paintAt(e) {
    const pix = this._pixelAt(e); if (!pix) return;
    const cv = SPR.frameCanvas(this.charKey, this.action, this.frameIdx); if (!cv) return;
    const g = cv.getContext('2d'), b = this.brush, off = (b / 2) | 0;
    if (this.tool === 'eyedropper') {
      const d = g.getImageData(pix.px, pix.py, 1, 1).data;
      if (d[3] > 8) { this.color = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join(''); this._pushRecent(this.color); this.tool = 'pencil'; this._buildEditBar(); }
      return;
    }
    if (this.tool === 'bucket') { this._fill(g, cv.width, cv.height, pix.px, pix.py, this.color); SPR.markDirty(this.charKey, this.action); return; }
    if (this.tool === 'eraser') { g.clearRect(pix.px - off, pix.py - off, b, b); }
    else { g.fillStyle = this.color; g.fillRect(pix.px - off, pix.py - off, b, b); this._pushRecent(this.color); }
    SPR.markDirty(this.charKey, this.action);
  },
  _pushRecent(c) { if (!this.recent.includes(c)) { this.recent.unshift(c); if (this.recent.length > 8) this.recent.pop(); } },
  _fill(g, W, H, sx, sy, hex) {
    const im = g.getImageData(0, 0, W, H), px = im.data;
    const at = (x, y) => (y * W + x) * 4;
    const i0 = at(sx, sy), tr = px[i0], tg = px[i0 + 1], tb = px[i0 + 2], ta = px[i0 + 3];
    const nr = parseInt(hex.slice(1, 3), 16), ng = parseInt(hex.slice(3, 5), 16), nb = parseInt(hex.slice(5, 7), 16);
    if (tr === nr && tg === ng && tb === nb && ta === 255) return;
    const same = (i) => px[i] === tr && px[i + 1] === tg && px[i + 2] === tb && px[i + 3] === ta;
    const st = [[sx, sy]];
    while (st.length) {
      const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = at(x, y); if (!same(i)) continue;
      px[i] = nr; px[i + 1] = ng; px[i + 2] = nb; px[i + 3] = 255;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    g.putImageData(im, 0, 0);
  },

  // ---------- painel direito ----------
  _buildInfo() {
    const I = this.infoEl; if (!I) return;
    if (this.mode === 'effects') {
      const fx = this.EFFECTS.find(f => f.id === this.effectKey) || {};
      I.innerHTML = `<h3>${fx.label || ''}</h3><div class="gsub">${fx.proj ? 'projétil · kind: ' + fx.proj.kind : 'partículas · ' + (fx.id || '')}</div>
        <div class="gsub">${fx.proj ? 'Disparado da esquerda para a direita, em loop.' : 'Disparado no centro do palco, em loop.'} Use “🐢 Lento” para examinar.</div>`;
      return;
    }
    const def = SPR.defs[this.charKey];
    if (this.action === 'special') {
      const h = HEROES.find(x => x.spr === this.charKey);
      I.innerHTML = `<h3>${this.charName}</h3><div class="gsub">${this.charKey} · especial</div>
        <div class="filmlabel">Especial — não há quadros</div>
        <div class="gsub">Os especiais são <b>procedurais</b> (efeitos + estados). Aqui mostramos uma <b>prévia AO VIVO</b>, em loop.</div>
        <div class="gsub" style="color:#caa86a">${h ? h.desc : ''}</div>`;
      return;
    }
    const counts = this.ACTIONS.filter(a => a.id !== 'special' && (a.id !== 'weapon' || (def && def.weapon))).map(a => `${a.label}: ${this._frames(a.id).length}`).join(' · ');
    I.innerHTML = `<h3>${this.charName}</h3>
      <div class="gsub">${this.charKey} · ${def && def.weapon ? 'arma: ' + def.weapon : 'sem arma'}</div>
      <div class="gsub">${counts}</div>
      <div class="filmlabel">${this._actionLabel(this.action)} — quadros</div>
      <div class="film" id="slFilm"></div>`;
    const film = I.querySelector('#slFilm');
    this._frames(this.action).forEach((f, i) => {
      const cell = document.createElement('button'); cell.className = 'fcell' + (i === this.frameIdx ? ' on' : '');
      cell.dataset.idx = i; cell.title = f.label;
      const cv = document.createElement('canvas'); cv.width = f.cv.width; cv.height = f.cv.height;
      cv.getContext('2d').drawImage(f.cv, 0, 0); cell.appendChild(cv);
      const fn = document.createElement('span'); fn.className = 'fn'; fn.textContent = (i + 1); cell.appendChild(fn);
      cell.onclick = () => { this.playing = false; this.frameIdx = i; this._highlightFilm(); this._buildCtrl(); };
      film.appendChild(cell);
    });
  },
  _highlightFilm() { if (this.infoEl) this.infoEl.querySelectorAll('.fcell').forEach(el => el.classList.toggle('on', +el.dataset.idx === this.frameIdx)); },

  // ---------- prévia AO VIVO do especial ----------
  _arena() {
    const W = 60, H = 24, gr = H - 6, g = [];
    for (let r = 0; r < H; r++) g.push(new Array(W).fill('.'));
    for (let c = 0; c < W; c++) for (let r = gr; r < H - 1; r++) g[r][c] = (r === gr ? 'D' : '#');
    g[gr - 1][20] = 'P';
    const rows = g.map(a => a.join(''));
    return { name: 'Arena', sub: '', win: 'none', biome: 'castle', sky: ['#1e2740', '#080a14'], seed: 1, bannerColor: '#6a1a1a', rows, bg: rows.map(() => '.'.repeat(W)), surface: new Array(W).fill(gr) };
  },
  _makeSandbox(heroIndex) {
    const sb = new Game(this.canvas);
    sb.onEnd = () => {}; sb.roster = [heroIndex]; sb.currentHero = heroIndex; sb.lives = 99; sb.testMode = false;
    this._resetSandbox(sb); return sb;
  },
  _resetSandbox(sb) {
    sb.loadLevelDef(this._arena());
    sb.controller = this._NOINPUT; sb.vexCharges = 99;
    const p = sb.player; p.invuln = 9e9; p.special = p.maxSpecial; p.face = 1;
    sb.enemies.length = 0;
    for (const dx of [-130, -70, 70, 130, 190]) { const e = new Enemy(p.cx + dx, p.y, 'wolf'); e.hp = e.maxhp = 1e9; e.speed = 0; e.alert = 999; e.face = dx < 0 ? -1 : 1; sb.enemies.push(e); }
    sb.cam.x = clamp(p.cx - sb.cam.vw / 2, 0, Math.max(0, sb.world.pixelW - sb.cam.vw));
    sb.cam.y = clamp(p.cy - sb.cam.vh / 2 - 20, 0, Math.max(0, sb.world.pixelH - sb.cam.vh));
    this._sbCamX = sb.cam.x; this._sbCamY = sb.cam.y; this._sbT = 0; sb._fired = false;
  },
  _tickSpecial(dt) {
    const hi = this._heroIndex(this.charKey);
    if (!this._sandbox || this._sbHero !== this.charKey) { this._sandbox = this._makeSandbox(hi); this._sbHero = this.charKey; }
    const sb = this._sandbox; this._sbT += dt;
    if (this._sbT > 2.8) this._resetSandbox(sb);
    const p = sb.player;
    if (p) {
      p.invuln = 9e9; p.special = p.maxSpecial;
      if (!sb._fired && this._sbT > 0.5) { sb._fired = true; const sp = HEROES[hi].special; if (sp && sp.metamorph) { const pool = HEROES.map((h, i) => i).filter(i => HEROES[i].key !== 'vex'); p.morphInto(pick(pool), sb); } else if (sp) sp.use(p, sb); }
    }
    sb.update(dt);
    for (const e of sb.enemies) if (e.dying == null) e.hp = e.maxhp;
    sb.cam.x = this._sbCamX; sb.cam.y = this._sbCamY; sb.draw();
    const ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(20,15,10,0.72)'; ctx.fillRect(CONFIG.W / 2 - 250, 12, 500, 30);
    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 16px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText(this.charName + ' — ESPECIAL · prévia ao vivo (loop)' + (this.slowmo ? ' · LENTO' : ''), CONFIG.W / 2, 32);
    ctx.restore(); ctx.textAlign = 'left';
  },

  // ---------- palco de EFEITOS ----------
  _stage() {
    if (this._stageObj) return this._stageObj;
    const fx = new FX(null);
    const cam = {
      x: 0, y: 0, _sx: 0, _sy: 0, shake: 0,
      get vw() { return CONFIG.W / CONFIG.ZOOM; }, get vh() { return CONFIG.H / CONFIG.ZOOM; },
      get ox() { return -this.x + this._sx; }, get oy() { return -this.y + this._sy; },
      addShake(v) { this.shake = Math.min(20, this.shake + v); }, visible: () => true,
    };
    const world = { T: 32, pixelW: 1e6, pixelH: 1e6, solidPx: () => false, damage() {}, explode: (x, y, r) => { fx.explosion(x, y, r); } };
    const game = { fx, cam, world, enemies: [], bullets: [], carveTiles() {}, damageEntitiesRadial() {}, queueExplosion() {} };
    this._stageObj = { fx, cam, world, game, bullets: [], t: 999 };
    return this._stageObj;
  },
  _tickEffects(dt) {
    const s = this._stage(), fx = s.fx;
    const cx = s.cam.vw / 2, cy = s.cam.vh * 0.46;
    const def = this.EFFECTS.find(f => f.id === this.effectKey) || this.EFFECTS[0];
    s.t += dt;
    const period = def.hold ? 0.05 : 1.5;
    if (s.t >= period) {
      s.t = 0;
      if (period > 0.5) { fx.parts.length = 0; fx.debris.length = 0; fx.crumbs.length = 0; fx.decals.length = 0; fx.texts.length = 0; fx.slashes.length = 0; fx.bolts.length = 0; fx.beams.length = 0; fx.rings.length = 0; s.bullets.length = 0; }
      if (def.proj) { const o = def.proj; s.bullets.push(new Bullet(cx - 130, cy, 0, o.speed, Object.assign({ faction: 'player', tileDmg: 0, life: o.life || 1.2 }, o))); }
      else if (def.run) def.run(s, cx, cy);
    }
    // atualiza
    fx.update(dt, s.world);
    for (const b of s.bullets) b.update(dt, s.game);
    s.bullets = s.bullets.filter(b => b.alive);
    if (s.cam.shake > 0) { s.cam.shake = Math.max(0, s.cam.shake - dt * 32); s.cam._sx = rand(-s.cam.shake, s.cam.shake); s.cam._sy = rand(-s.cam.shake, s.cam.shake); } else { s.cam._sx = s.cam._sy = 0; }
    // desenha
    const ctx = this.ctx, W = CONFIG.W, H = CONFIG.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a1f2a'); bg.addColorStop(1, '#0a0c10'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // chão de referência
    ctx.save(); ctx.scale(CONFIG.ZOOM, CONFIG.ZOOM);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, (cy + 34), s.cam.vw, 3);
    s.fx.drawDecals(ctx, s.cam); s.fx.drawCrumbs(ctx, s.cam);
    for (const b of s.bullets) b.draw(ctx, s.cam);
    s.fx.draw(ctx, s.cam);
    ctx.restore();
    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 17px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText((def.label || '') + ' — EFEITO · prévia ao vivo (loop)' + (this.slowmo ? ' · LENTO' : ''), W / 2, 40);
    ctx.textAlign = 'left';
  },

  // ---------- loop ----------
  tick(dt) {
    if (!this.active) return;
    this.time += dt;
    if (this._flashT > 0) this._flashT -= dt;
    const d = this.slowmo ? dt * 0.4 : dt;
    if (this.mode === 'effects') { this._tickEffects(d); return; }
    if (this.action === 'special' && this._isHero(this.charKey)) { this._tickSpecial(d); return; }
    if (this.playing && !this.editing) {
      const a = this.ACTIONS.find(x => x.id === this.action), n = this._frames(this.action).length;
      if (n > 1) { this.playT += dt; const step = 1 / (a ? a.fps : 6); if (this.playT >= step) { this.playT -= step; this.setFrame(this.frameIdx + 1); } }
    }
    this._draw();
  },

  _draw() {
    const ctx = this.ctx, W = CONFIG.W, H = CONFIG.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#241c14'); bg.addColorStop(1, '#0c0a08'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const frames = this._frames(this.action);
    if (!frames.length) { ctx.fillStyle = '#9a8f7d'; ctx.font = '18px "Trebuchet MS"'; ctx.textAlign = 'center'; ctx.fillText('Sem quadros para esta ação.', W / 2, H / 2); ctx.textAlign = 'left'; this._view = null; return; }
    this.frameIdx = clamp(this.frameIdx, 0, frames.length - 1);
    const f = frames[this.frameIdx], cv = f.cv, fw = cv.width, fh = cv.height;
    const fit = Math.max(1, Math.floor(Math.min((W * 0.4) / fw, (H * 0.54) / fh)));
    const Z = Math.max(1, Math.round(fit * this.zoomK));
    const dw = fw * Z, dh = fh * Z;
    const cx0 = 240, cx1 = W - 250, centerX = (cx0 + cx1) / 2;
    const ox = Math.round(centerX - dw / 2), oy = Math.round((this.editing ? H * 0.58 : H * 0.52) - dh / 2);
    this._view = this.editing ? { ox, oy, Z, fw, fh } : null;

    const cs = Math.max(6, Z);
    for (let yy = 0; yy < dh; yy += cs) for (let xx = 0; xx < dw; xx += cs) { ctx.fillStyle = (((xx / cs) | 0) + ((yy / cs) | 0)) % 2 ? '#1d1813' : '#15110e'; ctx.fillRect(ox + xx, oy + yy, Math.min(cs, dw - xx), Math.min(cs, dh - yy)); }
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this._flip && !this.editing) { ctx.translate(ox + dw, oy); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, fw, fh, 0, 0, dw, dh); }
    else ctx.drawImage(cv, 0, 0, fw, fh, ox, oy, dw, dh);
    ctx.restore();
    if (this.grid && Z >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= fw; x++) { ctx.moveTo(ox + x * Z + 0.5, oy); ctx.lineTo(ox + x * Z + 0.5, oy + dh); }
      for (let y = 0; y <= fh; y++) { ctx.moveTo(ox, oy + y * Z + 0.5); ctx.lineTo(ox + dw, oy + y * Z + 0.5); }
      ctx.stroke();
    }
    ctx.strokeStyle = '#5a4326'; ctx.lineWidth = 2; ctx.strokeRect(ox - 1, oy - 1, dw + 2, dh + 2);
    // cursor do editor
    if (this.editing && this._hover) { const b = this.brush, off = (b / 2) | 0; ctx.strokeStyle = this.tool === 'eraser' ? '#ff8a8a' : '#fff'; ctx.lineWidth = 2; ctx.strokeRect(ox + (this._hover.px - off) * Z, oy + (this._hover.py - off) * Z, b * Z, b * Z); }

    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 17px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText(`${this.charName}  ·  ${this._actionLabel(this.action)}  ·  ${this.frameIdx + 1} / ${frames.length}${this.editing ? '  ·  ✏ EDITANDO' : ''}`, centerX, oy - 14);
    ctx.fillStyle = '#9a8f7d'; ctx.font = '12px "Trebuchet MS"';
    ctx.fillText(`${fw}×${fh}px  ·  ${Z}×${this.editing ? '  ·  clique p/ pintar' : ''}`, centerX, oy + dh + 20);
    if (this._flashT > 0 && this._flashMsg) { ctx.fillStyle = `rgba(123,224,138,${clamp(this._flashT, 0, 1)})`; ctx.font = 'bold 15px "Trebuchet MS"'; ctx.fillText('✔ ' + this._flashMsg, centerX, oy + dh + 40); }
    ctx.textAlign = 'left';
  },
};

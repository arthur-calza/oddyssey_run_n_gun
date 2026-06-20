/* ============================================================
   gallery.js — Enciclopédia Visual (ferramenta de design)
   Visualizador no menu para inspecionar:
     • Bestiário  — cada inimigo, com seus estados de animação/movimento
     • Materiais  — blocos/texturas (variantes) + props/destrutibilidade
     • Decoração  — props/construções (tochas, estandartes, grades, racks…)
     • Biomas     — fundos em parallax animados
   Renderiza no MESMO canvas do jogo; controlado por main.js
   (Gallery.open / Gallery.close / Gallery.tick).
   ============================================================ */

const Gallery = {
  active: false, canvas: null, ctx: null, time: 0, onBack: null,
  tab: 'enemies',
  panel: null, listEl: null, infoEl: null, ctrlEl: null, tabsEl: null,
  // estado do ator (inimigo/herói) em exibição
  m: null, enemyKey: null, heroKey: null, state: 'idle', autoStates: true, autoT: 0,
  matId: null, decorType: null, biome: null, biomeCamX: 0,

  HERO_INFO: {
    ragnarok: { icon: '⚔', name: 'Ragnarok', note: 'Cavaleiro de placas: espingarda de dispersão + Tiro Explosivo.' },
    zracks:   { icon: '➶', name: 'Zracks',   note: 'Lagarto caçador: besta perfurante + Investida com lâmina.' },
    nicolau:  { icon: '⚗', name: 'Nicolau Saint-German', note: 'Vendedor de poções: pistola veloz + a Cabeça do Mestre (raio destruidor).' },
    silvyr:   { icon: '⚙', name: 'Silvyr',   note: 'Elfo artífice: lança-chamas + o Arranque Explosivo do braço mecânico.' },
    edward:   { icon: '✦', name: 'Edward Magnus', note: 'Mago humano: bola de fogo arcana + o Poder da Constituição (campo elétrico). Queda suave (levita).' },
    vex:      { icon: '🃏', name: 'Vex', note: 'Bobo da corte metamorfo: adagas arremessadas + a Metamorfose (vira outro herói por 10s, +50 de vida).' },
  },

  // labels/ícones legíveis (a chave técnica fica entre parênteses)
  ENEMY_INFO: {
    zombie:    { icon: '🧟', name: 'Zumbi',          note: 'Mosqueteiro lento; tiro de dispersão.' },
    werewolf:  { icon: '🐺', name: 'Lobisomem',      note: 'Veloz, saltador; metralha de perto.' },
    dragonman: { icon: '🐲', name: 'Homem-Dragão',   note: 'Atira de longe e recua (kite).' },
    demon:     { icon: '👹', name: 'Demônio',        note: 'Mini-chefe; canhão explosivo.' },
    wolf:      { icon: '🐕', name: 'Lobo',           note: 'Fera de corpo a corpo, muito rápida.' },
    direwolf:  { icon: '🐺', name: 'Lobo-Gigante',   note: 'Alfa da matilha; mini-chefe.' },
    skeleton:  { icon: '💀', name: 'Esqueleto',      note: 'Arqueiro morto-vivo; flechas à distância.' },
    ghoul:     { icon: '🧟', name: 'Carniçal',       note: 'Necrófago veloz; saltador corpo-a-corpo.' },
    imp:       { icon: '👺', name: 'Diabrete',       note: 'Pequeno e ágil; cospe brasas.' },
    ogre:      { icon: '🗿', name: 'Ogro',           note: 'Brutamontes tanque; mini-chefe de pancada.' },
    musketeer: { icon: '🎖', name: 'Mosqueteiro',    note: 'Soldado real; rifle preciso e recua (kite).' },
    cultist:   { icon: '🕯', name: 'Cultista',       note: 'Conjurador encapuzado; orbes explosivos.' },
    specter:   { icon: '👻', name: 'Espectro',       note: 'Voa e paira; rajada espectral.' },
    hellhound: { icon: '🔥', name: 'Cão Infernal',   note: 'Fera flamejante velocíssima; saltadora.' },
    flayer:    { icon: '🧠', name: 'Devorador',      note: 'CHEFE. 3 fases: rajada, invocar, bombas.' },
  },
  STATES: [
    { id: 'idle',   label: 'Parado' },
    { id: 'run',    label: 'Correndo' },
    { id: 'attack', label: 'Atacando' },
    { id: 'jump',   label: 'Pulo' },
    { id: 'fall',   label: 'Queda' },
    { id: 'hurt',   label: 'Dano' },
    { id: 'death',  label: 'Morte' },
  ],
  DECOR: [
    { type: 'torch',  name: 'Tocha' },
    { type: 'banner', name: 'Estandarte', color: '#7a2a2a' },
    { type: 'window', name: 'Janela' },
    { type: 'pillar', name: 'Pilar' },
    { type: 'vines',  name: 'Vinhas' },
    { type: 'web',    name: 'Teia de aranha' },
    { type: 'grass',  name: 'Grama' },
    { type: 'bars',   name: 'Grades de cela' },
    { type: 'rack',   name: 'Suporte de armas' },
    { type: 'crate',  name: 'Caixa de suprimentos' },
    { type: 'lantern',   name: 'Lanterna' },
    { type: 'chain',     name: 'Corrente' },
    { type: 'candle',    name: 'Vela' },
    { type: 'cauldron',  name: 'Caldeirão' },
    { type: 'bookshelf', name: 'Estante de livros' },
    { type: 'bed',       name: 'Cama / catre' },
    { type: 'table',     name: 'Mesa' },
    { type: 'idol',      name: 'Ídolo / totem' },
    { type: 'sign',      name: 'Placa de taverna' },
    { type: 'flower',    name: 'Flores' },
    { type: 'shield',    name: 'Escudo heráldico', color: '#7a2a2a' },
    { type: 'door',      name: 'Porta (abre ao passar)' },
  ],
  BIOMES: [
    { id: 'castle',      name: 'Castelo',        sky: ['#1e2740', '#080a14'] },
    { id: 'village',     name: 'Vila',           sky: ['#3a2e26', '#100a08'] },
    { id: 'dungeon',     name: 'Masmorra',       sky: ['#14101c', '#060409'] },
    { id: 'forest',      name: 'Floresta',       sky: ['#16241a', '#070d09'] },
    { id: 'jungle',      name: 'Selva',          sky: ['#5aa0c8', '#23566b'] },
    { id: 'battlefield', name: 'Campo de Guerra', sky: ['#3a1812', '#0c0605'] },
  ],

  open(canvas, onBack) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.onBack = onBack; this.active = true; this.time = 0;
    if (!TEX.ready) TEX.build();   // texturas de bloco são bakeadas sob demanda (normalmente ao carregar a fase)
    if (!SPR.ready) SPR.build();   // garante os sprites procedurais
    this._buildDOM();
    this.setTab('enemies');
    this._key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); this.onBack && this.onBack(); } };
    addEventListener('keydown', this._key, true);
  },
  close() {
    this.active = false;
    if (this.panel) this.panel.style.display = 'none';
    removeEventListener('keydown', this._key, true);
  },

  // ---------- DOM ----------
  _buildDOM() {
    if (this.panel) { this.panel.style.display = 'block'; return; }
    if (!document.getElementById('galleryCSS')) {
      const st = document.createElement('style'); st.id = 'galleryCSS';
      st.textContent = `
        #gallery{position:fixed;inset:0;pointer-events:none;z-index:50;
          font-family:"Trebuchet MS","Segoe UI",sans-serif;color:#e8e0cf;}
        #gallery .gpanel{pointer-events:auto;background:rgba(20,15,10,0.82);
          border:2px solid #5a4326;border-radius:8px;box-shadow:0 0 0 2px #000,0 6px 24px #000;}
        #gallery .gtop{position:absolute;top:12px;left:50%;transform:translateX(-50%);
          display:flex;gap:8px;align-items:center;padding:8px 10px;}
        #gallery .gtab{cursor:pointer;font:inherit;font-weight:bold;font-size:14px;letter-spacing:1px;
          color:#e8e0cf;background:#241a10;border:2px solid #5a4326;border-radius:6px;padding:7px 12px;transition:.12s;}
        #gallery .gtab:hover{background:#3a2c1c;}
        #gallery .gtab.on{border-color:#e8b94a;color:#e8b94a;box-shadow:0 0 10px rgba(232,185,74,.4);}
        #gallery .gback{cursor:pointer;font:inherit;font-weight:bold;font-size:14px;color:#e8e0cf;
          background:linear-gradient(#3a2c1c,#241a10);border:2px solid #b1322c;border-radius:6px;padding:7px 12px;}
        #gallery .gback:hover{background:#4a2018;}
        #gallery .glist{position:absolute;top:64px;left:12px;bottom:12px;width:236px;overflow-y:auto;padding:8px;}
        #gallery .gitem{display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;font:inherit;text-align:left;
          color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:7px 9px;margin-bottom:6px;transition:.1s;}
        #gallery .gitem:hover{background:#3a2c1c;}
        #gallery .gitem.on{border-color:#e8b94a;color:#e8b94a;}
        #gallery .gitem .gem{font-size:18px;width:22px;text-align:center;}
        #gallery .gitem canvas{width:30px;height:30px;border:1px solid #000;border-radius:3px;image-rendering:pixelated;background:#0c0a08;}
        #gallery .gitem .gname{font-size:14px;font-weight:bold;}
        #gallery .gitem .gsub{font-size:11px;color:#9a8f7d;}
        #gallery .ginfo{position:absolute;top:64px;right:12px;width:262px;padding:12px 14px;font-size:13px;line-height:1.5;}
        #gallery .ginfo h3{color:#e8b94a;font-size:18px;margin-bottom:6px;letter-spacing:1px;}
        #gallery .ginfo .grow{display:flex;justify-content:space-between;border-bottom:1px solid #3a2c1c;padding:3px 0;}
        #gallery .ginfo .grow b{color:#e8e0cf;} #gallery .ginfo .grow span{color:#9a8f7d;}
        #gallery .ginfo .gnote{color:#9a8f7d;margin-top:8px;font-size:12px;font-style:italic;}
        #gallery .ginfo .gtags{margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;}
        #gallery .ginfo .gtag{background:#2c2418;border:1px solid #5a4326;border-radius:10px;padding:2px 8px;font-size:11px;color:#caa86a;}
        #gallery .gctrl{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
          display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 10px;max-width:62vw;}
        #gallery .gsbtn{cursor:pointer;font:inherit;font-size:13px;font-weight:bold;color:#e8e0cf;
          background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 11px;transition:.1s;}
        #gallery .gsbtn:hover{background:#3a2c1c;} #gallery .gsbtn.on{border-color:#6fd0ff;color:#6fd0ff;}
        #gallery .ghint{position:absolute;bottom:14px;right:16px;color:#9a8f7d;font-size:12px;pointer-events:none;}
      `;
      document.head.appendChild(st);
    }
    const g = document.createElement('div'); g.id = 'gallery';
    g.innerHTML = `
      <div class="gpanel gtop">
        <button class="gback" data-back>‹ Menu</button>
        <button class="gtab" data-tab="heroes">♟ Heróis</button>
        <button class="gtab" data-tab="enemies">🧟 Bestiário</button>
        <button class="gtab" data-tab="builds">🏰 Construções</button>
        <button class="gtab" data-tab="dungeons">🕳 Masmorras</button>
        <button class="gtab" data-tab="mats">🧱 Materiais</button>
        <button class="gtab" data-tab="decor">🏛 Decoração</button>
        <button class="gtab" data-tab="biomes">🌄 Biomas</button>
      </div>
      <div class="gpanel glist" id="gList"></div>
      <div class="gpanel ginfo" id="gInfo"></div>
      <div class="gpanel gctrl" id="gCtrl" style="display:none"></div>
      <div class="ghint">Esc / ‹ Menu para voltar</div>`;
    document.body.appendChild(g);
    this.panel = g; this.tabsEl = g.querySelector('.gtop');
    this.listEl = g.querySelector('#gList');
    this.infoEl = g.querySelector('#gInfo');
    this.ctrlEl = g.querySelector('#gCtrl');
    g.querySelector('[data-back]').onclick = () => { this.close(); this.onBack && this.onBack(); };
    g.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => this.setTab(b.dataset.tab));
  },

  _isActor(tab) { return (tab || this.tab) === 'enemies' || (tab || this.tab) === 'heroes'; },
  setTab(tab) {
    this.tab = tab;
    this.tabsEl.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    this.ctrlEl.style.display = this._isActor(tab) ? 'flex' : 'none';
    if (this._isActor(tab)) this._buildEnemyCtrl();
    this._buildList();
  },

  _buildEnemyCtrl() {
    const c = this.ctrlEl; c.innerHTML = '';
    this.STATES.forEach(s => {
      const b = document.createElement('button'); b.className = 'gsbtn'; b.textContent = s.label;
      b.classList.toggle('on', !this.autoStates && this.state === s.id);
      b.onclick = () => { this.autoStates = false; this.setState(s.id); };
      c.appendChild(b);
    });
    const auto = document.createElement('button'); auto.className = 'gsbtn'; auto.textContent = '▶ Auto';
    auto.classList.toggle('on', this.autoStates);
    auto.onclick = () => { this.autoStates = !this.autoStates; this.autoT = 0; this._buildEnemyCtrl(); };
    c.appendChild(auto);
    const flip = document.createElement('button'); flip.className = 'gsbtn'; flip.textContent = '⇄ Virar';
    flip.onclick = () => { if (this.m) this.m.face *= -1; };
    c.appendChild(flip);
  },
  setState(id) {
    this.state = id;
    if (this.m) { this.m.dying = null; this.m.dead = false; this.m.flash = 0; this.m._hold = 0; }
    if (this._isActor()) this._buildEnemyCtrl();
  },

  // ---------- listas por aba ----------
  _buildList() {
    const L = this.listEl; L.innerHTML = '';
    const mk = (on, onclick, fill) => {
      const b = document.createElement('button'); b.className = 'gitem' + (on ? ' on' : '');
      fill(b); b.onclick = onclick; L.appendChild(b); return b;
    };
    if (this.tab === 'heroes') {
      HEROES.forEach(h => {
        const info = this.HERO_INFO[h.key] || { icon: h.icon || '♟', name: h.name };
        mk(this.heroKey === h.key, () => this.selectHero(h.key), b => {
          b.innerHTML = `<span class="gem">${info.icon}</span><span><div class="gname">${info.name}</div><div class="gsub">${h.key}</div></span>`;
        });
      });
      if (!this.heroKey) this.selectHero(HEROES[0].key);
    } else if (this.tab === 'enemies') {
      for (const key in ENEMY_TYPES) {
        const info = this.ENEMY_INFO[key] || { icon: '❓', name: key, note: '' };
        const t = ENEMY_TYPES[key];
        mk(this.enemyKey === key, () => this.selectEnemy(key), b => {
          b.innerHTML = `<span class="gem">${info.icon}</span><span><div class="gname">${info.name}${t.boss ? ' ★' : t.mini ? ' ✦' : ''}</div><div class="gsub">${key}</div></span>`;
        });
      }
      if (!this.enemyKey) this.selectEnemy(Object.keys(ENEMY_TYPES)[0]);
    } else if (this.tab === 'mats') {
      for (let id = 1; id < MAT.length; id++) {
        const m = MAT[id]; if (!m) continue;
        mk(this.matId === id, () => this.selectMat(id), b => {
          const sw = document.createElement('canvas'); sw.width = sw.height = 30;
          const tile = TEX.tiles[id] && TEX.tiles[id][0];
          if (tile) sw.getContext('2d').drawImage(tile, 0, 0, 30, 30);
          b.appendChild(sw);
          const sp = document.createElement('span');
          sp.innerHTML = `<div class="gname">${m.name}</div><div class="gsub">HP ${m.indestructible ? '∞' : m.hp}</div>`;
          b.appendChild(sp);
        });
      }
      if (this.matId == null) this.selectMat(1);
    } else if (this.tab === 'decor') {
      this.DECOR.forEach(d => {
        mk(this.decorType === d.type, () => this.selectDecor(d.type), b => {
          b.innerHTML = `<span class="gem">🏛</span><span><div class="gname">${d.name}</div><div class="gsub">${d.type}</div></span>`;
        });
      });
      if (!this.decorType) this.selectDecor(this.DECOR[0].type);
    } else if (this.tab === 'biomes') {
      this.BIOMES.forEach(bm => {
        mk(this.biome === bm.id, () => this.selectBiome(bm.id), b => {
          b.innerHTML = `<span class="gem">🌄</span><span><div class="gname">${bm.name}</div><div class="gsub">${bm.id}</div></span>`;
        });
      });
      if (!this.biome) this.selectBiome(this.BIOMES[0].id);
    } else if (this.tab === 'builds') {
      (window.BUILDINGS || []).forEach(def => {
        mk(this.buildKey === def.key, () => this.selectBuild(def.key), b => {
          b.innerHTML = `<span class="gem">🏰</span><span><div class="gname">${def.name}</div><div class="gsub">${def.w}×${def.h} tiles</div></span>`;
        });
      });
      if (!this.buildKey && window.BUILDINGS && window.BUILDINGS.length) this.selectBuild(window.BUILDINGS[0].key);
    } else if (this.tab === 'dungeons') {
      (window.DUNGEONS || []).forEach(def => {
        mk(this.dunKey === def.key, () => this.selectDungeon(def.key), b => {
          b.innerHTML = `<span class="gem">🕳</span><span><div class="gname">${def.name}</div><div class="gsub">${def.w}×${def.h} tiles</div></span>`;
        });
      });
      if (!this.dunKey && window.DUNGEONS && window.DUNGEONS.length) this.selectDungeon(window.DUNGEONS[0].key);
    }
  },

  // ---------- seleção ----------
  selectEnemy(key) {
    this.enemyKey = key; this.heroKey = null; const t = ENEMY_TYPES[key];
    this.m = {
      spr: t.spr, w: t.w, h: t.h, x: 0, y: 0, face: 1,
      vx: 0, vy: 0, onGround: true, anim: 0, runDist: 0,
      flash: 0, aimAng: 0, cool: 0, coolMax: 0.18, dying: null, dead: false,
      dyingMax: t.boss ? 1.2 : 0.55, dashT: 0, _hold: 0, _spd: t.speed,
      get cx() { return this.x + this.w / 2; },
    };
    if (this.autoStates) this.autoT = 0; else this.setState(this.state);
    this._buildList(); this._info();
  },
  selectHero(key) {
    const h = HEROES.find(x => x.key === key) || HEROES[0];
    this.heroKey = h.key; this.enemyKey = null;
    this.m = {
      spr: h.spr, w: h.w, h: h.h, x: 0, y: 0, face: 1,
      vx: 0, vy: 0, onGround: true, anim: 0, runDist: 0,
      flash: 0, aimAng: 0, cool: 0, coolMax: 0.2, dying: null, dead: false,
      dyingMax: 0.7, dashT: 0, _hold: 0, _spd: h.speed,
      get cx() { return this.x + this.w / 2; },
    };
    if (this.autoStates) this.autoT = 0; else this.setState(this.state);
    this._buildList(); this._info();
  },
  selectMat(id) { this.matId = id; this._buildList(); this._info(); },
  selectDecor(type) { this.decorType = type; this._buildList(); this._info(); },
  selectBiome(id) { this.biome = id; this.biomeCamX = 0; this._buildList(); this._info(); },
  selectBuild(key) { this.buildKey = key; this.buildPrev = this._buildPreview(window.BUILD[key]); this._buildList(); this._info(); },
  selectDungeon(key) { this.dunKey = key; this.dunPrev = this._buildDungeonPreview((window.DUNGEONS || []).find(d => d.key === key)); this._buildList(); this._info(); },

  // monta um World temporário com a dungeon ESCAVADA na terra (terreno ao redor preenchido)
  _buildDungeonPreview(def) {
    if (!def) return null;
    if (!TEX.ready) TEX.build();
    const pad = 3, gw = def.w + pad * 2, surfR = 4, gh = surfR + def.h + 3;
    const g = [], bg = [];
    for (let r = 0; r < gh; r++) { g.push(new Array(gw).fill('.')); bg.push(new Array(gw).fill('.')); }
    for (let r = surfR; r < gh; r++) for (let c = 0; c < gw; c++) g[r][c] = def.surf || 'D';   // exterior de terra/pedra
    try { def.stamp(g, bg, pad, surfR, { gallery: true }); } catch (e) { /* tolerante a falha */ }
    const world = new World(gw, gh);
    const decor = [], marks = [];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
      const ch = g[r][c], id = CHAR2MAT[ch];
      if (id) world.set(c, r, id);
      const bid = CHAR2MAT[bg[r][c]]; if (bid) world.setBg(c, r, bid);
      if (!id) {
        if (DECOR_CHARS[ch]) decor.push({ type: DECOR_CHARS[ch], x: c * CONFIG.TILE, y: r * CONFIG.TILE, color: '#7a2a2a' });
        else if (typeof CHAR2ENEMY !== 'undefined' && CHAR2ENEMY[ch]) marks.push({ kind: 'enemy', key: CHAR2ENEMY[ch], c, r });
        else if ('oTHQ'.indexOf(ch) >= 0) marks.push({ kind: ch, c, r });
      }
    }
    if (world.markGrass) world.markGrass();
    return { world, decor, marks, gw, gh, def };
  },

  // monta um World temporário com o prefab carimbado, para o preview
  _buildPreview(def) {
    if (!def) return null;
    if (!TEX.ready) TEX.build();
    const pad = 4, gw = def.w + pad * 2, gh = def.h + 6, groundR = gh - 3;
    const g = [], bg = [];
    for (let r = 0; r < gh; r++) { g.push(new Array(gw).fill('.')); bg.push(new Array(gw).fill('.')); }
    for (let r = groundR; r < gh; r++) for (let c = 0; c < gw; c++) g[r][c] = def.ground || '#';
    try { def.stamp(g, bg, pad, groundR, {}); } catch (e) { /* preview tolerante a falha */ }
    const world = new World(gw, gh);
    const decor = [];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
      const ch = g[r][c], id = CHAR2MAT[ch];
      if (id) world.set(c, r, id);
      const bid = CHAR2MAT[bg[r][c]]; if (bid) world.setBg(c, r, bid);
      if (!id && DECOR_CHARS[ch]) decor.push({ type: DECOR_CHARS[ch], x: c * CONFIG.TILE, y: r * CONFIG.TILE, color: '#7a2a2a' });
    }
    return { world, decor, gw, gh, def };
  },

  // ---------- painel de informações ----------
  _info() {
    const I = this.infoEl; if (!I) return;
    const row = (k, v) => `<div class="grow"><b>${k}</b><span>${v}</span></div>`;
    if (this.tab === 'heroes') {
      const h = HEROES.find(x => x.key === this.heroKey) || HEROES[0];
      const info = this.HERO_INFO[h.key] || {};
      const w = (typeof WEAPONS !== 'undefined' && WEAPONS[h.weaponKey]) || {};
      I.innerHTML = `<h3>${info.icon || h.icon || ''} ${info.name || h.name}</h3>
        ${row('Vida', h.hp)}${row('Velocidade', h.speed)}${row('Pulos', h.jumps)}
        ${row('Arma', w.name || '—')}${row('Pente', w.clip != null ? w.clip : '—')}${row('Recarga', w.reload != null ? w.reload + 's' : '—')}
        ${row('Cadência', w.cool != null ? w.cool + 's' : '—')}
        <div class="gnote">${h.desc || info.note || ''}</div>
        <div class="gnote">${w.desc || ''}</div>`;
    } else if (this.tab === 'enemies') {
      const t = ENEMY_TYPES[this.enemyKey], info = this.ENEMY_INFO[this.enemyKey] || {};
      const tags = [];
      if (t.boss) tags.push('CHEFE'); if (t.mini) tags.push('mini-chefe');
      if (t.leaper) tags.push('saltador'); if (t.kite) tags.push('kite');
      const atk = { blast: 'dispersão', smg: 'metralhadora', rifle: 'rifle', cannon: 'canhão explosivo', arrow: 'flechas', fire: 'brasa' };
      I.innerHTML = `<h3>${info.icon || ''} ${info.name || this.enemyKey}</h3>
        ${row('Vida', t.hp)}${row('Velocidade', t.speed)}${row('Dano contato', t.touch)}
        ${row('Ataque', t.atk ? (atk[t.atk] || t.atk) : 'corpo a corpo')}
        ${t.range ? row('Alcance', t.range) : ''}${row('Pontos', t.score)}
        <div class="gtags">${tags.map(x => `<span class="gtag">${x}</span>`).join('')}</div>
        <div class="gnote">${info.note || ''}</div>`;
    } else if (this.tab === 'mats') {
      const m = MAT[this.matId];
      const tags = [];
      if (m.indestructible) tags.push('indestrutível'); if (m.falls) tags.push('cai (gravidade)');
      if (m.soft) tags.push('macio'); if (m.barrel) tags.push('explosivo'); if (m.rocket) tags.push('lança foguete');
      if (m.gold) tags.push('ouro'); if (m.ladder) tags.push('escada'); if (m.cap) tags.push('topo: ' + m.cap);
      if (m.solid) tags.push('sólido');
      I.innerHTML = `<h3>🧱 ${m.name}</h3>
        ${row('Vida do bloco', m.indestructible ? '∞' : m.hp)}
        ${row('Cor base', `<span style="display:inline-block;width:12px;height:12px;background:${m.c};border:1px solid #000;vertical-align:middle"></span> ${m.c}`)}
        ${row('Variantes', (TEX.tiles[this.matId] || []).length)}
        <div class="gtags">${tags.map(x => `<span class="gtag">${x}</span>`).join('')}</div>
        <div class="gnote">Mostrando as ${(TEX.tiles[this.matId] || []).length} variantes texturizadas em tamanho ampliado.</div>`;
    } else if (this.tab === 'decor') {
      const d = this.DECOR.find(x => x.type === this.decorType);
      I.innerHTML = `<h3>🏛 ${d.name}</h3>${row('Tipo', d.type)}
        <div class="gnote">Prop não-sólido posicionado no mapa (decoração/construção). Animado em tempo real.</div>`;
    } else if (this.tab === 'biomes') {
      const bm = this.BIOMES.find(x => x.id === this.biome);
      I.innerHTML = `<h3>🌄 ${bm.name}</h3>${row('Chave', bm.id)}
        ${row('Céu', `${bm.sky[0]} → ${bm.sky[1]}`)}
        <div class="gnote">Fundo em parallax animado. A câmera desliza para revelar as camadas.</div>`;
    } else if (this.tab === 'builds') {
      const def = window.BUILD[this.buildKey];
      I.innerHTML = `<h3>🏰 ${def.name}</h3>
        ${row('Tamanho', def.w + ' × ' + def.h + ' tiles')}
        ${row('Terreno', def.ground)}
        <div class="gnote">${def.desc || ''}</div>
        <div class="gnote">Construção usada nas fases: paredes laterais com vão de passagem embaixo, interior preenchido e decoração temática.</div>`;
    }
  },

  // ---------- loop ----------
  tick(dt) {
    if (!this.active) return;
    this.time += dt;
    if (this._isActor()) this._updateEnemy(dt);
    else this.biomeCamX += dt * 60;
    this._draw();
  },

  _updateEnemy(dt) {
    const m = this.m; if (!m) return;
    if (this.autoStates) {
      this.autoT += dt;
      const seq = ['idle', 'run', 'attack', 'jump', 'fall', 'hurt', 'death'];
      const dur = 2.2, idx = Math.floor(this.autoT / dur) % seq.length;
      const ns = seq[idx];
      if (ns !== this.state) { this.state = ns; m.dying = null; m.dead = false; m.flash = 0; m._hold = 0; }
    }
    m.anim += dt;
    const spd = Math.max(60, m._spd || 120);
    // mira 1D: arma SEMPRE apontada para a frente (sem balanço de mouse)
    m.aimAng = (m.face || 1) > 0 ? 0 : Math.PI;
    m.cool = Math.max(0, m.cool - dt);
    // defaults do quadro
    m.onGround = true; m.vy = 0; m.flash = 0;
    if (this.state !== 'run') m.vx = 0;
    switch (this.state) {
      case 'idle': break;
      case 'run': m.vx = spd * (m.face || 1); m.runDist += Math.abs(m.vx) * dt; break;
      case 'attack':
        if (m.cool <= 0) { m.cool = m.coolMax; }   // pulsa apenas o recuo (arma estática)
        break;
      case 'jump': m.onGround = false; m.vy = -200; break;
      case 'fall': m.onGround = false; m.vy = 200; break;
      case 'hurt': m.flash = 0.2; break;
      case 'death':
        if (m.dying == null) { m.dying = m.dyingMax; m.dead = true; m._hold = 0; }
        m.dying -= dt;
        if (m.dying <= 0) { m.dying = 0; m._hold += dt; if (m._hold > 0.9) { m.dying = m.dyingMax; m._hold = 0; } }
        break;
    }
  },

  _draw() {
    const ctx = this.ctx, z = CONFIG.ZOOM, W = CONFIG.W, H = CONFIG.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (this.tab === 'biomes') {
      const bm = this.BIOMES.find(x => x.id === this.biome);
      BG.draw(ctx, { x: this.biomeCamX, _sx: 0, _sy: 0, get ox() { return -this.x; }, get oy() { return 0; } },
        { biome: bm.id, sky: bm.sky }, this.time);
      return;
    }
    if (this.tab === 'builds') { this._drawBuild(ctx, W, H); return; }
    if (this.tab === 'dungeons') { this._drawDungeon(ctx, W, H); return; }
    // backdrop comum (estúdio)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241c14'); g.addColorStop(1, '#0c0a08');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(z, z);
    const vw = W / z, vh = H / z;

    if (this._isActor()) {
      const m = this.m; if (m) {
        const feetF = 0.70;
        const feetY = vh * feetF;
        this._floor(ctx, vw, feetY);
        const cam = { ox: vw / 2 - m.cx, oy: feetY - (m.y + m.h) };
        drawFighter(ctx, m, cam, true);
      }
    } else if (this.tab === 'mats') {
      this._drawMat(ctx, vw, vh);
    } else if (this.tab === 'decor') {
      this._drawDecor(ctx, vw, vh);
    }
    ctx.restore();
  },

  _drawBuild(ctx, W, H) {
    const P = this.buildPrev; const T = CONFIG.TILE;
    // céu suave de estúdio
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a5a72'); g.addColorStop(1, '#1a2230');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!P) return;
    const wpx = P.gw * T, hpx = P.gh * T;
    const z = Math.min((W * 0.62) / wpx, (H * 0.74) / hpx);   // ajusta para caber
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(z, z);
    const offX = (W / z - wpx) / 2, offY = (H / z - hpx) / 2;
    const cam = { x: 0, y: 0, vw: W / z, vh: H / z, ox: offX, oy: offY, visible: () => true };
    P.world.draw(ctx, cam);
    for (const d of P.decor) TEX.decorPixel(ctx, d, offX, offY, this.time, null);
    ctx.restore();
  },

  _drawDungeon(ctx, W, H) {
    const P = this.dunPrev, T = CONFIG.TILE;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2018'); g.addColorStop(1, '#0a0806');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!P) return;
    const wpx = P.gw * T, hpx = P.gh * T;
    const z = Math.min((W * 0.66) / wpx, (H * 0.82) / hpx);   // cabe a dungeon inteira
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(z, z);
    const offX = (W / z - wpx) / 2, offY = (H / z - hpx) / 2;
    const cam = { x: 0, y: 0, vw: W / z, vh: H / z, ox: offX, oy: offY, visible: () => true };
    P.world.draw(ctx, cam);
    for (const d of P.decor) TEX.decorPixel(ctx, d, offX, offY, this.time, null);
    // marcadores de monstros (●) e tesouros (orégano/token/poção/vida)
    const LOOT = { o: ['#7be08a', '🌿'], T: ['#e0843a', '⬡'], Q: ['#6fd0ff', '⚗'], H: ['#ff5b6e', '✚'] };
    for (const mk of P.marks) {
      const x = mk.c * T + T / 2 + offX, y = mk.r * T + T / 2 + offY;
      if (mk.kind === 'enemy') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0473a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 1, 1.6, 2); ctx.fillRect(x + 1, y - 1, 1.6, 2);
      } else {
        const L = LOOT[mk.kind] || ['#fff', '?'];
        ctx.fillStyle = L[0]; ctx.font = 'bold 12px "Trebuchet MS"'; ctx.textAlign = 'center';
        ctx.fillText(L[1], x, y + 4);
      }
    }
    ctx.textAlign = 'left';
    ctx.restore();
    // legenda
    ctx.fillStyle = '#caa86a'; ctx.font = '13px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText('● monstros   🌿 orégano   ⬡ token   ⚗ poção   ✚ vida', W / 2, H - 14);
    ctx.textAlign = 'left';
  },

  _floor(ctx, vw, feetY) {
    const T = CONFIG.TILE, stone = TEX.tiles[2];
    for (let x = 0; x < vw + T; x += T) {
      const img = stone && stone[(x / T | 0) % stone.length];
      if (img) ctx.drawImage(img, x, feetY); else { ctx.fillStyle = '#46413c'; ctx.fillRect(x, feetY, T, T); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, feetY, vw, 3);
  },

  _drawMat(ctx, vw, vh) {
    const variants = TEX.tiles[this.matId] || [];
    const T = CONFIG.TILE, scale = 5, sz = T * scale;
    const gap = 28, totalW = variants.length * sz + (variants.length - 1) * gap;
    let x0 = (vw - totalW) / 2, y0 = vh / 2 - sz / 2 - 6;
    ctx.imageSmoothingEnabled = false;
    variants.forEach((v, i) => {
      const x = x0 + i * (sz + gap);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y0 - 3, sz + 6, sz + 6);
      ctx.drawImage(v, 0, 0, T, T, x, y0, sz, sz);
      ctx.fillStyle = '#9a8f7d'; ctx.font = '10px "Trebuchet MS"'; ctx.textAlign = 'center';
      ctx.fillText('var ' + (i + 1), x + sz / 2, y0 + sz + 14);
    });
    ctx.textAlign = 'left';
  },

  _drawDecor(ctx, vw, vh) {
    const T = CONFIG.TILE, scale = 4, d = this.DECOR.find(x => x.type === this.decorType);
    const cx = vw / 2, cy = vh / 2;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    // bloco de pedra de referência atrás (props ficam sobre/junto a tiles)
    const stone = TEX.tiles[2] && TEX.tiles[2][0];
    if (stone) { ctx.globalAlpha = 0.5; ctx.drawImage(stone, -T / 2, T / 2); ctx.globalAlpha = 1; }
    // o decor desenha em (d.x+ox, d.y+oy); centralizamos o tile em 0,0
    TEX.decor(ctx, { type: d.type, x: 0, y: 0, color: d.color }, -T / 2, -T / 2, this.time, null);
    ctx.restore();
  },
};

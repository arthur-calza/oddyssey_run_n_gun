/* ============================================================
   editor.js — FERRAMENTA DE CRIAÇÃO (level/prefab editor)
   Um editor de tiles completo, no mesmo canvas do jogo:
     • Paleta: Materiais, Fundo, Decoração, Entidades, Construções,
       Masmorras e Salvos (criações do jogador).
     • Ferramentas: pincel, linha, retângulo, balde, borracha,
       seleção, carimbo (copiar/colar trechos) e conta-gotas.
     • Câmera: arrastar com botão direito (ou Espaço+arrasto),
       zoom com a roda do mouse.
     • Salvar criações na ENCICLOPÉDIA (reutilizáveis como prefabs)
       e TESTAR a criação como uma fase jogável.
   Controlado por main.js (Editor.open / close / tick).
   ============================================================ */

/* ---- persistência das criações do jogador ------------------ */
const Creations = {
  KEY: 'oddyssey_creations_v1',
  list: [],
  load() { try { const s = localStorage.getItem(this.KEY); if (s) this.list = JSON.parse(s) || []; } catch (e) { this.list = []; } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.list)); } catch (e) {} },
  get(key) { return this.list.find(c => c.key === key); },
  add(cr) { this.list.push(cr); this.save(); this.register(cr); return cr; },
  remove(key) {
    this.list = this.list.filter(c => c.key !== key); this.save();
    if (window.BUILDINGS) { const i = window.BUILDINGS.findIndex(d => d.key === key); if (i >= 0) window.BUILDINGS.splice(i, 1); }
    if (window.BUILD) delete window.BUILD[key];
  },
  // registra uma criação como prefab "Construção" (aparece na enciclopédia/editor)
  register(cr) {
    if (!window.BUILDINGS || !window.BUILD || window.BUILD[cr.key]) return;
    const putCell = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch; };
    const def = {
      key: cr.key, name: cr.name, desc: 'Criação personalizada (editor).',
      w: cr.w, h: cr.h, ground: '#', custom: true,
      stamp(g, bg, c0, baseR, o) {
        const top = baseR - cr.h + 1;
        for (let rr = 0; rr < cr.h; rr++) {
          const line = cr.cells[rr] || '', bln = (cr.bg && cr.bg[rr]) || '';
          for (let cc = 0; cc < cr.w; cc++) {
            const ch = line[cc]; if (ch && ch !== '.') putCell(g, c0 + cc, top + rr, ch);
            const bch = bln[cc]; if (bch && bch !== '.') putCell(bg, c0 + cc, top + rr, bch);
          }
        }
      },
    };
    window.BUILDINGS.push(def); window.BUILD[cr.key] = def;
  },
  registerAll() { this.list.forEach(c => this.register(c)); },
};

/* ---- helpers de grade -------------------------------------- */
function _mkGrid(w, h, ch) { const g = []; for (let r = 0; r < h; r++) g.push(new Array(w).fill(ch)); return g; }
function _trimClip(g, bg) {
  let minR = 1e9, maxR = -1, minC = 1e9, maxC = -1;
  const H = g.length, W = g[0].length;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const a = g[r][c], b = bg ? bg[r][c] : '.';
    if ((a && a !== '.') || (b && b !== '.')) { if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c; }
  }
  if (maxR < 0) return null;
  const cells = [], bgs = [];
  for (let r = minR; r <= maxR; r++) {
    cells.push(g[r].slice(minC, maxC + 1).join(''));
    bgs.push(bg ? bg[r].slice(minC, maxC + 1).join('') : '.'.repeat(maxC - minC + 1));
  }
  return { w: maxC - minC + 1, h: maxR - minR + 1, cells, bg: bgs };
}

const Editor = {
  active: false, canvas: null, ctx: null, time: 0, cb: null,
  tab: 'mats', tool: 'brush', layer: 1, brushSize: 1,
  world: null, objs: null, view: null,
  cur: null, curId: null, clip: null, clipName: '', clipSrc: null, sel: null,
  clips: [], undoStack: [],
  hov: { c: 0, r: 0 }, _dirty: false, _ld: false, _pan: null,
  _ls: null, _rs: null, _ss: null, _panelHidden: {},
  SIZES: [1, 2, 3, 5, 8],

  TOOLS: [
    { id: 'pan',      label: 'Mover',       key: '0' },
    { id: 'brush',    label: 'Pincel',      key: '1' },
    { id: 'line',     label: 'Linha',       key: '2' },
    { id: 'rect',     label: 'Retângulo',   key: '3' },
    { id: 'bucket',   label: 'Balde',       key: '4' },
    { id: 'erase',    label: 'Borracha',    key: '5' },
    { id: 'select',   label: 'Seleção',     key: '6' },
    { id: 'stamp',    label: 'Carimbo',     key: '7' },
    { id: 'eyedrop',  label: 'Conta-gotas', key: '8' },
  ],
  TABS: [
    { id: 'mats',     label: '🧱 Materiais' },
    { id: 'decor',    label: '🏛 Decoração' },
    { id: 'enemies',  label: '🧟 Inimigos' },
    { id: 'items',    label: '🎁 Itens' },
    { id: 'builds',   label: '🏰 Construções' },
    { id: 'dungeons', label: '🕳 Masmorras' },
    { id: 'saved',    label: '💾 Salvos' },
  ],
  PICK2CHAR: { oregano: 'o', life: 'H', potion: 'Q', token: 'T' },
  PICKBYCHAR: { o: 'oregano', H: 'life', Q: 'potion', T: 'token' },
  PICK_INFO: { oregano: ['🌿', 'Orégano'], life: ['✚', 'Vida'], potion: ['⚗', 'Poção mágica'], token: ['⬡', 'Token Rei do Picadão'] },

  // ---------------- ciclo de vida ----------------
  open(canvas, cb) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cb = cb;
    this.active = true; this.time = 0;
    if (!TEX.ready) TEX.build();
    if (!SPR.ready) SPR.build();
    // mapas reversos (id/tipo -> char) p/ serializar no formato dos níveis
    this.MAT2CHAR = {}; for (const ch in CHAR2MAT) this.MAT2CHAR[CHAR2MAT[ch]] = ch;
    this.DECOR2CHAR = {}; for (const ch in DECOR_CHARS) this.DECOR2CHAR[DECOR_CHARS[ch]] = ch;
    this.ENEMY2CHAR = {}; for (const ch in CHAR2ENEMY) this.ENEMY2CHAR[CHAR2ENEMY[ch]] = ch;
    this._clipCache = {};
    if (!this.world) this._newScene(false);
    this.view = this.view || { x: 0, y: 0, zoom: 1 };
    this._buildDOM();
    this.setTool('brush'); this.setTab('mats'); this.setBrushSize(this.brushSize);
    this._wheel = (e) => { e.preventDefault(); this._onWheel(e); };
    canvas.addEventListener('wheel', this._wheel, { passive: false });
    this._key = (e) => {
      const k = (e.key || '').toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') { e.preventDefault(); e.stopPropagation(); this._undo(); }
        else if (k === 'c') { e.preventDefault(); e.stopPropagation(); this._copySelection(); }
        else if (k === 'v') { e.preventDefault(); e.stopPropagation(); this._paste(); }
        return;
      }
      if (k === 'tab') { e.preventDefault(); e.stopPropagation(); this._toggleAll(); return; }
      if (k === 'escape') { e.stopPropagation(); this._back(); }
    };
    addEventListener('keydown', this._key, true);
  },
  close() {
    this.active = false;
    if (this.panel) this.panel.style.display = 'none';
    if (this._wheel) this.canvas.removeEventListener('wheel', this._wheel);
    removeEventListener('keydown', this._key, true);
  },
  _back() { this.close(); this.cb && this.cb.onBack && this.cb.onBack(); },

  _newScene(confirmFirst) {
    if (confirmFirst && !confirm('Começar uma criação em branco? O trabalho atual não salvo será perdido.')) return;
    const cols = 100, rows = 46;
    this.world = new World(cols, rows);
    this.objs = new Map();
    const groundR = rows - 8;
    for (let c = 0; c < cols; c++) for (let r = groundR; r < rows; r++) this.world.set(c, r, r === groundR ? 1 : 2);
    this.objs.set('5,' + (groundR - 1), { kind: 'marker', m: 'spawn', char: 'P' });
    this.objs.set((cols - 6) + ',' + (groundR - 1), { kind: 'marker', m: 'exit', char: 'E' });
    this.world.markGrass();
    this.sel = null; this.clip = null; this.undoStack = [];
    this.view = { x: 0, y: Math.max(0, (groundR - 16) * CONFIG.TILE), zoom: 1 };
  },

  _resizeWorld(nc, nr) {
    this._pushUndo();
    const old = this.world, oc = old.cols, or = old.rows;
    const nw = new World(nc, nr);
    for (let r = 0; r < Math.min(or, nr); r++) for (let c = 0; c < Math.min(oc, nc); c++) {
      const oi = old.idx(c, r), ni = nw.idx(c, r);
      nw.mat[ni] = old.mat[oi]; nw.bg[ni] = old.bg[oi]; nw.hp[ni] = old.hp[oi]; nw.grass[ni] = old.grass[oi];
    }
    this.world = nw; this._dirty = true;
  },

  // ---------------- DOM ----------------
  _buildDOM() {
    if (this.panel) { this.panel.style.display = 'block'; return; }
    if (!document.getElementById('editorCSS')) {
      const st = document.createElement('style'); st.id = 'editorCSS';
      st.textContent = `
        #editor{position:fixed;inset:0;pointer-events:none;z-index:50;font-family:"Trebuchet MS","Segoe UI",sans-serif;color:#e8e0cf;}
        #editor .epanel{pointer-events:auto;background:rgba(20,15,10,0.86);border:2px solid #5a4326;border-radius:8px;box-shadow:0 0 0 2px #000,0 6px 24px #000;}
        #editor .etop{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;padding:7px 9px;flex-wrap:wrap;max-width:96vw;justify-content:center;}
        #editor .etab,#editor .ebtn{cursor:pointer;font:inherit;font-weight:bold;font-size:13px;letter-spacing:.5px;color:#e8e0cf;background:#241a10;border:2px solid #5a4326;border-radius:6px;padding:6px 10px;transition:.1s;}
        #editor .etab:hover,#editor .ebtn:hover{background:#3a2c1c;}
        #editor .etab.on{border-color:#e8b94a;color:#e8b94a;box-shadow:0 0 8px rgba(232,185,74,.4);}
        #editor .eback{border-color:#b1322c;}
        #editor .ebtn.go{border-color:#3a5a2a;color:#7be08a;}
        #editor .ebtn.save{border-color:#2b7fd0;color:#6fd0ff;}
        #editor .elist{position:absolute;top:96px;left:12px;bottom:104px;width:228px;overflow-y:auto;padding:8px;}
        #editor .eitem{display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;font:inherit;text-align:left;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 8px;margin-bottom:5px;transition:.1s;}
        #editor .eitem:hover{background:#3a2c1c;}
        #editor .eitem.on{border-color:#e8b94a;color:#e8b94a;}
        #editor .eitem .eem{font-size:18px;width:24px;text-align:center;}
        #editor .eitem canvas{width:28px;height:28px;border:1px solid #000;border-radius:3px;image-rendering:pixelated;background:#0c0a08;}
        #editor .eitem .enm{font-size:13px;font-weight:bold;}
        #editor .eitem .esub{font-size:11px;color:#9a8f7d;}
        #editor .eitem .edel{margin-left:auto;color:#b1322c;font-weight:bold;border:1px solid #5a2420;border-radius:4px;background:#2a1410;padding:1px 6px;cursor:pointer;}
        #editor .einfo{position:absolute;top:96px;right:12px;width:236px;bottom:104px;overflow-y:auto;padding:10px 12px;font-size:12px;line-height:1.5;}
        #editor .einfo h3{color:#e8b94a;font-size:15px;margin:2px 0 6px;letter-spacing:1px;}
        #editor .einfo .erow{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;}
        #editor .einfo .erow .ebtn{font-size:12px;padding:5px 8px;}
        #editor .einfo .ehelp{color:#9a8f7d;font-size:11.5px;margin-top:8px;border-top:1px solid #3a2c1c;padding-top:8px;}
        #editor .etools{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px;max-width:96vw;}
        #editor .etoolrow{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;}
        #editor .esbtn{cursor:pointer;font:inherit;font-size:12.5px;font-weight:bold;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:6px;padding:6px 9px;transition:.1s;}
        #editor .esbtn:hover{background:#3a2c1c;} #editor .esbtn.on{border-color:#6fd0ff;color:#6fd0ff;box-shadow:0 0 8px rgba(111,208,255,.35);}
        #editor .esbtn.sz{padding:6px 8px;min-width:30px;text-align:center;}
        #editor .esep{width:1px;height:20px;background:#5a4326;margin:0 3px;}
        #editor .estatus{color:#caa86a;font-size:12px;text-shadow:1px 1px 0 #000;text-align:center;}
        #editor .etoast{position:absolute;top:84px;left:50%;transform:translateX(-50%);pointer-events:none;background:rgba(20,40,16,0.92);border:2px solid #3a5a2a;color:#bff0c0;border-radius:8px;padding:8px 16px;font-weight:bold;opacity:0;transition:opacity .3s;}
        #editor .etoggles{position:absolute;top:54px;left:12px;display:flex;gap:5px;pointer-events:auto;background:rgba(20,15,10,0.88);border:2px solid #5a4326;border-radius:7px;padding:5px 6px;z-index:6;}
        #editor .etgl{cursor:pointer;font:inherit;font-size:11px;font-weight:bold;color:#e8e0cf;background:#241a10;border:2px solid #4a3826;border-radius:5px;padding:4px 7px;}
        #editor .etgl:hover{background:#3a2c1c;border-color:#e8b94a;}
        #editor .etgl.off{opacity:.5;border-color:#3a2c1c;color:#9a8f7d;}
      `;
      document.head.appendChild(st);
    }
    const e = document.createElement('div'); e.id = 'editor';
    e.innerHTML = `
      <div class="epanel etop" id="eTop"></div>
      <div class="epanel elist" id="eList"></div>
      <div class="epanel einfo" id="eInfo"></div>
      <div class="epanel etools" id="eTools"></div>
      <div class="etoast" id="eToast"></div>`;
    document.body.appendChild(e);
    this.panel = e;
    this.listEl = e.querySelector('#eList'); this.infoEl = e.querySelector('#eInfo');
    this.toastEl = e.querySelector('#eToast');

    // barra superior: voltar + abas + ações
    const top = e.querySelector('#eTop');
    const back = document.createElement('button'); back.className = 'etab eback'; back.textContent = '‹ Menu';
    back.onclick = () => this._back(); top.appendChild(back);
    this.TABS.forEach(t => {
      const b = document.createElement('button'); b.className = 'etab'; b.dataset.tab = t.id; b.textContent = t.label;
      b.onclick = () => this.setTab(t.id); top.appendChild(b);
    });
    const sep = document.createElement('span'); sep.style.cssText = 'width:1px;height:22px;background:#5a4326;margin:0 2px;'; top.appendChild(sep);
    const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'ebtn' + (cls ? ' ' + cls : ''); b.textContent = txt; b.onclick = fn; top.appendChild(b); return b; };
    mk('🆕 Novo', '', () => { this._newScene(true); this.setTab(this.tab); });
    mk('💾 Salvar', 'save', () => this._saveCreation());
    mk('▶ Testar', 'go', () => this._test());
    this.tabsTop = top;

    // barra inferior: legenda (em cima) + ferramentas e tamanho do pincel (embaixo)
    const tb = e.querySelector('#eTools');
    const statusLine = document.createElement('div'); statusLine.className = 'estatus';
    tb.appendChild(statusLine); this.statusEl = statusLine;
    const row = document.createElement('div'); row.className = 'etoolrow';
    this.TOOLS.forEach(t => {
      const b = document.createElement('button'); b.className = 'esbtn'; b.dataset.tool = t.id;
      b.textContent = t.label + ' (' + t.key + ')';
      b.onclick = () => this.setTool(t.id); row.appendChild(b);
    });
    const sep2 = document.createElement('span'); sep2.className = 'esep'; row.appendChild(sep2);
    const szlab = document.createElement('span'); szlab.style.cssText = 'font-size:12px;color:#9a8f7d;'; szlab.textContent = 'Tam:'; row.appendChild(szlab);
    this.SIZES.forEach(s => {
      const b = document.createElement('button'); b.className = 'esbtn sz'; b.dataset.size = s; b.textContent = s;
      b.title = 'Tamanho do pincel/borracha ([ ])'; b.onclick = () => this.setBrushSize(s); row.appendChild(b);
    });
    tb.appendChild(row);

    // botões para recolher/expandir os painéis (Tab = recolher tudo)
    const tg = document.createElement('div'); tg.className = 'etoggles';
    [['list', '◧ Paleta'], ['info', '▤ Painel'], ['tools', '▭ Barra'], ['top', '▦ Abas']].forEach(([k, lbl]) => {
      const b = document.createElement('button'); b.className = 'etgl'; b.dataset.panel = k; b.textContent = lbl;
      b.title = 'Mostrar/ocultar (Tab oculta tudo)'; b.onclick = () => this._togglePanel(k); tg.appendChild(b);
    });
    e.appendChild(tg); this._togglesEl = tg;
    this._applyPanels();
  },

  _togglePanel(which) { this._panelHidden[which] = !this._panelHidden[which]; this._applyPanels(); },
  _toggleAll() {
    const keys = ['list', 'info', 'tools', 'top'];
    const anyShown = keys.some(k => !this._panelHidden[k]);
    keys.forEach(k => this._panelHidden[k] = anyShown);   // tudo visível -> oculta tudo; senão mostra tudo
    this._applyPanels();
  },
  _applyPanels() {
    if (!this.panel) return;
    const map = { list: '#eList', info: '#eInfo', tools: '#eTools', top: '#eTop' };
    for (const k in map) { const el = this.panel.querySelector(map[k]); if (el) el.style.display = this._panelHidden[k] ? 'none' : ''; }
    if (this._togglesEl) this._togglesEl.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('off', !!this._panelHidden[b.dataset.panel]));
  },

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg; this.toastEl.style.opacity = '1';
    clearTimeout(this._tt); this._tt = setTimeout(() => { this.toastEl.style.opacity = '0'; }, 1700);
  },

  setTool(id) {
    this.tool = id;
    if (this.panel) this.panel.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === id));
    this._info();
  },
  setTab(tab) {
    this.tab = tab;
    if (this.tabsTop) this.tabsTop.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    this._buildList(); this._info();
  },
  setBrushSize(s) {
    this.brushSize = s;
    if (this.panel) this.panel.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', +b.dataset.size === s));
  },
  _cycleSize(d) { const i = clamp(this.SIZES.indexOf(this.brushSize) + d, 0, this.SIZES.length - 1); this.setBrushSize(this.SIZES[i]); },
  setLayer(n) { this.layer = n; this._info(); },

  // ---------------- desfazer (Ctrl+Z) ----------------
  _snapshot() {
    return {
      cols: this.world.cols, rows: this.world.rows,
      mat: this.world.mat.slice(), bg: this.world.bg.slice(), hp: this.world.hp.slice(), grass: this.world.grass.slice(),
      objs: [...this.objs.entries()].map(([k, v]) => [k, Object.assign({}, v)]),
    };
  },
  _pushUndo() { this.undoStack.push(this._snapshot()); if (this.undoStack.length > 40) this.undoStack.shift(); },
  _undo() {
    const s = this.undoStack.pop();
    if (!s) { this.toast('Nada para desfazer'); return; }
    if (this.world.cols !== s.cols || this.world.rows !== s.rows) this.world = new World(s.cols, s.rows);
    this.world.mat.set(s.mat); this.world.bg.set(s.bg); this.world.hp.set(s.hp); this.world.grass.set(s.grass);
    this.objs = new Map(s.objs.map(([k, v]) => [k, Object.assign({}, v)]));
    this._dirty = true; this.toast('Desfeito');
  },

  // ---------------- memória de cópia (clipboard, até 3) ----------------
  _paste() {
    if (!this.clips.length) { this.toast('Memória vazia (selecione e Ctrl+C)'); return; }
    this._useClip(0); this.toast('Colando — clique para posicionar');
  },
  _useClip(i) {
    const cl = this.clips[i]; if (!cl) return;
    this.clip = cl; this.clipName = 'Cópia ' + (cl.name || ''); this.clipSrc = null; this.curId = null;
    this.setTool('stamp'); this._info();
  },

  // ---------------- paleta ----------------
  _buildList() {
    const L = this.listEl; if (!L) return; L.innerHTML = '';
    const item = (on, onclick, fill) => { const b = document.createElement('button'); b.className = 'eitem' + (on ? ' on' : ''); fill(b); b.onclick = onclick; L.appendChild(b); return b; };
    const swatch = (id) => { const sw = document.createElement('canvas'); sw.width = sw.height = 28; const tile = TEX.tiles[id] && TEX.tiles[id][0]; if (tile) sw.getContext('2d').drawImage(tile, 0, 0, 28, 28); return sw; };

    if (this.tab === 'mats') {
      const note = document.createElement('div'); note.style.cssText = 'color:#9a8f7d;font-size:11px;margin:0 2px 6px;';
      note.innerHTML = 'Mesmos blocos para <b>Camada 1 (frente)</b> e <b>Camada 2 (fundo)</b> — escolha a camada no painel à direita.';
      L.appendChild(note);
      for (let id = 1; id < MAT.length; id++) {
        const m = MAT[id]; if (!m) continue;
        const eid = 'mat:' + id;
        item(this.curId === eid, () => this._selectPaint({ kind: 'mat', id, char: this.MAT2CHAR[id], name: m.name, eid }), b => {
          b.appendChild(swatch(id));
          const sp = document.createElement('span'); sp.innerHTML = `<div class="enm">${m.name}</div><div class="esub">HP ${m.indestructible ? '∞' : m.hp}</div>`; b.appendChild(sp);
        });
      }
    } else if (this.tab === 'decor') {
      (Gallery.DECOR || []).forEach(d => {
        const ch = this.DECOR2CHAR[d.type]; if (!ch) return;
        const eid = 'decor:' + d.type;
        item(this.curId === eid, () => this._selectPaint({ kind: 'decor', type: d.type, char: ch, name: d.name, eid }), b => {
          b.innerHTML = `<span class="eem">🏛</span><span><div class="enm">${d.name}</div><div class="esub">${d.type}</div></span>`;
        });
      });
    } else if (this.tab === 'enemies') {
      Object.keys(this.ENEMY2CHAR).forEach(type => {
        const ch = this.ENEMY2CHAR[type], info = (Gallery.ENEMY_INFO && Gallery.ENEMY_INFO[type]) || { icon: '👾', name: type };
        const eid = 'enemy:' + type;
        item(this.curId === eid, () => this._selectPaint({ kind: 'enemy', type, char: ch, name: info.name, eid }), b => {
          b.innerHTML = `<span class="eem">${info.icon}</span><span><div class="enm">${info.name}</div><div class="esub">inimigo</div></span>`;
        });
      });
    } else if (this.tab === 'items') {
      // recompensas / coletáveis
      for (const pk in this.PICK2CHAR) {
        const ch = this.PICK2CHAR[pk], info = this.PICK_INFO[pk], eid = 'pickup:' + pk;
        item(this.curId === eid, () => this._selectPaint({ kind: 'pickup', pk, char: ch, name: info[1], eid }), b => {
          b.innerHTML = `<span class="eem">${info[0]}</span><span><div class="enm">${info[1]}</div><div class="esub">coletável</div></span>`;
        });
      }
      // marcadores de fase
      [['spawn', 'P', '🚩', 'Início (P)'], ['exit', 'E', '🚪', 'Saída (E)']].forEach(([m, ch, em, nm]) => {
        const eid = 'marker:' + m;
        item(this.curId === eid, () => this._selectPaint({ kind: 'marker', m, char: ch, name: nm, eid }), b => {
          b.innerHTML = `<span class="eem">${em}</span><span><div class="enm">${nm}</div><div class="esub">marcador</div></span>`;
        });
      });
    } else if (this.tab === 'builds') {
      (window.BUILDINGS || []).forEach(def => {
        const eid = 'build:' + def.key;
        item(this.curId === eid, () => this._selectClip(def, 'build', eid), b => {
          b.innerHTML = `<span class="eem">${def.custom ? '⭐' : '🏰'}</span><span><div class="enm">${def.name}</div><div class="esub">${def.w}×${def.h}</div></span>`;
        });
      });
    } else if (this.tab === 'dungeons') {
      (window.DUNGEONS || []).forEach(def => {
        const eid = 'dun:' + def.key;
        item(this.curId === eid, () => this._selectClip(def, 'dungeon', eid), b => {
          b.innerHTML = `<span class="eem">🕳</span><span><div class="enm">${def.name}</div><div class="esub">${def.w}×${def.h}</div></span>`;
        });
      });
    } else if (this.tab === 'saved') {
      if (!Creations.list.length) {
        const d = document.createElement('div'); d.style.cssText = 'color:#9a8f7d;font-size:12px;padding:8px;'; d.textContent = 'Nenhuma criação salva ainda. Construa algo e clique em 💾 Salvar.'; L.appendChild(d);
      }
      Creations.list.forEach(cr => {
        const eid = 'saved:' + cr.key;
        const b = item(this.curId === eid, () => this._selectClip(cr, 'saved', eid), bx => {
          bx.innerHTML = `<span class="eem">⭐</span><span><div class="enm">${cr.name}</div><div class="esub">${cr.w}×${cr.h}</div></span>`;
        });
        const del = document.createElement('span'); del.className = 'edel'; del.textContent = '✕'; del.title = 'Excluir';
        del.onclick = (ev) => { ev.stopPropagation(); if (confirm('Excluir “' + cr.name + '”?')) { Creations.remove(cr.key); this._buildList(); } };
        b.appendChild(del);
      });
    }
  },

  _selectPaint(entry) {
    this.cur = entry; this.curId = entry.eid;
    if (['select', 'stamp', 'eyedrop', 'pan'].includes(this.tool)) this.setTool('brush');
    this._buildList(); this._info();
  },
  _selectClip(def, kind, eid) {
    let clip = this._clipCache[eid];
    if (!clip) {
      if (kind === 'saved') clip = { w: def.w, h: def.h, cells: def.cells, bg: def.bg };
      else if (kind === 'dungeon') clip = this._clipFromDungeon(def);
      else clip = this._clipFromBuilding(def);
      this._clipCache[eid] = clip;
    }
    this.clip = clip; this.clipName = def.name; this.clipSrc = eid; this.curId = eid;
    this.setTool('stamp'); this._buildList(); this._info();
  },
  _clipFromBuilding(def) {
    const gw = def.w + 2, gh = def.h + 4, baseR = gh - 2;
    const g = _mkGrid(gw, gh, '.'), bg = _mkGrid(gw, gh, '.');
    try { def.stamp(g, bg, 1, baseR, { enemy: false }); } catch (e) {}
    return _trimClip(g, bg) || { w: 1, h: 1, cells: ['.'], bg: ['.'] };
  },
  _clipFromDungeon(def) {
    const pad = 3, gw = def.w + pad * 2, surfR = 4, gh = surfR + def.h + 3;
    const g = _mkGrid(gw, gh, '.'), bg = _mkGrid(gw, gh, '.');
    for (let r = surfR; r < gh; r++) for (let c = 0; c < gw; c++) g[r][c] = def.surf || 'D';
    try { def.stamp(g, bg, pad, surfR, {}); } catch (e) {}
    return _trimClip(g, bg) || { w: 1, h: 1, cells: ['.'], bg: ['.'] };
  },

  // ---------------- painel de informações ----------------
  _info() {
    const I = this.infoEl; if (!I) return; I.innerHTML = '';
    const T = this.TOOLS.find(t => t.id === this.tool) || {};
    const DESC = {
      pan: 'Arraste para mover o cenário.',
      brush: 'Pinta o item escolhido (arraste para pintar vários).',
      line: 'Arraste para traçar uma linha do item.',
      rect: 'Arraste para preencher um retângulo.',
      bucket: 'Preenche uma área contígua do mesmo material.',
      erase: 'Apaga na camada ativa (use o tamanho ao lado).',
      select: 'Arraste para marcar uma área. Depois Copiar/Apagar.',
      stamp: 'Clique para carimbar a construção/área copiada.',
      eyedrop: 'Clique para capturar o que está sob o cursor.',
    };
    let head = '🔨 Ferramenta de Criação';
    if (this.tool === 'stamp' && this.clip) head = '📋 ' + (this.clipName || 'Trecho') + ' (' + this.clip.w + '×' + this.clip.h + ')';
    else if (this.cur) head = (this.cur.name || 'Item') + ' selecionado';
    I.innerHTML = `<h3>${head}</h3><div class="esub">${T.label || ''} — ${DESC[this.tool] || ''}</div>`;

    const mkb = (txt, fn, dis) => { const b = document.createElement('button'); b.className = 'ebtn'; b.textContent = txt; b.disabled = !!dis; if (dis) b.style.opacity = '.45'; b.onclick = fn; return b; };

    // camadas (Camada 1 = frente/sólido · Camada 2 = fundo)
    const layTitle = document.createElement('div'); layTitle.className = 'esub'; layTitle.style.marginTop = '6px'; layTitle.textContent = 'Camada de pintura:';
    I.appendChild(layTitle);
    const layRow = document.createElement('div'); layRow.className = 'erow';
    const l1 = mkb('▦ 1 · Frente', () => this.setLayer(1)); if (this.layer === 1) l1.classList.add('on');
    const l2 = mkb('▒ 2 · Fundo', () => this.setLayer(2)); if (this.layer === 2) l2.classList.add('on');
    layRow.appendChild(l1); layRow.appendChild(l2); I.appendChild(layRow);

    // seleção
    const selRow = document.createElement('div'); selRow.className = 'erow';
    selRow.appendChild(mkb('📋 Copiar área', () => this._copySelection(), !this.sel));
    selRow.appendChild(mkb('🗑 Apagar área', () => this._deleteSelection(), !this.sel));
    I.appendChild(selRow);
    if (this.sel) { const s = document.createElement('div'); s.className = 'esub'; s.textContent = `Área: ${this.sel.c1 - this.sel.c0 + 1}×${this.sel.r1 - this.sel.r0 + 1} tiles`; I.appendChild(s); }

    // memória de cópia (clipboard, até 3)
    const memTitle = document.createElement('div'); memTitle.className = 'esub'; memTitle.style.marginTop = '6px'; memTitle.textContent = 'Memória (Ctrl+C copia · Ctrl+V cola):';
    I.appendChild(memTitle);
    const memRow = document.createElement('div'); memRow.className = 'erow';
    if (!this.clips.length) { const d = document.createElement('div'); d.className = 'esub'; d.textContent = '(vazia)'; memRow.appendChild(d); }
    this.clips.forEach((cl, i) => { const b = mkb(`${i + 1}: ${cl.w}×${cl.h}`, () => this._useClip(i)); if (this.clip === cl) b.classList.add('on'); memRow.appendChild(b); });
    I.appendChild(memRow);

    // grade
    const gRow = document.createElement('div'); gRow.className = 'erow';
    gRow.appendChild(mkb('＋ Largura', () => { this._resizeWorld(this.world.cols + 12, this.world.rows); this.toast('Grade ampliada'); }));
    gRow.appendChild(mkb('＋ Altura', () => { this._resizeWorld(this.world.cols, this.world.rows + 8); this.toast('Grade ampliada'); }));
    I.appendChild(gRow);
    const gsz = document.createElement('div'); gsz.className = 'esub'; gsz.textContent = `Grade: ${this.world.cols}×${this.world.rows} tiles`; I.appendChild(gsz);

    const help = document.createElement('div'); help.className = 'ehelp';
    help.innerHTML = '<b>Mover</b> (0) ou botão direito/Espaço+arrasto · Roda: zoom<br><b>Ctrl+Z</b> desfaz · Teclas 0–8: ferramentas · <b>[ ]</b>: tamanho<br><b>Tab</b>: ocultar/mostrar painéis · 💾 salva a <b>área selecionada</b><br>Salas iguais: <b>Seleção</b> › <b>Ctrl+C</b> › <b>Carimbo/Ctrl+V</b>.';
    I.appendChild(help);
  },

  // ---------------- edição de células ----------------
  _key2(c, r) { return c + ',' + r; },
  _removeMarker(m) { for (const [k, v] of this.objs) if (v.kind === 'marker' && v.m === m) this.objs.delete(k); },
  // pinta uma célula (na camada ativa) com o item atual
  applyCell(c, r) {
    if (!this.world.inBounds(c, r)) return; const cur = this.cur; if (!cur) return; const key = this._key2(c, r);
    if (cur.kind === 'mat') {
      if (this.layer === 2) this.world.setBg(c, r, cur.id);       // Camada 2 = fundo
      else { this.world.set(c, r, cur.id); this.objs.delete(key); } // Camada 1 = frente/sólido
    }
    else if (cur.kind === 'decor') { this.objs.set(key, { kind: 'decor', type: cur.type, char: cur.char }); this.world.set(c, r, 0); }
    else if (cur.kind === 'enemy') { this.objs.set(key, { kind: 'enemy', type: cur.type, char: cur.char }); this.world.set(c, r, 0); }
    else if (cur.kind === 'pickup') { this.objs.set(key, { kind: 'pickup', pk: cur.pk, char: cur.char }); this.world.set(c, r, 0); }
    else if (cur.kind === 'marker') { if (cur.m === 'spawn') this._removeMarker('spawn'); this.objs.set(key, { kind: 'marker', m: cur.m, char: cur.char }); this.world.set(c, r, 0); }
    this._dirty = true;
  },
  eraseCell(c, r) {
    if (!this.world.inBounds(c, r)) return; const key = this._key2(c, r);
    if (this.layer === 2) { this.world.setBg(c, r, 0); }          // borracha na Camada 2 limpa o fundo
    else {                                                         // Camada 1: objeto › sólido › (fundo se já vazio)
      if (this.objs.has(key)) this.objs.delete(key);
      else if (this.world.at(c, r)) this.world.set(c, r, 0);
      else this.world.setBg(c, r, 0);
    }
    this._dirty = true;
  },
  // _brushCells: aplica `fn` num quadrado de brushSize×brushSize centrado no cursor
  _brushCells(c, r, fn) {
    const n = this.brushSize, off = (n - 1) >> 1;
    for (let dr = 0; dr < n; dr++) for (let dc = 0; dc < n; dc++) fn.call(this, c - off + dc, r - off + dr);
  },
  eyedrop(c, r) {
    if (!this.world.inBounds(c, r)) return; const o = this.objs.get(this._key2(c, r));
    let tab = null;
    if (o) {
      if (o.kind === 'decor') { const d = (Gallery.DECOR || []).find(x => x.type === o.type); this.cur = { kind: 'decor', type: o.type, char: o.char, name: d ? d.name : o.type, eid: 'decor:' + o.type }; tab = 'decor'; }
      else if (o.kind === 'enemy') { const inf = (Gallery.ENEMY_INFO && Gallery.ENEMY_INFO[o.type]) || {}; this.cur = { kind: 'enemy', type: o.type, char: o.char, name: inf.name || o.type, eid: 'enemy:' + o.type }; tab = 'enemies'; }
      else if (o.kind === 'pickup') { this.cur = { kind: 'pickup', pk: o.pk, char: o.char, name: this.PICK_INFO[o.pk][1], eid: 'pickup:' + o.pk }; tab = 'items'; }
      else if (o.kind === 'marker') { this.cur = { kind: 'marker', m: o.m, char: o.char, name: o.m === 'spawn' ? 'Início (P)' : 'Saída (E)', eid: 'marker:' + o.m }; tab = 'items'; }
    } else if (this.world.at(c, r)) { const id = this.world.at(c, r); this.cur = { kind: 'mat', id, char: this.MAT2CHAR[id], name: MAT[id].name, eid: 'mat:' + id }; this.layer = 1; tab = 'mats'; }
    else if (this.world.bgAt(c, r)) { const id = this.world.bgAt(c, r); this.cur = { kind: 'mat', id, char: this.MAT2CHAR[id], name: MAT[id].name, eid: 'mat:' + id }; this.layer = 2; tab = 'mats'; }
    else return;
    this.curId = this.cur.eid; this.tool = 'brush';
    if (tab) this.setTab(tab);          // reflete a seleção no sidebar (troca a aba e destaca)
    this.setTool('brush');              // garante o destaque da ferramenta
    this.toast('Selecionado: ' + this.cur.name);
  },
  floodFill(c, r) {
    if (!this.cur || this.cur.kind !== 'mat' || !this.world.inBounds(c, r)) return;
    const bg = this.layer === 2;
    const at = (cc, rr) => bg ? this.world.bgAt(cc, rr) : this.world.at(cc, rr);
    const set = (cc, rr, id) => bg ? this.world.setBg(cc, rr, id) : this.world.set(cc, rr, id);
    const target = at(c, r), repl = this.cur.id; if (target === repl) return;
    const stack = [[c, r]]; let n = 0;
    while (stack.length && n < 6000) {
      const [cc, rr] = stack.pop(); if (!this.world.inBounds(cc, rr)) continue;
      if (at(cc, rr) !== target) continue;
      set(cc, rr, repl); n++;
      stack.push([cc + 1, rr], [cc - 1, rr], [cc, rr + 1], [cc, rr - 1]);
    }
    this._dirty = true;
  },
  _lineApply(c0, r0, c1, r1) {
    let dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0), sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1, err = dx - dy;
    let c = c0, r = r0;
    for (let i = 0; i < 4000; i++) { this.applyCell(c, r); if (c === c1 && r === r1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; c += sx; } if (e2 < dx) { err += dx; r += sy; } }
  },
  _rectApply(c0, r0, c1, r1) {
    const a = Math.min(c0, c1), b = Math.max(c0, c1), d = Math.min(r0, r1), e = Math.max(r0, r1);
    for (let r = d; r <= e; r++) for (let c = a; c <= b; c++) this.applyCell(c, r);
  },

  // ---------------- copiar / colar (seleção e carimbo) ----------------
  _charAt(c, r) { const o = this.objs.get(this._key2(c, r)); if (o) return o.char; const id = this.world.at(c, r); return id ? (this.MAT2CHAR[id] || '.') : '.'; },
  _bgCharAt(c, r) { const id = this.world.bgAt(c, r); return id ? (this.MAT2CHAR[id] || '.') : '.'; },
  _serialize(c0, r0, w, h) {
    const cells = [], bg = [];
    for (let rr = 0; rr < h; rr++) {
      let line = '', bln = '';
      for (let cc = 0; cc < w; cc++) { line += this._charAt(c0 + cc, r0 + rr); bln += this._bgCharAt(c0 + cc, r0 + rr); }
      cells.push(line); bg.push(bln);
    }
    return { w, h, cells, bg };
  },
  _copySelection() {
    if (!this.sel) { this.toast('Selecione uma área primeiro (ferramenta Seleção)'); return; }
    const s = this.sel; const clip = this._serialize(s.c0, s.r0, s.c1 - s.c0 + 1, s.r1 - s.r0 + 1);
    clip.name = clip.w + '×' + clip.h;
    this.clips.unshift(clip); if (this.clips.length > 3) this.clips.length = 3;   // memória de até 3
    this.clip = clip; this.clipName = 'Cópia ' + clip.name; this.clipSrc = null; this.curId = null;
    this.sel = null;                                   // limpa o retângulo (seleção dinâmica)
    this.setTool('stamp'); this.toast('Copiado para a memória — clique para colar'); this._info();
  },
  _deleteSelection() {
    if (!this.sel) return; this._pushUndo(); const s = this.sel;
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) { const k = this._key2(c, r); this.objs.delete(k); this.world.set(c, r, 0); this.world.setBg(c, r, 0); }
    this._dirty = true; this.toast('Área apagada'); this._info();
  },
  _putChar(c, r, ch) {
    if (!this.world.inBounds(c, r) || !ch || ch === '.') return; const key = this._key2(c, r);
    if (CHAR2MAT[ch] != null) { this.world.set(c, r, CHAR2MAT[ch]); this.objs.delete(key); }
    else if (DECOR_CHARS[ch]) { this.objs.set(key, { kind: 'decor', type: DECOR_CHARS[ch], char: ch }); this.world.set(c, r, 0); }
    else if (CHAR2ENEMY[ch]) { this.objs.set(key, { kind: 'enemy', type: CHAR2ENEMY[ch], char: ch }); this.world.set(c, r, 0); }
    else if (this.PICKBYCHAR[ch]) { this.objs.set(key, { kind: 'pickup', pk: this.PICKBYCHAR[ch], char: ch }); this.world.set(c, r, 0); }
    else if (ch === 'P') { this._removeMarker('spawn'); this.objs.set(key, { kind: 'marker', m: 'spawn', char: 'P' }); this.world.set(c, r, 0); }
    else if (ch === 'E') { this.objs.set(key, { kind: 'marker', m: 'exit', char: 'E' }); this.world.set(c, r, 0); }
  },
  _putBg(c, r, ch) { if (this.world.inBounds(c, r) && CHAR2MAT[ch] != null) this.world.setBg(c, r, CHAR2MAT[ch]); },
  stampClip(c, r) {
    const cl = this.clip; if (!cl) return;
    for (let rr = 0; rr < cl.h; rr++) for (let cc = 0; cc < cl.w; cc++) {
      const ch = cl.cells[rr] ? cl.cells[rr][cc] : '.'; if (ch && ch !== '.') this._putChar(c + cc, r + rr, ch);
      const bch = cl.bg && cl.bg[rr] ? cl.bg[rr][cc] : '.'; if (bch && bch !== '.') this._putBg(c + cc, r + rr, bch);
    }
    this._dirty = true;
  },

  // ---------------- salvar / testar ----------------
  _saveCreation() {
    // exige selecionar a ÁREA que vai compor a construção (não salva o grid/chão todo)
    if (!this.sel) { this.toast('Selecione a área da construção antes de salvar (ferramenta Seleção)'); this.setTool('select'); this._info(); return; }
    const s = this.sel;
    const region = this._serialize(s.c0, s.r0, s.c1 - s.c0 + 1, s.r1 - s.r0 + 1);
    const trimmed = _trimClip(region.cells.map(x => x.split('')), region.bg.map(x => x.split('')));
    if (!trimmed) { this.toast('A área selecionada está vazia'); return; }
    const name = (prompt('Nome da criação:', 'Minha construção') || '').trim();
    if (!name) return;
    const cr = { key: 'user_' + Date.now().toString(36), name, w: trimmed.w, h: trimmed.h, cells: trimmed.cells, bg: trimmed.bg, custom: true, ground: '#' };
    Creations.add(cr);
    this._clipCache = {};   // novas entradas na enciclopédia
    this.toast('Salvo na enciclopédia: ' + name);
    if (this.tab === 'saved' || this.tab === 'builds') this._buildList();
  },
  _test() {
    let hasSpawn = false; for (const v of this.objs.values()) if (v.kind === 'marker' && v.m === 'spawn') hasSpawn = true;
    if (!hasSpawn) { this.toast('Coloque um marcador de Início (P) para testar'); return; }
    const data = this._serialize(0, 0, this.world.cols, this.world.rows);
    const def = {
      name: 'CRIAÇÃO', sub: 'Teste da sua criação', win: 'exit',
      biome: 'castle', sky: ['#1e2740', '#080a14'], bannerColor: '#6a1a1a',
      rows: data.cells, bg: data.bg,
    };
    this.cb && this.cb.onPlay && this.cb.onPlay(def);
  },

  // ---------------- loop / input ----------------
  tick(dt) {
    if (!this.active) return;
    this.time += dt;
    this._handleInput();
    if (this._dirty) { this.world.grass.fill(0); this.world.markGrass(); this._dirty = false; }
    this._draw(); this._status();
  },
  _onWheel(e) {
    const z = this.view.zoom, T = CONFIG.TILE;
    const bx = e.offsetX != null ? e.offsetX * (this.canvas.width / this.canvas.clientWidth) : Input.mouse.x;
    const by = e.offsetY != null ? e.offsetY * (this.canvas.height / this.canvas.clientHeight) : Input.mouse.y;
    const wx = bx / z + this.view.x, wy = by / z + this.view.y;
    const nz = clamp(z * (e.deltaY < 0 ? 1.12 : 0.89), 0.35, 4);
    this.view.zoom = nz;
    this.view.x = wx - bx / nz; this.view.y = wy - by / nz;
    this._clampView();
  },
  _clampView() {
    const vw = CONFIG.W / this.view.zoom, vh = CONFIG.H / this.view.zoom, T = CONFIG.TILE;
    this.view.x = clamp(this.view.x, -T * 3, Math.max(-T * 3, this.world.cols * T - vw + T * 3));
    this.view.y = clamp(this.view.y, -T * 3, Math.max(-T * 3, this.world.rows * T - vh + T * 3));
  },
  _handleInput() {
    const z = this.view.zoom, T = CONFIG.TILE;
    const mx = Input.mouse.x, my = Input.mouse.y;
    const wx = mx / z + this.view.x, wy = my / z + this.view.y;
    const c = Math.floor(wx / T), r = Math.floor(wy / T);
    this.hov = { c, r };

    const space = Input.down(' ');
    const panning = Input.mouse.rdown || (space && Input.mouse.down) || (this.tool === 'pan' && Input.mouse.down);
    if (panning) {
      if (!this._pan) this._pan = { mx, my, vx: this.view.x, vy: this.view.y };
      this.view.x = this._pan.vx - (mx - this._pan.mx) / z;
      this.view.y = this._pan.vy - (my - this._pan.my) / z;
      this._clampView();
    } else this._pan = null;

    // atalhos de ferramenta e de tamanho do pincel
    this.TOOLS.forEach(t => { if (Input.once(t.key)) this.setTool(t.id); });
    if (Input.once('[')) this._cycleSize(-1);
    if (Input.once(']')) this._cycleSize(1);
    if (Input.once('delete') || Input.once('backspace')) this._deleteSelection();

    const drawing = Input.mouse.down && !panning && !space;
    const pressed = drawing && !this._ld;
    const released = !drawing && this._ld;
    this._ld = drawing;

    // grava um ponto de desfazer no INÍCIO de cada ação que altera o cenário
    if (pressed && ['brush', 'erase', 'line', 'rect', 'bucket', 'stamp'].includes(this.tool)) this._pushUndo();

    switch (this.tool) {
      case 'brush':  if (drawing) this._brushCells(c, r, this.applyCell); break;
      case 'erase':  if (drawing) this._brushCells(c, r, this.eraseCell); break;
      case 'line':   if (pressed) this._ls = { c, r }; if (released && this._ls) { this._lineApply(this._ls.c, this._ls.r, c, r); this._ls = null; } break;
      case 'rect':   if (pressed) this._rs = { c, r }; if (released && this._rs) { this._rectApply(this._rs.c, this._rs.r, c, r); this._rs = null; } break;
      case 'bucket': if (pressed) this.floodFill(c, r); break;
      case 'select':
        if (pressed) this._ss = { c, r };
        if (this._ss && drawing) this.sel = { c0: Math.min(this._ss.c, c), r0: Math.min(this._ss.r, r), c1: Math.max(this._ss.c, c), r1: Math.max(this._ss.r, r) };
        if (released) { this._ss = null; this._info(); }
        break;
      case 'stamp':  if (pressed && this.clip) this.stampClip(c, r); break;
      case 'eyedrop': if (pressed) this.eyedrop(c, r); break;
    }
  },

  // ---------------- render ----------------
  _cam() {
    const E = this;
    return {
      get x() { return E.view.x; }, get y() { return E.view.y; },
      get vw() { return CONFIG.W / E.view.zoom; }, get vh() { return CONFIG.H / E.view.zoom; },
      get ox() { return -E.view.x; }, get oy() { return -E.view.y; },
      visible(x, y, w, h) { return x + w > E.view.x - 40 && x < E.view.x + CONFIG.W / E.view.zoom + 40 && y + h > E.view.y - 40 && y < E.view.y + CONFIG.H / E.view.zoom + 40; },
    };
  },
  _draw() {
    const ctx = this.ctx, T = CONFIG.TILE, z = this.view.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.H); g.addColorStop(0, '#1a2230'); g.addColorStop(1, '#0a0d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

    const cam = this._cam();
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(z, z);
    this.world.draw(ctx, cam);

    // objetos (decoração, inimigos, recompensas, marcadores)
    const ox = cam.ox, oy = cam.oy;
    for (const [key, o] of this.objs) {
      const p = key.split(','), c = +p[0], r = +p[1];
      if (!cam.visible(c * T - T, r * T - T, T * 3, T * 3)) continue;
      if (o.kind === 'decor') { TEX.decor(ctx, { type: o.type, x: c * T, y: r * T, color: '#7a2a2a' }, ox, oy, this.time, null); continue; }
      const x = c * T + ox, y = r * T + oy;
      if (o.kind === 'enemy') { const info = (Gallery.ENEMY_INFO && Gallery.ENEMY_INFO[o.type]) || { icon: '👾' }; this._badge(ctx, x, y, T, 'rgba(60,12,10,0.6)', '#e0473a', info.icon); }
      else if (o.kind === 'pickup') { const info = this.PICK_INFO[o.pk]; this._badge(ctx, x, y, T, 'rgba(14,40,14,0.55)', '#7be08a', info[0]); }
      else if (o.kind === 'marker') {
        if (o.m === 'spawn') this._badge(ctx, x, y, T, 'rgba(14,40,14,0.7)', '#7be08a', '🚩');
        else this._badge(ctx, x, y, T, 'rgba(14,30,46,0.7)', '#6fd0ff', '🚪');
      }
    }

    this._drawGrid(ctx, cam, T);

    // seleção (mostrada apenas com a ferramenta Seleção ativa)
    if (this.sel && this.tool === 'select') {
      const s = this.sel; ctx.save(); ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 2 / z; ctx.setLineDash([6 / z, 4 / z]);
      ctx.strokeRect(s.c0 * T + ox, s.r0 * T + oy, (s.c1 - s.c0 + 1) * T, (s.r1 - s.r0 + 1) * T);
      ctx.fillStyle = 'rgba(111,208,255,0.10)'; ctx.fillRect(s.c0 * T + ox, s.r0 * T + oy, (s.c1 - s.c0 + 1) * T, (s.r1 - s.r0 + 1) * T);
      ctx.restore();
    }
    // pré-visualização de linha/retângulo durante o arrasto
    if (this.tool === 'rect' && this._rs) this._strokeCells(ctx, ox, oy, T, z, this._rs.c, this._rs.r, this.hov.c, this.hov.r, '#ffe27a');
    if (this.tool === 'line' && this._ls) { ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2 / z; ctx.beginPath(); ctx.moveTo((this._ls.c + 0.5) * T + ox, (this._ls.r + 0.5) * T + oy); ctx.lineTo((this.hov.c + 0.5) * T + ox, (this.hov.r + 0.5) * T + oy); ctx.stroke(); ctx.restore(); }

    // cursor / fantasma do carimbo
    if (this.tool === 'stamp' && this.clip) this._drawClipGhost(ctx, ox, oy, T, z);
    else if (this.tool !== 'pan') {
      const n = (this.tool === 'brush' || this.tool === 'erase') ? this.brushSize : 1, off = (n - 1) >> 1;
      ctx.save(); ctx.strokeStyle = this.tool === 'erase' ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5 / z;
      ctx.strokeRect((this.hov.c - off) * T + ox, (this.hov.r - off) * T + oy, n * T, n * T); ctx.restore();
    }

    ctx.restore();
  },
  _badge(ctx, x, y, T, bg, ring, emoji) {
    ctx.save();
    ctx.fillStyle = bg; this._rr(ctx, x + 2, y + 2, T - 4, T - 4, 5); ctx.fill();
    ctx.strokeStyle = ring; ctx.lineWidth = 1.5; this._rr(ctx, x + 2, y + 2, T - 4, T - 4, 5); ctx.stroke();
    ctx.font = (T * 0.62) + 'px "Segoe UI Emoji","Trebuchet MS"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x + T / 2, y + T / 2 + 1);
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  },
  _rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
  _strokeCells(ctx, ox, oy, T, z, c0, r0, c1, r1, col) {
    const a = Math.min(c0, c1), b = Math.max(c0, c1), d = Math.min(r0, r1), e = Math.max(r0, r1);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2 / z; ctx.strokeRect(a * T + ox, d * T + oy, (b - a + 1) * T, (e - d + 1) * T);
    ctx.fillStyle = 'rgba(255,226,122,0.12)'; ctx.fillRect(a * T + ox, d * T + oy, (b - a + 1) * T, (e - d + 1) * T); ctx.restore();
  },
  _drawClipGhost(ctx, ox, oy, T, z) {
    const cl = this.clip, c = this.hov.c, r = this.hov.r;
    ctx.save(); ctx.globalAlpha = 0.5;
    if (cl.w * cl.h <= 1800) {
      for (let rr = 0; rr < cl.h; rr++) for (let cc = 0; cc < cl.w; cc++) {
        const ch = cl.cells[rr] ? cl.cells[rr][cc] : '.'; if (!ch || ch === '.') continue;
        const id = CHAR2MAT[ch]; const x = (c + cc) * T + ox, y = (r + rr) * T + oy;
        if (id != null) { const img = TEX.tiles[id] && TEX.tiles[id][0]; if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = MAT[id].c; ctx.fillRect(x, y, T, T); } }
        else { ctx.fillStyle = 'rgba(232,185,74,0.5)'; ctx.fillRect(x + T * 0.3, y + T * 0.3, T * 0.4, T * 0.4); }
      }
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#7be08a'; ctx.lineWidth = 2 / z;
    ctx.strokeRect(c * T + ox, r * T + oy, cl.w * T, cl.h * T); ctx.restore();
  },
  _drawGrid(ctx, cam, T) {
    const z = this.view.zoom;
    const c0 = Math.max(0, Math.floor(cam.x / T)), c1 = Math.min(this.world.cols, Math.floor((cam.x + cam.vw) / T) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / T)), r1 = Math.min(this.world.rows, Math.floor((cam.y + cam.vh) / T) + 1);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (let c = c0; c <= c1; c++) { const x = c * T + cam.ox; ctx.moveTo(x, r0 * T + cam.oy); ctx.lineTo(x, r1 * T + cam.oy); }
    for (let r = r0; r <= r1; r++) { const y = r * T + cam.oy; ctx.moveTo(c0 * T + cam.ox, y); ctx.lineTo(c1 * T + cam.ox, y); }
    ctx.stroke();
    // borda da grade
    ctx.strokeStyle = 'rgba(232,185,74,0.5)'; ctx.lineWidth = 2 / z;
    ctx.strokeRect(cam.ox, cam.oy, this.world.cols * T, this.world.rows * T);
    ctx.restore();
  },
  _status() {
    if (!this.statusEl) return;
    const t = this.TOOLS.find(x => x.id === this.tool);
    const what = this.tool === 'stamp' ? (this.clipName || 'trecho') : (this.cur ? this.cur.name : '—');
    const lay = this.layer === 2 ? 'Fundo' : 'Frente';
    this.statusEl.textContent = `${t ? t.label : ''} · ${what} · Camada ${this.layer} (${lay}) · Tam ${this.brushSize} · ${this.hov.c},${this.hov.r} · zoom ${Math.round(this.view.zoom * 100)}%`;
  },
};

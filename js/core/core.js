/* ============================================================
   core.js — constants, math helpers, input, camera, RNG
   PÓLVORA & AÇO  (run-and-gun medieval com pólvora)
   ============================================================ */

const CONFIG = {
  W: 1280, H: 720,           // canvas resolution (internal) — higher fidelity
  TILE: 32,
  ZOOM: 1.7,                 // world render zoom (bigger, detailed sprites)
  GRAVITY: 2500,             // queda-base (px/s²) — sobe afeta inimigos e queda dos heróis
  FALL_MULT: 1.7,            // <<< TESTE: queda mais "pesada". 1 = simétrico; >1 = cai mais rápido que sobe (só herói)
  TERMINAL_VY: 1500,
  MAX_DT: 1 / 30,            // clamp big frame gaps
  // ---- escalada de PAREDE (igual para todos os heróis; ajuste o "feeling" aqui) ----
  WALL_JUMP_V:  760,         // impulso vertical do wall-jump
  WALL_JUMP_VX: 270,         // empurrão horizontal ao saltar da parede
  WALL_CLIMB_V: 150,         // velocidade ao subir a parede (segurando W)
  WALL_SLIDE_V: 300,         // velocidade ao descer rápido (segurando S)
  WALL_CLING_V: 70,          // deslize lento ao só se agarrar
};

// ---- math ----------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b));
const pick  = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const sign  = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);
const TAU = Math.PI * 2;

// axis-aligned box overlap
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Input ---------------------------------------------------
// Maps physical keys/mouse to abstract actions. A "Controller"
// reads from this; multiple controllers (co-op) can be layered later.
const Input = {
  keys: {},
  mouse: { x: CONFIG.W / 2, y: CONFIG.H / 2, down: false, rdown: false, moved: false },
  pressed: {},   // edge: true only on the frame a key went down
  _scale: 1, _ox: 0, _oy: 0,

  init(canvas) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });

    const setMouse = e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      this.mouse.moved = true;
    };
    canvas.addEventListener('mousemove', setMouse);
    canvas.addEventListener('mousedown', e => {
      setMouse(e);
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rdown = true;
      e.preventDefault();
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  down(k)     { return !!this.keys[k]; },
  // consume edge-press
  once(k)     { if (this.pressed[k]) { this.pressed[k] = false; return true; } return false; },
  // clear per-frame edges at end of frame
  endFrame()  { this.pressed = {}; this.mouse.moved = false; },
};

// ---- Keybindings --------------------------------------------
// Mapa de AÇÃO -> lista de teclas físicas. Totalmente reconfigurável
// (persistido em localStorage). O Controller lê apenas daqui, então
// trocar as teclas no menu de pausa muda os comandos instantaneamente.
const Keys = {
  KEY: 'oddyssey_keybinds_v1',
  capturing: false,                       // true enquanto o menu captura uma nova tecla
  // ordem/labels exibidos no menu de personalização
  ACTIONS: [
    { id: 'left',     label: 'Mover à esquerda' },
    { id: 'right',    label: 'Mover à direita' },
    { id: 'up',       label: 'Cima / Subir' },
    { id: 'down',     label: 'Baixo / Descer' },
    { id: 'jump',     label: 'Pular' },
    { id: 'fire',     label: 'Atirar' },
    { id: 'special',  label: 'Especial' },
    { id: 'melee',    label: 'Corpo a corpo' },
    { id: 'swapPrev', label: 'Herói anterior' },
    { id: 'swapNext', label: 'Próximo herói' },
    { id: 'grimoire', label: 'Grimório (Edward)' },
    { id: 'spellPrev', label: 'Feitiço anterior' },
    { id: 'spellNext', label: 'Próximo feitiço' },
    { id: 'pause',    label: 'Pausar' },
  ],
  DEFAULT: {
    left:  ['arrowleft'], right: ['arrowright'],
    up:    ['arrowup'],   down:  ['arrowdown'],
    jump:  ['arrowup', ' '],
    fire:  ['z'], special: ['x'], melee: ['c'],
    swapPrev: ['s'], swapNext: ['d'],
    grimoire: ['g'], spellPrev: ['['], spellNext: [']'],
    pause: ['p', 'escape'],
  },
  map: {},

  load() {
    this.map = {};
    let saved = null;
    try { const s = localStorage.getItem(this.KEY); if (s) saved = JSON.parse(s); } catch (e) {}
    for (const a of this.ACTIONS) {
      const id = a.id;
      this.map[id] = (saved && Array.isArray(saved[id]) && saved[id].length) ? saved[id].slice() : this.DEFAULT[id].slice();
    }
  },
  save()  { try { localStorage.setItem(this.KEY, JSON.stringify(this.map)); } catch (e) {} },
  reset() { for (const a of this.ACTIONS) this.map[a.id] = this.DEFAULT[a.id].slice(); this.save(); },

  down(action) { const ks = this.map[action]; return ks ? ks.some(k => Input.down(k)) : false; },
  once(action) { const ks = this.map[action]; if (!ks) return false; let hit = false; for (const k of ks) if (Input.once(k)) hit = true; return hit; },

  // adicionar/remover/atribuir uma tecla a uma ação (usado pelo menu)
  add(action, key)    { key = (key || '').toLowerCase(); if (!this.map[action]) this.map[action] = []; if (!this.map[action].includes(key)) this.map[action].push(key); this.save(); },
  removeKey(action, key) { if (this.map[action]) this.map[action] = this.map[action].filter(k => k !== key); this.save(); },

  // nome amigável para exibir uma tecla
  pretty(k) {
    const M = { ' ': 'Espaço', 'arrowleft': '◄', 'arrowright': '►', 'arrowup': '▲', 'arrowdown': '▼',
      'escape': 'Esc', 'enter': 'Enter', 'shift': 'Shift', 'control': 'Ctrl', 'alt': 'Alt', 'tab': 'Tab', 'backspace': '⌫' };
    if (M[k]) return M[k];
    return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
  },
};
Keys.load();

// A controller exposes the abstract game inputs for one player.
// Lê do mapa de teclas (Keys); trocar/duplicar para gamepad ou 2º jogador.
class Controller {
  get left()    { return Keys.down('left'); }
  get right()   { return Keys.down('right'); }
  get up()      { return Keys.down('up'); }
  get down()    { return Keys.down('down'); }
  get jumpHeld(){ return Keys.down('jump'); }
  jumpPressed() { return Keys.once('jump'); }
  get fire()    { return Keys.down('fire'); }
  get special() { return Keys.down('special'); }
  meleePressed(){ return Keys.once('melee'); }   // corpo-a-corpo com espada
  swapNext()    { return Keys.once('swapNext'); }
  swapPrev()    { return Keys.once('swapPrev'); }
}

// ---- Camera --------------------------------------------------
class Camera {
  constructor() { this.x = 0; this.y = 0; this.shake = 0; this._sx = 0; this._sy = 0; this.world = null; }
  get z() { return CONFIG.ZOOM || 1; }
  get vw() { return CONFIG.W / this.z; }   // visible world width
  get vh() { return CONFIG.H / this.z; }
  follow(target, dt) {
    const tx = target.x + target.w / 2 - this.vw / 2;
    const ty = target.y + target.h / 2 - this.vh / 2 - 30;
    this.x = lerp(this.x, tx, 1 - Math.pow(0.0008, dt));
    this.y = lerp(this.y, ty, 1 - Math.pow(0.0008, dt));
    if (this.world) {
      this.x = clamp(this.x, 0, Math.max(0, this.world.pixelW - this.vw));
      this.y = clamp(this.y, 0, Math.max(0, this.world.pixelH - this.vh));
    }
    // shake decays
    this.shake = Math.max(0, this.shake - dt * 32);
    const s = this.shake;
    this._sx = rand(-s, s); this._sy = rand(-s, s);
  }
  addShake(v) { this.shake = Math.min(26, this.shake + v); }
  get ox() { return -this.x + this._sx; }
  get oy() { return -this.y + this._sy; }
  // world coords of the mouse (account for zoom)
  mouseWorld() { return { x: Input.mouse.x / this.z + this.x - this._sx, y: Input.mouse.y / this.z + this.y - this._sy }; }
  visible(x, y, w, h) {
    return x + w > this.x - 40 && x < this.x + this.vw + 40 &&
           y + h > this.y - 40 && y < this.y + this.vh + 40;
  }
}

/* ============================================================
   worldmap.js — seletor de fases em MAPA-MÚNDI (visão top-down)
   ------------------------------------------------------------
   Uma ILHA pixel-art (inspirada no concept "Termath") cercada por
   MAR intransponível. O jogador anda com um herói por terra; ao
   chegar num NÓ de fase (vilarejo/castelo/cripta/templo…) e apertar
   Z/Enter, entra na fase. Estética pixel-art com mais resolução que
   as fases (buffer 480×270, ampliado nearest) — "tela pintada".

   Padrão igual ao Gallery/Editor: open(canvas, cb), tick(dt), close().
   ============================================================ */

const WorldMap = {
  MW: 480, MH: 270,
  canvas: null, ctx: null, cb: null,
  _island: null, _work: null, mask: null,
  nodes: [], player: null, time: 0, active: -1, _onClick: null,

  // ---------- ruído / rng ----------
  _h2(x, y) { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; },
  _vn2(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = this._h2(xi, yi), b = this._h2(xi + 1, yi), c = this._h2(xi, yi + 1), d = this._h2(xi + 1, yi + 1); return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; },
  _fbm2(x, y, oct) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { s += a * this._vn2(x * f, y * f); f *= 2; a *= 0.5; } return s; },

  // ---------- ciclo de vida ----------
  open(canvas, cb) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cb = cb; this.time = 0;
    if (!this._island) this._build();                       // assa a ilha UMA vez (cache)
    const n0 = this.nodes[0]; this.player = { x: n0.x, y: n0.y + 7, vx: 0, vy: 0, face: 1, walk: 0, moving: false };
    this.active = 0;
    this._onClick = (e) => this._click(e); canvas.addEventListener('click', this._onClick);
  },
  close() { if (this._onClick) this.canvas.removeEventListener('click', this._onClick); this._onClick = null; },

  // =========================================================
  _build() {
    const MW = this.MW, MH = this.MH;
    this.cx = MW * 0.5; this.cy = MH * 0.53; this.rx = MW * 0.43; this.ry = MH * 0.40;
    const cv = this._island = document.createElement('canvas'); cv.width = MW; cv.height = MH;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const mask = this.mask = new Uint8Array(MW * MH);
    // 1) máscara da ilha (forma orgânica: elipse + fbm)
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const nx = (x - this.cx) / this.rx, ny = (y - this.cy) / this.ry, d = Math.sqrt(nx * nx + ny * ny);
      const n = this._fbm2(x * 0.016 + 11, y * 0.016 + 23, 4);
      mask[y * MW + x] = ((1.04 - d) + (n - 0.5) * 0.72) > 0 ? 1 : 0;
    }
    // 2) pintura base (mar / praia / grama) via ImageData
    const id = g.createImageData(MW, MH), px = id.data;
    const put = (x, y, r, gg, b) => { const i = (y * MW + x) * 4; px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = 255; };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (mask[i]) {
        if (this._near(x, y, 0, 2)) { const s = this._vn2(x * 0.35, y * 0.35) * 18; put(x, y, 0xd8 - s, 0xc6 - s, 0x82 - s); }   // praia (areia)
        else { const gn = this._fbm2(x * 0.05 + 5, y * 0.05 + 9, 3); put(x, y, (0x42 + gn * 34) | 0, (0x70 + gn * 30) | 0, (0x2a + gn * 20) | 0); }  // grama
      } else {
        if (this._near(x, y, 1, 2)) put(x, y, 0xb4, 0xdc, 0xe6);    // espuma na costa
        else { const w = (Math.sin(x * 0.07 + y * 0.13) + Math.sin(x * 0.11 - y * 0.05)) * 0.25 + 0.5, dd = Math.min(1, (Math.hypot((x - this.cx) / this.rx, (y - this.cy) / this.ry) - 1) * 1.1); put(x, y, (0x1f + w * 14 - dd * 8) | 0, (0x44 + w * 18 - dd * 12) | 0, (0x64 + w * 16 - dd * 10) | 0); }
      }
    }
    g.putImageData(id, 0, 0);
    // 3) relevo: montanhas (oeste/centro) e florestas (espalhadas, densas a leste/sul)
    this._scatter(g, mask, 'mountain'); this._scatter(g, mask, 'forest');
    // 4) nós das fases + trilhas pontilhadas
    this._placeNodes(); this._bakePaths(g);
    this._work = document.createElement('canvas'); this._work.width = MW; this._work.height = MH;
  },
  // existe pixel `target` num raio Chebyshev `rad`?
  _near(x, y, target, rad) {
    const MW = this.MW, MH = this.MH;
    for (let j = -rad; j <= rad; j++) for (let k = -rad; k <= rad; k++) {
      const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) { if (target === 0) return true; continue; }
      if (this.mask[yy * MW + xx] === target) return true;
    }
    return false;
  },

  _scatter(g, mask, kind) {
    const MW = this.MW, MH = this.MH, step = 7;
    for (let y = 10; y < MH - 6; y += step) for (let x = 8; x < MW - 8; x += step) {
      const jx = (this._h2(x * 3 + 1, y) * step) | 0, jy = (this._h2(x, y * 3 + 7) * step) | 0;
      const px = x + jx, py = y + jy, i = py * MW + px;
      if (px < 4 || py < 6 || px >= MW - 4 || py >= MH - 4 || !mask[i] || this._near(px, py, 0, 2)) continue;
      if (kind === 'mountain') {
        const m = this._fbm2(px * 0.018 + 40, py * 0.018 + 12, 3);        // cordilheiras em zonas
        if (m > 0.62 && this._h2(px, py) > 0.45) this._mountain(g, px, py, 5 + (this._h2(px + 5, py) * 5 | 0));
      } else {
        const f = this._fbm2(px * 0.03 + 80, py * 0.03 + 33, 3) + (px / MW) * 0.25;  // mais mata a leste
        if (f > 0.52 && this._h2(px + 9, py + 3) > 0.25) this._tree(g, px, py);
      }
    }
  },
  _mountain(g, x, y, h) {
    const w = Math.round(h * 1.3);
    for (let yy = 0; yy < h; yy++) { const ww = Math.round((yy / h) * w); g.fillStyle = '#6a6258'; g.fillRect(x - ww, y - h + yy, 2 * ww + 1, 1); g.fillStyle = '#4c443c'; g.fillRect(x + 1, y - h + yy, ww, 1); }
    g.fillStyle = '#e8eef2'; g.fillRect(x - 1, y - h, 2, 2); g.fillRect(x, y - h + 2, 1, 1);   // neve no topo
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - w, y, 2 * w + 1, 1);
  },
  _tree(g, x, y) {
    g.fillStyle = '#3a2616'; g.fillRect(x, y - 1, 1, 2);
    g.fillStyle = '#244a1c'; this._ell(g, x, y - 3, 3, 3);
    g.fillStyle = '#356a28'; this._ell(g, x, y - 4, 2, 2);
  },

  _placeNodes() {
    const MW = this.MW, MH = this.MH;
    const F = [[0.17, 0.30], [0.31, 0.49], [0.47, 0.33], [0.63, 0.29], [0.79, 0.42], [0.66, 0.61], [0.44, 0.66]];
    const N = Math.min(F.length, LEVELS.length - 1);
    this.nodes = [];
    for (let i = 0; i < N; i++) {
      const L = LEVELS[i]; let x = Math.round(F[i][0] * MW), y = Math.round(F[i][1] * MH);
      [x, y] = this._snap(x, y);
      const b = L.biome, kind = b === 'battlefield' ? 'fortress' : b === 'jungle' ? 'temple' : b;
      this.nodes.push({ x, y, levelIndex: i, name: L.name, sub: L.sub || '', kind, num: i + 1 });
    }
  },
  _interior(x, y) { const MW = this.MW, MH = this.MH; if (x < 4 || y < 6 || x >= MW - 4 || y >= MH - 4) return false; const m = this.mask; return m[y * MW + x] && m[y * MW + x - 3] && m[y * MW + x + 3] && m[(y - 3) * MW + x] && m[(y + 3) * MW + x]; },
  _snap(x, y) { if (this._interior(x, y)) return [x, y]; for (let r = 1; r < 70; r++) for (let a = 0; a < r * 8; a++) { const ang = a / (r * 8) * TAU, sx = Math.round(x + Math.cos(ang) * r), sy = Math.round(y + Math.sin(ang) * r); if (this._interior(sx, sy)) return [sx, sy]; } return [x, y]; },
  _bakePaths(g) {
    for (let k = 0; k < this.nodes.length - 1; k++) {
      const a = this.nodes[k], b = this.nodes[k + 1], len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.round(len / 6));
      for (let s = 0; s <= steps; s++) { const tx = Math.round(lerp(a.x, b.x, s / steps)), ty = Math.round(lerp(a.y, b.y, s / steps)); g.fillStyle = 'rgba(232,210,122,0.85)'; g.fillRect(tx, ty, 2, 2); g.fillStyle = 'rgba(120,96,40,0.5)'; g.fillRect(tx, ty + 2, 2, 1); }
    }
  },

  // =========================================================
  tick(dt) { this.time += dt; this._update(dt); this._draw(); },

  _update(dt) {
    const p = this.player, MW = this.MW, MH = this.MH, sp = 62;
    let mx = 0, my = 0;
    if (Keys.down('left')) mx -= 1; if (Keys.down('right')) mx += 1;
    if (Keys.down('up')) my -= 1; if (Keys.down('down')) my += 1;
    if (mx || my) { const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; if (mx) p.face = mx < 0 ? -1 : 1; p.walk += dt * 11; p.moving = true; } else p.moving = false;
    const nx = p.x + mx * sp * dt; if (this._land(nx, p.y)) p.x = nx;     // anda em terra (mar bloqueia)
    const ny = p.y + my * sp * dt; if (this._land(p.x, ny)) p.y = ny;
    p.x = clamp(p.x, 4, MW - 4); p.y = clamp(p.y, 8, MH - 4);
    // nó ativo = mais próximo dentro do raio
    this.active = -1; let best = 13 * 13;
    for (let k = 0; k < this.nodes.length; k++) { const d = dist2(p.x, p.y, this.nodes[k].x, this.nodes[k].y); if (d < best) { best = d; this.active = k; } }
    if (this.active >= 0 && (Keys.once('fire') || Input.once('enter') || Input.once(' '))) { Sound.coin && Sound.coin(); this.cb.onPlay(this.nodes[this.active].levelIndex); return; }
    if (Input.once('escape')) this.cb.onBack();
  },
  _land(x, y) { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= this.MW || yi >= this.MH) return false; return this.mask[yi * this.MW + xi] === 1; },

  // =========================================================
  _draw() {
    const ctx = this.ctx, W = CONFIG.W, H = CONFIG.H, MW = this.MW, MH = this.MH, b = this._work, bg = b.getContext('2d');
    bg.imageSmoothingEnabled = false; bg.globalAlpha = 1; bg.drawImage(this._island, 0, 0);
    this._shimmer(bg);
    for (let k = 0; k < this.nodes.length; k++) this._node(bg, this.nodes[k], k === this.active);
    this._avatar(bg);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
    ctx.drawImage(b, 0, 0, MW, MH, 0, 0, W, H);
    this._ui(ctx, W, H);
  },
  _shimmer(bg) {
    const MW = this.MW, MH = this.MH, t = this.time; bg.fillStyle = 'rgba(190,225,238,0.5)';
    for (let i = 0; i < 70; i++) { const x = ((i * 97 + t * 9) % MW) | 0, y = ((i * 53 + Math.sin(t * 0.7 + i) * 5 + MH) % MH) | 0; if (this.mask[y * MW + x] === 0) bg.fillRect(x, y, 1, 1); }
  },

  _ell(g, cx, cy, rx, ry) { for (let yy = -ry; yy <= ry; yy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry)))); if (w > 0) g.fillRect(cx - w, cy + yy, 2 * w + 1, 1); } },
  _ring(g, cx, cy, r, col) { g.fillStyle = col; for (let a = 0; a < 56; a++) { const an = a / 56 * TAU; g.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1); } },

  _node(bg, n, active) {
    const x = Math.round(n.x), y = Math.round(n.y);
    bg.fillStyle = 'rgba(0,0,0,0.18)'; this._ell(bg, x, y + 3, 9, 3);
    if (active) this._ring(bg, x, y - 2, 11 + Math.sin(this.time * 4) * 1.4, '#ffe27a');
    this._icon(bg, n.kind, x, y);
  },
  _icon(bg, kind, x, y) {
    if (kind === 'castle') {
      bg.fillStyle = '#6b6f78'; bg.fillRect(x - 5, y - 9, 10, 11); bg.fillStyle = '#565a62'; bg.fillRect(x, y - 9, 5, 11);
      for (let dx = -5; dx < 5; dx += 3) { bg.fillStyle = '#6b6f78'; bg.fillRect(x + dx, y - 11, 2, 2); }
      bg.fillStyle = '#15120e'; bg.fillRect(x - 1, y - 3, 3, 5); bg.fillStyle = '#3a2c1a'; bg.fillRect(x + 4, y - 16, 1, 6); bg.fillStyle = '#7a2a2a'; bg.fillRect(x + 5, y - 16, 4, 3);
    } else if (kind === 'village') {
      const house = (hx, w, h, roof) => { bg.fillStyle = '#b89a6a'; bg.fillRect(hx, y + 2 - h, w, h); const rh = Math.round(h * 0.7); for (let yy = 0; yy < rh; yy++) { const ww = Math.round((yy / rh) * (w / 2 + 1)); bg.fillStyle = roof; bg.fillRect(hx + (w >> 1) - ww, y + 2 - h - rh + yy, 2 * ww + 1, 1); } bg.fillStyle = '#15120e'; bg.fillRect(hx + (w >> 1) - 1, y - 1, 2, 3); };
      house(x - 7, 6, 6, '#9a4232'); house(x + 1, 6, 8, '#8a3a2c');
    } else if (kind === 'dungeon') {
      bg.fillStyle = '#5a564e'; bg.fillRect(x - 6, y - 8, 12, 10); bg.fillStyle = '#46423b'; bg.fillRect(x + 1, y - 8, 5, 10);
      bg.fillStyle = '#46423b'; bg.fillRect(x - 7, y - 10, 3, 3); bg.fillRect(x + 5, y - 11, 3, 4);                 // ruína irregular
      bg.fillStyle = '#100d0a'; for (let s = 0; s < 4; s++) { const ww = 4 - s; bg.fillRect(x - ww, y - 4 + s, 2 * ww + 1, 1); } bg.fillRect(x - 2, y - 1, 5, 3);
    } else if (kind === 'fortress') {
      bg.fillStyle = '#3c3038'; bg.fillRect(x - 5, y - 12, 10, 14); bg.fillStyle = '#2c2228'; bg.fillRect(x, y - 12, 5, 14);
      for (let dx = -5; dx < 5; dx += 3) bg.fillRect(x + dx, y - 14, 2, 2);
      bg.fillStyle = '#7a1a1a'; bg.fillRect(x - 2, y - 9, 4, 5); bg.fillStyle = '#15120e'; bg.fillRect(x - 1, y - 2, 3, 4);
      bg.fillStyle = '#ff7a2a'; bg.fillRect(x - 4, y - 16, 1, 2); bg.fillRect(x + 3, y - 15, 1, 2);                 // brasas
    } else {  // temple (jungle)
      for (let s = 0; s < 4; s++) { const w = 11 - s * 2; bg.fillStyle = s % 2 ? '#5a6a48' : '#647654'; bg.fillRect(x - (w >> 1), y - 1 - s * 3, w, 3); }
      bg.fillStyle = '#100d0a'; bg.fillRect(x - 1, y - 1, 3, 3);
      bg.fillStyle = '#244a1c'; this._ell(bg, x + 8, y - 2, 3, 3); bg.fillStyle = '#3a2616'; bg.fillRect(x + 7, y, 1, 2);
    }
  },
  _avatar(bg) {
    const p = this.player, x = Math.round(p.x), y = Math.round(p.y), f = p.face, bob = p.moving ? Math.round(Math.sin(p.walk) * 1) : 0, st = p.moving ? Math.round(Math.sin(p.walk) * 1.4) : 0;
    bg.fillStyle = 'rgba(0,0,0,0.28)'; this._ell(bg, x, y, 4, 2);
    bg.fillStyle = '#3a2c1a'; bg.fillRect(x - 2 + st, y - 3, 2, 3); bg.fillRect(x + 1 - st, y - 3, 2, 3);     // pernas
    bg.fillStyle = '#9a1f1f'; bg.fillRect(x - 3 * f - (f > 0 ? 0 : 1), y - 8 - bob, 2, 5);                    // capa
    bg.fillStyle = '#586674'; bg.fillRect(x - 3, y - 9 - bob, 6, 6); bg.fillStyle = '#7c8b97'; bg.fillRect(x - 3, y - 9 - bob, 6, 1);   // armadura
    bg.fillStyle = '#b07a52'; bg.fillRect(x - 2, y - 13 - bob, 4, 4); bg.fillStyle = '#3a2615'; bg.fillRect(x - 2, y - 13 - bob, 4, 1); // cabeça/cabelo
    bg.fillStyle = '#caa33a'; bg.fillRect(x + (f > 0 ? 2 : -3), y - 9 - bob, 1, 5);                            // espada na mão
  },

  // ---------- UI em alta resolução (texto nítido) ----------
  _ui(ctx, W, H) {
    const sc = W / this.MW, ta = ctx.textAlign;
    // título "pergaminho"
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,14,8,0.66)'; this._round(ctx, W / 2 - 190, 16, 380, 46, 10); ctx.fill();
    ctx.strokeStyle = '#caa33a'; ctx.lineWidth = 2; this._round(ctx, W / 2 - 190, 16, 380, 46, 10); ctx.stroke();
    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 30px "Trebuchet MS"'; ctx.fillText('TERMATH', W / 2, 44);
    ctx.fillStyle = '#9a8f7d'; ctx.font = '13px "Trebuchet MS"'; ctx.fillText('ESCOLHA O CAMPO DE BATALHA', W / 2, 60);
    // crachás numerados nos nós
    ctx.font = 'bold 14px "Trebuchet MS"';
    for (let k = 0; k < this.nodes.length; k++) {
      const n = this.nodes[k], sx = n.x * sc, sy = (n.y - 20) * sc, on = k === this.active;
      ctx.fillStyle = on ? '#e8b94a' : 'rgba(26,18,10,0.85)'; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = on ? '#241a0e' : '#e8e0cf'; ctx.fillText(String(n.num), sx, sy + 5);
    }
    // painel da fase ativa
    if (this.active >= 0) {
      const n = this.nodes[this.active];
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(12,8,5,0.8)'; this._round(ctx, W / 2 - 320, H - 96, 640, 70, 10); ctx.fill();
      ctx.strokeStyle = '#5a4326'; ctx.lineWidth = 2; this._round(ctx, W / 2 - 320, H - 96, 640, 70, 10); ctx.stroke();
      ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 22px "Trebuchet MS"'; ctx.fillText(`${n.num}.  ${n.name}`, W / 2, H - 66);
      ctx.fillStyle = '#cfc4ad'; ctx.font = '13px "Trebuchet MS"';
      const sub = n.sub.length > 78 ? n.sub.slice(0, 76) + '…' : n.sub; ctx.fillText(sub, W / 2, H - 46);
      ctx.fillStyle = '#7be08a'; ctx.font = 'bold 14px "Trebuchet MS"'; ctx.fillText('▶  Z / Enter para entrar', W / 2, H - 30);
    }
    // dica de controles + compasso
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(232,224,207,0.7)'; ctx.font = '13px "Trebuchet MS"';
    ctx.fillText('◄ ► ▲ ▼  andar    ·    Z / Enter  entrar    ·    Esc  voltar', 18, H - 18);
    this._compass(ctx, 52, 84);
    ctx.textAlign = ta;
  },
  _round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
  _compass(ctx, cx, cy) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(12,8,5,0.55)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#caa33a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; ctx.fillStyle = i === 0 ? '#e06b5e' : '#e8b94a'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a + 0.35) * 7, Math.sin(a + 0.35) * 7); ctx.lineTo(Math.cos(a - 0.35) * 7, Math.sin(a - 0.35) * 7); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#e8e0cf'; ctx.font = 'bold 11px "Trebuchet MS"'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -16); ctx.restore();
  },

  _click(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (this.canvas.width / r.width), sy = (e.clientY - r.top) * (this.canvas.height / r.height);
    const mx = sx * this.MW / CONFIG.W, my = sy * this.MH / CONFIG.H;
    for (let k = 0; k < this.nodes.length; k++) if (dist2(mx, my, this.nodes[k].x, this.nodes[k].y - 6) < 16 * 16) { Sound.coin && Sound.coin(); this.cb.onPlay(this.nodes[k].levelIndex); return; }
  },
};

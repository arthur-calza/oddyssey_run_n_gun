/* ============================================================
   background.js — layered pixel-art parallax backdrops
   ------------------------------------------------------------
   A cena inteira (céu + biomas) é desenhada num BUFFER de baixa
   resolução (BW×BH) usando preenchimentos CHAPADOS e silhuetas em
   DEGRAUS; depois é ampliada com vizinho-mais-próximo, ficando com
   o MESMO grão chunky de pixel dos blocos e personagens.

   Cada bioma é uma PILHA de camadas (do fundo p/ a frente) com
   PERSPECTIVA ATMOSFÉRICA: camadas distantes desbotam na cor do céu
   e rolam mais devagar (parallax). Isso dá PROFUNDIDADE real a um
   mundo de jogabilidade 2D — o objetivo de um pixel-art de primeira.

   Rolagem infinita e sem emendas: as silhuetas usam um value-noise
   determinístico amostrado em (x + cam.x*parallax), então deslizam
   suavemente sem repetição perceptível. Sem alocação por frame.
   ============================================================ */

const BG = {
  BW: 320, BH: 180,            // resolução interna de pixel-art (16:9)
  VYK: 0.4,                    // escala do parallax VERTICAL (pulos são rápidos/grandes;
                               // 0.4 dá uma deriva sutil e "presa" sem o fundo saltar junto)
  _buf: null, _H: null,

  // ---- value-noise 1D determinístico (base das silhuetas) ----
  _hash(n) { n = (n << 13) ^ n; return 1 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824; },
  _vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return this._hash(i) * (1 - u) + this._hash(i + 1) * u; },
  _fbm(x, oct) { let a = 0, amp = 0.5, fr = 1; for (let k = 0; k < oct; k++) { a += amp * this._vnoise(x * fr); fr *= 2; amp *= 0.5; } return a; },

  // ---- cor ----
  _hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; },
  _rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; },
  _mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  // mistura uma cor-base na bruma (céu) p/ simular distância: haze 0 = nítida, 1 = some no céu
  _far(sky, base, haze) { return this._rgb(this._mix(this._hex(typeof base === 'string' ? base : this._rgb(base)), sky, haze)); },
  // hash inteiro uniforme 0..1 (mulberry-style com Math.imul p/ wrap 32-bit correto;
  // o _hash flutuante perde precisão e não serve p/ proporções).
  _h01(n) { n = n | 0; n = Math.imul(n ^ (n >>> 15), n | 1); n ^= n + Math.imul(n ^ (n >>> 7), n | 61); return ((n ^ (n >>> 14)) >>> 0) / 4294967296; },
  // decisão DETERMINÍSTICA de "aceso/apagado" por índice — luzes fixas (não piscam),
  // numa proporção `ratio` (ex.: 0.2 = ~2 em 10 acesas). Estável conforme a câmera rola.
  _lit(i, seed, ratio) { return this._h01((i * 73 + seed * 131) | 0) < ratio; },

  // ==================================================================
  draw(ctx, cam, L, t) {
    const W = CONFIG.W, H = CONFIG.H, BW = this.BW, BH = this.BH;
    let buf = this._buf;
    if (!buf) { buf = this._buf = document.createElement('canvas'); buf.width = BW; buf.height = BH; }
    if (!this._H) this._H = new Int16Array(BW);
    const g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    g.clearRect(0, 0, BW, BH);
    // câmera vertical RELATIVA à superfície da fase: parado no chão o fundo fica no
    // lugar projetado; ao PULAR (cam.y muda) o fundo desliza com parallax nos 2 eixos.
    const refY = this._refY(L);
    this._cy = refY == null ? 0 : ((cam.y || 0) - refY) * this.VYK;
    this._skyGrad(g, L);
    const biome = L.biome || 'castle';
    (this[biome] || this.castle).call(this, g, cam, L, t, BW, BH);
    // amplia nítido p/ a tela cheia
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW, BH, 0, 0, W, H);
    // vinheta leve (suave sobre pixel-art tudo bem) — só um toque de profundidade
    const dark = L.bgVignette != null ? L.bgVignette : 0.24;
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.4, W / 2, H * 0.55, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + dark + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  // y de câmera de REFERÊNCIA da fase (cacheado): quando o jogador está na superfície,
  // o parallax vertical é ~0 e o fundo fica no lugar projetado. Usa a média da superfície
  // da fase (estável → o fundo não "balança" ao subir/descer morros, só ao pular/cair).
  _refY(L) {
    if (!L || !L.surface || !L.surface.length) return null;     // gallery (sem surface) → sem desloc. vertical
    if (L._bgRefY != null) return L._bgRefY;
    const s = L.surface, T = CONFIG.TILE; let sum = 0; for (let i = 0; i < s.length; i++) sum += s[i];
    return (L._bgRefY = (sum / s.length) * T - (CONFIG.H / (CONFIG.ZOOM || 1)) / 2);
  },

  // ---- céu: gradiente desenhado no buffer baixo → pixel-sky limpo ----
  _skyGrad(g, L) {
    const sky = L.sky || ['#1e2740', '#080a14'];
    const gr = g.createLinearGradient(0, 0, 0, this.BH);
    gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, this.BW, this.BH);
  },

  // ================= PRIMITIVAS DE DESENHO ==========================
  // disco "pixel" (círculo chapado em degraus)
  _disc(g, cx, cy, rad, col) {
    cx |= 0; cy |= 0; rad |= 0; if (rad <= 0) return; g.fillStyle = col;
    for (let yy = -rad; yy <= rad; yy++) { const w = Math.round(Math.sqrt(Math.max(0, rad * rad - yy * yy))); if (w > 0) g.fillRect(cx - w, cy + yy, 2 * w, 1); }
  },
  _sun(g, x, y, r, col, a) {
    g.globalAlpha = a * 0.35; this._disc(g, x, y, r * 3.4, '#fff6d2');
    g.globalAlpha = a * 0.6; this._disc(g, x, y, r * 1.9, '#fff0bc');
    g.globalAlpha = 1; this._disc(g, x, y, r, col);
  },
  _moon(g, x, y, r, col) {
    g.globalAlpha = 0.16; this._disc(g, x, y, r * 2.7, '#fff3c8');
    g.globalAlpha = 1; this._disc(g, x, y, r, col);
    this._disc(g, x - r * 0.35, y - r * 0.25, Math.max(2, r * 0.5), 'rgba(0,0,0,0.12)');
  },
  _hazeBand(g, y, h, col, a) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, y | 0, this.BW, h | 0); g.globalAlpha = 1; },
  // chama em pixel (gota com glow + núcleo claro) — ESTÁTICA, p/ tochas/ruínas em chamas
  _flame(g, cx, by, s, glow, body, core) {
    cx |= 0; by |= 0;
    g.globalAlpha = 0.45; this._disc(g, cx, by - s, Math.round(s * 1.8), glow); g.globalAlpha = 1;
    const h = Math.round(s * 2.3);
    for (let yy = 0; yy < h; yy++) { const f = yy / h, w = Math.max(1, Math.round(s * 0.9 * (1 - f) * (f < 0.2 ? f / 0.2 : 1))); g.fillStyle = body; g.fillRect(cx - w, by - yy, 2 * w, 1); }
    const ch = Math.round(h * 0.55);
    for (let yy = 0; yy < ch; yy++) { const f = yy / ch, w = Math.max(1, Math.round(s * 0.45 * (1 - f))); g.fillStyle = core; g.fillRect(cx - w, by - yy - 1, 2 * w, 1); }
  },

  // silhueta contínua (montanha / dossel) via fbm — preenche até a base
  _ridge(g, cam, o) {
    const BW = this.BW, BH = this.BH, H = this._H;
    const par = o.par, base = o.baseY - this._cy * par, amp = o.amp, freq = o.freq, oct = o.oct || 3, seed = o.seed || 0;
    const shift = cam.x * par;
    for (let x = 0; x < BW; x++) {
      const wx = (x + shift) * freq + seed * 13.7;
      let h = base - this._fbm(wx, oct) * amp - amp * 0.15;
      H[x] = h < 0 ? 0 : (h > BH ? BH : h) | 0;
    }
    g.fillStyle = o.color;
    g.beginPath(); g.moveTo(0, BH);
    for (let x = 0; x < BW; x++) { g.lineTo(x, H[x]); g.lineTo(x + 1, H[x]); }   // topos em degrau
    g.lineTo(BW, BH); g.closePath(); g.fill();
    if (o.rim) { g.fillStyle = o.rim; const rh = o.rimH || 1; for (let x = 0; x < BW; x++) g.fillRect(x, H[x], 1, rh); }
  },

  // nuvens "pixel" (aglomerados chapados que derivam + parallax)
  _clouds(g, cam, t, y, count, col, par) {
    const BW = this.BW, range = BW + 90, vy = this._cy * par; g.fillStyle = col;
    for (let i = 0; i < count; i++) {
      const cx = ((i * (range / count) + t * 6 - cam.x * par) % range + range) % range - 45;
      const cy = y - vy + ((i * 37) % 16) - 6, s = 1 + (i % 3) * 0.4;
      this._cloud(g, Math.round(cx), Math.round(cy), s);
    }
  },
  _cloud(g, x, y, s) {
    const w = Math.round(16 * s), h = Math.round(5 * s);
    g.fillRect(x, y, w, h);
    g.fillRect(x + Math.round(4 * s), y - Math.round(3 * s), Math.round(9 * s), h);
    g.fillRect(x - Math.round(3 * s), y + 1, Math.round(7 * s), Math.max(2, h - 1));
  },

  // estrelas que piscam (1px) — plano bem distante (parallax mínimo)
  _stars(g, cam, t, n, seed, maxY) {
    let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const vy = this._cy * 0.008; g.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const x = (((rnd() * this.BW) - cam.x * 0.015) % this.BW + this.BW) % this.BW;
      const y = rnd() * maxY - vy, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i * 1.3));
      g.globalAlpha = tw; g.fillRect(x | 0, y | 0, 1, 1);
    }
    g.globalAlpha = 1;
  },

  // ---- linhas de árvores / palmeiras / construções (elementos discretos) ----
  // varre os índices visíveis com deslocamento de parallax; variação por hash(índice)
  _eachCol(cam, par, spacing, fn) {
    const shift = cam.x * par, lim = this.BW + spacing;
    for (let i = Math.floor(shift / spacing) - 1; i * spacing - shift <= lim; i++) fn(i, Math.round(i * spacing - shift));
  },
  _roundTree(g, cx, baseY, rad, canopy, trunk, hi) {
    g.fillStyle = trunk; g.fillRect(cx - 1, baseY - rad, 2, rad + 3);
    const cy = baseY - rad; g.fillStyle = canopy;
    for (let yy = -rad; yy <= rad; yy++) { const w = Math.round(Math.sqrt(Math.max(0, rad * rad - yy * yy))); if (w > 0) g.fillRect(cx - w, cy + yy, 2 * w, 1); }
    if (hi) { g.fillStyle = hi; for (let yy = -rad; yy <= -rad + 2; yy++) { const w = Math.round(Math.sqrt(Math.max(0, rad * rad - yy * yy))); if (w > 0) g.fillRect(cx - w, cy + yy, 2 * w, 1); } }
  },
  _conifer(g, cx, baseY, h, w, col, rim, trunk) {
    g.fillStyle = trunk || '#2e2418'; g.fillRect(cx - 1, baseY - 2, 2, 4);
    const top = baseY - h; g.fillStyle = col;
    for (let yy = 0; yy < h; yy++) { const ww = Math.round((yy / h) * w); g.fillRect(cx - ww, top + yy, 2 * ww + 1, 1); }
    if (rim) { g.fillStyle = rim; for (let yy = 1; yy < h; yy += 3) { const ww = Math.round((yy / h) * w); g.fillRect(cx - ww, top + yy, 2, 1); } }
  },
  _treeRow(g, cam, o) {
    const baseY = o.baseY - this._cy * o.par;
    this._eachCol(cam, o.par, o.spacing, (i, x) => {
      const bx = Math.round(x + this._hash(i * 7 + o.seed) * o.spacing * 0.3);
      const rnd = this._hash(i * 3.1 + o.seed * 5) * 0.5 + 0.5;
      const rad = Math.round(o.rad * (0.78 + 0.42 * rnd));
      const by = Math.round(baseY + this._hash(i * 2 + o.seed) * 4);
      if (o.kind === 'conifer') this._conifer(g, bx, by, rad * 2.3, rad, o.color, o.rim, o.trunk);
      else this._roundTree(g, bx, by, rad, o.color, o.trunk || '#2a2014', o.hi);
    });
  },
  _frond(g, x, y, a, len, col) {
    g.fillStyle = col;
    for (let s = 0; s < len; s++) { const px = Math.round(x + Math.cos(a) * s), py = Math.round(y + Math.sin(a) * s + s * s * 0.03); g.fillRect(px, py, 2, 2); }
  },
  _palmRow(g, cam, t, o) {
    const baseY = o.baseY - this._cy * o.par;
    this._eachCol(cam, o.par, o.spacing, (i, x) => {
      const bx = Math.round(x + this._hash(i * 5 + o.seed) * o.spacing * 0.4);
      const hh = Math.round(26 + (this._hash(i * 3 + o.seed) * 0.5 + 0.5) * 8);
      g.fillStyle = o.trunk;
      for (let yy = 0; yy < hh; yy++) { const lean = Math.round(Math.sin(yy * 0.11) * 2); g.fillRect(bx + lean, baseY - yy, 2, 1); }
      const tx = bx + Math.round(Math.sin((hh - 1) * 0.11) * 2) + 1, ty = baseY - hh;
      const sway = Math.sin(t * 0.8 + i) * 0.08;
      for (let f = 0; f < 6; f++) this._frond(g, tx, ty, -Math.PI / 2 + (f - 2.5) * 0.5 + sway, 13, o.color);
      g.fillStyle = o.hi || o.color; g.fillRect(tx - 1, ty - 1, 3, 2);
    });
  },
  _zigg(g, cx, baseY, w, steps, stepH, col, rim) {
    for (let s = 0; s < steps; s++) {
      const ww = Math.round(w * (1 - s / (steps + 0.5))), x = Math.round(cx - ww / 2), y = baseY - (s + 1) * stepH;
      g.fillStyle = col; g.fillRect(x, y, ww, stepH + 1);
      g.fillStyle = rim; g.fillRect(x, y, ww, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(Math.round(cx - 2), baseY - stepH, 4, stepH);   // portal
  },
  _ziggRow(g, cam, o) {
    const baseY = o.baseY - this._cy * o.par;
    this._eachCol(cam, o.par, o.spacing, (i, x) => {
      const w = Math.round(o.w * (0.85 + 0.3 * (this._hash(i * 7 + o.seed) * 0.5 + 0.5)));
      this._zigg(g, Math.round(x + o.spacing / 2), baseY + Math.round(this._hash(i * 2 + o.seed) * 5), w, o.steps, o.stepH, o.color, o.rim);
    });
  },
  _tower(g, bx, baseY, w, h, col, rim, ruin) {
    g.fillStyle = col; g.fillRect(bx, baseY - h, w, h);
    g.fillStyle = rim; g.fillRect(bx, baseY - h, w, 1); g.fillRect(bx, baseY - h, 1, h);
    if (ruin) {                                   // topo destruído: recortes escuros irregulares
      g.fillStyle = 'rgba(0,0,0,0.55)';
      for (let k = 0; k < w; k += 3) { const d = Math.round((this._hash((bx + k) * 1.7) * 0.5 + 0.5) * 6); if (d) g.fillRect(bx + k, baseY - h, 3, d); }
    } else {                                      // ameias
      g.fillStyle = col; for (let k = 0; k < w; k += 4) g.fillRect(bx + k, baseY - h - 3, 2, 3);
    }
  },
  // ruínas em chamas do campo de guerra — fogo ESTÁTICO só em parte das torres (sem piscar).
  _towerRow(g, cam, o) {
    const baseY = o.baseY - this._cy * o.par;
    this._eachCol(cam, o.par, o.spacing, (i, x) => {
      if (this._h01((i * 19 + o.seed * 53) | 0) < 0.16) return;          // vãos: nem todo intervalo tem ruína
      const w = 18 + Math.round((this._hash(i * 2 + o.seed) * 0.5 + 0.5) * 12);
      const h = Math.round(36 + (this._hash(i * 9 + o.seed) * 0.5 + 0.5) * 34);
      this._tower(g, x, baseY, w, h, o.color, o.rim, o.ruin);
      if (o.ruin && this._lit(i, o.seed + 4, o.fireRatio || 0.4)) {     // torre em chamas (fixa)
        this._flame(g, x + w / 2, baseY - h + 3, 6, 'rgba(255,120,40,0.5)', '#ff8a30', '#ffe07a');
      }
    });
  },
  // muralha + torres do castelo: ameias, fiadas de pedra, MUSGO escorrido, manchas
  // úmidas e tipos de torre variados (ameia / teto cônico / ruína); janelas acesas
  // ESTÁTICAS em proporção baixa — cada trecho fica visualmente diferente.
  _castleLayer(g, cam, o) {
    const BW = this.BW, par = o.par, baseY = o.baseY - this._cy * par, wh = o.wallH, shift = cam.x * par;
    const col = o.col, rim = o.rim, dark = o.dark, moss = o.moss, lit = o.lit, seed = o.seed || 0;
    g.fillStyle = col; g.fillRect(0, baseY - wh, BW, wh);                                   // cortina
    g.fillStyle = dark; for (let y = baseY - wh + 6; y < baseY; y += 7) g.fillRect(0, y, BW, 1);   // fiadas
    for (let x = 0; x < BW; x++) {                                                          // detalhes por coluna do mundo
      const wxi = Math.round(x + shift), hv = this._hash(wxi * 1.7 + seed);
      if (((wxi % 13) + 13) % 13 === 0) { g.fillStyle = dark; g.fillRect(x, baseY - wh, 1, wh); }            // junta vertical
      if (hv > 0.84) { g.fillStyle = moss; const mh = 2 + ((this._hash(wxi * 2.1) + 1) * 2 | 0); g.fillRect(x, baseY - mh, 1, mh); }   // musgo na base
      if (this._hash(wxi * 1.3 + seed * 3) > 0.9) { g.fillStyle = moss; g.fillRect(x, baseY - wh - 1, 1, 2); }                          // musgo no topo
      if (((wxi % 6) + 6) % 6 === 0 && this._lit(wxi, seed + 1, 0.08)) { g.fillStyle = lit; g.fillRect(x, baseY - wh + 7, 1, 4); g.globalAlpha = 0.4; this._disc(g, x, baseY - wh + 9, 4, lit); g.globalAlpha = 1; }   // fresta acesa (espalhada)
    }
    g.fillStyle = rim; g.fillRect(0, baseY - wh, BW, 1);
    const mp = 12, moff = ((shift % mp) + mp) % mp;                                         // ameias da muralha
    for (let x = -moff; x < BW; x += mp) { g.fillStyle = col; g.fillRect(Math.round(x), baseY - wh - 3, 6, 3); g.fillStyle = rim; g.fillRect(Math.round(x), baseY - wh - 3, 6, 1); }
    this._eachCol(cam, par, o.spacing, (i, x) => {                                          // torres variadas
      const tw = 12 + Math.round((this._hash(i * 7 + seed) * 0.5 + 0.5) * 9);
      const th = wh + 8 + Math.round((this._hash(i * 9 + seed) * 0.5 + 0.5) * 28);
      const type = Math.floor((this._hash(i * 3.3 + seed) * 0.5 + 0.5) * 2.999);
      this._castleTower(g, x, baseY, tw, th, type, col, rim, dark, moss, lit, this._lit(i, seed + 7, 0.3));
    });
  },
  _castleTower(g, bx, baseY, w, h, type, col, rim, dark, moss, lit, isLit) {
    g.fillStyle = col; g.fillRect(bx, baseY - h, w, h);
    g.fillStyle = rim; g.fillRect(bx, baseY - h, w, 1); g.fillRect(bx, baseY - h, 1, h);
    g.fillStyle = dark; g.fillRect(bx + w - 1, baseY - h, 1, h);                            // sombra à direita
    for (let y = baseY - h + 6; y < baseY; y += 7) { g.fillStyle = dark; g.fillRect(bx + 1, y, w - 2, 1); }   // fiadas
    if (type === 0) {                                                                       // ameias
      for (let k = 0; k < w; k += 4) { g.fillStyle = col; g.fillRect(bx + k, baseY - h - 3, 2, 3); g.fillStyle = rim; g.fillRect(bx + k, baseY - h - 3, 2, 1); }
    } else if (type === 1) {                                                                 // telhado cônico (ponta p/ CIMA)
      const cx = bx + Math.round(w / 2), rh = Math.round(w * 0.95);
      for (let yy = 0; yy < rh; yy++) {                                                       // base larga embaixo, ponta no topo
        const ww = Math.round((yy / rh) * (w / 2 + 2)); g.fillStyle = dark; g.fillRect(cx - ww, baseY - h - rh + yy, 2 * ww + 1, 1);
        g.fillStyle = rim; g.fillRect(cx - ww, baseY - h - rh + yy, 1, 1);                    // aresta iluminada à esquerda
      }
      g.fillStyle = rim; g.fillRect(cx, baseY - h - rh - 2, 1, 3);                            // pináculo
    } else {                                                                                // ruína
      g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < w; k += 2) { const d = Math.round((this._hash((bx + k) * 1.9) * 0.5 + 0.5) * 6); if (d) g.fillRect(bx + k, baseY - h, 2, d); }
    }
    const wy = baseY - Math.round(h * 0.5);                                                 // janela (acesa estática)
    if (isLit) { g.fillStyle = lit; g.fillRect(bx + Math.round(w / 2) - 1, wy, 2, 3); g.globalAlpha = 0.4; this._disc(g, bx + w / 2, wy + 1, 5, lit); g.globalAlpha = 1; }
    else { g.fillStyle = dark; g.fillRect(bx + Math.round(w / 2) - 1, wy, 2, 3); }
    for (let k = 0; k < w; k++) { const wxi = bx + k; if (this._hash(wxi * 1.7) > 0.8) { g.fillStyle = moss; const mh = 2 + ((this._hash(wxi * 2.3) + 1) * 1.5 | 0); g.fillRect(bx + k, baseY - mh, 1, mh); } }   // musgo na base
    for (let m = 0; m < 3; m++) { if (this._hash(bx * 3 + m * 7 + 1) > 0.45) { g.fillStyle = 'rgba(0,0,0,0.2)'; const mx = bx + 2 + ((this._hash(bx + m * 11) * 0.5 + 0.5) * (w - 4) | 0), my = baseY - h + 6 + ((this._hash(bx + m * 5) * 0.5 + 0.5) * (h - 10) | 0); g.fillRect(mx, my, 2, 3); } }   // manchas úmidas
  },
  // vila/cidade medieval de RPG: casas, sobrados e um campanário, todos com
  // TELHADO DE DUAS ÁGUAS (ponta p/ cima) — sem triângulos invertidos. Aglomerado
  // e variado (tipo/altura/largura por índice do mundo) p/ não parecer cerca repetida.
  _townRow(g, cam, t, o) {
    const baseY = o.baseY - this._cy * o.par;
    this._eachCol(cam, o.par, o.spacing, (i, x) => {
      const r1 = this._hash(i * 7 + o.seed) * 0.5 + 0.5, r2 = this._hash(i * 3 + o.seed * 5) * 0.5 + 0.5;
      const ty = this._h01((i * 29 + o.seed * 17) | 0), church = ty < 0.13, tall = !church && ty > 0.72, bx = x;
      const w = church ? 12 + Math.round(r1 * 3) : (tall ? 13 : 17) + Math.round(r1 * 5);
      const h = church ? 32 + Math.round(r2 * 16) : (tall ? 22 : 13) + Math.round(r2 * (tall ? 12 : 7));
      const cx = bx + (w >> 1);
      g.fillStyle = o.wall; g.fillRect(bx, baseY - h, w, h);                                  // parede
      g.fillStyle = o.wallSh; g.fillRect(bx + w - 1, baseY - h, 1, h);
      g.fillStyle = o.wallHi; g.fillRect(bx, baseY - h, 1, h);
      const rh = church ? Math.round(w * 1.0) : Math.max(6, Math.round(w * 0.5)), ov = church ? 1 : 2;
      for (let yy = 0; yy < rh; yy++) {                                                        // telhado: base larga, ponta no topo
        const ww = Math.round((yy / rh) * (w / 2 + ov));
        g.fillStyle = o.roof; g.fillRect(cx - ww, baseY - h - rh + yy, 2 * ww + 1, 1);
        g.fillStyle = o.roofHi; g.fillRect(cx - ww, baseY - h - rh + yy, 1, 1);                // água esquerda iluminada
      }
      g.fillStyle = o.roofSh; g.fillRect(Math.round(cx - (w / 2 + ov)), baseY - h, w + ov * 2, 1);   // beiral
      if (church) { g.fillStyle = o.roofHi; g.fillRect(cx, baseY - h - rh - 3, 1, 3); g.fillRect(cx - 1, baseY - h - rh - 2, 3, 1); }   // pináculo/cruz
      const lit1 = this._lit(i, o.seed + 5, church ? 0.4 : 0.2);                               // janelas (algumas acesas, fixo)
      g.fillStyle = lit1 ? o.lit : o.win; g.fillRect(cx - 2, baseY - Math.round(h * 0.5), church ? 3 : 4, church ? 6 : 5);
      if (tall) { g.fillStyle = this._lit(i, o.seed + 9, 0.2) ? o.lit : o.win; g.fillRect(cx - 2, baseY - Math.round(h * 0.8), 4, 4); }
      if (!church) { g.fillStyle = o.door; g.fillRect(cx - 2, baseY - 6, 4, 6); }              // porta
      if (!church && this._h01((i * 41 + o.seed * 7) | 0) < 0.45) {                            // chaminé + fumaça (algumas)
        const chx = bx + Math.round(w * 0.72); g.fillStyle = o.wallSh; g.fillRect(chx, baseY - h - rh - 3, 2, 4);
        if (lit1) { g.fillStyle = 'rgba(60,56,62,0.3)'; for (let s = 0; s < 4; s++) { const sy = baseY - h - rh - 5 - s * 5 - ((t * 8) % 5); g.fillRect(chx + Math.round(Math.sin(t + s) * 2), Math.round(sy), 2, 2); } }
      }
    });
  },

  // ---- partículas / atmosfera (tudo em pixels chapados no buffer) ----
  _leaves(g, t) {
    const BW = this.BW, BH = this.BH, cols = ['#6a8a3a', '#8a6a2a', '#4a6a2a'];
    for (let i = 0; i < 22; i++) { const x = (i * 73 + t * 22 + Math.sin(t + i) * 30) % (BW + 20); const y = ((i * 51 + t * 34) % (BH + 20)) - 10; g.fillStyle = cols[i % 3]; g.fillRect(x | 0, y | 0, 2, 2); }
  },
  _fireflies(g, t) {
    const BW = this.BW, BH = this.BH;
    for (let i = 0; i < 16; i++) { const x = ((i * 97 + Math.sin(t * 0.7 + i) * 40) % BW + BW) % BW; const y = BH * 0.4 + Math.sin(t + i * 2) * 40 + (i % 5) * 16; const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i)); g.globalAlpha = a; g.fillStyle = '#bfff78'; g.fillRect(x | 0, y | 0, 1, 1); }
    g.globalAlpha = 1;
  },
  _embers(g, t) {
    const BW = this.BW, BH = this.BH;
    for (let i = 0; i < 30; i++) { const x = ((i * 89 + Math.sin(t + i) * 20) % BW + BW) % BW; const y = BH - ((i * 61 + t * 60) % (BH + 30)); const a = 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i)); g.globalAlpha = a; g.fillStyle = i % 2 ? '#ff9a3c' : '#ffd86b'; g.fillRect(x | 0, y | 0, 1, 1 + (i % 2)); }
    g.globalAlpha = 1;
  },
  _dust(g, t) {
    const BW = this.BW, BH = this.BH; g.globalAlpha = 0.12; g.fillStyle = '#c8c8b4';
    for (let i = 0; i < 36; i++) { const x = (i * 137 + t * 9) % BW; const y = (i * 91 + Math.sin(t + i) * 16 + t * 5) % BH; g.fillRect(x | 0, y | 0, 1, 1); }
    g.globalAlpha = 1;
  },
  _fog(g, t, y, col) {
    g.globalAlpha = 0.12; g.fillStyle = col || '#3c466e';
    for (let i = 0; i < 4; i++) { const fx = ((i * 92 + t * 9) % (this.BW + 90)) - 45; this._cloud(g, fx | 0, (y + i * 5) | 0, 1.7); }
    g.globalAlpha = 1;
  },
  _smokeColumns(g, cam, t, col, par) {
    g.fillStyle = col; const BW = this.BW, range = BW + 70, vy = this._cy * par;
    for (let i = 0; i < 5; i++) {
      const sx = ((i * 64 - cam.x * par) % range + range) % range - 35;
      for (let s = 0; s < 9; s++) { const sy = this.BH * 0.4 - vy - s * 7 - ((t * 8) % 7), w = 3 + s; g.fillRect((sx + Math.sin(t * 0.5 + s) * 4 - w / 2) | 0, sy | 0, w, 4); }
    }
  },

  // ===================== BIOMAS =====================================
  // Cada bioma é um "quadro" fixo no mundo: TODA camada rola com cam.x E cam.y
  // (mesmo parallax nos 2 eixos → plano fixo). Objetos que ficam de pé compartilham
  // o parallax do seu chão, então nunca "descolam" ao pular. Só nuvens/folhas/fumaça
  // se animam. `ls` = semente por fase → cada fase tem um horizonte único.

  // Castelo (noite): estrelas, lua, montanhas, muralhas com torres variadas, névoa.
  castle(g, cam, L, t, BW, BH) {
    const sky = this._hex(L.sky[0]), ls = ((L.seed || 0) * 97) | 0, vy = this._cy;
    this._stars(g, cam, t, 70, 11, BH * 0.58);
    this._moon(g, BW * 0.74, BH * 0.2 - vy * 0.01, 11, '#f4ecd0');
    this._ridge(g, cam, { par: 0.018, baseY: BH * 0.44, amp: 19, freq: 0.008, oct: 4, seed: 1 + ls, color: this._far(sky, [40, 46, 72], 0.5) });
    this._ridge(g, cam, { par: 0.03, baseY: BH * 0.5, amp: 13, freq: 0.015, oct: 4, seed: 6 + ls, color: this._far(sky, [34, 40, 64], 0.36) });
    this._castleLayer(g, cam, { par: 0.05, baseY: BH * 0.66, wallH: 16, spacing: 70, seed: 2 + ls,
      col: this._far(sky, [30, 34, 52], 0.3), rim: this._far(sky, [52, 58, 84], 0.26), dark: this._far(sky, [14, 16, 28], 0.18), moss: this._far(sky, [46, 70, 42], 0.32), lit: '#ffc24a' });
    this._castleLayer(g, cam, { par: 0.1, baseY: BH * 0.74, wallH: 14, spacing: 98, seed: 11 + ls,
      col: this._far(sky, [19, 21, 34], 0.1), rim: this._far(sky, [32, 36, 56], 0.12), dark: '#0c0e16', moss: '#2a4222', lit: '#e0a838' });
    this._fog(g, t, BH * 0.7 - vy * 0.1, '#3a4468');
  },

  // Vila (entardecer): cidade medieval — casas, sobrados e um campanário, fumaça.
  village(g, cam, L, t, BW, BH) {
    const sky = this._hex(L.sky[0]), ls = ((L.seed || 0) * 97) | 0, vy = this._cy;
    this._moon(g, BW * 0.22, BH * 0.18 - vy * 0.01, 9, '#ffe9b0');
    this._clouds(g, cam, t, BH * 0.16, 4, 'rgba(255,220,180,0.45)', 0.03);
    this._ridge(g, cam, { par: 0.02, baseY: BH * 0.46, amp: 14, freq: 0.011, oct: 4, seed: 1 + ls, color: this._far(sky, [52, 74, 48], 0.5) });
    this._ridge(g, cam, { par: 0.05, baseY: BH * 0.55, amp: 10, freq: 0.02, oct: 3, seed: 2 + ls, color: this._far(sky, [40, 60, 36], 0.28), rim: this._far(sky, [78, 110, 62], 0.26) });
    // CIDADE distante (telhados ao fundo, enevoados → profundidade urbana)
    this._townRow(g, cam, t, { par: 0.08, spacing: 19, baseY: BH * 0.62, seed: 31 + ls,
      wall: this._far(sky, [78, 64, 46], 0.4), wallSh: this._far(sky, [50, 40, 28], 0.38), wallHi: this._far(sky, [96, 80, 58], 0.4),
      roof: this._far(sky, [96, 48, 38], 0.36), roofHi: this._far(sky, [122, 66, 50], 0.36), roofSh: this._far(sky, [58, 26, 22], 0.34),
      win: this._far(sky, [40, 30, 18], 0.3), lit: '#e8b24a', door: this._far(sky, [34, 24, 16], 0.3) });
    // plano da CIDADE da frente: chão + prédios bem visíveis (mesmo parallax → assentados)
    this._ridge(g, cam, { par: 0.12, baseY: BH * 0.66, amp: 4, freq: 0.04, oct: 3, seed: 8 + ls, color: '#3c3a24', rim: '#56542e' });
    this._townRow(g, cam, t, { par: 0.12, spacing: 23, baseY: BH * 0.66, seed: 7 + ls,
      wall: '#8a7050', wallSh: '#54422c', wallHi: '#a88c64', roof: '#9a4232', roofHi: '#c26044', roofSh: '#5e221a',
      win: '#28200f', lit: '#ffd664', door: '#241710' });
    this._ridge(g, cam, { par: 0.24, baseY: BH * 0.76, amp: 7, freq: 0.03, oct: 3, seed: 4 + ls, color: '#1c3214', rim: '#2c4a1e' });
  },

  // Masmorra (interior): UMA parede de alvenaria coerente — tijolos, nichos em arco e
  // tochas TODOS no mesmo parallax (cam.x e cam.y) e ancorados à célula do MUNDO, então
  // nada "nada" em relação ao resto; a parede inteira desliza como um bloco só (Broforce).
  dungeon(g, cam, L, t, BW, BH) {
    const par = 0.2, bw = 24, bh = 14;
    const ox = cam.x * par, oy = (cam.y || 0) * par;                 // deslocamento ÚNICO da parede
    // ---- tijolos (cada um preso à sua célula do mundo → padrão fixo) ----
    const c0 = Math.floor(ox / bw) - 1, c1 = Math.floor((ox + BW) / bw) + 1;
    const r0 = Math.floor(oy / bh) - 1, r1 = Math.floor((oy + BH) / bh) + 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const stag = (((r % 2) + 2) % 2) ? bw / 2 : 0;
      const sx = Math.round(c * bw + stag - ox), sy = Math.round(r * bh - oy);
      const key = (c * 73 + r * 131) | 0, shade = 17 + Math.round(this._h01(key) * 13);
      g.fillStyle = 'rgb(' + shade + ',' + (shade + 3) + ',' + (shade + 8) + ')'; g.fillRect(sx + 1, sy + 1, bw - 2, bh - 2);
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(sx + 1, sy + 1, bw - 2, 1);                 // bisel claro
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(sx, sy, bw, 1); g.fillRect(sx, sy, 1, bh);         // argamassa
      if (this._h01(key * 3 + 1) < 0.3) {                                                            // musgo escorrendo do topo
        g.fillStyle = 'rgba(52,78,40,0.55)'; const mw = 4 + (this._h01(key * 2 + 5) * 8 | 0); g.fillRect(sx + 2, sy + 1, mw, 2);
        for (let d = 0; d < 3; d++) if (this._h01(key + d * 4) > 0.4) g.fillRect(sx + 2 + d * 4, sy + 3, 1, 2 + (this._h01(key * 9 + d) * 4 | 0));
      }
      if (this._h01(key * 5 + 2) < 0.1) {                                                            // rachadura (rara)
        const j = (this._h01(key * 7) * 3) | 0;
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(sx + 4 + j, sy + 2); g.lineTo(sx + 8 - j, sy + 6); g.lineTo(sx + 6 + j, sy + bh - 2); g.stroke();
      } else if (this._h01(key * 11 + 3) < 0.14) { g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(sx + bw - 7, sy + 2, 5, bh - 3); }   // mancha úmida
    }
    // ---- nichos em arco + tochas, EMBUTIDOS na parede (mesmo ox/oy, grade do mundo) ----
    const BAYW = 84, BAYH = 92, aw = 28, ah = 46;
    const bc0 = Math.floor(ox / BAYW) - 1, bc1 = Math.floor((ox + BW) / BAYW) + 1;
    const br0 = Math.floor(oy / BAYH) - 1, br1 = Math.floor((oy + BH) / BAYH) + 1;
    for (let br = br0; br <= br1; br++) for (let bc = bc0; bc <= bc1; bc++) {
      const ax = Math.round(bc * BAYW + 28 - ox), ay = Math.round(br * BAYH + 26 - oy);
      g.fillStyle = '#0a0c10'; g.fillRect(ax, ay, aw, ah);                                            // vão escuro do nicho
      for (let s = 0; s < 7; s++) { const ww = aw - s * 4; g.fillRect(ax + (aw - ww) / 2, ay - s * 2, ww, 2); }   // topo em arco
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(ax - 2, ay - 14, 2, ah + 14); g.fillRect(ax + aw, ay - 14, 2, ah + 14);   // sombra das ombreiras
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(ax - 3, ay - 14, 1, ah + 14);                // luz na ombreira esquerda
      if (this._lit(bc * 31 + br * 17, 9, 0.5)) {                                                     // tocha embutida (algumas, fixa)
        const gy = ay + ah - 12;
        g.fillStyle = '#241a10'; g.fillRect(ax + aw / 2 - 1, gy, 2, 8);                               // suporte
        this._flame(g, ax + aw / 2, gy, 5, 'rgba(255,140,55,0.5)', '#ff9a3c', '#ffe49a');
      }
    }
    this._dust(g, t);
  },

  // Campo de Guerra (céu vermelho de tempestade): ruínas em chamas, fumaça, brasas.
  battlefield(g, cam, L, t, BW, BH) {
    const sky = this._hex(L.sky[0]), ls = ((L.seed || 0) * 97) | 0;
    if (Math.sin(t * 0.5) > 0.9988) { g.fillStyle = 'rgba(255,210,170,0.15)'; g.fillRect(0, 0, BW, BH); }   // relâmpago raro
    this._ridge(g, cam, { par: 0.02, baseY: BH * 0.44, amp: 16, freq: 0.01, oct: 4, seed: 1 + ls, color: this._far(sky, [64, 26, 22], 0.5) });
    this._ridge(g, cam, { par: 0.035, baseY: BH * 0.5, amp: 12, freq: 0.016, oct: 4, seed: 5 + ls, color: this._far(sky, [52, 20, 16], 0.32) });
    // plano das ruínas: chão + torres (mesmo parallax → assentadas)
    this._ridge(g, cam, { par: 0.06, baseY: BH * 0.64, amp: 6, freq: 0.03, oct: 3, seed: 12 + ls, color: '#1e0d0c', rim: '#2e1412' });
    this._towerRow(g, cam, { par: 0.06, spacing: 80, baseY: BH * 0.64, seed: 2 + ls, color: '#241010', rim: '#3a1816', ruin: true, fireRatio: 0.4, t });
    this._ridge(g, cam, { par: 0.11, baseY: BH * 0.62, amp: 11, freq: 0.02, oct: 3, seed: 3 + ls, color: '#180a0a', rim: '#2c1212' });
    this._smokeColumns(g, cam, t, 'rgba(18,11,9,0.36)', 0.06);
    this._embers(g, t);
  },

  // Floresta (dia): feixes de luz, fileiras de coníferas em planos assentados.
  forest(g, cam, L, t, BW, BH) {
    const sky = this._hex(L.sky[0]), ls = ((L.seed || 0) * 97) | 0, vy = this._cy;
    g.globalAlpha = 0.08; g.fillStyle = '#dfffb0';
    for (let i = 0; i < 5; i++) { const sx = ((i * 70 - cam.x * 0.05) % (BW + 60) + BW + 60) % (BW + 60) - 30; g.beginPath(); g.moveTo(sx, -vy * 0.05); g.lineTo(sx + 14, -vy * 0.05); g.lineTo(sx + 40, BH); g.lineTo(sx + 20, BH); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
    this._ridge(g, cam, { par: 0.02, baseY: BH * 0.4, amp: 14, freq: 0.012, oct: 4, seed: 1 + ls, color: this._far(sky, [54, 96, 62], 0.46) });
    this._treeRow(g, cam, { par: 0.05, spacing: 15, baseY: BH * 0.5, kind: 'conifer', rad: 9, color: this._far(sky, [28, 60, 32], 0.22), rim: this._far(sky, [64, 112, 60], 0.26), trunk: '#243020', seed: 2 + ls });
    this._treeRow(g, cam, { par: 0.12, spacing: 18, baseY: BH * 0.6, kind: 'conifer', rad: 12, color: '#183a1c', rim: '#2c5a2e', trunk: '#1e1810', seed: 3 + ls });
    // plano da frente: chão + coníferas no MESMO parallax (assentadas)
    this._ridge(g, cam, { par: 0.22, baseY: BH * 0.72, amp: 6, freq: 0.05, oct: 3, seed: 5 + ls, color: '#0e2612', rim: '#163a1c' });
    this._treeRow(g, cam, { par: 0.22, spacing: 24, baseY: BH * 0.74, kind: 'conifer', rad: 16, color: '#0c220f', rim: '#193318', trunk: '#161009', seed: 4 + ls });
    this._fireflies(g, t); this._leaves(g, t);
  },

  // Selva (dia claro): sol, bruma, montanhas, dossel, zigurautes, mata, palmeiras.
  jungle(g, cam, L, t, BW, BH) {
    const sky = this._hex(L.sky[0]), ls = ((L.seed || 0) * 97) | 0, vy = this._cy;
    this._sun(g, BW * 0.8, BH * 0.2 - vy * 0.01, 10, '#fff4c0', 0.7);
    this._hazeBand(g, BH * 0.3 - vy * 0.03, BH * 0.22, this._rgb(this._mix(sky, [255, 255, 255], 0.3)), 0.22);
    this._hazeBand(g, BH * 0.46 - vy * 0.04, BH * 0.15, this._rgb(this._mix(sky, [170, 210, 150], 0.5)), 0.28);
    this._clouds(g, cam, t, BH * 0.15, 5, 'rgba(255,255,255,0.8)', 0.04);
    this._ridge(g, cam, { par: 0.02, baseY: BH * 0.4, amp: 17, freq: 0.01, oct: 4, seed: 1 + ls, color: this._far(sky, [56, 112, 104], 0.5) });
    this._ridge(g, cam, { par: 0.035, baseY: BH * 0.47, amp: 13, freq: 0.014, oct: 4, seed: 2 + ls, color: this._far(sky, [44, 100, 80], 0.36), rim: this._far(sky, [100, 160, 110], 0.34) });
    this._ridge(g, cam, { par: 0.05, baseY: BH * 0.52, amp: 9, freq: 0.06, oct: 3, seed: 4 + ls, color: this._far(sky, [34, 86, 46], 0.24), rim: this._far(sky, [70, 138, 70], 0.28) });   // dossel distante
    this._ziggRow(g, cam, { par: 0.07, spacing: 132, baseY: BH * 0.56, w: 56, steps: 5, stepH: 6, seed: 3 + ls, color: this._far(sky, [54, 76, 54], 0.36), rim: this._far(sky, [112, 146, 108], 0.32) });
    // MATA DENSA: fileiras próximas de copas redondas (planos médios)
    this._treeRow(g, cam, { par: 0.1, spacing: 18, baseY: BH * 0.6, kind: 'round', rad: 12, color: this._far(sky, [32, 80, 38], 0.16), hi: this._far(sky, [58, 118, 58], 0.18), trunk: '#243018', seed: 5 + ls });
    this._treeRow(g, cam, { par: 0.15, spacing: 15, baseY: BH * 0.65, kind: 'round', rad: 12, color: '#225429', hi: '#317038', trunk: '#262014', seed: 7 + ls });
    // plano da FRENTE: morrinho + mata densa + palmeiras no MESMO parallax (assentadas)
    this._ridge(g, cam, { par: 0.26, baseY: BH * 0.72, amp: 6, freq: 0.05, oct: 3, seed: 9 + ls, color: '#14401b', rim: '#1f5526' });
    this._treeRow(g, cam, { par: 0.26, spacing: 13, baseY: BH * 0.74, kind: 'round', rad: 13, color: '#133a1a', hi: '#1f5526', trunk: '#1c1610', seed: 8 + ls });
    this._palmRow(g, cam, t, { par: 0.26, spacing: 44, baseY: BH * 0.745, color: '#123414', hi: '#1f5524', trunk: '#2a2014', seed: 6 + ls });
    this._leaves(g, t);
  },
};

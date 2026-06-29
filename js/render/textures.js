/* ============================================================
   textures.js — pre-rendered tile textures + decoration art
   Each material is baked into a few offscreen canvases (variants)
   so the world looks hand-textured and stays fast.
   ============================================================ */

const TEX = {
  ready: false, V: 3, tiles: {}, caps: {},
  TQ: 16,            // resolução LÓGICA do tile (px de arte) — baixa p/ casar com os personagens
  _decorBuf: null,   // buffer reaproveitado p/ pixelizar decorações ao vivo

  _cv(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; },
  _rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; },

  build() {
    const T = CONFIG.TILE;
    for (const idStr in MAT) {
      const id = +idStr; if (!id || !MAT[id]) continue;
      this.tiles[id] = [];
      for (let v = 0; v < this.V; v++) {
        const c = this._cv(T); this._paint(c.getContext('2d'), id, T, v);
        this._pixelateTile(c);                 // resolve o tile em poucos pixels (pixel-art)
        this.tiles[id].push(c);
      }
    }
    this.ready = true;
  },

  // reduz o tile detalhado p/ TQ×TQ, achata a paleta (posterize) e amplia
  // de volta com vizinho-mais-próximo → blocos em pixel-art casando com os personagens.
  _pixelateTile(c) {
    const T = c.width, TQ = this.TQ;
    const small = this._cv(TQ);
    const sg = small.getContext('2d'); sg.imageSmoothingEnabled = true;
    sg.drawImage(c, 0, 0, TQ, TQ);
    const im = sg.getImageData(0, 0, TQ, TQ), px = im.data, Q = 28;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 90) { px[i + 3] = 0; continue; }       // mantém vãos (ex.: escada) transparentes
      px[i + 3] = 255;
      px[i]     = Math.min(255, Math.round(px[i]     / Q) * Q);
      px[i + 1] = Math.min(255, Math.round(px[i + 1] / Q) * Q);
      px[i + 2] = Math.min(255, Math.round(px[i + 2] / Q) * Q);
    }
    sg.putImageData(im, 0, 0);
    const g = c.getContext('2d'); g.clearRect(0, 0, T, T); g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, TQ, TQ, 0, 0, T, T);
  },

  // desenha uma decoração com o mesmo "grão" de pixel dos blocos: renderiza em
  // baixa resolução num buffer e amplia (nearest). Mantém animações (chama decor()).
  decorPixel(ctx, d, ox, oy, time, game) {
    const T = CONFIG.TILE, PXT = Math.max(1, Math.round(T / this.TQ));
    const bx = d.x - T, by = d.y - Math.round(T * 1.6), bw = T * 3, bh = T * 4;
    const sw = Math.ceil(bw / PXT), sh = Math.ceil(bh / PXT);
    let buf = this._decorBuf; if (!buf) buf = this._decorBuf = document.createElement('canvas');
    if (buf.width !== sw || buf.height !== sh) { buf.width = sw; buf.height = sh; }
    const g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sw, sh); g.imageSmoothingEnabled = true;
    g.save(); g.scale(1 / PXT, 1 / PXT); g.translate(-bx, -by);
    this.decor(g, d, 0, 0, time, game);                      // desenha a decoração em coords de mundo
    g.restore();
    this._posterizeDecor(g, sw, sh);                         // achata em bandas chapadas → pixel-art igual aos blocos
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, sw, sh, Math.round(bx + ox), Math.round(by + oy), bw, bh);
    ctx.restore();
  },

  // posteriza o buffer da decoração: quantiza RGB em bandas chapadas e o alfa em
  // poucos níveis (brilhos viram halos "em degrau"), deixando a arte com o mesmo
  // visual pixel-art dos blocos em vez de gradientes suaves.
  _posterizeDecor(g, sw, sh) {
    // quantização por bits (rápida): RGB em passos de 32 (top 3 bits, com arredondamento),
    // alfa em passos de 64 → bandas chapadas e glows "em degrau", sem divisões no laço.
    const im = g.getImageData(0, 0, sw, sh), px = im.data, n = px.length;
    for (let i = 0; i < n; i += 4) {
      const a = px[i + 3];
      if (a < 20) { px[i + 3] = 0; continue; }
      px[i + 3] = a >= 232 ? 255 : (a + 32) & 0xC0;
      px[i]     = px[i]     > 239 ? 255 : (px[i]     + 16) & 0xE0;
      px[i + 1] = px[i + 1] > 239 ? 255 : (px[i + 1] + 16) & 0xE0;
      px[i + 2] = px[i + 2] > 239 ? 255 : (px[i + 2] + 16) & 0xE0;
    }
    g.putImageData(im, 0, 0);
  },

  // exposed-top cap overlay (grass, snow-cap, lighter rim) for open-above tiles
  capFor(id) { return MAT[id] && MAT[id].cap; },

  _paint(g, id, T, v) {
    const m = MAT[id]; const rng = this._rng(id * 97 + v * 31 + 7);
    if (m.ladder) {   // transparent ladder: two rails + rungs
      const x0 = 6, x1 = T - 6;
      g.fillStyle = '#3a2814'; g.fillRect(x0 - 2, 0, 4, T); g.fillRect(x1 - 2, 0, 4, T);
      g.fillStyle = m.c; g.fillRect(x0 - 2, 0, 2, T); g.fillRect(x1 - 2, 0, 2, T);
      for (let y = 3; y < T; y += 7) { g.fillStyle = '#3a2814'; g.fillRect(x0, y, x1 - x0, 4); g.fillStyle = m.edge; g.fillRect(x0, y, x1 - x0, 2); }
      return;
    }
    g.fillStyle = m.c; g.fillRect(0, 0, T, T);
    const speck = (n, dark, lite) => {
      for (let i = 0; i < n; i++) {
        const x = (rng() * T) | 0, y = (rng() * T) | 0, s = 1 + (rng() * 2 | 0);
        g.fillStyle = rng() < 0.5 ? dark : lite; g.fillRect(x, y, s, s);
      }
    };
    switch (m.name) {
      case 'dirt': {
        g.fillStyle = m.c2; g.fillRect(0, T - 6, T, 6);
        for (let i = 0; i < 10; i++) { const x = (rng() * T) | 0, y = 6 + (rng() * (T - 8)) | 0, r = 1 + (rng() * 2 | 0); g.fillStyle = rng() < 0.5 ? '#4a3320' : '#7d5938'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        speck(14, '#3f2c1a', '#85603a');
        break;
      }
      case 'stone': {
        // irregular rock facets
        g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(rng() * T, rng() * T); g.lineTo(rng() * T, rng() * T); g.stroke(); }
        g.fillStyle = m.edge; g.fillRect(2, 2, T - 4, 2);
        speck(18, '#3a3631', '#6e6760'); break;
      }
      case 'brick': {
        const bh = 8, mortar = '#3a1f18';
        g.fillStyle = mortar; g.fillRect(0, 0, T, T);
        for (let row = 0, ri = 0; row < T; row += bh, ri++) {
          const off = (ri % 2) ? -T / 2 : 0;
          for (let x = off; x < T; x += T / 2) {
            g.fillStyle = ['#8f463a', '#7a3a30', '#9a4e40'][(rng() * 3) | 0];
            g.fillRect(x + 1, row + 1, T / 2 - 2, bh - 2);
            g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1, row + 1, T / 2 - 2, 1);
          }
        }
        break;
      }
      case 'wood': {
        const pw = T / 3;
        for (let p = 0; p < 3; p++) {
          g.fillStyle = ['#7d5a2e', '#6f4f28', '#86632f'][(rng() * 3) | 0];
          g.fillRect(p * pw, 0, pw, T);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(p * pw + pw - 1, 0, 1, T);
          g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 1;
          for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(p * pw + 2, rng() * T); g.bezierCurveTo(p * pw + pw * 0.3, rng() * T, p * pw + pw * 0.7, rng() * T, p * pw + pw - 2, rng() * T); g.stroke(); }
          if (rng() < 0.4) { g.fillStyle = '#4a3318'; g.beginPath(); g.arc(p * pw + pw / 2, (rng() * T) | 0, 2, 0, TAU); g.fill(); }
        }
        // iron nails
        g.fillStyle = '#2c2622'; [4, T - 5].forEach(yy => [4, T - 5].forEach(xx => { g.beginPath(); g.arc(xx, yy, 1.6, 0, TAU); g.fill(); }));
        break;
      }
      case 'bedrock': {
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(rng() * T, rng() * T); g.lineTo(rng() * T, rng() * T); g.stroke(); }
        speck(12, '#16140f', '#3a3633'); break;
      }
      case 'cobble': {
        // dungeon cobblestones
        g.fillStyle = '#2b3038'; g.fillRect(0, 0, T, T);
        const cs = T / 4;
        for (let yy = 0; yy < T; yy += cs) for (let xx = 0; xx < T; xx += cs) {
          const ox = (rng() - 0.5) * 3, oy = (rng() - 0.5) * 3;
          g.fillStyle = ['#4a525c', '#3f4750', '#545d68'][(rng() * 3) | 0];
          g.beginPath(); g.ellipse(xx + cs / 2 + ox, yy + cs / 2 + oy, cs / 2 - 1, cs / 2 - 1.5, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.ellipse(xx + cs / 2 + ox, yy + cs / 2 + oy - 1, cs / 3, cs / 5, 0, 0, TAU); g.fill();
        }
        break;
      }
      case 'sandstone': {
        const bh = T / 2;
        for (let row = 0; row < T; row += bh) {
          g.fillStyle = '#caa86a'; g.fillRect(0, row, T, bh);
          g.fillStyle = '#a98a4e'; g.fillRect(0, row + bh - 2, T, 2);
        }
        g.strokeStyle = 'rgba(120,90,50,0.5)'; g.strokeRect(0.5, 0.5, T - 1, T - 1);
        speck(16, '#b8975a', '#e0c488'); break;
      }
      case 'mossy': {
        // stone brick with moss
        g.fillStyle = '#3a3631'; g.fillRect(0, 0, T, T);
        const bh = T / 2;
        for (let row = 0, ri = 0; row < T; row += bh, ri++) {
          const off = (ri % 2) ? -T / 2 : 0;
          for (let x = off; x < T; x += T / 2) { g.fillStyle = '#5b5550'; g.fillRect(x + 1, row + 1, T / 2 - 2, bh - 2); }
        }
        for (let i = 0; i < 10; i++) { g.fillStyle = rng() < 0.5 ? '#3f5a32' : '#557a3a'; g.beginPath(); g.arc(rng() * T, rng() * T, 1 + rng() * 2.5, 0, TAU); g.fill(); }
        break;
      }
      case 'barrel': {
        g.fillStyle = '#3a2a14'; g.fillRect(0, 0, T, T);
        g.fillStyle = '#6f4f24'; g.fillRect(3, 1, T - 6, T - 2);
        g.fillStyle = '#2c2622'; g.fillRect(2, 5, T - 4, 3); g.fillRect(2, T - 8, T - 4, 3);
        g.fillStyle = '#1b1714'; g.beginPath(); g.arc(T / 2, T / 2, 4, 0, TAU); g.fill(); // powder hole
        g.fillStyle = '#caa33a'; g.fillRect(T / 2 - 1, 0, 2, 5); // fuse
        break;
      }
      case 'rocket': {     // red rocket-barrel with a warhead nose + fins
        g.fillStyle = '#2a1410'; g.fillRect(0, 0, T, T);
        g.fillStyle = '#9a2a22'; g.fillRect(4, 2, T - 8, T - 4);
        g.fillStyle = '#b1322c'; g.fillRect(6, 2, T - 14, T - 4);
        g.fillStyle = '#e0843a'; g.beginPath(); g.moveTo(T - 6, 3); g.lineTo(T - 1, T / 2); g.lineTo(T - 6, T - 3); g.closePath(); g.fill(); // nose
        g.fillStyle = '#2c2622'; g.fillRect(3, 5, T - 6, 2); g.fillRect(3, T - 7, T - 6, 2);
        g.fillStyle = '#1b1714'; g.beginPath(); g.moveTo(3, 4); g.lineTo(0, 1); g.lineTo(4, 9); g.fill(); g.beginPath(); g.moveTo(3, T - 4); g.lineTo(0, T - 1); g.lineTo(4, T - 9); g.fill(); // fins
        g.fillStyle = '#ffd86b'; g.fillRect(2, T / 2 - 1, 3, 2); break;
      }
      case 'firebarrel': case 'clusterkeg': case 'powderkeg': case 'nitro': case 'mortarkeg': {
        // corpo de barril/tonel comum a todos, recolorido por tipo + marca de perigo
        g.fillStyle = '#2a1a0e'; g.fillRect(0, 0, T, T);
        g.fillStyle = m.c2; g.fillRect(2, 1, T - 4, T - 2);
        g.fillStyle = m.c; g.fillRect(3, 1, T - 6, T - 2);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(4, 1, 2, T - 2);          // realce vertical
        g.fillStyle = '#1b1410'; g.fillRect(2, 4, T - 4, 3); g.fillRect(2, T - 8, T - 4, 3);  // aros de ferro
        g.fillStyle = m.edge;
        if (m.name === 'firebarrel') {                 // chama estilizada
          g.beginPath(); g.moveTo(T / 2, 4); g.quadraticCurveTo(T / 2 + 5, T / 2, T / 2, T - 5); g.quadraticCurveTo(T / 2 - 5, T / 2, T / 2, 4); g.fill();
          g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(T / 2, T * 0.62, 2.5, 0, TAU); g.fill();
        } else if (m.name === 'clusterkeg') {          // três pontos (cacho)
          [[-4, 0], [4, 0], [0, 5]].forEach(o => { g.beginPath(); g.arc(T / 2 + o[0], T / 2 + o[1], 2.4, 0, TAU); g.fill(); });
        } else if (m.name === 'powderkeg') {           // caveira (perigo extremo)
          g.beginPath(); g.arc(T / 2, T / 2, 4.5, 0, TAU); g.fill(); g.fillStyle = '#2a0e0a'; g.fillRect(T / 2 - 3, T / 2 - 1, 2, 2); g.fillRect(T / 2 + 1, T / 2 - 1, 2, 2); g.fillRect(T / 2 - 2, T / 2 + 3, 4, 1.4);
        } else if (m.name === 'nitro') {               // líquido com bolhas (instável)
          g.fillStyle = '#cffce0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(6 + (rng() * (T - 12)) | 0, 6 + (rng() * (T - 12)) | 0, 1 + rng() * 1.6, 0, TAU); g.fill(); }
        } else {                                        // mortarkeg: ogiva de míssil
          g.beginPath(); g.moveTo(T - 8, 4); g.lineTo(T - 2, T / 2); g.lineTo(T - 8, T - 4); g.closePath(); g.fill();
        }
        g.fillStyle = '#caa33a'; g.fillRect(T / 2 - 1, 0, 2, 4);   // pavio
        break;
      }
      case 'vault': {
        g.fillStyle = '#7a5e1a'; g.fillRect(0, 0, T, T);
        g.fillStyle = '#caa33a'; g.fillRect(2, 2, T - 4, T - 4);
        g.fillStyle = '#f4d35e'; g.fillRect(4, 4, T - 14, T - 14);
        g.fillStyle = '#fff2b0'; g.fillRect(6, 6, 4, 4);
        break;
      }
      case 'sand': {
        for (let y = 0; y < T; y += 3) { g.fillStyle = (y % 6 ? '#d8c07a' : '#cdb36c'); g.fillRect(0, y, T, 3); }
        speck(26, '#b89a52', '#e8d49a');
        g.fillStyle = '#b89a52'; g.fillRect(0, T - 4, T, 4); break;
      }
      case 'gravel': {
        g.fillStyle = '#4a463e'; g.fillRect(0, 0, T, T);
        for (let i = 0; i < 26; i++) { const x = (rng() * T) | 0, y = (rng() * T) | 0, r = 1.5 + rng() * 3; g.fillStyle = ['#6a6258', '#7d756a', '#565049', '#857c6f'][(rng() * 4) | 0]; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(x - 0.6, y - 0.6, r * 0.4, 0, TAU); g.fill(); }
        break;
      }
      case 'temple': {
        // carved temple block: stone face + engraved glyph + moss patches
        g.fillStyle = '#4a5742'; g.fillRect(0, 0, T, T);
        g.fillStyle = '#5b6a4c'; g.fillRect(2, 2, T - 4, T - 4);
        g.fillStyle = 'rgba(0,0,0,0.30)'; g.strokeRect(2.5, 2.5, T - 5, T - 5);
        g.strokeStyle = '#3a4632'; g.lineWidth = 2;            // engraved glyph
        g.strokeRect(T * 0.32, T * 0.32, T * 0.36, T * 0.36);
        g.beginPath(); g.moveTo(T * 0.5, T * 0.32); g.lineTo(T * 0.5, T * 0.68); g.stroke();
        for (let i = 0; i < 7; i++) { g.fillStyle = rng() < 0.5 ? '#3f5a32' : '#557a3a'; g.beginPath(); g.arc(rng() * T, rng() < 0.5 ? rng() * 5 : T - rng() * 6, 1 + rng() * 2.5, 0, TAU); g.fill(); }
        speck(8, '#3a4632', '#76886a'); break;
      }
      case 'plank': {
        const ph = T / 2;
        for (let p = 0; p < 2; p++) {
          g.fillStyle = ['#9a6e3a', '#8a6230', '#a87a40'][(rng() * 3) | 0]; g.fillRect(0, p * ph, T, ph);
          g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, p * ph + ph - 1, T, 1);
          g.strokeStyle = 'rgba(70,48,22,0.5)'; g.lineWidth = 1;
          for (let k = 0; k < 2; k++) { const yy = p * ph + 3 + rng() * (ph - 6); g.beginPath(); g.moveTo(2, yy); g.bezierCurveTo(T * 0.3, yy + rand(-2, 2), T * 0.7, yy + rand(-2, 2), T - 2, yy); g.stroke(); }
        }
        g.fillStyle = '#2c2622'; [5, T - 6].forEach(xx => [ph - 4, T - 4].forEach(yy => { g.beginPath(); g.arc(xx, yy, 1.5, 0, TAU); g.fill(); })); // nails
        break;
      }
      case 'leaf': {
        g.fillStyle = '#234d20'; g.fillRect(0, 0, T, T);
        for (let i = 0; i < 26; i++) { const x = (rng() * T) | 0, y = (rng() * T) | 0, r = 2 + rng() * 3.5; g.fillStyle = ['#2f6a2a', '#3f8a34', '#276324', '#46993a'][(rng() * 4) | 0]; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 8; i++) g.fillRect((rng() * T) | 0, (rng() * T) | 0, 1, 1);
        break;
      }
      case 'jungle': {
        g.fillStyle = m.c; g.fillRect(0, 0, T, T);
        g.fillStyle = m.c2; g.fillRect(0, T - 7, T, 7);                                  // darker subsoil
        for (let i = 0; i < 8; i++) { const x = (rng() * T) | 0, y = 5 + (rng() * (T - 7)) | 0; g.fillStyle = rng() < 0.5 ? '#2e3a14' : '#5e7030'; g.beginPath(); g.arc(x, y, 1 + rng() * 2, 0, TAU); g.fill(); }
        g.strokeStyle = '#6a4a24'; g.lineWidth = 1.4;                                    // roots
        for (let i = 0; i < 2; i++) { const rx = 6 + rng() * (T - 12); g.beginPath(); g.moveTo(rx, T - 7); g.lineTo(rx + rand(-4, 4), T - 1); g.stroke(); }
        speck(10, '#2e3a14', '#6e8038'); break;
      }
      case 'darkstone': {
        g.fillStyle = '#26282d'; g.fillRect(0, 0, T, T);
        const cs = T / 2;
        for (let yy = 0; yy < T; yy += cs) for (let xx = 0; xx < T; xx += cs) { g.fillStyle = ['#3a3e44', '#33363c', '#42464d'][(rng() * 3) | 0]; g.fillRect(xx + 1, yy + 1, cs - 2, cs - 2); }
        g.fillStyle = '#565c64'; [4, T - 4].forEach(xx => [4, T - 4].forEach(yy => { g.beginPath(); g.arc(xx, yy, 1.6, 0, TAU); g.fill(); })); // rivets
        speck(8, '#1e2024', '#565c64'); break;
      }
      default:
        if (m.pattern) this._patternPaint(g, m, T, rng);
        else speck(16, m.c2, m.edge);
    }
    // subtle vignette so tiles read as 3D blocks
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, T - 3, T, 3); g.fillRect(T - 3, 0, 3, T);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, T, 1);
  },

  // ---- generic data-driven painter (m.pattern) — keeps many materials cheap ----
  _patternPaint(g, m, T, rng) {
    const dark = m.c2 || '#000', lite = m.edge || '#fff', base = m.c;
    const speck = (n) => { for (let i = 0; i < n; i++) { const x = (rng() * T) | 0, y = (rng() * T) | 0, s = 1 + (rng() * 2 | 0); g.fillStyle = rng() < 0.5 ? dark : lite; g.fillRect(x, y, s, s); } };
    switch (m.pattern) {
      case 'brick': {
        const bh = 8; g.fillStyle = dark; g.fillRect(0, 0, T, T);
        for (let row = 0, ri = 0; row < T; row += bh, ri++) {
          const off = (ri % 2) ? -T / 2 : 0;
          for (let x = off; x < T; x += T / 2) { g.fillStyle = [base, lite, dark][(rng() * 3) | 0]; g.fillRect(x + 1, row + 1, T / 2 - 2, bh - 2); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1, row + 1, T / 2 - 2, 1); }
        }
        break;
      }
      case 'block': {
        g.fillStyle = dark; g.fillRect(0, 0, T, T); const cs = T / 2;
        for (let yy = 0; yy < T; yy += cs) for (let xx = 0; xx < T; xx += cs) { g.fillStyle = [base, lite, base][(rng() * 3) | 0]; g.fillRect(xx + 1, yy + 1, cs - 2, cs - 2); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(xx + 1, yy + 1, cs - 2, 1); }
        break;
      }
      case 'plank': {
        const ph = T / 2;
        for (let p = 0; p < 2; p++) { g.fillStyle = [base, dark, lite][(rng() * 3) | 0]; g.fillRect(0, p * ph, T, ph); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, p * ph + ph - 1, T, 1); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(2, p * ph + 3 + rng() * 4); g.lineTo(T - 2, p * ph + 3 + rng() * 4); g.stroke(); }
        g.fillStyle = '#2c2622'; [5, T - 6].forEach(xx => [ph - 4, T - 4].forEach(yy => { g.beginPath(); g.arc(xx, yy, 1.4, 0, TAU); g.fill(); }));
        break;
      }
      case 'panel': {
        const pw = T / 3;
        for (let p = 0; p < 3; p++) { g.fillStyle = [base, dark, lite][(rng() * 3) | 0]; g.fillRect(p * pw, 0, pw, T); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(p * pw + pw - 1, 0, 1, T); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(p * pw, 0, 1, T); }
        break;
      }
      case 'tile': {
        const cs = T / 4; for (let yy = 0; yy < T; yy += cs) for (let xx = 0; xx < T; xx += cs) { g.fillStyle = ((xx / cs + yy / cs) % 2) ? base : dark; g.fillRect(xx, yy, cs, cs); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(xx, yy, cs, 1); }
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = cs; k < T; k += cs) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, T); g.moveTo(0, k); g.lineTo(T, k); g.stroke(); }
        break;
      }
      case 'roof': {
        const rh = T / 3;
        for (let row = 0; row < T; row += rh) { for (let x = -((row / rh) % 2) * (T / 6); x < T; x += T / 3) { g.fillStyle = [base, lite, dark][(rng() * 3) | 0]; g.beginPath(); g.moveTo(x, row); g.lineTo(x + T / 3, row); g.lineTo(x + T / 3, row + rh - 1); g.arc(x + T / 6, row + rh - 1, T / 6, 0, Math.PI); g.closePath(); g.fill(); } g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, row + rh - 2, T, 2); }
        break;
      }
      case 'thatch': {
        g.fillStyle = dark; g.fillRect(0, 0, T, T); g.lineWidth = 2;
        for (let i = 0; i < 18; i++) { const x = rng() * T, y = (i / 18) * T; g.strokeStyle = [base, lite, '#9a7e3a'][(rng() * 3) | 0]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() * 6 - 3), y + 6 + rng() * 6); g.stroke(); }
        break;
      }
      case 'plate': {
        g.fillStyle = base; g.fillRect(0, 0, T, T);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(2, 2, T - 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(2, T - 5, T - 4, 3); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(1.5, 1.5, T - 3, T - 3);
        g.fillStyle = lite; [5, T - 5].forEach(xx => [5, T - 5].forEach(yy => { g.beginPath(); g.arc(xx, yy, 1.7, 0, TAU); g.fill(); }));
        if (m.name === 'rust') for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(60,30,12,0.5)'; g.beginPath(); g.arc(rng() * T, rng() * T, 1 + rng() * 3, 0, TAU); g.fill(); }
        break;
      }
      case 'rune': {
        g.fillStyle = dark; g.fillRect(0, 0, T, T); g.fillStyle = base; g.fillRect(2, 2, T - 4, T - 4);
        g.strokeStyle = m.glow || '#b07bff'; g.lineWidth = 2; g.shadowColor = m.glow || '#b07bff'; g.shadowBlur = 6;
        g.beginPath(); g.moveTo(T * 0.5, T * 0.22); g.lineTo(T * 0.5, T * 0.78); g.moveTo(T * 0.3, T * 0.4); g.lineTo(T * 0.7, T * 0.4); g.moveTo(T * 0.3, T * 0.62); g.lineTo(T * 0.7, T * 0.62); g.stroke(); g.shadowBlur = 0;
        break;
      }
      case 'crystal': {
        g.fillStyle = dark; g.fillRect(0, 0, T, T);
        g.fillStyle = base; g.beginPath(); g.moveTo(T / 2, 2); g.lineTo(T - 3, T / 2); g.lineTo(T / 2, T - 2); g.lineTo(3, T / 2); g.closePath(); g.fill();
        g.fillStyle = m.edge; g.beginPath(); g.moveTo(T / 2, 2); g.lineTo(T - 3, T / 2); g.lineTo(T / 2, T / 2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(T / 2 - 1, 6, 2, T * 0.4);
        break;
      }
      case 'ice': {
        g.fillStyle = base; g.fillRect(0, 0, T, T);
        g.globalAlpha = 0.5; g.fillStyle = lite;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(rng() * T, 0); g.lineTo(rng() * T, T); g.lineTo(rng() * T, T); g.closePath(); g.fill(); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(3, 3); g.lineTo(T * 0.5, 3); g.lineTo(3, T * 0.5); g.closePath(); g.fill();
        g.strokeStyle = dark; g.lineWidth = 1; g.strokeRect(0.5, 0.5, T - 1, T - 1);
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(T * 0.3, T); g.lineTo(T * 0.5, T * 0.42); g.lineTo(T * 0.72, 0); g.stroke();
        break;
      }
      case 'glass': {
        g.fillStyle = base; g.fillRect(0, 0, T, T); g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(3, 3); g.lineTo(T * 0.6, 3); g.lineTo(3, T * 0.6); g.fill();
        g.strokeStyle = '#3a4650'; g.lineWidth = 2; g.strokeRect(1.5, 1.5, T - 3, T - 3); g.beginPath(); g.moveTo(T / 2, 2); g.lineTo(T / 2, T - 2); g.moveTo(2, T / 2); g.lineTo(T - 2, T / 2); g.stroke();
        break;
      }
      case 'scale': {   // escamas (peixe/dragão): semicírculos sobrepostos
        g.fillStyle = dark; g.fillRect(0, 0, T, T);
        const s = T / 4;
        for (let ry = 0, i = 0; ry < T + s; ry += s * 0.68, i++) {
          const off = (i % 2) ? s / 2 : 0;
          for (let rx = -s; rx < T + s; rx += s) {
            g.fillStyle = [base, lite, base][(rng() * 3) | 0];
            g.beginPath(); g.arc(rx + off, ry, s * 0.62, 0, Math.PI); g.closePath(); g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1; g.beginPath(); g.arc(rx + off, ry, s * 0.62, 0, Math.PI); g.stroke();
          }
        }
        break;
      }
      case 'hex': {     // favo de mel / placas hexagonais
        g.fillStyle = dark; g.fillRect(0, 0, T, T); const s = T / 4;
        for (let ry = 0, row = 0; ry < T + s; ry += s * 0.86, row++) {
          const off = (row % 2) ? s * 0.75 : 0;
          for (let rx = 0; rx < T + s; rx += s * 1.5) {
            const cx = rx + off, cy = ry; g.fillStyle = [base, lite, base][(rng() * 3) | 0];
            g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6, px = cx + Math.cos(a) * s * 0.55, py = cy + Math.sin(a) * s * 0.55; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 1; g.stroke();
          }
        }
        break;
      }
      case 'circuit': {  // traços arcanos brilhantes
        g.fillStyle = dark; g.fillRect(0, 0, T, T);
        g.strokeStyle = m.glow || lite; g.lineWidth = 1; g.shadowColor = m.glow || lite; g.shadowBlur = 4;
        for (let i = 0; i < 4; i++) {
          let x = (rng() * T) | 0, y = (rng() * T) | 0; g.beginPath(); g.moveTo(x, y);
          for (let s = 0; s < 3; s++) { if (rng() < 0.5) x += (rng() < 0.5 ? -1 : 1) * (4 + (rng() * 8 | 0)); else y += (rng() < 0.5 ? -1 : 1) * (4 + (rng() * 8 | 0)); g.lineTo(x, y); } g.stroke();
          g.fillStyle = m.glow || lite; g.fillRect(x - 1, y - 1, 2, 2);
        }
        g.shadowBlur = 0; break;
      }
      case 'lava': {     // crosta escura + veios de magma brilhantes
        g.fillStyle = dark; g.fillRect(0, 0, T, T);
        for (let i = 0; i < 6; i++) { g.fillStyle = ['#2a140e', '#3a1c12', '#1e0f0a'][(rng() * 3) | 0]; g.fillRect((rng() * T) | 0, (rng() * T) | 0, 4 + rng() * 8, 4 + rng() * 8); }
        g.strokeStyle = m.glow || '#ff7a2c'; g.lineWidth = 1.5; g.shadowColor = m.glow || '#ff7a2c'; g.shadowBlur = 5;
        for (let i = 0; i < 3; i++) { g.beginPath(); let x = (rng() * T) | 0; g.moveTo(x, 0); for (let y = 0; y < T; y += 4) { x += rng() * 6 - 3; g.lineTo(x, y); } g.stroke(); }
        g.shadowBlur = 0; g.fillStyle = '#ffd86b'; for (let i = 0; i < 4; i++) g.fillRect((rng() * T) | 0, (rng() * T) | 0, 1, 1); break;
      }
      case 'dots': {     // pontilhado/manchado
        g.fillStyle = base; g.fillRect(0, 0, T, T);
        for (let i = 0; i < 11; i++) { g.fillStyle = rng() < 0.5 ? dark : lite; const r = 1.5 + rng() * 2.5; g.beginPath(); g.arc(rng() * T, rng() * T, r, 0, TAU); g.fill(); }
        break;
      }
      case 'weave': {    // trama de cesto/tapete
        g.fillStyle = dark; g.fillRect(0, 0, T, T); const s = T / 4;
        for (let y = 0; y < T; y += s) for (let x = 0; x < T; x += s) {
          const horiz = ((x / s + y / s) % 2) === 0; g.fillStyle = horiz ? base : lite;
          if (horiz) g.fillRect(x + 1, y + s * 0.25, s - 2, s * 0.5); else g.fillRect(x + s * 0.25, y + 1, s * 0.5, s - 2);
          g.fillStyle = 'rgba(0,0,0,0.16)';
          if (horiz) g.fillRect(x + 1, y + s * 0.72, s - 2, 1); else g.fillRect(x + s * 0.72, y + 1, 1, s - 2);
        }
        break;
      }
      default: speck(16);
    }
    if (['glass', 'crystal', 'rune', 'lava', 'circuit', 'scale'].indexOf(m.pattern) < 0) speck(6);
  },

  // ---- decorations (non-solid props placed on the map) ------
  decor(ctx, d, ox, oy, time, game) {
    const x = d.x + ox, y = d.y + oy, T = CONFIG.TILE;
    switch (d.type) {
      case 'torch': {
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + T / 2 - 2, y + 8, 4, T - 8);
        ctx.fillStyle = '#5a4326'; ctx.fillRect(x + T / 2 - 4, y + 6, 8, 5);
        const f = 6 + Math.sin(time * 12 + d.x) * 2;
        const grad = ctx.createRadialGradient(x + T / 2, y + 4, 1, x + T / 2, y + 4, f + 8);
        grad.addColorStop(0, 'rgba(255,220,120,0.9)'); grad.addColorStop(0.4, 'rgba(255,140,60,0.5)'); grad.addColorStop(1, 'rgba(255,80,30,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x + T / 2, y + 4, f + 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.ellipse(x + T / 2, y + 2, 3, f * 0.7, 0, 0, TAU); ctx.fill();
        if (game && Math.random() < 0.3) game.fx._add({ x: d.x + T / 2, y: d.y, vx: rand(-10, 10), vy: rand(-40, -15), life: rand(0.4, 0.9), max: 0.9, r: rand(1, 2.5), c: pick(['#ffd86b', '#ff8a3c']), g: -20, glow: true, shrink: true });
        break;
      }
      case 'door': {
        // fechada = linha vertical (de lado p/ câmera); abre girando na direção do movimento
        const amt = clamp(d.openAmt || 0, 0, 1), dir = d.dir || 1, h = T * 2, topY = y, midX = x + T / 2;
        ctx.fillStyle = '#2e2016'; ctx.fillRect(midX - 1.5, topY - 2, 3, h + 2);   // jamba/batente (a "linha")
        const hingeX = midX - dir * (T * 0.06);
        const ang = amt * 1.35;                         // 0 (fechada) -> ~77° (aberta)
        const w = (T * 0.82) * Math.sin(ang) * dir;     // largura projetada (sinal = direção)
        const lean = (T * 0.10) * Math.sin(ang);
        ctx.fillStyle = amt > 0.02 ? '#6a4a28' : '#5a3f22';
        ctx.beginPath();
        ctx.moveTo(hingeX, topY + 2); ctx.lineTo(hingeX + w, topY + 2 + lean);
        ctx.lineTo(hingeX + w, topY + h - 2 - lean); ctx.lineTo(hingeX, topY + h - 2);
        ctx.closePath(); ctx.fill();
        if (Math.abs(w) > 3) {
          ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1;
          for (let k = 1; k <= 2; k++) { const lx2 = hingeX + w * (k / 3); ctx.beginPath(); ctx.moveTo(lx2, topY + 4); ctx.lineTo(lx2, topY + h - 4); ctx.stroke(); }
          ctx.fillStyle = '#caa33a'; ctx.beginPath(); ctx.arc(hingeX + w * 0.82, topY + h * 0.5, 1.8, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#caa33a'; ctx.beginPath(); ctx.arc(midX + dir * 3, topY + h * 0.5, 1.8, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'banner': {
        ctx.fillStyle = '#2c2622'; ctx.fillRect(x + 4, y, T - 8, 3);
        const sway = Math.sin(time * 2 + d.x) * 2;
        ctx.fillStyle = d.color || '#7a2a2a'; ctx.beginPath();
        ctx.moveTo(x + 6, y + 2); ctx.lineTo(x + T - 6, y + 2);
        ctx.lineTo(x + T - 6 + sway, y + T * 1.3); ctx.lineTo(x + T / 2 + sway, y + T * 1.1); ctx.lineTo(x + 6 + sway, y + T * 1.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#caa33a'; ctx.fillRect(x + T / 2 - 3 + sway / 2, y + T * 0.4, 6, 6); // sigil
        break;
      }
      case 'window': {
        ctx.fillStyle = '#15110e'; ctx.fillRect(x + 6, y + 4, T - 12, T - 6);
        const glow = (Math.sin(time * 1.5 + d.x) * 0.2 + 0.7);
        ctx.fillStyle = `rgba(120,170,255,${glow})`; ctx.fillRect(x + 8, y + 6, T - 16, T - 12);
        ctx.fillStyle = '#15110e'; ctx.fillRect(x + T / 2 - 1, y + 6, 2, T - 12); ctx.fillRect(x + 8, y + T / 2 - 1, T - 16, 2);
        ctx.strokeStyle = '#3a3631'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, y + 4, T - 12, T - 6);
        break;
      }
      case 'pillar': {
        ctx.fillStyle = '#4a463f'; ctx.fillRect(x + 4, y, T - 8, T);
        ctx.fillStyle = '#5e5950'; ctx.fillRect(x + 6, y, 3, T);
        ctx.fillStyle = '#2c2a26'; ctx.fillRect(x + 4, y, T - 8, 2);
        break;
      }
      case 'vines': {
        ctx.strokeStyle = '#3f5a32'; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const vx = x + 6 + k * (T - 12) / 2;
          ctx.beginPath(); ctx.moveTo(vx, y);
          for (let s = 0; s < T; s += 6) ctx.lineTo(vx + Math.sin((s + time * 20 + k) * 0.4) * 3, y + s);
          ctx.stroke();
          ctx.fillStyle = '#557a3a'; ctx.beginPath(); ctx.arc(vx, y + T - 4, 2.5, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'web': {
        ctx.strokeStyle = 'rgba(230,224,207,0.35)'; ctx.lineWidth = 1;
        for (let a = 0; a < 4; a++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a * 0.5) * T, y + Math.sin(a * 0.5) * T); ctx.stroke(); }
        for (let r = 6; r < T; r += 7) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI / 2); ctx.stroke(); }
        break;
      }
      case 'grass': {
        ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const gx = x + 4 + k * 7, sway = Math.sin(time * 2 + gx) * 2; ctx.beginPath(); ctx.moveTo(gx, y + T); ctx.quadraticCurveTo(gx + sway, y + T - 8, gx + sway * 2, y + T - 14); ctx.stroke(); }
        break;
      }
      case 'bars': {   // prison cell iron bars
        ctx.fillStyle = '#2a2c30'; ctx.fillRect(x, y - 1, T, 3); ctx.fillRect(x, y + T - 2, T, 3);
        for (let k = 3; k < T; k += 6) { ctx.fillStyle = '#3a3e44'; ctx.fillRect(x + k, y, 3, T); ctx.fillStyle = '#565c64'; ctx.fillRect(x + k, y, 1, T); }
        break;
      }
      case 'rack': {   // arsenal weapon rack
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 3, y + 3, T - 6, 3); ctx.fillRect(x + 3, y + T - 8, T - 6, 3);
        ctx.strokeStyle = '#9aa2ae'; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) { const sx = x + 7 + k * 7; ctx.beginPath(); ctx.moveTo(sx, y + T - 6); ctx.lineTo(sx + 2, y + 6); ctx.stroke(); ctx.fillStyle = '#cfd2d6'; ctx.beginPath(); ctx.moveTo(sx + 2, y + 6); ctx.lineTo(sx - 1, y + 2); ctx.lineTo(sx + 5, y + 4); ctx.fill(); }
        break;
      }
      case 'crate': {  // supply crate
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 2, y + 4, T - 4, T - 5);
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 2, y + 4, T - 4, 2); ctx.fillRect(x + 2, y + T - 3, T - 4, 2);
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + T - 3, y + T - 2); ctx.moveTo(x + T - 3, y + 5); ctx.lineTo(x + 3, y + T - 2); ctx.stroke();
        break;
      }
      case 'lantern': {  // hanging iron lantern with a warm flame
        ctx.strokeStyle = '#2c2622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + T / 2, y); ctx.lineTo(x + T / 2, y + 6); ctx.stroke();
        ctx.fillStyle = '#3a342c'; ctx.fillRect(x + T / 2 - 6, y + 6, 12, 14);
        const fl = 0.5 + 0.4 * Math.sin(time * 9 + d.x);
        ctx.fillStyle = `rgba(255,200,90,${fl})`; ctx.fillRect(x + T / 2 - 4, y + 8, 8, 10);
        const gr = ctx.createRadialGradient(x + T / 2, y + 13, 1, x + T / 2, y + 13, 16);
        gr.addColorStop(0, `rgba(255,200,90,${0.5 * fl})`); gr.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x + T / 2, y + 13, 16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2c2622'; ctx.fillRect(x + T / 2 - 7, y + 5, 14, 2); ctx.fillRect(x + T / 2 - 6, y + 19, 12, 2);
        break;
      }
      case 'chain': {  // hanging chain
        ctx.fillStyle = '#6a6258'; for (let yy = 0; yy < T; yy += 5) { ctx.beginPath(); ctx.ellipse(x + T / 2, y + yy + 2, 2.5, 3.5, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#8a8278'; }
        ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 1.5; for (let yy = 0; yy < T; yy += 5) { ctx.beginPath(); ctx.ellipse(x + T / 2, y + yy + 2, 2.5, 3.5, 0, 0, TAU); ctx.stroke(); }
        break;
      }
      case 'candle': {  // candle stub with flame
        ctx.fillStyle = '#e8e0cf'; ctx.fillRect(x + T / 2 - 3, y + T - 14, 6, 12);
        ctx.fillStyle = '#caa86a'; ctx.fillRect(x + T / 2 - 3, y + T - 14, 6, 2);
        const f = 3 + Math.sin(time * 10 + d.x) * 1.2;
        ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.ellipse(x + T / 2, y + T - 16, 2, f, 0, 0, TAU); ctx.fill();
        const gr = ctx.createRadialGradient(x + T / 2, y + T - 16, 1, x + T / 2, y + T - 16, 12); gr.addColorStop(0, 'rgba(255,210,110,0.5)'); gr.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x + T / 2, y + T - 16, 12, 0, TAU); ctx.fill();
        break;
      }
      case 'cauldron': {  // bubbling sorcery cauldron
        ctx.fillStyle = '#1e1c20'; ctx.beginPath(); ctx.arc(x + T / 2, y + T - 10, 10, 0, Math.PI); ctx.fill(); ctx.fillRect(x + T / 2 - 10, y + T - 14, 20, 5);
        ctx.fillStyle = '#2a2226'; ctx.fillRect(x + T / 2 - 12, y + T - 16, 24, 3);
        ctx.fillStyle = `rgba(120,255,150,${0.6 + 0.3 * Math.sin(time * 4)})`; ctx.fillRect(x + T / 2 - 9, y + T - 15, 18, 3);
        for (let i = 0; i < 3; i++) { const by = y + T - 16 - ((time * 18 + i * 9) % 16); ctx.fillStyle = 'rgba(140,255,170,0.5)'; ctx.beginPath(); ctx.arc(x + T / 2 + Math.sin(time * 3 + i) * 5, by, 1.5 + i * 0.5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + T / 2 - 6, y + T - 2, 12, 2);
        break;
      }
      case 'bookshelf': {  // shelf of tomes
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 2, y + 2, T - 4, T - 2);
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 3, y + 2, T - 6, 1); ctx.fillRect(x + 3, y + T / 2, T - 6, 2);
        const cols = ['#7a2a2a', '#2a4a6a', '#3a5a2a', '#6a5a2a', '#5a2a5a'];
        for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[(i + r) % 5]; ctx.fillRect(x + 4 + i * 5, y + 4 + r * (T / 2 - 1), 4, T / 2 - 5); }
        break;
      }
      case 'bed': {  // simple cot
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 1, y + T - 12, T - 2, 10);
        ctx.fillStyle = '#cabfa0'; ctx.fillRect(x + 2, y + T - 11, T - 10, 5);            // pillow+sheet
        ctx.fillStyle = '#7a2a2a'; ctx.fillRect(x + 2, y + T - 7, T - 4, 4);              // blanket
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 1, y + T - 4, 3, 4); ctx.fillRect(x + T - 4, y + T - 4, 3, 4);
        break;
      }
      case 'table': {  // wooden table with goblet
        ctx.fillStyle = '#6f4f24'; ctx.fillRect(x + 2, y + T - 14, T - 4, 4);
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 4, y + T - 10, 3, 9); ctx.fillRect(x + T - 7, y + T - 10, 3, 9);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(x + T / 2 - 2, y + T - 19, 4, 5); ctx.fillRect(x + T / 2 - 3, y + T - 15, 6, 1);
        break;
      }
      case 'idol': {  // stone idol / totem
        ctx.fillStyle = '#5b6a4c'; ctx.fillRect(x + 5, y + 2, T - 10, T - 2);
        ctx.fillStyle = '#3e4a36'; ctx.fillRect(x + 5, y + 2, T - 10, 3);
        ctx.fillStyle = '#74886a'; ctx.beginPath(); ctx.arc(x + T / 2, y + 10, 5, 0, TAU); ctx.fill();   // head
        ctx.fillStyle = '#1a1a14'; ctx.fillRect(x + T / 2 - 3, y + 9, 2, 2); ctx.fillRect(x + T / 2 + 1, y + 9, 2, 2); // eyes
        ctx.fillStyle = '#caa33a'; ctx.fillRect(x + T / 2 - 4, y + 14, 8, 2);                                 // mouth grin
        for (let i = 0; i < 4; i++) { ctx.fillStyle = '#3e4a36'; ctx.fillRect(x + 7, y + 18 + i * 3, T - 14, 1); }
        break;
      }
      case 'sign': {  // hanging tavern sign
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 2, y + 1, T - 4, 2);
        ctx.strokeStyle = '#2c2622'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 6, y + 7); ctx.moveTo(x + T - 6, y + 3); ctx.lineTo(x + T - 6, y + 7); ctx.stroke();
        ctx.fillStyle = '#6f4f24'; ctx.fillRect(x + 4, y + 7, T - 8, T - 12);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(x + 6, y + 9, T - 12, 2); ctx.fillStyle = '#e8b94a'; ctx.beginPath(); ctx.arc(x + T / 2, y + T - 9, 4, 0, TAU); ctx.fill(); // mug glyph
        break;
      }
      case 'flower': {  // small flowering plant
        ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) { const fx = x + 8 + k * 8, sway = Math.sin(time * 2 + fx) * 1.5; ctx.beginPath(); ctx.moveTo(fx, y + T); ctx.lineTo(fx + sway, y + T - 9); ctx.stroke(); ctx.fillStyle = ['#e85b6e', '#e8c84a', '#b07bff'][k % 3]; ctx.beginPath(); ctx.arc(fx + sway, y + T - 11, 2.6, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(fx + sway, y + T - 11, 1, 0, TAU); ctx.fill(); }
        break;
      }
      case 'shield': {  // wall-mounted heraldic shield
        ctx.fillStyle = '#3a342c'; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + T - 6, y + 4); ctx.lineTo(x + T - 6, y + T - 10); ctx.lineTo(x + T / 2, y + T - 3); ctx.lineTo(x + 6, y + T - 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d.color || '#7a2a2a'; ctx.beginPath(); ctx.moveTo(x + 8, y + 6); ctx.lineTo(x + T - 8, y + 6); ctx.lineTo(x + T - 8, y + T - 11); ctx.lineTo(x + T / 2, y + T - 5); ctx.lineTo(x + 8, y + T - 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#caa33a'; ctx.fillRect(x + T / 2 - 1, y + 8, 2, T - 16); ctx.fillRect(x + 9, y + T / 2 - 1, T - 18, 2);
        break;
      }

      // ===================================================================
      // ===============  NOVOS OBJETOS DE CENA (props.js)  =================
      // ===================================================================
      case 'mine': {
        const cx = x + T / 2, by = y + T - 2;
        ctx.fillStyle = '#3a3e44'; ctx.beginPath(); ctx.arc(cx, by, 7, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 9, by, 18, 2);
        ctx.fillStyle = '#26282d'; for (let i = -1; i <= 1; i++) ctx.fillRect(cx + i * 5 - 0.7, by - 9, 1.5, 3);   // prongs
        const litM = d.armed ? (Math.floor((d.fuse || 0) * 20) % 2 === 0) : (Math.sin(time * 3) > 0.6);
        ctx.fillStyle = litM ? '#ff3a2c' : '#7a1a14'; ctx.beginPath(); ctx.arc(cx, by - 4, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'spikes': {
        const ext = clamp(d.ext || 0, 0, 1), base = y + T, h = 11 * ext;
        ctx.fillStyle = '#1b1714'; ctx.fillRect(x + 2, base - 3, T - 4, 3);
        ctx.fillStyle = '#cfd2d6';
        for (let k = 0; k < 4; k++) { const sx = x + 5 + k * 7; ctx.beginPath(); ctx.moveTo(sx, base - 1); ctx.lineTo(sx + 3, base - 1 - h); ctx.lineTo(sx + 6, base - 1); ctx.fill(); }
        break;
      }
      case 'saw': {
        const cx = x + T / 2, cy = y + T / 2, r = T * 0.42, rot = d.rot || 0;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.fillStyle = '#aeb6c0'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? r : r * 0.7, px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3e44'; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
        ctx.restore(); break;
      }
      case 'flamevent': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(cx - 5, by - 8, 10, 8); ctx.fillStyle = '#26282d'; ctx.fillRect(cx - 6, by - 4, 12, 4);
        if (d.on > 0) { const f = 8 + Math.sin(time * 20) * 3; const gr = ctx.createRadialGradient(cx, by - 12, 1, cx, by - 12, f + 12); gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(1, 'rgba(255,80,30,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by - 12, f + 8, 0, TAU); ctx.fill(); }
        break;
      }
      case 'darttrap': {
        const cx = x + T / 2, cy = y + T / 2, f = d.face || -1;
        ctx.fillStyle = '#4a463f'; ctx.fillRect(x + 5, y + 4, T - 10, T - 8);
        ctx.fillStyle = '#5e5950'; ctx.fillRect(x + 5, y + 4, T - 10, 1);
        ctx.fillStyle = '#15110e'; ctx.beginPath(); ctx.arc(cx + f * 4, cy, 3, 0, TAU); ctx.fill();   // muzzle hole
        ctx.fillStyle = '#2c2a26'; ctx.fillRect(cx - 6, cy - 7, 12, 1); ctx.fillRect(cx - 6, cy + 6, 12, 1);
        break;
      }
      case 'pendulum': {
        const pivx = x + T / 2, pivy = y + 2, tx = (d.bx != null ? d.bx : d.x + T / 2) + ox, ty = (d.by != null ? d.by : d.y + (d.len || T * 2)) + oy;
        ctx.strokeStyle = '#5a4326'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pivx, pivy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = '#3a3e44'; ctx.beginPath(); ctx.arc(pivx, pivy, 3, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.atan2(ty - pivy, tx - pivx));
        ctx.fillStyle = '#cfd2d6'; ctx.beginPath(); ctx.arc(0, 0, 11, -1.2, 1.2); ctx.arc(6, 0, 11, 1.2, -1.2, true); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9aa2ac'; ctx.fillRect(-2, -2, 4, 4); ctx.restore(); break;
      }
      case 'gasvent': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(x + 5, by - 6, T - 10, 6);
        ctx.fillStyle = '#26282d'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 7 + k * 7, by - 6, 2, 6);
        if (d.on > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#7be060'; ctx.beginPath(); ctx.arc(cx, by - 9, 9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        break;
      }
      case 'chest': case 'trapchest': case 'mimic': {
        const cx = x + T / 2, by = y + T - 2, w = T - 8, amt = clamp(d.openAmt || 0, 0, 1);
        ctx.fillStyle = d.type === 'mimic' ? '#5a3a4a' : '#6f4f24'; ctx.fillRect(x + 4, by - 12, w, 12);
        ctx.fillStyle = '#3a2a14'; ctx.fillRect(x + 4, by - 12, w, 2); ctx.fillRect(x + 4, by - 2, w, 2);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(cx - 1.5, by - 9, 3, 7);
        ctx.save(); ctx.translate(x + 4, by - 12); ctx.rotate(-amt * 1.15);
        ctx.fillStyle = d.type === 'mimic' ? '#6a4458' : '#7a5a2a'; ctx.fillRect(0, -8, w, 9);
        ctx.fillStyle = '#3a2a14'; ctx.fillRect(0, -8, w, 2);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(2, -6, 2, 5); ctx.fillRect(w - 4, -6, 2, 5);
        ctx.restore();
        if (d.type === 'mimic' && amt > 0.3) {
          ctx.fillStyle = '#fff2cf'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + 6 + k * 6, by - 12); ctx.lineTo(x + 9 + k * 6, by - 7); ctx.lineTo(x + 12 + k * 6, by - 12); ctx.fill(); }
          ctx.fillStyle = '#ff3a2c'; ctx.fillRect(cx - 6, by - 18, 3, 3); ctx.fillRect(cx + 3, by - 18, 3, 3);
        }
        if (amt < 0.1) {
          if (d.type === 'trapchest') { ctx.fillStyle = '#b1322c'; ctx.beginPath(); ctx.arc(cx, by - 7, 1.6, 0, TAU); ctx.fill(); }
          else if (d.type === 'chest' && Math.sin(time * 4 + d.x) > 0.5) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(cx - 1, by - 8, 2, 2); }
        }
        break;
      }
      case 'secretdoor': {
        const amt = clamp(d.openAmt || 0, 0, 1);
        ctx.fillStyle = '#3f4750'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#2b3038'; ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y + T - 2, T, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + 2, y + 2, T - 4, 1);
        if (amt > 0.02) {
          const gw = amt * T * 0.8; ctx.fillStyle = 'rgba(8,8,12,' + amt + ')'; ctx.fillRect(x + T * 0.5 - gw / 2, y + 2, gw, T - 4);
          ctx.strokeStyle = '#caa33a'; ctx.globalAlpha = amt; ctx.strokeRect(x + T * 0.5 - gw / 2, y + 2, gw, T - 4); ctx.globalAlpha = 1;
        }
        break;
      }
      case 'lockeddoor': {
        if (d.open) break;
        ctx.fillStyle = '#4a4036'; ctx.fillRect(x + 1, y, T - 2, T);
        ctx.fillStyle = '#3a3026'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 1, y + 4 + k * 9, T - 2, 1);
        ctx.fillStyle = '#6a7079'; ctx.fillRect(x + 2, y + 2, 3, T - 4); ctx.fillRect(x + T - 5, y + 2, 3, T - 4);
        ctx.fillStyle = '#9aa2ac'; for (const yy of [y + 5, y + T - 7]) { ctx.beginPath(); ctx.arc(x + 4, yy, 1.4, 0, TAU); ctx.arc(x + T - 4, yy, 1.4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = d.flash > 0 ? '#fff' : '#caa33a'; ctx.fillRect(x + T / 2 - 4, y + T / 2 - 3, 8, 8); ctx.fillStyle = '#15110e'; ctx.fillRect(x + T / 2 - 1, y + T / 2, 2, 3);
        for (let i = 0; i < (d.maxHits || 0); i++) { ctx.fillStyle = i < d.hits ? '#b1322c' : '#3a2a18'; ctx.fillRect(x + 4 + i * 4, y + 2, 3, 2); }
        break;
      }
      case 'cannon': {
        const f = d.face || 1, by = y + T, rec = (d.recoil || 0) * 4;
        ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.arc(x + T * 0.5, by - 5, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a4226'; ctx.beginPath(); ctx.arc(x + T * 0.5, by - 5, 2.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 6, by - 10, T - 12, 5);
        ctx.save(); ctx.translate(x + T * 0.5 - f * rec, by - 12); ctx.rotate((d.aim || 0) * f);
        ctx.fillStyle = d.manned ? '#5a626c' : '#454b54'; ctx.fillRect(f > 0 ? 0 : -(T * 0.7), -4, T * 0.7, 8);
        ctx.fillStyle = '#2c2e33'; ctx.fillRect(f > 0 ? T * 0.7 - 3 : -(T * 0.7), -5, 4, 10);
        ctx.fillStyle = '#6a7079'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
        ctx.restore();
        if (d.manned) { ctx.fillStyle = 'rgba(255,80,40,0.6)'; ctx.beginPath(); ctx.arc(x + T * 0.5, by - 22, 2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'ballista': {
        const f = d.face || 1, by = y + T, rec = (d.recoil || 0) * 3;
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 6, by - 6, T - 12, 5);
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + T * 0.5 - 1, by - 16, 2, 12);
        ctx.save(); ctx.translate(x + T * 0.5 - f * rec, by - 14); ctx.rotate((d.aim || 0) * f); if (f < 0) ctx.scale(-1, 1);
        ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = '#e8e0cf'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(-1.2) * 8, Math.sin(-1.2) * 8); ctx.lineTo(Math.cos(1.2) * 8, Math.sin(1.2) * 8); ctx.stroke();
        ctx.fillStyle = '#9aa2ac'; ctx.fillRect(0, -1.5, T * 0.6, 3); ctx.restore(); break;
      }
      case 'catapult': {
        const f = d.face || 1, by = y + T, arm = (d.arm || 0);
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x + 5, by - 7, T - 10, 6);
        ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + T * 0.5 - 1, by - 14, 2, 9);
        ctx.save(); ctx.translate(x + T * 0.5, by - 12); ctx.rotate(f * (-0.5 - arm * 0.7));
        ctx.strokeStyle = '#6f4f24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(f * 16, -2); ctx.stroke();
        ctx.fillStyle = '#4a3318'; ctx.beginPath(); ctx.arc(f * 16, -2, 4, 0, TAU); ctx.fill(); ctx.restore(); break;
      }
      case 'portal': {
        const cx = x + T / 2, cy = y + T * 0.5, pulse = 0.6 + 0.4 * Math.sin(time * 4 + d.x);
        ctx.save(); ctx.globalAlpha = pulse;
        const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, T * 0.8); gr.addColorStop(0, 'rgba(200,160,255,0.9)'); gr.addColorStop(0.5, 'rgba(150,90,255,0.5)'); gr.addColorStop(1, 'rgba(80,40,160,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.42, T * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#b07bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.34, T * 0.6, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 3; i++) { const a = time * 3 + i * 2.1; ctx.fillStyle = '#e6d6ff'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * T * 0.2, cy + Math.sin(a) * T * 0.4, 1.6, 0, TAU); ctx.fill(); }
        break;
      }
      case 'springpad': {
        const by = y + T, sq = clamp(d.squish || 0, 0, 1), h = 10 - sq * 6;
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(x + 4, by - 3, T - 8, 3);
        ctx.strokeStyle = '#9aa2ac'; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k < 4; k++) { ctx.moveTo(x + 8, by - 3 - k * (h / 4)); ctx.lineTo(x + T - 8, by - 3 - (k + 0.5) * (h / 4)); } ctx.stroke();
        ctx.fillStyle = '#6fd0ff'; ctx.fillRect(x + 5, by - 6 - h, T - 10, 4); break;
      }
      case 'arcaneorb': {
        const cx = x + T / 2, cy = y - T * 0.2 + Math.sin(time * 2) * 6, pulse = 0.6 + 0.4 * Math.sin(time * 5);
        ctx.save(); ctx.globalAlpha = pulse; const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, 13); gr.addColorStop(0, '#e6d6ff'); gr.addColorStop(1, 'rgba(150,90,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#b07bff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 1.4, 0, TAU); ctx.fill(); break;
      }
      case 'shrine': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#6a6258'; ctx.fillRect(x + 6, by - 12, T - 12, 12); ctx.fillStyle = '#8a8278'; ctx.fillRect(x + 6, by - 12, T - 12, 2);
        const gl = 0.5 + 0.4 * Math.sin(time * 3); ctx.save(); ctx.globalAlpha = gl; const gr = ctx.createRadialGradient(cx, by - 16, 1, cx, by - 16, 14); gr.addColorStop(0, 'rgba(255,240,170,0.9)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by - 16, 12, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx - 1, by - 22, 2, 8); break;
      }
      case 'summon': {
        const cx = x + T / 2, by = y + T - 2, gl = 0.5 + 0.5 * Math.sin(time * 3 + d.x);
        ctx.save(); ctx.globalAlpha = d.used ? 0.15 : gl;
        ctx.strokeStyle = '#b07bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, by - 3, T * 0.42, 5, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, by - 3, T * 0.28, 3.5, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.fillStyle = '#c479ff'; ctx.fillRect(cx + Math.cos(a) * T * 0.36 - 1, by - 3 + Math.sin(a) * 4 - 1, 2, 2); }
        ctx.restore(); break;
      }
      case 'updraft': {
        const h = (d.h != null ? d.h : 5 * T); ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#9fd8ff';
        for (let k = 0; k < 4; k++) { const sx = x + 5 + k * 7, off = ((time * 60 + k * 20) % h); ctx.fillRect(sx, y + T - off, 2, 8); } ctx.restore();
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(x + 4, y + T - 5, T - 8, 5); break;
      }
      case 'bell': {
        const cx = x + T / 2, sw = Math.sin(time * 14) * (d.ring || 0) * 0.5;
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + T - 6, y + 4); ctx.stroke();
        ctx.save(); ctx.translate(cx, y + 5); ctx.rotate(sw);
        ctx.fillStyle = '#caa33a'; ctx.beginPath(); ctx.moveTo(-7, 12); ctx.quadraticCurveTo(-7, 2, 0, 1); ctx.quadraticCurveTo(7, 2, 7, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6a1c'; ctx.fillRect(-8, 12, 16, 2); ctx.fillStyle = '#5a4226'; ctx.beginPath(); ctx.arc(0, 15, 1.5, 0, TAU); ctx.fill();
        ctx.restore(); break;
      }
      case 'tripwire': {
        const len = (d.len != null ? d.len : 3 * T), cy = y + T / 2;
        ctx.strokeStyle = d.armed ? 'rgba(255,120,80,0.7)' : 'rgba(120,120,110,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + len, cy); ctx.stroke();
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(x - 1, cy - 4, 3, 8); ctx.fillRect(x + len - 2, cy - 4, 3, 8);
        if (d.armed && Math.sin(time * 6) > 0) { ctx.fillStyle = '#ff5b4a'; ctx.beginPath(); ctx.arc(x + 2, cy, 1.4, 0, TAU); ctx.fill(); }
        break;
      }
      case 'elevator': {
        const pw = (d.pw != null ? d.pw : 2 * T);
        ctx.strokeStyle = '#6a6258'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 6, y - T * 1.4); ctx.moveTo(x + pw - 6, y); ctx.lineTo(x + pw - 6, y - T * 1.4); ctx.stroke();
        ctx.fillStyle = '#5a4226'; ctx.fillRect(x, y, pw, 8); ctx.fillStyle = '#3a2a18'; ctx.fillRect(x, y + 6, pw, 2);
        ctx.fillStyle = '#6a7079'; ctx.fillRect(x, y, pw, 2);
        for (let k = 0; k < pw; k += 10) { ctx.fillStyle = '#caa33a'; ctx.fillRect(x + k + 3, y + 2, 2, 2); }
        break;
      }
      case 'campfire': {
        const cx = x + T / 2, by = y + T - 2;
        ctx.save(); ctx.translate(cx, by - 2); ctx.rotate(0.5); ctx.fillStyle = '#3a2a18'; ctx.fillRect(-9, -2, 18, 4); ctx.restore();
        ctx.save(); ctx.translate(cx, by - 2); ctx.rotate(-0.5); ctx.fillStyle = '#3a2a18'; ctx.fillRect(-9, -2, 18, 4); ctx.restore();
        const f = 8 + Math.sin(time * 12 + d.x) * 3; const gr = ctx.createRadialGradient(cx, by - 8, 1, cx, by - 8, f + 14); gr.addColorStop(0, 'rgba(255,220,120,0.95)'); gr.addColorStop(0.4, 'rgba(255,140,60,0.55)'); gr.addColorStop(1, 'rgba(255,80,30,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by - 8, f + 10, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.ellipse(cx, by - 6, 4, f * 0.8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.ellipse(cx, by - 4, 2.5, f * 0.5, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'brazier': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#3a342c'; ctx.fillRect(cx - 2, by - 12, 4, 12); ctx.fillRect(cx - 6, by - 2, 12, 2);
        ctx.fillStyle = '#5a5048'; ctx.beginPath(); ctx.moveTo(cx - 9, by - 14); ctx.lineTo(cx + 9, by - 14); ctx.lineTo(cx + 6, by - 9); ctx.lineTo(cx - 6, by - 9); ctx.closePath(); ctx.fill();
        const f = 7 + Math.sin(time * 13 + d.x) * 3; const gr = ctx.createRadialGradient(cx, by - 16, 1, cx, by - 16, f + 12); gr.addColorStop(0, 'rgba(255,210,110,0.9)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by - 16, f + 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.ellipse(cx, by - 15, 3, f * 0.7, 0, 0, TAU); ctx.fill(); break;
      }
      case 'magicfire': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#2a2230'; ctx.fillRect(cx - 6, by - 4, 12, 4); ctx.fillStyle = '#3a3048'; ctx.beginPath(); ctx.moveTo(cx - 8, by - 10); ctx.lineTo(cx + 8, by - 10); ctx.lineTo(cx + 5, by - 5); ctx.lineTo(cx - 5, by - 5); ctx.closePath(); ctx.fill();
        const f = 7 + Math.sin(time * 13 + d.x) * 3; const gr = ctx.createRadialGradient(cx, by - 14, 1, cx, by - 14, f + 13); gr.addColorStop(0, 'rgba(180,240,255,0.9)'); gr.addColorStop(0.5, 'rgba(110,180,255,0.5)'); gr.addColorStop(1, 'rgba(80,120,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by - 14, f + 9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#bff0ff'; ctx.beginPath(); ctx.ellipse(cx, by - 13, 3, f * 0.7, 0, 0, TAU); ctx.fill(); break;
      }
      case 'chandelier': {
        const cx = x + T / 2;
        ctx.strokeStyle = '#2c2622'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + 6); ctx.stroke();
        ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, y + 12, T * 0.42, 4, 0, 0, TAU); ctx.stroke();
        for (let i = -1; i <= 1; i++) { const fx = cx + i * (T * 0.32); ctx.fillStyle = '#e8e0cf'; ctx.fillRect(fx - 1.5, y + 8, 3, 5); const f = 2 + Math.sin(time * 10 + i) * 1; ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.ellipse(fx, y + 6, 1.6, f, 0, 0, TAU); ctx.fill(); const gr = ctx.createRadialGradient(fx, y + 7, 1, fx, y + 7, 9); gr.addColorStop(0, 'rgba(255,210,110,0.5)'); gr.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fx, y + 7, 9, 0, TAU); ctx.fill(); }
        break;
      }
      case 'mushroom': {
        const by = y + T;
        for (let k = 0; k < 3; k++) { const mx = x + 7 + k * 8, mh = 6 + (k % 2) * 4; ctx.fillStyle = '#cabfa0'; ctx.fillRect(mx - 1.5, by - mh, 3, mh); ctx.fillStyle = k % 2 ? '#7be0ff' : '#b07bff'; ctx.beginPath(); ctx.arc(mx, by - mh, 4, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(mx - 1, by - mh - 1, 1, 0, TAU); ctx.fill(); const gl = 0.3 + 0.3 * Math.sin(time * 3 + k); const gr = ctx.createRadialGradient(mx, by - mh, 1, mx, by - mh, 10); gr.addColorStop(0, 'rgba(150,230,255,' + gl + ')'); gr.addColorStop(1, 'rgba(150,230,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, by - mh, 10, 0, TAU); ctx.fill(); }
        break;
      }
      case 'fountain': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#6a6258'; ctx.fillRect(x + 3, by - 8, T - 6, 8); ctx.fillStyle = '#3a4650'; ctx.fillRect(x + 5, by - 7, T - 10, 4);
        ctx.fillStyle = '#9fd8ff'; ctx.fillRect(x + 5, by - 7, T - 10, 2);
        ctx.fillStyle = '#6a6258'; ctx.fillRect(cx - 2, by - 16, 4, 9);
        ctx.fillStyle = 'rgba(159,216,255,0.7)'; ctx.beginPath(); ctx.arc(cx, by - 17, 3, 0, TAU); ctx.fill(); break;
      }
      case 'crystalcluster': {
        const by = y + T;
        for (let k = 0; k < 3; k++) { const mx = x + 7 + k * 8, h = 8 + (k % 2) * 6; ctx.fillStyle = '#3a6a8a'; ctx.beginPath(); ctx.moveTo(mx, by - h); ctx.lineTo(mx + 3, by); ctx.lineTo(mx - 3, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#bff0ff'; ctx.beginPath(); ctx.moveTo(mx, by - h); ctx.lineTo(mx + 1.5, by - h * 0.4); ctx.lineTo(mx - 1.5, by - h * 0.4); ctx.closePath(); ctx.fill(); const gl = 0.3 + 0.3 * Math.sin(time * 3 + k * 1.5); const gr = ctx.createRadialGradient(mx, by - h * 0.6, 1, mx, by - h * 0.6, 9); gr.addColorStop(0, 'rgba(191,240,255,' + gl + ')'); gr.addColorStop(1, 'rgba(191,240,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, by - h * 0.6, 9, 0, TAU); ctx.fill(); }
        break;
      }
      case 'statue': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#6a6258'; ctx.fillRect(x + 4, by - 4, T - 8, 4);
        ctx.fillStyle = '#8a8278'; ctx.fillRect(cx - 5, by - 22, 10, 18);
        ctx.fillStyle = '#9a9288'; ctx.beginPath(); ctx.arc(cx, by - 25, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a726a'; ctx.fillRect(cx + 4, by - 24, 2, 18);
        ctx.fillStyle = '#9a9288'; ctx.beginPath(); ctx.moveTo(cx + 5, by - 26); ctx.lineTo(cx + 8, by - 22); ctx.lineTo(cx + 5, by - 21); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(cx - 5, by - 22, 2, 18); break;
      }
      case 'grave': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#5a5650'; ctx.beginPath(); ctx.moveTo(cx - 7, by - 2); ctx.lineTo(cx - 7, by - 14); ctx.arc(cx, by - 14, 7, Math.PI, 0); ctx.lineTo(cx + 7, by - 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3833'; ctx.fillRect(cx - 1.5, by - 16, 3, 7); ctx.fillRect(cx - 4, by - 14, 9, 3);
        ctx.fillStyle = '#2a3a22'; ctx.fillRect(cx - 9, by - 2, 18, 2); break;
      }
      case 'anvil': {
        const cx = x + T / 2, by = y + T;
        ctx.fillStyle = '#3a3e44'; ctx.fillRect(cx - 4, by - 6, 8, 6);
        ctx.fillStyle = '#4a4e54'; ctx.fillRect(cx - 8, by - 12, 16, 4);
        ctx.fillStyle = '#5a5e64'; ctx.beginPath(); ctx.moveTo(cx + 8, by - 12); ctx.lineTo(cx + 12, by - 10); ctx.lineTo(cx + 8, by - 8); ctx.fill();
        ctx.fillStyle = '#6a7079'; ctx.fillRect(cx - 8, by - 12, 16, 1); break;
      }
      case 'stalagmite': {
        const by = y + T, cx = x + T / 2;
        ctx.fillStyle = '#4a525c'; ctx.beginPath(); ctx.moveTo(cx, by - T * 0.9); ctx.lineTo(cx + 6, by); ctx.lineTo(cx - 6, by); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5e6772'; ctx.beginPath(); ctx.moveTo(cx, by - T * 0.9); ctx.lineTo(cx + 2, by - T * 0.4); ctx.lineTo(cx - 2, by - T * 0.4); ctx.closePath(); ctx.fill(); break;
      }
    }
  },
};

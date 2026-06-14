/* ============================================================
   textures.js — pre-rendered tile textures + decoration art
   Each material is baked into a few offscreen canvases (variants)
   so the world looks hand-textured and stays fast.
   ============================================================ */

const TEX = {
  ready: false, V: 3, tiles: {}, caps: {},

  _cv(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; },
  _rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; },

  build() {
    const T = CONFIG.TILE;
    for (const idStr in MAT) {
      const id = +idStr; if (!id || !MAT[id]) continue;
      this.tiles[id] = [];
      for (let v = 0; v < this.V; v++) {
        const c = this._cv(T); this._paint(c.getContext('2d'), id, T, v);
        this.tiles[id].push(c);
      }
    }
    this.ready = true;
  },

  // exposed-top cap overlay (grass, snow-cap, lighter rim) for open-above tiles
  capFor(id) { return MAT[id] && MAT[id].cap; },

  _paint(g, id, T, v) {
    const m = MAT[id]; const rng = this._rng(id * 97 + v * 31 + 7);
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
      default: speck(16, m.c2, m.edge);
    }
    // subtle vignette so tiles read as 3D blocks
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, T - 3, T, 3); g.fillRect(T - 3, 0, 3, T);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, T, 1);
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
    }
  },
};

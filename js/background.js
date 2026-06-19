/* ============================================================
   background.js — layered parallax biome backdrops
   Pure procedural; deterministic motion from a time value so it
   needs no per-frame allocation.
   ============================================================ */

const BG = {
  PXB: 2,        // grão de pixel do fundo (px internos por pixel de arte) — casa com os blocos
  _buf: null,
  _rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; },

  // versão pixelizada: renderiza o parallax numa resolução baixa e amplia (nearest),
  // deixando o fundo no mesmo estilo gráfico dos blocos e personagens.
  drawPixel(ctx, cam, L, t) {
    const W = CONFIG.W, H = CONFIG.H, PXB = this.PXB;
    const bw = Math.ceil(W / PXB), bh = Math.ceil(H / PXB);
    let buf = this._buf; if (!buf) buf = this._buf = document.createElement('canvas');
    if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
    const g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bh);
    g.save(); g.scale(1 / PXB, 1 / PXB);
    this.draw(g, cam, L, t);                 // desenha em coords W×H dentro do buffer reduzido
    g.restore();
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, W, H);
    ctx.restore();
  },

  draw(ctx, cam, L, t) {
    const W = CONFIG.W, H = CONFIG.H;
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const biome = L.biome || 'castle';
    if (this[biome]) this[biome](ctx, cam, L, t, W, H);
    // soft global vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  },

  _stars(ctx, cam, W, H, n, seed) {
    const r = this._rng(seed); ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const x = ((r() * W * 2 - cam.x * 0.08) % W + W) % W;
      const y = r() * H * 0.6; const tw = 0.4 + r() * 0.6;
      ctx.globalAlpha = tw * (0.5 + 0.5 * Math.sin(performance.now() / 600 + i));
      ctx.fillRect(x, y, r() < 0.15 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  },

  _moon(ctx, x, y, rad, col) {
    const gr = ctx.createRadialGradient(x, y, rad * 0.3, x, y, rad * 2.2);
    gr.addColorStop(0, col); gr.addColorStop(0.25, 'rgba(255,240,200,0.25)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath(); ctx.arc(x - rad * 0.3, y - rad * 0.2, rad * 0.18, 0, TAU); ctx.fill();
  },

  _hills(ctx, cam, W, H, baseY, color, par, amp, step) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    const off = -cam.x * par;
    for (let x = -step; x <= W + step; x += step) {
      const wx = x - (off % step);
      ctx.lineTo(wx, baseY + Math.sin((x + off) * 0.01) * amp);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  },

  // ---- BIOMES ------------------------------------------------
  castle(ctx, cam, L, t, W, H) {
    this._stars(ctx, cam, W, H, 90, 11);
    this._moon(ctx, W * 0.78 - cam.x * 0.04 % W, H * 0.22, 34, '#f4ecd0');
    // distant mountains
    this._hills(ctx, cam, W, H, H * 0.55, '#2a2f44', 0.12, 60, 120);
    // far castle silhouette
    const off = -cam.x * 0.22; ctx.fillStyle = '#1c2032';
    for (let i = -1; i < 9; i++) {
      const bx = i * 360 + (off % 360), by = H * 0.5;
      ctx.fillRect(bx, by, 200, H);
      // towers
      ctx.fillRect(bx - 24, by - 60, 44, H); ctx.fillRect(bx + 180, by - 60, 44, H);
      this._battlement(ctx, bx - 24, by - 60, 44); this._battlement(ctx, bx + 180, by - 60, 44);
      this._battlement(ctx, bx, by, 200);
      // lit windows
      ctx.fillStyle = (Math.sin(t + i) > 0.3) ? '#caa33a' : '#5a4520';
      ctx.fillRect(bx + 90, by + 40, 8, 12); ctx.fillRect(bx - 14, by - 30, 6, 10); ctx.fillRect(bx + 192, by - 30, 6, 10);
      ctx.fillStyle = '#1c2032';
    }
    this._hills(ctx, cam, W, H, H * 0.72, '#15182a', 0.4, 30, 90);
    // drifting fog
    this._fog(ctx, cam, W, H, t, 'rgba(60,70,110,0.10)');
  },
  _battlement(ctx, x, y, w) {
    const prev = ctx.fillStyle; ctx.fillStyle = prev;
    for (let i = 0; i < w; i += 16) ctx.fillRect(x + i, y - 8, 9, 9);
  },

  dungeon(ctx, cam, L, t, W, H) {
    // back wall of big stone blocks
    const off = -cam.x * 0.25, oy = -cam.y * 0.25;
    const bw = 96, bh = 64;
    for (let y = -bh; y < H + bh; y += bh) {
      for (let x = -bw; x < W + bw; x += bw) {
        const rowi = Math.floor((y - (oy % bh)) / bh);
        const sx = x - (off % bw) + ((rowi % 2) ? bw / 2 : 0);
        const sy = y - (oy % bh);
        const shade = 22 + ((Math.sin(rowi * 2.3 + x) * 6) | 0);
        ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 8})`;
        ctx.fillRect(sx + 2, sy + 2, bw - 4, bh - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx, sy, bw, 2); ctx.fillRect(sx, sy, 2, bh);
      }
    }
    // arches
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const ao = -cam.x * 0.35;
    for (let i = -1; i < 7; i++) {
      const ax = i * 300 + (ao % 300);
      ctx.fillRect(ax, H * 0.35, 70, H * 0.4);
      ctx.beginPath(); ctx.arc(ax + 35, H * 0.35, 35, Math.PI, 0); ctx.fill();
      // distant torch glow inside arch
      const fl = 0.4 + 0.3 * Math.sin(t * 8 + i);
      const gr = ctx.createRadialGradient(ax + 35, H * 0.5, 2, ax + 35, H * 0.5, 40);
      gr.addColorStop(0, `rgba(255,150,60,${fl})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(ax, H * 0.35, 70, H * 0.45); ctx.fillStyle = 'rgba(0,0,0,0.55)';
    }
    this._dust(ctx, cam, W, H, t);
  },

  village(ctx, cam, L, t, W, H) {
    this._moon(ctx, W * 0.2 + 20, H * 0.2, 30, '#ffe9b0');
    this._clouds(ctx, cam, W, H, t, 'rgba(255,220,180,0.18)');
    this._hills(ctx, cam, W, H, H * 0.62, '#3a5a3a', 0.12, 40, 110);
    // houses
    const off = -cam.x * 0.3;
    for (let i = -1; i < 10; i++) {
      const hx = i * 230 + (off % 230), hy = H * 0.6;
      ctx.fillStyle = '#5a4632'; ctx.fillRect(hx, hy, 90, H);
      ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.moveTo(hx - 8, hy); ctx.lineTo(hx + 45, hy - 40); ctx.lineTo(hx + 98, hy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = (Math.sin(t + i * 2) > 0) ? '#ffd86b' : '#7a5a20'; ctx.fillRect(hx + 36, hy + 26, 16, 18);
      // chimney smoke
      ctx.fillStyle = 'rgba(180,180,180,0.18)';
      for (let s = 0; s < 4; s++) { const sy = hy - 50 - s * 16 - (t * 14 % 16); ctx.beginPath(); ctx.arc(hx + 70 + Math.sin(t + s) * 6, sy, 5 + s * 2, 0, TAU); ctx.fill(); }
    }
    this._hills(ctx, cam, W, H, H * 0.78, '#26401f', 0.45, 24, 80);
  },

  forest(ctx, cam, L, t, W, H) {
    // light shafts
    ctx.save(); ctx.globalAlpha = 0.10; ctx.fillStyle = '#cfe8a0';
    for (let i = 0; i < 5; i++) { const sx = (i * 280 - cam.x * 0.1) % (W + 200); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 60, 0); ctx.lineTo(sx + 160, H); ctx.lineTo(sx + 40, H); ctx.fill(); }
    ctx.restore();
    // layered tree lines
    this._trees(ctx, cam, W, H, H * 0.5, '#1f3a22', 0.15, 120, 70);
    this._trees(ctx, cam, W, H, H * 0.66, '#17301b', 0.32, 95, 55);
    this._trees(ctx, cam, W, H, H * 0.82, '#0f2414', 0.5, 70, 42);
    this._leaves(ctx, cam, W, H, t);
    this._fireflies(ctx, cam, W, H, t);
  },
  _trees(ctx, cam, W, H, baseY, color, par, h, step) {
    const off = -cam.x * par; ctx.fillStyle = color;
    for (let i = -1; i * step < W + step; i++) {
      const x = i * step + (off % step);
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + step / 2, baseY - h); ctx.lineTo(x + step, H); ctx.fill();
      ctx.fillRect(x + step / 2 - 4, baseY - h * 0.2, 8, H);
    }
  },

  battlefield(ctx, cam, L, t, W, H) {
    // stormy red sky already; lightning flashes
    if (Math.sin(t * 1.3) > 0.985 || Math.sin(t * 2.1 + 2) > 0.99) { ctx.fillStyle = 'rgba(255,200,160,0.18)'; ctx.fillRect(0, 0, W, H); }
    this._hills(ctx, cam, W, H, H * 0.55, '#3a1818', 0.12, 50, 120);
    // burning ruined castle
    const off = -cam.x * 0.24; ctx.fillStyle = '#2a1010';
    for (let i = -1; i < 6; i++) {
      const bx = i * 340 + (off % 340), by = H * 0.48;
      ctx.fillRect(bx, by, 180, H); ctx.fillRect(bx + 40, by - 70, 40, 90); ctx.fillRect(bx + 130, by - 40, 36, 60);
      // fire glow on top
      const gr = ctx.createRadialGradient(bx + 60, by - 60, 4, bx + 60, by - 60, 60);
      gr.addColorStop(0, 'rgba(255,160,60,0.5)'); gr.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = gr; ctx.fillRect(bx, by - 120, 180, 120); ctx.fillStyle = '#2a1010';
    }
    // rising smoke columns
    ctx.fillStyle = 'rgba(20,10,10,0.3)';
    for (let i = 0; i < 6; i++) { const sx = (i * 260 - cam.x * 0.24) % (W + 200); for (let s = 0; s < 8; s++) { const sy = H * 0.4 - s * 26 - (t * 16 % 26); ctx.beginPath(); ctx.arc(sx + Math.sin(t * 0.5 + s) * 14, sy, 12 + s * 3, 0, TAU); ctx.fill(); } }
    this._hills(ctx, cam, W, H, H * 0.74, '#1a0a0a', 0.42, 26, 80);
    this._embers(ctx, cam, W, H, t);
  },

  // bright daytime jungle: layered canopy, ruined temple silhouettes, palms, haze
  jungle(ctx, cam, L, t, W, H) {
    this._clouds(ctx, cam, W, H, t, 'rgba(255,255,255,0.22)');
    // far hazy canopy ridges
    this._hills(ctx, cam, W, H, H * 0.5, '#3f6e6a', 0.10, 60, 130);
    this._hills(ctx, cam, W, H, H * 0.6, '#2f5a52', 0.18, 50, 110);
    // ruined temple silhouettes in the mist
    const off = -cam.x * 0.22; ctx.fillStyle = 'rgba(40,66,58,0.85)';
    for (let i = -1; i < 7; i++) {
      const bx = i * 360 + (off % 360), by = H * 0.5;
      // stepped ziggurat
      for (let s = 0; s < 4; s++) ctx.fillRect(bx + s * 10, by + s * 18, 150 - s * 20, H);
      ctx.fillStyle = 'rgba(34,56,48,0.9)';
    }
    // mid jungle tree wall
    this._trees(ctx, cam, W, H, H * 0.66, '#1f4a2a', 0.34, 95, 60);
    // foreground palms
    this._palms(ctx, cam, W, H, t, -cam.x * 0.5);
    this._trees(ctx, cam, W, H, H * 0.86, '#143a1e', 0.55, 70, 44);
    this._leaves(ctx, cam, W, H, t);
    // sun haze
    ctx.fillStyle = 'rgba(255,250,210,0.06)'; ctx.fillRect(0, 0, W, H);
  },
  _palms(ctx, cam, W, H, t, off) {
    for (let i = -1; i * 220 < W + 220; i++) {
      const x = i * 220 + (off % 220), baseY = H * 0.78;
      ctx.strokeStyle = '#2a4a24'; ctx.lineWidth = 7; ctx.beginPath();
      ctx.moveTo(x, H); ctx.quadraticCurveTo(x + 10, baseY + 30, x + 18, baseY); ctx.stroke();
      ctx.fillStyle = '#2f6a2a';
      for (let f = 0; f < 6; f++) { const a = -Math.PI / 2 + (f - 2.5) * 0.5 + Math.sin(t * 0.6 + i + f) * 0.05; ctx.save(); ctx.translate(x + 18, baseY); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(38, 0, 40, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
  },

  // ---- ambience helpers -------------------------------------
  _fog(ctx, cam, W, H, t, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) { const fx = (i * 360 + t * 18) % (W + 300) - 150; ctx.beginPath(); ctx.ellipse(fx, H * 0.75 + i * 20, 220, 40, 0, 0, TAU); ctx.fill(); }
  },
  _clouds(ctx, cam, W, H, t, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) { const cx = (i * 320 + t * 10 - cam.x * 0.06) % (W + 300) - 150, cy = H * 0.15 + (i % 3) * 30; ctx.beginPath(); ctx.ellipse(cx, cy, 70, 22, 0, 0, TAU); ctx.ellipse(cx + 50, cy + 6, 50, 18, 0, 0, TAU); ctx.fill(); }
  },
  _dust(ctx, cam, W, H, t) {
    ctx.fillStyle = 'rgba(200,200,180,0.10)';
    for (let i = 0; i < 40; i++) { const x = ((i * 137 + t * 12) % W), y = ((i * 91 + Math.sin(t + i) * 20 + t * 6) % H); ctx.fillRect(x, y, 2, 2); }
  },
  _leaves(ctx, cam, W, H, t) {
    for (let i = 0; i < 26; i++) { const x = (i * 73 + t * 30 + Math.sin(t + i) * 40) % (W + 40) - 20; const y = (i * 51 + t * 50) % (H + 40) - 20; ctx.fillStyle = ['#6a8a3a', '#8a6a2a', '#4a6a2a'][i % 3]; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i); ctx.fillRect(-3, -2, 6, 4); ctx.restore(); }
  },
  _fireflies(ctx, cam, W, H, t) {
    for (let i = 0; i < 18; i++) { const x = (i * 97 + Math.sin(t * 0.7 + i) * 60) % W; const y = H * 0.4 + Math.sin(t + i * 2) * 80 + (i % 5) * 30; const a = 0.4 + 0.6 * Math.sin(t * 3 + i); ctx.fillStyle = `rgba(190,255,120,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
  },
  _embers(ctx, cam, W, H, t) {
    for (let i = 0; i < 36; i++) { const x = (i * 89 + Math.sin(t + i) * 30) % W; const y = (H - (i * 61 + t * 80) % (H + 40)); const a = 0.5 + 0.5 * Math.sin(t * 4 + i); ctx.fillStyle = `rgba(255,${120 + (i % 80)},40,${a})`; ctx.fillRect(x, y, 2, 2); }
  },
};

/* ============================================================
   sprites.js — frame-by-frame animated pixel actors (Broforce-style)
   The body is drawn part-by-part each frame (legs stride, torso bobs,
   arms swing) and baked into spritesheets: idle / run / jump / fall /
   hurt / death. The front arm + weapon is drawn LIVE so aiming works in
   360° and the shot recoils. Concept art is kept for the HUD portrait.
   ============================================================ */

const SPR = {
  ready: false, sheets: {}, defs: {},
  images: {}, whites: {}, imgLoading: false,
  ANIMS: { idle: 6, run: 8, jump: 1, fall: 1, hurt: 2, death: 6 },

  define(key, d) { this.defs[key] = d; },

  // ---- concept-art images (used for the HUD portrait) ----------
  loadImages() {
    if (this.imgLoading) return; this.imgLoading = true;
    for (const key in this.defs) { const img = new Image(); img.src = 'assets/' + key + '.png'; this.images[key] = img; }
  },
  hasImage(key) { const i = this.images[key]; return i && i.complete && i.naturalWidth > 0; },

  // ---- bake all spritesheets -----------------------------------
  build() {
    if (this.ready) return;
    for (const key in this.defs) {
      const d = this.defs[key]; this.sheets[key] = {};
      for (const a in this.ANIMS) {
        const n = this.ANIMS[a], frames = [];
        for (let f = 0; f < n; f++) frames.push(this._bake(d, a, f, n));
        this.sheets[key][a] = frames;
      }
    }
    this.ready = true;
  },

  _bake(d, anim, f, n) {
    const W = d.cw || 120, H = d.ch || 132, foot = H - 6;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.save(); g.translate(W / 2, foot);
    if (anim === 'death') { const t = f / (n - 1 || 1); g.rotate(-t * 1.45); g.translate(0, t * 6); }
    this._drawBody(g, d, this._pose(anim, f, n));
    g.restore();
    return this._outline(cv);   // crisp dark outline (pixel-art polish)
  },

  // wrap a baked frame with a 1px dark outline by stamping a black silhouette
  _outline(src) {
    const W = src.width, H = src.height;
    const sil = document.createElement('canvas'); sil.width = W; sil.height = H;
    const sc = sil.getContext('2d'); sc.drawImage(src, 0, 0);
    sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = '#0a0908'; sc.fillRect(0, 0, W, H);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const o = out.getContext('2d');
    const off = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of off) o.drawImage(sil, dx, dy);
    o.drawImage(src, 0, 0);
    return out;
  },

  _pose(anim, f, n) {
    const ph = (f / n) * TAU;
    const p = { anim, ph, legF: 0, legB: 0, bob: 0, lean: 0, arm: 0, crouch: 0, air: false };
    if (anim === 'run') {
      p.legF = ph; p.legB = ph + Math.PI;
      p.bob = -Math.abs(Math.sin(ph)) * 3; p.lean = 4; p.arm = Math.sin(ph) * 0.5;
    } else if (anim === 'idle') {
      p.legF = 0.12; p.legB = -0.12; p.bob = Math.sin(ph) * 1.2; p.arm = Math.sin(ph) * 0.08;
    } else if (anim === 'jump') {
      p.air = true; p.legF = 0.5; p.legB = -0.25; p.crouch = 5; p.lean = 3; p.arm = -0.4;
    } else if (anim === 'fall') {
      p.air = true; p.legF = -0.3; p.legB = 0.4; p.lean = -2; p.arm = -0.7;
    } else if (anim === 'hurt') {
      p.lean = -6 - f * 2; p.legF = -0.4; p.legB = 0.3; p.arm = -0.9;
    } else if (anim === 'death') {
      p.legF = 0.2; p.legB = -0.3; p.arm = -1.0; p.lean = -4;
    }
    return p;
  },

  // ---------- the body (rounded, shaded — Metal Slug-ish) ---------
  _drawBody(g, d, p) {
    const P = d.pal, s = d.scale || 1, bulk = d.bulk || 1;
    const bob = p.bob, lean = p.lean, crouch = p.crouch || 0;
    const hipY = -34 * s + crouch;
    const shY = -62 * s + crouch + bob;
    const headCy = -82 * s + crouch + bob, headR = 11 * s;
    g.lineJoin = 'round'; g.lineCap = 'round';
    // ground shadow
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.beginPath(); g.ellipse(0, -2 * s, 15 * s * bulk, 4 * s, 0, 0, TAU); g.fill();
    if (d.tail) this._tail(g, P, s, hipY, p);
    if (P.cape) this._cape(g, P, s, shY, hipY, lean, p);
    // legs (back first)
    this._leg(g, P, s, -6 * s * bulk, hipY, p.legB, true, p, d.digi);
    this._leg(g, P, s, 6 * s * bulk, hipY, p.legF, false, p, d.digi);
    // torso
    this._torso(g, d, P, s, lean, shY, hipY, bulk);
    // back arm
    this._arm(g, P, s, lean - 9 * s * bulk, shY + 5 * s, p.arm, true);
    // head
    this._head(g, d, lean * 1.05, headCy, headR);
  },

  _round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); },

  // tapered, round-ended limb segment with a soft highlight on the lit side
  _segLimb(g, x0, y0, x1, y1, w0, w1, base, hi) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.fillStyle = base;
    g.beginPath();
    g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); g.closePath(); g.fill();
    g.beginPath(); g.arc(x0, y0, w0 / 2, 0, TAU); g.fill(); g.beginPath(); g.arc(x1, y1, w1 / 2, 0, TAU); g.fill();
    if (hi) { g.strokeStyle = hi; g.lineWidth = Math.max(1, w1 * 0.4); g.beginPath(); g.moveTo(x0 + nx * w0 * 0.22 + 0.5, y0 + ny * w0 * 0.22); g.lineTo(x1 + nx * w1 * 0.22 + 0.5, y1 + ny * w1 * 0.22); g.stroke(); }
  },

  // tapered, rounded torso with clipped 3-tone shading and gear
  _torso(g, d, P, s, x, shY, hipY, bulk) {
    const cW = 22 * s * bulk, wW = 15 * s * bulk, midY = (shY + hipY) / 2;
    g.save();
    g.beginPath();
    g.moveTo(x - cW / 2, shY + 2 * s);
    g.quadraticCurveTo(x - cW / 2 - 2 * s, midY, x - wW / 2, hipY + 3 * s);
    g.quadraticCurveTo(x, hipY + 6 * s, x + wW / 2, hipY + 3 * s);
    g.quadraticCurveTo(x + cW / 2 + 2 * s, midY, x + cW / 2, shY + 2 * s);
    g.quadraticCurveTo(x, shY - 4 * s, x - cW / 2, shY + 2 * s);
    g.closePath(); g.fillStyle = P.torso; g.fill(); g.clip();
    g.fillStyle = P.torsoSh; g.beginPath(); g.ellipse(x - cW * 0.34, midY, cW * 0.45, (hipY - shY) * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = P.torsoHi; g.beginPath(); g.ellipse(x + cW * 0.14, shY + 9 * s, cW * 0.3, 8 * s, 0, 0, TAU); g.fill();
    if (P.plate) { g.fillStyle = P.plate; g.beginPath(); g.ellipse(x, shY + 10 * s, cW * 0.44, 9 * s, 0, 0, TAU); g.fill(); g.fillStyle = P.armorHi; g.beginPath(); g.ellipse(x, shY + 7 * s, cW * 0.3, 3 * s, 0, 0, TAU); g.fill(); }
    g.fillStyle = P.torsoSh; g.fillRect(x - 0.7 * s, shY + 4 * s, 1.4 * s, hipY - shY);
    g.fillStyle = P.belt || P.armorSh; g.fillRect(x - cW, hipY - 1 * s, cW * 2, 5 * s);
    if (P.buckle) { g.fillStyle = P.buckle; g.beginPath(); g.ellipse(x, hipY + 1.5 * s, 3 * s, 2.5 * s, 0, 0, TAU); g.fill(); }
    if (P.pendant) { g.fillStyle = P.pendant; g.beginPath(); g.ellipse(x, midY + 3 * s, 2.6 * s, 3.2 * s, 0, 0, TAU); g.fill(); }
    g.restore();
    // neck + pauldrons on top
    g.fillStyle = P.skinSh || P.torsoSh; g.fillRect(x - 3 * s, shY - 6 * s, 6 * s, 6 * s);
    if (P.pauldron) {
      g.fillStyle = P.pauldron;
      g.beginPath(); g.ellipse(x - cW / 2, shY + 1 * s, 6 * s, 5 * s, 0, 0, TAU); g.ellipse(x + cW / 2, shY + 1 * s, 6 * s, 5 * s, 0, 0, TAU); g.fill();
      g.fillStyle = P.armorHi; g.beginPath(); g.ellipse(x + cW / 2 - 1 * s, shY - 1 * s, 3 * s, 2 * s, 0, 0, TAU); g.fill();
    }
  },

  _leg(g, P, s, hx, hy, phase, back, p, digi) {
    const thighLen = 16 * s, shinLen = 15 * s;
    const wTop = 7.5 * s, wKnee = 6 * s, wAnk = 5 * s;
    let thighA, bend;
    if (p.air) { thighA = (back ? -1 : 1) * 0.35 + Math.sin(phase) * 0.1; bend = 0.55 + (back ? 0.25 : 0); }
    else if (p.anim === 'run') { thighA = Math.sin(phase) * 0.5; bend = 0.2 + Math.max(0, Math.cos(phase)) * 0.7; }
    else { thighA = phase; bend = 0.1; }
    const kx = hx + Math.sin(thighA) * thighLen, ky = hy + Math.cos(thighA) * thighLen;
    const shinA = thighA + (digi ? bend : -bend);    // digitigrade knee bends backward
    const ax = kx + Math.sin(shinA) * shinLen, ay = ky + Math.cos(shinA) * shinLen;
    const col = back ? (P.legSh || P.armorSh) : (P.leg || P.armor);
    this._segLimb(g, hx, hy, kx, ky, wTop, wKnee, col, back ? null : P.armorHi);
    this._segLimb(g, kx, ky, ax, ay, wKnee, wAnk, col, back ? null : P.armorHi);
    if (!digi && !back) { g.fillStyle = P.armorHi || col; g.beginPath(); g.arc(kx, ky, 2.6 * s, 0, TAU); g.fill(); }
    // foot
    if (digi) {
      g.fillStyle = P.foot || '#2a201a';
      g.beginPath(); g.moveTo(ax - 3 * s, ay - 1 * s); g.lineTo(ax + 9 * s, ay - 2 * s); g.lineTo(ax + 9 * s, ay + 2 * s); g.lineTo(ax - 3 * s, ay + 3 * s); g.closePath(); g.fill();
      g.fillStyle = P.claw || '#cabfa0'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ax + 7 * s + i * 1.4 * s, ay - 1 * s); g.lineTo(ax + 11 * s + i * 1.4 * s, ay - 3 * s); g.lineTo(ax + 10 * s + i * 1.4 * s, ay + 1 * s); g.fill(); }
    } else {
      g.fillStyle = P.boot || '#2a1c12';
      g.beginPath(); g.ellipse(ax + 1 * s, ay - 1 * s, 5.5 * s, 3.2 * s, 0, 0, TAU); g.fill();
      g.fillStyle = P.armorSh || '#1a120c'; g.fillRect(ax - 3.5 * s, ay - 4.5 * s, 5 * s, 4 * s);
    }
  },

  _arm(g, P, s, sx, sy, ang, back) {
    const upper = 11 * s, fore = 10 * s;
    const ex = sx + Math.sin(ang) * upper, ey = sy + Math.cos(ang) * upper;
    const hx = ex + Math.sin(ang * 0.55) * fore, hy = ey + Math.cos(ang * 0.55) * fore;
    const col = back ? (P.armSh || P.armorSh) : (P.arm || P.armor);
    this._segLimb(g, sx, sy, ex, ey, 6.5 * s, 5 * s, col, back ? null : P.armorHi);
    this._segLimb(g, ex, ey, hx, hy, 5 * s, 4 * s, col, back ? null : P.armorHi);
    g.fillStyle = P.glove || P.skin || col; g.beginPath(); g.arc(hx, hy, 3 * s, 0, TAU); g.fill();
  },

  _cape(g, P, s, shY, hipY, lean, p) {
    const sway = (p.anim === 'run' ? Math.sin(p.ph) * 4 : Math.sin((p.ph || 0) * 0.6) * 1.5) + (p.air ? -6 : 0);
    const bot = hipY + 24 * s;
    g.fillStyle = P.cape;
    g.beginPath(); g.moveTo(lean - 9 * s, shY - 1 * s);
    g.quadraticCurveTo(lean - 11 * s + sway * 0.5, (shY + bot) / 2, lean - 7 * s + sway, bot);
    g.quadraticCurveTo(lean + sway, bot + 4 * s, lean + 8 * s + sway, bot);
    g.quadraticCurveTo(lean + 11 * s + sway * 0.5, (shY + bot) / 2, lean + 9 * s, shY - 1 * s);
    g.closePath(); g.fill();
    g.fillStyle = P.capeSh; g.beginPath(); g.moveTo(lean, shY); g.quadraticCurveTo(lean - 3 * s + sway, (shY + bot) / 2, lean - 7 * s + sway, bot); g.quadraticCurveTo(lean + sway, bot + 4 * s, lean + 1 * s + sway, bot - 2 * s); g.closePath(); g.fill();
  },

  _tail(g, P, s, hipY, p) {
    const sway = (p.anim === 'run' ? Math.sin(p.ph) * 5 : Math.sin((p.ph || 0) * 0.7) * 2.5);
    const baseY = hipY + 8 * s;
    g.fillStyle = P.skin;
    g.beginPath(); g.moveTo(-6 * s, baseY - 3 * s);
    g.quadraticCurveTo(-26 * s, baseY + 2 * s + sway, -34 * s, baseY + 16 * s + sway);
    g.quadraticCurveTo(-30 * s, baseY + 10 * s + sway, -22 * s, baseY + 8 * s + sway * 0.5);
    g.quadraticCurveTo(-12 * s, baseY + 6 * s, -4 * s, baseY + 6 * s); g.closePath(); g.fill();
    g.fillStyle = P.skinSh; g.beginPath(); g.moveTo(-6 * s, baseY - 1 * s); g.quadraticCurveTo(-24 * s, baseY + 4 * s + sway, -33 * s, baseY + 15 * s + sway); g.quadraticCurveTo(-26 * s, baseY + 9 * s + sway, -16 * s, baseY + 8 * s); g.closePath(); g.fill();
  },

  _head(g, d, hx, cy, r) {
    const P = d.pal, s = d.scale || 1;
    const oval = (cx, cyy, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cyy, rx, ry, 0, 0, TAU); g.fill(); };
    switch (d.head) {
      case 'human': {
        oval(hx, cy, r * 0.92, r * 1.04, P.skin);                       // head
        oval(hx - r * 0.42, cy + r * 0.1, r * 0.5, r * 0.9, P.skinSh);  // back/jaw shadow
        g.fillStyle = P.hair; g.beginPath(); g.ellipse(hx, cy - r * 0.42, r * 1.02, r * 0.8, 0, Math.PI, TAU); g.fill();  // hair top
        g.beginPath(); g.moveTo(hx - r, cy - r * 0.5); g.quadraticCurveTo(hx - r * 1.1, cy + r * 0.4, hx - r * 0.6, cy + r * 0.6); g.lineTo(hx - r * 0.5, cy - r * 0.3); g.fill(); // sideburn
        oval(hx, cy + r * 0.62, r * 0.78, r * 0.55, P.hair);            // beard
        oval(hx + r * 0.28, cy + r * 0.06, r * 0.55, r * 0.58, P.skin); // face
        g.fillStyle = '#241c14'; g.beginPath(); g.arc(hx + r * 0.38, cy - r * 0.02, 1.5 * s, 0, TAU); g.fill();  // eye
        g.fillStyle = P.skinSh; g.fillRect(hx + r * 0.72, cy + r * 0.05, 1.2 * s, 2.5 * s); break;               // nose
      }
      case 'lizard': case 'dragon': {
        for (let i = 0; i < 4; i++) { g.fillStyle = P.crest || P.skinSh; g.beginPath(); g.moveTo(hx - r * 0.7 + i * 4 * s, cy - r * 0.7); g.lineTo(hx - r * 0.5 + i * 4 * s, cy - r * 1.3 - (i % 2) * 2 * s); g.lineTo(hx - r * 0.3 + i * 4 * s, cy - r * 0.7); g.fill(); }
        oval(hx - r * 0.1, cy, r * 0.85, r * 0.85, P.skin);            // skull
        g.fillStyle = P.skin; g.beginPath(); g.ellipse(hx + r * 0.7, cy + r * 0.28, r * 0.78, r * 0.42, -0.15, 0, TAU); g.fill();  // snout
        oval(hx - r * 0.4, cy + r * 0.05, r * 0.42, r * 0.7, P.skinSh);
        oval(hx - r * 0.05, cy - r * 0.42, r * 0.4, r * 0.28, P.skinHi || P.skin);
        g.fillStyle = P.skinSh; g.beginPath(); g.ellipse(hx + r * 0.85, cy + r * 0.6, r * 0.5, r * 0.16, 0, 0, TAU); g.fill();  // jawline
        g.fillStyle = P.eye || '#e8c84a'; g.beginPath(); g.ellipse(hx + r * 0.42, cy - r * 0.15, 2 * s, 2.6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a140e'; g.fillRect(hx + r * 0.42 - 0.6 * s, cy - r * 0.45, 1.2 * s, 3.2 * s);
        if (d.head === 'dragon') { g.strokeStyle = P.horn || '#2a2018'; g.lineWidth = 3 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx - r * 0.3, cy - r * 0.8); g.quadraticCurveTo(hx - r * 1.1, cy - r * 1.4, hx - r * 1.5, cy - r * 0.9); g.stroke(); }
        break;
      }
      case 'demon': {
        g.fillStyle = P.horn || '#241a14'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(hx - r * 0.6, cy - r * 0.6); g.quadraticCurveTo(hx - r * 1.4, cy - r * 1.4, hx - r * 1.2, cy - r * 2.1); g.lineTo(hx - r * 0.7, cy - r * 1.1); g.fill();
        g.beginPath(); g.moveTo(hx + r * 0.6, cy - r * 0.6); g.quadraticCurveTo(hx + r * 1.4, cy - r * 1.4, hx + r * 1.2, cy - r * 2.1); g.lineTo(hx + r * 0.7, cy - r * 1.1); g.fill();
        oval(hx, cy, r * 0.92, r, P.skin); oval(hx - r * 0.4, cy + r * 0.1, r * 0.5, r * 0.85, P.skinSh);
        oval(hx + r * 0.15, cy - r * 0.3, r * 0.45, r * 0.35, P.skinHi || P.skin);
        g.fillStyle = '#ffcc44'; g.beginPath(); g.ellipse(hx + r * 0.1, cy - r * 0.05, r * 0.5, 2.2 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#15110e'; g.beginPath(); g.ellipse(hx - r * 0.05, cy + r * 0.55, r * 0.6, r * 0.22, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e0cf'; for (let i = -2; i <= 2; i++) g.fillRect(hx + i * 2.2 * s, cy + r * 0.5, 1.2 * s, 2 * s); break;  // teeth
      }
      case 'wolf': {
        g.fillStyle = P.skin; g.beginPath(); g.moveTo(hx - r * 0.7, cy - r * 0.3); g.lineTo(hx - r * 1.1, cy - r * 1.4); g.lineTo(hx - r * 0.2, cy - r * 0.7); g.fill();
        g.beginPath(); g.moveTo(hx + r * 0.7, cy - r * 0.3); g.lineTo(hx + r * 1.1, cy - r * 1.4); g.lineTo(hx + r * 0.2, cy - r * 0.7); g.fill();
        oval(hx, cy, r * 0.85, r * 0.9, P.skin); oval(hx - r * 0.4, cy + r * 0.1, r * 0.45, r * 0.75, P.skinSh);
        g.fillStyle = P.skin; g.beginPath(); g.ellipse(hx + r * 0.7, cy + r * 0.3, r * 0.7, r * 0.4, -0.1, 0, TAU); g.fill();   // snout
        g.fillStyle = '#1a1410'; g.beginPath(); g.arc(hx + r * 1.25, cy + r * 0.2, 2 * s, 0, TAU); g.fill();
        g.fillStyle = P.eye || '#f0e050'; g.beginPath(); g.ellipse(hx + r * 0.3, cy - r * 0.1, 2 * s, 1.6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e0cf'; g.fillRect(hx + r * 0.5, cy + r * 0.55, r * 0.6, 1.2 * s); break;
      }
      case 'zombie': {
        if (P.hood) { g.fillStyle = P.hood; g.beginPath(); g.ellipse(hx, cy - r * 0.2, r * 1.15, r * 1.1, 0, Math.PI * 0.95, TAU * 1.05); g.fill(); }
        oval(hx, cy, r * 0.86, r, P.skin); oval(hx - r * 0.4, cy + r * 0.15, r * 0.5, r * 0.8, P.skinSh);
        oval(hx + r * 0.2, cy - r * 0.25, r * 0.4, r * 0.3, P.skinHi || P.skin);
        g.fillStyle = '#120e0a'; g.beginPath(); g.arc(hx + r * 0.05, cy - r * 0.05, 2 * s, 0, TAU); g.arc(hx + r * 0.6, cy - r * 0.05, 1.6 * s, 0, TAU); g.fill();  // sunken eyes
        g.fillStyle = '#e8e0cf'; g.fillRect(hx - r * 0.3, cy + r * 0.55, r * 0.9, 1.4 * s); g.fillStyle = '#5a2a2a'; g.fillRect(hx - r * 0.7, cy + r * 0.2, 2 * s, 4 * s); break;
      }
      case 'flayer': {
        oval(hx, cy - r * 0.2, r * 0.95, r * 1.05, P.skin);            // domed head
        oval(hx - r * 0.35, cy - r * 0.1, r * 0.5, r * 0.85, P.skinSh);
        oval(hx + r * 0.1, cy - r * 0.7, r * 0.45, r * 0.4, P.skinHi || P.skin);
        g.fillStyle = '#e8e0f0'; g.beginPath(); g.arc(hx - r * 0.3, cy - r * 0.1, 1.6 * s, 0, TAU); g.arc(hx + r * 0.4, cy - r * 0.1, 1.6 * s, 0, TAU); g.fill();
        g.fillStyle = P.tentacle || P.skinSh; for (let i = -2; i <= 2; i++) { const tx = hx + i * 3.2 * s; g.beginPath(); g.moveTo(tx, cy + r * 0.3); g.quadraticCurveTo(tx + i * 1.5, cy + r * 1.0, tx + i * 3, cy + r * 1.6); g.quadraticCurveTo(tx + i, cy + r * 0.9, tx + 1.5 * s, cy + r * 0.4); g.fill(); } break;
      }
    }
  },

  // ---- live front arm + weapon, rotated toward aim --------------
  drawWeaponArm(ctx, d, sx, sy, aim, recoil, mode) {
    const P = d.pal, s = d.scale || 1;
    const wpn = mode === 'sword' ? 'sword' : d.weapon;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(aim); ctx.translate(-(recoil || 0), 0);
    ctx.fillStyle = P.arm || P.armor; ctx.fillRect(-2 * s, -2.5 * s, 9 * s, 5 * s);
    if (P.glove) { ctx.fillStyle = P.glove; ctx.fillRect(6 * s, -2.5 * s, 4 * s, 5 * s); }
    this._weapon(ctx, wpn, P, s);
    ctx.restore();
  },

  _weapon(ctx, wpn, P, s) {
    const M = P.metal || '#3a3e44', Md = P.metalSh || '#20242a', Wd = P.wood || '#6a4424';
    switch (wpn) {
      case 'shotgun':
        ctx.fillStyle = Wd; ctx.fillRect(2 * s, -2 * s, 9 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(10 * s, -3 * s, 18 * s, 5 * s);
        ctx.fillStyle = Md; ctx.fillRect(10 * s, 0, 18 * s, 2 * s); ctx.fillRect(24 * s, -3 * s, 4 * s, 5 * s);
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(27 * s, -2 * s, 2 * s, 4 * s); break;
      case 'rifle':
        ctx.fillStyle = Wd; ctx.fillRect(2 * s, -2 * s, 7 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(8 * s, -2 * s, 24 * s, 3.5 * s); ctx.fillStyle = Md; ctx.fillRect(8 * s, 1 * s, 24 * s, 1.5 * s); break;
      case 'musket':
        ctx.fillStyle = Wd; ctx.fillRect(1 * s, -2.5 * s, 12 * s, 5 * s); ctx.fillStyle = '#caa33a'; ctx.fillRect(12 * s, -2 * s, 4 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(15 * s, -2 * s, 12 * s, 4 * s); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(25 * s, -2.5 * s, 3 * s, 5 * s); break;
      case 'cannon':
        ctx.fillStyle = Md; ctx.fillRect(0, -4 * s, 12 * s, 8 * s); ctx.fillStyle = M; ctx.fillRect(10 * s, -5 * s, 16 * s, 10 * s);
        ctx.fillStyle = '#0c0a08'; ctx.fillRect(24 * s, -3.5 * s, 4 * s, 7 * s); ctx.fillStyle = Md; ctx.fillRect(10 * s, 3 * s, 16 * s, 2 * s); break;
      case 'smg':
        ctx.fillStyle = Md; ctx.fillRect(2 * s, -2 * s, 6 * s, 4 * s); ctx.fillStyle = M; ctx.fillRect(7 * s, -2 * s, 16 * s, 3 * s); ctx.fillRect(9 * s, 2 * s, 4 * s, 5 * s); break;
      case 'bow':
        ctx.strokeStyle = P.wood || '#7a5a2a'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.arc(4 * s, 0, 13 * s, -1.25, 1.25); ctx.stroke();
        ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4 * s + Math.cos(-1.25) * 13 * s, Math.sin(-1.25) * 13 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(4 * s + Math.cos(1.25) * 13 * s, Math.sin(1.25) * 13 * s); ctx.stroke();
        ctx.strokeStyle = '#caa45a'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(20 * s, 0); ctx.lineTo(6 * s, 0); ctx.stroke();
        ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.moveTo(22 * s, 0); ctx.lineTo(17 * s, -2.5 * s); ctx.lineTo(17 * s, 2.5 * s); ctx.fill(); break;
      case 'staff':
        ctx.fillStyle = Wd; ctx.fillRect(-2 * s, -1.5 * s, 26 * s, 3 * s); ctx.fillStyle = P.orb || '#b07bff'; ctx.shadowColor = P.orb || '#b07bff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(25 * s, 0, 4.5 * s, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; break;
      case 'sword':
        ctx.fillStyle = '#5a4326'; ctx.fillRect(0, -2 * s, 5 * s, 4 * s); ctx.fillStyle = '#caa33a'; ctx.fillRect(5 * s, -4 * s, 2.5 * s, 8 * s);
        ctx.fillStyle = '#dfe3e8'; ctx.fillRect(7 * s, -2 * s, 22 * s, 4 * s); ctx.beginPath(); ctx.moveTo(29 * s, -2 * s); ctx.lineTo(34 * s, 0); ctx.lineTo(29 * s, 2 * s); ctx.fill();
        ctx.fillStyle = '#9aa6b2'; ctx.fillRect(7 * s, -2 * s, 22 * s, 1.5 * s); break;
    }
  },

  // chest/hands anchor where the weapon is held (world coords, no camera)
  gunAnchor(e) {
    const d = this.defs[e.spr];
    if (!d) return { x: e.cx, y: e.y + e.h * 0.32 };
    const H = d.ch || 132, scale = e.h * (d.artK || 1.7) / H, s = d.scale || 1;
    return { x: e.cx + (e.face || 1) * 5 * s * scale, y: (e.y + e.h) - 56 * s * scale };
  },

  // ---- public draw ---------------------------------------------
  draw(ctx, e, cam) {
    if (!this.ready) this.build();
    const d = this.defs[e.spr]; if (!d) return;
    const W = d.cw || 120, H = d.ch || 132;
    const dh = e.h * (d.artK || 1.7), scale = dh / H, dw = W * scale;
    const cx = e.cx + cam.ox, baseY = e.y + e.h + cam.oy;
    // pick animation
    let anim = 'idle';
    const dying = (e.dying != null && e.dying > 0) || e.dead;
    if (dying) anim = 'death';
    else if (e.flash > 0.04 && e.onGround && Math.abs(e.vx) < 30) anim = 'hurt';
    else if (!e.onGround) anim = (e.vy < -40 ? 'jump' : 'fall');
    else if (Math.abs(e.vx) > 24) anim = 'run';
    const frames = this.sheets[e.spr][anim] || this.sheets[e.spr].idle;
    let fi;
    if (anim === 'death') { const dt = e.dying != null ? (1 - clamp(e.dying / (e.dyingMax || 0.6), 0, 1)) : clamp((1 - (e.deathT || 0)), 0, 1); fi = Math.min(frames.length - 1, Math.floor(dt * frames.length)); }
    else if (anim === 'run') { fi = Math.floor((e.runDist || 0) / (d.stride || 22)) % frames.length; }   // foot-locked: legs match ground speed
    else { const fps = anim === 'idle' ? 3.5 : 1; fi = Math.floor((e.anim || 0) * fps) % frames.length; }

    const face = e.face < 0 ? -1 : 1;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, baseY); ctx.scale(face * scale, scale);
    ctx.drawImage(frames[fi], -W / 2, -(H - 6));
    ctx.restore();

    // live weapon arm at the chest/hands anchor (not while dying)
    if (d.weapon && e.aimAng != null && anim !== 'death') {
      const ga = this.gunAnchor(e);
      const recoil = (e.cool && e.coolMax) ? (e.cool / e.coolMax) * 4 : 0;
      const mode = (e.dashT > 0 || e.swordMode) ? 'sword' : null;
      ctx.save(); ctx.translate(ga.x + cam.ox, ga.y + cam.oy); ctx.scale(scale, scale);
      this.drawWeaponArm(ctx, d, 0, 0, e.aimAng, recoil, mode);
      ctx.restore();
    }
  },
};

/* ================= CHARACTER DEFINITIONS ===================== */
SPR.define('ragnarok', {
  head: 'human', weapon: 'shotgun', artK: 1.7,
  pal: { skin: '#d8a273', skinSh: '#b07c50', hair: '#5a3a22',
    torso: '#aab2be', torsoHi: '#dde3ec', torsoSh: '#6a727e', armor: '#aab2be', armorHi: '#e2e8f0', armorSh: '#6a727e',
    leg: '#9aa2ae', legSh: '#727a86', arm: '#aab2be', pauldron: '#cdd4de', plate: '#cdd4de',
    glove: '#5a4a32', boot: '#3a2a18', belt: '#5a4127', buckle: '#caa33a', cape: '#7a2222', capeSh: '#561414',
    metal: '#3a3e44', metalSh: '#20242a', wood: '#6a4424' },
});
SPR.define('zracks', {
  head: 'lizard', weapon: 'bow', digi: true, tail: true, artK: 1.7,
  pal: { skin: '#5f8038', skinSh: '#3e5a26', skinHi: '#7d9e4e', crest: '#3e5a26', eye: '#e8c84a',
    torso: '#4a3a24', torsoHi: '#6a5230', torsoSh: '#2e2414', armor: '#4a3a24', armorHi: '#6a5230', armorSh: '#2e2414',
    leg: '#4f6a30', legSh: '#34491f', arm: '#5f8038', foot: '#3e5a26', claw: '#cabfa0',
    belt: '#3a2c18', pendant: '#d8d0b8', wood: '#5a3a1a' },
});
SPR.define('zombie', {
  head: 'zombie', weapon: 'musket', artK: 1.66,
  pal: { skin: '#6f9450', skinSh: '#466030', skinHi: '#88a464', hood: '#3a2e1e',
    torso: '#4a3a26', torsoHi: '#5e4a30', torsoSh: '#2e2416', armor: '#6a5a44', armorHi: '#7e6c52', armorSh: '#46382a',
    leg: '#3a4a28', legSh: '#26331a', arm: '#6f9450', boot: '#3a2a18', belt: '#4a3318',
    metal: '#4a4438', metalSh: '#2a261e', wood: '#5a3a1e' },
});
SPR.define('werewolf', {
  head: 'wolf', weapon: 'smg', digi: true, tail: true, artK: 1.66,
  pal: { skin: '#4a3e30', skinSh: '#2a2018', skinHi: '#6a5a48', eye: '#f0e050',
    torso: '#3a2e22', torsoHi: '#4e4030', torsoSh: '#221a12', armor: '#4a3a28', armorHi: '#5e4c36', armorSh: '#2a2014',
    leg: '#3a3026', legSh: '#221a12', arm: '#4a3e30', foot: '#1a1410', claw: '#e8e0cf', belt: '#3a2a18',
    metal: '#2a2a2e', metalSh: '#16161a' },
});
SPR.define('dragonman', {
  head: 'dragon', weapon: 'rifle', digi: true, tail: true, scale: 1.12, cw: 142, ch: 150, artK: 1.66,
  pal: { skin: '#9a2218', skinSh: '#5a1410', skinHi: '#c23828', crest: '#5a1410', horn: '#2a2018', eye: '#e8c84a',
    torso: '#4a4438', torsoHi: '#5e5648', torsoSh: '#2e2a22', armor: '#4a4438', armorHi: '#6a6252', armorSh: '#2a261e', pauldron: '#6a6252',
    leg: '#7a1c14', legSh: '#4a1410', arm: '#9a2218', foot: '#3a1410', claw: '#cabfa0', belt: '#3a2c1a', pendant: '#cabfa0',
    metal: '#4a4e54', metalSh: '#2a2e34', wood: '#5a4424' },
});
SPR.define('demon', {
  head: 'demon', weapon: 'cannon', scale: 1.25, bulk: 1.15, cw: 168, ch: 176, artK: 1.6,
  pal: { skin: '#7a2a22', skinSh: '#4a1410', skinHi: '#9a3a2e', horn: '#241a14',
    torso: '#3a3030', torsoHi: '#4e4242', torsoSh: '#1e1a18', armor: '#3a3030', armorHi: '#564a4a', armorSh: '#1e1a18', pauldron: '#564a4a', plate: '#4a3a2a',
    leg: '#3a2e2a', legSh: '#1e1814', arm: '#7a2a22', boot: '#2a1c14', belt: '#4a1410', pendant: '#cabfa0',
    metal: '#3a2e2a', metalSh: '#1e1814' },
});
SPR.define('flayer', {
  head: 'flayer', weapon: 'staff', scale: 1.7, bulk: 1.1, cw: 230, ch: 246, artK: 1.5,
  pal: { skin: '#6a4a8a', skinSh: '#3e2a5a', skinHi: '#8a6ab0', tentacle: '#5a3a7a',
    torso: '#2a2040', torsoHi: '#3e3060', torsoSh: '#170f28', armor: '#2a2040', armorHi: '#3e3060', armorSh: '#170f28', pendant: '#caa33a',
    leg: '#3a2e54', legSh: '#1e1430', arm: '#6a4a8a', foot: '#241a3a', claw: '#caa07a',
    cape: '#2a1040', capeSh: '#170824', belt: '#3a2c5a', orb: '#b07bff', wood: '#3a2c1a' },
});

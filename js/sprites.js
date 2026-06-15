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
    const W = d.cw || 84, H = d.ch || 92, foot = H - 6;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.save(); g.translate(W / 2, foot);
    if (anim === 'death') { const t = f / (n - 1 || 1); g.rotate(-t * 1.45); g.translate(0, t * 6); }
    this._drawBody(g, d, this._pose(anim, f, n));
    g.restore();
    return cv;
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

  // ---------- the body --------------------------------------------
  _drawBody(g, d, p) {
    const P = d.pal, s = d.scale || 1;
    const hipY = -30 * s + p.crouch, shY = -56 * s + p.crouch + p.bob, headCy = -70 * s + p.crouch + p.bob, headR = 8.5 * s;
    const lean = p.lean;

    // shadow
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, -1, 13 * s, 3.5, 0, 0, TAU); g.fill();
    // tail (behind)
    if (d.tail) this._tail(g, P, s, hipY, p);
    // cape (behind)
    if (P.cape) this._cape(g, P, s, shY, hipY, lean, p);

    // ---- legs (stride) ----
    this._leg(g, P, s, -5 * s, hipY, p.legB, true, p, d.digi);
    this._leg(g, P, s, 5 * s, hipY, p.legF, false, p, d.digi);

    // ---- torso ----
    const tw = 16 * s * (d.bulk || 1);
    g.fillStyle = P.torso;
    this._round(g, lean - tw / 2, shY, tw, hipY - shY + 6, 3 * s);
    g.fillStyle = P.torsoSh; g.fillRect(lean - tw / 2, shY, 3 * s, hipY - shY + 4); // side shade
    g.fillStyle = P.torsoHi; g.fillRect(lean - tw / 2 + 3 * s, shY, 2 * s, hipY - shY); // hilite
    if (P.plate) { g.fillStyle = P.plate; g.fillRect(lean - tw / 2 + 2, shY + 2, tw - 4, 5 * s); }
    g.fillStyle = P.belt || P.armorSh; g.fillRect(lean - tw / 2, hipY - 4 * s, tw, 3 * s);
    if (P.buckle) { g.fillStyle = P.buckle; g.fillRect(lean - 2 * s, hipY - 4 * s, 4 * s, 3 * s); }
    if (P.pendant) { g.fillStyle = P.pendant; g.fillRect(lean - 2 * s, shY + (hipY - shY) * 0.4, 4 * s, 4 * s); }
    // pauldrons
    if (P.pauldron) { g.fillStyle = P.pauldron; g.fillRect(lean - tw / 2 - 2 * s, shY, 5 * s, 6 * s); g.fillRect(lean + tw / 2 - 3 * s, shY, 5 * s, 6 * s); }

    // ---- back arm (swings) ----
    this._arm(g, P, s, lean - tw / 2 + 1 * s, shY + 3 * s, p.arm, true);

    // ---- head ----
    this._head(g, d, lean * 1.1, headCy, headR);
  },

  _round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); },

  _limb(g, x0, y0, x1, y1, w, base, hi) {
    g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = base;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = Math.max(1, w - 2.5); g.strokeStyle = hi;
    g.beginPath(); g.moveTo(x0 + 0.6, y0 - 0.6); g.lineTo(x1 + 0.6, y1 - 0.6); g.stroke();
  },

  _leg(g, P, s, hx, hy, phase, back, p, digi) {
    const thighLen = 12 * s, shinLen = 12 * s, w = 6 * s;
    let thighA, bend;
    if (p.air) { thighA = phase; bend = 0.6 + (back ? 0.3 : 0); }
    else if (p.anim === 'run') { thighA = Math.sin(phase) * 0.6; bend = 0.25 + Math.max(0, Math.cos(phase)) * 0.8; }
    else { thighA = phase; bend = 0.12; }
    const kx = hx + Math.sin(thighA) * thighLen, ky = hy + Math.cos(thighA) * thighLen;
    const shinA = thighA - bend;
    const ax = kx + Math.sin(shinA) * shinLen, ay = ky + Math.cos(shinA) * shinLen;
    const col = back ? (P.legSh || P.armorSh) : (P.leg || P.armor);
    this._limb(g, hx, hy, kx, ky, w, col, P.armorHi);
    this._limb(g, kx, ky, ax, ay, w - 1, col, P.armorHi);
    // foot / boot / claw
    if (digi) { g.fillStyle = P.foot || '#2a201a'; g.fillRect(ax - 2 * s, ay - 3 * s, 8 * s, 3 * s); g.fillStyle = P.claw || '#cabfa0'; g.fillRect(ax + 5 * s, ay - 3 * s, 2 * s, 2 * s); }
    else { g.fillStyle = P.boot || '#2a1c12'; g.fillRect(ax - 3 * s, ay - 4 * s, 8 * s, 4 * s); }
  },

  _arm(g, P, s, sx, sy, ang, back) {
    const upper = 8 * s, fore = 8 * s, w = 5 * s;
    const ex = sx + Math.sin(ang) * upper, ey = sy + Math.cos(ang) * upper;
    const hx = ex + Math.sin(ang * 0.5) * fore, hy = ey + Math.cos(ang * 0.5) * fore;
    const col = back ? (P.armSh || P.armorSh) : (P.arm || P.armor);
    this._limb(g, sx, sy, ex, ey, w, col, P.armorHi);
    this._limb(g, ex, ey, hx, hy, w - 1, col, P.armorHi);
    if (P.glove) { g.fillStyle = P.glove; g.fillRect(hx - 2 * s, hy - 2 * s, 4 * s, 4 * s); }
  },

  _cape(g, P, s, shY, hipY, lean, p) {
    const sway = (p.anim === 'run' ? Math.sin(p.ph) * 3 : 0) + (p.air ? -5 : 0);
    g.fillStyle = P.cape;
    g.beginPath(); g.moveTo(lean - 8 * s, shY); g.lineTo(lean + 8 * s, shY);
    g.lineTo(lean + 6 * s + sway, hipY + 18 * s); g.lineTo(lean + sway, hipY + 22 * s); g.lineTo(lean - 6 * s + sway, hipY + 18 * s); g.closePath(); g.fill();
    g.fillStyle = P.capeSh; g.beginPath(); g.moveTo(lean, shY); g.lineTo(lean + 6 * s + sway, hipY + 18 * s); g.lineTo(lean + sway, hipY + 22 * s); g.closePath(); g.fill();
  },

  _tail(g, P, s, hipY, p) {
    const sway = (p.anim === 'run' ? Math.sin(p.ph) * 4 : Math.sin((p.ph || 0)) * 2);
    g.fillStyle = P.skin;
    g.beginPath(); g.moveTo(-5 * s, hipY + 4 * s); g.quadraticCurveTo(-20 * s, hipY + 6 * s + sway, -26 * s, hipY + 16 * s + sway);
    g.quadraticCurveTo(-16 * s, hipY + 10 * s + sway, -4 * s, hipY + 9 * s); g.closePath(); g.fill();
    g.fillStyle = P.skinSh; g.fillRect(-26 * s, hipY + 15 * s + sway, 3 * s, 3 * s);
  },

  _head(g, d, lean, cy, r) {
    const P = d.pal, s = d.scale || 1, hx = lean;
    g.lineCap = 'butt';
    switch (d.head) {
      case 'human':
        g.fillStyle = P.skin; g.fillRect(hx - r + 1, cy - r + 1, r * 2 - 2, r * 2); g.fillStyle = P.skinSh; g.fillRect(hx - r + 1, cy - r + 1, 2, r * 2);
        g.fillStyle = P.hair; g.fillRect(hx - r, cy - r - 1, r * 2, r - 1); g.fillRect(hx - r, cy - 1, 2, r + 2); g.fillRect(hx + r - 2, cy - 1, 2, r + 2);
        g.fillRect(hx - r + 2, cy + r - 2, r * 2 - 4, 4 * s); // beard
        g.fillStyle = '#241c14'; g.fillRect(hx + 1, cy - 1, 2, 2); break;
      case 'lizard': case 'dragon':
        g.fillStyle = P.skin; g.fillRect(hx - r + 1, cy - r + 2, r * 2 - 2, r * 2 - 2); g.fillStyle = P.skinSh; g.fillRect(hx - r + 1, cy - r + 2, 2, r * 2 - 2);
        g.fillStyle = P.skinHi; g.fillRect(hx - r + 2, cy - r + 1, r * 2 - 3, 2);
        g.fillStyle = P.skin; g.fillRect(hx + r - 2, cy - 2, r + 2, 5 * s); // snout
        g.fillStyle = P.crest || P.skinSh; for (let i = 0; i < 3; i++) g.fillRect(hx - r + 1 + i * 3 * s, cy - r - 1 - (i % 2), 2, 3 * s);
        g.fillStyle = P.eye || '#e8c84a'; g.fillRect(hx + r - 3, cy - 1, 2, 2);
        if (d.head === 'dragon') { g.fillStyle = P.horn || '#2a2018'; g.fillRect(hx - r - 1, cy - r - 3, 2, 5 * s); g.fillRect(hx - r + 2, cy - r - 4, 2, 5 * s); } break;
      case 'demon':
        g.fillStyle = P.skin; g.fillRect(hx - r + 1, cy - r + 2, r * 2 - 2, r * 2 - 2); g.fillStyle = P.skinSh; g.fillRect(hx - r + 1, cy - r + 2, 2, r * 2 - 2);
        g.fillStyle = '#ffcc44'; g.fillRect(hx - 1, cy - 1, 4, 3);
        g.fillStyle = P.skinSh; g.fillRect(hx - r + 2, cy + r - 3, r * 2 - 4, 3 * s);
        g.fillStyle = P.horn || '#241a14';
        g.beginPath(); g.moveTo(hx - r, cy - r + 1); g.quadraticCurveTo(hx - r - 6 * s, cy - r - 8 * s, hx - r - 1, cy - r - 12 * s); g.lineTo(hx - r + 3, cy - r - 4); g.fill();
        g.beginPath(); g.moveTo(hx + r, cy - r + 1); g.quadraticCurveTo(hx + r + 6 * s, cy - r - 8 * s, hx + r + 1, cy - r - 12 * s); g.lineTo(hx + r - 3, cy - r - 4); g.fill(); break;
      case 'wolf':
        g.fillStyle = P.skin; g.fillRect(hx - r + 1, cy - r + 2, r * 2 - 2, r * 2 - 2);
        g.beginPath(); g.moveTo(hx - r + 1, cy - r + 1); g.lineTo(hx - r - 2, cy - r - 5 * s); g.lineTo(hx - r + 5, cy - r + 1); g.fill();
        g.beginPath(); g.moveTo(hx + r - 1, cy - r + 1); g.lineTo(hx + r + 2, cy - r - 5 * s); g.lineTo(hx + r - 5, cy - r + 1); g.fill();
        g.fillRect(hx + r - 3, cy - 1, r + 2, 4 * s); g.fillStyle = '#1a1410'; g.fillRect(hx + r + r - 3, cy, 2, 2);
        g.fillStyle = P.eye || '#f0e050'; g.fillRect(hx + 1, cy - 2, 2, 2); g.fillStyle = '#e8e0cf'; g.fillRect(hx + r - 1, cy + 3 * s, r, 1); break;
      case 'zombie':
        if (P.hood) { g.fillStyle = P.hood; g.fillRect(hx - r - 1, cy - r - 1, r * 2 + 2, r + 3); }
        g.fillStyle = P.skin; g.fillRect(hx - r + 1, cy - r + 2, r * 2 - 2, r * 2 - 2); g.fillStyle = P.skinSh; g.fillRect(hx - r + 1, cy - r + 2, 2, r * 2 - 2);
        g.fillStyle = '#1a1410'; g.fillRect(hx, cy - 1, 2, 2); g.fillRect(hx + r - 3, cy - 1, 2, 2);
        g.fillStyle = '#e8e0cf'; g.fillRect(hx - r + 2, cy + r - 3, r * 2 - 4, 2); g.fillStyle = '#5a2a2a'; g.fillRect(hx - r, cy + 2, 2, 4 * s); break;
      case 'flayer':
        g.fillStyle = P.skin; g.fillRect(hx - r, cy - r - 2, r * 2, r + 2); g.fillStyle = P.skinHi; g.fillRect(hx - r, cy - r - 2, r * 2, 2);
        g.fillRect(hx - r + 1, cy - r, r * 2 - 2, r);
        g.fillStyle = '#e8e0f0'; g.fillRect(hx - r + 2, cy - 2, 3, 2); g.fillRect(hx + r - 4, cy - 2, 3, 2);
        g.fillStyle = P.tentacle || P.skinSh; for (let i = -2; i <= 2; i++) { g.beginPath(); const tx = hx + i * 3 * s; g.moveTo(tx, cy + 1); g.quadraticCurveTo(tx + i, cy + 8 * s, tx + i * 2, cy + 12 * s); g.lineTo(tx + 2, cy + 2); g.fill(); } break;
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

  // ---- public draw ---------------------------------------------
  draw(ctx, e, cam) {
    if (!this.ready) this.build();
    const d = this.defs[e.spr]; if (!d) return;
    const W = d.cw || 84, H = d.ch || 92;
    const dh = e.h * (d.artK || 1.5), scale = dh / H, dw = W * scale;
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
    else { const fps = anim === 'run' ? 14 : (anim === 'idle' ? 6 : 1); fi = Math.floor((e.anim || 0) * fps) % frames.length; }

    const face = e.face < 0 ? -1 : 1;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, baseY); ctx.scale(face * scale, scale);
    ctx.drawImage(frames[fi], -W / 2, -(H - 6));
    ctx.restore();

    // live weapon arm (not while dying / hurt-recoiling)
    if (d.weapon && e.aimAng != null && anim !== 'death') {
      const sx = e.cx + cam.ox, sy = e.y + e.h * 0.40 + cam.oy;
      const recoil = (e.cool && e.coolMax) ? (e.cool / e.coolMax) * 4 * scale : 0;
      const mode = (e.dashT > 0 || e.swordMode) ? 'sword' : null;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(scale, scale);
      this.drawWeaponArm(ctx, d, 0, 0, e.aimAng, recoil / scale, mode);
      ctx.restore();
    }
  },
};

/* ================= CHARACTER DEFINITIONS ===================== */
SPR.define('ragnarok', {
  head: 'human', weapon: 'shotgun', artK: 1.55,
  pal: { skin: '#d8a273', skinSh: '#b07c50', hair: '#5a3a22',
    torso: '#aab2be', torsoHi: '#dde3ec', torsoSh: '#6a727e', armor: '#aab2be', armorHi: '#e2e8f0', armorSh: '#6a727e',
    leg: '#9aa2ae', legSh: '#727a86', arm: '#aab2be', pauldron: '#cdd4de', plate: '#cdd4de',
    glove: '#5a4a32', boot: '#3a2a18', belt: '#5a4127', buckle: '#caa33a', cape: '#7a2222', capeSh: '#561414',
    metal: '#3a3e44', metalSh: '#20242a', wood: '#6a4424' },
});
SPR.define('zracks', {
  head: 'lizard', weapon: 'bow', digi: true, tail: true, artK: 1.55,
  pal: { skin: '#5f8038', skinSh: '#3e5a26', skinHi: '#7d9e4e', crest: '#3e5a26', eye: '#e8c84a',
    torso: '#4a3a24', torsoHi: '#6a5230', torsoSh: '#2e2414', armor: '#4a3a24', armorHi: '#6a5230', armorSh: '#2e2414',
    leg: '#4f6a30', legSh: '#34491f', arm: '#5f8038', foot: '#3e5a26', claw: '#cabfa0',
    belt: '#3a2c18', pendant: '#d8d0b8', wood: '#5a3a1a' },
});
SPR.define('zombie', {
  head: 'zombie', weapon: 'musket', artK: 1.5,
  pal: { skin: '#6f9450', skinSh: '#466030', skinHi: '#88a464', hood: '#3a2e1e',
    torso: '#4a3a26', torsoHi: '#5e4a30', torsoSh: '#2e2416', armor: '#6a5a44', armorHi: '#7e6c52', armorSh: '#46382a',
    leg: '#3a4a28', legSh: '#26331a', arm: '#6f9450', boot: '#3a2a18', belt: '#4a3318',
    metal: '#4a4438', metalSh: '#2a261e', wood: '#5a3a1e' },
});
SPR.define('werewolf', {
  head: 'wolf', weapon: 'smg', digi: true, tail: true, artK: 1.5,
  pal: { skin: '#4a3e30', skinSh: '#2a2018', skinHi: '#6a5a48', eye: '#f0e050',
    torso: '#3a2e22', torsoHi: '#4e4030', torsoSh: '#221a12', armor: '#4a3a28', armorHi: '#5e4c36', armorSh: '#2a2014',
    leg: '#3a3026', legSh: '#221a12', arm: '#4a3e30', foot: '#1a1410', claw: '#e8e0cf', belt: '#3a2a18',
    metal: '#2a2a2e', metalSh: '#16161a' },
});
SPR.define('dragonman', {
  head: 'dragon', weapon: 'rifle', digi: true, tail: true, scale: 1.12, artK: 1.5,
  pal: { skin: '#9a2218', skinSh: '#5a1410', skinHi: '#c23828', crest: '#5a1410', horn: '#2a2018', eye: '#e8c84a',
    torso: '#4a4438', torsoHi: '#5e5648', torsoSh: '#2e2a22', armor: '#4a4438', armorHi: '#6a6252', armorSh: '#2a261e', pauldron: '#6a6252',
    leg: '#7a1c14', legSh: '#4a1410', arm: '#9a2218', foot: '#3a1410', claw: '#cabfa0', belt: '#3a2c1a', pendant: '#cabfa0',
    metal: '#4a4e54', metalSh: '#2a2e34', wood: '#5a4424' },
});
SPR.define('demon', {
  head: 'demon', weapon: 'cannon', scale: 1.25, bulk: 1.15, artK: 1.5,
  pal: { skin: '#7a2a22', skinSh: '#4a1410', skinHi: '#9a3a2e', horn: '#241a14',
    torso: '#3a3030', torsoHi: '#4e4242', torsoSh: '#1e1a18', armor: '#3a3030', armorHi: '#564a4a', armorSh: '#1e1a18', pauldron: '#564a4a', plate: '#4a3a2a',
    leg: '#3a2e2a', legSh: '#1e1814', arm: '#7a2a22', boot: '#2a1c14', belt: '#4a1410', pendant: '#cabfa0',
    metal: '#3a2e2a', metalSh: '#1e1814' },
});
SPR.define('flayer', {
  head: 'flayer', weapon: 'staff', scale: 1.7, bulk: 1.1, cw: 110, ch: 120, artK: 1.4,
  pal: { skin: '#6a4a8a', skinSh: '#3e2a5a', skinHi: '#8a6ab0', tentacle: '#5a3a7a',
    torso: '#2a2040', torsoHi: '#3e3060', torsoSh: '#170f28', armor: '#2a2040', armorHi: '#3e3060', armorSh: '#170f28', pendant: '#caa33a',
    leg: '#3a2e54', legSh: '#1e1430', arm: '#6a4a8a', foot: '#241a3a', claw: '#caa07a',
    cape: '#2a1040', capeSh: '#170824', belt: '#3a2c5a', orb: '#b07bff', wood: '#3a2c1a' },
});

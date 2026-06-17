/* ============================================================
   rig.js — cut-out skeletal animation of the CONCEPT ART.
   The detailed concept upper body (torso + head + arms + weapon)
   is drawn as one piece and posed (bob / lean / aim-tilt / recoil /
   death), while two armour-matched legs swing from the hip so the
   character runs/jumps without losing the hand-painted realism.
   Falls back to the procedural SPR sprite until the art loads.
   ============================================================ */

const RIG = {
  enabled: false,   // reverted to the procedural sprites (sprites.js) per design direction
  tops: {}, loading: false, rigK: 1.95, cycle: 92,

  load() {
    if (!this.enabled || this.loading || typeof RIG_DATA === 'undefined') return;
    this.loading = true;
    for (const k in RIG_DATA) { const img = new Image(); img.src = 'assets/parts/' + k + '_top.png'; this.tops[k] = img; }
  },
  has(k) { return this.enabled && typeof RIG_DATA !== 'undefined' && RIG_DATA[k] && this.tops[k] && this.tops[k].complete && this.tops[k].naturalWidth > 0; },
  _k(key) { const d = SPR.defs[key]; return (d && d.rigK) || this.rigK; },
  _scale(e) { return e.h * this._k(e.spr) / RIG_DATA[e.spr].h; },

  // world-space chest/hands point where the (baked-in) weapon sits
  gunAnchor(e) {
    const m = RIG_DATA[e.spr], sc = this._scale(e), feetY = e.y + e.h;
    return { x: e.cx + (e.face || 1) * m.w * 0.14 * sc, y: feetY - (m.h - m.hip * 0.52) * sc };
  },

  draw(ctx, e, cam) {
    const m = RIG_DATA[e.spr], top = this.tops[e.spr], def = SPR.defs[e.spr], pal = def.pal;
    const sc = this._scale(e), face = e.face < 0 ? -1 : 1;
    const fx = e.cx + cam.ox, fy = e.y + e.h + cam.oy;
    const legLen = (m.h - m.hip), hipY = fy - legLen * sc;

    let anim = 'idle';
    const dying = (e.dying != null && e.dying > 0) || e.dead;
    if (dying) anim = 'death';
    else if (!e.onGround) anim = (e.vy < -40 ? 'jump' : 'fall');
    else if (Math.abs(e.vx) > 24) anim = 'run';

    // ---- pose ----
    let bob = 0, lean = 0, recoil = 0, tilt = 0, rot = 0, ph = 0;
    if (anim === 'run') { ph = ((e.runDist || 0) / this.cycle) * TAU; bob = -Math.abs(Math.sin(ph)) * 2.2 * sc; lean = 0.06; }
    else if (anim === 'idle') { ph = (e.anim || 0) * 2.2; bob = Math.sin(ph) * 1.3 * sc; }
    else if (anim === 'jump') { lean = 0.10; bob = -1 * sc; }
    else if (anim === 'fall') { lean = -0.05; }
    // aim tilt (raise/lower the whole upper body toward the cursor)
    if (e.aimAng != null && anim !== 'death') { const v = Math.sin(face > 0 ? e.aimAng : Math.PI - e.aimAng); tilt = clamp(-v, -1, 1) * 0.5; }
    if (e.cool && e.coolMax) recoil = (e.cool / e.coolMax) * 5;
    if (e.flash > 0.04 && anim !== 'death') lean -= 0.12;
    if (anim === 'death') { const t = e.dying != null ? (1 - clamp(e.dying / (e.dyingMax || 0.6), 0, 1)) : clamp(1 - (e.deathT || 0), 0, 1); rot = t * 1.5; bob = t * 4 * sc; }

    // ---- legs (behind), armour-matched, swinging from the hip ----
    if (m.legs && anim !== 'death') {
      const spread = legLen * sc * 0.18;
      const swF = anim === 'run' ? Math.sin(ph) * 0.5 : (anim === 'jump' ? 0.5 : anim === 'fall' ? -0.3 : 0.08);
      const swB = anim === 'run' ? Math.sin(ph + Math.PI) * 0.5 : (anim === 'jump' ? -0.25 : anim === 'fall' ? 0.35 : -0.08);
      const bendF = anim === 'run' ? 0.2 + Math.max(0, Math.cos(ph)) * 0.6 : (anim === 'jump' ? 0.9 : 0.12);
      const bendB = anim === 'run' ? 0.2 + Math.max(0, -Math.cos(ph)) * 0.6 : (anim === 'jump' ? 0.6 : 0.12);
      this._leg(ctx, def, pal, sc, fx - spread * face, hipY + bob, fy, face, swB, bendB, true);
      this._leg(ctx, def, pal, sc, fx + spread * face, hipY + bob, fy, face, swF, bendF, false);
    }

    // ---- concept top, posed around the hip pivot ----
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.translate(fx, hipY + bob);
    ctx.scale(face * sc, sc);
    ctx.rotate(face < 0 ? -(tilt + lean + rot) : (tilt + lean + rot));
    ctx.translate(-m.cx, -m.hip);
    ctx.drawImage(top, -recoil, 0);
    ctx.restore();

    // sword overlay for Zracks' dash (concept holds a bow)
    if ((e.dashT > 0 || e.swordMode) && def.weapon === 'bow' && typeof SPR !== 'undefined') {
      const ga = this.gunAnchor(e);
      ctx.save(); ctx.translate(ga.x + cam.ox, ga.y + cam.oy); ctx.scale(sc * 1.4, sc * 1.4);
      SPR.drawWeaponArm(ctx, def, 0, 0, e.aimAng, 0, 'sword'); ctx.restore();
    }
  },

  // one armour-matched leg (thigh + shin, rounded, with a knee plate), from the hip
  _leg(ctx, def, pal, sc, hx, hipY, footY, face, thighA, bend, back) {
    const legLen = footY - hipY, thighLen = legLen * 0.5, shinLen = legLen * 0.46;
    const kx = hx + Math.sin(thighA) * thighLen * face, ky = hipY + Math.cos(thighA) * thighLen;
    const shinA = thighA + (def.digi ? bend : -bend);
    const ax = kx + Math.sin(shinA) * shinLen * face, ay = ky + Math.cos(shinA) * shinLen;
    const base = back ? (pal.legSh || pal.armorSh || '#3a3a3a') : (pal.leg || pal.armor || '#6a6a6a');
    const hi = back ? null : pal.legHi || pal.armorHi;
    const wTop = 9.5 * sc, wKnee = 8 * sc, wAnk = 6.5 * sc;
    this._seg(ctx, hx, hipY, kx, ky, wTop, wKnee, base, hi);
    this._seg(ctx, kx, ky, ax, ay, wKnee, wAnk, base, hi);
    if (!def.digi) { ctx.fillStyle = back ? base : (pal.armor || base); ctx.beginPath(); ctx.arc(kx, ky, 3.2 * sc, 0, TAU); ctx.fill(); if (!back) { ctx.fillStyle = pal.armorHi || base; ctx.beginPath(); ctx.arc(kx - 0.6 * sc, ky - 0.6 * sc, 1.4 * sc, 0, TAU); ctx.fill(); } } // knee plate
    if (def.digi) {
      ctx.fillStyle = pal.foot || '#2a201a'; ctx.beginPath();
      ctx.moveTo(ax - 3 * sc, ay - 1 * sc); ctx.lineTo(ax + 10 * sc * face, ay - 2.5 * sc); ctx.lineTo(ax + 10 * sc * face, ay + 2 * sc); ctx.lineTo(ax - 3 * sc, ay + 3.5 * sc); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.claw || '#cabfa0'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ax + (8 + i * 1.6) * sc * face, ay - 1 * sc); ctx.lineTo(ax + (11.5 + i * 1.6) * sc * face, ay - 3 * sc); ctx.lineTo(ax + (11 + i * 1.6) * sc * face, ay + 1 * sc); ctx.fill(); }
    } else {
      ctx.fillStyle = pal.boot || '#241810'; ctx.beginPath(); ctx.ellipse(ax + 2 * sc * face, ay - 1 * sc, 7 * sc, 4 * sc, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.armorSh || '#1a120c'; ctx.beginPath(); ctx.ellipse(ax + 2 * sc * face, ay - 3.5 * sc, 5 * sc, 2.5 * sc, 0, 0, TAU); ctx.fill();
    }
  },
  _seg(ctx, x0, y0, x1, y1, w0, w1, base, hi) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.fillStyle = base; ctx.beginPath();
    ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, w0 / 2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x1, y1, w1 / 2, 0, TAU); ctx.fill();
    if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = Math.max(1, w1 * 0.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + nx * w0 * 0.22, y0 + ny * w0 * 0.22); ctx.lineTo(x1 + nx * w1 * 0.22, y1 + ny * w1 * 0.22); ctx.stroke(); }
  },
};

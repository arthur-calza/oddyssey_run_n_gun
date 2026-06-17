/* ============================================================
   entities.js — base entity, bullets, player, ally, pickups
   ============================================================ */

class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.alive = true; this.onGround = false;
    this.hitWall = 0; this.hitCeil = false;
    this.face = 1; this.anim = 0; this.flash = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
}

/* ---------------- Bullets / projectiles ------------------- */
class Bullet {
  constructor(x, y, ang, speed, opts = {}) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.ang = ang;
    this.faction = opts.faction || 'player';
    this.dmg = opts.dmg || 10;
    this.tileDmg = opts.tileDmg != null ? opts.tileDmg : this.dmg;
    this.kind = opts.kind || 'rifle';
    this.r = opts.r || 3;
    this.life = opts.life || 1.4;
    this.pierce = opts.pierce || 0;
    this.explosive = opts.explosive || 0;   // radius if >0
    this.grav = opts.grav || 0;
    this.color = opts.color || '#ffe27a';
    this.knock = opts.knock || 120;
    this.hitSet = null;
    this.alive = true;
    this.w = this.r * 2; this.h = this.r * 2;
    this.spin = opts.spin || 0; this.rot = ang;
  }
  detonate(game) {
    if (this.explosive > 0) game.world.explode(this.x, this.y, this.explosive, this.dmg);
    else { game.fx.spark(this.x, this.y, this.color, 4); }
    this.alive = false;
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.detonate(game); return; }
    if (this.grav) this.vy += this.grav * dt;
    this.rot += this.spin * dt;
    // step movement so fast bullets don't tunnel through terrain
    const speed = Math.hypot(this.vx, this.vy);
    const steps = Math.max(1, Math.ceil(speed * dt / 6));
    for (let s = 0; s < steps; s++) {
      this.x += this.vx * dt / steps;
      this.y += this.vy * dt / steps;
      if (this.y > game.world.pixelH + 60) { this.alive = false; return; }
      if (game.world.solidPx(this.x, this.y)) {
        const T = game.world.T;
        const c = Math.floor(this.x / T), r = Math.floor(this.y / T);
        if (this.explosive > 0) { this.detonate(game); }
        else {
          game.world.damage(c, r, this.tileDmg, { power: 70 });
          // bouncy retreat a touch then die
          game.fx.spark(this.x, this.y, this.kind === 'flame' ? '#ff8a3c' : '#fff', 3);
          this.alive = false;
        }
        return;
      }
    }
  }
  draw(ctx, cam) {
    const x = this.x + cam.ox, y = this.y + cam.oy;
    ctx.save();
    if (this.kind === 'arrow' || this.kind === 'cannon') {
      ctx.translate(x, y); ctx.rotate(this.kind === 'cannon' ? this.rot : this.ang);
      if (this.kind === 'cannon') { ctx.fillStyle = '#2c2a28'; ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#555'; ctx.fillRect(-this.r, -1, this.r * 2, 2); }
      else { ctx.fillStyle = '#caa45a'; ctx.fillRect(-7, -1.2, 14, 2.4); ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.fill(); }
    } else if (this.kind === 'flame') {
      ctx.globalAlpha = clamp(this.life / 0.3, 0, 1);
      ctx.fillStyle = pick(['#ffd86b', '#ff8a3c', '#ff5b2c']);
      ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
    } else if (this.kind === 'dagger') {
      ctx.translate(x, y); ctx.rotate(this.rot || this.ang);
      ctx.fillStyle = '#5a4326'; ctx.fillRect(-5, -1, 4, 2);
      ctx.fillStyle = this.color || '#cfd2d6'; ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(8, 0); ctx.lineTo(-1, 2); ctx.fill();
    } else if (this.kind === 'thorn') {
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = this.color || '#7be08a'; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(6, 0); ctx.lineTo(-5, 2); ctx.fill();
      ctx.fillStyle = '#3a5a2a'; ctx.fillRect(-5, -1, 3, 2);
    } else if (this.kind === 'note') {
      ctx.fillStyle = this.color || '#ffd86b'; ctx.shadowColor = this.color || '#ffd86b'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
      ctx.fillRect(x + this.r - 1, y - this.r - 4, 1.6, 6);
    } else {
      // glowing pellet/ball
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
      if (this.explosive) { ctx.fillStyle = '#3a2c1c'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(x, y, this.r * 0.55, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
}

/* ---------------- shared fighter rendering ----------------
   Parametric RPG character: armour, robes, cloaks, hoods, hats,
   horns and medieval weapons. Scales to the entity's w/h.
   skin = { tone, outfit, outfit2, trim, cloak, robe, hair,
            head, weapon, weaponColor, glow, custom }                */
const MELEE_WEAPONS = { sword: 1, greatsword: 1, axe: 1, spear: 1, claws: 1, scythe: 1, fists: 1 };

function drawFighter(ctx, e, cam, look) {
  if (e.spr && typeof RIG !== 'undefined' && RIG.has(e.spr)) { RIG.draw(ctx, e, cam); return; }
  if (e.spr && typeof SPR !== 'undefined' && SPR.defs[e.spr]) { SPR.draw(ctx, e, cam); return; }
  const s = e.skin || {};
  if (s.custom) { s.custom(ctx, e, cam); return; }   // non-humanoid (slimes, etc.)
  const W = e.w, H = e.h, f = e.face;
  const x = e.x + cam.ox, y = e.y + cam.oy;
  const cx = x + W / 2, baseY = y + H;
  const hurt = e.flash > 0 && Math.floor(e.flash * 50) % 2 === 0;
  const C = c => hurt ? '#ffffff' : c;
  const tone = s.tone || '#d9a06b', outfit = s.outfit || '#5a5a6a', outfit2 = s.outfit2 || '#3a3a46',
        trim = s.trim || '#caa33a', hairc = s.hair || '#3a2a1a';

  const moving = Math.abs(e.vx) > 14 && e.onGround;
  const ph = e.anim;
  const swing = moving ? Math.sin(ph) : Math.sin(ph * 0.5) * 0.25;
  const bob = (moving ? Math.abs(Math.sin(ph)) * 0.04 : Math.sin(ph * 0.4) * 0.015) * H;
  const legH = H * 0.30, torsoH = H * 0.40, half = W * 0.5;
  const hipY = baseY - legH, chestY = hipY - torsoH, headR = H * 0.15, headCY = chestY - headR + 2;

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(cx, baseY - 1, half * 1.1, 3.5, 0, 0, TAU); ctx.fill();

  // cloak (behind everything), sways opposite to facing
  if (s.cloak) {
    ctx.fillStyle = C(s.cloak);
    const cw = half * 1.25, sx = -f * (4 + swing * 4);
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.7, chestY + 2 - bob);
    ctx.lineTo(cx + cw * 0.7, chestY + 2 - bob);
    ctx.lineTo(cx + cw * 0.55 + sx, hipY + legH * 0.7);
    ctx.lineTo(cx + sx * 1.3, hipY + legH * 0.9);
    ctx.lineTo(cx - cw * 0.55 + sx, hipY + legH * 0.7);
    ctx.closePath(); ctx.fill();
  }

  // legs OR robe
  if (s.robe) {
    ctx.fillStyle = C(outfit);
    const hem = half * 1.15, sx = swing * 3;
    ctx.beginPath();
    ctx.moveTo(cx - half * 0.7, chestY + torsoH * 0.5 - bob);
    ctx.lineTo(cx + half * 0.7, chestY + torsoH * 0.5 - bob);
    ctx.lineTo(cx + hem + sx, baseY); ctx.lineTo(cx - hem + sx, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C(outfit2); ctx.fillRect(cx - hem * 0.5, baseY - 3, hem, 3);
    ctx.fillStyle = C(trim); ctx.fillRect(cx - 1, chestY + torsoH * 0.5 - bob, 2, legH + torsoH * 0.5); // robe seam
  } else {
    ctx.fillStyle = C(s.boots || outfit2);
    const la = swing * H * 0.10, lb = -swing * H * 0.10;
    ctx.fillRect(cx - half * 0.55, hipY - bob + Math.max(0, -la), half * 0.42, legH + Math.abs(la) * 0.4);
    ctx.fillRect(cx + half * 0.13, hipY - bob + Math.max(0, -lb), half * 0.42, legH + Math.abs(lb) * 0.4);
    ctx.fillStyle = C('#1b1714'); // boots
    ctx.fillRect(cx - half * 0.55, baseY - 4 + Math.min(0, la), half * 0.45, 4);
    ctx.fillRect(cx + half * 0.13, baseY - 4 + Math.min(0, lb), half * 0.45, 4);
  }

  // torso
  ctx.fillStyle = C(outfit);
  ctx.fillRect(cx - half * 0.75, chestY - bob, half * 1.5, torsoH);
  // chest plate / tunic detail
  ctx.fillStyle = C(outfit2); ctx.fillRect(cx - half * 0.75, chestY - bob, half * 1.5, torsoH * 0.18);
  ctx.fillStyle = C(trim); ctx.fillRect(cx - half * 0.1, chestY - bob, half * 0.2, torsoH); // center strip
  ctx.fillRect(cx - half * 0.75, hipY - 4 - bob, half * 1.5, 3); // belt
  // shoulder pauldrons
  ctx.fillStyle = C(s.pauldron || trim);
  ctx.fillRect(cx - half * 0.9, chestY - bob, half * 0.35, torsoH * 0.28);
  ctx.fillRect(cx + half * 0.55, chestY - bob, half * 0.35, torsoH * 0.28);

  // back arm
  ctx.fillStyle = C(s.arms || outfit);
  ctx.fillRect(cx - f * half * 0.78 - 2, chestY + 2 - bob, 4, torsoH * 0.7);

  // head
  ctx.fillStyle = C(tone);
  ctx.beginPath(); ctx.arc(cx, headCY - bob, headR, 0, TAU); ctx.fill();
  // hair / headgear
  drawHead(ctx, s, cx, headCY - bob, headR, f, C, hairc);

  // ---- held weapon (front arm) ----
  drawHeldWeapon(ctx, e, s, cx, chestY + torsoH * 0.35 - bob, half, C, look);
}

function drawHead(ctx, s, cx, cy, r, f, C, hairc) {
  const trim = s.trim || '#caa33a';
  switch (s.head) {
    case 'greathelm':
      ctx.fillStyle = C('#9aa2ad'); ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - r - 1, cy - 1, (r + 1) * 2, r + 3);
      ctx.fillStyle = C('#15110e'); ctx.fillRect(cx - r * 0.7, cy + 1, r * 1.4, 2.5); // visor slit
      ctx.fillStyle = C(trim); ctx.fillRect(cx - 1.5, cy - r - 5, 3, 5); // plume base
      ctx.fillStyle = C(s.plume || '#b1322c'); ctx.beginPath(); ctx.moveTo(cx, cy - r - 4); ctx.quadraticCurveTo(cx + f * 6, cy - r - 12, cx + f * 2, cy - r - 16); ctx.lineTo(cx, cy - r - 5); ctx.fill();
      break;
    case 'helm':
      ctx.fillStyle = C('#8a929d'); ctx.beginPath(); ctx.arc(cx, cy - 1, r + 1, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 1.5, cy - r, 3, r + 2); // nasal
      break;
    case 'horns':
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 2, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C('#3a342c'); ctx.beginPath(); ctx.arc(cx, cy, r + 1, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C('#e8e0cf');
      ctx.beginPath(); ctx.moveTo(cx - r, cy - 2); ctx.quadraticCurveTo(cx - r - 6, cy - 8, cx - r - 3, cy - 13); ctx.lineTo(cx - r + 2, cy - 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + r, cy - 2); ctx.quadraticCurveTo(cx + r + 6, cy - 8, cx + r + 3, cy - 13); ctx.lineTo(cx + r - 2, cy - 4); ctx.fill();
      break;
    case 'hood':
      ctx.fillStyle = C(s.outfit2 || '#2a2a30'); ctx.beginPath(); ctx.arc(cx, cy - 1, r + 2, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.fillRect(cx - r - 1, cy - 2, (r + 1) * 2, r);
      ctx.fillStyle = C('#0c0a08'); ctx.beginPath(); ctx.arc(cx + f * 1.5, cy + 1, r * 0.7, 0, TAU); ctx.fill(); // face shadow
      ctx.fillStyle = C(s.eyes || '#ffd86b'); ctx.fillRect(cx + f * 1, cy, 2.5, 2); // glint
      break;
    case 'wizardhat':
      ctx.fillStyle = C(hairc); ctx.fillRect(cx - r, cy - 2, r * 2, r); // hair under brim
      ctx.fillStyle = C(s.hat || '#3a2a6a');
      ctx.beginPath(); ctx.ellipse(cx, cy - r + 1, r + 5, 3.5, 0, 0, TAU); ctx.fill(); // brim
      ctx.beginPath(); ctx.moveTo(cx - r - 1, cy - r + 1); ctx.quadraticCurveTo(cx + f * 8, cy - r - 16, cx + f * 12, cy - r - 22); ctx.quadraticCurveTo(cx + f * 4, cy - r - 12, cx + r + 1, cy - r + 1); ctx.fill();
      ctx.fillStyle = C(trim); ctx.fillRect(cx - r - 2, cy - r - 1, r * 2 + 4, 2);
      ctx.fillStyle = '#fff2b0'; ctx.fillRect(cx + f * 5, cy - r - 9, 2, 2); ctx.fillRect(cx + f * 9, cy - r - 15, 1.5, 1.5); // stars
      break;
    case 'feathered':
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 2, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C(s.hat || '#3a6a4a'); ctx.beginPath(); ctx.ellipse(cx, cy - r + 1, r + 2, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#caa33a'); ctx.beginPath(); ctx.moveTo(cx - f * r, cy - r); ctx.quadraticCurveTo(cx - f * (r + 10), cy - r - 10, cx - f * (r + 4), cy - r - 14); ctx.lineTo(cx - f * (r - 2), cy - r); ctx.fill();
      break;
    case 'antlers':
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 1, r, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = C('#7a5a3a'); ctx.lineWidth = 2;
      [[-1], [1]].forEach(d => { const dx = d[0]; ctx.beginPath(); ctx.moveTo(cx + dx * r * 0.6, cy - r * 0.6); ctx.lineTo(cx + dx * (r + 3), cy - r - 8); ctx.moveTo(cx + dx * (r + 1), cy - r - 3); ctx.lineTo(cx + dx * (r + 6), cy - r - 4); ctx.moveTo(cx + dx * (r + 2), cy - r - 6); ctx.lineTo(cx + dx * (r + 4), cy - r - 11); ctx.stroke(); });
      ctx.fillStyle = C(s.leaf || '#557a3a'); ctx.beginPath(); ctx.arc(cx - r, cy - 1, 2, 0, TAU); ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 1, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C(trim); ctx.fillRect(cx - r, cy - r - 1, r * 2, 4);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.8 - 2, cy - r - 1); ctx.lineTo(cx + i * r * 0.8, cy - r - 7); ctx.lineTo(cx + i * r * 0.8 + 2, cy - r - 1); ctx.fill(); }
      break;
    case 'skull':
      ctx.fillStyle = C('#e8e0cf'); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#15110e'; ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - 1, r * 0.28, 0, TAU); ctx.arc(cx + r * 0.4, cy - 1, r * 0.28, 0, TAU); ctx.fill();
      ctx.fillRect(cx - r * 0.5, cy + r * 0.5, r, 2);
      if (s.eyes) { ctx.fillStyle = s.eyes; ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - 1, r * 0.15, 0, TAU); ctx.arc(cx + r * 0.4, cy - 1, r * 0.15, 0, TAU); ctx.fill(); }
      break;
    case 'bandana':
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 1, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C(s.band || '#b1322c'); ctx.fillRect(cx - r, cy - r * 0.5, r * 2, 3);
      ctx.beginPath(); ctx.moveTo(cx - f * r, cy - r * 0.5); ctx.lineTo(cx - f * (r + 5), cy); ctx.lineTo(cx - f * r, cy + 1); ctx.fill();
      break;
    default: // bare + hair
      ctx.fillStyle = C(hairc); ctx.beginPath(); ctx.arc(cx, cy - 2, r, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      if (s.hairStyle === 'long') ctx.fillRect(cx - r, cy - 2, r * 2, r * 1.4);
  }
  // simple eyes for non-helmeted, non-skull faces
  if (['greathelm', 'helm', 'hood', 'skull'].indexOf(s.head) < 0) {
    ctx.fillStyle = '#15110e'; ctx.fillRect(cx + f * 1, cy - 1, 1.6, 2);
  }
}

function drawHeldWeapon(ctx, e, s, cx, handY, half, C, look) {
  if (!s.weapon || s.weapon === 'none' || !look) return;
  const f = e.face, hx = cx + f * half * 0.55, w = s.weapon, wc = s.weaponColor || '#cfd2d6';
  const melee = MELEE_WEAPONS[w];
  let ang;
  if (melee) {
    const t = e.attackT || 0;                  // 1 -> 0 swing
    ang = (f > 0 ? 0 : Math.PI) + f * (-1.2 + (1 - t) * 1.9);
    if (!t) ang = (f > 0 ? -0.5 : Math.PI + 0.5);  // resting pose
  } else {
    ang = e.aimAng != null ? e.aimAng : (f > 0 ? 0 : Math.PI);
  }
  ctx.save(); ctx.translate(hx, handY); ctx.rotate(ang);
  ctx.fillStyle = C(wc);
  switch (w) {
    case 'sword':      ctx.fillStyle = C('#5a4326'); ctx.fillRect(-5, -1.5, 6, 3); ctx.fillStyle = C(trimOr(s)); ctx.fillRect(0, -4, 2.5, 8); ctx.fillStyle = C(wc); ctx.fillRect(2, -1.6, half * 1.5, 3.2); ctx.beginPath(); ctx.moveTo(2 + half * 1.5, -1.6); ctx.lineTo(6 + half * 1.5, 0); ctx.lineTo(2 + half * 1.5, 1.6); ctx.fill(); break;
    case 'greatsword': ctx.fillStyle = C('#5a4326'); ctx.fillRect(-8, -2, 9, 4); ctx.fillStyle = C(trimOr(s)); ctx.fillRect(1, -6, 3, 12); ctx.fillStyle = C(wc); ctx.fillRect(4, -2.6, half * 2.1, 5.2); ctx.beginPath(); ctx.moveTo(4 + half * 2.1, -2.6); ctx.lineTo(10 + half * 2.1, 0); ctx.lineTo(4 + half * 2.1, 2.6); ctx.fill(); break;
    case 'axe':        ctx.fillStyle = C('#5a4326'); ctx.fillRect(-4, -1.5, half * 1.7, 3); ctx.fillStyle = C(wc); ctx.beginPath(); ctx.moveTo(half * 1.2, -3); ctx.quadraticCurveTo(half * 1.9, -10, half * 2.2, -2); ctx.quadraticCurveTo(half * 1.9, 6, half * 1.2, 3); ctx.fill(); break;
    case 'spear':      ctx.fillStyle = C('#5a4326'); ctx.fillRect(-half, -1.2, half * 2.6, 2.4); ctx.fillStyle = C(wc); ctx.beginPath(); ctx.moveTo(half * 1.6, -3.5); ctx.lineTo(half * 2.4, 0); ctx.lineTo(half * 1.6, 3.5); ctx.fill(); break;
    case 'scythe':     ctx.fillStyle = C('#3a2a1a'); ctx.fillRect(-half, -1.5, half * 2.4, 3); ctx.fillStyle = C(wc); ctx.beginPath(); ctx.moveTo(half * 1.4, -2); ctx.quadraticCurveTo(half * 2.6, -4, half * 2.2, -16); ctx.quadraticCurveTo(half * 1.8, -6, half * 1.3, -3); ctx.fill(); break;
    case 'dagger':     ctx.fillStyle = C('#5a4326'); ctx.fillRect(-3, -1.2, 4, 2.4); ctx.fillStyle = C(wc); ctx.fillRect(1, -1.4, half * 0.9, 2.8); ctx.beginPath(); ctx.moveTo(1 + half * 0.9, -1.4); ctx.lineTo(4 + half * 0.9, 0); ctx.lineTo(1 + half * 0.9, 1.4); ctx.fill(); break;
    case 'bow':        ctx.strokeStyle = C(s.weaponColor || '#7a5a2a'); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(2, 0, half * 1.3, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = C('#e8e0cf'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2 + Math.cos(-1.1) * half * 1.3, Math.sin(-1.1) * half * 1.3); ctx.lineTo(2 + Math.cos(1.1) * half * 1.3, Math.sin(1.1) * half * 1.3); ctx.stroke(); break;
    case 'staff':      ctx.fillStyle = C('#5a4326'); ctx.fillRect(-half, -1.5, half * 2.4, 3); ctx.fillStyle = C(s.orb || '#6fd0ff'); ctx.shadowColor = s.orb || '#6fd0ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(half * 2.2, 0, 4.5, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; break;
    case 'wand':       ctx.fillStyle = C('#3a2a1a'); ctx.fillRect(-2, -1.2, half * 1.1, 2.4); ctx.fillStyle = C(s.orb || '#ff7be0'); ctx.shadowColor = s.orb || '#ff7be0'; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(half * 1.1, 0, 3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; break;
    case 'lute':       ctx.fillStyle = C('#7a4a22'); ctx.beginPath(); ctx.ellipse(half * 0.5, 2, half * 0.7, half * 0.55, 0, 0, TAU); ctx.fill(); ctx.fillStyle = C('#3a2410'); ctx.fillRect(half * 0.5, -1, half * 1.4, 2.5); ctx.fillStyle = C('#1b1410'); ctx.beginPath(); ctx.arc(half * 0.5, 2, 2, 0, TAU); ctx.fill(); break;
    case 'claws':      ctx.fillStyle = C(wc); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, i * 3); ctx.lineTo(half * 0.9, i * 4); ctx.lineTo(half * 1.0, i * 4 - 1); ctx.fill(); } break;
  }
  ctx.restore();
}
function trimOr(s) { return s.trim || '#caa33a'; }

/* ---------------- Player --------------------------------- */
class Player extends Entity {
  constructor(x, y, heroIndex) {
    super(x, y, 24, 42);
    this.faction = 'player';
    this.maxSpecial = 100; this.attackT = 0;
    this.setHero(heroIndex);
    this.invuln = 0; this.cool = 0; this.special = this.maxSpecial; this.specCool = 0;
    this.ammo = this.clip; this.reloading = 0;
    this.jumps = 0; this.hoverT = 0; this.dashT = 0; this.dashCd = 0;
    this.aimAng = 0; this.dead = false; this.deathT = 0;
  }
  setHero(i) {
    this.heroIndex = i;
    const H = HEROES[i];
    this.hero = H;
    const oldBottom = (this.h ? this.y + this.h : null);
    this.w = H.w || 24; this.h = H.h || 42;
    if (oldBottom != null) this.y = oldBottom - this.h;
    this.maxhp = H.hp; this.hp = H.hp;
    this.speed = H.speed; this.jumpV = H.jumpV; this.maxJumps = H.jumps;
    this.clip = H.clip; this.reloadTime = H.reload;
    this.skin = H.skin; this.spr = H.spr; this.gunLen = H.gunLen || 16;
    this.ammo = H.clip;
  }
  hurt(dmg, dir, game) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= dmg; this.flash = 0.12; this.invuln = 0.6;
    this.vx += dir * 80; this.vy -= 80;
    game.fx.blood(this.cx, this.cy, dir); game.cam.addShake(6); Sound.hurt();
    if (this.hp <= 0) { this.hp = 0; this.die(game); }
  }
  die(game) {
    if (this.dead) return;
    this.dead = true; this.deathT = 1.0;
    game.fx.blood(this.cx, this.cy, 0); game.fx.blood(this.cx, this.cy, 0);
    game.fx.smoke(this.cx, this.cy, 6); game.cam.addShake(10); Sound.die();
    game.onPlayerDeath();
  }
  gainSpecial(v) { this.special = clamp(this.special + v, 0, this.maxSpecial); }

  update(dt, game) {
    if (this.dead) { this.deathT -= dt; this.vy += CONFIG.GRAVITY * dt; game.world.moveAndCollide(this, dt); return; }
    const c = game.controller;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.specCool = Math.max(0, this.specCool - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.attackT = Math.max(0, this.attackT - dt * 5); // melee swing decay
    this.swordMode = Math.max(0, (this.swordMode || 0) - dt);
    this.powered = Math.max(0, (this.powered || 0) - dt); // magic-potion buff timer
    this.gainSpecial(dt * 6); // passive charge

    // ---- aim toward mouse (pivot at the chest/hands) ----
    const mw = game.cam.mouseWorld();
    this.face = (mw.x >= this.cx) ? 1 : -1;
    const ga = SPR.gunAnchor(this);
    this.aimAng = Math.atan2(mw.y - ga.y, mw.x - ga.x);

    // ---- movement ----
    let move = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const accel = this.onGround ? 2600 : 1500;
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.face * this.speed * 2.5; this.invuln = Math.max(this.invuln, 0.05);
      // smash through terrain and enemies in front
      const T = game.world.T, col = Math.floor((this.cx + this.face * 12) / T);
      for (let r = Math.floor(this.y / T); r <= Math.floor((this.y + this.h) / T); r++) game.world.damage(col, r, 50, { power: 100 });
      game.damageEntitiesRadial(this.cx + this.face * 16, this.cy, 28, 16, this);
      game.fx.muzzle(this.cx, this.cy, this.face > 0 ? 0 : Math.PI);
    } else {
      if (move !== 0) this.vx = approach(this.vx, move * this.speed, accel * dt);
      else this.vx = approach(this.vx, 0, (this.onGround ? 3400 : 1200) * dt);
    }

    // ---- ladders: grab when overlapping ladder tiles and pressing up/down ----
    const onLadderTile = game.world.ladderAt(this.cx, this.cy) || game.world.ladderAt(this.cx, this.y + this.h - 6) || game.world.ladderAt(this.cx, this.y + 4);
    if (onLadderTile && (c.up || c.down)) this.onLadder = true;
    if (!onLadderTile) this.onLadder = false;
    const onLadder = this.onLadder;

    const jumpEdge = c.jumpPressed();
    if (onLadder) {
      this.jumps = this.maxJumps; this.clinging = false;
      this.vy = (c.up ? -1 : c.down ? 1 : 0) * 190;
      if (jumpEdge) { this.onLadder = false; this.vy = -this.jumpV * 0.8; Sound.jump(); }
      if (Math.abs(this.vy) > 10 && Math.random() < 0.2) game.fx.spark(this.cx, this.cy, '#caa07a', 1);
    } else {
      // ---- wall-cling / wall-climb / wall-jump (Broforce-style) ----
      const pushDir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      const onWall = !this.onGround && this.hitWall !== 0 && pushDir === this.hitWall && this.vy > -80;
      if (onWall) {
        this.clinging = true; this.wallSide = this.hitWall;
        if (jumpEdge) { this.vy = -this.jumpV; this.vx = -this.hitWall * this.speed * 1.15; Sound.jump(); game.fx.smoke(this.cx, this.cy, 3); }
        else if (c.up) this.vy = -150;              // climb up
        else if (c.down) this.vy = 300;             // slide down fast
        else this.vy = Math.min(this.vy, 70);       // cling & slow-slide
        if (Math.random() < 0.3) game.fx.spark(this.cx + this.hitWall * 8, this.cy + rand(-8, 10), '#caa07a', 1);
      } else {
        this.clinging = false;
        if (this.onGround) this.jumps = this.maxJumps;
        if (jumpEdge && this.jumps > 0) { this.vy = -this.jumpV; this.jumps--; Sound.jump(); game.fx.smoke(this.cx, this.y + this.h, 3); }
        if (!c.jumpHeld && this.vy < -120) this.vy = -120;
        if (this.hero.canHover && c.jumpHeld && this.vy > 40 && this.jumps <= 0) { this.vy = Math.min(this.vy, 90); }
      }
    }

    // gravity (off while climbing a ladder)
    if (!onLadder) this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    game.world.moveAndCollide(this, dt);

    // ---- weapons ----
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.ammo = this.clip; }
    } else if (c.fire && this.cool <= 0) {
      this.hero.weapon.fire(this, game);
    }
    if (c.special && this.specCool <= 0 && this.special >= this.hero.special.cost) {
      this.hero.special.use(this, game);
      this.special -= this.hero.special.cost; this.specCool = this.hero.special.cd;
    }

    // anim clocks: anim = seconds (idle), runDist = foot-locked distance (run cycle)
    this.anim += dt;
    if (this.onGround) this.runDist = (this.runDist || 0) + Math.abs(this.vx) * dt;
  }

  // helper used by hero weapon definitions
  muzzlePos() {
    const ga = SPR.gunAnchor(this), len = this.gunLen + 4;
    return { x: ga.x + Math.cos(this.aimAng) * len, y: ga.y + Math.sin(this.aimAng) * len };
  }
  shoot(game, opts, spread = 0, count = 1) {
    const m = this.muzzlePos();
    for (let i = 0; i < count; i++) {
      const a = this.aimAng + rand(-spread, spread) + (count > 1 ? (i - (count - 1) / 2) * (opts.fan || 0) : 0);
      const b = new Bullet(m.x, m.y, a, opts.speed, Object.assign({ faction: 'player' }, opts));
      game.bullets.push(b);
    }
    game.fx.muzzle(m.x, m.y, this.aimAng);
    this.vx -= Math.cos(this.aimAng) * (opts.recoil || 0);
    game.cam.addShake(opts.shake || 1.2);
  }
  consumeAmmo(n = 1) {
    this.ammo -= n;
    if (this.ammo <= 0) { this.ammo = 0; this.reloading = this.reloadTime; }
  }

  draw(ctx, cam) {
    if (this.dead) {
      // simple ragdoll puff
      ctx.globalAlpha = clamp(this.deathT, 0, 1);
      drawFighter(ctx, this, cam, false);
      ctx.globalAlpha = 1; return;
    }
    if (this.powered > 0) {                  // magic-potion aura
      const gx = this.cx + cam.ox, gy = this.cy + cam.oy, pr = 18 + Math.sin(this.powered * 8) * 3;
      const gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, pr);
      gr.addColorStop(0, 'rgba(110,180,255,0.35)'); gr.addColorStop(1, 'rgba(110,180,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, pr, 0, TAU); ctx.fill();
    }
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    drawFighter(ctx, this, cam, true);
    ctx.globalAlpha = 1;
  }
}

/* ---------------- Ally / Prisoner ------------------------ */
class Ally extends Entity {
  constructor(x, y, heroIndex) {
    super(x, y, 22, 30);
    this.heroIndex = heroIndex; this.rescued = false;
    this.skin = HEROES[heroIndex].skin; this.t = rand(0, 6);
  }
  update(dt, game) {
    this.t += dt;
    if (this.rescued) return;
    const p = game.player;
    if (p && !p.dead && aabb({ x: this.x - 6, y: this.y - 6, w: this.w + 12, h: this.h + 12 }, p)) {
      this.rescued = true;
      game.rescueAlly(this.heroIndex);
      game.fx.spark(this.cx, this.cy, '#ffe27a', 16); game.fx.text(this.cx, this.y - 8, 'LIBERTO!', '#ffe27a');
      Sound.rescue();
    }
  }
  draw(ctx, cam) {
    if (this.rescued) return;
    const x = this.x + cam.ox, y = this.y + cam.oy;
    // cage bars
    drawFighter(ctx, Object.assign(Object.create(Entity.prototype), this, { face: 1, vx: 0, onGround: true, anim: this.t, aimAng: 0, gunLen: 0 }), cam, false);
    ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + this.w / 2 + i * 8, y - 6); ctx.lineTo(x + this.w / 2 + i * 8, y + this.h); ctx.stroke(); }
    ctx.fillStyle = '#caa33a'; ctx.font = 'bold 12px "Trebuchet MS"'; ctx.textAlign = 'center';
    if (Math.sin(this.t * 3) > 0) ctx.fillText('!', x + this.w / 2, y - 10);
    ctx.textAlign = 'left';
  }
}

/* ---------- Pickup: health / oregano / life / potion / token --- */
class Pickup extends Entity {
  constructor(x, y, kind) {
    const s = kind === 'oregano' ? 14 : kind === 'token' ? 20 : 16;
    super(x - s / 2, y - s / 2, s, s);
    this.kind = kind; this.t = rand(0, 6); this.vy = -rand(120, 240); this.vx = rand(-80, 80);
  }
  get magnetic() { return this.kind === 'oregano' || this.kind === 'token'; }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (this.magnetic && p && !p.dead) {
      const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
      if (d < 160) { const a = Math.atan2(p.cy - this.cy, p.cx - this.cx); this.vx += Math.cos(a) * 950 * dt; this.vy += Math.sin(a) * 950 * dt; this.vx *= 0.9; this.vy *= 0.9; }
      else this.vy = Math.min(this.vy + 1400 * dt, 600);
    } else this.vy = Math.min(this.vy + 1400 * dt, 600);
    game.world.moveAndCollide(this, dt);
    if (this.onGround) this.vx *= 0.8;
    if (p && !p.dead && aabb(this, p)) {
      if (this.kind === 'health') { p.hp = clamp(p.hp + 30, 0, p.maxhp); game.fx.text(p.cx, p.y - 6, '+30', '#7be08a'); Sound.rescue(); this.alive = false; }
      else if (this.kind === 'oregano') { game.collectOregano(this); }
      else if (this.kind === 'life') { game.lives++; game.fx.text(p.cx, p.y - 6, '+1 VIDA', '#ff5b6e'); game.fx.spark(this.cx, this.cy, '#ff5b6e', 14); Sound.heal(); this.alive = false; }
      else if (this.kind === 'potion') { game.applyPotion(p); this.alive = false; }
      else if (this.kind === 'token') { game.collectToken(this); }
    }
  }
  draw(ctx, cam) {
    const x = this.cx + cam.ox, y = this.cy + cam.oy + Math.sin(this.t * 4) * 2;
    if (this.kind === 'oregano') {                       // a sprig of oregano (currency)
      ctx.strokeStyle = '#2f6a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.fillStyle = '#5ea83c'; for (let i = -2; i <= 2; i++) { const ly = y - i * 2.4, side = i % 2 ? 1 : -1; ctx.beginPath(); ctx.ellipse(x + side * 3.5, ly, 3, 1.7, side * 0.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#8ed86a'; ctx.beginPath(); ctx.arc(x, y - 6, 1.6, 0, TAU); ctx.fill();
    } else if (this.kind === 'potion') {                 // blue magic potion (power buff)
      const g2 = 0.6 + 0.4 * Math.sin(this.t * 5);
      ctx.fillStyle = `rgba(90,170,255,${0.35})`; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a3a5a'; ctx.fillRect(x - 4, y - 9, 8, 4);                 // cork/neck
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 2.5, y - 12, 5, 3);
      ctx.fillStyle = '#1e3a6a'; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(90,180,255,${0.8})`; ctx.beginPath(); ctx.ellipse(x, y + 2, 5.5, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(200,235,255,${g2})`; ctx.beginPath(); ctx.arc(x - 2, y, 1.8, 0, TAU); ctx.fill();
    } else if (this.kind === 'token') {                  // "Rei do Picadão" hexagonal pizza box
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(this.t * 1.5) * 0.15);
      ctx.fillStyle = '#b5642a'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2, r = 11; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7a3e16'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 9px "Trebuchet MS"'; ctx.textAlign = 'center'; ctx.fillText('♛', 0, 3.5);
      ctx.restore(); ctx.textAlign = 'left';
    } else if (this.kind === 'life') {
      const s = 1 + Math.sin(this.t * 5) * 0.08;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = '#15110e'; ctx.fillRect(-7, -3, 14, 5); ctx.fillRect(-3, -7, 6, 13);
      ctx.fillStyle = '#ff5b6e'; ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -6, 4, 12);
      ctx.fillStyle = '#ffd0d6'; ctx.fillRect(-4, -1, 3, 2); ctx.restore();
    } else {                                             // health cross
      ctx.fillStyle = '#15110e'; ctx.fillRect(x - 7, y - 3, 14, 5); ctx.fillRect(x - 3, y - 7, 6, 13);
      ctx.fillStyle = '#7be08a'; ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillRect(x - 2, y - 6, 4, 12);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 1, 10, 2); ctx.fillRect(x - 1, y - 5, 2, 10);
    }
  }
}

/* ============================================================
   particles.js — particle system + falling debris chunks
   ============================================================ */

class FX {
  constructor(game) {
    this.game = game;
    this.parts = [];   // {x,y,vx,vy,life,max,r,c,g,fade,glow,shrink}
    this.debris = [];  // physics chunks that collide with terrain
    this.crumbs = [];  // PERSISTENT mini-blocks: destruction debris + gore that fall & settle in the scene
    this.rings = [];   // shockwave rings
    this.texts = [];   // floating combat text
    this.slashes = []; // melee swoosh arcs
    this.bolts = [];   // lightning bolts
    this.decals = [];  // PERSISTENT marks (blood, rubble, scorch) — the trail of destruction
  }

  _pushDecal(o) { this.decals.push(o); const max = 1800; if (this.decals.length > max) this.decals.splice(0, this.decals.length - max); }
  bloodPool(x, y, c, n = 6) { for (let i = 0; i < n; i++) this._pushDecal({ t: 'blob', x: x + rand(-12, 12), y: y + rand(-3, 4), r: rand(3, 8), c: c || '#6a160e', a: rand(0.5, 0.85) }); }
  rubble(x, y, c) { for (let i = 0; i < 3; i++) this._pushDecal({ t: 'rect', x: x + rand(-11, 11), y: y + rand(-9, 9), s: rand(2, 4.5), c, rot: rand(0, TAU), a: rand(0.55, 0.9) }); }
  scorch(x, y, radius) { this._pushDecal({ t: 'scorch', x, y, r: radius * 0.7, a: 0.5 }); for (let i = 0; i < 5; i++) this._pushDecal({ t: 'rect', x: x + rand(-radius, radius) * 0.6, y: y + rand(-radius, radius) * 0.6, s: rand(2, 4), c: '#1a1410', rot: rand(0, TAU), a: 0.6 }); }
  drawDecals(ctx, cam) {
    const ox = cam.ox, oy = cam.oy, vw = cam.vw, vh = cam.vh;
    for (const d of this.decals) {
      if (d.x < cam.x - 30 || d.x > cam.x + vw + 30 || d.y < cam.y - 30 || d.y > cam.y + vh + 30) continue;
      const x = d.x + ox, y = d.y + oy;
      if (d.t === 'blob') { ctx.fillStyle = d.c; ctx.globalAlpha = d.a; ctx.beginPath(); ctx.ellipse(x, y, d.r, d.r * 0.55, 0, 0, TAU); ctx.fill(); }
      else if (d.t === 'rect') { ctx.save(); ctx.globalAlpha = d.a; ctx.fillStyle = d.c; ctx.translate(x, y); ctx.rotate(d.rot); ctx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s); ctx.restore(); }
      else if (d.t === 'scorch') { ctx.globalAlpha = d.a; const gr = ctx.createRadialGradient(x, y, 1, x, y, d.r); gr.addColorStop(0, 'rgba(10,8,6,0.7)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---- persistent mini-block debris (fall with gravity, then stay) ----
  _pushCrumb(k) { this.crumbs.push(k); if (this.crumbs.length > 1500) this.crumbs.splice(0, this.crumbs.length - 1500); }
  // chunks of a shattered tile: ≈1/10 of a tile, scatter, fall and rest on the ground forever
  crumbsBurst(x, y, m, power = 70) {
    const n = 3 + (Math.random() * 4 | 0), sp = 26 + power * 0.5;
    for (let i = 0; i < n; i++) this._pushCrumb({
      x: x + rand(-7, 7), y: y + rand(-7, 7),
      vx: rand(-sp, sp), vy: -rand(20, 50 + power),
      s: rand(2.2, 3.6), c: Math.random() < 0.5 ? m.c : (m.c2 || m.c),
      rot: rand(0, TAU), vr: rand(-12, 12), rest: false,
    });
  }
  // gore: red flesh bits + white bone shards that fall and pool on the floor as real particles
  goreBurst(x, y, dir = 0, n = 12, color = '#7a1a14') {
    for (let i = 0; i < n; i++) {
      const bone = Math.random() < 0.32;
      this._pushCrumb({
        x: x + rand(-9, 9), y: y + rand(-10, 6),
        vx: rand(-140, 140) + dir * 70, vy: -rand(40, 230),
        s: bone ? rand(1.8, 3.0) : rand(2.2, 4.2),
        c: bone ? pick(['#e8e0cf', '#d8cdb4', '#fff4e2']) : color,
        rot: rand(0, TAU), vr: rand(-16, 16), rest: false, blood: !bone,
      });
    }
  }
  drawCrumbs(ctx, cam) {
    const ox = cam.ox, oy = cam.oy, vw = cam.vw, vh = cam.vh;
    for (const k of this.crumbs) {
      if (k.x < cam.x - 24 || k.x > cam.x + vw + 24 || k.y < cam.y - 24 || k.y > cam.y + vh + 24) continue;
      ctx.save(); ctx.translate(k.x + ox, k.y + oy); ctx.rotate(k.rot);
      ctx.fillStyle = k.c;
      if (k.blood) { ctx.beginPath(); ctx.ellipse(0, 0, k.s * 0.62, k.s * 0.5, 0, 0, TAU); ctx.fill(); }
      else { ctx.fillRect(-k.s / 2, -k.s / 2, k.s, k.s); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-k.s / 2, k.s * 0.18, k.s, k.s * 0.32); }
      ctx.restore();
    }
  }

  _add(p) { if (this.parts.length < 2600) this.parts.push(p); }

  // chunky death burst: blood spray + bone shards. Pesado: cai rápido e assenta no chão.
  gib(x, y, color = '#7a1a14', n = 20) {
    for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), sp = rand(80, 320); this._add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(10, 70), life: rand(0.35, 0.8), max: 0.8, r: rand(2, 5), c: color, g: 2600, shrink: true, land: true }); }
    // lasting red flesh + white bone particles that fall and settle (no painted splatter)
    this.goreBurst(x, y, 0, Math.round(n * 2.1), color);
  }

  spark(x, y, c, n = 6) {
    for (let i = 0; i < n; i++) this._add({
      x, y, vx: rand(-180, 180), vy: rand(-220, 60), life: rand(0.2, 0.5), max: 0.5,
      r: rand(1.5, 3), c, g: 700, glow: true, shrink: true,
    });
  }
  // pedaços de bloco quebrado: pulam pouco e CAEM com gravidade, parando no chão
  chips(x, y, c, n = 5) {
    for (let i = 0; i < n; i++) this._add({
      x, y, vx: rand(-110, 110), vy: rand(-150, -20), life: rand(0.5, 1.0), max: 1.0,
      r: rand(1.5, 3.5), c, g: 2400, shrink: false, land: true,
    });
  }
  blood(x, y, dir = 0, n = 10, color = '#b1322c') {
    for (let i = 0; i < n; i++) this._add({
      x, y, vx: rand(-90, 90) + dir * 90, vy: rand(-150, -10), life: rand(0.25, 0.6), max: 0.6,
      r: rand(1.5, 4), c: color, g: 2600, shrink: true, land: true,
    });
    // a couple of heavier gore chunks
    for (let i = 0; i < (n > 8 ? 3 : 0); i++) this.debris.push({ x, y, vx: rand(-100, 100) + dir * 80, vy: rand(-150, -30), s: rand(2.5, 4.5), c: color, life: rand(0.5, 1.0), max: 1.0, rot: rand(0, TAU), vr: rand(-12, 12) });
  }
  magic(x, y, color = '#a86bff', n = 12) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(40, 200); this._add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: rand(0.3, 0.8), max: 0.8, r: rand(1.5, 3.5), c: color, g: -40, glow: true, shrink: true }); }
  }
  slash(x, y, ang, reach, color = 'rgba(255,255,255,0.9)') { this.slashes.push({ x, y, ang, reach, color, life: 0.16, max: 0.16 }); }
  bolt(x1, y1, x2, y2, color = '#bfe8ff') { this.bolts.push({ x1, y1, x2, y2, color, life: 0.14, max: 0.14, seed: Math.random() * 999 }); }
  shock(x, y, max, color = '#ffd86b') { this.rings.push({ x, y, r: 6, max, life: 0.4, t: 0.4, color }); }
  smoke(x, y, n = 5, c = 'rgba(60,55,50,') {
    for (let i = 0; i < n; i++) this._add({
      x, y, vx: rand(-40, 40), vy: rand(-70, -20), life: rand(0.6, 1.4), max: 1.4,
      r: rand(5, 12), c, g: -30, smoke: true,
    });
  }
  muzzle(x, y, ang) {
    for (let i = 0; i < 5; i++) this._add({
      x, y, vx: Math.cos(ang) * rand(120, 320) + rand(-30, 30), vy: Math.sin(ang) * rand(120, 320) + rand(-30, 30),
      life: rand(0.05, 0.14), max: 0.14, r: rand(2, 4.5), c: '#ffd86b', glow: true, shrink: true,
    });
  }
  explosion(x, y, radius) {
    this.rings.push({ x, y, r: 6, max: radius * 1.3, life: 0.35, t: 0.35, color: '#ff8a3c' });
    for (let i = 0; i < 44; i++) this._add({
      x, y, vx: rand(-1, 1) * rand(120, 520), vy: rand(-1, 1) * rand(120, 520) - 80,
      life: rand(0.25, 0.7), max: 0.7, r: rand(3, 8), c: pick(['#ffd86b', '#ff8a3c', '#ff5b2c', '#fff', '#caa33a']),
      g: 200, glow: true, shrink: true,
    });
    this.smoke(x, y, 16);
    for (let i = 0; i < 14; i++) this.debris.push(this._mkDebris(x, y, '#3a2c1c', 260));
    this.scorch(x, y, radius);     // permanent burn mark on the ground
  }
  text(x, y, str, c = '#fff') {
    this.texts.push({ x, y, str, c, life: 0.8, max: 0.8, vy: -50 });
  }

  // ---- debris chunks (collide with world) -------------------
  _mkDebris(x, y, c, power) {
    const ang = rand(0, TAU);
    return {
      x, y, vx: Math.cos(ang) * rand(40, power), vy: -Math.abs(Math.sin(ang)) * rand(120, power) - 40,
      s: rand(3, 6), c, life: rand(1.2, 2.2), max: 2.2, rot: rand(0, TAU), vr: rand(-10, 10), rest: 0,
    };
  }
  debrisBurst(x, y, c, power = 80) {
    const n = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) if (this.debris.length < 240) this.debris.push(this._mkDebris(x, y, c, power));
  }

  update(dt, world) {
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.smoke) p.r += dt * 10;
      // sangue/estilhaços assentam ao tocar o chão (em vez de "voar" e atravessar)
      if (p.land && world && p.vy >= 0 && world.solidPx(p.x, p.y + (p.r || 1))) {
        p.vy = 0; p.vx *= 0.55; p.g = 0;
      }
    }
    // debris with terrain collision
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { this.debris.splice(i, 1); continue; }
      d.vy += CONFIG.GRAVITY * dt;   // gravidade plena: detritos caem de verdade
      d.rot += d.vr * dt;
      // X
      let nx = d.x + d.vx * dt;
      if (!world.solidPx(nx, d.y)) d.x = nx; else { d.vx *= -0.4; }
      // Y
      let ny = d.y + d.vy * dt;
      if (!world.solidPx(d.x, ny + d.s)) d.y = ny;
      else { if (d.vy > 60) { d.vy *= -0.32; d.vx *= 0.6; } else { d.vy = 0; d.vx *= 0.8; } }
    }
    // persistent mini-block crumbs: full gravity + terrain collision, then they rest & stay
    const T = world ? world.T : 32;
    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const k = this.crumbs[i];
      if (k.rest) {
        // if the block holding it up was demolished, it must fall again — or despawn
        // (35% chance) to keep the scene from drowning in stuck particles
        if (world && !world.solid(k.supC, k.supR)) {
          if (Math.random() < 0.35) { this.crumbs.splice(i, 1); continue; }
          k.rest = false;
        } else continue;
      }
      k.vy = Math.min(k.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
      k.rot += k.vr * dt;
      const nx = k.x + k.vx * dt;
      if (!world || !world.solidPx(nx, k.y)) k.x = nx; else { k.vx *= -0.3; k.vr *= 0.5; }
      const ny = k.y + k.vy * dt;
      if (!world || !world.solidPx(k.x, ny + k.s)) { k.y = ny; }
      else {
        if (k.vy > 130) { k.vy *= -0.26; k.vx *= 0.55; k.vr *= 0.6; }      // small bounce on impact
        else {
          k.vy = 0; k.vx *= 0.5; k.vr = 0;
          if (Math.abs(k.vx) < 8) { k.rest = true; k.vx = 0; k.supC = Math.floor(k.x / T); k.supR = Math.floor((ny + k.s) / T); }  // settle + remember support block
        }
      }
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t -= dt;
      r.r = lerp(r.max, 6, r.t / r.life);
      if (r.t <= 0) this.rings.splice(i, 1);
    }
    // texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= 0.92;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    // slashes & bolts
    for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].life -= dt; if (this.slashes[i].life <= 0) this.slashes.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
  }

  draw(ctx, cam) {
    const ox = cam.ox, oy = cam.oy;
    // rings
    ctx.save();
    for (const r of this.rings) {
      const a = clamp(r.t / r.life, 0, 1);
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = r.color || '#ffd86b'; ctx.lineWidth = 5 * a + 1;
      ctx.beginPath(); ctx.arc(r.x + ox, r.y + oy, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // particles
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      const r = p.shrink ? p.r * a : p.r;
      if (p.smoke) { ctx.fillStyle = p.c + (a * 0.5) + ')'; }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.c; }
      if (p.glow) ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // debris
    for (const d of this.debris) {
      const a = clamp(d.life / 0.6, 0, 1);
      ctx.save(); ctx.globalAlpha = Math.min(1, a);
      ctx.translate(d.x + ox, d.y + oy); ctx.rotate(d.rot);
      ctx.fillStyle = d.c; ctx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // texts
    ctx.textAlign = 'center'; ctx.font = 'bold 16px "Trebuchet MS"';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
      ctx.fillStyle = '#000'; ctx.fillText(t.str, t.x + ox + 1, t.y + oy + 1);
      ctx.fillStyle = t.c; ctx.fillText(t.str, t.x + ox, t.y + oy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    // slashes (melee swoosh arcs)
    for (const sl of this.slashes) {
      const a = clamp(sl.life / sl.max, 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(sl.x + ox, sl.y + oy); ctx.rotate(sl.ang);
      ctx.strokeStyle = sl.color; ctx.lineWidth = 3 + a * 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, sl.reach, -1.0 - (1 - a) * 0.6, 1.0 + (1 - a) * 0.6); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    // lightning bolts (jagged)
    for (const b of this.bolts) {
      const a = clamp(b.life / b.max, 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.lineWidth = 2.5; ctx.beginPath();
      const segs = 8; let sd = b.seed;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, jx = (Math.sin(sd += 1.7) * 10) * (i && i < segs ? 1 : 0), jy = (Math.cos(sd += 2.3) * 10) * (i && i < segs ? 1 : 0);
        const px = lerp(b.x1, b.x2, t) + jx + ox, py = lerp(b.y1, b.y2, t) + jy + oy;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();   // balance the save() opened for the rings (was leaking the zoom transform every frame)
  }
}

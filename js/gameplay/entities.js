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
    // status mágicos aplicados ao acertar um inimigo (balas de feitiço)
    this.freezeT = opts.freezeT || 0; this.slowT = opts.slowT || 0; this.slowK = opts.slowK || 0.5;
    this.burnT = opts.burnT || 0; this.burnDps = opts.burnDps || 0;
    this.homing = opts.homing || false;   // míssil teleguiado (procura o inimigo mais próximo)
    // ---- MECÂNICAS NOVAS do arsenal expandido ----
    this.poison = opts.poison || false;   // envenena o inimigo ao acertar
    this.poisonT = opts.poisonT || 4; this.poisonDps = opts.poisonDps || 5;
    this.stun = opts.stun || 0;           // atordoa (staggera) o inimigo ao acertar
    this.launch = opts.launch || 0;       // arremessa o inimigo PRO ALTO ao acertar
    this.blast = opts.blast || 0;         // arremessa o inimigo p/ LONGE (voa pra fora da câmera)
    this.teleUp = opts.teleUp || 0;       // TELETRANSPORTA o inimigo N tiles pra cima
    this.chain = opts.chain || 0;         // relâmpago em cadeia: salta p/ N inimigos próximos
    this.chainRange = opts.chainRange || 150; this.chainDmg = opts.chainDmg || null;
    this.bounce = opts.bounce || 0;       // ricocheteia nas paredes N vezes
    this.split = opts.split || null;      // estilhaça em fragmentos ao morrer {n,kind,speed,dmg,...}
    this.boomerang = opts.boomerang || 0; // retorna ao dono após `boomerang` segundos (0 = nunca)
    this.owner = opts.owner || null;      // dono (p/ retorno do bumerangue)
    this.ghost = opts.ghost || false;     // ignora o terreno (bumerangues/projéteis fantasma)
    this._age = 0;
  }
  // fragmenta em vários projéteis menores (bombas de fragmentação, prisma…)
  _burst(game) {
    if (!this.split || this._didSplit) return; this._didSplit = true;
    const s = this.split, n = s.n || 5;
    for (let i = 0; i < n; i++) {
      const a = (s.radial ? (i / n) * TAU : this.ang + (i - (n - 1) / 2) * (s.spread || 0.5));
      game.bullets.push(new Bullet(this.x, this.y, a, s.speed || 560, Object.assign(
        { faction: this.faction, kind: s.kind || 'ember', dmg: s.dmg || 8, tileDmg: s.tileDmg || 6,
          r: s.r || 3, life: s.life || 0.5, knock: s.knock || 60, grav: s.grav || 0, color: s.color }, s.opts || {})));
    }
  }
  detonate(game) {
    this._burst(game);
    if (this.explosive > 0) game.world.explode(this.x, this.y, this.explosive, this.dmg);
    else { game.fx.spark(this.x, this.y, this.color, 4); }
    this.alive = false;
  }
  update(dt, game) {
    this._age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.detonate(game); return; }
    // ---- BUMERANGUE: depois de `boomerang`s, curva de volta ao dono ----
    if (this.boomerang && this._age > this.boomerang) {
      const o = this.owner || game.player;
      if (o && !o.dead) {
        const ta = Math.atan2(o.cy - this.y, o.cx - this.x), ca = Math.atan2(this.vy, this.vx);
        let d = ta - ca; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const na = ca + clamp(d, -7 * dt, 7 * dt), sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp; this.ang = na;
        if (this.faction === 'player' && aabb({ x: this.x - 8, y: this.y - 8, w: 16, h: 16 }, o)) this.alive = false;   // recolhido
      }
    }
    if (this.kind === 'fireball' && Math.random() < 0.7) game.fx.spark(this.x, this.y, pick(['#ff8a3c', '#ffd86b', '#ff5b2c']), 1); // rastro flamejante
    if ((this.kind === 'meteor' || this.kind === 'wisp') && Math.random() < 0.85) game.fx.spark(this.x, this.y, pick(['#ff8a3c', '#ffd86b', this.color || '#ff5b2c']), 1);
    if ((this.kind === 'plasma' || this.kind === 'orb') && Math.random() < 0.4) game.fx.spark(this.x, this.y, this.color, 1);
    if (this.kind === 'void' && Math.random() < 0.5) game.fx.spark(this.x + rand(-4, 4), this.y + rand(-4, 4), '#c479ff', 1);
    if (this.homing && this.faction === 'player') {                       // míssil arcano teleguiado
      const e = game.nearestEnemy ? game.nearestEnemy(this.x, this.y, 460) : null;
      if (e) {
        const ta = Math.atan2(e.cy - this.y, e.cx - this.x), ca = Math.atan2(this.vy, this.vx);
        let d = ta - ca; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const na = ca + clamp(d, -4 * dt, 4 * dt), sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp; this.ang = na;
        game.fx.spark(this.x, this.y, '#ff7be0', 1);
      }
    }
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
        if (this.ghost) continue;                              // FANTASMA: atravessa o terreno
        const T = game.world.T;
        const c = Math.floor(this.x / T), r = Math.floor(this.y / T);
        if (this.bounce > 0) {                                 // RICOCHETE: reflete na parede e segue
          this.bounce--;
          const hx = game.world.solidPx(this.x + sign(this.vx) * (this.r + 2), this.y);
          const hy = game.world.solidPx(this.x, this.y + sign(this.vy) * (this.r + 2));
          if (hx) this.vx = -this.vx; if (hy) this.vy = -this.vy;
          if (!hx && !hy) { this.vx = -this.vx; this.vy = -this.vy; }
          this.x += this.vx * dt / steps * 1.5; this.y += this.vy * dt / steps * 1.5;
          this.ang = Math.atan2(this.vy, this.vx);
          game.fx.spark(this.x, this.y, this.color, 3);
          return;
        }
        if (this.explosive > 0) { this.detonate(game); }
        else {
          this._burst(game);
          game.carveTiles(c, r, this.tileDmg, { power: 70 });   // ~2 tiles de altura + ~40% um 3º
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
    } else if (this.kind === 'fireball') {              // bola de fogo cintilante (mago) — núcleo claro + brilho
      const fl = 0.82 + Math.sin(this.life * 38) * 0.18;
      ctx.shadowColor = '#ff7a2c'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff5b2c'; ctx.beginPath(); ctx.arc(x, y, this.r * 1.3 * fl, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffae3c'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.95, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(x - Math.cos(this.ang) * this.r * 0.3, y - Math.sin(this.ang) * this.r * 0.3, this.r * 0.5, 0, TAU); ctx.fill();
    } else if (this.kind === 'slug') {                 // tracer alongado (arcabuz/incendiária)
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = this.color || '#bfe8ff'; ctx.shadowColor = this.color || '#bfe8ff'; ctx.shadowBlur = 8;
      ctx.fillRect(-7, -1.4, 14, 2.8); ctx.beginPath(); ctx.arc(7, 0, 1.7, 0, TAU); ctx.fill();
    } else if (this.kind === 'grenade') {              // bomba em arco (rola/gira)
      ctx.translate(x, y); ctx.rotate(this.rot || 0);
      ctx.fillStyle = this.color || '#2a2620'; ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#15110e'; ctx.fillRect(-this.r * 0.32, -this.r - 1, this.r * 0.64, this.r * 0.5);   // gargalo
      ctx.fillStyle = pick(['#ffd86b', '#ff8a3c']); ctx.beginPath(); ctx.arc(0, -this.r - 1.5, 1.6, 0, TAU); ctx.fill(); // pavio
    } else if (this.kind === 'ice') {                  // estilhaço de gelo (losango)
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = this.color || '#bfe8ff'; ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(this.r * 1.9, 0); ctx.lineTo(0, -this.r); ctx.lineTo(-this.r * 1.2, 0); ctx.lineTo(0, this.r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eaf8ff'; ctx.beginPath(); ctx.moveTo(this.r * 1.2, 0); ctx.lineTo(0, -this.r * 0.5); ctx.lineTo(0, this.r * 0.5); ctx.closePath(); ctx.fill();
    } else if (this.kind === 'spark') {                // raio elétrico (faísca em ziguezague)
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.strokeStyle = this.color || '#bff0ff'; ctx.shadowColor = '#bff0ff'; ctx.shadowBlur = 10; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-this.r * 2, 0); ctx.lineTo(-this.r * 0.6, -this.r * 0.7); ctx.lineTo(this.r * 0.4, this.r * 0.5); ctx.lineTo(this.r * 2, 0); ctx.stroke();
    } else if (this.kind === 'disc') {                 // lâmina giratória serrilhada
      ctx.translate(x, y); ctx.rotate(this.rot || 0);
      ctx.fillStyle = this.color || '#d8dee6';
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? this.r : this.r * 0.62; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a3e44'; ctx.beginPath(); ctx.arc(0, 0, this.r * 0.28, 0, TAU); ctx.fill();
    } else if (this.kind === 'flask') {                // frasco de ácido
      ctx.translate(x, y); ctx.rotate(this.rot || 0);
      ctx.fillStyle = '#2a3a2a'; ctx.fillRect(-1.5, -this.r - 2, 3, 3);
      ctx.fillStyle = this.color || '#8ef06a'; ctx.shadowColor = this.color || '#8ef06a'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.9, this.r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-this.r * 0.3, -this.r * 0.2, this.r * 0.22, 0, TAU); ctx.fill();
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
    } else if (this.kind === 'crescent' || this.kind === 'slashwave') {   // lâmina de energia / onda de corte
      ctx.translate(x, y); ctx.rotate(this.ang);
      const r = this.r, col = this.color || '#cfd8e6';
      ctx.globalAlpha = clamp(this.life * 2.4, 0.35, 1);
      ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, r, -1.15, 1.15); ctx.arc(r * 0.62, 0, r, 1.15, -1.15, true); ctx.closePath(); ctx.fill();
      if (this.kind === 'crescent') { ctx.fillStyle = 'rgba(26,12,48,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, -0.95, 0.95); ctx.arc(r * 0.5, 0, r * 0.78, 0.95, -0.95, true); ctx.closePath(); ctx.fill(); }
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.globalAlpha = clamp(this.life * 2, 0.3, 0.9);
      ctx.beginPath(); ctx.arc(0, 0, r, -1.1, -0.55); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke();
    } else if (this.kind === 'plasma') {               // dardo de plasma — cápsula com núcleo claro
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.shadowColor = this.color; ctx.shadowBlur = 12;
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.ellipse(0, 0, this.r * 1.9, this.r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(this.r * 0.4, 0, this.r * 0.9, this.r * 0.5, 0, 0, TAU); ctx.fill();
    } else if (this.kind === 'arc') {                  // raio em cadeia — ziguezague grosso e brilhante
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.strokeStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 12; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-this.r * 2.2, 0); ctx.lineTo(-this.r, -this.r); ctx.lineTo(this.r * 0.4, this.r * 0.8); ctx.lineTo(this.r * 1.4, -this.r * 0.5); ctx.lineTo(this.r * 2.4, 0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    } else if (this.kind === 'rail') {                 // traçador de trilho — feixe fino e longo
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 12; ctx.fillRect(-16, -1.2, 32, 2.4);
      ctx.fillStyle = '#fff'; ctx.fillRect(-16, -0.5, 32, 1);
    } else if (this.kind === 'orb') {                  // orbe de energia pulsante com anel
      const pl = 0.8 + Math.sin(this._age * 20) * 0.2;
      ctx.shadowColor = this.color; ctx.shadowBlur = 12;
      ctx.strokeStyle = this.color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, this.r * 1.5 * pl, 0, TAU); ctx.stroke();
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.45, 0, TAU); ctx.fill();
    } else if (this.kind === 'void') {                 // esfera do abismo — núcleo escuro + borda púrpura
      ctx.shadowColor = '#c479ff'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#c479ff'; ctx.beginPath(); ctx.arc(x, y, this.r * 1.3, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#12081e'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.85, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(196,121,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, this.r * 1.3, this._age * 6, this._age * 6 + 2.2); ctx.stroke();
    } else if (this.kind === 'gear') {                 // engrenagem de latão girando
      ctx.translate(x, y); ctx.rotate(this.rot || 0);
      ctx.fillStyle = this.color || '#caa33a';
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? this.r : this.r * 0.66; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(0, 0, this.r * 0.3, 0, TAU); ctx.fill();
    } else if (this.kind === 'sonic') {                // onda de choque sônica — arcos concêntricos
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.strokeStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 10; ctx.lineWidth = 2.4;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(-i * 2, 0, this.r * (0.5 + i * 0.5), -1.1, 1.1); ctx.stroke(); }
    } else if (this.kind === 'star') {                 // estrela arcana cintilante
      ctx.translate(x, y); ctx.rotate(this.rot || this._age * 4);
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 12;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? this.r * 1.7 : this.r * 0.6; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, this.r * 0.4, 0, TAU); ctx.fill();
    } else if (this.kind === 'shard' || this.kind === 'crystal') {   // estilhaço cristalino
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(this.r * 1.8, 0); ctx.lineTo(0, -this.r); ctx.lineTo(-this.r, 0); ctx.lineTo(0, this.r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(this.r * 1.1, 0); ctx.lineTo(0, -this.r * 0.4); ctx.lineTo(0, this.r * 0.4); ctx.closePath(); ctx.fill();
    } else if (this.kind === 'boomerang') {            // lâmina bumerangue em V, girando
      ctx.translate(x, y); ctx.rotate(this.rot || 0);
      ctx.fillStyle = this.color || '#caa45a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-this.r, -this.r); ctx.lineTo(this.r, 0); ctx.lineTo(-this.r, this.r); ctx.lineTo(-this.r * 0.3, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (this.kind === 'ember' || this.kind === 'wisp' || this.kind === 'meteor') {   // brasa / fogo-fátuo / meteoro
      const c = this.color || '#ff8a3c';
      ctx.shadowColor = c; ctx.shadowBlur = this.kind === 'meteor' ? 16 : 10;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, this.r * (this.kind === 'meteor' ? 1.3 : 1), 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.5, 0, TAU); ctx.fill();
    } else if (this.kind === 'glob') {                 // gosma venenosa com brilho
      ctx.fillStyle = this.color || '#8ef06a'; ctx.shadowColor = this.color || '#8ef06a'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(x, y, this.r, this.r * 1.15, 0, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - this.r * 0.3, y - this.r * 0.3, this.r * 0.25, 0, TAU); ctx.fill();
    } else if (this.kind === 'harpoon') {              // arpão farpado
      ctx.translate(x, y); ctx.rotate(this.ang);
      ctx.fillStyle = '#5a4326'; ctx.fillRect(-9, -1, 12, 2);
      ctx.fillStyle = this.color || '#cfd2d6'; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(10, 0); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(0, -4); ctx.lineTo(4, -0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(0, 4); ctx.lineTo(4, 0.5); ctx.fill();
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
    this.meleeCd = 0; this._prevFeet = null;
    this.morph = null; this.morphT = 0;   // VEX: forma emprestada (herói) + tempo restante
    this.crouching = false;               // agachado (seta p/ baixo no chão): abaixa o cano
    this.shootT = 0; this.attackArc = 0;  // timers de animação: tiro recente / golpe de espada
    // ---- buffs mágicos do Edward (feitiços da tradição Arcana / Transmutação) ----
    this.flyT = 0; this.phaseT = 0; this.invisT = 0; this.hasteT = 0; this.wardHp = 0;
    // ---- técnicas do Ragnarok: postura de arma branca (golpe C) + frenesi/roubo de vida ----
    this.meleeStance = null; this.meleeStanceT = 0; this.berserkT = 0; this.lifestealT = 0;
    // ---- arma branca EQUIPADA (Modo Criação / seleção): define o golpe C ----
    this.meleeKey = null;
  }
  // equipa uma ARMA BRANCA do registro MELEE (usada no Modo Criação; null = espada padrão)
  equipMelee(key) { this.meleeKey = (typeof MELEE !== 'undefined' && MELEE[key]) ? key : null; }
  setHero(i) {
    this.heroIndex = i;
    const H = HEROES[i];
    this.hero = H;
    const oldBottom = (this.h ? this.y + this.h : null);
    this.w = H.w || 24; this.h = H.h || 42;
    if (oldBottom != null) this.y = oldBottom - this.h;
    this.maxhp = H.hp; this.hp = H.hp;
    this.speed = H.speed; this.jumpV = H.jumpV; this.maxJumps = H.jumps;
    this.fallMult = H.fallMult; this.terminalVy = H.terminalVy;   // queda própria (Edward levita)
    this.skin = H.skin; this.spr = H.spr;
    this.morph = null; this.morphT = 0;       // trocar de herói cancela qualquer metamorfose ativa
    this.equipWeapon(H.weaponKey);            // a arma define cadência/pente/recarga/alcance
  }

  // ---- VEX: metamorfose -------------------------------------------------
  // Vira temporariamente OUTRO herói: adota sprite, arma, especial e atributos
  // de movimento dele, mantém a IDENTIDADE (nome) e a vida máxima do Vex,
  // e recupera +VEX_MORPH_HEAL de vida. Reverte sozinho após VEX_MORPH_TIME.
  _tryMetamorph(game) {
    if (this.morph) return false;
    if (!game.testMode) {                                  // FASE DE TESTES: metamorfose ilimitada
      if ((game.vexCharges || 0) <= 0) { Sound.hurt(); game.fx.text(this.cx, this.y - 8, 'SEM METAMORFOSE', '#9a8f7d'); return false; }
      game.vexCharges--;
    }
    const pool = HEROES.map((h, i) => i).filter(i => HEROES[i].key !== 'vex');
    this.morphInto(pick(pool), game);
    return true;
  }
  morphInto(heroIndex, game) {
    const H = HEROES[heroIndex];
    this.morph = H; this.morphT = VEX_MORPH_TIME;
    this.spr = H.spr;
    this.speed = H.speed; this.jumpV = H.jumpV; this.maxJumps = H.jumps;
    this.fallMult = H.fallMult; this.terminalVy = H.terminalVy;
    this.equipWeapon(H.weaponKey);
    this.special = this.maxSpecial;            // barra azul cheia: pode usar o especial emprestado
    this.specCool = 0; this.invuln = Math.max(this.invuln, 0.4);
    this.hp = clamp(this.hp + VEX_MORPH_HEAL, 0, this.maxhp);   // +50 vida (cap na vida máx. do Vex)
    if (game) {
      game.fx.magic(this.cx, this.cy, '#c479ff', 22); game.fx.smoke(this.cx, this.cy, 6);
      game.fx.text(this.cx, this.y - 10, 'METAMORFOSE: ' + H.name + '!', '#c479ff');
      game.cam.addShake(6); game.flashScreen(0.22); Sound.cast();
    }
  }
  unmorph(game) {
    const H = this.hero;
    this.morph = null; this.morphT = 0;
    this.spr = H.spr;
    this.speed = H.speed; this.jumpV = H.jumpV; this.maxJumps = H.jumps;
    this.fallMult = H.fallMult; this.terminalVy = H.terminalVy;
    this.equipWeapon(H.weaponKey);
    if (game) { game.fx.magic(this.cx, this.cy, '#c479ff', 16); game.fx.smoke(this.cx, this.cy, 5); game.fx.text(this.cx, this.y - 10, 'VEX!', '#c479ff'); Sound.swap(); }
  }
  // troca a arma ativa (herói padrão OU override da fase de testes). A WEAPON é
  // a dona da cadência/pente/recarga/comprimento do cano e do visual do braço.
  equipWeapon(key) {
    const w = (typeof WEAPONS !== 'undefined' && WEAPONS[key]) ? WEAPONS[key] : (typeof WEAPONS !== 'undefined' ? WEAPONS.scatter : null);
    this.weaponKey = (w && WEAPONS[key]) ? key : (w ? 'scatter' : key);
    if (!w) { this.clip = 6; this.reloadTime = 0.9; this.gunLen = 16; this.ammo = 6; return; }
    this.clip = w.clip; this.reloadTime = w.reload;
    this.gunLen = w.gunLen || (this.hero && this.hero.gunLen) || 16;
    this.weaponVisual = w.visual;
    this.ammo = this.clip; this.reloading = 0;
  }
  hurt(dmg, dir, game) {
    if (this.invuln > 0 || this.dead || this.phaseT > 0 || (game && game.testMode)) return;   // FASE DE TESTES: vida infinita · etéreo = imune
    if (this.wardHp > 0) {                                  // PELE DE PEDRA: escudo absorve antes da vida
      const a = Math.min(this.wardHp, dmg); this.wardHp -= a; dmg -= a;
      game.fx.spark(this.cx, this.cy, '#caa33a', 6); Sound.hit();
      if (dmg <= 0) { this.flash = 0.1; this.invuln = 0.3; return; }
    }
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
    this.cool = Math.max(0, this.cool - dt * (this.hasteT > 0 ? 1.7 : 1));   // CELERIDADE: cadência acelerada
    this.specCool = Math.max(0, this.specCool - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.attackT = Math.max(0, this.attackT - dt * 5); // melee swing decay
    this.attackArc = Math.max(0, (this.attackArc || 0) - dt * 4); // anim do golpe (~0.25s)
    this.shootT = Math.max(0, (this.shootT || 0) - dt);           // tiro recente (anim agachado-atirando)
    this.swordMode = Math.max(0, (this.swordMode || 0) - dt);
    this.powered = Math.max(0, (this.powered || 0) - dt); // magic-potion buff timer
    this.invisT = Math.max(0, this.invisT - dt); this.hasteT = Math.max(0, this.hasteT - dt);   // buffs de feitiço
    this.berserkT = Math.max(0, this.berserkT - dt); this.lifestealT = Math.max(0, this.lifestealT - dt);   // frenesi/roubo de vida
    if (this.meleeStanceT > 0) { this.meleeStanceT -= dt; if (this.meleeStanceT <= 0) { this.meleeStance = null; game.fx.smoke(this.cx, this.cy, 3); } }   // a postura de arma expira
    const _ah = this.morph || this.hero;
    this.gainSpecial(dt * (_ah.specialRegen || 6)); // passive charge (Edward regenera mana mais rápido)
    if (this.morph) { this.morphT -= dt; if (this.morphT <= 0) this.unmorph(game); }   // VEX: fim da forma

    // ---- mira 1D: vira na direção do movimento e atira sempre para a frente ----
    // (sem mouse; disparo horizontal — funciona também durante o pulo)
    const moveDir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (moveDir !== 0) this.face = moveDir;
    this.aimAng = this.face > 0 ? 0 : Math.PI;

    // ---- AGACHAR: seta p/ baixo no chão (não em escada/parede/investida) ----
    // abaixa o cano (SPR.gunAnchor) e usa as sprites 'crouch'; pode atirar/atacar agachado
    this.crouching = c.down && this.onGround && !this.onLadder && !this.clinging && this.dashT <= 0;

    // ---- movement ----
    let move = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const accel = this.onGround ? 2600 : 1500;
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.face * this.speed * (this.dashSpeedK || 2.5); this.invuln = Math.max(this.invuln, 0.05);
      // smash through terrain and enemies in front
      const T = game.world.T, col = Math.floor((this.cx + this.face * 12) / T);
      for (let r = Math.floor(this.y / T); r <= Math.floor((this.y + this.h) / T); r++) game.world.damage(col, r, 50, { power: 100 });
      game.damageEntitiesRadial(this.cx + this.face * 16, this.cy, this.dashRadius || 28, this.dashDmg || 16, this);
      if (this._explosiveDash > 0) {                      // SILVYR: arranque explosivo (braço mecânico)
        this._explosiveDash -= dt;
        this._exTrail = (this._exTrail || 0) - dt;
        if (this._exTrail <= 0) { this._exTrail = 0.05; game.fx.explosion(this.cx + this.face * 12, this.cy, 22); game.damageEntitiesRadial(this.cx + this.face * 12, this.cy, 30, 14, this); game.cam.addShake(2); }
        game.fx.smoke(this.cx - this.face * 8, this.cy, 1);
        if (this.dashT <= 0) {                            // estouro FINAL maior (já gera fx/som/abalo/dano radial)
          game.world.explode(this.cx + this.face * 18, this.cy, 58, 32);
          this._explosiveDash = 0; this.dashSpeedK = 0; this.dashRadius = 0; this.dashDmg = 0;
        }
      } else {
        game.fx.muzzle(this.cx, this.cy, this.face > 0 ? 0 : Math.PI);
        if (this.dashT <= 0) { this.dashSpeedK = 0; this.dashRadius = 0; this.dashDmg = 0; }   // limpa parâmetros do arranque ao terminar
      }
    } else {
      const tgt = (this.crouching ? this.speed * 0.45 : this.speed) * (this.hasteT > 0 ? 1.45 : 1) * (this.berserkT > 0 ? 1.2 : 1);   // agachado devagar · CELERIDADE/FRENESI aceleram
      if (move !== 0) this.vx = approach(this.vx, move * tgt, accel * dt);
      else this.vx = approach(this.vx, 0, (this.onGround ? 3400 : 1200) * dt);
    }

    // ---- ladders: climb, and STAND on the top rung until you actively press down ----
    const T = game.world.T;
    const feet = this.y + this.h;
    const overlapLadder = game.world.ladderAt(this.cx, this.cy) || game.world.ladderAt(this.cx, feet - 6) || game.world.ladderAt(this.cx, this.y + 6);
    // a ladder tile directly below the feet whose tile above is NOT a ladder = the top rung
    const probeY = feet + 3;
    const ladderTopBelow = game.world.ladderAt(this.cx, probeY) && !game.world.ladderAt(this.cx, probeY - T);

    if (overlapLadder && (c.up || c.down)) this.onLadder = true;
    if (!this.onLadder && ladderTopBelow && c.down) { this.y += 7; this.onLadder = true; }   // step down off the top
    if (!overlapLadder && !ladderTopBelow) this.onLadder = false;
    const onLadder = this.onLadder;

    const jumpEdge = c.jumpPressed();
    if (onLadder) {
      this.jumps = this.maxJumps; this.clinging = false;
      this.vy = (c.up ? -1 : c.down ? 1 : 0) * 190;
      // climbing past the very top: clamp the feet to the top rung so you stand on it like ground
      if (c.up) {
        let topRow = Math.floor(this.cy / T);
        while (game.world.ladderAt(this.cx, (topRow - 1) * T + T / 2)) topRow--;
        const surfaceY = topRow * T;
        if (this.y + this.h <= surfaceY + 2) { this.y = surfaceY - this.h; this.vy = 0; this.onGround = true; this.onLadder = false; }
      }
      if (jumpEdge) { this.onLadder = false; this.vy = -this.jumpV * 0.8; Sound.jump(); }
      if (Math.abs(this.vy) > 10 && Math.random() < 0.2) game.fx.spark(this.cx, this.cy, '#caa07a', 1);
    } else {
      // ---- wall-cling / wall-climb / wall-jump (Broforce-style) ----
      // Tuning compartilhado (CONFIG.WALL_*) para que TODOS os heróis escalem
      // de forma idêntica, independente da velocidade/pulo de cada um.
      const pushDir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      // permite agarrar enquanto sobe a parede (vy do climb = -WALL_CLIMB_V), mas não logo após um pulo forte
      const onWall = !this.onGround && this.hitWall !== 0 && pushDir === this.hitWall && this.vy > -(CONFIG.WALL_CLIMB_V + 40);
      if (onWall) {
        this.clinging = true; this.wallSide = this.hitWall;
        if (jumpEdge) {
          this.vy = -CONFIG.WALL_JUMP_V; this.vx = -this.hitWall * CONFIG.WALL_JUMP_VX;
          this.jumps = 0;                            // consome saltos (evita o "flutuar" do duplo-pulo do Zracks)
          Sound.jump(); game.fx.smoke(this.cx, this.cy, 3);
        }
        else if (c.up) this.vy = -CONFIG.WALL_CLIMB_V;   // climb up
        else if (c.down) this.vy = CONFIG.WALL_SLIDE_V;  // slide down fast
        else this.vy = Math.min(this.vy, CONFIG.WALL_CLING_V); // cling & slow-slide
        if (Math.random() < 0.3) game.fx.spark(this.cx + this.hitWall * 8, this.cy + rand(-8, 10), '#caa07a', 1);
      } else {
        this.clinging = false;
        if (this.onGround) this.jumps = this.maxJumps;
        if (jumpEdge && this.jumps > 0) { this.vy = -this.jumpV; this.jumps--; Sound.jump(); game.fx.smoke(this.cx, this.y + this.h, 3); }
        if (!c.jumpHeld && this.vy < -120) this.vy = -120;
        if (this.hero.canHover && c.jumpHeld && this.vy > 40 && this.jumps <= 0) { this.vy = Math.min(this.vy, 90); }
      }
    }

    // gravity (off while climbing a ladder). Queda "pesada": ao cair aplica FALL_MULT
    // (pulo alto + queda acentuada). Ao agarrar a parede usa gravidade normal — o cap
    // do deslize (WALL_*) controla a descida, então não acelera demais.
    // ---- VOO (feitiço Arcana): levita; ▲/▼ sobem/descem; sem gravidade ----
    if (this.flyT > 0) {
      this.flyT -= dt;
      const vm = (c.down ? 1 : 0) - (c.up ? 1 : 0);
      this.vy = vm !== 0 ? vm * 300 : Math.sin(this.anim * 5) * 16;
      this.clinging = false; this.onLadder = false;
      if (Math.random() < 0.5) game.fx.spark(this.cx + rand(-6, 6), this.y + this.h, '#6fd0ff', 1);
    } else if (!onLadder) {
      // queda "pesada" padrão; heróis podem definir fallMult/terminalVy próprios
      // (ex.: Edward, o mago, cai bem devagar → sensação de levitar)
      const falling = this.vy > 0 && !this.clinging;
      const fm = falling ? (this.fallMult != null ? this.fallMult : CONFIG.FALL_MULT) : 1;
      const term = this.terminalVy || CONFIG.TERMINAL_VY;
      this.vy = Math.min(this.vy + CONFIG.GRAVITY * fm * dt, term);
    }

    // ---- FORMA ETÉREA (feitiço Arcana): noclip — atravessa paredes e tiros ----
    if (this.phaseT > 0) {
      this.phaseT -= dt;
      this.x = clamp(this.x + this.vx * dt, 0, game.world.pixelW - this.w);
      this.y = clamp(this.y + this.vy * dt, -200, game.world.pixelH - this.h);
      this.onGround = false; this.hitWall = 0; this.hitCeil = false;
      if (this.phaseT <= 0) { for (let t = 0; t < 8 && game.world.solidPx(this.cx, this.cy); t++) this.y -= game.world.T; }   // não termina preso na pedra
      if (Math.random() < 0.6) game.fx.spark(this.cx + rand(-8, 8), this.cy + rand(-12, 12), '#9fd0e0', 1);
    } else {
      game.world.moveAndCollide(this, dt);
    }

    // one-way landing on a ladder's top rung: rest on it like solid ground (descend only via DOWN)
    if (!this.onLadder && this.vy >= 0 && !c.down) {
      const fy = this.y + this.h, pY = fy + 1;
      if (game.world.ladderAt(this.cx, pY) && !game.world.ladderAt(this.cx, pY - T)) {
        const surfaceY = Math.floor(pY / T) * T;
        if (this._prevFeet != null && this._prevFeet <= surfaceY + 3) {
          this.y = surfaceY - this.h; this.vy = 0; this.onGround = true; this.jumps = this.maxJumps;
        }
      }
    }
    this._prevFeet = this.y + this.h;

    // ---- weapons ----
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.ammo = this.clip; }
    } else if (c.fire && this.cool <= 0) {
      const w = WEAPONS[this.weaponKey] || WEAPONS.scatter;
      if (this.powered > 0 && w.poweredFire) w.poweredFire(this, game);
      else w.fire(this, game);
      if (w.kick) this.recoilKick(w.kick, game);   // COICE: empurra o corpo p/ trás
      this.shootT = 0.18;   // marca tiro recente (anim "agachado atirando")
    }
    if (c.special && this.specCool <= 0) {
      if (this.hero.special && this.hero.special.metamorph && !this.morph) {
        // VEX em sua forma própria: gasta 1 CARGA e vira um herói aleatório
        if (this._tryMetamorph(game)) this.specCool = 0.4;
        else this.specCool = 0.3;
      } else {
        const ah = this.morph || this.hero;
        if (typeof Grimoire !== 'undefined' && Grimoire.heroHasBook(ah.key)) {
          // HERÓIS COM LIVRO (Edward/Ragnarok): o botão especial usa a HABILIDADE ATIVA da árvore
          Grimoire.tryCast(this, game);
        } else {
          // demais heróis — e o Vex transformado usa o especial EMPRESTADO (barra azul)
          const sp = ah.special;
          if (sp && (game.testMode || this.special >= sp.cost)) {
            sp.use(this, game);
            if (!game.testMode) this.special -= sp.cost;   // FASE DE TESTES: não gasta especial
            this.specCool = sp.cd;
          }
        }
      }
    }

    // ---- melee: golpe em VOLTA do jogador (C), disponível a todo herói ----
    // A "postura" do Ragnarok (martelo/punhos/lâmina ígnea/transcendente) muda este golpe.
    if (c.meleePressed() && this.meleeCd <= 0) {
      const prof = this.meleeProfile();
      this.meleeCd = prof.cd || 0.4; this.attackT = 1; this.attackArc = 1;   // attackArc → anim de golpe (arco de 270°)
      game.meleeRadial(this, prof);
      Sound.slash();
    }

    // anim clocks: anim = seconds (idle), runDist = foot-locked distance (run cycle)
    this.anim += dt;
    if (this.onGround) this.runDist = (this.runDist || 0) + Math.abs(this.vx) * dt;
  }

  // perfil do golpe corpo-a-corpo (C): padrão = espada. O Ragnarok troca por
  // POSTURAS (martelo/punhos de fogo/lâmina ígnea/lâmina transcendente), cada
  // uma com alcance, dano, recuo, efeito (atordoar/incendiar) e visual próprios.
  meleeProfile() {
    const mult = this.berserkT > 0 ? 1.5 : 1;
    // 1) POSTURA do Ragnarok (Códice de Guerra) tem prioridade
    switch (this.meleeStance) {
      case 'hammer':       return { range: 60, dmg: 40 * mult, tileDmg: 60, knock: 520, color: 'rgba(255,210,120,0.95)', shake: 7, stun: 0.8, cd: 0.5 };
      case 'fists':        return { range: 46, dmg: 18 * mult, tileDmg: 14, knock: 160, color: 'rgba(255,150,70,0.95)', shake: 3, ignite: [3, 8], cd: 0.28 };
      case 'flamesword':   return { range: 58, dmg: 32 * mult, tileDmg: 26, knock: 240, color: 'rgba(255,140,60,0.95)', shake: 4, ignite: [3, 7], cd: 0.4 };
      case 'transcendent': return { range: 72, dmg: 38 * mult, tileDmg: 30, knock: 300, color: 'rgba(155,107,255,0.95)', shake: 5, ranged: true, cd: 0.42 };
    }
    // 2) ARMA BRANCA equipada (registro MELEE — Modo Criação / seleção)
    if (this.meleeKey && typeof MELEE !== 'undefined' && MELEE[this.meleeKey]) {
      const w = MELEE[this.meleeKey];
      return Object.assign({}, w, { dmg: (w.dmg != null ? w.dmg : 28) * mult });
    }
    // 3) espada padrão
    return { range: 54, dmg: 28 * mult, tileDmg: 22, knock: 250, color: 'rgba(230,238,255,0.95)', shake: 4, cd: 0.4 };
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
    game.alertEnemies(this.cx, this.cy, 460);   // o barulho do tiro denuncia a posição
  }
  consumeAmmo(n = 1) {
    this.ammo -= n;
    if (this.ammo <= 0) { this.ammo = 0; this.reloading = this.reloadTime; }
  }
  // COICE da arma: empurra o corpo para trás ao disparar. `kick` (px/s):
  // 0 = nenhum · ~80 suave · ~300 agressivo. Kicks médios dão um leve saltinho
  // (tira do chão) p/ o recuo DESLIZAR de verdade em vez de o atrito comê-lo.
  recoilKick(kick, game) {
    if (!kick) return;
    this.vx -= this.face * kick;
    if (kick >= 90) this.vy = Math.min(this.vy, -Math.min(70, kick * 0.16));   // saltinho do coice
    if (kick >= 150 && this.onGround) game.fx.smoke(this.cx - this.face * this.w * 0.4, this.y + this.h, 2);
    if (kick >= 200) game.cam.addShake(kick / 120);
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
    this._drawBuffAura(ctx, cam);
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    if (this.invisT > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.32);             // MANTO ETÉREO: quase invisível
    else if (this.phaseT > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.55);        // FORMA ETÉREA: translúcido
    drawFighter(ctx, this, cam, true);
    this._drawMeleeSwing(ctx, cam);
    ctx.globalAlpha = 1;
  }

  // desenha a ARMA BRANCA empunhada varrendo o arco durante o golpe (tecla C),
  // usando o visual da arma equipada — assim o golpe fica integrado ao sprite.
  _drawMeleeSwing(ctx, cam) {
    // só desenha a arma quando uma ARMA BRANCA está equipada (Modo Criação);
    // sem isso, as posturas do Ragnarok (punhos/martelo) usam as sprites de ataque.
    if (!(this.attackArc > 0) || this.dead || !this.meleeKey || typeof SPR === 'undefined' || !SPR.drawMeleeSwing) return;
    const prof = (typeof MELEE !== 'undefined') ? MELEE[this.meleeKey] : null;
    if (!prof) return;
    const visual = prof.visual || 'sword';
    const col = prof.blade || '#dfe7ef';
    const glow = !!prof.glow;
    const ga = SPR.gunAnchor(this), f = this.face < 0 ? -1 : 1;
    const thrust = prof.swing === 'thrust';
    const t = 1 - clamp(this.attackArc, 0, 1);                   // 0 → 1 conforme o golpe avança
    // ESTOCADA (lança/chicote): avança reto; demais: arco de cima p/ baixo.
    // o `aim` embute o lado (facing) — a arma pixel é assada já rotacionada.
    const sweep = thrust ? (-0.12 + Math.sin(t * Math.PI) * 0.12) : lerp(-1.35, 1.2, t);
    const aim = f > 0 ? sweep : (Math.PI - sweep);
    const reach = thrust ? Math.sin(t * Math.PI) * (prof.range || 60) * 0.35 : 0;
    const worldScale = this.h / 42;
    ctx.save();
    ctx.globalAlpha = clamp(this.attackArc * 2.2, 0.45, 1);
    SPR.drawMeleeSwing(ctx, ga.x + cam.ox + f * reach, ga.y + cam.oy, worldScale, aim, visual, col, glow);
    ctx.restore();
  }

  // auras dos buffs de feitiço (escudo de pedra, voo, pressa)
  _drawBuffAura(ctx, cam) {
    const gx = this.cx + cam.ox, gy = this.cy + cam.oy;
    if (this.wardHp > 0) {                                  // PELE DE PEDRA: casca rochosa
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#caa33a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(gx, gy, this.w * 0.85 + Math.sin(this.anim * 6) * 1.5, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (this.hasteT > 0 && Math.abs(this.vx) > 30) {        // CELERIDADE: rastro de velocidade
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#6fd0ff';
      ctx.fillRect(gx - this.face * this.w * 0.9, this.y + cam.oy + 4, this.face * this.w * 0.6, this.h - 8); ctx.restore();
    }
    if (this.flyT > 0) {                                    // VOO: brilho sob os pés
      const fy = this.y + this.h + cam.oy;
      ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#6fd0ff';
      ctx.beginPath(); ctx.ellipse(gx, fy, this.w * 0.6, 4, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (this.berserkT > 0) {                                // FRENESI (Ragnarok): aura vermelha pulsante
      ctx.save(); ctx.globalAlpha = 0.35 + 0.18 * Math.sin(this.anim * 12); ctx.strokeStyle = '#d34a3a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(gx, gy, this.w * 0.92 + Math.sin(this.anim * 10) * 2, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (this.meleeStanceT > 0 && this.meleeStance) {        // brilho da arma branca equipada (postura)
      const sc = { hammer: '#ffd86b', fists: '#ff8a3c', flamesword: '#ff8a3c', transcendent: '#9b6bff' }[this.meleeStance] || '#fff';
      ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = sc; ctx.shadowColor = sc; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(gx + this.face * this.w * 0.55, gy - 2, 5 + Math.sin(this.anim * 8) * 1.5, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}

/* ---------------- Minion: invocações aliadas (feitiços de Invocação) ----
   Criatura aliada (golem, lobos, esqueleto, totem, servo dominado) que caça
   inimigos e luta por Edward. Some após `life` segundos ou ao morrer. Os
   inimigos podem feri-la (ver Game._bulletCollisions e Enemy contato).      */
const MINION_DEFS = {
  golem:    { w: 40, h: 54, hp: 220, speed: 90,  dmg: 34, range: 0,   life: 16, spr: 'ogre',     aura: '#9fe0a0', knock: 260 },
  wolf:     { w: 30, h: 32, hp: 50,  speed: 300, dmg: 16, range: 0,   life: 12, spr: 'wolf',     aura: '#bff0ff', knock: 120, leap: true },
  skeleton: { w: 28, h: 48, hp: 60,  speed: 120, dmg: 14, range: 520, life: 16, spr: 'skeleton', aura: '#cfe8a0', knock: 80 },
  totem:    { w: 22, h: 36, hp: 130, speed: 0,   dmg: 0,  range: 0,   life: 14, spr: null,       aura: '#7be08a', knock: 0, totem: true },
  thrall:   { w: 30, h: 46, hp: 120, speed: 150, dmg: 18, range: 0,   life: 18, spr: 'cultist',  aura: '#7be08a', knock: 140 },
};

class Minion extends Entity {
  constructor(x, y, kind, opts = {}) {
    const D = MINION_DEFS[kind] || MINION_DEFS.wolf;
    const w = opts.w || D.w, h = opts.h || D.h;
    super(x - w / 2, y - h, w, h);
    this.kind = kind; this.def = D; this.faction = 'ally';
    this.spr = opts.spr || D.spr; this.skin = { tone: '#9fb0a0', outfit: '#3a4a3a', weapon: 'none' };
    this.hp = this.maxhp = opts.hp || D.hp;
    this.speed = opts.speed != null ? opts.speed : D.speed;
    this.dmg = opts.dmg || D.dmg; this.knock = D.knock;
    this.ranged = opts.ranged != null ? opts.ranged : D.range > 0;
    this.range = D.range || 480; this.aura = D.aura;
    this.lifeT = D.life; this.atkCd = 0; this.pulseT = 0; this.aimAng = 0; this.gunLen = 16;
  }
  hurt(dmg, dir, game) {
    if (!this.alive) return;
    this.hp -= dmg; this.flash = 0.1; this.vx += dir * 30;
    game.fx.blood(this.cx, this.cy, dir, 4, this.aura);
    if (this.hp <= 0) this.die(game);
  }
  die(game) { this.alive = false; game.fx.magic(this.cx, this.cy, this.aura, 14); game.fx.smoke(this.cx, this.cy, 4); }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.lifeT -= dt;
    if (this.lifeT <= 0) { this.die(game); return; }

    if (this.def.totem) { this._updateTotem(dt, game); return; }

    const target = game.nearestEnemy ? game.nearestEnemy(this.cx, this.cy, 900) : null;
    if (target) {
      const dx = target.cx - this.cx, dy = target.cy - this.cy, ad = Math.abs(dx);
      this.face = dx >= 0 ? 1 : -1; this.aimAng = this.face > 0 ? 0 : Math.PI;
      if (this.ranged && ad < this.range && Math.abs(dy) < 150 && lineClear(game.world, this.cx, this.cy, target.cx, target.cy)) {
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.atkCd <= 0) {
          game.bullets.push(new Bullet(this.cx + this.face * 14, this.cy - 4, this.aimAng, 760, { faction: 'player', kind: 'arrow', dmg: this.dmg, tileDmg: 4, r: 3, life: 1.2 }));
          game.fx.muzzle(this.cx + this.face * 14, this.cy - 4, this.aimAng); Sound.bow(); this.atkCd = 1.1;
        }
      } else {
        this.vx = approach(this.vx, sign(dx) * this.speed, 1600 * dt);
        if (this.onGround && this.def.leap && ad < 240 && Math.random() < 0.03) { this.vy = -420; this.vx = sign(dx) * this.speed * 1.2; }
        if (this.hitWall === sign(this.vx) && this.onGround && this.vx !== 0) this.vy = -560;
        if (this.atkCd <= 0 && aabb({ x: this.x - 4, y: this.y, w: this.w + 8, h: this.h }, target)) {
          target.hurt(this.dmg, this.face, game); target.vx += this.face * this.knock; target.vy -= 60;
          this.atkCd = 0.55; this.attackT = 1; game.fx.spark(target.cx, target.cy, this.aura, 6);
        }
      }
    } else this.vx = approach(this.vx, 0, 1200 * dt);

    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    game.world.moveAndCollide(this, dt);
    if (this.y > game.world.pixelH + 80) this.alive = false;
    this.anim += dt;
    if (this.onGround) this.runDist = (this.runDist || 0) + Math.abs(this.vx) * dt;
  }
  _updateTotem(dt, game) {
    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    this.vx = 0; game.world.moveAndCollide(this, dt); this.anim += dt;
    this.pulseT -= dt;
    if (this.pulseT <= 0) {                                 // pulso de cura + dano a inimigos colados
      this.pulseT = 1.0;
      const p = game.player;
      if (p && !p.dead && Math.hypot(p.cx - this.cx, p.cy - this.cy) < 7 * CONFIG.TILE) {
        p.hp = clamp(p.hp + 10, 0, p.maxhp); game.fx.text(p.cx, p.y - 6, '+10', '#7be08a');
      }
      for (const e of (game.enemiesInRadius ? game.enemiesInRadius(this.cx, this.cy, 2 * CONFIG.TILE) : [])) e.hurt(8, sign(e.cx - this.cx) || 1, game);
      game.fx.shock(this.cx, this.cy, 2 * CONFIG.TILE, '#7be08a');
    }
  }
  draw(ctx, cam) {
    const gx = this.cx + cam.ox, fy = this.y + this.h + cam.oy;
    // anel aliado (distingue dos inimigos)
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = this.aura; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(gx, fy - 2, this.w * 0.6, 4, 0, 0, TAU); ctx.stroke(); ctx.restore();
    if (this.def.totem) { this._drawTotem(ctx, cam); return; }
    if (this.flash > 0 && Math.floor(this.flash * 50) % 2 === 0) { /* drawFighter já trata flash em inimigos, aqui só sprite */ }
    drawFighter(ctx, this, cam, true);
    // leve tonalidade aliada por cima
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = this.aura;
    ctx.fillRect(this.x + cam.ox, this.y + cam.oy, this.w, this.h); ctx.restore();
  }
  _drawTotem(ctx, cam) {
    const x = this.x + cam.ox, y = this.y + cam.oy, w = this.w, h = this.h, gl = 0.6 + 0.4 * Math.sin(this.anim * 4);
    ctx.fillStyle = '#5a4326'; ctx.fillRect(x + w * 0.35, y + h * 0.4, w * 0.3, h * 0.6);   // poste
    ctx.fillStyle = '#3a5a2a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.35, w * 0.5, 0, TAU); ctx.fill();  // cabeça
    ctx.fillStyle = `rgba(123,224,138,${gl})`; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.35, w * 0.28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#15110e'; ctx.fillRect(x + w * 0.32, y + h * 0.3, 3, 3); ctx.fillRect(x + w * 0.55, y + h * 0.3, 3, 3);
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

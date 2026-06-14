/* ============================================================
   enemies.js — fantasy bestiary with simple but effective AI
   ============================================================ */

// rough line-of-sight: sample tiles between two points
function lineClear(world, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (world.T * 0.6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (world.solidPx(lerp(x0, x1, t), lerp(y0, y1, t))) return false;
  }
  return true;
}

// ---- custom non-humanoid renders ----------------------------
function drawSlime(ctx, e, cam) {
  const x = e.x + cam.ox, y = e.y + cam.oy, w = e.w, h = e.h;
  const sq = e.onGround ? 1 + Math.sin(e.anim * 4) * 0.06 : 0.85;
  const hh = h * sq, cx = x + w / 2, by = y + h;
  const hurt = e.flash > 0 && Math.floor(e.flash * 50) % 2 === 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, by - 1, w * 0.5, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hurt ? '#fff' : (e.skin.body || '#4a9a4a');
  ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x, by - hh, cx, by - hh); ctx.quadraticCurveTo(x + w, by - hh, x + w, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.30)'; ctx.beginPath(); ctx.ellipse(cx - w * 0.18, by - hh * 0.7, w * 0.14, hh * 0.18, 0, 0, TAU); ctx.fill();
  // eyes
  ctx.fillStyle = '#15110e'; ctx.beginPath(); ctx.arc(cx - 4, by - hh * 0.55, 2.2, 0, TAU); ctx.arc(cx + 4, by - hh * 0.55, 2.2, 0, TAU); ctx.fill();
}
function drawWraith(ctx, e, cam) {
  const x = e.x + cam.ox, y = e.y + cam.oy + Math.sin(e.anim) * 3, w = e.w, h = e.h, cx = x + w / 2;
  const hurt = e.flash > 0 && Math.floor(e.flash * 50) % 2 === 0;
  ctx.save(); ctx.globalAlpha = 0.82;
  ctx.fillStyle = hurt ? '#fff' : (e.skin.body || '#5a4a7a');
  ctx.beginPath(); ctx.arc(cx, y + h * 0.4, w * 0.5, Math.PI, 0);
  // tattered wispy bottom
  const wisps = 4;
  for (let i = 0; i <= wisps; i++) { const wx = x + (w * i / wisps); const wy = y + h * 0.4 + (i % 2 ? h * 0.55 : h * 0.35) + Math.sin(e.anim * 3 + i) * 4; ctx.lineTo(wx, wy); }
  ctx.closePath(); ctx.fill();
  // hood opening + glowing eyes
  ctx.globalAlpha = 1; ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.arc(cx, y + h * 0.34, w * 0.32, 0, TAU); ctx.fill();
  ctx.fillStyle = e.skin.eyes || '#b07bff'; ctx.shadowColor = e.skin.eyes || '#b07bff'; ctx.shadowBlur = 8;
  ctx.fillRect(cx - 5, y + h * 0.3, 3, 4); ctx.fillRect(cx + 2, y + h * 0.3, 3, 4); ctx.shadowBlur = 0;
  ctx.restore();
}

const ENEMY_TYPES = {
  goblin:  { hp: 22,  w: 22, h: 32, speed: 155, aggro: 540, range: 0,   fireCd: 99,  touch: 9,  score: 90, melee: true,
             skin: { tone: '#7aa83e', outfit: '#4a3a22', outfit2: '#2e2414', trim: '#8a6a2a', head: 'bandana', band: '#7a2a2a', hair: '#2e3a1a', weapon: 'dagger', weaponColor: '#bcae8a' } },
  skeleton:{ hp: 34,  w: 22, h: 40, speed: 110, aggro: 520, range: 0,   fireCd: 99,  touch: 12, score: 120, melee: true,
             skin: { tone: '#e8e0cf', outfit: '#6a6256', outfit2: '#46413c', trim: '#8a8275', head: 'skull', eyes: '#9be0ff', weapon: 'sword', weaponColor: '#b8bcc0' } },
  archer:  { hp: 22,  w: 20, h: 38, speed: 80,  aggro: 560, range: 480, fireCd: 1.3, touch: 8,  score: 130, kite: true, atk: 'arrow',
             skin: { tone: '#e8e0cf', outfit: '#3a4a3a', outfit2: '#23301f', trim: '#5a4a2a', head: 'hood', eyes: '#caff7b', weapon: 'bow', weaponColor: '#5a4a2a' } },
  charger: { hp: 50,  w: 26, h: 40, speed: 205, aggro: 600, range: 0,   fireCd: 99,  touch: 22, score: 160, melee: true,
             skin: { tone: '#5a7a3a', outfit: '#5a2a2a', outfit2: '#3a1414', trim: '#8a8a8a', head: 'horns', hair: '#2e3a1a', pauldron: '#3a342c', weapon: 'axe', weaponColor: '#7a7a7a' } },
  knight:  { hp: 95,  w: 26, h: 44, speed: 74,  aggro: 560, range: 0,   fireCd: 99,  touch: 16, score: 230, melee: true, mini: false,
             skin: { tone: '#caa07a', outfit: '#4a4e58', outfit2: '#2e323a', trim: '#8a929d', head: 'greathelm', plume: '#2b6a8a', pauldron: '#8a929d', weapon: 'sword', weaponColor: '#cfd2d6' } },
  wraith:  { hp: 30,  w: 26, h: 34, speed: 130, aggro: 800, range: 440, fireCd: 1.7, touch: 12, score: 210, fly: true, atk: 'dark',
             skin: { body: '#5a4a7a', eyes: '#c79bff', custom: drawWraith } },
  cultist: { hp: 30,  w: 22, h: 42, speed: 72,  aggro: 620, range: 520, fireCd: 1.5, touch: 10, score: 200, kite: true, atk: 'arcane',
             skin: { tone: '#caa07a', outfit: '#2a2040', outfit2: '#170f28', trim: '#7b3aff', robe: true, head: 'hood', eyes: '#b07bff', orb: '#b07bff', weapon: 'staff' } },
  slime:   { hp: 26,  w: 30, h: 24, speed: 95,  aggro: 480, range: 0,   fireCd: 99,  touch: 10, score: 80, melee: true, hop: true,
             skin: { body: '#4a9a4a', custom: drawSlime } },
  ogre:    { hp: 210, w: 40, h: 54, speed: 72,  aggro: 760, range: 560, fireCd: 1.8, touch: 26, score: 720, mini: true, atk: 'boulder',
             skin: { tone: '#8a9a5a', outfit: '#5a4a2a', outfit2: '#3a2e14', trim: '#caa33a', head: 'horns', hair: '#3a2a1a', pauldron: '#6a5a2a', weapon: 'axe', weaponColor: '#6a6a6a' } },
  boss:    { hp: 640, w: 54, h: 66, speed: 56,  aggro: 1300, range: 1000, fireCd: 1.4, touch: 30, score: 3000, boss: true, name: 'O LICH-REI',
             skin: { tone: '#9ab0a0', outfit: '#23203a', outfit2: '#140f24', trim: '#7be0ff', robe: true, head: 'crown', hair: '#cfd6e0', orb: '#7be0ff', cloak: '#2a1040', weapon: 'staff' } },
};

const CHAR2ENEMY = { g: 'goblin', s: 'skeleton', a: 'archer', c: 'charger', k: 'knight', w: 'wraith', z: 'cultist', l: 'slime', M: 'ogre', O: 'boss' };

class Enemy extends Entity {
  constructor(x, y, type) {
    const t = ENEMY_TYPES[type];
    super(x, y - t.h + CONFIG.TILE, t.w, t.h);
    this.type = type; this.def = t; this.faction = 'enemy';
    this.hp = t.hp; this.maxhp = t.hp; this.speed = t.speed;
    this.skin = t.skin; this.fireT = rand(0, t.fireCd); this.touchCd = 0;
    this.boss = !!t.boss; this.mini = !!t.mini; this.name = t.name;
    this.gunLen = t.boss ? 26 : (t.mini ? 22 : 15);
    this.aimAng = 0; this.stagger = 0; this.phase = 0; this.attackT = 0;
    this.hopT = rand(0.4, 1.2); this.bob = rand(0, 6);
    this.score = t.score;
  }
  hurt(dmg, dir, game) {
    this.hp -= dmg; this.flash = 0.1; this.stagger = 0.06;
    this.vx += dir * (this.boss ? 8 : (this.mini ? 26 : 80));
    game.fx.blood(this.cx, this.cy, dir, this.def.skin.body ? 5 : 7, this.skin.eyes && this.type === 'wraith' ? '#7b3aff' : (this.type === 'slime' ? '#3a7a3a' : '#b1322c'));
    if (this.hp <= 0) this.die(game);
    else { game.fx.text(this.cx, this.y - 4, '' + dmg, '#ffd86b'); }
  }
  die(game) {
    this.alive = false;
    const goreC = this.type === 'slime' ? '#3a7a3a' : (this.type === 'wraith' ? '#7b3aff' : '#b1322c');
    game.fx.blood(this.cx, this.cy, 0, 10, goreC); game.fx.chips(this.cx, this.cy, goreC, 8);
    game.fx.smoke(this.cx, this.cy, 4); game.cam.addShake(this.boss ? 16 : 4);
    if (this.type === 'wraith' || this.type === 'cultist' || this.boss) game.fx.magic(this.cx, this.cy, this.skin.eyes || '#b07bff', 14);
    Sound.flesh();
    game.onEnemyKilled(this);
    if (this.boss) game.world.explode(this.cx, this.cy, 100, 30);
    if (Math.random() < (this.boss ? 1 : this.mini ? 0.6 : 0.12)) game.pickups.push(new Pickup(this.cx, this.cy, 'health'));
    // coin drops
    const coins = this.boss ? 30 : this.mini ? 12 : ((Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.18 ? 1 : 0));
    if (coins) game.spawnCoins(this.cx, this.cy, coins);
    if ((this.boss || this.mini) && Math.random() < (this.boss ? 1 : 0.25)) game.pickups.push(new Pickup(this.cx, this.cy - 8, 'life'));
  }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackT = Math.max(0, this.attackT - dt * 5);
    this.fireT -= dt; this.touchCd = Math.max(0, this.touchCd - dt);
    const p = game.player;
    const target = (p && !p.dead) ? p : null;
    const dx = target ? target.cx - this.cx : 0;
    const dy = target ? target.cy - this.cy : 0;
    const adx = Math.abs(dx);
    this.face = dx >= 0 ? 1 : -1;
    if (target) this.aimAng = Math.atan2((target.y + target.h * 0.4) - (this.y + this.h * 0.42), target.cx - this.cx);
    const def = this.def;

    if (def.fly) {
      // flying drift toward a point near the player, then dive to attack
      if (target && adx < def.aggro) {
        const desiredY = target.cy - 50 + Math.sin(game.time * 2 + this.bob) * 24;
        this.vx = approach(this.vx, clamp(dx, -1, 1) * this.speed, 600 * dt);
        this.vy = approach(this.vy, clamp((desiredY - this.cy) * 4, -this.speed, this.speed), 600 * dt);
        const inSight = adx < def.range;
        if (this.fireT <= 0 && inSight) { this.attack(game, target); this.fireT = def.fireCd * rand(0.8, 1.2); }
      } else { this.vx = approach(this.vx, 0, 400 * dt); this.vy = approach(this.vy, Math.sin(game.time * 2) * 30, 400 * dt); }
      this.x += this.vx * dt; this.y += this.vy * dt;
      // soft-collide with solids so they don't phase into walls
      if (game.world.solidPx(this.cx, this.cy)) { this.x -= this.vx * dt; this.vx *= -0.5; }
      this.anim += dt * 3;
    } else {
      if (this.stagger <= 0 && target && adx < def.aggro) {
        let want = sign(dx);
        if (def.kite && adx < def.range * 0.55) want = -sign(dx);
        if (this.boss) want = adx > 140 ? sign(dx) : 0;
        this.vx = approach(this.vx, want * this.speed, 1400 * dt);
        if (this.hitWall === sign(this.vx) && this.onGround && this.vx !== 0) this.vy = -620;
        if (def.melee && this.onGround && adx < 170 && Math.abs(dy) < 70 && Math.random() < 0.04) this.vy = -420;
        if (def.hop) { this.hopT -= dt; if (this.onGround && this.hopT <= 0) { this.vy = -460; this.vx = sign(dx) * this.speed * 1.6; this.hopT = rand(0.6, 1.3); } }
        const inSight = def.range > 0 && adx < def.range && lineClear(game.world, this.cx, this.cy, target.cx, target.cy);
        if (this.fireT <= 0 && inSight) { this.attack(game, target); this.fireT = def.fireCd * rand(0.8, 1.2); }
      } else if (!target) this.vx = approach(this.vx, 0, 1400 * dt);
      this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
      game.world.moveAndCollide(this, dt);
      this.anim += dt * (this.onGround ? 8 : 4);
    }
    if (this.y > game.world.pixelH + 100) { this.hp = 0; this.alive = false; }

    // contact damage
    if (target && this.touchCd <= 0 && aabb(this, target)) {
      this.attackT = 1; target.hurt(def.touch, sign(dx) || 1, game);
      this.touchCd = 0.7; this.vx -= sign(dx) * 60;
    }
  }

  attack(game, target) {
    const m = { x: this.cx + Math.cos(this.aimAng) * (this.gunLen + 4), y: this.y + this.h * 0.42 + Math.sin(this.aimAng) * (this.gunLen + 4) };
    const atk = this.def.atk;
    if (this.boss) { this.bossAttack(game, target, m); return; }
    if (atk === 'arrow') { game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 520, { faction: 'enemy', dmg: 10, kind: 'arrow', r: 3, tileDmg: 5, knock: 90 })); Sound.bow(); }
    else if (atk === 'arcane') { game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 420, { faction: 'enemy', dmg: 12, kind: 'pellet', color: '#b07bff', r: 4, tileDmg: 5 })); game.fx.magic(m.x, m.y, '#b07bff', 4); Sound.cast(); }
    else if (atk === 'dark') { game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 380, { faction: 'enemy', dmg: 11, kind: 'pellet', color: '#7b3aff', r: 4, tileDmg: 4 })); game.fx.magic(m.x, m.y, '#7b3aff', 4); Sound.cast(); }
    else if (atk === 'boulder') { game.bullets.push(new Bullet(m.x, m.y, this.aimAng - rand(0.2, 0.5), 320, { faction: 'enemy', dmg: 18, kind: 'cannon', r: 7, explosive: 60, grav: 760, tileDmg: 30, spin: 8 })); game.cam.addShake(2); Sound.thump(); }
  }

  bossAttack(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) { // arcane fan
      for (let i = -2; i <= 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.17, 400, { faction: 'enemy', dmg: 12, kind: 'pellet', color: '#7be0ff', r: 4, tileDmg: 6 }));
      game.fx.magic(m.x, m.y, '#7be0ff', 10); Sound.cast();
    } else if (this.phase === 1) { // summon undead
      const live = game.enemies.filter(e => e.alive && !e.boss).length;
      if (live < 8) for (let i = 0; i < 2; i++) { const e = new Enemy(this.cx + rand(-40, 40), this.y - 10, Math.random() < 0.5 ? 'skeleton' : 'goblin'); e.invSpawn = 0; game.enemies.push(e); game.fx.magic(e.cx, e.cy, '#7be0ff', 10); }
      game.fx.text(this.cx, this.y - 6, 'LEVANTAI-VOS!', '#7be0ff'); Sound.cast();
    } else { // skull bombs
      for (let i = 0; i < 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng - 0.5 + i * 0.5, 320, { faction: 'enemy', dmg: 22, kind: 'cannon', r: 6, explosive: 64, grav: 720, tileDmg: 32, spin: 10 }));
      game.cam.addShake(4); Sound.thump();
    }
    game.fx.muzzle(m.x, m.y, this.aimAng);
  }

  draw(ctx, cam) {
    drawFighter(ctx, this, cam, true);
    if (this.mini && !this.boss) {
      const x = this.x + cam.ox, y = this.y + cam.oy - 8;
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, this.w, 4);
      ctx.fillStyle = '#b1322c'; ctx.fillRect(x, y, this.w * clamp(this.hp / this.maxhp, 0, 1), 4);
    }
  }
}

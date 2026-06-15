/* ============================================================
   enemies.js — monster bestiary (from the concept art)
     z zombie    w werewolf   d demon(mini)   r dragonman
     O flayer (BOSS — devorador de mentes)
   ============================================================ */

function lineClear(world, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (world.T * 0.6));
  for (let i = 1; i < steps; i++) { const t = i / steps; if (world.solidPx(lerp(x0, x1, t), lerp(y0, y1, t))) return false; }
  return true;
}

const ENEMY_TYPES = {
  zombie:    { spr: 'zombie',    hp: 42,  w: 28, h: 46, speed: 66,  aggro: 520, range: 320, fireCd: 1.7, touch: 12, score: 120, atk: 'blast', gore: '#5a7a3a' },
  werewolf:  { spr: 'werewolf',  hp: 50,  w: 30, h: 44, speed: 235, aggro: 660, range: 360, fireCd: 0.7, touch: 16, score: 180, atk: 'smg', leaper: true, gore: '#7a2a2a' },
  dragonman: { spr: 'dragonman', hp: 140, w: 34, h: 54, speed: 112, aggro: 720, range: 580, fireCd: 1.2, touch: 18, score: 420, atk: 'rifle', kite: true, gore: '#6a1410' },
  demon:     { spr: 'demon',     hp: 230, w: 40, h: 58, speed: 70,  aggro: 780, range: 600, fireCd: 1.9, touch: 26, score: 760, atk: 'cannon', mini: true, gore: '#7a1a14' },
  flayer:    { spr: 'flayer',    hp: 720, w: 56, h: 74, speed: 56,  aggro: 1300, range: 1000, fireCd: 1.3, touch: 30, score: 3200, boss: true, name: 'O DEVORADOR DE MENTES', gore: '#7b3aff' },
};

const CHAR2ENEMY = { z: 'zombie', w: 'werewolf', r: 'dragonman', d: 'demon', O: 'flayer' };

class Enemy extends Entity {
  constructor(x, y, type) {
    const t = ENEMY_TYPES[type];
    super(x, y - t.h + CONFIG.TILE, t.w, t.h);
    this.type = type; this.def = t; this.faction = 'enemy';
    this.hp = t.hp; this.maxhp = t.hp; this.speed = t.speed;
    this.spr = t.spr; this.fireT = rand(0, t.fireCd); this.touchCd = 0;
    this.boss = !!t.boss; this.mini = !!t.mini; this.name = t.name;
    this.gunLen = t.boss ? 30 : (t.mini ? 24 : 18);
    this.aimAng = 0; this.stagger = 0; this.phase = 0; this.attackT = 0;
    this.score = t.score;
  }
  hurt(dmg, dir, game) {
    if (this.dying != null) return;
    this.hp -= dmg; this.flash = 0.1; this.stagger = 0.06;
    this.vx += dir * (this.boss ? 6 : (this.mini ? 22 : 70));
    game.fx.blood(this.cx, this.cy, dir, this.boss ? 10 : 6, this.def.gore);
    if (this.hp <= 0) this.die(game, dir);
    else game.fx.text(this.cx, this.y - 4, '' + dmg, '#ffd86b');
  }
  die(game, dir = 0) {
    if (this.dying != null) return;
    this.dying = this.dyingMax = (this.boss ? 1.2 : 0.55); this.dead = true;
    this.vx = (dir || sign(this.vx) || 1) * (this.boss ? 40 : 160); this.vy = -200;
    const gore = this.def.gore, big = this.boss ? 3 : this.mini ? 2 : 1;
    // a big burst of blood + bones, plus a permanent pool/splatter on the ground
    game.fx.gib(this.cx, this.cy, gore, 22 * big);                 // chunky gore
    game.fx.blood(this.cx, this.cy, dir, 26 * big, gore);          // spray
    game.fx.smoke(this.cx, this.cy, 6 * big);
    game.fx.bloodPool(this.cx, this.y + this.h - 2, gore, 7 * big);// persistent splatter
    game.fx.rubble(this.cx, this.y + this.h - 2, '#e8e0cf');       // scattered bones stay
    game.cam.addShake(this.boss ? 16 : 5); Sound.flesh();
    if (this.boss || this.type === 'flayer') game.fx.magic(this.cx, this.cy, '#b07bff', 20);
    game.onEnemyKilled(this);
    if (this.boss) game.world.explode(this.cx, this.cy, 110, 30);
    if (Math.random() < (this.boss ? 1 : this.mini ? 0.6 : 0.12)) game.pickups.push(new Pickup(this.cx, this.cy, 'health'));
    const coins = this.boss ? 35 : this.mini ? 14 : ((Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.18 ? 1 : 0));
    if (coins) game.spawnCoins(this.cx, this.cy, coins);
    if ((this.boss || this.mini) && Math.random() < (this.boss ? 1 : 0.3)) game.pickups.push(new Pickup(this.cx, this.cy - 8, 'life'));
  }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    if (this.dying != null) {                 // collapsing corpse: fall, fade, then vanish
      this.dying -= dt; this.anim += dt;
      this.vx *= 0.92; this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
      game.world.moveAndCollide(this, dt);
      if (this.onGround && Math.random() < 0.15) game.fx.bloodPool(this.cx, this.y + this.h - 2, this.def.gore, 1);
      if (this.dying <= 0) this.alive = false;
      return;
    }
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackT = Math.max(0, this.attackT - dt * 5);
    this.fireT -= dt; this.touchCd = Math.max(0, this.touchCd - dt);
    const p = game.player, target = (p && !p.dead) ? p : null;
    const dx = target ? target.cx - this.cx : 0, dy = target ? target.cy - this.cy : 0, adx = Math.abs(dx);
    this.face = dx >= 0 ? 1 : -1;
    if (target) { const tg = SPR.gunAnchor(target), sg = SPR.gunAnchor(this); this.aimAng = Math.atan2(tg.y - sg.y, tg.x - sg.x); }
    const def = this.def;

    if (this.stagger <= 0 && target && adx < def.aggro) {
      let want = sign(dx);
      if (def.kite && adx < def.range * 0.5) want = -sign(dx);
      if (this.boss) want = adx > 150 ? sign(dx) : 0;
      this.vx = approach(this.vx, want * this.speed, 1500 * dt);
      if (this.hitWall === sign(this.vx) && this.onGround && this.vx !== 0) this.vy = -640;
      if (def.leaper && this.onGround && adx < 220 && Math.random() < 0.035) { this.vy = -460; this.vx = sign(dx) * this.speed * 1.3; }
      const inSight = def.range > 0 && adx < def.range && lineClear(game.world, this.cx, this.cy, target.cx, target.cy);
      if (this.fireT <= 0 && inSight) { this.attack(game, target); this.fireT = def.fireCd * rand(0.85, 1.15); }
    } else if (!target) this.vx = approach(this.vx, 0, 1500 * dt);

    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    game.world.moveAndCollide(this, dt);
    if (this.y > game.world.pixelH + 100) { this.hp = 0; this.alive = false; }

    if (target && this.touchCd <= 0 && aabb(this, target)) {
      this.attackT = 1; target.hurt(def.touch, sign(dx) || 1, game);
      this.touchCd = 0.7; this.vx -= sign(dx) * 60;
    }
    this.anim += dt;
    if (this.onGround) this.runDist = (this.runDist || 0) + Math.abs(this.vx) * dt;
  }

  attack(game, target) {
    const ga = SPR.gunAnchor(this);
    const m = { x: ga.x + Math.cos(this.aimAng) * (this.gunLen + 4), y: ga.y + Math.sin(this.aimAng) * (this.gunLen + 4) };
    const atk = this.def.atk;
    if (this.boss) { this.bossAttack(game, target, m); return; }
    if (atk === 'blast') {
      for (let i = -1; i <= 1; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.16 + rand(-0.04, 0.04), 540, { faction: 'enemy', dmg: 7, kind: 'pellet', color: '#ffcaa0', r: 3, tileDmg: 4, life: 0.55 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); Sound.shot('shotgun');
    } else if (atk === 'smg') {
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng + rand(-0.07, 0.07), 620, { faction: 'enemy', dmg: 6, kind: 'pellet', color: '#fff2b0', r: 2.5, tileDmg: 3 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); Sound.shot('mg');
    } else if (atk === 'rifle') {
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 760, { faction: 'enemy', dmg: 14, kind: 'pellet', color: '#ffe27a', r: 3, tileDmg: 8 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); game.cam.addShake(2); Sound.shot('rifle');
    } else if (atk === 'cannon') {
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng - rand(0.05, 0.2), 380, { faction: 'enemy', dmg: 22, kind: 'cannon', r: 7, explosive: 64, grav: 520, tileDmg: 34, spin: 8 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); game.cam.addShake(3); Sound.thump();
    }
  }

  bossAttack(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) {
      for (let i = -2; i <= 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.16, 420, { faction: 'enemy', dmg: 12, kind: 'pellet', color: '#b07bff', r: 4, tileDmg: 6 }));
      game.fx.magic(m.x, m.y, '#b07bff', 12); Sound.cast();
    } else if (this.phase === 1) {
      const live = game.enemies.filter(e => e.alive && !e.boss).length;
      if (live < 7) for (let i = 0; i < 2; i++) { const e = new Enemy(this.cx + rand(-50, 50), this.y - 10, Math.random() < 0.5 ? 'zombie' : 'werewolf'); game.enemies.push(e); game.fx.magic(e.cx, e.cy, '#b07bff', 10); }
      game.fx.text(this.cx, this.y - 8, 'SERVOS, A MIM!', '#b07bff'); Sound.cast();
    } else {
      for (let i = 0; i < 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng - 0.5 + i * 0.5, 360, { faction: 'enemy', dmg: 20, kind: 'pellet', color: '#7b3aff', r: 6, explosive: 64, grav: 680, tileDmg: 30 }));
      game.cam.addShake(4); Sound.cast();
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

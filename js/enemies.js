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
  zombie:    { spr: 'zombie',    label: 'Zumbi',        hp: 42,  w: 28, h: 46, speed: 66,  aggro: 520, range: 320, fireCd: 1.7, touch: 12, score: 120, atk: 'blast', gore: '#5a7a3a' },
  werewolf:  { spr: 'werewolf',  label: 'Lobisomem',    hp: 50,  w: 30, h: 44, speed: 235, aggro: 660, range: 360, fireCd: 0.7, touch: 16, score: 180, atk: 'smg', leaper: true, gore: '#7a2a2a' },
  dragonman: { spr: 'dragonman', label: 'Homem-Dragão', hp: 140, w: 34, h: 54, speed: 112, aggro: 720, range: 580, fireCd: 1.2, touch: 18, score: 420, atk: 'rifle', kite: true, gore: '#6a1410' },
  demon:     { spr: 'demon',     label: 'Demônio',      hp: 230, w: 40, h: 58, speed: 70,  aggro: 780, range: 600, fireCd: 1.9, touch: 26, score: 760, atk: 'cannon', mini: true, gore: '#7a1a14' },
  wolf:      { spr: 'wolf',      label: 'Lobo',         hp: 34,  w: 30, h: 36, speed: 285, aggro: 720, range: 0,   fireCd: 99,  touch: 14, score: 140, leaper: true, gore: '#6a3a2a' },        // feral, fast melee
  direwolf:  { spr: 'direwolf',  label: 'Lobo-Gigante', hp: 90,  w: 40, h: 46, speed: 230, aggro: 820, range: 0,   fireCd: 99,  touch: 22, score: 360, leaper: true, mini: true, gore: '#5a2e22' }, // pack alpha
  // --- novos inimigos (criados p/ a Fase de Testes) ---
  skeleton:  { spr: 'skeleton',  label: 'Esqueleto',     hp: 46,  w: 28, h: 48, speed: 120, aggro: 640, range: 520, fireCd: 1.3, touch: 12, score: 200, atk: 'arrow', gore: '#d8d0bc' },
  ghoul:     { spr: 'ghoul',     label: 'Carniçal',      hp: 60,  w: 30, h: 46, speed: 250, aggro: 680, range: 0,   fireCd: 99,  touch: 18, score: 220, leaper: true, gore: '#6a7a3a' },
  imp:       { spr: 'imp',       label: 'Diabrete',      hp: 30,  w: 22, h: 34, speed: 240, aggro: 700, range: 440, fireCd: 0.9, touch: 12, score: 180, atk: 'fire', leaper: true, gore: '#b23425' },
  ogre:      { spr: 'ogre',      label: 'Ogro',          hp: 300, w: 46, h: 64, speed: 80,  aggro: 760, range: 0,   fireCd: 99,  touch: 30, score: 700, mini: true, gore: '#7a5a3a' },
  musketeer: { spr: 'musketeer', label: 'Mosqueteiro',   hp: 70,  w: 28, h: 50, speed: 110, aggro: 760, range: 640, fireCd: 1.6, touch: 14, score: 280, atk: 'rifle', kite: true, gore: '#7a2a2a' },
  cultist:   { spr: 'cultist',   label: 'Cultista',      hp: 90,  w: 30, h: 50, speed: 90,  aggro: 820, range: 640, fireCd: 1.8, touch: 16, score: 360, atk: 'cannon', gore: '#3a2a5a' },
  specter:   { spr: 'specter',   label: 'Espectro',      hp: 54,  w: 30, h: 48, speed: 140, aggro: 900, range: 520, fireCd: 1.1, touch: 16, score: 300, atk: 'smg', fly: true, gore: '#7b3aff' },
  hellhound: { spr: 'hellhound', label: 'Cão Infernal',  hp: 60,  w: 32, h: 38, speed: 320, aggro: 780, range: 0,   fireCd: 99,  touch: 18, score: 260, leaper: true, gore: '#b23425' },
  flayer:    { spr: 'flayer',    label: 'O Devorador',  hp: 720, w: 64, h: 96, speed: 56,  aggro: 1300, range: 1000, fireCd: 1.3, touch: 30, score: 3200, boss: true, mythos: true, name: 'O DEVORADOR DE MENTES', gore: '#7b3aff' },
  // ===== MYTHOS: chefes colossais (2x–4x os personagens) — spritesheet pixel-art própria + padrões de ataque =====
  necromancer: { spr: 'necromancer', label: 'Necromante Ancião',  hp: 900,  w: 64,  h: 132, speed: 60,  aggro: 1100, range: 760, fireCd: 1.4, touch: 24, score: 2600, boss: true, mythos: true, name: 'O NECROMANTE ANCIÃO',         gore: '#6a3aa0' },
  ratking:     { spr: 'ratking',     label: 'Rei-Rato Bicéfalo',  hp: 820,  w: 76,  h: 120, speed: 120, aggro: 1000, range: 560, fireCd: 1.0, touch: 26, score: 2400, boss: true, mythos: true, leaper: true, name: 'CHITTR, O BICÉFALO', gore: '#7a2a2a' },
  fenrir:      { spr: 'fenrir',      label: 'Lobo Colossal',      hp: 880,  w: 120, h: 104, speed: 215, aggro: 1100, range: 300, fireCd: 1.3, touch: 30, score: 2800, boss: true, mythos: true, leaper: true, name: 'FENRAHK, DEVORADOR DE LUAS', gore: '#3a2e26' },
  titan:       { spr: 'titan',       label: 'Titã Carrasco',      hp: 1300, w: 104, h: 188, speed: 64,  aggro: 1000, range: 620, fireCd: 1.5, touch: 34, score: 3400, boss: true, mythos: true, name: 'O CARRASCO INFERNAL',       gore: '#7a1a14' },
};

const CHAR2ENEMY = { z: 'zombie', w: 'werewolf', r: 'dragonman', d: 'demon', O: 'flayer', f: 'wolf', F: 'direwolf' };

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
    // --- percepção / patrulha ---
    this.alert = 0;                 // >0 = está ciente do jogador (decai ao perdê-lo de vista)
    this.patrolDir = pick([-1, 0, 1]);
    this.patrolT = rand(0.6, 2.2);
    this.react = 0;                 // pequeno atraso de reação antes de atirar ao avistar
    // --- status mágicos (feitiços do Edward) ---
    this.freezeT = 0; this.sleepT = 0; this.fearT = 0;       // controle: congelado / dormindo / apavorado
    this.slowT = 0; this.slowK = 1;                          // lentidão (mente)
    this.burnT = 0; this.burnDps = 0; this.poisonT = 0; this.poisonDps = 0; this._dotAcc = 0;  // dano-por-tempo
  }
  // --- aplicar status (chamados pelos feitiços / balas mágicas) ---
  freeze(t)        { if (this.boss) t *= 0.4; this.freezeT = Math.max(this.freezeT, t); this.sleepT = 0; }
  sleep(t)         { if (this.boss) return; this.sleepT = Math.max(this.sleepT, t); }
  frighten(t)      { if (this.boss) return; this.fearT = Math.max(this.fearT, t); this.sleepT = 0; }
  slow(t, k)       { this.slowT = Math.max(this.slowT, t); this.slowK = k; }
  ignite(t, dps)   { this.burnT = Math.max(this.burnT, t); this.burnDps = Math.max(this.burnDps, dps); }
  envenom(t, dps)  { this.poisonT = Math.max(this.poisonT, t); this.poisonDps = Math.max(this.poisonDps, dps); }
  // ouvir: DESATIVADO — os inimigos percebem o jogador apenas pelo campo de visão.
  // (mantido como no-op pois game.alertEnemies ainda o chama ao disparar)
  hear() {}
  hurt(dmg, dir, game) {
    if (this.dying != null) return;
    if (this.freezeT > 0) { dmg = Math.round(dmg * 1.6); game.fx.iceShatter(this.cx, this.cy, 12); this.freezeT = 0; }  // estilhaça o gelo (dano extra)
    if (this.sleepT > 0) { dmg = Math.round(dmg * 1.4); this.sleepT = 0; }                                                  // golpe furtivo desperta o inimigo
    this.hp -= dmg; this.flash = 0.1; this.stagger = 0.06;
    this.alert = Math.max(this.alert, 4);   // levar um tiro alerta na hora
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
    // explosão de morte — volume ~3x maior, espalhando bem e cobrindo o chão (estilo Broforce)
    game.fx.gib(this.cx, this.cy, gore, 30 * big);                 // faíscas + bits de gore
    game.fx.blood(this.cx, this.cy, dir, 34 * big, gore);          // spray de sangue
    game.fx.smoke(this.cx, this.cy, 7 * big);
    game.fx.goreBurst(this.cx, this.cy, dir, 110 * big, gore);     // muitos bits pequenos (carne + ossos) que assentam no chão
    game.fx.goreChunks(this.cx, this.cy, dir, 22 * big, gore);     // PEDAÇOS GRANDES: ossos e partes do corpo
    game.cam.addShake(this.boss ? 16 : 5); Sound.flesh();
    if (this.boss || this.type === 'flayer') game.fx.magic(this.cx, this.cy, '#b07bff', 20);
    game.onEnemyKilled(this);
    if (this.boss) game.world.explode(this.cx, this.cy, 110, 30);
    if (Math.random() < (this.boss ? 1 : this.mini ? 0.6 : 0.12)) game.pickups.push(new Pickup(this.cx, this.cy, 'health'));
    const coins = this.boss ? 18 : this.mini ? 6 : (Math.random() < 0.35 ? 1 : 0);
    if (coins) game.spawnOregano(this.cx, this.cy, coins);
    if ((this.boss || this.mini) && Math.random() < (this.boss ? 1 : 0.3)) game.pickups.push(new Pickup(this.cx, this.cy - 8, 'life'));
  }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    if (this.dying != null) {                 // collapsing corpse: fall, fade, then vanish
      this.dying -= dt; this.anim += dt;
      this.vx *= 0.92; this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
      game.world.moveAndCollide(this, dt);
      if (this.onGround && Math.random() < 0.12) game.fx.goreBurst(this.cx, this.y + this.h - 4, sign(this.vx) || 1, 2, this.def.gore);
      if (this.dying <= 0) this.alive = false;
      return;
    }
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackT = Math.max(0, this.attackT - dt * 5);
    this.touchCd = Math.max(0, this.touchCd - dt);
    this.alert = Math.max(0, this.alert - dt);
    this.react = Math.max(0, this.react - dt);

    // ---- STATUS MÁGICOS ----------------------------------------------------
    // dano-por-tempo (queimadura / veneno): aplica em "ticks" de ~0,25s
    if (this.burnT > 0 || this.poisonT > 0) {
      this.burnT = Math.max(0, this.burnT - dt); this.poisonT = Math.max(0, this.poisonT - dt);
      this._dotAcc += dt;
      if (this._dotAcc >= 0.25) {
        const tick = (this.burnT > 0 ? this.burnDps : 0) + (this.poisonT > 0 ? this.poisonDps : 0);
        if (tick > 0) { this.hurt(Math.max(1, Math.round(tick * 0.25)), 0, game); }
        this._dotAcc = 0; if (this.dying != null) return;
      }
      // o CORPO pega fogo enquanto queima (chamas subindo); veneno borbulha verde
      if (this.burnT > 0 && Math.random() < 0.7) game.fx.fire(this.cx + rand(-this.w * 0.3, this.w * 0.3), this.cy + rand(-this.h * 0.3, this.h * 0.25), 1);
      if (this.poisonT > 0 && Math.random() < 0.3) game.fx.spark(this.cx + rand(-this.w * 0.3, this.w * 0.3), this.cy + rand(-this.h * 0.3, 0), '#8ef06a', 1);
    }
    this.slowT = Math.max(0, this.slowT - dt);
    this.fearT = Math.max(0, this.fearT - dt);
    const tscale = this.slowT > 0 ? this.slowK : 1;   // fator de lentidão (mente)
    this.fireT -= dt * tscale;

    // CONGELADO ou DORMINDO: imóvel, sem IA (a gravidade ainda atua para não flutuar)
    if (this.freezeT > 0 || this.sleepT > 0) {
      const wasFrozen = this.freezeT > 0;
      this.freezeT = Math.max(0, this.freezeT - dt); this.sleepT = Math.max(0, this.sleepT - dt);
      if (wasFrozen) {
        // o frio causa dano contínuo enquanto preso no gelo
        this._coldAcc = (this._coldAcc || 0) + dt;
        if (this._coldAcc >= 0.4) { this._coldAcc = 0; this.hp -= 3; this.flash = 0.08; if (this.hp <= 0) { this.die(game, 0); return; } }
        // ao DESCONGELAR naturalmente, o gelo se quebra com estilhaços
        if (this.freezeT <= 0) { game.fx.iceShatter(this.cx, this.cy, 16); game.cam.addShake(2); Sound.crumble(); }
      }
      this.vx = approach(this.vx, 0, 1200 * dt);
      if (this.def.fly) this.vy = approach(this.vy, 0, 700 * dt); else this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
      game.world.moveAndCollide(this, dt);
      this.anim += dt; return;
    }

    const p = game.player, target = (p && !p.dead && !(p.invisT > 0)) ? p : null;
    const dx = target ? target.cx - this.cx : 0, dy = target ? target.cy - this.cy : 0, adx = Math.abs(dx);
    const def = this.def;

    // ---- PERCEPÇÃO: SOMENTE visão (cone à frente + linha de visão) ----
    // o jogador só é notado se entrar no campo de visão (lado para o qual o inimigo olha)
    if (target && this.stagger <= 0) {
      const los = lineClear(game.world, this.cx, this.cy, target.cx, target.cy);
      const inFront = sign(dx) === this.face;                       // precisa estar do lado para o qual olha
      const sightRange = def.range > 0 ? def.range : def.aggro;     // corpo-a-corpo "vê" até o aggro
      const sees = inFront && los && adx < sightRange && Math.abs(dy) < 220;
      if (sees) {
        if (this.alert <= 0) this.react = Math.max(this.react, 0.28);  // tempo de "reação" ao avistar
        this.alert = def.boss ? 1 : 3.5;                               // continua ciente por um tempo após perder de vista
      }
    }
    const aware = this.boss || (target && this.alert > 0);

    if (this.stagger <= 0 && this.fearT > 0) {
      // APAVORADO (feitiço Pavor): foge do jogador e não ataca
      const away = (target ? -(sign(target.cx - this.cx)) : 0) || pick([-1, 1]);
      this.face = away; this.aimAng = this.face > 0 ? 0 : Math.PI;
      this.vx = approach(this.vx, away * this.speed * 1.15 * tscale, 1600 * dt);
      if (this.hitWall === sign(this.vx) && this.onGround && this.vx !== 0) this.vy = -560;
    } else if (this.stagger <= 0 && aware) {
      // CIENTE: caça o jogador e atira quando tiver linha de visão
      this.face = dx >= 0 ? 1 : -1;
      this.aimAng = this.face > 0 ? 0 : Math.PI;   // mira 1D: dispara para o lado em que está virado
      let want = sign(dx);
      if (def.kite && adx < def.range * 0.5) want = -sign(dx);
      if (this.boss) want = adx > 150 ? sign(dx) : 0;
      this.vx = approach(this.vx, want * this.speed * tscale, 1500 * dt);
      if (this.hitWall === sign(this.vx) && this.onGround && this.vx !== 0) this.vy = -640;
      if (def.leaper && this.onGround && adx < 220 && Math.random() < 0.035) { this.vy = -460; this.vx = sign(dx) * this.speed * 1.3; }
      const inSight = def.range > 0 && adx < def.range && lineClear(game.world, this.cx, this.cy, target.cx, target.cy);
      if (this.fireT <= 0 && this.react <= 0 && inSight) { this.attack(game, target); this.fireT = def.fireCd * rand(0.85, 1.15); }
    } else if (this.stagger <= 0) {
      // DESPERCEBIDO: patrulha tranquila (anda e para), sem atirar
      this._patrol(dt, game);
    }

    if (def.fly) {
      // VOADORES (Espectro): pairam na altura do alvo, com leve flutuação — sem gravidade
      const ty = target ? target.cy - 26 : this.cy;
      this.vy = approach(this.vy, clamp(ty - this.cy, -140, 140) + Math.sin(this.anim * 4) * 22, 700 * dt);
      this.onGround = false;
    } else {
      this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    }
    game.world.moveAndCollide(this, dt);
    if (this.y > game.world.pixelH + 100) { this.hp = 0; this.alive = false; }

    if (target && this.touchCd <= 0 && aabb(this, target)) {
      this.attackT = 1; target.hurt(def.touch, sign(dx) || 1, game);
      this.touchCd = 0.7; this.vx -= sign(dx) * 60;
    }
    // contato com INVOCAÇÕES aliadas: o inimigo também as fere ao encostar
    if (this.touchCd <= 0 && game.summons && game.summons.length) {
      for (const s of game.summons) if (s.alive && aabb(this, s)) { this.attackT = 1; s.hurt(def.touch + 4, sign(s.cx - this.cx) || 1, game); this.touchCd = 0.7; this.vx -= sign(s.cx - this.cx) * 40; break; }
    }
    this.anim += dt;
    if (this.onGround) this.runDist = (this.runDist || 0) + Math.abs(this.vx) * dt;
  }

  // anda-e-para de forma ociosa; vira em paredes e à beira de buracos (não cai do mapa)
  _patrol(dt, game) {
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      if (this.patrolDir === 0) { this.patrolDir = pick([-1, 1]); this.patrolT = rand(1.2, 2.8); }   // anda
      else { this.patrolDir = 0; this.patrolT = rand(0.8, 2.0); }                                     // descansa
    }
    let dir = this.patrolDir;
    if (dir !== 0) {
      const T = game.world.T;
      // bateu na parede → vira
      if (this.hitWall === dir) dir = this.patrolDir = -dir;
      // beira de buraco à frente → vira (só anda em chão firme)
      if (this.onGround) {
        const aheadX = this.cx + dir * (this.w / 2 + 6);
        const footR = Math.floor((this.y + this.h + 6) / T);
        if (!game.world.solid(Math.floor(aheadX / T), footR)) dir = this.patrolDir = -dir;
      }
      this.face = dir || this.face;
    }
    this.aimAng = this.face > 0 ? 0 : Math.PI;                        // arma aponta para frente (mira 1D)
    this.vx = approach(this.vx, dir * this.speed * 0.42, 900 * dt);   // passo lento e calmo
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
    } else if (atk === 'arrow') {                  // esqueleto arqueiro
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 720, { faction: 'enemy', dmg: 12, kind: 'arrow', r: 3, tileDmg: 6, life: 1.2 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); Sound.bow();
    } else if (atk === 'fire') {                   // diabrete cospe brasa
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 520, { faction: 'enemy', dmg: 12, kind: 'fireball', color: '#ff7a2c', r: 5, tileDmg: 8, life: 1.4 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); Sound.cast();
    }
  }

  // despacha o padrão de ataque conforme o chefe MYTHOS
  bossAttack(game, target, m) {
    switch (this.type) {
      case 'necromancer': return this._atkNecromancer(game, target, m);
      case 'ratking':     return this._atkRatking(game, target, m);
      case 'fenrir':      return this._atkFenrir(game, target, m);
      case 'titan':       return this._atkTitan(game, target, m);
      default:            return this._atkFlayer(game, target, m);
    }
  }
  // fere o jogador se ele estiver dentro de um raio (golpes corpo-a-corpo dos chefes)
  _hitPlayerRadial(game, x, y, radius, dmg, launch) {
    const p = game.player; if (!p || p.dead) return;
    if (Math.hypot(p.cx - x, p.cy - y) < radius) { p.hurt(dmg, sign(p.cx - x) || 1, game); if (launch) p.vy = -launch; }
  }

  _atkFlayer(game, target, m) {
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
  // NECROMANTE: rajada de fogo-fátuo · ergue mortos-vivos · bola de praga
  _atkNecromancer(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) {
      for (let i = -2; i <= 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.14, 470, { faction: 'enemy', dmg: 14, kind: 'fireball', color: '#9bf06a', r: 5, tileDmg: 6, life: 1.6 }));
      game.fx.magic(m.x, m.y, '#8ef06a', 16); Sound.cast();
    } else if (this.phase === 1) {
      const live = game.enemies.filter(e => e.alive && !e.boss).length;
      if (live < 8) for (let i = 0; i < 2; i++) { const e = new Enemy(this.cx + rand(-70, 70), this.y + this.h - 20, pick(['skeleton', 'zombie', 'ghoul'])); game.enemies.push(e); game.fx.magic(e.cx, e.cy, '#8ef06a', 12); }
      game.fx.text(this.cx, this.y - 8, 'ERGUEI-VOS!', '#8ef06a'); game.fx.shock(this.cx, this.cy, 3 * CONFIG.TILE, '#8ef06a'); Sound.cast();
    } else {
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng, 360, { faction: 'enemy', dmg: 22, kind: 'cannon', color: '#8ef06a', r: 8, explosive: 70, grav: 200, tileDmg: 30, life: 2.2, spin: 6 }));
      game.cam.addShake(3); Sound.thump();
    }
    game.fx.muzzle(m.x, m.y, this.aimAng);
  }
  // REI-RATO: rajada de taser · investida com guincho · descarga tesla radial
  _atkRatking(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) {
      for (let i = -1; i <= 1; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.1, 1100, { faction: 'enemy', dmg: 12, kind: 'spark', color: '#bff0ff', r: 3, tileDmg: 5, life: 0.7 }));
      game.fx.miniShock(m.x, m.y, '#bff0ff', 6); Sound.zap();
    } else if (this.phase === 1) {
      this.vx = this.face * this.speed * 2.4; this.vy = -300; game.fx.text(this.cx, this.y - 8, 'GUINCHO!', '#bff0ff'); Sound.thump();
    } else {
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; game.bullets.push(new Bullet(this.cx, this.cy, a, 520, { faction: 'enemy', dmg: 10, kind: 'spark', color: '#bff0ff', r: 3, tileDmg: 3, life: 0.5 })); }
      game.fx.shock(this.cx, this.cy, 5 * CONFIG.TILE, '#bff0ff'); game.fx.miniShock(this.cx, this.cy, '#bff0ff', 10); game.cam.addShake(4); Sound.zap();
    }
    game.fx.muzzle(m.x, m.y, this.aimAng);
  }
  // FENRAHK: bote saltador · uivo (invoca lobos + acelera) · pisão sísmico
  _atkFenrir(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) {
      this.vy = -460; this.vx = this.face * this.speed * 1.4; game.fx.text(this.cx, this.y - 8, 'GRRR!', '#ffd23a'); Sound.flesh();
    } else if (this.phase === 1) {
      const live = game.enemies.filter(e => e.alive && !e.boss).length;
      if (live < 8) for (let i = 0; i < 2; i++) { const e = new Enemy(this.cx + rand(-70, 70), this.y + this.h - 20, pick(['wolf', 'hellhound'])); game.enemies.push(e); }
      this.speed = Math.min(this.speed * 1.04, this.def.speed * 1.4);
      game.fx.text(this.cx, this.y - 10, 'AUUUUU!', '#ffd23a'); game.fx.shock(this.cx, this.cy, 4 * CONFIG.TILE, '#ffd23a'); Sound.thump();
    } else {
      this.attackT = 1; game.fx.shock(this.cx, this.y + this.h, 4 * CONFIG.TILE, '#caa33a'); game.cam.addShake(6);
      this._hitPlayerRadial(game, this.cx, this.cy, 4 * CONFIG.TILE, 22, 320);
      const T = game.world.T, c0 = Math.floor(this.cx / T), fr = Math.floor((this.y + this.h) / T);
      for (let dx = -3; dx <= 3; dx++) if (Math.random() < 0.6) game.world.damage(c0 + dx, fr, 50, { power: 100 });
      Sound.thump();
    }
  }
  // CARRASCO: cutelo sísmico · tiro de canhão · jato de brasas
  _atkTitan(game, target, m) {
    this.phase = (this.phase + 1) % 3;
    if (this.phase === 0) {
      this.attackT = 1; game.fx.shock(this.cx + this.face * 40, this.cy, 3 * CONFIG.TILE, '#8a929d');
      this._hitPlayerRadial(game, this.cx + this.face * 50, this.cy, 3 * CONFIG.TILE, 26, 260); game.cam.addShake(6); Sound.slash();
    } else if (this.phase === 1) {
      game.bullets.push(new Bullet(m.x, m.y, this.aimAng - 0.15, 420, { faction: 'enemy', dmg: 24, kind: 'cannon', r: 8, explosive: 72, grav: 460, tileDmg: 34, life: 2.4, spin: 8 }));
      game.cam.addShake(3); Sound.shot('shotgun');
    } else {
      for (let i = -2; i <= 2; i++) game.bullets.push(new Bullet(m.x, m.y, this.aimAng + i * 0.16, 520, { faction: 'enemy', dmg: 14, kind: 'fireball', color: '#ff7a2c', r: 5, tileDmg: 8, life: 1.3, burnT: 2, burnDps: 6 }));
      game.fx.muzzle(m.x, m.y, this.aimAng); Sound.shot('flame');
    }
  }

  draw(ctx, cam) {
    if (this.def.draw) this.def.draw(ctx, this, cam);   // MYTHOS: desenho procedural próprio
    else drawFighter(ctx, this, cam, true);
    this._drawStatus(ctx, cam);
    if (this.mini && !this.boss) {
      const x = this.x + cam.ox, y = this.y + cam.oy - 8;
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, this.w, 4);
      ctx.fillStyle = '#b1322c'; ctx.fillRect(x, y, this.w * clamp(this.hp / this.maxhp, 0, 1), 4);
    }
  }

  // sobrepõe os efeitos de status mágicos (congelado/dormindo/apavorado/lento/queimando)
  _drawStatus(ctx, cam) {
    if (this.dying != null) return;
    // tremor crescente ao se aproximar do degelo (luta para se libertar)
    const shiver = this.freezeT > 0 && this.freezeT < 1.3 ? Math.sin(this.anim * 42) * 2.2 : 0;
    const x = this.x + cam.ox + shiver, y = this.y + cam.oy, cx = x + this.w / 2;
    if (this.freezeT > 0) {                                // bloco de gelo translúcido + rachaduras
      ctx.fillStyle = 'rgba(150,210,255,0.36)'; ctx.fillRect(x - 2, y - 2, this.w + 4, this.h + 4);
      ctx.strokeStyle = 'rgba(230,248,255,0.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y + 6); ctx.lineTo(x + 6, y); ctx.moveTo(x + this.w, y + this.h - 6); ctx.lineTo(x + this.w - 6, y + this.h);
      ctx.moveTo(cx, y + 2); ctx.lineTo(cx - 3, y + this.h * 0.5); ctx.lineTo(cx + 3, y + this.h);   // rachadura central
      ctx.stroke();
      // brilho de "estrela" de gelo no topo
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(cx - 1, y + 3, 2, 6); ctx.fillRect(cx - 3, y + 5, 6, 2);
    } else if (this.slowT > 0) {                           // halo de lentidão (roxo)
      ctx.fillStyle = 'rgba(155,123,255,0.18)'; ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2);
    }
    if (this.burnT > 0) {                                  // brilho alaranjado de quem está em chamas
      ctx.save(); ctx.globalAlpha = 0.18 + 0.1 * Math.sin(this.anim * 18); ctx.fillStyle = '#ff7a2c';
      ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2); ctx.restore();
    }
    if (this.sleepT > 0) {                                 // "Zzz" flutuante
      ctx.fillStyle = '#cfe8ff'; ctx.font = 'bold 13px "Trebuchet MS"'; ctx.textAlign = 'center';
      const f = Math.sin(this.anim * 3) * 3;
      ctx.fillText('z', cx + 6 + f, y - 4); ctx.fillText('Z', cx + 12 + f, y - 12); ctx.textAlign = 'left';
    } else if (this.fearT > 0) {                           // "!" de pânico
      ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 15px "Trebuchet MS"'; ctx.textAlign = 'center';
      ctx.fillText('!', cx, y - 6); ctx.textAlign = 'left';
    }
  }
}

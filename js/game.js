/* ============================================================
   game.js — orchestration: state, level build, collisions, HUD
   ============================================================ */

class Game {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cam = new Camera(); this.controller = new Controller(); this.fx = new FX(this);
    this.roster = [0, 1];       // both heroes available (Ragnarok & Zracks)
    this.currentHero = 0;
    this.lives = 3; this.score = 0; this.oregano = 0; this.tokens = 0; this.nextLifeAt = 50;
    this.state = 'playing'; this.paused = false; this.testMode = false;
    this.freeze = 0; this.respawnT = 0; this.time = 0;
    this._hud = this._cacheHud();
  }

  _cacheHud() {
    const $ = id => document.getElementById(id);
    return {
      box: $('hud'), name: $('hudName'), hp: $('hpFill'), hpTxt: $('hpTxt'),
      sp: $('spFill'), spTxt: $('spTxt'), lives: $('hudLives'), obj: $('hudObj'),
      roster: $('hudRoster'), portrait: $('portrait'), coins: $('hudCoins'), tokens: $('hudTokens'), buff: $('hudBuff'),
    };
  }

  // ---- level building --------------------------------------
  loadLevel(index) {
    this.levelIndex = index;
    this.loadLevelDef(LEVELS[index]);
  }
  // carrega a partir de uma DEFINIÇÃO de fase (campanha ou criação do editor)
  loadLevelDef(L) {
    this.level = L;
    const rows = L.rows;
    const cols = Math.max(...rows.map(r => r.length));
    const world = new World(cols, rows.length);
    world.game = this;
    this.world = world; this.cam.world = world;
    this.bullets = []; this.enemies = []; this.allies = []; this.pickups = []; this.summons = [];
    this.fx = new FX(this);   // fresh particles/decals per level
    this.explosionQ = []; this.exits = []; this.boss = null; this.decor = [];
    this.prisonersTotal = 0; this.prisonersRescued = 0;
    const T = world.T;
    const DECOR = DECOR_CHARS;   // mapa global (world.js): inclui as novas decorações
    // background-fill layer (interiors of buildings/tunnels) — non-collidable, drawn darker behind
    if (L.bg) for (let r = 0; r < L.bg.length; r++) { const line = L.bg[r]; for (let c = 0; c < line.length; c++) { const id = CHAR2MAT[line[c]]; if (id) world.setBg(c, r, id); } }

    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < cols; c++) {
        const ch = line[c] || '.';
        if (CHAR2MAT[ch]) { world.set(c, r, CHAR2MAT[ch]); continue; }
        const px = c * T, py = r * T;
        if (ch === 'P') { this.spawn = { x: px + (T - 24) / 2, y: (r + 1) * T - 42 }; }
        else if (ch === 'E') { this.exits.push({ x: px, y: py - T, w: T, h: T * 2 }); }
        else if (DECOR[ch]) { this.decor.push({ type: DECOR[ch], x: px, y: py, color: L.bannerColor }); }
        else if (ch === 'o') { const k = new Pickup(px + T / 2, py + T / 2, 'oregano'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
        else if (ch === 'H') { const k = new Pickup(px + T / 2, py + T / 2, 'life'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
        else if (ch === 'Q') { const k = new Pickup(px + T / 2, py + T / 2, 'potion'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
        else if (ch === 'T') { const k = new Pickup(px + T / 2, py + T / 2, 'token'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
        else if (ch >= '1' && ch <= '9') {
          const hi = ch.charCodeAt(0) - 49; // '1'->0
          this.allies.push(new Ally(px + 1, (r + 1) * T - 30, hi));
          this.prisonersTotal++;
        } else if (CHAR2ENEMY[ch]) {
          const e = new Enemy(px, py, CHAR2ENEMY[ch]);
          if (e.boss) this.boss = e;
          this.enemies.push(e);
        }
      }
    }
    if (!this.spawn) this.spawn = { x: T * 2, y: T * 2 };
    world.settle();             // instantly rest any unsupported gravity blocks on load
    world.markGrass();          // freeze grass onto the original surface only (no re-growth after digging)
    this._anchorDecor();        // tie each suspended decoration to the block it hangs on
    this.spawnPlayer(true);
    this.cam.x = clamp(this.player.x - CONFIG.W / 2, 0, Math.max(0, world.pixelW - CONFIG.W));
    this.cam.y = clamp(this.player.y - CONFIG.H / 2, 0, Math.max(0, world.pixelH - CONFIG.H));
    this.state = 'playing'; this.paused = false;
    // VEX: cargas de metamorfose da fase (+1 por vida extra ganha)
    this.vexCharges = (typeof VEX_BASE_CHARGES !== 'undefined' ? VEX_BASE_CHARGES : 3);
    this._prevLives = this.lives;
    this._testWi = 0; this._testEi = null;   // índices da fase de testes (arma/inimigo atual)
    this._setSky(L);
  }

  _setSky(L) {
    this.canvas.style.background = `linear-gradient(${L.sky[0]}, ${L.sky[1]})`;
  }

  // Anchor each suspended decoration (window, banner, candle, torch, vine…) to the nearest
  // structural tile in its natural mounting direction. When that block is destroyed the
  // decoration vanishes (see update()).
  _anchorDecor() {
    const T = this.world.T, W = this.world;
    const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const MOUNT = {
      banner: ['up'], lantern: ['up'], chain: ['up'], vines: ['up'], sign: ['up'], web: ['up', 'left', 'right'],
      window: ['up', 'down', 'left', 'right'], shield: ['down', 'up', 'left', 'right'], bars: ['left', 'right', 'up', 'down'],
    };
    for (const d of this.decor) {
      if (d.type === 'door') { d.ac = null; d.ar = null; d.openAmt = 0; d.dir = d.dir || 1; continue; }  // portas ficam livres (não somem)
      const c = (d.x / T) | 0, r = (d.y / T) | 0;
      const order = MOUNT[d.type] || ['down', 'up', 'left', 'right'];   // most props sit on the block below
      d.ac = null; d.ar = null;
      for (let step = 1; step <= 3 && d.ac == null; step++) {
        for (const dir of order) {
          const dd = DIRS[dir], ac = c + dd[0] * step, ar = r + dd[1] * step;
          if (W.solid(ac, ar)) { d.ac = ac; d.ar = ar; break; }
        }
      }
    }
  }

  spawnPlayer(fresh) {
    const p = new Player(this.spawn.x, this.spawn.y, this.currentHero);
    if (Save.hasPerk('vigor')) { p.maxhp += 40; p.hp = p.maxhp; }
    if (Save.hasPerk('bandolier')) p.special = p.maxSpecial;
    this.player = p;
  }

  // respawn at a safe spot after death
  respawnPlayer() {
    let x = clamp(this.cam.x + CONFIG.W / 2, 30, this.world.pixelW - 40);
    let y = this.cam.y + 30;
    // nudge out of solid
    for (let tries = 0; tries < 40 && this.world.solidPx(x, y); tries++) y -= this.world.T;
    this.currentHero = this.roster.includes(this.currentHero) ? this.currentHero : this.roster[0];
    this.player = new Player(x - 10, y, this.currentHero);
    this.player.invuln = 1.4;
  }

  // ---- event hooks -----------------------------------------
  queueExplosion(x, y, r, dmg) { this.explosionQ.push({ x, y, r, dmg }); }

  // dano de tile em COLUNA: ~2 tiles de altura (altura ~2 tiles do personagem)
  // + ~40% de chance de um 3º tile abaixo. Torna a destruição irregular e
  // permite de fato "abrir caminho" pelo cenário com tiros retos.
  carveTiles(c, r, dmg, opts) {
    this.world.damage(c, r, dmg, opts);
    this.world.damage(c, r + 1, dmg, opts);
    if (Math.random() < 0.4) this.world.damage(c, r + 2, dmg, opts);
  }

  damageEntitiesRadial(x, y, radius, dmg, exclude) {
    for (const e of this.enemies) {
      if (!e.alive || e === exclude) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < radius + e.w / 2) e.hurt(Math.round(dmg * (1 - d / (radius + e.w))), sign(e.cx - x) || 1, this);
    }
    const p = this.player;
    if (p && p !== exclude && !p.dead) {
      const d = Math.hypot(p.cx - x, p.cy - y);
      if (d < radius) p.hurt(Math.round(dmg * (1 - d / radius) * 0.7), sign(p.cx - x) || 1, this);
    }
  }

  // raio destruidor horizontal à frente do herói (Cabeça do Mestre, do Nicolau):
  // queima uma fileira de tiles e atinge todos os inimigos na linha do feixe.
  beamAttack(p, o) {
    const m = p.muzzlePos(), dir = p.face, ang = p.aimAng;
    const range = o.range, width = o.width, dmg = o.dmg, td = o.tileDmg != null ? o.tileDmg : dmg;
    const T = this.world.T;
    // escava os tiles ao longo do feixe (abre um corredor)
    for (let d = 0; d < range; d += T * 0.5) {
      const tx = m.x + Math.cos(ang) * d, ty = m.y + Math.sin(ang) * d;
      this.carveTiles(Math.floor(tx / T), Math.floor(ty / T), td, { power: 90 });
    }
    // atinge inimigos cuja faixa horizontal cruza a linha do feixe
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const fwd = (e.cx - m.x) * dir, off = Math.abs(e.cy - m.y);
      if (fwd > -e.w * 0.5 && fwd < range && off < width + e.h * 0.45) {
        e.hurt(dmg, dir, this); e.vx += dir * 140;
        this.fx.spark(e.cx, e.cy, o.color, 6);
      }
    }
    this.fx.beam(m.x, m.y, m.x + Math.cos(ang) * range, m.y + Math.sin(ang) * range, o.color, width);
  }

  // ---- ajudantes da ARCANA DE EDWARD (usados pelos feitiços / invocações) ----
  nearestEnemy(x, y, maxD = 1e9, exclude) {
    let best = null, bd = maxD;
    for (const e of this.enemies) { if (!e.alive || e === exclude || e.dying != null) continue; const d = Math.hypot(e.cx - x, e.cy - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  enemiesInRadius(x, y, r) {
    const out = [];
    for (const e of this.enemies) { if (!e.alive || e.dying != null) continue; if (Math.hypot(e.cx - x, e.cy - y) <= r + e.w * 0.5) out.push(e); }
    return out;
  }
  summon(kind, x, y, opts) {
    if (!this.summons) this.summons = [];
    if (this.summons.length >= 16) { const old = this.summons.shift(); if (old) old.alive = false; }   // limite de invocações vivas
    const m = new Minion(x, y, kind, opts || {});
    this.summons.push(m); this.fx.magic(m.cx, m.cy, m.aura, 14); this.fx.smoke(m.cx, m.cy, 3);
    return m;
  }

  // campo elétrico radial (Poder da Constituição, do Edward): atinge TODOS os
  // inimigos num raio (6 tiles em todas as direções), mas NÃO danifica blocos.
  electricBurst(p, o) {
    const cx = p.cx, cy = p.cy, radius = o.radius, dmg = o.dmg, kn = o.knock != null ? o.knock : 180;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.cx - cx, e.cy - cy);
      if (d > radius + e.w * 0.5) continue;
      const kd = sign(e.cx - cx) || 1;
      e.hurt(Math.round(dmg * (1 - d / (radius * 1.5))), kd, this);   // dano cai com a distância
      e.vx += kd * kn; e.vy -= 80;
      this.fx.bolt(cx, cy, e.cx, e.cy, '#bfe8ff'); this.fx.spark(e.cx, e.cy, '#bfe8ff', 8); this.fx.miniShock(e.cx, e.cy, '#bff0ff', 4);
    }
    // campo visível: anéis de choque + raios radiais (sem tocar o terreno)
    this.fx.shock(cx, cy, radius, '#7fd8ff'); this.fx.shock(cx, cy, radius * 0.66, '#bfe8ff');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; this.fx.bolt(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, i % 2 ? '#bfe8ff' : '#7fd8ff'); }
    this.fx.spark(cx, cy, '#bfe8ff', 20);
    this.cam.addShake(6); this.flashScreen(0.2);
  }

  // melee: sweep in front (o.radial=false) OR a 360° hit around the actor (o.radial=true)
  meleeArc(p, o) {
    const range = o.range, kn = o.knock != null ? o.knock : 200, dmg = o.dmg, td = o.tileDmg != null ? o.tileDmg : dmg;
    const T = this.world.T;
    if (o.radial) {
      // golpe em VOLTA do jogador — atinge inimigos dos dois lados
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.cx - p.cx, dy = e.cy - p.cy, d = Math.hypot(dx, dy);
        if (d > range + e.w * 0.5) continue;
        const kd = sign(dx) || p.face;
        e.hurt(dmg, kd, this);
        e.vx += kd * kn; e.vy -= 70;
        this.fx.blood(e.cx, e.cy, kd, 6);
      }
      // quebra blocos ao redor (laterais, acima e diagonais superiores)
      for (const d of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]]) {
        for (let r = T * 0.4; r <= range; r += T * 0.6) {
          const tx = p.cx + d[0] * r, ty = p.cy + d[1] * r;
          this.world.damage(Math.floor(tx / T), Math.floor(ty / T), td, { power: 80 });
        }
      }
      const col = o.color || 'rgba(255,255,255,0.92)';
      this.fx.slash(p.cx + range * 0.4, p.cy, 0, range * 0.75, col);
      this.fx.slash(p.cx - range * 0.4, p.cy, Math.PI, range * 0.75, col);
      this.cam.addShake(o.shake || 3);
      return;
    }
    // golpe direcional (à frente) — usado por investidas/heróis corpo-a-corpo
    const ang = p.aimAng, arc = o.arc || 1.1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.cx - p.cx, dy = e.cy - p.cy, d = Math.hypot(dx, dy);
      if (d > range + e.w * 0.5) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
      if (da <= arc) {
        e.hurt(dmg, sign(dx) || p.face, this);
        e.vx += (sign(dx) || p.face) * kn; e.vy -= 70;
        this.fx.blood(e.cx, e.cy, sign(dx) || p.face, 6);
      }
    }
    for (let r = T * 0.4; r <= range; r += T * 0.55) {
      const tx = p.cx + Math.cos(ang) * r, ty = p.cy + Math.sin(ang) * r;
      this.world.damage(Math.floor(tx / T), Math.floor(ty / T), td, { power: 80 });
    }
    this.fx.slash(p.cx + Math.cos(ang) * range * 0.45, p.cy + Math.sin(ang) * range * 0.45, ang, range * 0.7, o.color || 'rgba(255,255,255,0.92)');
    this.cam.addShake(o.shake || 3);
  }

  // golpe corpo-a-corpo em VOLTA do herói (tecla C): atinge os DOIS lados e
  // ACIMA, mas NUNCA abaixo dos pés — não quebra o chão sob o personagem.
  meleeRadial(p, o) {
    const range = o.range, kn = o.knock != null ? o.knock : 200, dmg = o.dmg, td = o.tileDmg != null ? o.tileDmg : dmg;
    const T = this.world.T, cx = p.cx, cy = p.cy, feetY = p.y + p.h;
    let hits = 0;
    // inimigos ao redor (ignora os que estão claramente abaixo dos pés)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.cx - cx, dy = e.cy - cy, d = Math.hypot(dx, dy);
      if (d > range + e.w * 0.5) continue;
      if (e.cy > feetY + 6) continue;                 // abaixo dos pés → não atinge
      const kd = sign(dx) || p.face;
      e.hurt(dmg, kd, this);
      e.vx += kd * kn; e.vy -= 70; hits++;
      this.fx.blood(e.cx, e.cy, kd, 6);
      this.fx.spark(e.cx, e.cy, '#fff2b0', 6);          // faíscas ao acertar
      // ---- efeitos de POSTURA do Ragnarok (arma branca equipada) ----
      if (o.ignite) { e.ignite(o.ignite[0], o.ignite[1]); this.fx.fire(e.cx, e.cy, 3); }
      if (o.bleed) { e.envenom(3, 5); this.fx.blood(e.cx, e.cy, kd, 5); }
      if (o.stun) { e.stagger = Math.max(e.stagger, o.stun); this.fx.spark(e.cx, e.cy - 6, '#ffd86b', 6); }
    }
    // tiles ao redor: lados + acima, até a linha dos pés (nunca abaixo)
    const feetRow = Math.floor((feetY - 1) / T);
    const c0 = Math.floor((cx - range) / T), c1 = Math.floor((cx + range) / T), r0 = Math.floor((cy - range) / T);
    for (let r = r0; r <= feetRow; r++) for (let c = c0; c <= c1; c++) {
      const tcx = c * T + T / 2, tcy = r * T + T / 2;
      if (Math.hypot(tcx - cx, tcy - cy) > range) continue;
      this.world.damage(c, r, td, { power: 80 });
    }
    // postura TRANSCENDENTAL: cada golpe também projeta um crescente de energia à frente
    if (o.ranged) { const m = p.muzzlePos(); this.bullets.push(new Bullet(m.x, m.y, p.aimAng, 760, { faction: 'player', kind: 'crescent', color: '#9b6bff', dmg: Math.round(dmg * 0.7), tileDmg: 14, r: 12, life: 0.7, pierce: 5, knock: 140 })); }
    // RAGNAROK acumula FÚRIA ao golpear; e cura com roubo de vida quando em frenesi
    if (hits && p.hero && p.hero.key === 'ragnarok') p.gainSpecial(5 * hits);
    if (hits && (p.lifestealT > 0 || p.berserkT > 0)) { p.hp = clamp(p.hp + 4 * hits, 0, p.maxhp); this.fx.spark(p.cx, p.cy, '#d34a3a', 3); }
    // efeito visual: UM corte contínuo (arco de ~270° ao redor) + faíscas
    const col = o.color || 'rgba(255,255,255,0.92)';
    this.fx.swirl(cx, cy - 4, range * 0.86, col, p.face);
    this.fx.spark(cx + p.face * range * 0.4, cy - range * 0.3, '#fff2b0', 12);   // faíscas do golpe
    this.cam.addShake(o.shake || 3);
  }

  collectOregano(pk) {
    if (pk) pk.alive = false;
    this.oregano++; this.score += 25; Sound.coin();
    this.fx.spark(pk ? pk.cx : 0, pk ? pk.cy : 0, '#7be08a', 4);
    if (this.oregano >= this.nextLifeAt) {
      this.lives++; this.nextLifeAt += 50;
      this.fx.text(this.player ? this.player.cx : 0, this.player ? this.player.y - 10 : 0, 'VIDA EXTRA!', '#ff5b6e');
      this.flashScreen(0.3); Sound.heal();
    }
  }
  spawnOregano(x, y, n) { if (Save.hasPerk('scavenger')) n *= 2; for (let i = 0; i < n; i++) this.pickups.push(new Pickup(x + rand(-6, 6), y + rand(-6, 6), 'oregano')); }
  collectToken(pk) {
    if (pk) pk.alive = false;
    this.tokens++; Save.addTokens(1); Sound.rescue();
    this.fx.spark(pk ? pk.cx : 0, pk ? pk.cy : 0, '#e0843a', 16);
    this.fx.text(this.player ? this.player.cx : 0, this.player ? this.player.y - 12 : 0, 'REI DO PICADÃO!', '#e0843a');
    this.flashScreen(0.35);
  }
  applyPotion(p) {
    p.powered = 12;
    this.fx.spark(p.cx, p.cy, '#6fd0ff', 22); this.fx.text(p.cx, p.y - 10, 'PODER MÁGICO!', '#6fd0ff');
    this.cam.addShake(4); this.flashScreen(0.3); Sound.heal();
  }
  // a rocket fired from a destroyed rocket-barrel — flies straight, then detonates
  spawnRocket(x, y, dir) {
    const ang = dir < 0 ? Math.PI : 0;
    this.bullets.push(new Bullet(x, y, ang, 460, { faction: 'enemy', kind: 'cannon', dmg: 26, r: 6, explosive: 80, tileDmg: 60, spin: 0, life: 2.6, knock: 220 }));
    this.fx.muzzle(x, y, ang + Math.PI); this.cam.addShake(3); Sound.shot('shotgun');
  }

  onEnemyKilled(e) {
    this.score += e.score || 0;
    if (this.player && !this.player.dead) this.player.gainSpecial(e.boss ? 60 : e.mini ? 30 : 12);
    if (e === this.boss) { this.boss = null; this.bossDown = true; this.flashScreen(0.5); if (!this.testMode) setTimeout(() => this.win(), 900); }
  }

  onPlayerDeath() {
    this.lives--;
    this.flashScreen(0.6);
    if (this.lives <= 0) { setTimeout(() => this.lose(), 900); }
    else { this.respawnT = 1.1; }
  }

  rescueAlly(heroIndex) {
    this.prisonersRescued++;
    this.lives++;
    if (!this.roster.includes(heroIndex)) this.roster.push(heroIndex);
    // auto-equip the freshly freed hero (very Broforce)
    this.currentHero = heroIndex;
    if (this.player && !this.player.dead) { this.player.setHero(heroIndex); this.player.special = this.player.maxSpecial * 0.5; }
    this.score += 250;
  }

  swapHero(dir) {
    if (this.roster.length < 2 || !this.player || this.player.dead) return;
    let i = this.roster.indexOf(this.currentHero);
    i = (i + dir + this.roster.length) % this.roster.length;
    this.currentHero = this.roster[i];
    const keepX = this.player.x, keepY = this.player.y, kvx = this.player.vx, kvy = this.player.vy, kog = this.player.onGround;
    this.player.setHero(this.currentHero);
    this.player.x = keepX; this.player.y = keepY; this.player.vx = kvx; this.player.vy = kvy; this.player.onGround = kog;
    this.player.invuln = Math.max(this.player.invuln, 0.3);
    this.fx.smoke(this.player.cx, this.player.cy, 5); this.fx.spark(this.player.cx, this.player.cy, '#caa33a', 8);
    Sound.swap();
  }

  // tiros/explosões são "ouvidos" — alerta inimigos próximos (mesmo fora do campo de visão)
  alertEnemies(x, y, radius) { for (const e of this.enemies) if (e.alive && e.hear) e.hear(x, y, radius); }

  win()  { if (this.state !== 'playing') return; this.state = 'win'; Save.addOregano(this.oregano); Sound.win(); if (this.onEnd) this.onEnd('win'); }
  lose() { if (this.state !== 'playing') return; this.state = 'lose'; if (this.onEnd) this.onEnd('lose'); }

  flashScreen(a) {
    const f = document.getElementById('flash');
    f.style.transition = 'none'; f.style.opacity = a;
    requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; });
  }

  // ---- update ----------------------------------------------
  update(dt) {
    if (this.paused || this.state !== 'playing') return;
    this._handleGrimoire();
    if (this.grimoireOpen) return;   // GRIMÓRIO aberto: congela a ação enquanto Edward escolhe o feitiço
    this.time += dt;
    // VEX: cada VIDA EXTRA concede +1 carga de metamorfose
    if (this.lives > (this._prevLives != null ? this._prevLives : this.lives)) this.vexCharges = (this.vexCharges || 0) + (this.lives - this._prevLives);
    this._prevLives = this.lives;
    if (this.freeze > 0) { this.freeze -= dt; dt *= 0.18; }

    // swap input
    if (this.controller.swapNext()) this.swapHero(1);
    if (this.controller.swapPrev()) this.swapHero(-1);

    // respawn timer
    if (this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && this.lives > 0) this.respawnPlayer();
    }

    const p = this.player;
    if (p) p.update(dt, this);

    // FASE DE TESTES: 1–9 = arma rápida · , . = ciclar TODAS · B = invocar inimigo · M = limpar
    if (this.testMode && p && !p.dead) {
      for (let i = 0; i < WEAPON_ORDER.length && i < 9; i++) if (Input.once(String(i + 1))) this._testEquip(i);
      if (Input.once(',')) this._testEquip(((this._testWi || 0) - 1 + WEAPON_ORDER.length) % WEAPON_ORDER.length);
      if (Input.once('.')) this._testEquip(((this._testWi || 0) + 1) % WEAPON_ORDER.length);
      if (Input.once('b')) this._testSpawnEnemy();
      if (Input.once('n')) this._testSpawnMythos();
      if (Input.once('m')) { for (const e of this.enemies) e.alive = false; this.boss = null; this.fx.text(p.cx, p.y - 12, 'INIMIGOS LIMPOS', '#9be0ff'); Sound.swap(); }
    }

    for (const e of this.enemies) e.update(dt, this);
    for (const b of this.bullets) b.update(dt, this);
    for (const a of this.allies) a.update(dt, this);
    for (const s of this.summons) s.update(dt, this);
    for (const k of this.pickups) k.update(dt, this);

    this._bulletCollisions();
    this.world.updateFallers(dt, this);
    this.updateDoors(dt);
    this.fx.update(dt, this.world);

    // process queued explosions (barrels chain etc.)
    if (this.explosionQ.length) {
      const q = this.explosionQ; this.explosionQ = [];
      for (const ex of q) this.world.explode(ex.x, ex.y, ex.r, ex.dmg);
      this.freeze = Math.max(this.freeze, 0.05);
    }

    // suspended decorations fall away once the block they were mounted on is destroyed
    if (this.decor.length) this.decor = this.decor.filter(d => d.ac == null || this.world.solid(d.ac, d.ar));

    // cull dead
    this.enemies = this.enemies.filter(e => e.alive);
    this.bullets = this.bullets.filter(b => b.alive);
    this.allies = this.allies.filter(a => !a.rescued);
    this.summons = this.summons.filter(s => s.alive);
    this.pickups = this.pickups.filter(k => k.alive);

    // camera
    if (p) this.cam.follow(p.dead ? { x: p.x, y: p.y, w: p.w, h: p.h } : p, dt);
    else this.cam.follow({ x: this.spawn.x, y: this.spawn.y, w: 20, h: 30 }, dt);

    // win check (reach exit)
    if (this.level.win === 'exit' && p && !p.dead) {
      for (const ex of this.exits) if (aabb(p, ex)) { this.win(); break; }
    }
    // fell out of world while no lives handled by death; safety
  }

  // GRIMÓRIO de Edward: G abre/fecha a árvore de feitiços; [ ] trocam o feitiço
  // ativo rápido sem abrir. Só disponível quando Edward (ou Vex metamorfoseado nele) joga.
  _handleGrimoire() {
    if (typeof Grimoire === 'undefined') return;
    const p = this.player, has = p && !p.dead && Grimoire.heroHasBook(p.morph ? p.morph.key : p.hero.key);
    if (!has) { this.grimoireOpen = false; return; }
    if (Keys.once('grimoire')) { this.grimoireOpen = !this.grimoireOpen; Sound.swap(); }
    if (this.grimoireOpen) { Grimoire.tickInput(this); return; }
    if (Keys.once('spellPrev')) Grimoire.cycle(-1, p, this);
    if (Keys.once('spellNext')) Grimoire.cycle(1, p, this);
  }

  _bulletCollisions() {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      if (b.faction === 'player') {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (b.x > e.x - b.r && b.x < e.x + e.w + b.r && b.y > e.y - b.r && b.y < e.y + e.h + b.r) {
            if (!b.hitSet) b.hitSet = new Set();
            if (b.hitSet.has(e)) continue;
            b.hitSet.add(e);
            e.hurt(b.dmg, sign(b.vx) || 1, this);
            if (b.freezeT) e.freeze(b.freezeT);                       // balas mágicas aplicam status
            if (b.slowT) e.slow(b.slowT, b.slowK);
            if (b.burnT) e.ignite(b.burnT, b.burnDps);
            e.vx += sign(b.vx) * (b.knock * 0.5); Sound.hit();
            if (b.explosive) { b.detonate(this); break; }
            if (b.hitSet.size > b.pierce) { b.alive = false; break; }
          }
        }
      } else {
        // bala inimiga: pode atingir uma INVOCAÇÃO aliada antes do jogador
        let hitMinion = false;
        for (const s of this.summons) {
          if (!s.alive) continue;
          if (b.x > s.x - b.r && b.x < s.x + s.w + b.r && b.y > s.y - b.r && b.y < s.y + s.h + b.r) {
            s.hurt(b.dmg, sign(b.vx) || 1, this); Sound.hit();
            if (b.explosive) b.detonate(this); else b.alive = false;
            hitMinion = true; break;
          }
        }
        if (hitMinion) continue;
        const p = this.player;
        if (p && !p.dead && p.invuln <= 0 &&
            b.x > p.x - b.r && b.x < p.x + p.w + b.r && b.y > p.y - b.r && b.y < p.y + p.h + b.r) {
          p.hurt(b.dmg, sign(b.vx) || 1, this);
          if (b.explosive) b.detonate(this); else b.alive = false;
        }
      }
    }
  }

  // portas: abrem (giram) na direção do movimento do herói ao passar; fecham depois
  updateDoors(dt) {
    if (!this.decor || !this.decor.length) return;
    const p = this.player, T = this.world.T;
    for (const d of this.decor) {
      if (d.type !== 'door') continue;
      const cx = d.x + T / 2, top = d.y, bot = d.y + T * 2;
      let near = false;
      if (p && !p.dead) {
        near = Math.abs(p.cx - cx) < T * 0.85 && (p.y + p.h) > top && p.y < bot;
        if (near && Math.abs(p.vx) > 16) d.dir = sign(p.vx);   // abre no sentido do movimento
      }
      if (d.dir == null) d.dir = 1;
      d.openAmt = approach(d.openAmt || 0, near ? 1 : 0, dt * (near ? 7 : 4));
    }
  }

  // ---- draw ------------------------------------------------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);   // hard reset so no transform can ever compound across frames
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, CONFIG.W, CONFIG.H);
    BG.draw(ctx, this.cam, this.level, this.time);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(CONFIG.ZOOM, CONFIG.ZOOM);
    this.world.draw(ctx, this.cam);

    // decorations (torches, banners, windows, pillars, vines...)
    for (const d of this.decor) {
      if (!this.cam.visible(d.x - CONFIG.TILE, d.y - CONFIG.TILE, CONFIG.TILE * 3, CONFIG.TILE * 3)) continue;
      TEX.decorPixel(ctx, d, this.cam.ox, this.cam.oy, this.time, this);
    }

    // exits as glowing portals
    for (const ex of this.exits) {
      if (!this.cam.visible(ex.x, ex.y, ex.w, ex.h)) continue;
      const x = ex.x + this.cam.ox, y = ex.y + this.cam.oy, T = CONFIG.TILE;
      const gr = ctx.createRadialGradient(x + T / 2, y + T, 2, x + T / 2, y + T, T);
      gr.addColorStop(0, 'rgba(123,224,138,0.7)'); gr.addColorStop(1, 'rgba(123,224,138,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - T / 2, y, T * 2, ex.h);
      ctx.fillStyle = '#caa33a'; ctx.fillRect(x + 6, y, 4, ex.h); ctx.fillRect(x + T - 10, y, 4, ex.h);
      ctx.fillStyle = (Math.sin(this.time * 6) > 0) ? '#7be08a' : '#5ac070';
      ctx.beginPath(); ctx.moveTo(x + 12, y + 8); ctx.lineTo(x + T - 6, y + T * 0.7); ctx.lineTo(x + 12, y + T * 1.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Trebuchet MS"'; ctx.textAlign = 'center'; ctx.fillText('SAÍDA', x + T / 2, y - 4); ctx.textAlign = 'left';
    }

    this.fx.drawDecals(ctx, this.cam);   // persistent scorch marks — trail of destruction
    this.fx.drawCrumbs(ctx, this.cam);   // settled mini-block debris & gore on the ground
    for (const k of this.pickups) k.draw(ctx, this.cam);
    for (const a of this.allies) a.draw(ctx, this.cam);
    for (const s of this.summons) if (this.cam.visible(s.x, s.y, s.w, s.h)) s.draw(ctx, this.cam);
    for (const e of this.enemies) if (this.cam.visible(e.x, e.y, e.w, e.h)) e.draw(ctx, this.cam);
    if (this.player) this.player.draw(ctx, this.cam);
    for (const b of this.bullets) if (this.cam.visible(b.x, b.y, 8, 8)) b.draw(ctx, this.cam);
    this.fx.draw(ctx, this.cam);
    ctx.restore();   // end world zoom

    this._drawLighting(ctx);   // superfície clara, áreas cobertas escuras (tochas/lanternas iluminam)

    if (this.boss && this.boss.alive) this._drawBossBar(ctx);
    if (this.testMode) this._drawTestBar(ctx);
    if (this.paused) this._drawPaused(ctx);
    if (this.grimoireOpen && typeof Grimoire !== 'undefined') Grimoire.draw(ctx, this);
  }

  // ---- FASE DE TESTES: troca de arma e invocação de inimigos ----
  _testEquip(i) {
    if (!this.player) return;
    this._testWi = i; const k = WEAPON_ORDER[i];
    this.player.equipWeapon(k);
    this.fx.text(this.player.cx, this.player.y - 12, (i + 1 <= 9 ? (i + 1) + '· ' : '') + WEAPONS[k].name, '#6fd0ff'); Sound.swap();
  }
  _testSpawnEnemy() {
    const p = this.player; if (!p) return;
    const keys = Object.keys(ENEMY_TYPES).filter(k => !ENEMY_TYPES[k].boss);
    this._testEi = (this._testEi == null) ? 0 : (this._testEi + 1) % keys.length;
    const key = keys[this._testEi], t = ENEMY_TYPES[key];
    const e = new Enemy(p.cx + p.face * 130, p.y - 30, key);
    this.enemies.push(e);
    this.fx.spark(e.cx, e.cy, '#c479ff', 14); this.fx.smoke(e.cx, e.cy, 3);
    this.fx.text(e.cx, e.y - 8, (t.label || key), '#ff9b6b'); Sound.swap();
  }
  // FASE DE TESTES: invoca um CHEFE MYTHOS (tecla N) — cicla pelos chefes colossais
  _testSpawnMythos() {
    const p = this.player; if (!p) return;
    const keys = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].mythos);
    this._testMi = (this._testMi == null) ? 0 : (this._testMi + 1) % keys.length;
    const key = keys[this._testMi], t = ENEMY_TYPES[key];
    const e = new Enemy(p.cx + p.face * 240, p.y, key);
    this.enemies.push(e); this.boss = e;   // mostra a barra de chefe (vitória não dispara em testes)
    this.fx.magic(e.cx, e.cy, '#b07bff', 24); this.fx.smoke(e.cx, e.cy, 8);
    this.fx.text(e.cx, e.y - 8, (t.name || key), '#ff9b6b'); Sound.cast();
  }

  // legenda da FASE DE TESTES: lista as armas (quebra em linhas) e destaca a equipada
  _drawTestBar(ctx) {
    const list = WEAPON_ORDER;
    ctx.save();
    ctx.font = 'bold 12px "Trebuchet MS"'; ctx.textBaseline = 'middle';
    const labels = list.map((k, i) => (i < 9 ? (i + 1) + '·' : '') + WEAPONS[k].name);
    const pad = 8, gap = 5, h = 22, rowGap = 5, maxW = CONFIG.W - 40;
    const widths = labels.map(l => ctx.measureText(l).width + pad * 2);
    // quebra em linhas que cabem na largura
    const rows = [[]]; let rw = 0;
    for (let i = 0; i < labels.length; i++) {
      if (rw + widths[i] + gap > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
      rows[rows.length - 1].push(i); rw += widths[i] + gap;
    }
    const rowsH = rows.length * (h + rowGap) - rowGap;
    let y = CONFIG.H - rowsH - 30;   // ancorado na base (acima da legenda)
    for (const row of rows) {
      const tot = row.reduce((a, i) => a + widths[i], 0) + gap * (row.length - 1);
      let x = (CONFIG.W - tot) / 2;
      for (const i of row) {
        const on = this.player && this.player.weaponKey === list[i];
        ctx.fillStyle = on ? 'rgba(232,185,74,0.94)' : 'rgba(20,15,10,0.82)'; ctx.fillRect(x, y, widths[i], h);
        ctx.lineWidth = on ? 2 : 1; ctx.strokeStyle = on ? '#fff' : '#5a4326'; ctx.strokeRect(x + 0.5, y + 0.5, widths[i] - 1, h - 1);
        ctx.fillStyle = on ? '#1a140e' : '#e8e0cf'; ctx.textAlign = 'left'; ctx.fillText(labels[i], x + pad, y + h / 2 + 1);
        x += widths[i] + gap;
      }
      y += h + rowGap;
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.fillStyle = '#9a8f7d'; ctx.font = '12px "Trebuchet MS"';
    const hasBook = this.player && typeof Grimoire !== 'undefined' && Grimoire.heroHasBook(this.player.morph ? this.player.morph.key : this.player.hero.key);
    const tip = hasBook ? '✦ G árvore de habilidades · [ ] trocam · X usa · C golpe curto · B inimigo · N chefe MYTHOS · M limpa · S/D herói'
                        : '1–9 armas · , . ciclam · B inimigo · N chefe MYTHOS · M limpa · S/D herói (Edward e Ragnarok têm árvores!)';
    ctx.fillText(tip, CONFIG.W / 2, CONFIG.H - 9);
    ctx.restore(); ctx.textAlign = 'left';
  }

  // ---- iluminação 2D simples ---------------------------------
  // A SUPERFÍCIE (acima do nível natural do terreno, incluindo o interior
  // de construções) tem luz padrão. O SUBSOLO (abaixo da superfície) fica
  // mais escuro, porém sempre visível. Transição suave via blur.
  _drawLighting(ctx) {
    if (!this.world || (this.level && this.level.noLight)) return;
    const surfArr = this.level && this.level.surface;
    if (!surfArr) return;   // sem dados de superfície (ex.: criações simples) -> luz padrão em tudo

    // ===== AJUSTE A ILUMINAÇÃO AQUI =====
    const UNDERGROUND_DARK = 0.5;   // escuridão do subsolo: 0 = igual à superfície · 1 = preto total
    const BRIGHT_MARGIN = 1;        // quantos tiles abaixo da superfície ainda ficam claros
    const FADE = 4;                 // tiles de transição suave (maior = mais gradual)
    // ====================================

    const W = CONFIG.W, H = CONFIG.H, T = this.world.T, z = CONFIG.ZOOM;
    const S = 4, LW = Math.ceil(W / S), LH = Math.ceil(H / S);   // buffer de escuridão em 1/4 da resolução
    if (!this._lcan) { this._lcan = document.createElement('canvas'); this._lctx = this._lcan.getContext('2d'); }
    if (this._lcan.width !== LW) { this._lcan.width = LW; this._lcan.height = LH; }
    const L = this._lctx, ox = this.cam.ox, oy = this.cam.oy;
    const bx = wx => (wx + ox) * z / S, by = wy => (wy + oy) * z / S;   // mundo -> buffer
    const c0 = Math.max(0, Math.floor(this.cam.x / T)), c1 = Math.min(this.world.cols - 1, Math.floor((this.cam.x + this.cam.vw) / T) + 1);

    L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, LW, LH);
    const N = surfArr.length;
    const surfAt = c => { const i = clamp(c, 0, N - 1); return (surfArr[Math.max(0, i - 1)] + surfArr[i] + surfArr[Math.min(N - 1, i + 1)]) / 3; };
    const dark = `rgba(4,7,16,${UNDERGROUND_DARK})`, clear = 'rgba(4,7,16,0)';
    for (let c = c0; c <= c1; c++) {
      const s = surfAt(c) + BRIGHT_MARGIN;
      const xL = Math.round(bx(c * T)), xR = Math.round(bx((c + 1) * T)), wL = Math.max(1, xR - xL);   // encaixe exato (sem sobrepor colunas)
      const y0 = Math.max(0, by(s * T)), y1 = by((s + FADE) * T);
      if (y1 > y0) { const g = L.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, clear); g.addColorStop(1, dark); L.fillStyle = g; L.fillRect(xL, y0, wL, y1 - y0); }
      if (y1 < LH) { L.fillStyle = dark; L.fillRect(xL, Math.max(0, y1), wL, LH - Math.max(0, y1)); }
    }
    // desenha a escuridão sobre a cena com blur (suaviza qualquer degrau entre colunas)
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = 'blur(8px)';
    ctx.drawImage(this._lcan, 0, 0, LW, LH, 0, 0, W, H);
    ctx.filter = 'none'; ctx.restore();
  }

  _drawBossBar(ctx) {
    const b = this.boss, w = 520, x = (CONFIG.W - w) / 2, y = 24;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, w + 6, 22);
    ctx.fillStyle = '#1a140e'; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = '#b1322c'; ctx.fillRect(x, y, w * clamp(b.hp / b.maxhp, 0, 1), 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText(b.name || 'CHEFE', CONFIG.W / 2, y + 13); ctx.textAlign = 'left';
  }

  _drawPaused(ctx) {
    // apenas escurece o cenário; o micromenu (título + botões) é desenhado em DOM por main.js
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
  }

  // ---- HUD (DOM) -------------------------------------------
  updateHUD() {
    const h = this._hud, p = this.player;
    if (!p) return;
    h.name.textContent = p.hero.name;
    h.hp.style.width = clamp(p.hp / p.maxhp * 100, 0, 100) + '%';
    h.hpTxt.textContent = Math.ceil(p.hp) + ' / ' + p.maxhp;
    // medidor do especial: Vex (forma própria) usa CARGAS; demais usam a barra azul
    if (p.hero.key === 'vex' && !p.morph) {
      const cur = this.vexCharges || 0, base = (typeof VEX_BASE_CHARGES !== 'undefined' ? VEX_BASE_CHARGES : 3);
      h.sp.style.background = 'linear-gradient(#f0d36a,#caa33a)';   // dourado p/ diferenciar da azul
      h.sp.style.width = clamp(cur / Math.max(base, cur) * 100, 0, 100) + '%';
      h.spTxt.textContent = cur > 0 ? ('METAMORFOSE ×' + cur) : 'SEM METAMORFOSE';
    } else if (typeof Grimoire !== 'undefined' && Grimoire.heroHasBook(p.morph ? p.morph.key : p.hero.key)) {
      // HERÓIS COM LIVRO (Edward/Ragnarok): a barra azul é o recurso (MANA/FÚRIA);
      // o texto mostra a habilidade ATIVA da árvore + a postura de arma, se houver
      const book = Grimoire.bookFor(p), sp = Grimoire.current(p);
      h.sp.style.background = '';
      h.sp.style.width = clamp(p.special / p.maxSpecial * 100, 0, 100) + '%';
      const ready = this.testMode || p.special >= (sp.cost || 0);
      const stance = (p.meleeStanceT > 0 && p.meleeStance) ? ' · ✊' + STANCE_LABEL[p.meleeStance] : '';
      h.spTxt.textContent = sp.icon + ' ' + sp.name + (ready ? '  ▸ G' : ' · falta ' + Math.ceil((sp.cost || 0) - p.special)) + stance;
    } else {
      const sp = p.morph ? p.morph.special : p.hero.special;
      h.sp.style.background = '';   // volta ao azul padrão (CSS)
      h.sp.style.width = clamp(p.special / p.maxSpecial * 100, 0, 100) + '%';
      const ready = sp && p.special >= sp.cost;
      if (p.morph) h.spTxt.textContent = 'FORMA ' + p.morph.name + ' · ' + Math.ceil(p.morphT) + 's' + (ready ? ' · PRONTO' : '');
      else h.spTxt.textContent = p.reloading > 0 ? 'RECARREGANDO…' : (ready ? 'ESPECIAL PRONTO' : 'ESPECIAL');
    }
    h.lives.textContent = '♥'.repeat(Math.max(0, this.lives));
    h.coins.textContent = '🌿 ' + this.oregano + '  (vida em ' + this.nextLifeAt + ')';
    if (h.tokens) h.tokens.textContent = this.tokens > 0 ? ('⬡ ' + this.tokens + ' Rei do Picadão') : '';
    if (h.buff) h.buff.textContent = (p.powered > 0) ? ('⚗ PODER MÁGICO ' + Math.ceil(p.powered) + 's') : '';
    let obj;
    if (this.level.win === 'boss') obj = this.boss ? 'Derrote ' + (this.boss.name || 'o chefe') : 'Chefe abatido! Saia →';
    else obj = 'Alcance a SAÍDA →';
    h.obj.textContent = obj;
    // roster chips
    if (h.roster.childElementCount !== this.roster.length || h._cur !== this.currentHero) {
      h.roster.innerHTML = ''; h._cur = this.currentHero;
      for (const idx of this.roster) {
        const d = document.createElement('div');
        d.className = 'rchip' + (idx === this.currentHero ? ' act' : '');
        d.textContent = HEROES[idx].icon; h.roster.appendChild(d);
      }
    }
    this._drawPortrait();
  }

  _drawPortrait() {
    // VEX transformado: mostra o RETRATO da forma atual (o nome no HUD continua VEX)
    const key = (this.player && this.player.morph) ? this.player.morph.spr : HEROES[this.currentHero].spr;
    const hasImg = typeof SPR !== 'undefined' && SPR.hasImage(key);
    // só redesenha quando muda (troca de herói ou a imagem terminou de carregar) → barato
    const sig = key + (hasImg ? '#img' : (SPR.ready ? '#spr' : '#none'));
    if (sig === this._portraitSig) return;
    this._portraitSig = sig;
    const c = this._hud.portrait, x = c.getContext('2d'), W = c.width, H = c.height;
    x.clearRect(0, 0, W, H);
    const def = typeof SPR !== 'undefined' && SPR.defs[key];
    if (hasImg) {                                   // retrato (pictures/retrato_*.png ou concept)
      const img = SPR.images[key]; x.imageSmoothingEnabled = true;
      if (def && def.portraitFull) x.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);   // busto inteiro
      else { const p = def.portrait; x.drawImage(img, p.x, p.y, p.w, p.h, 0, 0, W, H); }        // recorte da cabeça
      return;
    }
    if (typeof SPR !== 'undefined' && SPR.ready && SPR.sheets[key]) {   // fallback: sprite pixel-art
      const img = SPR.sheets[key].idle[0];
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
    }
  }

  showHUD(v) { this._hud.box.style.display = v ? 'block' : 'none'; }
  togglePause() { if (this.state === 'playing') { this.paused = !this.paused; if (this.paused) Sound.swap(); } }
}

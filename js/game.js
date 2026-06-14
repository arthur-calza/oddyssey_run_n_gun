/* ============================================================
   game.js — orchestration: state, level build, collisions, HUD
   ============================================================ */

class Game {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cam = new Camera(); this.controller = new Controller(); this.fx = new FX(this);
    this.roster = [0];          // unlocked hero indices (start with the Warrior)
    this.currentHero = 0;
    this.lives = 3; this.score = 0; this.coins = 0; this.nextLifeAt = 50;
    this.state = 'playing'; this.paused = false;
    this.freeze = 0; this.respawnT = 0; this.time = 0;
    this._hud = this._cacheHud();
  }

  _cacheHud() {
    const $ = id => document.getElementById(id);
    return {
      box: $('hud'), name: $('hudName'), hp: $('hpFill'), hpTxt: $('hpTxt'),
      sp: $('spFill'), spTxt: $('spTxt'), lives: $('hudLives'), obj: $('hudObj'),
      roster: $('hudRoster'), portrait: $('portrait'), coins: $('hudCoins'),
    };
  }

  // ---- level building --------------------------------------
  loadLevel(index) {
    this.levelIndex = index;
    const L = LEVELS[index]; this.level = L;
    const rows = L.rows;
    const cols = Math.max(...rows.map(r => r.length));
    const world = new World(cols, rows.length);
    world.game = this;
    this.world = world; this.cam.world = world;
    this.bullets = []; this.enemies = []; this.allies = []; this.pickups = [];
    this.explosionQ = []; this.exits = []; this.boss = null; this.decor = [];
    this.prisonersTotal = 0; this.prisonersRescued = 0;
    const T = world.T;
    const DECOR = { 't': 'torch', 'L': 'banner', 'N': 'window', 'I': 'pillar', 'V': 'vines', 'Y': 'web', 'G': 'grass' };

    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < cols; c++) {
        const ch = line[c] || '.';
        if (CHAR2MAT[ch]) { world.set(c, r, CHAR2MAT[ch]); continue; }
        const px = c * T, py = r * T;
        if (ch === 'P') { this.spawn = { x: px + (T - 24) / 2, y: (r + 1) * T - 42 }; }
        else if (ch === 'E') { this.exits.push({ x: px, y: py - T, w: T, h: T * 2 }); }
        else if (DECOR[ch]) { this.decor.push({ type: DECOR[ch], x: px, y: py, color: L.bannerColor }); }
        else if (ch === 'o') { const k = new Pickup(px + T / 2, py + T / 2, 'coin'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
        else if (ch === 'H') { const k = new Pickup(px + T / 2, py + T / 2, 'life'); k.vy = 0; k.vx = 0; this.pickups.push(k); }
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
    this.spawnPlayer(true);
    this.cam.x = clamp(this.player.x - CONFIG.W / 2, 0, Math.max(0, world.pixelW - CONFIG.W));
    this.cam.y = clamp(this.player.y - CONFIG.H / 2, 0, Math.max(0, world.pixelH - CONFIG.H));
    this.state = 'playing'; this.paused = false;
    this._setSky(L);
  }

  _setSky(L) {
    this.canvas.style.background = `linear-gradient(${L.sky[0]}, ${L.sky[1]})`;
  }

  spawnPlayer(fresh) {
    const p = new Player(this.spawn.x, this.spawn.y, this.currentHero);
    if (!fresh && this.player) { /* keep nothing */ }
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

  // melee sweep in front of an actor (for warrior/barbarian/rogue/druid)
  meleeArc(p, o) {
    const ang = p.aimAng, range = o.range, arc = o.arc || 1.1;
    const kn = o.knock != null ? o.knock : 200, dmg = o.dmg, td = o.tileDmg != null ? o.tileDmg : dmg;
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
    const T = this.world.T;
    for (let r = T * 0.4; r <= range; r += T * 0.55) {
      const tx = p.cx + Math.cos(ang) * r, ty = p.cy + Math.sin(ang) * r;
      this.world.damage(Math.floor(tx / T), Math.floor(ty / T), td, { power: 80 });
    }
    this.fx.slash(p.cx + Math.cos(ang) * range * 0.45, p.cy + Math.sin(ang) * range * 0.45, ang, range * 0.7, o.color || 'rgba(255,255,255,0.92)');
    this.cam.addShake(o.shake || 3);
  }

  collectCoin(pk) {
    if (pk) pk.alive = false;
    this.coins++; this.score += 25; Sound.coin();
    this.fx.spark(pk ? pk.cx : 0, pk ? pk.cy : 0, '#f4d35e', 5);
    if (this.coins >= this.nextLifeAt) {
      this.lives++; this.nextLifeAt += 50;
      this.fx.text(this.player ? this.player.cx : 0, this.player ? this.player.y - 10 : 0, 'VIDA EXTRA!', '#ff5b6e');
      this.flashScreen(0.3); Sound.heal();
    }
  }
  spawnCoins(x, y, n) { for (let i = 0; i < n; i++) this.pickups.push(new Pickup(x + rand(-6, 6), y + rand(-6, 6), 'coin')); }

  onEnemyKilled(e) {
    this.score += e.score || 0;
    if (this.player && !this.player.dead) this.player.gainSpecial(e.boss ? 60 : e.mini ? 30 : 12);
    if (e === this.boss) { this.boss = null; this.bossDown = true; this.flashScreen(0.5); setTimeout(() => this.win(), 900); }
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

  win()  { if (this.state !== 'playing') return; this.state = 'win';  Sound.win(); if (this.onEnd) this.onEnd('win'); }
  lose() { if (this.state !== 'playing') return; this.state = 'lose'; if (this.onEnd) this.onEnd('lose'); }

  flashScreen(a) {
    const f = document.getElementById('flash');
    f.style.transition = 'none'; f.style.opacity = a;
    requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; });
  }

  // ---- update ----------------------------------------------
  update(dt) {
    if (this.paused || this.state !== 'playing') return;
    this.time += dt;
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

    for (const e of this.enemies) e.update(dt, this);
    for (const b of this.bullets) b.update(dt, this);
    for (const a of this.allies) a.update(dt, this);
    for (const k of this.pickups) k.update(dt, this);

    this._bulletCollisions();
    this.world.updateFallers(dt, this);
    this.fx.update(dt, this.world);

    // process queued explosions (barrels chain etc.)
    if (this.explosionQ.length) {
      const q = this.explosionQ; this.explosionQ = [];
      for (const ex of q) this.world.explode(ex.x, ex.y, ex.r, ex.dmg);
      this.freeze = Math.max(this.freeze, 0.05);
    }

    // cull dead
    this.enemies = this.enemies.filter(e => e.alive);
    this.bullets = this.bullets.filter(b => b.alive);
    this.allies = this.allies.filter(a => !a.rescued);
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
            e.vx += sign(b.vx) * (b.knock * 0.5); Sound.hit();
            if (b.explosive) { b.detonate(this); break; }
            if (b.hitSet.size > b.pierce) { b.alive = false; break; }
          }
        }
      } else {
        const p = this.player;
        if (p && !p.dead && p.invuln <= 0 &&
            b.x > p.x - b.r && b.x < p.x + p.w + b.r && b.y > p.y - b.r && b.y < p.y + p.h + b.r) {
          p.hurt(b.dmg, sign(b.vx) || 1, this);
          if (b.explosive) b.detonate(this); else b.alive = false;
        }
      }
    }
  }

  // ---- draw ------------------------------------------------
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.W, CONFIG.H);
    BG.draw(ctx, this.cam, this.level, this.time);
    this.world.draw(ctx, this.cam);

    // decorations (torches, banners, windows, pillars, vines...)
    for (const d of this.decor) {
      if (!this.cam.visible(d.x - CONFIG.TILE, d.y - CONFIG.TILE, CONFIG.TILE * 3, CONFIG.TILE * 3)) continue;
      TEX.decor(ctx, d, this.cam.ox, this.cam.oy, this.time, this);
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

    for (const k of this.pickups) k.draw(ctx, this.cam);
    for (const a of this.allies) a.draw(ctx, this.cam);
    for (const e of this.enemies) if (this.cam.visible(e.x, e.y, e.w, e.h)) e.draw(ctx, this.cam);
    if (this.player) this.player.draw(ctx, this.cam);
    for (const b of this.bullets) if (this.cam.visible(b.x, b.y, 8, 8)) b.draw(ctx, this.cam);
    this.fx.draw(ctx, this.cam);

    if (this.boss && this.boss.alive) this._drawBossBar(ctx);
    if (this.paused) this._drawPaused(ctx);
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
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
    ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 48px "Trebuchet MS"'; ctx.textAlign = 'center';
    ctx.fillText('PAUSADO', CONFIG.W / 2, CONFIG.H / 2);
    ctx.font = '16px "Trebuchet MS"'; ctx.fillStyle = '#e8e0cf';
    ctx.fillText('P / ESC para continuar', CONFIG.W / 2, CONFIG.H / 2 + 34);
    ctx.textAlign = 'left';
  }

  // ---- HUD (DOM) -------------------------------------------
  updateHUD() {
    const h = this._hud, p = this.player;
    if (!p) return;
    h.name.textContent = p.hero.name;
    h.hp.style.width = clamp(p.hp / p.maxhp * 100, 0, 100) + '%';
    h.hpTxt.textContent = Math.ceil(p.hp) + ' / ' + p.maxhp;
    h.sp.style.width = clamp(p.special / p.maxSpecial * 100, 0, 100) + '%';
    const ready = p.special >= p.hero.special.cost;
    h.spTxt.textContent = p.reloading > 0 ? 'RECARREGANDO…' : (ready ? 'ESPECIAL PRONTO' : 'ESPECIAL');
    h.lives.textContent = '♥'.repeat(Math.max(0, this.lives));
    h.coins.textContent = '⛀ ' + this.coins + '  (vida em ' + this.nextLifeAt + ')';
    let obj;
    if (this.level.win === 'boss') obj = this.boss ? 'Derrube ' + (this.boss.name || 'o chefe') : 'Chefe abatido! Saia →';
    else obj = `Resgatados ${this.prisonersRescued}/${this.prisonersTotal} · Alcance a SAÍDA →`;
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
    const c = this._hud.portrait, x = c.getContext('2d');
    x.clearRect(0, 0, 62, 62);
    const fake = { x: 12, y: 0, w: 38, h: 52, face: 1, vx: 0, onGround: true, anim: 0, aimAng: 0, gunLen: 0, skin: HEROES[this.currentHero].skin };
    const cam0 = { ox: 0, oy: 6 };
    drawFighter(x, fake, cam0, false);
  }

  showHUD(v) { this._hud.box.style.display = v ? 'block' : 'none'; }
  togglePause() { if (this.state === 'playing') { this.paused = !this.paused; if (this.paused) Sound.swap(); } }
}

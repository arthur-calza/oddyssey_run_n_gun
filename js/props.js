/* ============================================================
   props.js — OBJETOS DE CENA INTERATIVOS (scene props)
   ------------------------------------------------------------
   Tudo que enriquece a jogabilidade do cenário ALÉM dos blocos:
   baús, armadilhas, canhões operados por inimigos, portas
   secretas/trancadas, fogueiras, objetos arcanos, elevadores,
   alarmes, minas etc.

   Cada prop é uma entrada de `game.decor` (mesmo array das
   decorações simples) com estado de runtime extra. O DESENHO
   fica em textures.js (TEX.decor, por `d.type`); aqui mora só
   o COMPORTAMENTO. Não precisam de char no grid: as fases e o
   editor os colocam via lista `L.props` ([{type,c,r,...}]).

   Integração (game.js):
     • loadLevelDef → parseia L.props p/ game.decor
     • após _anchorDecor → Props.init(game)
     • no update → Props.update(game, dt)
   Iluminação: PROP_LIGHTS é lido por game._drawLighting p/ que
   tochas/fogueiras/cristais REALMENTE iluminem o escuro.
   ============================================================ */

// raio (px) e cor da luz que cada tipo emite (perfura a escuridão do subsolo)
const PROP_LIGHTS = {
  torch: { r: 66, c: '#ffb24a' }, lantern: { r: 60, c: '#ffc24a' }, candle: { r: 40, c: '#ffd27a' },
  cauldron: { r: 56, c: '#8effb0' }, campfire: { r: 124, c: '#ffae4a' }, brazier: { r: 104, c: '#ff9a3c' },
  magicfire: { r: 108, c: '#7be0ff' }, chandelier: { r: 110, c: '#ffd27a' }, mushroom: { r: 50, c: '#7be0ff' },
  arcaneorb: { r: 86, c: '#b07bff' }, shrine: { r: 96, c: '#ffe9a8' }, crystalcluster: { r: 64, c: '#bff0ff' },
  portal: { r: 72, c: '#b07bff' }, fountain: { r: 54, c: '#9fd8ff' },
};

const Props = (function () {
  const T = () => CONFIG.TILE;
  const snd = (m, ...a) => { try { if (typeof Sound !== 'undefined' && Sound[m]) Sound[m](...a); } catch (e) {} };

  // dano (com knock) a quem estiver dentro de um retângulo de mundo
  function hurtBox(game, x, y, w, h, dmg, opts) {
    opts = opts || {}; const box = { x, y, w, h }; let hit = false;
    const p = game.player;
    if (p && !p.dead && aabb(box, p)) { p.hurt(dmg, opts.dir != null ? opts.dir : (sign(p.cx - (x + w / 2)) || 1), game); hit = true; }
    if (!opts.playerOnly) for (const e of game.enemies) if (e.alive && aabb(box, e)) { e.hurt(dmg, sign(e.cx - (x + w / 2)) || 1, game); hit = true; }
    return hit;
  }
  function playerIn(game, x, y, w, h) { const p = game.player; return p && !p.dead && aabb({ x, y, w, h }, p); }
  function spawnEnemy(game, x, y, key) {
    try { const e = new Enemy(x - 16, y - 42, key); game.enemies.push(e); game.fx.magic(e.cx, e.cy, '#c479ff', 12); game.fx.smoke(e.cx, e.cy, 3); return e; } catch (err) { return null; }
  }
  function dropLoot(game, x, y, kinds) { for (const k of kinds) { try { game.pickups.push(new Pickup(x + rand(-9, 9), y - rand(2, 12), k)); } catch (e) {} } }
  function enemyBullet(game, x, y, ang, speed, opts) { game.bullets.push(new Bullet(x, y, ang, speed, Object.assign({ faction: 'enemy' }, opts))); }
  // inimigo "operando" a máquina de guerra (canhão/balista/catapulta): o + próximo num raio
  function operator(game, d, radius) {
    let best = null, bd = radius;
    for (const e of game.enemies) { if (!e.alive) continue; const dd = Math.hypot(e.cx - (d.x + T() / 2), e.cy - (d.y + T() / 2)); if (dd < bd) { bd = dd; best = e; } }
    return best;
  }

  const defs = {
    // ---------------- MINA TERRESTRE ----------------
    mine: {
      init(d) { d.armed = false; d.fuse = 0; },
      update(d, dt, game) {
        if (d.remove) return;
        const t = T(), box = { x: d.x + 2, y: d.y - t * 0.6, w: t - 4, h: t * 1.6 };
        if (!d.armed) { if (playerIn(game, box.x, box.y, box.w, box.h) || game.enemies.some(e => e.alive && aabb(box, e))) { d.armed = true; d.fuse = 0.5; snd('coin'); } return; }
        d.fuse -= dt;
        if (d.fuse <= 0) {
          const cx = d.x + t / 2, cy = d.y + t / 2;
          game.world.explode(cx, cy, 84, 50); game.cam.addShake(10); game.flashScreen(0.2); snd('explode');
          d.remove = true;
        }
      },
    },
    // ---------------- ESPINHOS (retráteis) ----------------
    spikes: {
      init(d) { d.phase = rand(0, 3); d.hitCd = 0; },
      update(d, dt, game) {
        d.phase = (d.phase || 0) + dt; d.hitCd = Math.max(0, d.hitCd - dt);
        const cyc = d.phase % 2.4; d.ext = cyc < 0.35 ? cyc / 0.35 : (cyc < 1.3 ? 1 : Math.max(0, 1 - (cyc - 1.3) / 0.4));
        if (d.ext > 0.6 && d.hitCd <= 0) { const t = T(); if (hurtBox(game, d.x + 3, d.y + t * 0.2, t - 6, t * 0.8, 16)) { d.hitCd = 0.6; snd('hit'); } }
      },
    },
    // ---------------- SERRA DESLIZANTE ----------------
    saw: {
      init(d) { d.x0 = d.x; d.range = (d.opts && d.opts.range || 3) * T(); d.dir = 1; d.rot = 0; d.hitCd = 0; },
      update(d, dt, game) {
        d.rot = (d.rot || 0) + dt * 16; d.hitCd = Math.max(0, d.hitCd - dt);
        d.x += d.dir * 90 * dt;
        if (d.x > d.x0 + d.range) { d.x = d.x0 + d.range; d.dir = -1; } else if (d.x < d.x0) { d.x = d.x0; d.dir = 1; }
        const t = T();
        if (d.hitCd <= 0 && hurtBox(game, d.x + 3, d.y + 3, t - 6, t - 6, 22)) { d.hitCd = 0.4; game.cam.addShake(2); snd('hit'); }
      },
    },
    // ---------------- JATO DE CHAMAS (vertical) ----------------
    flamevent: {
      init(d) { d.cd = rand(0, 2); d.on = 0; d.hitCd = 0; },
      update(d, dt, game) {
        d.cd -= dt; d.hitCd = Math.max(0, d.hitCd - dt);
        if (d.on > 0) {
          d.on -= dt; const t = T(), reach = t * 3, cx = d.x + t / 2, top = d.y;
          game.fx.flame(cx, top, -Math.PI / 2, reach);
          if (d.hitCd <= 0 && hurtBox(game, d.x + 4, top - reach, t - 8, reach, 14)) {
            d.hitCd = 0.35; for (const e of game.enemiesInRadius(cx, top - reach * 0.5, reach * 0.6)) e.ignite && e.ignite(3, 8);
          }
          if (d.on <= 0) d.cd = 1.6 + rand(0, 0.8);
        } else if (d.cd <= 0) { d.on = 0.85; snd('shot', 'flame'); }
      },
    },
    // ---------------- ARMADILHA DE DARDOS (parede) ----------------
    darttrap: {
      init(d) { d.cd = rand(0, 1.2); },
      update(d, dt, game) {
        d.cd -= dt; const p = game.player; if (!p || p.dead) return;
        const t = T(), cy = d.y + t / 2;
        if (d.cd <= 0 && Math.abs(p.cy - cy) < t * 1.2 && Math.abs(p.cx - (d.x + t / 2)) < t * 9) {
          const dir = sign(p.cx - d.x) || -1; d.face = dir;
          enemyBullet(game, d.x + t / 2 + dir * 8, cy, dir > 0 ? 0 : Math.PI, 540, { kind: 'arrow', dmg: 12, r: 3, life: 1.6, knock: 90, tileDmg: 2 });
          snd('bow'); d.cd = 1.5;
        }
      },
    },
    // ---------------- PÊNDULO (lâmina pendular) ----------------
    pendulum: {
      init(d) { d.len = (d.opts && d.opts.len || 2.2) * T(); d.amp = (d.opts && d.opts.amp) || 1.05; d.hitCd = 0; },
      update(d, dt, game) {
        d.hitCd = Math.max(0, d.hitCd - dt); const t = T();
        const ang = Math.sin((d.t || 0) * 2.2) * d.amp;
        const tx = d.x + t / 2 + Math.sin(ang) * d.len, ty = d.y + Math.cos(ang) * d.len;
        d.bx = tx; d.by = ty;
        if (d.hitCd <= 0 && hurtBox(game, tx - 12, ty - 12, 24, 24, 26)) { d.hitCd = 0.5; game.cam.addShake(3); snd('hit'); }
      },
    },
    // ---------------- VÁLVULA DE GÁS VENENOSO ----------------
    gasvent: {
      init(d) { d.cd = rand(0, 2); d.on = 0; d.hitCd = 0; },
      update(d, dt, game) {
        d.cd -= dt; d.hitCd = Math.max(0, d.hitCd - dt); const t = T(), cx = d.x + t / 2, cy = d.y + t / 2;
        if (d.on > 0) {
          d.on -= dt;
          if (Math.random() < 0.7) game.fx._add({ x: cx + rand(-t, t), y: cy + rand(-t, 4), vx: rand(-14, 14), vy: -rand(8, 26), life: rand(0.6, 1.2), max: 1.2, r: rand(4, 9), c: 'rgba(120,200,90,', smoke: true });
          if (d.hitCd <= 0 && hurtBox(game, cx - t * 1.4, cy - t * 1.4, t * 2.8, t * 2.4, 8)) { d.hitCd = 0.6; for (const e of game.enemiesInRadius(cx, cy, t * 1.6)) e.slow && e.slow(1, 0.6); }
          if (d.on <= 0) d.cd = 2.2 + rand(0, 1);
        } else if (d.cd <= 0) { d.on = 1.6; }
      },
    },
    // ---------------- BAÚ (tesouro ou nada) ----------------
    chest: {
      init(d) { d.open = false; d.openAmt = 0; d.empty = !!(d.opts && d.opts.empty); },
      update(d, dt, game) {
        const t = T();
        if (!d.open && playerIn(game, d.x - 2, d.y - 6, t + 4, t + 6)) {
          d.open = true; const cx = d.x + t / 2;
          game.cam.addShake(3); snd('coin');
          if (d.empty || (!(d.opts && d.opts.loot) && Math.random() < 0.2)) { game.fx.smoke(cx, d.y, 5); game.fx.text(cx, d.y - 8, 'VAZIO...', '#9a8f7d'); }
          else {
            const loot = (d.opts && d.opts.loot) || pick([['oregano', 'oregano', 'oregano', 'potion'], ['oregano', 'oregano', 'life'], ['oregano', 'token'], ['potion', 'oregano', 'oregano']]);
            dropLoot(game, cx, d.y, Array.isArray(loot) ? loot : [loot]);
            game.fx.spark(cx, d.y, '#ffe27a', 16); game.fx.text(cx, d.y - 8, 'TESOURO!', '#ffe27a'); snd('rescue');
          }
        }
        d.openAmt = approach(d.openAmt || 0, d.open ? 1 : 0, dt * 6);
      },
    },
    // ---------------- BAÚ ARMADILHA (explode / dispara flechas) ----------------
    trapchest: {
      init(d) { d.open = false; d.openAmt = 0; d.kind = (d.opts && d.opts.trap) || (Math.random() < 0.5 ? 'bomb' : 'arrows'); },
      update(d, dt, game) {
        const t = T();
        if (!d.open && playerIn(game, d.x - 2, d.y - 6, t + 4, t + 6)) {
          d.open = true; const cx = d.x + t / 2, cy = d.y + t / 2;
          game.fx.text(cx, d.y - 10, 'ARMADILHA!', '#ff5b4a');
          if (d.kind === 'arrows') {
            for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI; enemyBullet(game, cx, cy, a, 460, { kind: 'arrow', dmg: 12, r: 3, life: 1.4, knock: 90, tileDmg: 2 }); }
            snd('bow'); game.cam.addShake(4);
          } else { game.world.explode(cx, cy, 92, 48); game.cam.addShake(9); game.flashScreen(0.18); snd('explode'); }
        }
        d.openAmt = approach(d.openAmt || 0, d.open ? 1 : 0, dt * 10);
      },
    },
    // ---------------- MÍMICO (baú que vira monstro) ----------------
    mimic: {
      init(d) { d.open = false; d.openAmt = 0; },
      update(d, dt, game) {
        const t = T();
        if (!d.open && playerIn(game, d.x - 4, d.y - 8, t + 8, t + 8)) {
          d.open = true; const cx = d.x + t / 2;
          game.fx.text(cx, d.y - 10, 'MÍMICO!', '#ff5b4a'); game.cam.addShake(6); snd('hurt');
          const p = game.player; if (p) { p.vx += (sign(p.cx - cx) || 1) * 220; p.vy -= 120; }
          spawnEnemy(game, cx, d.y + t, (d.opts && d.opts.enemy) || 'ghoul');
          d.remove = true;
        }
      },
    },
    // ---------------- PORTA SECRETA (parece parede; revela ao tocar) ----------------
    secretdoor: {
      init(d) { d.found = false; d.openAmt = 0; },   // a célula fica VAZIA (passável); a arte finge ser parede
      update(d, dt, game) {
        const t = T();
        if (!d.found && playerIn(game, d.x - 2, d.y - 2, t + 4, t + 4)) { d.found = true; game.fx.smoke(d.x + t / 2, d.y + t / 2, 6); game.fx.text(d.x + t / 2, d.y - 6, 'PASSAGEM SECRETA!', '#bff0ff'); snd('swap'); }
        d.openAmt = approach(d.openAmt || 0, d.found ? 1 : 0, dt * 3);
      },
    },
    // ---------------- PORTA TRANCADA (só abre a tiros/flechas) ----------------
    lockeddoor: {
      init(d, game) {
        d.c = (d.x / T()) | 0; d.r = (d.y / T()) | 0; d.hits = (d.opts && d.opts.hits) || 3; d.maxHits = d.hits; d.open = false; d.flash = 0;
        game.world.set(d.c, d.r, 5);   // bedrock: sólida e à prova de escavação até ser arrombada
      },
      update(d, dt, game) {
        if (d.open) return; d.flash = Math.max(0, d.flash - dt);
        const t = T(), box = { x: d.x - 3, y: d.y - 3, w: t + 6, h: t + 6 };
        for (const b of game.bullets) {
          if (!b.alive && b._countedDoor) continue;
          if (b.faction === 'player' && aabb({ x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 }, box)) {
            b.alive = false; b._countedDoor = true; d.hits--; d.flash = 0.12;
            game.fx.spark(b.x, b.y, '#caa33a', 6); game.cam.addShake(2); snd('hit');
            if (d.hits <= 0) { game.world.set(d.c, d.r, 0); d.open = true; game.fx.smoke(d.x + t / 2, d.y + t / 2, 8); game.fx.spark(d.x + t / 2, d.y + t / 2, '#ffe27a', 16); game.fx.text(d.x + t / 2, d.y - 6, 'DESTRANCADA!', '#ffe27a'); snd('crumble'); }
            break;
          }
        }
      },
    },
    // ---------------- CANHÃO (operado por inimigos) ----------------
    cannon: {
      init(d) { d.cd = rand(0.5, 2); d.recoil = 0; d.aim = 0; d.manned = false; },
      update(d, dt, game) {
        d.recoil = Math.max(0, d.recoil - dt * 4); const t = T(), p = game.player;
        const op = operator(game, d, t * 2.6); d.manned = !!op;
        if (!op || !p || p.dead) return;
        const cx = d.x + t / 2, cy = d.y + t * 0.4;
        d.aim = clamp(Math.atan2(p.cy - cy, p.cx - cx), -0.9, 0.9); d.face = sign(p.cx - cx) || 1;
        d.cd -= dt;
        if (d.cd <= 0) {
          const mx = cx + Math.cos(d.aim) * d.face * 18, my = cy + Math.sin(d.aim) * 18;
          enemyBullet(game, mx, my, d.face > 0 ? d.aim : Math.PI - d.aim, 440, { kind: 'cannon', dmg: 24, r: 6, explosive: 70, tileDmg: 50, life: 3, knock: 200 });
          game.fx.muzzle(mx, my, d.face > 0 ? d.aim : Math.PI - d.aim); game.cam.addShake(4); d.recoil = 1; d.cd = 2.0; snd('shot', 'shotgun');
        }
      },
    },
    // ---------------- BALISTA (virote rápido) ----------------
    ballista: {
      init(d) { d.cd = rand(0.4, 1.4); d.recoil = 0; d.aim = 0; d.manned = false; },
      update(d, dt, game) {
        d.recoil = Math.max(0, d.recoil - dt * 5); const t = T(), p = game.player;
        const op = operator(game, d, t * 2.6); d.manned = !!op; if (!op || !p || p.dead) return;
        const cx = d.x + t / 2, cy = d.y + t * 0.4;
        d.aim = clamp(Math.atan2(p.cy - cy, p.cx - cx), -0.8, 0.8); d.face = sign(p.cx - cx) || 1;
        d.cd -= dt;
        if (d.cd <= 0) { const mx = cx + d.face * 16; enemyBullet(game, mx, cy, d.face > 0 ? d.aim : Math.PI - d.aim, 860, { kind: 'arrow', dmg: 18, r: 4, life: 1.6, knock: 130, tileDmg: 4 }); game.fx.muzzle(mx, cy, d.face > 0 ? d.aim : Math.PI - d.aim); game.cam.addShake(2); d.recoil = 1; d.cd = 1.3; snd('bow'); }
      },
    },
    // ---------------- CATAPULTA (lança bomba em arco) ----------------
    catapult: {
      init(d) { d.cd = rand(1, 3); d.arm = 0; d.manned = false; },
      update(d, dt, game) {
        d.arm = Math.max(0, d.arm - dt * 2); const t = T(), p = game.player;
        const op = operator(game, d, t * 2.8); d.manned = !!op; if (!op || !p || p.dead) return;
        d.face = sign(p.cx - (d.x + t / 2)) || 1; d.cd -= dt;
        if (d.cd <= 0) { const cx = d.x + t / 2, cy = d.y; enemyBullet(game, cx, cy - 6, d.face > 0 ? -0.95 : Math.PI + 0.95, 420, { kind: 'grenade', dmg: 22, r: 7, explosive: 70, tileDmg: 40, grav: 900, life: 3.2, spin: 8 }); game.cam.addShake(3); d.arm = 1; d.cd = 3.0; snd('shot', 'shotgun'); }
      },
    },
    // ---------------- PORTAL (teletransporte em par) ----------------
    portal: {
      init(d) { d.cd = 0; },
      update(d, dt, game) {
        d.cd = Math.max(0, (d.cd || 0) - dt); const p = game.player; if (!p || p.dead || d.cd > 0) return;
        const t = T();
        if (aabb({ x: d.x, y: d.y - t * 0.5, w: t, h: t * 1.5 }, p)) {
          const list = game._portals || []; if (list.length < 2) return;
          const i = list.indexOf(d), dest = list[(i + 1) % list.length]; if (!dest || dest === d) return;
          p.x = dest.x + t / 2 - p.w / 2; p.y = dest.y + t - p.h; p.vx *= 0.3;
          game.fx.magic(d.x + t / 2, d.y + t / 2, '#b07bff', 16); game.fx.magic(dest.x + t / 2, dest.y + t / 2, '#b07bff', 18);
          game.cam.addShake(3); snd('cast'); d.cd = 0.9; dest.cd = 0.9;
        }
      },
    },
    // ---------------- PLATAFORMA DE SALTO (mola arcana) ----------------
    springpad: {
      init(d) { d.squish = 0; },
      update(d, dt, game) {
        d.squish = Math.max(0, d.squish - dt * 4); const t = T(), p = game.player;
        if (p && !p.dead && p.vy >= -20 && aabb({ x: d.x + 2, y: d.y - 4, w: t - 4, h: 12 }, { x: p.x, y: p.y + p.h - 6, w: p.w, h: 8 })) {
          p.vy = -(d.opts && d.opts.power || 1180); p.jumps = p.maxJumps; d.squish = 1; game.fx.smoke(p.cx, p.y + p.h, 4); game.fx.spark(p.cx, p.y + p.h, '#bff0ff', 6); snd('jump');
        }
        for (const e of game.enemies) if (e.alive && e.vy >= -20 && aabb({ x: d.x + 2, y: d.y - 4, w: t - 4, h: 12 }, { x: e.x, y: e.y + e.h - 6, w: e.w, h: 8 })) { e.vy = -780; d.squish = 1; }
      },
    },
    // ---------------- ORBE ARCANO (paira e zapeia) ----------------
    arcaneorb: {
      init(d) { d.cd = rand(0, 1); d.y0 = d.y; },
      update(d, dt, game) {
        d.cd = Math.max(0, d.cd - dt); const t = T(), cx = d.x + t / 2, cy = d.y0 - t * 0.3 + Math.sin((d.t || 0) * 2) * 6; d.cy2 = cy;
        const p = game.player; if (!p || p.dead) return;
        if (d.cd <= 0 && Math.hypot(p.cx - cx, p.cy - cy) < t * 2.6) { game.fx.bolt(cx, cy, p.cx, p.cy, '#b07bff'); game.fx.miniShock(p.cx, p.cy, '#c479ff', 4); p.hurt(8, sign(p.cx - cx) || 1, game); d.cd = 1.3; snd('cast'); }
      },
    },
    // ---------------- SANTUÁRIO (cura lenta por proximidade) ----------------
    shrine: {
      init(d) { d.cd = 0; },
      update(d, dt, game) {
        d.cd = Math.max(0, d.cd - dt); const t = T(), p = game.player; if (!p || p.dead) return;
        if (d.cd <= 0 && p.hp < p.maxhp && Math.hypot(p.cx - (d.x + t / 2), p.cy - (d.y + t / 2)) < t * 3) { p.hp = clamp(p.hp + 6, 0, p.maxhp); game.fx.text(p.cx, p.y - 6, '+6', '#7be08a'); game.fx.spark(d.x + t / 2, d.y, '#ffe9a8', 4); d.cd = 1.0; }
      },
    },
    // ---------------- CÍRCULO DE INVOCAÇÃO (emboscada) ----------------
    summon: {
      init(d) { d.used = false; },
      update(d, dt, game) {
        if (d.used) return; const t = T();
        if (playerIn(game, d.x - t, d.y - 6, t * 3, t + 6)) {
          d.used = true; const cx = d.x + t / 2; game.fx.magic(cx, d.y, '#b07bff', 22); game.fx.text(cx, d.y - 8, 'EMBOSCADA!', '#c479ff'); game.cam.addShake(5); snd('cast');
          const mob = (d.opts && d.opts.enemy) || 'zombie', n = (d.opts && d.opts.count) || 2;
          for (let i = 0; i < n; i++) spawnEnemy(game, cx + (i - (n - 1) / 2) * t, d.y, mob);
        }
      },
    },
    // ---------------- CORRENTE ASCENDENTE (levita no poço) ----------------
    updraft: {
      init(d) { d.h = (d.opts && d.opts.h || 5) * T(); },
      update(d, dt, game) {
        const t = T(), p = game.player; if (!p || p.dead) return;
        if (aabb({ x: d.x, y: d.y - d.h, w: t, h: d.h + t }, p)) { p.vy = clamp(p.vy - 1100 * dt, -240, 999); p.onGround = false; if (Math.random() < 0.6) game.fx.spark(p.cx + rand(-8, 8), p.y + p.h, '#9fd8ff', 1); }
      },
    },
    // ---------------- SINO / ALARME (alerta os inimigos) ----------------
    bell: {
      init(d) { d.cd = 0; d.ring = 0; },
      update(d, dt, game) {
        d.cd = Math.max(0, d.cd - dt); d.ring = Math.max(0, d.ring - dt); const t = T(), p = game.player; if (!p || p.dead) return;
        if (d.cd <= 0 && Math.hypot(p.cx - (d.x + t / 2), p.cy - (d.y + t / 2)) < t * 3) {
          game.alertEnemies(p.cx, p.cy, 4000); d.ring = 0.7; d.cd = 5; game.fx.text(d.x + t / 2, d.y - 8, 'ALARME!', '#ffd86b'); game.cam.addShake(3); snd('coin');
        }
      },
    },
    // ---------------- FIO DE ARMADILHA (tripwire) ----------------
    tripwire: {
      init(d) { d.armed = true; d.cd = 0; d.len = (d.opts && d.opts.len || 3) * T(); },
      update(d, dt, game) {
        d.cd = Math.max(0, d.cd - dt); const t = T(), p = game.player; if (!p || p.dead) return;
        if (d.armed && p.cx > d.x && p.cx < d.x + d.len && Math.abs(p.cy - (d.y + t / 2)) < t) { d.armed = false; d.cd = 5; game.alertEnemies(p.cx, p.cy, 4000); game.flashScreen(0.12); game.fx.text(p.cx, p.y - 8, 'DETECTADO!', '#ff8a3c'); snd('hit'); }
        if (!d.armed && d.cd <= 0) d.armed = true;
      },
    },
    // ---------------- ELEVADOR (plataforma móvel que se anda em cima) ----------------
    elevator: {
      init(d) { d.x0 = d.x; d.y0 = d.y; d.range = (d.opts && d.opts.range || 4) * T(); d.spd = (d.opts && d.opts.spd) || 70; d.axis = (d.opts && d.opts.axis) || 'y'; d.pw = (d.opts && d.opts.w || 2) * T(); d.phase = 0; d.dir = 1; },
      update(d, dt, game) {
        d.phase += d.dir * d.spd * dt; if (d.phase >= d.range) { d.phase = d.range; d.dir = -1; } else if (d.phase <= 0) { d.phase = 0; d.dir = 1; }
        const px = d.x, py = d.y;
        if (d.axis === 'x') { d.x = d.x0 + d.phase; d.y = d.y0; } else { d.x = d.x0; d.y = d.y0 - d.phase; }
        const dx = d.x - px, dy = d.y - py, t = T(), p = game.player;
        const rideTop = top => p && !p.dead && (p.x + p.w) > d.x + 3 && p.x < d.x + d.pw - 3 && (p.y + p.h) >= top - 8 && (p.y + p.h) <= top + 14 && p.vy >= -30;
        if (rideTop(d.y)) { p.y = d.y - p.h; p.vy = 0; p.onGround = true; p.x += dx; }
      },
    },
    // ---------------- FOGUEIRA (ilumina; queima quem encosta) ----------------
    campfire: {
      init(d) { d.hitCd = 0; },
      update(d, dt, game) {
        d.hitCd = Math.max(0, d.hitCd - dt); const t = T();
        if (Math.random() < 0.5) game.fx._add({ x: d.x + t / 2 + rand(-6, 6), y: d.y + t * 0.5, vx: rand(-12, 12), vy: -rand(30, 70), life: rand(0.4, 0.9), max: 0.9, r: rand(1, 2.6), c: pick(['#ffd86b', '#ff8a3c']), g: -30, glow: true, shrink: true });
        if (d.hitCd <= 0 && hurtBox(game, d.x + 6, d.y + t * 0.35, t - 12, t * 0.65, 10)) { d.hitCd = 0.5; const p = game.player; if (p && p.ignite) {} }
      },
    },
    // fogueiras puramente luminosas (sem dano): braseiro, fogo mágico, lustre
    brazier: { init() {}, update(d, dt, game) { const t = T(); if (Math.random() < 0.4) game.fx._add({ x: d.x + t / 2 + rand(-5, 5), y: d.y + 6, vx: rand(-10, 10), vy: -rand(24, 60), life: rand(0.4, 0.8), max: 0.8, r: rand(1, 2.4), c: pick(['#ffd86b', '#ff8a3c']), g: -28, glow: true, shrink: true }); } },
    magicfire: { init() {}, update(d, dt, game) { const t = T(); if (Math.random() < 0.4) game.fx._add({ x: d.x + t / 2 + rand(-5, 5), y: d.y + 8, vx: rand(-8, 8), vy: -rand(20, 54), life: rand(0.4, 0.9), max: 0.9, r: rand(1, 2.4), c: pick(['#7be0ff', '#9fd8ff', '#bff0ff']), g: -24, glow: true, shrink: true }); } },
    chandelier: { init() {}, update() {} },
    mushroom: { init() {}, update() {} },
    fountain: { init() {}, update(d, dt, game) { const t = T(); if (Math.random() < 0.5) game.fx._add({ x: d.x + t / 2 + rand(-3, 3), y: d.y + 4, vx: rand(-22, 22), vy: -rand(40, 90), life: rand(0.3, 0.6), max: 0.6, r: rand(1, 2), c: '#9fd8ff', g: 400, glow: true, shrink: true }); } },
    crystalcluster: { init() {}, update() {} },
    // decorações estáticas (sem comportamento) — entram na paleta por variedade
    statue: { init() {}, update() {} },
    grave: { init() {}, update() {} },
    anvil: { init() {}, update() {} },
    stalagmite: { init() {}, update() {} },
  };

  return {
    defs, lights: PROP_LIGHTS,
    // inicializa o estado de runtime de cada prop interativo após a fase carregar
    init(game) {
      game._portals = game.decor.filter(d => d.type === 'portal');
      for (const d of game.decor) {
        const def = defs[d.type]; if (!def) continue;
        d.ac = null;                 // props interativos NÃO somem quando um bloco vizinho cai
        d.t = 0;
        try { def.init && def.init(d, game); } catch (e) {}
      }
    },
    update(game, dt) {
      for (const d of game.decor) {
        const def = defs[d.type]; if (!def || !def.update) continue;
        d.t = (d.t || 0) + dt;
        def.update(d, dt, game);
      }
    },
    has(type) { return !!defs[type]; },
  };
})();

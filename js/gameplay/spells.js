/* ============================================================
   spells.js — LIVROS DE HABILIDADE (árvores) por herói + o GRIMÓRIO
   -----------------------------------------------------------------
   Heróis com "livro" próprio escolhem uma habilidade ATIVA (botão Especial)
   numa árvore de TRADIÇÕES. Abra o livro com G; clique para preparar; troque
   rápido com [ ]. Hoje TUDO liberado (campo de testes) — o futuro é liberar/
   evoluir tradições pelo save (filtre `book.order` por progresso).

     • EDWARD   → ✦ GRIMÓRIO (feitiços mágicos: elementos, mente, invocação…)
     • RAGNAROK → ⚔ CÓDICE DE GUERRA (técnicas: bárbaro, guerra, paladino…)

   Como ADICIONAR: crie um spell { id, name, icon, tradition, tier, cost, cd,
   desc, cast(p, game) } na lista do livro. Recursos no `cast`:
   game.enemiesInRadius / nearestEnemy / summon / meleeArc / meleeRadial /
   electricBurst / world / fx / bullets, status do inimigo (freeze/sleep/
   ignite/slow/frighten/envenom) e buffs do herói (flyT/phaseT/invisT/hasteT/
   wardHp/berserkT/lifestealT/meleeStance).
   ============================================================ */

// rótulos curtos das POSTURAS de arma branca do Ragnarok (mostrados no HUD)
const STANCE_LABEL = { hammer: 'MARTELO', fists: 'PUNHOS DE FOGO', flamesword: 'LÂMINA ÍGNEA', transcendent: 'TRANSCENDENTE' };

/* ---------- helpers de conjuração compartilhados ---------- */
function _allyBolt(game, x, y, ang, speed, opts) {
  game.bullets.push(new Bullet(x, y, ang, speed, Object.assign({ faction: 'player' }, opts)));
}
function _conjureWall(p, game) {
  const T = game.world.T, dir = p.face;
  const c0 = Math.floor((p.cx + dir * T * 1.1) / T), rFeet = Math.floor((p.y + p.h - 1) / T);
  for (let col = 0; col < 2; col++) {
    const c = c0 + col * dir;
    for (let r = rFeet; r > rFeet - 4; r--) if (!game.world.solid(c, r)) { game.world.set(c, r, 37); game.fx.spark(c * T + T / 2, r * T + T / 2, '#bff0ff', 4); }
  }
  game.fx.magic(p.cx + dir * T * 1.5, p.cy, '#bff0ff', 16); game.cam.addShake(3); Sound.cast();
}
function _conjureBridge(p, game) {
  const T = game.world.T, dir = p.face;
  const rFeet = Math.floor((p.y + p.h + 2) / T), c0 = Math.floor(p.cx / T);
  for (let i = 1; i <= 7; i++) { const c = c0 + dir * i; if (!game.world.solid(c, rFeet)) { game.world.set(c, rFeet, 37); game.fx.spark(c * T + T / 2, rFeet * T + T / 2, '#bff0ff', 3); } }
  Sound.cast();
}
// muda a ARMA BRANCA do Ragnarok (o golpe C) por um tempo
function _setStance(p, game, stance, t, label, color) {
  p.meleeStance = stance; p.meleeStanceT = t;
  game.fx.magic(p.cx, p.cy, color, 16); game.fx.text(p.cx, p.y - 12, label, color);
}
// golpe sísmico no chão: dano radial + arremesso + destrói o solo + poeira/detritos
function _warSlam(p, game, o) {
  const R = o.radius || 4 * CONFIG.TILE, T = game.world.T;
  for (const e of game.enemiesInRadius(p.cx, p.cy, R)) {
    const d = Math.hypot(e.cx - p.cx, e.cy - p.cy), kd = sign(e.cx - p.cx) || 1;
    e.hurt(Math.round((o.dmg || 34) * (1 - d / (R * 1.5))), kd, game);
    e.vx += kd * (o.knock || 220); e.vy = -(o.launch || 420); e.stagger = Math.max(e.stagger, 0.4);
    game.fx.spark(e.cx, e.cy + e.h * 0.4, '#caa33a', 4);
  }
  if (o.breakGround !== false) {                                   // racha/destrói o chão à frente e abaixo
    const cc = Math.floor(p.cx / T), fr = Math.floor((p.y + p.h + 2) / T), span = Math.round(R / T);
    for (let dx = -span; dx <= span; dx++) for (let dr = 0; dr < 2; dr++) if (Math.random() < 0.85) game.world.damage(cc + dx, fr + dr, 70, { power: 130 });
  }
  game.fx.shock(p.cx, p.y + p.h, R, o.color || '#caa33a'); game.fx.shock(p.cx, p.y + p.h, R * 0.55, '#fff');
  for (let i = 0; i < 14; i++) game.fx.smoke(p.cx + rand(-R * 0.6, R * 0.6), p.y + p.h, 1, 'rgba(150,128,96,');
  game.fx.debrisBurst(p.cx, p.y + p.h, '#5a4326', 130);
  game.cam.addShake(o.shake || 8); game.flashScreen(0.12); Sound.thump();
}

/* ============================================================
   LIVRO 1 — ✦ GRIMÓRIO DE EDWARD (feitiços mágicos)
   ============================================================ */
const EDWARD_BOOK = {
  hero: 'edward', resource: 'MANA', title: '✦ GRIMÓRIO DE EDWARD ✦', subtitle: 'Tradições da Feitiçaria',
  traditions: [
    { key: 'elements', name: 'ELEMENTOS',    icon: '☄', color: '#ff8a3c' },
    { key: 'transmut', name: 'TRANSMUTAÇÃO', icon: '⛰', color: '#caa33a' },
    { key: 'conjure',  name: 'INVOCAÇÃO',    icon: '☠', color: '#7be08a' },
    { key: 'mind',     name: 'MENTE',        icon: '✷', color: '#b07bff' },
    { key: 'arcane',   name: 'ARCANA',       icon: '✦', color: '#6fd0ff' },
  ],
  spells: [
    /* ELEMENTOS */
    { id: 'firenova', name: 'Chama Voraz', icon: '🔥', tradition: 'elements', tier: 1, cost: 30, cd: 0.7,
      desc: 'Explosão de fogo ao redor: dano em área e QUEIMADURA contínua nos inimigos próximos.',
      cast(p, game) {
        const R = 4 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) {
          const d = Math.hypot(e.cx - p.cx, e.cy - p.cy), kd = sign(e.cx - p.cx) || 1;
          e.hurt(Math.round(42 * (1 - d / (R * 1.3))), kd, game); e.ignite(3.5, 9); e.vx += kd * 190; e.vy -= 130;
          game.fx.fire(e.cx, e.cy, 4);
        }
        game.fx.explosion(p.cx, p.cy, R * 0.5);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; game.fx.flame(p.cx, p.cy, a, R * 0.85); }
        game.cam.addShake(7); game.flashScreen(0.2); Sound.explode();
      } },
    { id: 'frostwave', name: 'Sopro Glacial', icon: '❄', tradition: 'elements', tier: 2, cost: 28, cd: 0.8,
      desc: 'Onda de gelo à frente que CONGELA os inimigos atingidos por alguns segundos.',
      cast(p, game) {
        const reach = 5 * CONFIG.TILE, dir = p.face, half = 2.2 * CONFIG.TILE;
        for (const e of game.enemies) {
          if (!e.alive) continue;
          const fwd = (e.cx - p.cx) * dir, off = Math.abs(e.cy - p.cy);
          if (fwd > -24 && fwd < reach && off < half) { e.hurt(14, dir, game); e.freeze(3.5); game.fx.iceShatter(e.cx, e.cy, 5); }
        }
        for (let i = 0; i < 18; i++) { const d = rand(20, reach); game.fx.spark(p.cx + dir * d, p.cy + rand(-half, half), '#bfe8ff', 2); }
        game.fx.muzzle(p.cx + dir * 20, p.cy, dir > 0 ? 0 : Math.PI); game.cam.addShake(3); Sound.cast();
      } },
    { id: 'chainlight', name: 'Tempestade de Raios', icon: '⚡', tradition: 'elements', tier: 3, cost: 34, cd: 0.7,
      desc: 'Um raio que SALTA de inimigo em inimigo (até 6), arrancando faíscas de cada corpo.',
      cast(p, game) {
        let from = { x: p.cx, y: p.cy }; const hit = new Set();
        for (let i = 0; i < 6; i++) {
          let best = null, bd = 230;
          for (const e of game.enemies) { if (!e.alive || hit.has(e)) continue; const d = Math.hypot(e.cx - from.x, e.cy - from.y); if (d < bd) { bd = d; best = e; } }
          if (!best) break; hit.add(best);
          game.fx.bolt(from.x, from.y, best.cx, best.cy, '#bff0ff'); game.fx.spark(best.cx, best.cy, '#bff0ff', 8);
          game.fx.miniShock(best.cx, best.cy, '#bff0ff', 4); best.hurt(28, sign(best.cx - from.x) || 1, game); best.vy -= 60;
          from = { x: best.cx, y: best.cy };
        }
        game.cam.addShake(4); Sound.zap();
      } },
    { id: 'icespikes', name: 'Estilhaços de Gelo', icon: '🧊', tradition: 'elements', tier: 4, cost: 22, cd: 0.45,
      desc: 'Leque de 3 lanças de gelo perfurantes que CONGELAM brevemente quem atravessam.',
      cast(p, game) {
        const m = p.muzzlePos(), base = p.aimAng;
        for (let i = -1; i <= 1; i++) _allyBolt(game, m.x, m.y, base + i * 0.12, 1000, { kind: 'ice', color: '#bfe8ff', dmg: 16, tileDmg: 10, r: 3.4, pierce: 2, life: 1.0, knock: 90, freezeT: 1.8 });
        game.fx.muzzle(m.x, m.y, base); Sound.cast();
      } },
    { id: 'meteor', name: 'Meteoro', icon: '☄', tradition: 'elements', tier: 5, cost: 45, cd: 1.0,
      desc: 'Invoca um meteoro flamejante que despenca à frente e explode (destrói o cenário).',
      cast(p, game) {
        const dir = p.face, tx = p.cx + dir * 5 * CONFIG.TILE, ty = p.cy - 7.5 * CONFIG.TILE;
        game.bullets.push(new Bullet(tx, ty, Math.PI / 2, 760, { faction: 'player', kind: 'fireball', color: '#ff7a2c', dmg: 48, tileDmg: 44, r: 9, explosive: 92, life: 2.0, knock: 240, grav: 220, burnT: 3, burnDps: 8 }));
        game.fx.text(p.cx, p.y - 12, 'METEORO!', '#ff8a3c'); Sound.cast();
      } },
    { id: 'stormfield', name: 'Campo da Constituição', icon: '🌩', tradition: 'elements', tier: 6, cost: 40, cd: 0.8,
      desc: 'Campo elétrico radial de 6 tiles: atinge tudo ao redor com mini-choques (não destrói blocos).',
      cast(p, game) { game.electricBurst(p, { radius: 6 * CONFIG.TILE, dmg: 50, knock: 200 }); } },

    /* TRANSMUTAÇÃO */
    { id: 'wall', name: 'Erguer Muralha', icon: '🧱', tradition: 'transmut', tier: 1, cost: 18, cd: 0.6,
      desc: 'Conjura uma parede de cristal à frente — bloqueia inimigos e tiros (destrutível).',
      cast(p, game) { _conjureWall(p, game); game.fx.text(p.cx, p.y - 10, 'MURALHA!', '#bff0ff'); } },
    { id: 'bridge', name: 'Ponte Arcana', icon: '🌉', tradition: 'transmut', tier: 2, cost: 16, cd: 0.5,
      desc: 'Estende uma ponte de cristal à frente, na linha dos pés — atravesse abismos.',
      cast(p, game) { _conjureBridge(p, game); game.fx.text(p.cx, p.y - 10, 'PONTE ARCANA', '#bff0ff'); } },
    { id: 'quake', name: 'Terratremor', icon: '⛰', tradition: 'transmut', tier: 3, cost: 38, cd: 1.1,
      desc: 'Racha o solo (DESTRÓI o chão) e ARREMESSA os inimigos para o alto numa onda de terra.',
      cast(p, game) {
        const T = game.world.T, c0 = Math.floor(p.cx / T), span = 8;
        const fr = Math.floor((p.y + p.h + 2) / T);
        game.world._caveIn(c0 - span, c0 + span, Math.floor(p.cy / T) - 1, fr + 3);
        for (let dx = -span; dx <= span; dx++) {                       // destrói/racha a faixa de chão
          if (Math.random() < 0.7) game.world.damage(c0 + dx, fr, 80, { power: 140 });
          if (Math.random() < 0.4) game.world.damage(c0 + dx, fr + 1, 60, { power: 120 });
        }
        for (const e of game.enemies) { if (!e.alive) continue; if (Math.abs(e.cx - p.cx) < span * T && e.onGround) { e.hurt(22, sign(e.cx - p.cx) || 1, game); e.vy = -560; e.vx += rand(-80, 80); e.stagger = Math.max(e.stagger, 0.7); game.fx.spark(e.cx, e.cy + e.h * 0.4, '#caa33a', 4); } }
        for (let i = 0; i < span * 2; i++) { const x = p.cx + rand(-span * T, span * T); game.fx.smoke(x, p.y + p.h, 2, 'rgba(140,118,86,'); game.fx.debrisBurst(x, p.y + p.h, '#5a4326', 70); }
        game.cam.addShake(13); game.flashScreen(0.16); Sound.thump(); Sound.crumble();
      } },
    { id: 'stoneskin', name: 'Pele de Pedra', icon: '🛡', tradition: 'transmut', tier: 4, cost: 30, cd: 1.0,
      desc: 'Reveste-se de pedra: um ESCUDO que absorve dano antes de tocar sua vida.',
      cast(p, game) { p.wardHp = Math.max(p.wardHp || 0, 90); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; game.fx.spark(p.cx + Math.cos(a) * 18, p.cy + Math.sin(a) * 18, '#caa33a', 3); } game.fx.magic(p.cx, p.cy, '#caa33a', 14); game.fx.text(p.cx, p.y - 10, 'PELE DE PEDRA', '#caa33a'); Sound.thump(); } },
    { id: 'midas', name: 'Toque de Midas', icon: '💰', tradition: 'transmut', tier: 5, cost: 32, cd: 0.8,
      desc: 'Transmuta o inimigo mais próximo em OURO: ele se petrifica em dourado e jorra orégano.',
      cast(p, game) {
        const e = game.nearestEnemy(p.cx, p.cy, 420); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#caa33a'); return; }
        if (e.boss) { e.hurt(60, 1, game); game.fx.text(e.cx, e.y - 8, 'GRANDE DEMAIS', '#caa33a'); return; }
        for (let i = 0; i < 26; i++) { const a = rand(0, TAU), d = rand(4, e.w); game.fx.spark(e.cx + Math.cos(a) * d, e.cy + Math.sin(a) * d * 1.3, '#ffe27a', 4); }
        game.fx.shock(e.cx, e.cy, 40, '#ffe27a'); game.spawnOregano(e.cx, e.cy, 12); e.hurt(9999, sign(e.cx - p.cx) || 1, game);
        game.fx.text(e.cx, e.cy - 10, 'OURO!', '#ffe27a'); Sound.coin();
      } },

    /* INVOCAÇÃO */
    { id: 'golem', name: 'Invocar Golem', icon: '🗿', tradition: 'conjure', tier: 1, cost: 45, cd: 0.8,
      desc: 'Ergue um GOLEM de pedra robusto que persegue e esmaga os inimigos a socos.',
      cast(p, game) { game.summon('golem', p.cx + p.face * 40, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'GOLEM!', '#7be08a'); game.cam.addShake(5); Sound.thump(); } },
    { id: 'wolves', name: 'Matilha Espectral', icon: '🐺', tradition: 'conjure', tier: 2, cost: 38, cd: 0.8,
      desc: 'Conjura 3 lobos espectrais velozes que caçam os inimigos em matilha.',
      cast(p, game) { for (let i = 0; i < 3; i++) game.summon('wolf', p.cx + p.face * (30 + i * 22) + rand(-10, 10), p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'MATILHA!', '#bff0ff'); Sound.cast(); } },
    { id: 'skeleton', name: 'Erguer Esqueleto', icon: '💀', tradition: 'conjure', tier: 3, cost: 30, cd: 0.7,
      desc: 'Reanima um esqueleto ARQUEIRO aliado que dispara flechas nos inimigos à distância.',
      cast(p, game) { game.summon('skeleton', p.cx + p.face * 36, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'SERVO ERGUIDO', '#cfe8a0'); Sound.cast(); } },
    { id: 'totem', name: 'Totem Vital', icon: '🔆', tradition: 'conjure', tier: 4, cost: 35, cd: 0.9,
      desc: 'Finca um totem fixo que pulsa CURA em você (e fere inimigos encostados).',
      cast(p, game) { game.summon('totem', p.cx, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'TOTEM VITAL', '#7be08a'); Sound.heal(); } },
    { id: 'dominate', name: 'Dominação', icon: '🧠', tradition: 'conjure', tier: 5, cost: 48, cd: 1.0,
      desc: 'Subjuga a mente do inimigo mais próximo: ele vira um SERVO aliado e luta por você.',
      cast(p, game) {
        const e = game.nearestEnemy(p.cx, p.cy, 480); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#7be08a'); return; }
        if (e.boss) { e.hurt(60, 1, game); game.fx.text(e.cx, e.y - 8, 'IMUNE', '#7be08a'); return; }
        const opts = { spr: e.spr, hp: Math.min(e.maxhp, 160), w: e.w, h: e.h, speed: e.def.speed * 1.1, dmg: 18, ranged: e.def.range > 0 };
        e.alive = false; game.fx.magic(e.cx, e.cy, '#7be08a', 22); game.fx.miniShock(e.cx, e.cy, '#7be08a', 5);
        game.summon('thrall', e.cx, e.y + e.h, opts);
        game.fx.text(e.cx, e.y - 10, 'DOMINADO!', '#7be08a'); Sound.cast();
      } },

    /* MENTE */
    { id: 'sleep', name: 'Canção do Sono', icon: '😴', tradition: 'mind', tier: 1, cost: 28, cd: 0.8,
      desc: 'Adormece os inimigos ao redor — notas de ninar pairam sobre eles até apanharem.',
      cast(p, game) {
        const R = 5 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) if (!e.boss) { e.sleep(6); game.fx.notes(e.cx, e.cy - e.h * 0.5, 3, '#cfe8ff'); }
        game.fx.shock(p.cx, p.cy, R, '#b07bff'); game.fx.notes(p.cx, p.cy - 10, 6, '#d8b0ff');
        game.fx.text(p.cx, p.y - 10, 'DURMAM…', '#b07bff'); Sound.note(); Sound.cast();
      } },
    { id: 'fear', name: 'Pavor', icon: '😱', tradition: 'mind', tier: 2, cost: 26, cd: 0.8,
      desc: 'Incute terror: espectros roxos brotam dos inimigos e eles FOGEM apavorados.',
      cast(p, game) {
        const R = 5 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) if (!e.boss) { e.frighten(4); game.fx.magic(e.cx, e.cy - e.h * 0.3, '#b07bff', 8); game.fx.spark(e.cx, e.cy - e.h * 0.4, '#3a1a5a', 4); }
        game.fx.shock(p.cx, p.cy, R, '#b07bff'); game.fx.text(p.cx, p.y - 10, 'PAVOR!', '#b07bff'); Sound.zap();
      } },
    { id: 'slow', name: 'Distorção Temporal', icon: '⏳', tradition: 'mind', tier: 3, cost: 28, cd: 0.8,
      desc: 'Dobra o tempo numa área: inimigos se movem e atacam em câmera lenta, envoltos em ondas.',
      cast(p, game) {
        const R = 5 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) { e.slow(5, 0.35); game.fx.shock(e.cx, e.cy, 26, '#9b7bff'); for (let i = 0; i < 3; i++) game.fx.spark(e.cx + rand(-e.w, e.w), e.cy + rand(-e.h * 0.5, e.h * 0.5), '#9b7bff', 2); }
        game.fx.shock(p.cx, p.cy, R, '#9b7bff'); game.fx.shock(p.cx, p.cy, R * 0.7, '#d8b0ff'); game.fx.text(p.cx, p.y - 10, 'DISTORÇÃO', '#b07bff'); Sound.cast();
      } },
    { id: 'implode', name: 'Implosão Mental', icon: '🫨', tradition: 'mind', tier: 4, cost: 40, cd: 0.9,
      desc: 'A mente do inimigo mais próximo IMPLODE — sucção de partículas e estilhaço psíquico nos vizinhos.',
      cast(p, game) {
        const e = game.nearestEnemy(p.cx, p.cy, 520); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#b07bff'); return; }
        for (let i = 0; i < 28; i++) { const a = rand(0, TAU), d = rand(28, 90); game.fx.spark(e.cx + Math.cos(a) * d, e.cy + Math.sin(a) * d, '#c479ff', 1); }
        game.fx.shock(e.cx, e.cy, 72, '#b07bff'); game.fx.magic(e.cx, e.cy, '#e0a0ff', 20); game.fx.miniShock(e.cx, e.cy, '#c479ff', 5);
        e.hurt(180, sign(e.cx - p.cx) || 1, game);
        for (const o of game.enemiesInRadius(e.cx, e.cy, 72)) if (o !== e) { const kd = sign(o.cx - e.cx) || 1; o.hurt(40, kd, game); o.vx += kd * 160; game.fx.spark(o.cx, o.cy, '#c479ff', 5); }
        game.cam.addShake(6); game.flashScreen(0.12); Sound.cast();
      } },
    { id: 'psyblast', name: 'Grito Psíquico', icon: '🌀', tradition: 'mind', tier: 5, cost: 34, cd: 0.7,
      desc: 'Onda psíquica radial: dano, forte EMPURRÃO e atordoamento, com anéis sobre cada corpo.',
      cast(p, game) {
        const R = 4 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) { const kd = sign(e.cx - p.cx) || 1; e.hurt(28, kd, game); e.vx += kd * 300; e.vy -= 160; e.stagger = Math.max(e.stagger, 0.4); game.fx.shock(e.cx, e.cy, 34, '#d8b0ff'); game.fx.spark(e.cx, e.cy, '#b07bff', 6); }
        game.fx.shock(p.cx, p.cy, R, '#b07bff'); game.fx.shock(p.cx, p.cy, R * 0.6, '#d8b0ff');
        game.cam.addShake(6); game.flashScreen(0.12); Sound.zap();
      } },

    /* ARCANA & MOBILIDADE */
    { id: 'fly', name: 'Voo', icon: '🕊', tradition: 'arcane', tier: 1, cost: 30, cd: 0.6,
      desc: 'Levita livremente por alguns segundos — suba e desça com ▲ / ▼.',
      cast(p, game) { p.flyT = 8; p.vy = -200; game.fx.magic(p.cx, p.cy, '#6fd0ff', 16); game.fx.text(p.cx, p.y - 10, 'VOO!', '#6fd0ff'); Sound.cast(); } },
    { id: 'blink', name: 'Piscar', icon: '💫', tradition: 'arcane', tier: 2, cost: 16, cd: 0.4,
      desc: 'Teletransporta-se vários tiles à frente — atravessa obstáculos curtos num piscar.',
      cast(p, game) {
        const dir = p.face, T = CONFIG.TILE; let nx = p.x;
        for (let s = 5; s >= 1; s--) { const tx = p.x + dir * s * T; if (!game.world.solidPx(tx + p.w / 2, p.cy) && !game.world.solidPx(tx + p.w / 2, p.y + 4)) { nx = tx; break; } }
        game.fx.magic(p.cx, p.cy, '#bff0ff', 14); p.x = clamp(nx, 0, game.world.pixelW - p.w); p.vx = dir * 120; p.invuln = Math.max(p.invuln, 0.2);
        game.fx.magic(p.cx, p.cy, '#bff0ff', 14); Sound.zap();
      } },
    { id: 'phase', name: 'Forma Etérea', icon: '👻', tradition: 'arcane', tier: 3, cost: 34, cd: 0.8,
      desc: 'Torna-se etéreo: ATRAVESSA paredes e projéteis por alguns segundos.',
      cast(p, game) { p.phaseT = 5; p.invuln = Math.max(p.invuln, 0.2); game.fx.magic(p.cx, p.cy, '#6fd0ff', 16); game.fx.text(p.cx, p.y - 10, 'FORMA ETÉREA', '#6fd0ff'); Sound.cast(); } },
    { id: 'invis', name: 'Manto Etéreo', icon: '🌫', tradition: 'arcane', tier: 4, cost: 32, cd: 0.8,
      desc: 'Some da vista: os inimigos não o enxergam até você atacar de perto.',
      cast(p, game) { p.invisT = 8; game.fx.magic(p.cx, p.cy, '#9fd0e0', 16); game.fx.text(p.cx, p.y - 10, 'MANTO ETÉREO', '#9fd0e0'); Sound.cast(); } },
    { id: 'haste', name: 'Celeridade', icon: '⚡', tradition: 'arcane', tier: 5, cost: 26, cd: 0.7,
      desc: 'Acelera corpo e mente: movimento mais rápido e disparos em cadência turbinada.',
      cast(p, game) { p.hasteT = 8; game.fx.magic(p.cx, p.cy, '#6fd0ff', 14); game.fx.text(p.cx, p.y - 10, 'CELERIDADE', '#6fd0ff'); Sound.cast(); } },
    { id: 'missiles', name: 'Mísseis Arcanos', icon: '✨', tradition: 'arcane', tier: 6, cost: 30, cd: 0.5,
      desc: 'Dispara 5 mísseis mágicos TELEGUIADOS que perseguem os inimigos por conta própria.',
      cast(p, game) {
        const m = p.muzzlePos();
        for (let i = 0; i < 5; i++) _allyBolt(game, m.x, m.y, p.aimAng + rand(-1.0, 1.0), 520, { kind: 'note', color: '#ff7be0', dmg: 18, tileDmg: 6, r: 3, life: 2.2, knock: 60, homing: true });
        game.fx.muzzle(m.x, m.y, p.aimAng); Sound.cast();
      } },
  ],
};

/* ============================================================
   LIVRO 2 — ⚔ CÓDICE DE GUERRA DE RAGNAROK (técnicas marciais)
   Afetam tanto o ESPECIAL (X) quanto o GOLPE CURTO (C, via "posturas"
   que trocam a arma branca: martelo, punhos em chama, lâmina demoníaca…).
   Recurso: FÚRIA (a barra azul) — Ragnarok também a acumula ao golpear.
   ============================================================ */
const RAGNAROK_BOOK = {
  hero: 'ragnarok', resource: 'FÚRIA', title: '⚔ CÓDICE DE GUERRA ⚔', subtitle: 'Os Caminhos do Guerreiro',
  traditions: [
    { key: 'barbarian', name: 'BÁRBARO',  icon: '🪓', color: '#d34a3a' },
    { key: 'war',       name: 'GUERRA',   icon: '🔨', color: '#caa33a' },
    { key: 'elemental', name: 'FÚRIA',    icon: '🔥', color: '#ff8a3c' },
    { key: 'paladin',   name: 'PALADINO', icon: '✝', color: '#ffe9a8' },
    { key: 'blade',     name: 'LÂMINA',   icon: '⚔', color: '#cfd8e6' },
  ],
  spells: [
    /* BÁRBARO — fúria crua, sangue e investidas */
    { id: 'fury', name: 'Fúria Primitiva', icon: '😡', tradition: 'barbarian', tier: 1, cost: 35, cd: 0.8,
      desc: 'Entra em FRENESI: +dano corpo-a-corpo, +velocidade e ROUBO DE VIDA por alguns segundos.',
      cast(p, game) { p.berserkT = 8; p.lifestealT = 8; game.fx.magic(p.cx, p.cy, '#d34a3a', 26); for (let i = 0; i < 10; i++) game.fx.fire(p.cx + rand(-12, 12), p.cy + rand(-16, 16), 1); game.fx.text(p.cx, p.y - 12, 'FÚRIA PRIMITIVA!', '#d34a3a'); game.cam.addShake(5); game.flashScreen(0.15); Sound.thump(); } },
    { id: 'barbarian', name: 'Ataque Bárbaro', icon: '🪓', tradition: 'barbarian', tier: 2, cost: 24, cd: 0.5,
      desc: 'Talho selvagem à frente: dano alto, grande empurrão e SANGRAMENTO nos atingidos.',
      cast(p, game) {
        const bz = p.berserkT > 0 ? 1.4 : 1;
        game.meleeArc(p, { range: 80, arc: 1.3, dmg: 48 * bz, tileDmg: 40, knock: 380, color: 'rgba(211,74,58,0.95)', shake: 6 });
        for (const e of game.enemiesInRadius(p.cx + p.face * 44, p.cy, 80)) { e.envenom(3, 5); game.fx.blood(e.cx, e.cy, p.face, 6); }
        game.fx.slash(p.cx + p.face * 44, p.cy, p.face > 0 ? 0 : Math.PI, 74, 'rgba(211,74,58,0.95)'); game.cam.addShake(5); Sound.slash();
      } },
    { id: 'warcry', name: 'Brado de Guerra', icon: '📢', tradition: 'barbarian', tier: 3, cost: 30, cd: 0.9,
      desc: 'Um rugido que ATORDOA e empurra todos ao redor (alguns fogem) e reacende sua fúria.',
      cast(p, game) {
        const R = 5 * CONFIG.TILE;
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) { e.stagger = Math.max(e.stagger, 0.8); e.vx += (sign(e.cx - p.cx) || 1) * 200; e.vy -= 60; if (!e.boss && Math.random() < 0.5) e.frighten(2.5); game.fx.spark(e.cx, e.cy, '#ffd86b', 4); }
        p.berserkT = Math.max(p.berserkT, 4);
        game.fx.shock(p.cx, p.cy, R, '#ffd86b'); game.fx.shock(p.cx, p.cy, R * 0.6, '#fff'); game.fx.text(p.cx, p.y - 12, 'BRADO DE GUERRA!', '#ffd86b'); game.cam.addShake(7); game.flashScreen(0.15); Sound.thump();
      } },
    { id: 'rampage', name: 'Carnificina', icon: '🌀', tradition: 'barbarian', tier: 4, cost: 32, cd: 0.7,
      desc: 'Rodopia com a lâmina golpeando TODOS à volta em sequência rápida.',
      cast(p, game) {
        const bz = p.berserkT > 0 ? 1.4 : 1;
        for (let i = 0; i < 2; i++) game.meleeRadial(p, { range: 64, dmg: 26 * bz, tileDmg: 20, knock: 220, color: 'rgba(211,74,58,0.95)', shake: 4 });
        game.fx.swirl(p.cx, p.cy - 4, 60, 'rgba(211,74,58,0.95)', p.face); game.fx.swirl(p.cx, p.cy - 4, 48, 'rgba(255,200,120,0.9)', -p.face); Sound.slash();
      } },
    { id: 'bloodlust', name: 'Sede de Sangue', icon: '🩸', tradition: 'barbarian', tier: 5, cost: 30, cd: 0.9,
      desc: 'Drena a vitalidade dos inimigos próximos para CURAR a si mesmo e ativa o roubo de vida.',
      cast(p, game) {
        let heal = 0;
        for (const e of game.enemiesInRadius(p.cx, p.cy, 4 * CONFIG.TILE)) { e.hurt(16, sign(e.cx - p.cx) || 1, game); heal += 10; game.fx.bolt(e.cx, e.cy, p.cx, p.cy, '#d34a3a'); game.fx.blood(e.cx, e.cy, sign(e.cx - p.cx) || 1, 4); }
        p.hp = clamp(p.hp + Math.min(heal, 60), 0, p.maxhp); p.lifestealT = 6;
        if (heal > 0) game.fx.heal(p.cx, p.cy, 10);
        game.fx.magic(p.cx, p.cy, '#d34a3a', 16); game.fx.text(p.cx, p.y - 12, heal > 0 ? '+' + Math.min(heal, 60) : 'SEDE DE SANGUE', heal > 0 ? '#7be08a' : '#d34a3a'); Sound.heal();
      } },

    /* GUERRA — martelos, cerco, pólvora */
    { id: 'warhammer', name: 'Martelo de Guerra', icon: '🔨', tradition: 'war', tier: 1, cost: 30, cd: 0.7,
      desc: 'Empunha um MARTELO (troca o golpe C): pancada com atordoamento e quebra de blocos, e já desfere um esmagamento.',
      cast(p, game) { _setStance(p, game, 'hammer', 12, 'MARTELO DE GUERRA', '#ffd86b'); _warSlam(p, game, { radius: 3.5 * CONFIG.TILE, dmg: 40, launch: 380, knock: 300 }); } },
    { id: 'groundslam', name: 'Tremor de Guerra', icon: '💥', tradition: 'war', tier: 2, cost: 36, cd: 0.9,
      desc: 'Esmaga o chão: DESTRÓI o solo numa área larga e lança os inimigos bem alto.',
      cast(p, game) { const bz = p.berserkT > 0 ? 1.3 : 1; _warSlam(p, game, { radius: 5 * CONFIG.TILE, dmg: 38 * bz, launch: 540, knock: 260, shake: 11 }); game.fx.text(p.cx, p.y - 12, 'TREMOR DE GUERRA!', '#caa33a'); } },
    { id: 'shockwave', name: 'Onda de Choque', icon: '🌊', tradition: 'war', tier: 3, cost: 24, cd: 0.5,
      desc: 'Projeta uma lâmina de força à frente que perfura e empurra fileiras de inimigos.',
      cast(p, game) { const m = p.muzzlePos(); game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 720, { faction: 'player', kind: 'slashwave', color: '#ffe9a8', dmg: 30, tileDmg: 24, r: 16, life: 0.7, pierce: 6, knock: 320 })); game.fx.muzzle(m.x, m.y, p.aimAng); game.cam.addShake(4); Sound.slash(); } },
    { id: 'throwhammer', name: 'Martelo Arremessado', icon: '🪃', tradition: 'war', tier: 4, cost: 28, cd: 0.7,
      desc: 'Arremessa um martelo giratório e pesado que explode no impacto.',
      cast(p, game) { const m = p.muzzlePos(); game.bullets.push(new Bullet(m.x, m.y, p.aimAng - 0.12, 640, { faction: 'player', kind: 'cannon', color: '#caa33a', dmg: 36, tileDmg: 34, r: 8, explosive: 64, life: 1.6, knock: 280, spin: 16, grav: 200 })); game.fx.muzzle(m.x, m.y, p.aimAng); game.cam.addShake(3); Sound.shot('shotgun'); } },
    { id: 'siege', name: 'Aríete', icon: '🐏', tradition: 'war', tier: 5, cost: 26, cd: 0.7,
      desc: 'Avança como um aríete blindado, ATRAVESSANDO paredes e inimigos pela frente.',
      cast(p, game) { p.dashT = 0.3; p.dashSpeedK = 3.2; p.dashRadius = 40; p.dashDmg = 30; p.invuln = Math.max(p.invuln, 0.4); p.vy = -80; game.fx.text(p.cx, p.y - 12, 'ARÍETE!', '#caa33a'); game.cam.addShake(4); Sound.thump(); } },
    { id: 'dynamite', name: 'Barris de Pólvora', icon: '🧨', tradition: 'war', tier: 6, cost: 30, cd: 0.7,
      desc: 'Lança 3 barris de pólvora em arco que explodem em reação — caos destrutivo.',
      cast(p, game) { const m = p.muzzlePos(); for (let i = -1; i <= 1; i++) game.bullets.push(new Bullet(m.x, m.y, p.aimAng - 0.2 + i * 0.18, 520, { faction: 'player', kind: 'grenade', color: '#b1322c', dmg: 24, tileDmg: 30, r: 5, explosive: 60, life: 1.6, knock: 220, grav: 680, spin: 12 })); game.fx.muzzle(m.x, m.y, p.aimAng); game.fx.text(p.cx, p.y - 12, 'PÓLVORA!', '#caa33a'); game.cam.addShake(3); Sound.shot('shotgun'); } },

    /* FÚRIA ELEMENTAL — fogo na carne e no aço */
    { id: 'flamefists', name: 'Punhos em Chama', icon: '👊', tradition: 'elemental', tier: 1, cost: 28, cd: 0.7,
      desc: 'Acende os PUNHOS (troca o golpe C): socos rápidos que INCENDEIAM, e libera um anel de fogo.',
      cast(p, game) {
        _setStance(p, game, 'fists', 12, 'PUNHOS EM CHAMA', '#ff8a3c');
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; game.fx.flame(p.cx, p.cy, a, 2 * CONFIG.TILE); }
        for (const e of game.enemiesInRadius(p.cx, p.cy, 2.5 * CONFIG.TILE)) { e.hurt(16, sign(e.cx - p.cx) || 1, game); e.ignite(3, 8); game.fx.fire(e.cx, e.cy, 3); }
        Sound.cast();
      } },
    { id: 'flamingblade', name: 'Lâmina Flamejante', icon: '🗡', tradition: 'elemental', tier: 2, cost: 26, cd: 0.7,
      desc: 'Ateia fogo à espada (troca o golpe C): cada talho QUEIMA os inimigos por um tempo.',
      cast(p, game) { _setStance(p, game, 'flamesword', 12, 'LÂMINA FLAMEJANTE', '#ff8a3c'); for (let i = 0; i < 6; i++) game.fx.fire(p.cx + p.face * 14, p.cy + rand(-10, 10), 1); } },
    { id: 'eruption', name: 'Erupção', icon: '🌋', tradition: 'elemental', tier: 3, cost: 38, cd: 1.0,
      desc: 'Faz brotar uma fileira de colunas de fogo à frente, lançando e queimando os inimigos.',
      cast(p, game) {
        const dir = p.face, T = CONFIG.TILE;
        for (let i = 1; i <= 5; i++) {
          const x = p.cx + dir * i * T * 1.1, y = p.cy;
          game.fx.flame(x, y - T, Math.PI * 1.5, 2 * T, ['#ffe27a', '#ff8a3c', '#ff5b2c']); game.fx.fire(x, y, 5); game.world.explode(x, y, 26, 16);
          for (const e of game.enemiesInRadius(x, y, T * 1.3)) { e.hurt(20, dir, game); e.ignite(3, 8); e.vy -= 240; }
        }
        game.fx.text(p.cx, p.y - 12, 'ERUPÇÃO!', '#ff8a3c'); game.cam.addShake(7); Sound.explode();
      } },
    { id: 'meteorstrike', name: 'Golpe Meteórico', icon: '☄', tradition: 'elemental', tier: 4, cost: 40, cd: 0.9,
      desc: 'Desaba como um meteoro: esmagamento flamejante que destrói o chão e incendeia tudo perto.',
      cast(p, game) { const bz = p.berserkT > 0 ? 1.3 : 1; _warSlam(p, game, { radius: 4 * CONFIG.TILE, dmg: 40 * bz, launch: 420, knock: 240, color: '#ff8a3c' }); for (const e of game.enemiesInRadius(p.cx, p.cy, 4 * CONFIG.TILE)) { e.ignite(3, 8); game.fx.fire(e.cx, e.cy, 3); } game.world.explode(p.cx, p.y + p.h, 50, 20); game.fx.text(p.cx, p.y - 12, 'GOLPE METEÓRICO!', '#ff8a3c'); } },
    { id: 'infernalroar', name: 'Rugido Infernal', icon: '🐉', tradition: 'elemental', tier: 5, cost: 34, cd: 0.7,
      desc: 'Cospe um cone de fogo à frente que carboniza e INCENDEIA os inimigos.',
      cast(p, game) {
        const dir = p.face, reach = 5 * CONFIG.TILE, half = 2.2 * CONFIG.TILE;
        for (const e of game.enemies) { if (!e.alive) continue; const fwd = (e.cx - p.cx) * dir, off = Math.abs(e.cy - p.cy); if (fwd > -24 && fwd < reach && off < half) { e.hurt(22, dir, game); e.ignite(4, 9); e.vx += dir * 120; game.fx.fire(e.cx, e.cy, 4); } }
        game.fx.flame(p.cx, p.cy, p.aimAng, reach, ['#ffe27a', '#ff8a3c', '#ff5b2c'], 0.42); game.fx.muzzle(p.cx + dir * 20, p.cy, p.aimAng); game.cam.addShake(4); Sound.shot('flame');
      } },

    /* PALADINO — luz sagrada, escudo e cura */
    { id: 'ironskin', name: 'Pele de Ferro', icon: '🛡', tradition: 'paladin', tier: 1, cost: 30, cd: 1.0,
      desc: 'Sela-se em aço sagrado: um ESCUDO grosso que absorve muito dano.',
      cast(p, game) { p.wardHp = Math.max(p.wardHp || 0, 120); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; game.fx.spark(p.cx + Math.cos(a) * 18, p.cy + Math.sin(a) * 18, '#ffe9a8', 3); } game.fx.magic(p.cx, p.cy, '#ffe9a8', 18); game.fx.text(p.cx, p.y - 12, 'PELE DE FERRO', '#ffe9a8'); Sound.thump(); } },
    { id: 'smite', name: 'Julgamento', icon: '⚡', tradition: 'paladin', tier: 2, cost: 34, cd: 0.8,
      desc: 'Um pilar de luz desce do céu sobre o inimigo mais próximo, com dano sagrado devastador.',
      cast(p, game) {
        const e = game.nearestEnemy(p.cx, p.cy, 520); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#ffe9a8'); return; }
        game.fx.beam(e.cx, e.cy - 7 * CONFIG.TILE, e.cx, e.cy, '#fff2b0', 16);
        for (let i = 0; i < 18; i++) game.fx.spark(e.cx + rand(-12, 12), e.cy + rand(-16, 8), '#fff2b0', 3);
        e.hurt(120, sign(e.cx - p.cx) || 1, game);
        for (const o of game.enemiesInRadius(e.cx, e.cy, 60)) if (o !== e) o.hurt(40, sign(o.cx - e.cx) || 1, game);
        game.cam.addShake(6); game.flashScreen(0.18); Sound.zap();
      } },
    { id: 'consecrate', name: 'Consagração', icon: '✨', tradition: 'paladin', tier: 3, cost: 32, cd: 0.9,
      desc: 'Santifica o solo: cura você e queima os inimigos ao redor com luz radiante.',
      cast(p, game) {
        const R = 4 * CONFIG.TILE; p.hp = clamp(p.hp + 30, 0, p.maxhp);
        game.fx.heal(p.cx, p.cy, 12);
        for (const e of game.enemiesInRadius(p.cx, p.cy, R)) { e.hurt(28, sign(e.cx - p.cx) || 1, game); if (!e.boss && Math.random() < 0.3) e.frighten(2); for (let i = 0; i < 3; i++) game.fx.spark(e.cx + rand(-10, 10), e.cy + rand(-14, 14), '#fff2b0', 2); }
        game.fx.shock(p.cx, p.cy, R, '#fff2b0'); game.fx.shock(p.cx, p.cy, R * 0.6, '#ffe9a8'); game.fx.text(p.cx, p.y - 12, 'CONSAGRAÇÃO', '#ffe9a8'); Sound.heal();
      } },
    { id: 'shieldbash', name: 'Investida de Escudo', icon: '🛡', tradition: 'paladin', tier: 4, cost: 24, cd: 0.6,
      desc: 'Arremete com o escudo, ATORDOANDO e empurrando os inimigos pela frente.',
      cast(p, game) { p.dashT = 0.22; p.dashSpeedK = 2.8; p.dashRadius = 36; p.dashDmg = 24; p.invuln = Math.max(p.invuln, 0.4); for (const e of game.enemiesInRadius(p.cx + p.face * 30, p.cy, 60)) { e.stagger = Math.max(e.stagger, 1.0); e.vx += p.face * 200; game.fx.spark(e.cx, e.cy, '#ffe9a8', 5); } game.fx.text(p.cx, p.y - 12, 'INVESTIDA!', '#ffe9a8'); Sound.thump(); } },
    { id: 'layhands', name: 'Imposição das Mãos', icon: '🙏', tradition: 'paladin', tier: 5, cost: 32, cd: 1.0,
      desc: 'Cura forte e instantânea, extinguindo o fogo e revigorando o corpo.',
      cast(p, game) { p.hp = clamp(p.hp + 60, 0, p.maxhp); game.fx.heal(p.cx, p.cy, 18); for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; game.fx.spark(p.cx + Math.cos(a) * 20, p.cy + Math.sin(a) * 20, '#fff2b0', 3); } game.fx.magic(p.cx, p.cy, '#ffe9a8', 16); game.fx.text(p.cx, p.y - 12, '+60', '#7be08a'); Sound.heal(); } },

    /* LÂMINA — a arte da espada (e a lâmina transcendental) */
    { id: 'transcendent', name: 'Espada Transcendental', icon: '🗡', tradition: 'blade', tier: 1, cost: 36, cd: 0.7,
      desc: 'Desperta a lâmina demoníaca: corta crescentes de energia à distância (troca o golpe C por talhos à distância).',
      cast(p, game) {
        _setStance(p, game, 'transcendent', 8, 'ESPADA TRANSCENDENTAL', '#9b6bff');
        const m = p.muzzlePos(), bz = p.berserkT > 0 ? 1.4 : 1;
        game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 820, { faction: 'player', kind: 'crescent', color: '#9b6bff', dmg: 44 * bz, tileDmg: 34, r: 15, life: 0.9, pierce: 8, knock: 200 }));
        game.fx.muzzle(m.x, m.y, p.aimAng); game.cam.addShake(4); Sound.slash();
      } },
    { id: 'whirlwind', name: 'Lâmina Giratória', icon: '🌪', tradition: 'blade', tier: 2, cost: 30, cd: 0.7,
      desc: 'Gira a espada cortando todos à volta em dois ciclos velozes.',
      cast(p, game) { const bz = p.berserkT > 0 ? 1.3 : 1; for (let i = 0; i < 2; i++) game.meleeRadial(p, { range: 64, dmg: 24 * bz, tileDmg: 18, knock: 180, color: 'rgba(207,216,230,0.95)', shake: 3 }); game.fx.swirl(p.cx, p.cy - 4, 60, 'rgba(207,216,230,0.95)', p.face); Sound.slash(); } },
    { id: 'bladebeam', name: 'Corte à Distância', icon: '🌙', tradition: 'blade', tier: 3, cost: 22, cd: 0.4,
      desc: 'Lança uma lâmina de vento veloz que fende inimigos à distância.',
      cast(p, game) { const m = p.muzzlePos(); game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 1000, { faction: 'player', kind: 'slashwave', color: '#cfd8e6', dmg: 26, tileDmg: 18, r: 13, life: 0.6, pierce: 4, knock: 140 })); game.fx.muzzle(m.x, m.y, p.aimAng); Sound.slash(); } },
    { id: 'riposte', name: 'Postura de Lâmina', icon: '🤺', tradition: 'blade', tier: 4, cost: 22, cd: 0.8,
      desc: 'Postura defensiva: fica brevemente INVULNERÁVEL e afia o próximo golpe (fúria).',
      cast(p, game) { p.invuln = Math.max(p.invuln, 1.2); p.berserkT = Math.max(p.berserkT, 3); game.fx.magic(p.cx, p.cy, '#cfd8e6', 16); game.fx.text(p.cx, p.y - 12, 'POSTURA DE LÂMINA', '#cfd8e6'); Sound.swap(); } },
    { id: 'execute', name: 'Decapitação', icon: '💀', tradition: 'blade', tier: 5, cost: 30, cd: 0.8,
      desc: 'Golpe executor no inimigo mais próximo: dano brutal e MORTE INSTANTÂNEA se ele estiver ferido.',
      cast(p, game) {
        const e = game.nearestEnemy(p.cx, p.cy, 130); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#cfd8e6'); return; }
        const lethal = !e.boss && e.hp <= e.maxhp * 0.35, dmg = lethal ? 9999 : 80;
        game.fx.slash(e.cx, e.cy, 0, 42, '#fff'); for (let i = 0; i < 14; i++) game.fx.spark(e.cx, e.cy, '#fff', 3); game.fx.blood(e.cx, e.cy, p.face, 10);
        e.hurt(dmg, sign(e.cx - p.cx) || 1, game);
        if (lethal) game.fx.text(e.cx, e.y - 10, 'DECAPITADO!', '#d34a3a');
        game.cam.addShake(5); Sound.slash();
      } },
  ],
};

/* ---- registro de livros + índices por livro ---- */
const SPELLBOOKS = {};
for (const book of [EDWARD_BOOK, RAGNAROK_BOOK]) {
  book.byId = {}; book.byTradition = {};
  for (const tr of book.traditions) book.byTradition[tr.key] = [];
  for (const sp of book.spells) { sp.color = sp.color || (book.traditions.find(t => t.key === sp.tradition) || {}).color || '#fff'; book.byId[sp.id] = sp; (book.byTradition[sp.tradition] || (book.byTradition[sp.tradition] = [])).push(sp); }
  book.order = book.spells.map(s => s.id);
  SPELLBOOKS[book.hero] = book;
}

/* ============================================================
   GRIMÓRIO — seletor in-game (a "árvore de habilidades"), ciente do herói
   ============================================================ */
const Grimoire = {
  activeByHero: {},
  _wasDown: false, _nodes: [], _hover: null,

  heroKey(p) { return p ? (p.morph ? p.morph.key : p.hero.key) : null; },
  heroHasBook(key) { return !!SPELLBOOKS[key]; },
  bookFor(p) { return SPELLBOOKS[this.heroKey(p)] || null; },
  ensureActive(book) { if (!book) return; const a = this.activeByHero[book.hero]; if (!a || !book.byId[a]) this.activeByHero[book.hero] = book.order[0]; },
  current(p) { const book = this.bookFor(p); if (!book) return null; this.ensureActive(book); return book.byId[this.activeByHero[book.hero]]; },

  tryCast(p, game) {
    const book = this.bookFor(p); if (!book) { p.specCool = 0.2; return; }
    this.ensureActive(book); const sp = book.byId[this.activeByHero[book.hero]]; if (!sp) { p.specCool = 0.2; return; }
    const cost = sp.cost || 0;
    if (!game.testMode && p.special < cost) { Sound.hurt(); game.fx.text(p.cx, p.y - 12, 'SEM ' + book.resource, '#6fd0ff'); p.specCool = 0.25; return; }
    sp.cast(p, game);
    if (!game.testMode) p.special = Math.max(0, p.special - cost);
    p.specCool = sp.cd || 0.4;
  },
  cycle(dir, p, game) {
    const book = this.bookFor(p); if (!book) return; this.ensureActive(book);
    let i = book.order.indexOf(this.activeByHero[book.hero]); i = (i + dir + book.order.length) % book.order.length;
    this.activeByHero[book.hero] = book.order[i]; const sp = book.byId[book.order[i]];
    if (game && p) game.fx.text(p.cx, p.y - 14, sp.icon + ' ' + sp.name, sp.color); Sound.swap();
  },
  setActive(book, id, game, p) { if (!book || !book.byId[id]) return; this.activeByHero[book.hero] = id; Sound.swap(); const sp = book.byId[id]; if (game && p) game.fx.text(p.cx, p.y - 14, sp.icon + ' ' + sp.name, sp.color); },

  tickInput(game) {
    const p = game.player, book = this.bookFor(p); if (!book) return;
    const m = Input.mouse, down = m.down, click = down && !this._wasDown; this._wasDown = down; this._hover = null;
    for (const n of this._nodes) if (m.x >= n.x && m.x <= n.x + n.w && m.y >= n.y && m.y <= n.y + n.h) { this._hover = n.id; if (click) this.setActive(book, n.id, game, p); }
  },

  draw(ctx, game) {
    const book = this.bookFor(game.player); if (!book) return; this.ensureActive(book);
    const W = CONFIG.W, H = CONFIG.H;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,12,0.9)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 30px "Trebuchet MS"';
    ctx.fillText(book.title, W / 2, 44);
    ctx.fillStyle = '#9a8f7d'; ctx.font = '13px "Trebuchet MS"';
    ctx.fillText(book.subtitle + ' — clique numa habilidade para prepará-la · X usa · [ ] trocam · G fecha', W / 2, 66);

    const cols = book.traditions.length, marginX = 30, colGap = 10;
    const colW = (W - marginX * 2 - colGap * (cols - 1)) / cols;
    const top = 86, headH = 40, nodeH = 50, nodeGap = 6;
    this._nodes = [];
    for (let ci = 0; ci < cols; ci++) {
      const tr = book.traditions[ci], x = marginX + ci * (colW + colGap);
      ctx.fillStyle = 'rgba(20,16,26,0.9)'; ctx.fillRect(x, top, colW, headH);
      ctx.strokeStyle = tr.color; ctx.lineWidth = 2; ctx.strokeRect(x + 1, top + 1, colW - 2, headH - 2);
      ctx.fillStyle = tr.color; ctx.font = 'bold 16px "Trebuchet MS"';
      ctx.fillText(tr.icon + ' ' + tr.name, x + colW / 2, top + 26);
      let y = top + headH + 8;
      for (const sp of book.byTradition[tr.key]) {
        const on = sp.id === this.activeByHero[book.hero], hov = sp.id === this._hover;
        ctx.fillStyle = on ? 'rgba(232,185,74,0.16)' : (hov ? 'rgba(255,255,255,0.10)' : 'rgba(16,12,20,0.92)');
        ctx.fillRect(x, y, colW, nodeH);
        ctx.lineWidth = on ? 2.5 : 1.4; ctx.strokeStyle = on ? '#ffe27a' : sp.color;
        ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, nodeH - 1);
        ctx.textAlign = 'left';
        ctx.font = '17px "Trebuchet MS"'; ctx.fillStyle = '#fff'; ctx.fillText(sp.icon, x + 7, y + 23);
        ctx.font = 'bold 12px "Trebuchet MS"'; ctx.fillStyle = on ? '#ffe27a' : '#e8e0cf'; ctx.fillText(sp.name, x + 30, y + 20);
        ctx.font = '10px "Trebuchet MS"'; ctx.fillStyle = '#7fb0d0'; ctx.fillText(book.resource.toLowerCase() + ' ' + sp.cost, x + 30, y + 37);
        ctx.textAlign = 'center';
        this._nodes.push({ id: sp.id, x, y, w: colW, h: nodeH });
        y += nodeH + nodeGap;
      }
    }
    const sel = book.byId[this._hover] || book.byId[this.activeByHero[book.hero]];
    const dy = H - 64;
    ctx.fillStyle = 'rgba(10,8,16,0.95)'; ctx.fillRect(marginX, dy, W - marginX * 2, 52);
    ctx.strokeStyle = sel.color; ctx.lineWidth = 2; ctx.strokeRect(marginX + 1, dy + 1, W - marginX * 2 - 2, 50);
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Trebuchet MS"'; ctx.fillStyle = sel.color; ctx.fillText(sel.icon + '  ' + sel.name, marginX + 14, dy + 22);
    ctx.font = '13px "Trebuchet MS"'; ctx.fillStyle = '#cfc6b4'; ctx.fillText(sel.desc, marginX + 14, dy + 42);
    const p = game.player;
    if (p) { ctx.textAlign = 'right'; ctx.fillStyle = '#6fd0ff'; ctx.font = 'bold 14px "Trebuchet MS"'; ctx.fillText(book.resource + ' ' + Math.ceil(p.special) + '/' + p.maxSpecial, W - marginX - 14, dy + 22); }
    ctx.restore(); ctx.textAlign = 'left';
  },
};

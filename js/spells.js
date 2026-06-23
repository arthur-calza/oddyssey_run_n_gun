/* ============================================================
   spells.js — A ARCANA DE EDWARD: tradições, feitiços e o Grimório
   -----------------------------------------------------------------
   Edward (o único mago da campanha) lança FEITIÇOS pelo botão ESPECIAL.
   Cada feitiço pertence a uma TRADIÇÃO (árvore de habilidade). O jogador
   escolhe o feitiço ativo no GRIMÓRIO (tecla G) e troca rápido com [ ].

   Por enquanto TODOS os feitiços estão LIBERADOS para teste. A ideia
   futura é o jogador liberar/evoluir tradições à sua escolha conforme
   avança a campanha — basta filtrar `Grimoire.unlockedList()` pelo save.

   Como ADICIONAR um feitiço: crie um objeto em SPELLS com
     { id, name, icon, tradition, tier, cost, cd, desc, cast(p, game) }
   e ele aparece sozinho no Grimório e no rodízio.
   Recursos disponíveis no `cast`: game.enemiesInRadius / game.nearestEnemy /
   game.summon / game.electricBurst / game.world / game.fx / game.bullets /
   e os status dos inimigos: e.freeze / e.sleep / e.ignite / e.slow / e.frighten.
   ============================================================ */

/* ---- TRADIÇÕES (as "escolas" / árvores de feitiçaria) ---- */
const TRADITIONS = [
  { key: 'elements', name: 'ELEMENTOS',    icon: '☄', color: '#ff8a3c', blurb: 'Fogo, gelo e tempestade — a fúria crua dos elementos.' },
  { key: 'transmut', name: 'TRANSMUTAÇÃO', icon: '⛰', color: '#caa33a', blurb: 'Moldar a matéria: erguer pedra, abrir a terra, fazer ouro.' },
  { key: 'conjure',  name: 'INVOCAÇÃO',    icon: '☠', color: '#7be08a', blurb: 'Chamar servos do além para lutar ao seu lado.' },
  { key: 'mind',     name: 'MENTE',        icon: '✷', color: '#b07bff', blurb: 'Dobrar a vontade alheia: sono, pavor e implosão mental.' },
  { key: 'arcane',   name: 'ARCANA',       icon: '✦', color: '#6fd0ff', blurb: 'Magia pura e mobilidade: voo, teleporte e invisibilidade.' },
];

/* ---- helpers de conjuração ---- */
function _allyBolt(game, x, y, ang, speed, opts) {
  game.bullets.push(new Bullet(x, y, ang, speed, Object.assign({ faction: 'player' }, opts)));
}
// ergue uma parede vertical de cristal à frente do mago
function _conjureWall(p, game) {
  const T = game.world.T, dir = p.face;
  const c0 = Math.floor((p.cx + dir * T * 1.1) / T), rFeet = Math.floor((p.y + p.h - 1) / T);
  for (let col = 0; col < 2; col++) {
    const c = c0 + col * dir;
    for (let r = rFeet; r > rFeet - 4; r--) if (!game.world.solid(c, r)) { game.world.set(c, r, 37); game.fx.spark(c * T + T / 2, r * T + T / 2, '#bff0ff', 4); }
  }
  game.fx.magic(p.cx + dir * T * 1.5, p.cy, '#bff0ff', 16); game.cam.addShake(3); Sound.cast();
}
// estende uma ponte/plataforma horizontal de cristal à frente, na linha dos pés
function _conjureBridge(p, game) {
  const T = game.world.T, dir = p.face;
  const rFeet = Math.floor((p.y + p.h + 2) / T), c0 = Math.floor(p.cx / T);
  for (let i = 1; i <= 7; i++) { const c = c0 + dir * i; if (!game.world.solid(c, rFeet)) { game.world.set(c, rFeet, 37); game.fx.spark(c * T + T / 2, rFeet * T + T / 2, '#bff0ff', 3); } }
  Sound.cast();
}

/* ============================================================
   O ARSENAL DE FEITIÇOS  (≥ 20 — distribuídos em 5 tradições)
   ============================================================ */
const SPELLS = [
  /* ---------------- ELEMENTOS ---------------- */
  {
    id: 'firenova', name: 'Chama Voraz', icon: '🔥', tradition: 'elements', tier: 1, cost: 30, cd: 0.7,
    desc: 'Explosão de fogo ao seu redor: dano em área e QUEIMADURA contínua nos inimigos próximos.',
    cast(p, game) {
      const R = 4 * CONFIG.TILE;
      for (const e of game.enemiesInRadius(p.cx, p.cy, R)) {
        const d = Math.hypot(e.cx - p.cx, e.cy - p.cy), kd = sign(e.cx - p.cx) || 1;
        e.hurt(Math.round(42 * (1 - d / (R * 1.3))), kd, game); e.ignite(3, 8); e.vx += kd * 190; e.vy -= 130;
      }
      game.fx.explosion(p.cx, p.cy, R * 0.5);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; game.fx.flame(p.cx, p.cy, a, R * 0.85); }
      game.cam.addShake(7); game.flashScreen(0.2); Sound.explode();
    },
  },
  {
    id: 'frostwave', name: 'Sopro Glacial', icon: '❄', tradition: 'elements', tier: 2, cost: 28, cd: 0.8,
    desc: 'Onda de gelo à frente que CONGELA os inimigos atingidos por alguns segundos (presa fácil).',
    cast(p, game) {
      const reach = 5 * CONFIG.TILE, dir = p.face, half = 2.2 * CONFIG.TILE;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const fwd = (e.cx - p.cx) * dir, off = Math.abs(e.cy - p.cy);
        if (fwd > -24 && fwd < reach && off < half) { e.hurt(14, dir, game); e.freeze(3.5); }   // dano ANTES de congelar (senão o golpe estilhaça o próprio gelo)
      }
      for (let i = 0; i < 16; i++) { const d = rand(20, reach); game.fx.spark(p.cx + dir * d, p.cy + rand(-half, half), '#bfe8ff', 2); }
      game.fx.muzzle(p.cx + dir * 20, p.cy, dir > 0 ? 0 : Math.PI); game.cam.addShake(3); Sound.cast();
    },
  },
  {
    id: 'chainlight', name: 'Tempestade de Raios', icon: '⚡', tradition: 'elements', tier: 3, cost: 34, cd: 0.7,
    desc: 'Um raio elétrico que SALTA de inimigo em inimigo, encadeando até 6 alvos próximos.',
    cast(p, game) {
      let from = { x: p.cx, y: p.cy }; const hit = new Set();
      for (let i = 0; i < 6; i++) {
        let best = null, bd = 230;
        for (const e of game.enemies) { if (!e.alive || hit.has(e)) continue; const d = Math.hypot(e.cx - from.x, e.cy - from.y); if (d < bd) { bd = d; best = e; } }
        if (!best) break; hit.add(best);
        game.fx.bolt(from.x, from.y, best.cx, best.cy, '#bff0ff'); game.fx.spark(best.cx, best.cy, '#bff0ff', 8);
        best.hurt(28, sign(best.cx - from.x) || 1, game); best.vy -= 60;
        from = { x: best.cx, y: best.cy };
      }
      game.cam.addShake(4); Sound.zap();
    },
  },
  {
    id: 'icespikes', name: 'Estilhaços de Gelo', icon: '🧊', tradition: 'elements', tier: 4, cost: 22, cd: 0.45,
    desc: 'Leque de 3 lanças de gelo perfurantes que CONGELAM brevemente quem atravessam.',
    cast(p, game) {
      const m = p.muzzlePos(), base = p.aimAng;
      for (let i = -1; i <= 1; i++) _allyBolt(game, m.x, m.y, base + i * 0.12, 1000, { kind: 'ice', color: '#bfe8ff', dmg: 16, tileDmg: 10, r: 3.4, pierce: 2, life: 1.0, knock: 90, freezeT: 1.8 });
      game.fx.muzzle(m.x, m.y, base); Sound.cast();
    },
  },
  {
    id: 'meteor', name: 'Meteoro', icon: '☄', tradition: 'elements', tier: 5, cost: 45, cd: 1.0,
    desc: 'Invoca um meteoro flamejante que despenca à sua frente e explode (destrói o cenário).',
    cast(p, game) {
      const dir = p.face, tx = p.cx + dir * 5 * CONFIG.TILE, ty = p.cy - 7.5 * CONFIG.TILE;
      game.bullets.push(new Bullet(tx, ty, Math.PI / 2, 760, { faction: 'player', kind: 'fireball', color: '#ff7a2c', dmg: 48, tileDmg: 44, r: 9, explosive: 92, life: 2.0, knock: 240, grav: 220 }));
      game.fx.text(p.cx, p.y - 12, 'METEORO!', '#ff8a3c'); Sound.cast();
    },
  },
  {
    id: 'stormfield', name: 'Campo da Constituição', icon: '🌩', tradition: 'elements', tier: 6, cost: 40, cd: 0.8,
    desc: 'O clássico campo elétrico radial de 6 tiles: atinge tudo ao redor (não destrói blocos).',
    cast(p, game) { game.electricBurst(p, { radius: 6 * CONFIG.TILE, dmg: 50, knock: 200 }); },
  },

  /* ---------------- TRANSMUTAÇÃO ---------------- */
  {
    id: 'wall', name: 'Erguer Muralha', icon: '🧱', tradition: 'transmut', tier: 1, cost: 18, cd: 0.6,
    desc: 'Conjura uma parede de cristal à sua frente — bloqueia inimigos e tiros (destrutível).',
    cast(p, game) { _conjureWall(p, game); game.fx.text(p.cx, p.y - 10, 'MURALHA!', '#bff0ff'); },
  },
  {
    id: 'bridge', name: 'Ponte Arcana', icon: '🌉', tradition: 'transmut', tier: 2, cost: 16, cd: 0.5,
    desc: 'Estende uma ponte de cristal à frente, na linha dos pés — atravesse abismos.',
    cast(p, game) { _conjureBridge(p, game); game.fx.text(p.cx, p.y - 10, 'PONTE ARCANA', '#bff0ff'); },
  },
  {
    id: 'quake', name: 'Terratremor', icon: '⛰', tradition: 'transmut', tier: 3, cost: 38, cd: 1.1,
    desc: 'Sacode a terra: desmorona o solo macio e ARREMESSA + atordoa os inimigos no chão.',
    cast(p, game) {
      const T = game.world.T, c0 = Math.floor(p.cx / T), span = 8;
      game.world._caveIn(c0 - span, c0 + span, Math.floor(p.cy / T) - 1, Math.floor((p.y + p.h) / T) + 3);
      for (const e of game.enemies) { if (!e.alive) continue; if (Math.abs(e.cx - p.cx) < span * T && e.onGround) { e.hurt(20, sign(e.cx - p.cx) || 1, game); e.vy = -380; e.stagger = Math.max(e.stagger, 0.6); } }
      for (let i = 0; i < span * 2; i++) game.fx.smoke(p.cx + rand(-span * T, span * T), p.y + p.h, 2, 'rgba(120,100,80,');
      game.cam.addShake(11); game.flashScreen(0.14); Sound.thump();
    },
  },
  {
    id: 'stoneskin', name: 'Pele de Pedra', icon: '🛡', tradition: 'transmut', tier: 4, cost: 30, cd: 1.0,
    desc: 'Reveste-se de pedra: um ESCUDO que absorve dano antes de tocar sua vida.',
    cast(p, game) { p.wardHp = Math.max(p.wardHp || 0, 90); game.fx.magic(p.cx, p.cy, '#caa33a', 18); game.fx.text(p.cx, p.y - 10, 'PELE DE PEDRA', '#caa33a'); Sound.thump(); },
  },
  {
    id: 'midas', name: 'Toque de Midas', icon: '💰', tradition: 'transmut', tier: 5, cost: 32, cd: 0.8,
    desc: 'Transmuta o inimigo mais próximo em OURO: ele perece e despeja uma chuva de orégano.',
    cast(p, game) {
      const e = game.nearestEnemy(p.cx, p.cy, 420); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#caa33a'); return; }
      if (e.boss) { e.hurt(60, 1, game); game.fx.text(e.cx, e.y - 8, 'GRANDE DEMAIS', '#caa33a'); return; }
      for (let i = 0; i < 20; i++) game.fx.spark(e.cx, e.cy, '#ffe27a', 6);
      game.spawnOregano(e.cx, e.cy, 10); e.hurt(9999, sign(e.cx - p.cx) || 1, game);
      game.fx.text(e.cx, e.cy - 10, 'OURO!', '#ffe27a'); Sound.coin();
    },
  },

  /* ---------------- INVOCAÇÃO ---------------- */
  {
    id: 'golem', name: 'Invocar Golem', icon: '🗿', tradition: 'conjure', tier: 1, cost: 45, cd: 0.8,
    desc: 'Ergue um GOLEM de pedra robusto que persegue e esmaga os inimigos a socos.',
    cast(p, game) { game.summon('golem', p.cx + p.face * 40, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'GOLEM!', '#7be08a'); game.cam.addShake(5); Sound.thump(); },
  },
  {
    id: 'wolves', name: 'Matilha Espectral', icon: '🐺', tradition: 'conjure', tier: 2, cost: 38, cd: 0.8,
    desc: 'Conjura 3 lobos espectrais velozes que caçam os inimigos em matilha.',
    cast(p, game) { for (let i = 0; i < 3; i++) game.summon('wolf', p.cx + p.face * (30 + i * 22) + rand(-10, 10), p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'MATILHA!', '#bff0ff'); Sound.cast(); },
  },
  {
    id: 'skeleton', name: 'Erguer Esqueleto', icon: '💀', tradition: 'conjure', tier: 3, cost: 30, cd: 0.7,
    desc: 'Reanima um esqueleto ARQUEIRO aliado que dispara flechas nos inimigos à distância.',
    cast(p, game) { game.summon('skeleton', p.cx + p.face * 36, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'SERVO ERGUIDO', '#cfe8a0'); Sound.cast(); },
  },
  {
    id: 'totem', name: 'Totem Vital', icon: '🔆', tradition: 'conjure', tier: 4, cost: 35, cd: 0.9,
    desc: 'Finca um totem fixo que pulsa CURA em você (e fere inimigos encostados).',
    cast(p, game) { game.summon('totem', p.cx, p.y + p.h, {}); game.fx.text(p.cx, p.y - 10, 'TOTEM VITAL', '#7be08a'); Sound.heal(); },
  },
  {
    id: 'dominate', name: 'Dominação', icon: '🧠', tradition: 'conjure', tier: 5, cost: 48, cd: 1.0,
    desc: 'Subjuga a mente do inimigo mais próximo: ele vira um SERVO aliado e luta por você.',
    cast(p, game) {
      const e = game.nearestEnemy(p.cx, p.cy, 480); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#7be08a'); return; }
      if (e.boss) { e.hurt(60, 1, game); game.fx.text(e.cx, e.y - 8, 'IMUNE', '#7be08a'); return; }
      const opts = { spr: e.spr, hp: Math.min(e.maxhp, 160), w: e.w, h: e.h, speed: e.def.speed * 1.1, dmg: 18, ranged: e.def.range > 0 };
      e.alive = false; game.fx.magic(e.cx, e.cy, '#7be08a', 22);
      game.summon('thrall', e.cx, e.y + e.h, opts);
      game.fx.text(e.cx, e.y - 10, 'DOMINADO!', '#7be08a'); Sound.cast();
    },
  },

  /* ---------------- MENTE ---------------- */
  {
    id: 'sleep', name: 'Canção do Sono', icon: '😴', tradition: 'mind', tier: 1, cost: 28, cd: 0.8,
    desc: 'Adormece os inimigos ao redor — ficam imóveis até levarem dano (despertam furiosos).',
    cast(p, game) {
      const R = 5 * CONFIG.TILE;
      for (const e of game.enemiesInRadius(p.cx, p.cy, R)) if (!e.boss) e.sleep(6);
      game.fx.shock(p.cx, p.cy, R, '#b07bff');
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; game.fx.spark(p.cx + Math.cos(a) * R * 0.6, p.cy + Math.sin(a) * R * 0.6, '#b07bff', 2); }
      game.fx.text(p.cx, p.y - 10, 'DURMAM…', '#b07bff'); Sound.cast();
    },
  },
  {
    id: 'fear', name: 'Pavor', icon: '😱', tradition: 'mind', tier: 2, cost: 26, cd: 0.8,
    desc: 'Incute terror: os inimigos ao redor largam tudo e FOGEM apavorados por alguns segundos.',
    cast(p, game) {
      const R = 5 * CONFIG.TILE;
      for (const e of game.enemiesInRadius(p.cx, p.cy, R)) if (!e.boss) e.frighten(4);
      game.fx.shock(p.cx, p.cy, R, '#b07bff'); game.fx.text(p.cx, p.y - 10, 'PAVOR!', '#b07bff'); Sound.zap();
    },
  },
  {
    id: 'slow', name: 'Distorção Temporal', icon: '⏳', tradition: 'mind', tier: 3, cost: 28, cd: 0.8,
    desc: 'Dobra o tempo numa área: inimigos se movem e atacam em câmera lenta.',
    cast(p, game) {
      const R = 5 * CONFIG.TILE;
      for (const e of game.enemiesInRadius(p.cx, p.cy, R)) e.slow(5, 0.35);
      game.fx.shock(p.cx, p.cy, R, '#9b7bff'); game.fx.text(p.cx, p.y - 10, 'DISTORÇÃO', '#b07bff'); Sound.cast();
    },
  },
  {
    id: 'implode', name: 'Implosão Mental', icon: '🫨', tradition: 'mind', tier: 4, cost: 40, cd: 0.9,
    desc: 'A mente do inimigo mais próximo IMPLODE — dano massivo nele e estilhaço psíquico nos vizinhos.',
    cast(p, game) {
      const e = game.nearestEnemy(p.cx, p.cy, 520); if (!e) { game.fx.text(p.cx, p.y - 10, 'SEM ALVO', '#b07bff'); return; }
      for (let i = 0; i < 24; i++) { const a = rand(0, TAU), d = rand(28, 80); game.fx.spark(e.cx + Math.cos(a) * d, e.cy + Math.sin(a) * d, '#c479ff', 1); }
      game.fx.shock(e.cx, e.cy, 72, '#b07bff'); e.hurt(180, sign(e.cx - p.cx) || 1, game);
      for (const o of game.enemiesInRadius(e.cx, e.cy, 72)) if (o !== e) { const kd = sign(o.cx - e.cx) || 1; o.hurt(40, kd, game); o.vx += kd * 160; }
      game.cam.addShake(6); game.flashScreen(0.12); Sound.cast();
    },
  },
  {
    id: 'psyblast', name: 'Grito Psíquico', icon: '🌀', tradition: 'mind', tier: 5, cost: 34, cd: 0.7,
    desc: 'Detona uma onda psíquica radial: dano, forte EMPURRÃO e atordoamento ao redor.',
    cast(p, game) {
      const R = 4 * CONFIG.TILE;
      for (const e of game.enemiesInRadius(p.cx, p.cy, R)) { const kd = sign(e.cx - p.cx) || 1; e.hurt(28, kd, game); e.vx += kd * 300; e.vy -= 160; e.stagger = Math.max(e.stagger, 0.4); }
      game.fx.shock(p.cx, p.cy, R, '#b07bff'); game.fx.shock(p.cx, p.cy, R * 0.6, '#d8b0ff');
      game.cam.addShake(6); game.flashScreen(0.12); Sound.zap();
    },
  },

  /* ---------------- ARCANA & MOBILIDADE ---------------- */
  {
    id: 'fly', name: 'Voo', icon: '🕊', tradition: 'arcane', tier: 1, cost: 30, cd: 0.6,
    desc: 'Levita livremente por alguns segundos — suba e desça com ▲ / ▼.',
    cast(p, game) { p.flyT = 8; p.vy = -200; game.fx.magic(p.cx, p.cy, '#6fd0ff', 16); game.fx.text(p.cx, p.y - 10, 'VOO!', '#6fd0ff'); Sound.cast(); },
  },
  {
    id: 'blink', name: 'Piscar', icon: '💫', tradition: 'arcane', tier: 2, cost: 16, cd: 0.4,
    desc: 'Teletransporta-se vários tiles à frente — atravessa obstáculos curtos num piscar.',
    cast(p, game) {
      const dir = p.face, T = CONFIG.TILE; let nx = p.x;
      for (let s = 5; s >= 1; s--) { const tx = p.x + dir * s * T; if (!game.world.solidPx(tx + p.w / 2, p.cy) && !game.world.solidPx(tx + p.w / 2, p.y + 4)) { nx = tx; break; } }
      game.fx.magic(p.cx, p.cy, '#bff0ff', 14); p.x = clamp(nx, 0, game.world.pixelW - p.w); p.vx = dir * 120; p.invuln = Math.max(p.invuln, 0.2);
      game.fx.magic(p.cx, p.cy, '#bff0ff', 14); Sound.zap();
    },
  },
  {
    id: 'phase', name: 'Forma Etérea', icon: '👻', tradition: 'arcane', tier: 3, cost: 34, cd: 0.8,
    desc: 'Torna-se etéreo: ATRAVESSA paredes e projéteis por alguns segundos.',
    cast(p, game) { p.phaseT = 5; p.invuln = Math.max(p.invuln, 0.2); game.fx.magic(p.cx, p.cy, '#6fd0ff', 16); game.fx.text(p.cx, p.y - 10, 'FORMA ETÉREA', '#6fd0ff'); Sound.cast(); },
  },
  {
    id: 'invis', name: 'Manto Etéreo', icon: '🌫', tradition: 'arcane', tier: 4, cost: 32, cd: 0.8,
    desc: 'Some da vista: os inimigos não o enxergam até você atacar de perto.',
    cast(p, game) { p.invisT = 8; game.fx.magic(p.cx, p.cy, '#9fd0e0', 16); game.fx.text(p.cx, p.y - 10, 'MANTO ETÉREO', '#9fd0e0'); Sound.cast(); },
  },
  {
    id: 'haste', name: 'Celeridade', icon: '⚡', tradition: 'arcane', tier: 5, cost: 26, cd: 0.7,
    desc: 'Acelera corpo e mente: movimento mais rápido e disparos em cadência turbinada.',
    cast(p, game) { p.hasteT = 8; game.fx.magic(p.cx, p.cy, '#6fd0ff', 14); game.fx.text(p.cx, p.y - 10, 'CELERIDADE', '#6fd0ff'); Sound.cast(); },
  },
  {
    id: 'missiles', name: 'Mísseis Arcanos', icon: '✨', tradition: 'arcane', tier: 6, cost: 30, cd: 0.5,
    desc: 'Dispara 5 mísseis mágicos TELEGUIADOS que perseguem os inimigos por conta própria.',
    cast(p, game) {
      const m = p.muzzlePos();
      for (let i = 0; i < 5; i++) _allyBolt(game, m.x, m.y, p.aimAng + rand(-1.0, 1.0), 520, { kind: 'note', color: '#ff7be0', dmg: 18, tileDmg: 6, r: 3, life: 2.2, knock: 60, homing: true });
      game.fx.muzzle(m.x, m.y, p.aimAng); Sound.cast();
    },
  },
];

/* índices úteis */
const SPELLS_BY_ID = {}; for (const s of SPELLS) { s.color = s.color || (TRADITIONS.find(t => t.key === s.tradition) || {}).color || '#fff'; SPELLS_BY_ID[s.id] = s; }
const SPELL_ORDER = SPELLS.map(s => s.id);
const SPELLS_BY_TRADITION = {}; for (const t of TRADITIONS) SPELLS_BY_TRADITION[t.key] = SPELLS.filter(s => s.tradition === t.key);

/* ============================================================
   GRIMÓRIO — seletor in-game dos feitiços (a "árvore de habilidades")
   Tudo liberado para teste. Tecla G abre/fecha; clique escolhe o feitiço
   ativo; [ ] trocam rápido sem abrir; X (especial) conjura o ativo.
   ============================================================ */
const Grimoire = {
  active: null,
  _wasDown: false,
  _nodes: [],
  _hover: null,

  ensureActive() { if (!this.active || !SPELLS_BY_ID[this.active]) this.active = SPELL_ORDER[0]; },
  // FUTURO: filtrar por tradições liberadas no save. Hoje: todos liberados.
  unlockedList() { return SPELL_ORDER.slice(); },
  current() { this.ensureActive(); return SPELLS_BY_ID[this.active]; },

  tryCast(p, game) {
    const sp = this.current(); if (!sp) { p.specCool = 0.2; return; }
    const cost = sp.cost || 0;
    if (!game.testMode && p.special < cost) { Sound.hurt(); game.fx.text(p.cx, p.y - 12, 'SEM MANA', '#6fd0ff'); p.specCool = 0.25; return; }
    sp.cast(p, game);
    if (!game.testMode) p.special = Math.max(0, p.special - cost);
    p.specCool = sp.cd || 0.4;
  },
  cycle(dir, p, game) {
    const list = this.unlockedList(); this.ensureActive();
    let i = list.indexOf(this.active); i = (i + dir + list.length) % list.length; this.active = list[i];
    const sp = this.current(); if (game && p) game.fx.text(p.cx, p.y - 14, sp.icon + ' ' + sp.name, sp.color); Sound.swap();
  },
  setActive(id, game, p) {
    if (!SPELLS_BY_ID[id]) return; this.active = id; Sound.swap();
    const sp = SPELLS_BY_ID[id]; if (game && p) game.fx.text(p.cx, p.y - 14, sp.icon + ' ' + sp.name, sp.color);
  },

  // entrada do overlay (mouse): clica num nó para selecionar o feitiço ativo
  tickInput(game) {
    const m = Input.mouse, down = m.down, click = down && !this._wasDown; this._wasDown = down;
    this._hover = null;
    for (const n of this._nodes) if (m.x >= n.x && m.x <= n.x + n.w && m.y >= n.y && m.y <= n.y + n.h) { this._hover = n.id; if (click) this.setActive(n.id, game, game.player); }
  },

  // desenha o Grimório (espaço de tela; sem zoom de mundo)
  draw(ctx, game) {
    this.ensureActive();
    const W = CONFIG.W, H = CONFIG.H;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,12,0.9)'; ctx.fillRect(0, 0, W, H);
    // título
    ctx.textAlign = 'center'; ctx.fillStyle = '#e8b94a'; ctx.font = 'bold 30px "Trebuchet MS"';
    ctx.fillText('✦ GRIMÓRIO DE EDWARD ✦', W / 2, 44);
    ctx.fillStyle = '#9a8f7d'; ctx.font = '13px "Trebuchet MS"';
    ctx.fillText('Tradições da Feitiçaria — clique num feitiço para prepará-lo · X conjura · [ ] trocam · G fecha', W / 2, 66);

    const cols = TRADITIONS.length, marginX = 30, colGap = 10;
    const colW = (W - marginX * 2 - colGap * (cols - 1)) / cols;
    const top = 86, headH = 40, nodeH = 52, nodeGap = 7;
    this._nodes = [];
    for (let ci = 0; ci < cols; ci++) {
      const tr = TRADITIONS[ci], x = marginX + ci * (colW + colGap);
      // cabeçalho da tradição
      ctx.fillStyle = 'rgba(20,16,26,0.9)'; ctx.fillRect(x, top, colW, headH);
      ctx.strokeStyle = tr.color; ctx.lineWidth = 2; ctx.strokeRect(x + 1, top + 1, colW - 2, headH - 2);
      ctx.fillStyle = tr.color; ctx.font = 'bold 16px "Trebuchet MS"';
      ctx.fillText(tr.icon + ' ' + tr.name, x + colW / 2, top + 26);
      // feitiços
      const list = SPELLS_BY_TRADITION[tr.key];
      let y = top + headH + 10;
      for (const sp of list) {
        const on = sp.id === this.active, hov = sp.id === this._hover;
        ctx.fillStyle = on ? 'rgba(232,185,74,0.16)' : (hov ? 'rgba(255,255,255,0.10)' : 'rgba(16,12,20,0.92)');
        ctx.fillRect(x, y, colW, nodeH);
        ctx.lineWidth = on ? 2.5 : 1.4; ctx.strokeStyle = on ? '#ffe27a' : sp.color;
        ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, nodeH - 1);
        ctx.textAlign = 'left';
        ctx.font = '18px "Trebuchet MS"'; ctx.fillStyle = '#fff'; ctx.fillText(sp.icon, x + 8, y + 24);
        ctx.font = 'bold 13px "Trebuchet MS"'; ctx.fillStyle = on ? '#ffe27a' : '#e8e0cf'; ctx.fillText(sp.name, x + 32, y + 21);
        ctx.font = '11px "Trebuchet MS"'; ctx.fillStyle = '#7fb0d0'; ctx.fillText('mana ' + sp.cost, x + 32, y + 39);
        ctx.textAlign = 'center';
        this._nodes.push({ id: sp.id, x, y, w: colW, h: nodeH });
        y += nodeH + nodeGap;
      }
    }
    // painel de descrição (feitiço sob o mouse, ou o ativo)
    const sel = SPELLS_BY_ID[this._hover] || this.current();
    const dy = H - 64;
    ctx.fillStyle = 'rgba(10,8,16,0.95)'; ctx.fillRect(marginX, dy, W - marginX * 2, 52);
    ctx.strokeStyle = sel.color; ctx.lineWidth = 2; ctx.strokeRect(marginX + 1, dy + 1, W - marginX * 2 - 2, 50);
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Trebuchet MS"'; ctx.fillStyle = sel.color;
    ctx.fillText(sel.icon + '  ' + sel.name, marginX + 14, dy + 22);
    ctx.font = '13px "Trebuchet MS"'; ctx.fillStyle = '#cfc6b4';
    ctx.fillText(sel.desc, marginX + 14, dy + 42);
    // mana atual
    const p = game.player;
    if (p) { ctx.textAlign = 'right'; ctx.fillStyle = '#6fd0ff'; ctx.font = 'bold 14px "Trebuchet MS"'; ctx.fillText('MANA ' + Math.ceil(p.special) + '/' + p.maxSpecial, W - marginX - 14, dy + 22); }
    ctx.restore(); ctx.textAlign = 'left';
  },
};

/* ============================================================
   heroes.js — playable heroes + the WEAPON ARSENAL
     0 RAGNAROK — knight;   scatter shotgun  + Explosive Shell
     1 ZRACKS   — lizard;   piercing bolt    + Blade Dash
     2 NICOLAU  — alchemist; rapid pistol     + Master's Head (beam)
     3 SILVYR   — artificer; flamethrower     + Explosive Dash

   ----------------------------------------------------------------
   ARMAS (WEAPONS): registro central de armas UNIDIRECIONAIS (tiro
   sempre para a frente — sem mira de mouse). Cada arma define:
     name, icon, visual (sprite do braço), cool (cadência em s),
     clip, reload, gunLen e fire(p, game). Opcional: poweredFire
     (variante com a Poção Mágica). Para criar/ajustar uma arma,
     edite a entrada aqui — cada herói só referencia uma `weaponKey`.
   ============================================================ */

/* ===== LANÇA-CHAMAS — PERSONALIZE A ÁREA AQUI ===== */
const FLAME_TILES   = 3;     // alcance do jato à frente, em TILES (3 = pedido)
const FLAME_HALF_H  = 0.85;  // "meia-altura" do cone, em tiles (0.85 ≈ 1.7 tiles de altura)
const FLAME_COOL    = 0.045; // cadência do jato (s) — menor = jato mais denso
const FLAME_DMG     = 4;     // dano por tick de queima
/* ================================================== */

const WEAPONS = {
  // espingarda de dispersão — leque curto e forte de perto (Ragnarok)
  scatter: {
    name: 'Espingarda de Dispersão', icon: '🔫', visual: 'shotgun',
    cool: 0.34, clip: 6, reload: 0.9, gunLen: 26,
    desc: 'Leque de 6 chumbos. Devastadora de perto; recuo alto.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#ffe27a', speed: 820, dmg: 11, tileDmg: 13, r: 3, recoil: 120, shake: 3, life: 0.5, knock: 180, fan: 0.10 }, 0.05, 6);
      p.vy -= 40; p.consumeAmmo(); Sound.shot('shotgun');
    },
    poweredFire(p, game) {   // POÇÃO: chumbo explosivo
      p.cool = 0.4; p.coolMax = 0.4;
      p.shoot(game, { kind: 'pellet', color: '#ff8a3c', speed: 780, dmg: 14, tileDmg: 20, r: 4, recoil: 150, shake: 4, life: 0.55, knock: 200, explosive: 34, fan: 0.13 }, 0.06, 6);
      p.vy -= 50; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(2);
    },
  },

  // pistola de engenho — tiro reto, rápido, dano por tiro menor (Nicolau)
  repeater: {
    name: 'Pistola de Engenho', icon: '⚙', visual: 'pistol',
    cool: 0.12, clip: 14, reload: 0.8, gunLen: 20,
    desc: 'Tiro reto e veloz, cadência alta. Dano por tiro modesto.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#ffe9a8', speed: 1020, dmg: 9, tileDmg: 7, r: 2.6, recoil: 22, shake: 1, life: 0.7, knock: 90 });
      p.consumeAmmo(); Sound.shot('rifle');
    },
    poweredFire(p, game) {   // POÇÃO: bala perfurante incendiária
      p.cool = 0.1; p.coolMax = 0.1;
      p.shoot(game, { kind: 'slug', color: '#ff8a3c', speed: 1180, dmg: 13, tileDmg: 12, r: 2.8, recoil: 26, shake: 1.2, life: 0.8, knock: 120, pierce: 2 });
      p.consumeAmmo(); Sound.shot('rifle');
    },
  },

  // lança-chamas — jato contínuo em ÁREA de 3 tiles à frente (Silvyr)
  flamethrower: {
    name: 'Lança-Chamas', icon: '🔥', visual: 'flamethrower',
    cool: FLAME_COOL, clip: 120, reload: 1.3, gunLen: 24,
    desc: 'Segure ATIRAR: jato de fogo cobrindo 3 tiles à frente.',
    fire(p, game) { _flame(p, game, FLAME_TILES, FLAME_DMG, ['#ffe27a', '#ffd86b', '#ff8a3c', '#ff5b2c']); },
    poweredFire(p, game) {   // POÇÃO: chama AZUL mais quente, maior alcance e dano
      _flame(p, game, FLAME_TILES + 1, FLAME_DMG + 4, ['#bfe8ff', '#7fd8ff', '#5aa0ff', '#3a6aff']);
    },
  },

  // besta perfurante — virote rápido que atravessa inimigos (Zracks)
  bolt: {
    name: 'Besta Perfurante', icon: '➶', visual: 'bow',
    cool: 0.24, clip: 12, reload: 0.8, gunLen: 22,
    desc: 'Virote veloz que perfura uma fileira de inimigos.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'arrow', speed: 940, dmg: 18, tileDmg: 9, r: 3, recoil: 12, shake: 1.1, life: 1.2, pierce: 1 });
      p.consumeAmmo(); Sound.bow();
    },
    poweredFire(p, game) {   // POÇÃO: orbe de veneno (estilhaça)
      p.cool = 0.18; p.coolMax = 0.18;
      p.shoot(game, { kind: 'thorn', color: '#8ef06a', speed: 720, dmg: 16, tileDmg: 8, r: 5, recoil: 8, shake: 1, life: 1.3, pierce: 1, explosive: 26, poison: true });
      p.consumeAmmo(); Sound.cast();
    },
  },

  // roda-tiro anão — rajada frenética com leve dispersão, dano baixo
  smg: {
    name: 'Roda-Tiro Anão', icon: '🔩', visual: 'smg',
    cool: 0.07, clip: 30, reload: 1.1, gunLen: 20,
    desc: 'Metralha frenética com leve dispersão. Dano baixo por tiro.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#fff2b0', speed: 880, dmg: 6, tileDmg: 4, r: 2.4, recoil: 14, shake: 0.7, life: 0.6, knock: 60 }, 0.06);
      p.consumeAmmo(); Sound.shot('mg');
    },
  },

  // bacamarte de pólvora — bala explosiva, lenta e pesada
  cannon: {
    name: 'Bacamarte de Pólvora', icon: '💣', visual: 'cannon',
    cool: 0.85, clip: 4, reload: 1.2, gunLen: 24,
    desc: 'Bala explosiva lenta. Abre buracos e arremessa inimigos.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'cannon', color: '#ffb060', speed: 560, dmg: 30, tileDmg: 40, r: 6, recoil: 160, shake: 6, life: 2.0, explosive: 70, knock: 240, spin: 9 });
      p.vy -= 60; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(3);
    },
  },

  // bola de fogo arcana — esfera flamejante (SEM explosão), dano alto (Edward)
  fireball: {
    name: 'Bola de Fogo', icon: '☄', visual: 'staff',
    cool: 0.3, clip: 10, reload: 1.0, gunLen: 24,
    desc: 'Esfera flamejante mágica. Dano alto e sem explosão.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'fireball', color: '#ff7a2c', speed: 560, dmg: 22, tileDmg: 14, r: 5, recoil: 30, shake: 1.6, life: 1.4, knock: 140 });
      p.consumeAmmo(); Sound.cast();
    },
    poweredFire(p, game) {   // POÇÃO: bola maior, veloz e perfurante
      p.cool = 0.26; p.coolMax = 0.26;
      p.shoot(game, { kind: 'fireball', color: '#ff5b2c', speed: 680, dmg: 30, tileDmg: 18, r: 7, recoil: 36, shake: 2, life: 1.5, knock: 170, pierce: 1 });
      p.consumeAmmo(); Sound.cast();
    },
  },

  // arcabuz perfurante — pesadíssimo, atravessa fileiras inteiras
  arquebus: {
    name: 'Arcabuz Perfurante', icon: '🎯', visual: 'musket',
    cool: 0.55, clip: 5, reload: 1.0, gunLen: 28,
    desc: 'Bala traçante que perfura várias fileiras. Lenta, brutal.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'slug', color: '#bfe8ff', speed: 1320, dmg: 34, tileDmg: 24, r: 3.2, recoil: 90, shake: 3, life: 1.0, pierce: 4, knock: 140 });
      p.consumeAmmo(); Sound.shot('rifle'); game.cam.addShake(2);
    },
  },
};

// jato de chamas reutilizável: chamas (partículas) + DANO EM ÁREA no cone à
// frente + escavação dos tiles macios. `tiles` = alcance; `dmg` = dano/tick.
function _flame(p, game, tiles, dmg, colors) {
  p.cool = FLAME_COOL; p.coolMax = FLAME_COOL;
  const m = p.muzzlePos(), dir = p.face, T = CONFIG.TILE;
  const reach = tiles * T, halfH = FLAME_HALF_H * T;
  // chamas (visual)
  game.fx.flame(m.x, m.y, p.aimAng, reach, colors);
  game.fx.muzzle(m.x, m.y, p.aimAng);
  // dano em área no cone à frente (o "tick" de queima)
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const fwd = (e.cx - m.x) * dir;                 // distância à frente
    const off = Math.abs(e.cy - m.y);               // afastamento vertical
    if (fwd > -e.w * 0.5 && fwd < reach && off < halfH + e.h * 0.4) {
      e.hurt(dmg, dir, game);
      if (Math.random() < 0.25) game.fx.spark(e.cx, e.cy, '#ff8a3c', 2);
    }
  }
  // escava terreno macio ao longo do jato
  for (let d = T * 0.5; d < reach; d += T * 0.6) {
    game.world.damage(Math.floor((m.x + dir * d) / T), Math.floor(m.y / T), 5, { power: 20 });
  }
  p.consumeAmmo();
  game.alertEnemies(p.cx, p.cy, 380);
  if (Math.random() < 0.5) Sound.shot('flame');
}

// ordem das armas na FASE DE TESTES (teclas 1..N trocam de arma)
const WEAPON_ORDER = ['scatter', 'repeater', 'flamethrower', 'bolt', 'fireball', 'smg', 'cannon', 'arquebus'];

/* ===================== HERÓIS ============================= */
const HEROES = [
  {
    key: 'ragnarok', name: 'RAGNAROK', icon: '⚔', spr: 'ragnarok',
    desc: 'Cavaleiro de placas. Espingarda de dispersão e o Tiro Explosivo.',
    hp: 150, speed: 235, jumpV: 1400, jumps: 1, w: 28, h: 48,
    weaponKey: 'scatter',
    special: {
      cost: 45, cd: 0.5,
      use(p, game) {
        const m = p.muzzlePos();
        game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 640, { faction: 'player', kind: 'cannon', color: '#ff8a3c', dmg: 40, tileDmg: 52, r: 6, explosive: 96, life: 2.2, knock: 200 }));
        game.fx.muzzle(m.x, m.y, p.aimAng); p.vx -= Math.cos(p.aimAng) * 140;
        game.cam.addShake(7); game.fx.text(p.cx, p.y, 'TIRO EXPLOSIVO!', '#ff8a3c'); Sound.shot('shotgun');
      },
    },
  },
  {
    key: 'zracks', name: 'ZRACKS', icon: '➶', spr: 'zracks',
    desc: 'Lagarto caçador. Besta perfurante e a Investida com lâmina.',
    hp: 110, speed: 300, jumpV: 1400, jumps: 2, w: 28, h: 46,
    weaponKey: 'bolt',
    special: {
      cost: 45, cd: 0.5,
      use(p, game) {
        p.dashT = 0.26; p.swordMode = 0.32; p.invuln = Math.max(p.invuln, 0.3);
        p.vx = p.face * p.speed * 2.6;
        game.meleeArc(p, { range: 48, arc: 1.0, dmg: 34, tileDmg: 30, knock: 320, color: 'rgba(220,235,255,0.95)', shake: 5 });
        game.fx.text(p.cx, p.y, 'INVESTIDA!', '#9be0ff'); Sound.slash();
      },
    },
  },
  {
    key: 'nicolau', name: 'NICOLAU', icon: '⚗', spr: 'nicolau',
    desc: 'Vendedor de poções e tônicos. Pistola veloz e a Cabeça do Mestre.',
    hp: 120, speed: 268, jumpV: 1400, jumps: 2, w: 26, h: 46,
    weaponKey: 'repeater',
    special: {
      cost: 55, cd: 0.7,
      // reanima a cabeça do mestre: ela abre os olhos e dispara um raio destruidor à frente
      use(p, game) {
        game.beamAttack(p, { dmg: 58, tileDmg: 44, range: 540, width: 16, color: '#9be86a' });
        game.fx.text(p.cx, p.y, 'MESTRE, DESPERTE!', '#9be86a');
        p.vx -= p.face * 90; game.cam.addShake(8); Sound.zap();
      },
    },
  },
  {
    key: 'silvyr', name: 'SILVYR', icon: '⚙', spr: 'silvyr',
    desc: 'Elfo artífice de braço mecânico. Lança-chamas e o Arranque Explosivo.',
    hp: 130, speed: 250, jumpV: 1400, jumps: 2, w: 26, h: 46,
    weaponKey: 'flamethrower',
    special: {
      cost: 45, cd: 0.7,
      // arranque explosivo com o braço mecânico: avança deixando um rastro de
      // explosões e detona um grande estouro ao parar
      use(p, game) {
        p.dashT = 0.22; p.dashSpeedK = 3.0; p.dashRadius = 34; p.dashDmg = 24;
        p._explosiveDash = 0.22; p.invuln = Math.max(p.invuln, 0.5); p.vy = -140;
        game.fx.text(p.cx, p.y, 'ARRANQUE EXPLOSIVO!', '#ff8a3c');
        game.cam.addShake(4); Sound.thump();
      },
    },
  },
  {
    key: 'edward', name: 'EDWARD MAGNUS', icon: '✦', spr: 'edward',
    desc: 'Mago humano. Bola de fogo arcana e o Poder da Constituição (campo elétrico).',
    hp: 100, speed: 240, jumpV: 1350, jumps: 2, w: 26, h: 48,
    fallMult: 0.5, terminalVy: 540,   // queda BEM mais suave — sensação de levitar
    weaponKey: 'fireball',
    special: {
      cost: 55, cd: 0.8,
      // Poder da Constituição: campo elétrico de 6 tiles em TODAS as direções
      // (atinge inimigos ao redor, mas NÃO destrói blocos)
      use(p, game) {
        game.electricBurst(p, { radius: 6 * CONFIG.TILE, dmg: 50, knock: 200 });
        game.fx.text(p.cx, p.y, 'PODER DA CONSTITUIÇÃO!', '#7fd8ff');
        Sound.zap();
      },
    },
  },
];

const heroIndexByKey = k => HEROES.findIndex(h => h.key === k);

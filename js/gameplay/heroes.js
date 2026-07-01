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

/* ===== VEX (metamorfo) — PERSONALIZE AQUI ===== */
const VEX_MORPH_TIME   = 10;  // duração da transformação, em SEGUNDOS
const VEX_BASE_CHARGES = 3;   // quantas metamorfoses por fase (ganha +1 por vida extra)
const VEX_MORPH_HEAL   = 50;  // vida recuperada ao se transformar
/* ============================================== */

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

  // adagas arremessadas — giratórias, rápidas, perfuram 1 alvo (Vex)
  daggers: {
    name: 'Adagas Arremessadas', icon: '🗡', visual: 'dagger',
    cool: 0.17, clip: 16, reload: 0.7, gunLen: 16,
    desc: 'Adagas giratórias velozes. Alta cadência; perfuram 1 inimigo.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'dagger', color: '#cfd2d6', speed: 880, dmg: 12, tileDmg: 8, r: 3, recoil: 14, shake: 0.8, life: 0.9, knock: 80, pierce: 1, spin: 18 });
      p.consumeAmmo(); Sound.bow();
    },
    poweredFire(p, game) {   // POÇÃO: leque triplo envenenado
      p.cool = 0.2; p.coolMax = 0.2;
      p.shoot(game, { kind: 'dagger', color: '#b0ffd0', speed: 840, dmg: 13, tileDmg: 9, r: 3, recoil: 16, shake: 1, life: 0.95, knock: 90, pierce: 2, spin: 20 }, 0.04, 3);
      p.consumeAmmo(); Sound.bow();
    },
  },

  /* ===== ARMAS EXTRAS (criadas p/ a Fase de Testes) ===== */
  // granada de mão — bomba em arco que explode no impacto
  grenade: {
    name: 'Granada de Mão', icon: '💣', visual: 'cannon',
    cool: 0.7, clip: 5, reload: 1.2, gunLen: 18,
    desc: 'Bomba arremessada em arco; explode no impacto.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'grenade', color: '#3a3a2c', speed: 560, dmg: 26, tileDmg: 30, r: 5, recoil: 60, shake: 3, life: 2.2, explosive: 64, grav: 700, knock: 200, spin: 12 });
      p.consumeAmmo(); Sound.shot('shotgun');
    },
  },
  // lança de gelo — estilhaço perfurante e veloz
  icelance: {
    name: 'Lança de Gelo', icon: '❄', visual: 'staff',
    cool: 0.26, clip: 10, reload: 0.9, gunLen: 24,
    desc: 'Estilhaço de gelo perfurante e veloz (atravessa 3).',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'ice', color: '#bfe8ff', speed: 1000, dmg: 16, tileDmg: 12, r: 3.4, recoil: 20, shake: 1, life: 1.0, pierce: 3, knock: 90 });
      p.consumeAmmo(); Sound.cast();
    },
  },
  // cetro trovejante — raio veloz que perfura uma fileira
  thunder: {
    name: 'Cetro Trovejante', icon: '⚡', visual: 'staff',
    cool: 0.2, clip: 14, reload: 0.9, gunLen: 24,
    desc: 'Raio elétrico velocíssimo; perfura inimigos.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'spark', color: '#bff0ff', speed: 1500, dmg: 14, tileDmg: 8, r: 3, recoil: 10, shake: 1.2, life: 0.7, pierce: 2, knock: 70 });
      p.consumeAmmo(); Sound.zap();
    },
  },
  // lâmina giratória — disco que atravessa vários inimigos
  chakram: {
    name: 'Lâmina Giratória', icon: '🌀', visual: 'dagger',
    cool: 0.34, clip: 10, reload: 0.8, gunLen: 18,
    desc: 'Disco serrilhado que atravessa até 6 inimigos.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'disc', color: '#d8dee6', speed: 760, dmg: 18, tileDmg: 14, r: 6, recoil: 18, shake: 1, life: 1.4, pierce: 6, knock: 60, spin: 30 });
      p.consumeAmmo(); Sound.bow();
    },
  },
  // morteiro — tiro alto em arco; explosão enorme ao cair
  mortar: {
    name: 'Morteiro', icon: '🎆', visual: 'cannon',
    cool: 1.0, clip: 3, reload: 1.5, gunLen: 22,
    desc: 'Projétil alto em arco; explosão imensa ao cair.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'grenade', color: '#2a2620', speed: 640, dmg: 38, tileDmg: 48, r: 6, recoil: 120, shake: 6, life: 3.0, explosive: 110, grav: 520, knock: 280, spin: 6 });
      p.vy -= 80; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(3);
    },
  },
  // frasco de ácido — estoura num respingo corrosivo
  acidflask: {
    name: 'Frasco de Ácido', icon: '🧪', visual: 'pistol',
    cool: 0.5, clip: 6, reload: 1.0, gunLen: 18,
    desc: 'Frasco arremessado que estoura em respingo corrosivo.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'flask', color: '#8ef06a', speed: 600, dmg: 18, tileDmg: 16, r: 5, recoil: 30, shake: 1.5, life: 2.0, explosive: 38, grav: 560, knock: 120, poison: true, spin: 8 });
      p.consumeAmmo(); Sound.cast();
    },
  },
  // trabuco de bronze — bala enorme e lenta; empurrão brutal
  handcannon: {
    name: 'Trabuco de Bronze', icon: '🛡', visual: 'cannon',
    cool: 0.7, clip: 4, reload: 1.3, gunLen: 24,
    desc: 'Bala enorme e lenta; recuo e empurrão brutais.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'slug', color: '#e8b060', speed: 880, dmg: 40, tileDmg: 34, r: 5, recoil: 220, shake: 6, life: 1.2, knock: 420, blast: 1900 });
      p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(4);
    },
  },
  // agulheiro — rajada frenética de agulhas; cadência extrema
  needler: {
    name: 'Agulheiro', icon: '📌', visual: 'smg',
    cool: 0.05, clip: 40, reload: 1.2, gunLen: 20,
    desc: 'Rajada frenética de agulhas; dano baixo, cadência extrema.',
    fire(p, game) {
      p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#cfe8ff', speed: 1100, dmg: 4, tileDmg: 3, r: 1.8, recoil: 6, shake: 0.4, life: 0.5, knock: 30 }, 0.05);
      p.consumeAmmo(); Sound.shot('mg');
    },
  },

  /* ===================================================================
     ARSENAL EXPANDIDO — 25 novas armas de fogo (futurista/vapor/mágica).
     Todas jogáveis no MODO CRIAÇÃO (ver WEAPON_ORDER). Efeitos novos:
     cadeia elétrica, ricochete, teleguiado, fragmentação, congelar,
     envenenar, arremessar pro alto, bumerangue, onda sônica…            */

  // --- FUTURISTAS / ENERGIA ---
  plasmarifle: {
    name: 'Fuzil de Plasma', icon: '🔷', visual: 'plasma',
    cool: 0.14, clip: 24, reload: 1.0, gunLen: 26,
    desc: 'Dardos de plasma velozes que perfuram e queimam.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'plasma', color: '#37f0ff', speed: 1150, dmg: 13, tileDmg: 9, r: 3.2, recoil: 16, shake: 0.9, life: 0.8, pierce: 1, knock: 70, burnT: 1.5, burnDps: 4 });
      p.consumeAmmo(); Sound.shot('rifle'); },
  },
  teslacarbine: {
    name: 'Carabina Tesla', icon: '⚡', visual: 'tesla',
    cool: 0.22, clip: 18, reload: 1.0, gunLen: 24,
    desc: 'Descarga elétrica que SALTA em cadeia entre inimigos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'arc', color: '#bff0ff', speed: 1350, dmg: 12, tileDmg: 6, r: 3.4, recoil: 10, shake: 1, life: 0.6, pierce: 1, knock: 60, chain: 3, chainRange: 170, chainDmg: 9, stun: 0.25 });
      p.consumeAmmo(); Sound.zap(); },
  },
  blaster: {
    name: 'Blaster Estelar', icon: '✴', visual: 'blaster',
    cool: 0.3, clip: 21, reload: 1.0, gunLen: 24,
    desc: 'Rajada tripla de energia em leque.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'orb', color: '#ff5bd0', speed: 980, dmg: 9, tileDmg: 6, r: 3, recoil: 20, shake: 1, life: 0.8, knock: 80 }, 0.10, 3);
      p.consumeAmmo(); Sound.shot('rifle'); },
  },
  railgun: {
    name: 'Canhão de Trilho', icon: '➤', visual: 'railgun',
    cool: 0.9, clip: 4, reload: 1.4, gunLen: 30,
    desc: 'Feixe de trilho hipersônico: perfura fileiras inteiras.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'rail', color: '#8ad8ff', speed: 2200, dmg: 46, tileDmg: 30, r: 3, recoil: 120, shake: 4, life: 0.6, pierce: 8, knock: 160, blast: 900 });
      p.consumeAmmo(); Sound.shot('rifle'); game.cam.addShake(3); },
  },
  pulsecannon: {
    name: 'Canhão de Pulso', icon: '🔊', visual: 'pulse',
    cool: 0.5, clip: 8, reload: 1.1, gunLen: 22,
    desc: 'Onda sônica que atordoa e MANDA os inimigos voando para longe.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'sonic', color: '#7fe8ff', speed: 700, dmg: 16, tileDmg: 10, r: 7, recoil: 60, shake: 2, life: 0.4, pierce: 4, knock: 320, stun: 0.4, blast: 1150 });
      p.consumeAmmo(); Sound.thump(); },
  },
  cryojet: {
    name: 'Criojato', icon: '❄', visual: 'cryo',
    cool: 0.28, clip: 14, reload: 1.1, gunLen: 24,
    desc: 'Estilhaços gélidos que CONGELAM os inimigos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'crystal', color: '#bfe8ff', speed: 900, dmg: 10, tileDmg: 8, r: 3.4, recoil: 18, shake: 1, life: 0.9, pierce: 1, knock: 70, freezeT: 1.6, slowT: 2, slowK: 0.4 });
      p.consumeAmmo(); Sound.cast(); },
  },
  disruptor: {
    name: 'Disruptor Fotônico', icon: '🟣', visual: 'blaster',
    cool: 0.34, clip: 12, reload: 1.0, gunLen: 24,
    desc: 'Orbes que RICOCHETEIAM nas paredes atrás dos alvos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'orb', color: '#b07bff', speed: 820, dmg: 14, tileDmg: 8, r: 3.6, recoil: 16, shake: 1, life: 1.6, knock: 90, bounce: 3, pierce: 1 });
      p.consumeAmmo(); Sound.cast(); },
  },
  gravgun: {
    name: 'Manipulador Gravitacional', icon: '🌀', visual: 'gravgun',
    cool: 0.7, clip: 6, reload: 1.3, gunLen: 22,
    desc: 'Núcleo de gravidade que TELETRANSPORTA os inimigos pra cima.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'void', color: '#c479ff', speed: 640, dmg: 18, tileDmg: 10, r: 5, recoil: 20, shake: 2, life: 1.4, pierce: 3, knock: 120, teleUp: 4 });
      p.consumeAmmo(); Sound.cast(); },
  },

  // --- A VAPOR / STEAMPUNK ---
  steamrifle: {
    name: 'Rifle a Vapor', icon: '🔧', visual: 'steamrifle',
    cool: 0.4, clip: 8, reload: 1.0, gunLen: 28,
    desc: 'Bala pesada movida a vapor; empurrão forte e nuvem quente.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      const m = p.muzzlePos();
      p.shoot(game, { kind: 'slug', color: '#e8b060', speed: 1150, dmg: 24, tileDmg: 18, r: 3.2, recoil: 70, shake: 2, life: 1.0, pierce: 1, knock: 200 });
      game.fx.smoke(m.x, m.y, 3); p.consumeAmmo(); Sound.shot('shotgun'); },
  },
  gearlauncher: {
    name: 'Lança-Engrenagens', icon: '⚙', visual: 'gearrifle',
    cool: 0.3, clip: 12, reload: 1.1, gunLen: 22,
    desc: 'Engrenagens serrilhadas que ricocheteiam e retalham.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'gear', color: '#caa33a', speed: 780, dmg: 15, tileDmg: 12, r: 5, recoil: 18, shake: 1, life: 1.6, pierce: 3, knock: 90, bounce: 2, spin: 26 });
      p.consumeAmmo(); Sound.shot('mg'); },
  },
  rivetgun: {
    name: 'Cravadeira a Vapor', icon: '📍', visual: 'gearrifle',
    cool: 0.06, clip: 36, reload: 1.2, gunLen: 20,
    desc: 'Metralha rebites a vapor numa cadência absurda.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#e8b060', speed: 1000, dmg: 5, tileDmg: 4, r: 2.2, recoil: 8, shake: 0.5, life: 0.6, knock: 40 }, 0.05);
      p.consumeAmmo(); Sound.shot('mg'); },
  },
  aethercannon: {
    name: 'Canhão de Éter', icon: '💥', visual: 'cannon',
    cool: 0.85, clip: 4, reload: 1.3, gunLen: 24,
    desc: 'Bomba de éter que estilhaça em 6 fragmentos ao explodir.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'grenade', color: '#5a3a7a', speed: 620, dmg: 24, tileDmg: 28, r: 5, recoil: 80, shake: 3, life: 1.6, explosive: 52, grav: 500, knock: 180, spin: 10,
        split: { n: 6, radial: true, kind: 'ember', color: '#c479ff', dmg: 10, speed: 480, life: 0.5, r: 3 } });
      p.vy -= 40; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(2); },
  },
  flakcannon: {
    name: 'Canhão de Estilhaços', icon: '🎇', visual: 'cannon',
    cool: 0.6, clip: 6, reload: 1.2, gunLen: 22,
    desc: 'Leque de metralha que se parte em fragmentos ao atingir.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'pellet', color: '#ffb060', speed: 820, dmg: 8, tileDmg: 8, r: 3, recoil: 60, shake: 2, life: 0.6, knock: 110,
        split: { n: 4, kind: 'ember', color: '#ffd86b', dmg: 6, speed: 420, spread: 0.7, life: 0.4 } }, 0.14, 5);
      p.vy -= 30; p.consumeAmmo(); Sound.shot('shotgun'); },
  },
  harpoongun: {
    name: 'Arpão a Vapor', icon: '🪝', visual: 'harpoon',
    cool: 0.55, clip: 5, reload: 1.2, gunLen: 28,
    desc: 'Arpão farpado que trespassa e sangra os inimigos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'harpoon', color: '#cfd2d6', speed: 1050, dmg: 30, tileDmg: 16, r: 3, recoil: 60, shake: 2, life: 1.0, pierce: 3, knock: 260, bleed: true });
      p.consumeAmmo(); Sound.bow(); },
  },

  // --- MÁGICAS ---
  arcaneorb: {
    name: 'Orbe Arcano', icon: '🔮', visual: 'orbstaff',
    cool: 0.5, clip: 8, reload: 1.0, gunLen: 24,
    desc: 'Estrela arcana TELEGUIADA que persegue o inimigo.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'star', color: '#ff7be0', speed: 560, dmg: 20, tileDmg: 10, r: 4, recoil: 12, shake: 1, life: 2.2, knock: 90, homing: true, pierce: 1 });
      p.consumeAmmo(); Sound.cast(); },
  },
  frostbow: {
    name: 'Arco de Geada', icon: '🏹', visual: 'bow',
    cool: 0.3, clip: 12, reload: 0.9, gunLen: 22,
    desc: 'Flechas de gelo que congelam ao acertar.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'ice', color: '#bfe8ff', speed: 1050, dmg: 15, tileDmg: 9, r: 3, recoil: 12, shake: 1, life: 1.1, pierce: 2, knock: 70, freezeT: 1.4 });
      p.consumeAmmo(); Sound.bow(); },
  },
  stormwand: {
    name: 'Varinha da Tempestade', icon: '🌩', visual: 'runestaff',
    cool: 0.16, clip: 20, reload: 1.0, gunLen: 24,
    desc: 'Relâmpagos rápidos que saltam em cadeia.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'arc', color: '#eaffff', speed: 1500, dmg: 10, tileDmg: 6, r: 3, recoil: 8, shake: 0.8, life: 0.5, pierce: 1, knock: 50, chain: 2, chainRange: 150, chainDmg: 8 });
      p.consumeAmmo(); Sound.zap(); },
  },
  holylance: {
    name: 'Lança de Luz', icon: '✨', visual: 'orbstaff',
    cool: 0.6, clip: 6, reload: 1.1, gunLen: 26,
    desc: 'Feixe radiante que perfura e arremessa os ímpios.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'rail', color: '#ffe9a8', speed: 1400, dmg: 30, tileDmg: 14, r: 3.4, recoil: 30, shake: 2, life: 0.9, pierce: 5, knock: 160, launch: 260 });
      p.consumeAmmo(); Sound.cast(); },
  },
  soulscythe: {
    name: 'Foice das Almas', icon: '🌙', visual: 'reaperstaff',
    cool: 0.42, clip: 8, reload: 1.0, gunLen: 24,
    desc: 'Crescentes espectrais que ceifam fileiras de inimigos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'crescent', color: '#9b6bff', speed: 720, dmg: 22, tileDmg: 12, r: 13, recoil: 16, shake: 1.4, life: 0.9, pierce: 6, knock: 120 });
      p.consumeAmmo(); Sound.slash(); },
  },
  meteorstaff: {
    name: 'Cajado do Meteoro', icon: '☄', visual: 'runestaff',
    cool: 0.85, clip: 4, reload: 1.3, gunLen: 24,
    desc: 'Meteoro em arco que explode em fogo ao cair.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'meteor', color: '#ff6a2c', speed: 700, dmg: 30, tileDmg: 34, r: 6, recoil: 40, shake: 3, life: 2.4, explosive: 64, grav: 620, knock: 200,
        split: { n: 5, radial: true, kind: 'ember', color: '#ff8a3c', dmg: 8, speed: 420, life: 0.6, opts: { burnT: 2, burnDps: 5 } } });
      p.consumeAmmo(); Sound.cast(); game.cam.addShake(2); },
  },
  venomspitter: {
    name: 'Cuspidor de Veneno', icon: '🐍', visual: 'cryo',
    cool: 0.36, clip: 12, reload: 1.0, gunLen: 22,
    desc: 'Gosmas tóxicas que envenenam e se partem em respingos.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'glob', color: '#8ef06a', speed: 720, dmg: 12, tileDmg: 8, r: 4, recoil: 16, shake: 1, life: 1.2, knock: 70, grav: 240, poison: true, poisonT: 4, poisonDps: 6,
        split: { n: 3, kind: 'glob', color: '#8ef06a', dmg: 5, speed: 300, spread: 0.6, life: 0.5, opts: { poison: true } } });
      p.consumeAmmo(); Sound.cast(); },
  },
  wispcaster: {
    name: 'Cajado dos Fogos-Fátuos', icon: '👻', visual: 'runestaff',
    cool: 0.26, clip: 14, reload: 1.0, gunLen: 24,
    desc: 'Fogos-fátuos teleguiados que incendeiam o alvo.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'wisp', color: '#8effc0', speed: 560, dmg: 11, tileDmg: 6, r: 3.2, recoil: 8, shake: 0.7, life: 2.0, knock: 50, homing: true, burnT: 2.5, burnDps: 5 });
      p.consumeAmmo(); Sound.cast(); },
  },
  runicboomerang: {
    name: 'Bumerangue Rúnico', icon: '🪃', visual: 'gearrifle',
    cool: 0.5, clip: 6, reload: 1.0, gunLen: 18,
    desc: 'Lâmina rúnica que voa, retorna e trespassa no caminho.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'boomerang', color: '#caa45a', speed: 780, dmg: 18, tileDmg: 10, r: 6, recoil: 12, shake: 1, life: 2.4, pierce: 99, knock: 90, spin: 24, boomerang: 0.55, owner: p, ghost: true });
      p.consumeAmmo(); Sound.bow(); },
  },
  prismgun: {
    name: 'Canhão Prismático', icon: '🔺', visual: 'blaster',
    cool: 0.44, clip: 8, reload: 1.0, gunLen: 24,
    desc: 'Cristal que se fragmenta em três estilhaços no impacto.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'crystal', color: '#7be0ff', speed: 900, dmg: 16, tileDmg: 10, r: 4, recoil: 18, shake: 1, life: 1.0, knock: 80,
        split: { n: 3, kind: 'shard', color: '#7be0ff', dmg: 9, speed: 620, spread: 0.5, life: 0.6 } });
      p.consumeAmmo(); Sound.cast(); },
  },
  quakecannon: {
    name: 'Canhão Sísmico', icon: '🌋', visual: 'steamrifle',
    cool: 0.95, clip: 3, reload: 1.5, gunLen: 26,
    desc: 'Projétil sísmico: explode e joga TODOS por perto para cima.',
    fire(p, game) { p.cool = this.cool; p.coolMax = this.cool;
      p.shoot(game, { kind: 'cannon', color: '#b07a3a', speed: 620, dmg: 26, tileDmg: 40, r: 6, recoil: 140, shake: 6, life: 1.6, explosive: 60, knock: 200, launch: 520, spin: 8 });
      p.vy -= 60; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(4); },
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
  // escava terreno macio ao longo do jato (coluna de ~2 tiles + ~40% um 3º)
  for (let d = T * 0.5; d < reach; d += T * 0.6) {
    game.carveTiles(Math.floor((m.x + dir * d) / T), Math.floor(m.y / T), 5, { power: 20 });
  }
  p.consumeAmmo();
  game.alertEnemies(p.cx, p.cy, 380);
  if (Math.random() < 0.5) Sound.shot('flame');
}

// ordem das armas de fogo na FASE DE TESTES (teclas 1..9 = atalho; , . ciclam TODAS)
const WEAPON_ORDER = ['scatter', 'repeater', 'flamethrower', 'bolt', 'fireball', 'daggers', 'smg', 'cannon', 'arquebus',
  'grenade', 'icelance', 'thunder', 'chakram', 'mortar', 'acidflask', 'handcannon', 'needler',
  // --- arsenal expandido ---
  'plasmarifle', 'teslacarbine', 'blaster', 'railgun', 'pulsecannon', 'cryojet', 'disruptor', 'gravgun',
  'steamrifle', 'gearlauncher', 'rivetgun', 'aethercannon', 'flakcannon', 'harpoongun',
  'arcaneorb', 'frostbow', 'stormwand', 'holylance', 'soulscythe', 'meteorstaff', 'venomspitter',
  'wispcaster', 'runicboomerang', 'prismgun', 'quakecannon'];

/* COICE por arma (px/s de recuo do corpo ao disparar). 0 = nenhum · ~40-85 suave
   · ~100-170 médio · ~300 agressivo. Aplicado central em Player.recoilKick. Para
   dar coice a uma arma nova, some a chave aqui. */
const WEAPON_KICK = {
  scatter: 95, repeater: 0, flamethrower: 0, bolt: 20, fireball: 45, daggers: 0, smg: 0,
  cannon: 155, arquebus: 120, grenade: 80, icelance: 35, thunder: 25, chakram: 30, mortar: 175,
  acidflask: 45, handcannon: 300, needler: 0,
  plasmarifle: 25, teslacarbine: 20, blaster: 20, railgun: 185, pulsecannon: 150, cryojet: 35,
  disruptor: 35, gravgun: 65, steamrifle: 150, gearlauncher: 40, rivetgun: 0, aethercannon: 120,
  flakcannon: 130, harpoongun: 120, arcaneorb: 0, frostbow: 25, stormwand: 15, holylance: 85,
  soulscythe: 40, meteorstaff: 110, venomspitter: 40, wispcaster: 0, runicboomerang: 30,
  prismgun: 50, quakecannon: 300,
};
for (const _k in WEAPON_KICK) if (WEAPONS[_k]) WEAPONS[_k].kick = WEAPON_KICK[_k];

/* ===================================================================
   ARMAS BRANCAS — registro MELEE (usado pelo golpe corpo-a-corpo, tecla C).
   Cada arma define o PERFIL do golpe (alcance/dano/recuo/cor do arco) e o
   VISUAL empunhado (SPR.drawMeleeWeapon), além de mecânicas novas:
     swing:'thrust'  estocada reta e longa (lança/chicote/florete)
     swing:'spin'    giro de 360° (glaive/montante)
     deflect:true    REBATE tiros e flechas inimigos de volta
     launch:N        ARREMESSA o inimigo pro alto (px/s)
     pull:N          PUXA o inimigo em sua direção (chicote)
     ignite/freeze/bleed/stun/slow/chain/lifesteal  efeitos ao acertar
     wave:{…}        dispara um projétil (onda de corte) a cada golpe
   Jogáveis no MODO CRIAÇÃO (ver MELEE_ORDER; teclas K / L ciclam).
   =================================================================== */
const MELEE = {
  sword:       { name: 'Espada Longa', icon: '⚔', visual: 'sword', blade: '#dfe7ef',
                 cd: 0.4, range: 54, dmg: 28, tileDmg: 22, knock: 250, color: 'rgba(230,238,255,0.95)', shake: 4 },
  saber:       { name: 'Sabre', icon: '🗡', visual: 'saber', blade: '#eaf2ff',
                 cd: 0.24, range: 50, dmg: 20, tileDmg: 14, knock: 150, color: 'rgba(220,235,255,0.95)', shake: 3, deflect: true },
  katana:      { name: 'Katana', icon: '🀄', visual: 'katana', blade: '#f0f4ff',
                 cd: 0.3, range: 58, dmg: 30, tileDmg: 18, knock: 200, color: 'rgba(235,242,255,0.95)', shake: 4, deflect: true,
                 wave: { kind: 'slashwave', color: '#eaf2ff', dmg: 14, r: 11, speed: 820, life: 0.5, pierce: 4, knock: 90 } },
  rapier:      { name: 'Florete', icon: '🤺', visual: 'rapier', blade: '#eaf2ff',
                 cd: 0.2, range: 66, dmg: 18, tileDmg: 10, knock: 120, color: 'rgba(230,238,255,0.9)', shake: 2, swing: 'thrust', deflect: true },
  greatsword:  { name: 'Montante', icon: '⚔', visual: 'greatsword', blade: '#dfe7ef',
                 cd: 0.6, range: 66, dmg: 46, tileDmg: 34, knock: 360, color: 'rgba(230,238,255,0.95)', shake: 6, swing: 'spin', launch: 180 },
  giantsword:  { name: 'Espada Colossal', icon: '🗡', visual: 'giantsword', blade: '#c9a0ff', glow: true,
                 cd: 0.72, range: 82, dmg: 54, tileDmg: 40, knock: 420, color: 'rgba(155,107,255,0.95)', shake: 8, swing: 'spin', launch: 440, blast: 1000,
                 wave: { kind: 'crescent', color: '#9b6bff', dmg: 24, r: 15, speed: 720, life: 0.7, pierce: 6, knock: 160 } },
  flameblade:  { name: 'Lâmina Flamejante', icon: '🔥', visual: 'flameblade', blade: '#ff8a3c', glow: true,
                 cd: 0.42, range: 58, dmg: 30, tileDmg: 24, knock: 240, color: 'rgba(255,140,60,0.95)', shake: 4, ignite: [3, 8],
                 wave: { kind: 'fireball', color: '#ff7a2c', dmg: 14, r: 6, speed: 620, life: 0.6, knock: 80 } },
  frostbrand:  { name: 'Lâmina Gélida', icon: '❄', visual: 'frostbrand', blade: '#bfe8ff', glow: true,
                 cd: 0.44, range: 56, dmg: 28, tileDmg: 20, knock: 220, color: 'rgba(160,220,255,0.95)', shake: 4, freeze: 1.6, slow: [2, 0.4] },
  thunderblade:{ name: 'Lâmina Trovejante', icon: '⚡', visual: 'thunderblade', blade: '#eaffff', glow: true,
                 cd: 0.38, range: 60, dmg: 26, tileDmg: 18, knock: 200, color: 'rgba(160,240,255,0.95)', shake: 4, stun: 0.4,
                 chain: { n: 3, range: 160, dmg: 12 } },
  holyblade:   { name: 'Espada Sagrada', icon: '✨', visual: 'holyblade', blade: '#ffe9a8', glow: true,
                 cd: 0.46, range: 62, dmg: 34, tileDmg: 22, knock: 260, color: 'rgba(255,235,160,0.95)', shake: 5, launch: 220, lifesteal: 6 },
  voidscythe:  { name: 'Foice do Abismo', icon: '🌑', visual: 'voidscythe', blade: '#c479ff', glow: true,
                 cd: 0.6, range: 76, dmg: 40, tileDmg: 26, knock: 300, color: 'rgba(150,90,255,0.9)', shake: 6, teleUp: 4, lifesteal: 4,
                 wave: { kind: 'crescent', color: '#c479ff', dmg: 18, r: 13, speed: 640, life: 0.7, pierce: 5, knock: 120 } },
  scythe:      { name: 'Foice Ceifadora', icon: '🌾', visual: 'scythe', blade: '#cfd8e6',
                 cd: 0.5, range: 70, dmg: 34, tileDmg: 22, knock: 220, color: 'rgba(200,215,235,0.95)', shake: 5, swing: 'spin', bleed: true, lifesteal: 3 },
  axe:         { name: 'Machado', icon: '🪓', visual: 'axe', blade: '#cfd6de',
                 cd: 0.48, range: 54, dmg: 38, tileDmg: 30, knock: 280, color: 'rgba(220,225,235,0.95)', shake: 5, bleed: true },
  greataxe:    { name: 'Machado de Guerra', icon: '🪓', visual: 'greataxe', blade: '#cfd6de',
                 cd: 0.62, range: 64, dmg: 50, tileDmg: 40, knock: 380, color: 'rgba(220,225,235,0.95)', shake: 7, swing: 'spin', bleed: true, launch: 160 },
  warhammer:   { name: 'Martelo de Guerra', icon: '🔨', visual: 'warhammer', blade: '#c8ccd2',
                 cd: 0.56, range: 60, dmg: 44, tileDmg: 60, knock: 540, color: 'rgba(255,210,120,0.95)', shake: 8, stun: 0.7, blast: 1400 },
  earthmaul:   { name: 'Marreta Sísmica', icon: '🌋', visual: 'earthmaul', blade: '#b07a3a', glow: true,
                 cd: 0.7, range: 74, dmg: 40, tileDmg: 66, knock: 380, color: 'rgba(200,150,80,0.95)', shake: 10, quake: true, stun: 0.5, launch: 480 },
  spear:       { name: 'Lança', icon: '🔱', visual: 'spear', blade: '#dfe7ef',
                 cd: 0.36, range: 82, dmg: 30, tileDmg: 18, knock: 240, color: 'rgba(230,238,255,0.9)', shake: 3, swing: 'thrust' },
  shieldspear: { name: 'Escudo & Lança', icon: '🛡', visual: 'shieldspear', blade: '#dfe7ef',
                 cd: 0.42, range: 76, dmg: 26, tileDmg: 16, knock: 300, color: 'rgba(230,238,255,0.92)', shake: 4, swing: 'thrust', deflect: true },
  halberd:     { name: 'Alabarda', icon: '⚔', visual: 'halberd', blade: '#dfe7ef',
                 cd: 0.5, range: 84, dmg: 40, tileDmg: 28, knock: 300, color: 'rgba(230,238,255,0.95)', shake: 5, swing: 'thrust', bleed: true },
  glaive:      { name: 'Lâmina Dupla', icon: '🌀', visual: 'glaive', blade: '#eaf2ff',
                 cd: 0.44, range: 68, dmg: 30, tileDmg: 22, knock: 240, color: 'rgba(200,220,255,0.95)', shake: 4, swing: 'spin',
                 wave: { kind: 'slashwave', color: '#cfe0ff', dmg: 12, r: 11, speed: 760, life: 0.5, pierce: 4, knock: 80, both: true } },
  whip:        { name: 'Chicote', icon: '➰', visual: 'whip', blade: '#8a5a2a',
                 cd: 0.34, range: 108, dmg: 16, tileDmg: 8, knock: 120, color: 'rgba(210,180,120,0.9)', shake: 2, swing: 'thrust', pull: 260, bleed: true },
  flail:       { name: 'Mangual', icon: '⛓', visual: 'flail', blade: '#c8ccd2',
                 cd: 0.46, range: 58, dmg: 30, tileDmg: 22, knock: 300, color: 'rgba(220,225,235,0.95)', shake: 5, stun: 0.4, chain: { n: 2, range: 140, dmg: 10 } },
  claws:       { name: 'Garras', icon: '🐾', visual: 'claws', blade: '#eaeaea',
                 cd: 0.18, range: 44, dmg: 15, tileDmg: 10, knock: 120, color: 'rgba(235,235,235,0.95)', shake: 2, bleed: true },
  daggers:     { name: 'Adagas Gêmeas', icon: '🗡', visual: 'daggers', blade: '#cfd2d6',
                 cd: 0.2, range: 46, dmg: 16, tileDmg: 10, knock: 140, color: 'rgba(220,225,235,0.95)', shake: 2, bleed: true, lifesteal: 2 },
  bostaff:     { name: 'Bordão', icon: '🥢', visual: 'bostaff', blade: '#8a5a2a',
                 cd: 0.26, range: 60, dmg: 18, tileDmg: 12, knock: 220, color: 'rgba(210,180,120,0.9)', shake: 3, deflect: true, stun: 0.3 },
};

// ordem das armas brancas no MODO CRIAÇÃO (teclas K / L ciclam)
const MELEE_ORDER = ['sword', 'saber', 'katana', 'rapier', 'greatsword', 'giantsword', 'flameblade', 'frostbrand',
  'thunderblade', 'holyblade', 'voidscythe', 'scythe', 'axe', 'greataxe', 'warhammer', 'earthmaul',
  'spear', 'shieldspear', 'halberd', 'glaive', 'whip', 'flail', 'claws', 'daggers', 'bostaff'];

/* ===================== HERÓIS ============================= */
const HEROES = [
  {
    key: 'ragnarok', name: 'RAGNAROK', icon: '⚔', spr: 'ragnarok',
    desc: 'Guerreiro veterano. Espingarda + o CÓDICE DE GUERRA (tecla G): fúria bárbara, martelos, fogo, paladino e a lâmina transcendental.',
    hp: 150, speed: 235, jumpV: 1400, jumps: 1, w: 28, h: 48,
    specialRegen: 8,                  // acumula FÚRIA mais rápido (e ganha +5 por golpe corpo-a-corpo)
    weaponKey: 'scatter',
    // O ESPECIAL do Ragnarok usa a TÉCNICA ATIVA do Códice (ver spells.js / Grimoire).
    // Este objeto é só FALLBACK (caso o módulo de habilidades não carregue).
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
    key: 'nicolau', name: 'SAINT-GERMAN', icon: '⚗', spr: 'nicolau',
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
    desc: 'Mago humano. Bola de fogo arcana e o GRIMÓRIO de feitiços (tecla G) — congelar, invocar, voar e muito mais.',
    hp: 100, speed: 240, jumpV: 1350, jumps: 2, w: 26, h: 48,
    fallMult: 0.5, terminalVy: 540,   // queda BEM mais suave — sensação de levitar
    specialRegen: 16,                 // mago regenera MANA bem mais rápido (especial = mana dos feitiços)
    weaponKey: 'fireball',
    // O ESPECIAL do Edward conjura o FEITIÇO ATIVO do Grimório (ver spells.js / Grimoire).
    // Este objeto é um FALLBACK (usado só se o módulo de feitiços não carregar).
    special: {
      cost: 40, cd: 0.8,
      use(p, game) {
        game.electricBurst(p, { radius: 6 * CONFIG.TILE, dmg: 50, knock: 200 });
        game.fx.text(p.cx, p.y, 'PODER DA CONSTITUIÇÃO!', '#7fd8ff');
        Sound.zap();
      },
    },
  },
  {
    key: 'vex', name: 'VEX', icon: '🃏', spr: 'vex',
    desc: 'Bobo da corte metamorfo. Adagas arremessadas e a Metamorfose: vira outro herói por ' + VEX_MORPH_TIME + 's.',
    hp: 115, speed: 280, jumpV: 1420, jumps: 2, w: 26, h: 46,
    weaponKey: 'daggers',
    // Especial PRÓPRIO do Vex: metamorfose (medida por CARGAS, não pela barra azul).
    // Tratada de forma especial em Player.update (procura por special.metamorph).
    special: { cost: 0, cd: 0.5, metamorph: true, use(p, game) { /* ver Player._tryMetamorph */ } },
  },
];

const heroIndexByKey = k => HEROES.findIndex(h => h.key === k);

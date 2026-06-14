/* ============================================================
   heroes.js — playable RPG classes
   Each has a class-fitting base attack (melee / ranged / magic)
   and a signature special. Add new ones by extending HEROES.
   ============================================================ */

const HEROES = [
  // 0 — WARRIOR (melee sword) ---------------------------------
  {
    key: 'warrior', name: 'BRÁVAN, O GUERREIRO', icon: '⚔',
    desc: 'Espada e escudo. Golpes em arco e o Turbilhão giratório.',
    hp: 140, speed: 225, jumpV: 770, jumps: 1, clip: 99, reload: 0.6, gunLen: 16, w: 26, h: 46,
    skin: { tone: '#d9a06b', outfit: '#41506b', outfit2: '#2c3650', trim: '#caa33a', cloak: '#8a2b2b', head: 'greathelm', plume: '#b1322c', pauldron: '#9aa2ad', weapon: 'sword', weaponColor: '#dfe3e8' },
    weapon: { fire(p, game) { p.cool = 0.30; p.attackT = 1; game.meleeArc(p, { range: 48, arc: 0.95, dmg: 24, tileDmg: 30, knock: 230, color: 'rgba(220,235,255,0.95)', shake: 3 }); Sound.slash(); } },
    special: {
      cost: 45, cd: 0.6,
      use(p, game) { p.attackT = 1; game.meleeArc(p, { range: 64, arc: Math.PI, dmg: 30, tileDmg: 34, knock: 320, color: 'rgba(255,230,150,0.9)', shake: 7 }); game.fx.shock(p.cx, p.cy, 90, '#caa33a'); game.fx.text(p.cx, p.y, 'TURBILHÃO!', '#caa33a'); Sound.slash(); }
    }
  },
  // 1 — ROGUE (thrown daggers) --------------------------------
  {
    key: 'rogue', name: 'NYX, A LADINA', icon: '🗡',
    desc: 'Adagas arremessadas, salto duplo e o Bote das Sombras.',
    hp: 95, speed: 305, jumpV: 690, jumps: 2, clip: 24, reload: 0.9, gunLen: 14, w: 22, h: 42,
    skin: { tone: '#caa07a', outfit: '#2e2a33', outfit2: '#1b1820', trim: '#6a6a72', cloak: '#33203a', head: 'hood', eyes: '#9be0ff', hair: '#241f1a', weapon: 'dagger', weaponColor: '#cfd2d6' },
    weapon: { fire(p, game) { p.cool = 0.12; p.shoot(game, { kind: 'dagger', speed: 860, dmg: 11, tileDmg: 6, r: 3, spin: 26, recoil: 8, shake: 0.7, life: 1.0, color: '#cfd2d6' }, 0.05); p.consumeAmmo(); Sound.bow(); } },
    special: {
      cost: 50, cd: 0.6,
      use(p, game) { p.dashT = 0.18; p.invuln = Math.max(p.invuln, 0.5); p.shoot(game, { kind: 'dagger', speed: 800, dmg: 12, tileDmg: 6, r: 3, spin: 26, life: 1.0, fan: 0.14, color: '#cfd2d6' }, 0.02, 7); game.fx.smoke(p.cx, p.cy, 9); game.fx.text(p.cx, p.y, 'BOTE DAS SOMBRAS!', '#9be0ff'); Sound.bow(); }
    }
  },
  // 2 — MAGE (arcane bolts / fireball) ------------------------
  {
    key: 'mage', name: 'ALDRIC, O MAGO', icon: '✦',
    desc: 'Mísseis arcanos, levita no ar e conjura a Bola de Fogo.',
    hp: 80, speed: 235, jumpV: 640, jumps: 1, canHover: true, clip: 30, reload: 1.1, gunLen: 22, w: 24, h: 46,
    skin: { tone: '#e0b48a', outfit: '#3a2a6a', outfit2: '#241a44', trim: '#caa33a', robe: true, head: 'wizardhat', hat: '#3a2a6a', orb: '#b07bff', weapon: 'staff', hair: '#cfcfcf' },
    weapon: {
      fire(p, game) {
        p.cool = 0.20; const m = p.muzzlePos();
        game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 740, { faction: 'player', kind: 'pellet', color: '#b07bff', dmg: 16, tileDmg: 8, r: 4, life: 1.4, knock: 90 }));
        game.fx.magic(m.x, m.y, '#b07bff', 5); p.vx -= Math.cos(p.aimAng) * 8; p.consumeAmmo(); Sound.cast();
      }
    },
    special: {
      cost: 55, cd: 0.6,
      use(p, game) { const m = p.muzzlePos(); game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 560, { faction: 'player', kind: 'pellet', color: '#ff7b3c', dmg: 46, tileDmg: 60, r: 9, explosive: 112, life: 2.4 })); game.fx.magic(m.x, m.y, '#ff7b3c', 10); game.cam.addShake(6); game.fx.text(p.cx, p.y, 'BOLA DE FOGO!', '#ff7b3c'); Sound.cast(); }
    }
  },
  // 3 — BARD (sonic notes / crescendo+heal) -------------------
  {
    key: 'bard', name: 'LIORA, A BARDA', icon: '♪',
    desc: 'Notas sônicas perfurantes e o Crescendo que cura.',
    hp: 100, speed: 255, jumpV: 690, jumps: 2, clip: 40, reload: 1.0, gunLen: 18, w: 24, h: 44,
    skin: { tone: '#d9a06b', outfit: '#2f6a4a', outfit2: '#1f4a32', trim: '#caa33a', cloak: '#7a2a4a', head: 'feathered', hat: '#2f5a3a', hair: '#7a4a22', weapon: 'lute' },
    weapon: { fire(p, game) { p.cool = 0.14; p.shoot(game, { kind: 'note', speed: 660, dmg: 9, tileDmg: 5, r: 4, pierce: 2, knock: 150, life: 1.2, color: pick(['#ffd86b', '#7be0ff', '#ff7be0', '#7be08a']) }, 0.03); p.consumeAmmo(); Sound.note(); } },
    special: {
      cost: 55, cd: 0.7,
      use(p, game) { p.shoot(game, { kind: 'note', speed: 600, dmg: 14, tileDmg: 6, r: 5, pierce: 4, knock: 240, life: 1.1, fan: 0.13, color: '#7be0ff' }, 0.02, 9); game.fx.shock(p.cx, p.cy, 95, '#7be0ff'); p.hp = clamp(p.hp + 30, 0, p.maxhp); game.fx.magic(p.cx, p.cy, '#7be08a', 14); game.fx.text(p.cx, p.y, 'CRESCENDO!', '#7be0ff'); Sound.heal(); }
    }
  },
  // 4 — BARBARIAN (axe cleave / quake) ------------------------
  {
    key: 'barbarian', name: 'GROK, O BÁRBARO', icon: '🪓',
    desc: 'Machadadas largas e o Tremor que racha o próprio chão.',
    hp: 175, speed: 200, jumpV: 720, jumps: 1, clip: 99, reload: 0.6, gunLen: 18, w: 30, h: 50,
    skin: { tone: '#c08a64', outfit: '#6a3a2a', outfit2: '#3a1e14', trim: '#caa33a', head: 'horns', hair: '#3a2a1a', pauldron: '#7a4a2a', weapon: 'axe', weaponColor: '#9aa2ad' },
    weapon: { fire(p, game) { p.cool = 0.42; p.attackT = 1; game.meleeArc(p, { range: 60, arc: 1.2, dmg: 38, tileDmg: 48, knock: 350, color: 'rgba(255,180,120,0.95)', shake: 5 }); Sound.slash(); } },
    special: {
      cost: 55, cd: 0.8,
      use(p, game) {
        const R = 130, T = game.world.T;
        game.damageEntitiesRadial(p.cx, p.cy + 14, R, 46, p);
        for (let a = -R; a <= R; a += T * 0.5) for (let b = 0; b <= R * 0.7; b += T * 0.5)
          game.world.damage(Math.floor((p.cx + a) / T), Math.floor((p.cy + 14 + b) / T), 40, { power: 120 });
        game.fx.shock(p.cx, p.cy + 14, R * 1.4, '#caa33a'); game.fx.smoke(p.cx, p.cy, 12); game.cam.addShake(13); p.vy -= 180;
        game.fx.text(p.cx, p.y, 'TREMOR!', '#caa33a'); Sound.thump();
      }
    }
  },
  // 5 — DRUID (thorns / nature burst+heal) --------------------
  {
    key: 'druid', name: 'FERNA, A DRUIDA', icon: '❦',
    desc: 'Espinhos em leque, plana no ar e desperta a Ira da Floresta.',
    hp: 110, speed: 240, jumpV: 660, jumps: 1, canHover: true, clip: 24, reload: 1.0, gunLen: 20, w: 24, h: 46,
    skin: { tone: '#caa07a', outfit: '#3a5a2a', outfit2: '#24401c', trim: '#8a6a2a', robe: true, head: 'antlers', hair: '#5a3a1a', leaf: '#7be08a', orb: '#7be08a', weapon: 'staff' },
    weapon: { fire(p, game) { p.cool = 0.26; p.shoot(game, { kind: 'thorn', speed: 700, dmg: 10, tileDmg: 6, r: 3, life: 1.0, fan: 0.14 }, 0.03, 3); const m = p.muzzlePos(); game.fx.magic(m.x, m.y, '#7be08a', 3); p.consumeAmmo(); Sound.cast(); } },
    special: {
      cost: 55, cd: 0.7,
      use(p, game) { const R = 120; game.damageEntitiesRadial(p.cx, p.cy, R, 34, p); game.fx.shock(p.cx, p.cy, R * 1.3, '#7be08a'); game.fx.magic(p.cx, p.cy, '#7be08a', 26); p.hp = clamp(p.hp + 25, 0, p.maxhp); game.fx.text(p.cx, p.y, 'IRA DA FLORESTA!', '#7be08a'); Sound.heal(); }
    }
  },
  // 6 — RANGER (bow / arrow volley) ---------------------------
  {
    key: 'ranger', name: 'KAEL, O CAÇADOR', icon: '➶',
    desc: 'Arco preciso e perfurante, salto duplo e a Saraivada.',
    hp: 100, speed: 290, jumpV: 690, jumps: 2, clip: 14, reload: 1.0, gunLen: 20, w: 23, h: 44,
    skin: { tone: '#caa07a', outfit: '#3a5030', outfit2: '#243a1e', trim: '#7a5a2a', cloak: '#4a3a22', head: 'hood', eyes: '#caa33a', hair: '#5a3a1a', weapon: 'bow', weaponColor: '#7a5a2a' },
    weapon: { fire(p, game) { p.cool = 0.26; p.shoot(game, { kind: 'arrow', speed: 920, dmg: 20, tileDmg: 10, r: 3, recoil: 10, shake: 1.2, life: 1.2, pierce: 1 }); p.consumeAmmo(); Sound.bow(); } },
    special: {
      cost: 50, cd: 0.6,
      use(p, game) { p.shoot(game, { kind: 'arrow', speed: 840, dmg: 14, tileDmg: 8, r: 3, life: 1.1, fan: 0.10, pierce: 1 }, 0.02, 9); game.cam.addShake(4); game.fx.text(p.cx, p.y, 'SARAIVADA!', '#caa33a'); Sound.bow(); }
    }
  },
];

const heroIndexByKey = k => HEROES.findIndex(h => h.key === k);

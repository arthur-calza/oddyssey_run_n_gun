/* ============================================================
   heroes.js — the two playable heroes
     0 RAGNAROK — knight; base: shotgun blast; special: explosive shell
     1 ZRACKS  — lizard archer; base: arrow; special: sword dash
   ============================================================ */

const HEROES = [
  {
    key: 'ragnarok', name: 'RAGNAROK', icon: '⚔', spr: 'ragnarok',
    desc: 'Cavaleiro de placas. Espingarda de dispersão e o Tiro Explosivo.',
    hp: 150, speed: 235, jumpV: 760, jumps: 1, clip: 6, reload: 0.9, gunLen: 26, w: 28, h: 48,
    weapon: {
      fire(p, game) {
        if (p.powered > 0) {   // POTION: explosive buckshot
          p.cool = 0.4; p.coolMax = 0.4;
          p.shoot(game, { kind: 'pellet', color: '#ff8a3c', speed: 780, dmg: 14, tileDmg: 20, r: 4, recoil: 150, shake: 4, life: 0.55, knock: 200, explosive: 34, fan: 0.13 }, 0.06, 6);
          p.vy -= 50; p.consumeAmmo(); Sound.shot('shotgun'); game.cam.addShake(2); return;
        }
        p.cool = 0.34; p.coolMax = 0.34;
        p.shoot(game, { kind: 'pellet', color: '#ffe27a', speed: 820, dmg: 11, tileDmg: 13, r: 3, recoil: 120, shake: 3, life: 0.5, knock: 180, fan: 0.11 }, 0.05, 6);
        p.vy -= 40; p.consumeAmmo(); Sound.shot('shotgun');
      }
    },
    special: {
      cost: 45, cd: 0.5,
      use(p, game) {
        const m = p.muzzlePos();
        game.bullets.push(new Bullet(m.x, m.y, p.aimAng, 640, { faction: 'player', kind: 'pellet', color: '#ff8a3c', dmg: 40, tileDmg: 52, r: 6, explosive: 96, life: 2.2, knock: 200 }));
        game.fx.muzzle(m.x, m.y, p.aimAng); p.vx -= Math.cos(p.aimAng) * 140;
        game.cam.addShake(7); game.fx.text(p.cx, p.y, 'TIRO EXPLOSIVO!', '#ff8a3c'); Sound.shot('shotgun');
      }
    }
  },
  {
    key: 'zracks', name: 'ZRACKS', icon: '➶', spr: 'zracks',
    desc: 'Lagarto caçador. Arco perfurante e a Investida com lâmina.',
    hp: 110, speed: 300, jumpV: 700, jumps: 2, clip: 12, reload: 0.8, gunLen: 22, w: 28, h: 46,
    weapon: {
      fire(p, game) {
        if (p.powered > 0) {   // POTION: venom orbs (poison splash)
          p.cool = 0.18; p.coolMax = 0.18;
          p.shoot(game, { kind: 'pellet', color: '#8ef06a', speed: 720, dmg: 16, tileDmg: 8, r: 5, recoil: 8, shake: 1, life: 1.3, pierce: 1, explosive: 26, poison: true });
          p.consumeAmmo(); Sound.cast(); return;
        }
        p.cool = 0.24; p.coolMax = 0.24;
        p.shoot(game, { kind: 'arrow', speed: 940, dmg: 18, tileDmg: 9, r: 3, recoil: 12, shake: 1.1, life: 1.2, pierce: 1 });
        p.consumeAmmo(); Sound.bow();
      }
    },
    special: {
      cost: 45, cd: 0.5,
      use(p, game) {
        p.dashT = 0.26; p.swordMode = 0.32; p.invuln = Math.max(p.invuln, 0.3);
        p.vx = p.face * p.speed * 2.6;
        game.meleeArc(p, { range: 48, arc: 1.0, dmg: 34, tileDmg: 30, knock: 320, color: 'rgba(220,235,255,0.95)', shake: 5 });
        game.fx.text(p.cx, p.y, 'INVESTIDA!', '#9be0ff'); Sound.slash();
      }
    }
  },
];

const heroIndexByKey = k => HEROES.findIndex(h => h.key === k);

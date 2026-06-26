/* ============================================================
   world.js — destructible tile world, physics & destruction
   ============================================================ */

// material id -> definition. id 0 = empty.
const MAT = [
  null, // 0 empty
  { name: 'dirt',      hp: 22,  solid: true,  c: '#553718', c2: '#3e280f', edge: '#6a4622', soft: true, cap: 'grass', noDebris: true },
  { name: 'stone',     hp: 46,  solid: true,  c: '#48443e', c2: '#322e29', edge: '#5a554d' },
  { name: 'brick',     hp: 80,  solid: true,  c: '#6c2c20', c2: '#491c14', edge: '#863628' },
  { name: 'wood',      hp: 16,  solid: true,  c: '#67431f', c2: '#472d12', edge: '#825527' },
  { name: 'bedrock',   hp: 1e9, solid: true,  c: '#2c2a28', c2: '#201e1c', edge: '#3a3633', indestructible: true },
  { name: 'barrel',    hp: 12,  solid: true,  c: '#caa33a', c2: '#3a2a14', edge: '#e8c24f', barrel: true },
  { name: 'vault',     hp: 34,  solid: true,  c: '#caa33a', c2: '#8a6a1c', edge: '#f4d35e', gold: true },
  { name: 'cobble',    hp: 54,  solid: true,  c: '#333b44', c2: '#21262e', edge: '#47525e' },
  { name: 'sandstone', hp: 38,  solid: true,  c: '#bb9450', c2: '#947038', edge: '#d3ac66', soft: true },
  { name: 'mossy',     hp: 72,  solid: true,  c: '#3d4432', c2: '#2a3123', edge: '#516046' },
  { name: 'sand',      hp: 14,  solid: true,  c: '#ccaf5e', c2: '#a8863e', edge: '#dfc57c', soft: true, falls: true },
  { name: 'gravel',    hp: 22,  solid: true,  c: '#564e44', c2: '#3a362e', edge: '#696157', falls: true },
  { name: 'rocket',    hp: 12,  solid: true,  c: '#b1322c', c2: '#3a1410', edge: '#e0843a', rocket: true },   // launches a rocket when destroyed
  { name: 'ladder',    hp: 1e9, solid: false, c: '#6a4a28', c2: '#3a2a14', edge: '#8a6438', ladder: true, indestructible: true },
  // --- novos materiais (selva / templo) ---
  { name: 'temple',    hp: 96,  solid: true,  c: '#4c5a3a', c2: '#333f26', edge: '#677a56' },                 // 15 pedra de templo esculpida, com musgo
  { name: 'plank',     hp: 18,  solid: true,  c: '#875c2c', c2: '#5e4020', edge: '#a8783c', soft: true },     // 16 tábuas horizontais (passarelas)
  { name: 'leaf',      hp: 10,  solid: true,  c: '#256a20', c2: '#174a14', edge: '#3c8c2e', soft: true },     // 17 folhagem densa (sebe)
  { name: 'jungle',    hp: 24,  solid: true,  c: '#3d521c', c2: '#2a3a10', edge: '#527026', soft: true, cap: 'grass', noDebris: true }, // 18 terra de selva
  { name: 'darkstone', hp: 130, solid: true,  c: '#3a3e44', c2: '#26282d', edge: '#4c525a' },                 // 19 pedra escura de torre
  // === EXPANSÃO: paleta de construção (pintura genérica via "pattern") ===
  { name: 'claybrick', hp: 70,  solid: true,  c: '#883c26', c2: '#5e2c18', edge: '#a64e36', pattern: 'brick' },   // 20 tijolo de barro (casas)
  { name: 'plaster',   hp: 40,  solid: true,  c: '#cabf9a', c2: '#a89c78', edge: '#e2d8b8', pattern: 'flat' },    // 21 reboco branco
  { name: 'woodbeam',  hp: 30,  solid: true,  c: '#5a3f22', c2: '#3e2a16', edge: '#74522e', pattern: 'panel' },   // 22 viga de madeira (enxaimel)
  { name: 'roof',      hp: 30,  solid: true,  c: '#7c2920', c2: '#501814', edge: '#9e3c30', pattern: 'roof' },    // 23 telha de barro
  { name: 'thatch',    hp: 16,  solid: true,  c: '#b89a4e', c2: '#8a6e30', edge: '#d8bc6a', pattern: 'thatch', soft: true }, // 24 palha
  { name: 'limestone', hp: 84,  solid: true,  c: '#c8c2a8', c2: '#a49e84', edge: '#e4dec4', pattern: 'block' },   // 25 pedra calcária lavrada
  { name: 'marble',    hp: 100, solid: true,  c: '#d8dae2', c2: '#b0b2bc', edge: '#f2f4fa', pattern: 'block' },   // 26 mármore
  { name: 'granite',   hp: 110, solid: true,  c: '#6a6068', c2: '#4a424a', edge: '#867c84', pattern: 'flat' },    // 27 granito
  { name: 'slate',     hp: 90,  solid: true,  c: '#3e4650', c2: '#2a3038', edge: '#586470', pattern: 'tile' },    // 28 ardósia
  { name: 'metal',     hp: 150, solid: true,  c: '#7a828c', c2: '#565c64', edge: '#9aa2ac', pattern: 'plate' },   // 29 placa de aço
  { name: 'bronze',    hp: 120, solid: true,  c: '#9a6e2e', c2: '#6e4e1e', edge: '#c89a44', pattern: 'plate' },   // 30 bronze
  { name: 'rust',      hp: 60,  solid: true,  c: '#7a4a2a', c2: '#542e18', edge: '#9a6038', pattern: 'plate' },   // 31 metal enferrujado
  { name: 'tilefloor', hp: 60,  solid: true,  c: '#8a8270', c2: '#6a6252', edge: '#a8a08c', pattern: 'tile' },    // 32 piso de ladrilho
  { name: 'carpet',    hp: 24,  solid: true,  c: '#8a2230', c2: '#5e1620', edge: '#b0303e', pattern: 'flat', soft: true }, // 33 tapete
  { name: 'woodfloor', hp: 22,  solid: true,  c: '#8a6334', c2: '#5f4422', edge: '#a87c44', pattern: 'plank', soft: true }, // 34 assoalho
  { name: 'obsidian',  hp: 140, solid: true,  c: '#26222e', c2: '#16131c', edge: '#3e3848', pattern: 'flat' },    // 35 obsidiana
  { name: 'runestone', hp: 110, solid: true,  c: '#3a2c5a', c2: '#241a3c', edge: '#5a4886', pattern: 'rune', glow: '#b07bff' }, // 36 pedra rúnica
  { name: 'crystal',   hp: 50,  solid: true,  c: '#6fd0ff', c2: '#2b7fd0', edge: '#bff0ff', pattern: 'crystal', glow: '#bff0ff' }, // 37 cristal
  { name: 'bamboo',    hp: 20,  solid: true,  c: '#8a9a3a', c2: '#5e6e22', edge: '#aabf4e', pattern: 'panel', soft: true }, // 38 bambu
  { name: 'glass',     hp: 8,   solid: true,  c: '#9fd0e0', c2: '#5f96a8', edge: '#d8f4ff', pattern: 'glass', soft: true }, // 39 vidro/vitral
  { name: 'bonewall',  hp: 60,  solid: true,  c: '#cabfa0', c2: '#a89c7a', edge: '#e8e0cf', pattern: 'block' },   // 40 parede de ossos
  { name: 'mud',       hp: 18,  solid: true,  c: '#5a4226', c2: '#3e2c16', edge: '#6e5230', pattern: 'flat', soft: true, noDebris: true }, // 41 lama de selva
  // === EXPANSÃO: novos EXPLOSIVOS (cada um com um descritor `boom` próprio) ===
  // boom: { r raio, dmg dano, fire? chamas, cluster? nº de mini-explosões, warhead? míssil que corta o solo, shake? }
  { name: 'firebarrel', hp: 12, solid: true,  c: '#c2552a', c2: '#3a1a0e', edge: '#ff8a3c', boom: { r: 96,  dmg: 56, fire: true } },        // 42 barril incendiário (lança chamas)
  { name: 'clusterkeg', hp: 14, solid: true,  c: '#b8a33a', c2: '#3a3214', edge: '#ffe27a', boom: { r: 64,  dmg: 36, cluster: 5 } },       // 43 barril cacho (mini-explosões em cadeia)
  { name: 'powderkeg',  hp: 22, solid: true,  c: '#8a2a22', c2: '#2a0e0a', edge: '#e0843a', boom: { r: 158, dmg: 96, shake: 16 } },        // 44 paiol (explosão MUITO forte)
  { name: 'nitro',      hp: 4,  solid: true,  c: '#3a8a5a', c2: '#123a24', edge: '#8effb0', boom: { r: 52,  dmg: 28 } },                    // 45 nitro (fraco, mas explode a qualquer toque — hp baixíssima)
  { name: 'mortarkeg',  hp: 14, solid: true,  c: '#5a6470', c2: '#22262c', edge: '#9aa6b4', boom: { r: 40,  dmg: 26, warhead: true } },    // 46 morteiro (dispara um míssil que corta a terra na direção do herói)
  { name: 'frostbrick', hp: 70, solid: true,  c: '#8fc0d8', c2: '#4f7a90', edge: '#d8f4ff', pattern: 'ice', glow: '#bff0ff' },             // 47 tijolo gelado (textura 'ice' nova)
  // ===========================================================================
  // === GRANDE EXPANSÃO DE BLOCOS (cores/texturas) — ids 48+ ===================
  // Recebem caracteres de grid Unicode AUTOMATICAMENTE (ver bloco após CHAR2MAT),
  // então não consomem o alfabeto ASCII. APENAS ANEXE no fim (ids estáveis).
  // --- pedras coloridas (pattern flat) ---
  { name: 'redstone',    hp: 70,  solid: true, c: '#7a3a32', c2: '#4a201c', edge: '#9a4e42', pattern: 'flat' },   // 48
  { name: 'bluestone',   hp: 84,  solid: true, c: '#34465e', c2: '#20303f', edge: '#4e6a86', pattern: 'flat' },   // 49
  { name: 'greenstone',  hp: 80,  solid: true, c: '#3a5a3e', c2: '#223a26', edge: '#567a5a', pattern: 'flat' },   // 50
  { name: 'purpurite',   hp: 90,  solid: true, c: '#463a5e', c2: '#2a2440', edge: '#6a567e', pattern: 'flat' },   // 51
  { name: 'blackstone',  hp: 110, solid: true, c: '#26282c', c2: '#16181a', edge: '#3a3e44', pattern: 'flat' },   // 52
  { name: 'chalk',       hp: 60,  solid: true, c: '#cfd2cf', c2: '#a8aaa6', edge: '#eef0ec', pattern: 'flat', soft: true }, // 53
  // --- tijolos coloridos (pattern brick) ---
  { name: 'bluebrick',   hp: 80,  solid: true, c: '#3a5a8a', c2: '#22324e', edge: '#4e74aa', pattern: 'brick' },  // 54
  { name: 'greenbrick',  hp: 80,  solid: true, c: '#3a6a3a', c2: '#214020', edge: '#4e8a4a', pattern: 'brick' },  // 55
  { name: 'ivorybrick',  hp: 76,  solid: true, c: '#c2bca8', c2: '#94907e', edge: '#e2dcc8', pattern: 'brick' },  // 56
  { name: 'goldbrick',   hp: 96,  solid: true, c: '#caa33a', c2: '#8a6a1c', edge: '#f4d35e', pattern: 'brick' },  // 57
  { name: 'crimsonbrick',hp: 88,  solid: true, c: '#8a2230', c2: '#561620', edge: '#b0303e', pattern: 'brick' },  // 58
  // --- metais (pattern plate) ---
  { name: 'copper',      hp: 120, solid: true, c: '#b5712e', c2: '#7a481c', edge: '#e0934a', pattern: 'plate' },  // 59
  { name: 'silver',      hp: 130, solid: true, c: '#b8bcc4', c2: '#888c94', edge: '#e2e6ee', pattern: 'plate' },  // 60
  { name: 'steelblue',   hp: 140, solid: true, c: '#5a6e86', c2: '#3a4a5e', edge: '#7e96b2', pattern: 'plate' },  // 61
  { name: 'brassplate',  hp: 124, solid: true, c: '#b5942e', c2: '#7a601c', edge: '#e0c24a', pattern: 'plate' },  // 62
  // --- gemas/cristais (pattern crystal, com brilho) ---
  { name: 'emerald',     hp: 60,  solid: true, c: '#2ea05a', c2: '#176038', edge: '#7bffb0', pattern: 'crystal', glow: '#7bffb0' }, // 63
  { name: 'ruby',        hp: 60,  solid: true, c: '#c0304a', c2: '#7a1828', edge: '#ff7a90', pattern: 'crystal', glow: '#ff7a90' }, // 64
  { name: 'sapphire',    hp: 60,  solid: true, c: '#3a6ad0', c2: '#1e3c80', edge: '#8ab0ff', pattern: 'crystal', glow: '#8ab0ff' }, // 65
  { name: 'amethyst',    hp: 60,  solid: true, c: '#9a5ad0', c2: '#5e3080', edge: '#d0a8ff', pattern: 'crystal', glow: '#d0a8ff' }, // 66
  { name: 'topaz',       hp: 60,  solid: true, c: '#d0a83a', c2: '#806020', edge: '#ffe89a', pattern: 'crystal', glow: '#ffe89a' }, // 67
  { name: 'onyxgem',     hp: 120, solid: true, c: '#2a2630', c2: '#16131c', edge: '#5a5466', pattern: 'crystal', glow: '#7a6a9a' }, // 68
  // --- fogo/gelo/orgânico ---
  { name: 'magma',       hp: 90,  solid: true, c: '#3a1410', c2: '#1a0805', edge: '#ff7a2c', pattern: 'lava', glow: '#ff7a2c' },    // 69
  { name: 'emberstone',  hp: 80,  solid: true, c: '#4a2418', c2: '#20100a', edge: '#ffb24a', pattern: 'lava', glow: '#ffae3c' },    // 70
  { name: 'snow',        hp: 14,  solid: true, c: '#e8eef4', c2: '#c0c8d2', edge: '#ffffff', pattern: 'flat', soft: true, falls: true }, // 71
  { name: 'glacier',     hp: 80,  solid: true, c: '#9fd8e8', c2: '#5f96a8', edge: '#d8f4ff', pattern: 'ice', glow: '#bff0ff' },     // 72
  { name: 'permafrost',  hp: 110, solid: true, c: '#7fb0c8', c2: '#4a7088', edge: '#bfe8ff', pattern: 'ice' },                      // 73
  { name: 'ashstone',    hp: 60,  solid: true, c: '#4a4642', c2: '#2e2c2a', edge: '#6a6660', pattern: 'flat', soft: true },         // 74
  { name: 'swampmud',    hp: 18,  solid: true, c: '#3a4a2a', c2: '#243018', edge: '#56683a', pattern: 'dots', soft: true, noDebris: true }, // 75
  { name: 'slimeblock',  hp: 24,  solid: true, c: '#3a8a4a', c2: '#1f5a2a', edge: '#8eff6a', pattern: 'dots', glow: '#8eff6a', soft: true }, // 76
  { name: 'coral',       hp: 40,  solid: true, c: '#c0506a', c2: '#7a2c40', edge: '#ff90a0', pattern: 'scale', soft: true },        // 77
  { name: 'scalestone',  hp: 90,  solid: true, c: '#5a6a4a', c2: '#3a4630', edge: '#7e9068', pattern: 'scale' },                    // 78
  { name: 'dragonhide',  hp: 100, solid: true, c: '#6a2a2a', c2: '#401414', edge: '#a04040', pattern: 'scale' },                    // 79
  // --- arcano/colmeia/tech ---
  { name: 'honeycomb',   hp: 40,  solid: true, c: '#caa33a', c2: '#8a6a1c', edge: '#ffe27a', pattern: 'hex', glow: '#ffd86b' },     // 80
  { name: 'hexsteel',    hp: 140, solid: true, c: '#5a626c', c2: '#3a4048', edge: '#8a929c', pattern: 'hex' },                      // 81
  { name: 'voidstone',   hp: 130, solid: true, c: '#1a1426', c2: '#0c0812', edge: '#3a2c5a', pattern: 'flat', glow: '#6a3aaa' },    // 82
  { name: 'runeplate',   hp: 120, solid: true, c: '#1e2a2a', c2: '#0e1414', edge: '#4effd0', pattern: 'circuit', glow: '#4effd0' }, // 83
  { name: 'arcanetech',  hp: 110, solid: true, c: '#241a3c', c2: '#140e22', edge: '#b07bff', pattern: 'circuit', glow: '#b07bff' }, // 84
  { name: 'bonebrick2',  hp: 70,  solid: true, c: '#cabfa0', c2: '#a89c7a', edge: '#e8e0cf', pattern: 'block' },                    // 85
  { name: 'fleshwall',   hp: 50,  solid: true, c: '#8a3a3a', c2: '#561e1e', edge: '#c05a5a', pattern: 'dots', soft: true },         // 86
  // --- pisos/tapetes/madeiras decorativas ---
  { name: 'checkerfloor',hp: 60,  solid: true, c: '#e8e0cf', c2: '#2a2622', edge: '#f4eeda', pattern: 'tile' },                     // 87
  { name: 'redcarpet',   hp: 24,  solid: true, c: '#8a2230', c2: '#5e1620', edge: '#b0303e', pattern: 'weave', soft: true },        // 88
  { name: 'bluecarpet',  hp: 24,  solid: true, c: '#2a3a8a', c2: '#18224e', edge: '#4a5ab0', pattern: 'weave', soft: true },        // 89
  { name: 'wovenmat',    hp: 22,  solid: true, c: '#8a6e3a', c2: '#5e4a24', edge: '#b09050', pattern: 'weave', soft: true },        // 90
  { name: 'herringwood', hp: 24,  solid: true, c: '#8a6334', c2: '#5f4422', edge: '#a87c44', pattern: 'plank', soft: true },        // 91
  { name: 'ebonywood',   hp: 40,  solid: true, c: '#2e2620', c2: '#1a1510', edge: '#4a3e34', pattern: 'plank', soft: true },        // 92
  { name: 'roseglass',   hp: 10,  solid: true, c: '#c05a8a', c2: '#7a3050', edge: '#ff9ac0', pattern: 'glass', soft: true },        // 93
  { name: 'greenglass',  hp: 10,  solid: true, c: '#4a9a6a', c2: '#2a6040', edge: '#8effb0', pattern: 'glass', soft: true },        // 94
  { name: 'goldvein',    hp: 120, solid: true, c: '#6a5a2a', c2: '#3a3014', edge: '#caa33a', pattern: 'block', glow: '#caa33a' },   // 95
];
// char -> material id (used by level loader)
const CHAR2MAT = {
  '#': 2, 'D': 1, 'B': 3, '=': 4, '~': 5, 'X': 6, '$': 7, 'C': 8, 'S': 9, 'm': 10, 'A': 11, 'R': 12, 'K': 13, 'h': 14, 'p': 15, 'l': 16, 'v': 17, 'j': 18, 'k': 19,
  'b': 20, 'g': 21, 'e': 22, '^': 23, ',': 24, 'c': 25, 'a': 26, 'i': 27, 'n': 28, 'q': 29, 'u': 30, 'x': 31, 'y': 32, '%': 33, '&': 34, '*': 35, '+': 36, '<': 37, '>': 38, '?': 39, '!': 40, '@': 41,
  '(': 42, ')': 43, '/': 44, '-': 45, '0': 46,   // novos explosivos: barril ígneo, cacho, paiol, nitro, morteiro
  ']': 47,                                        // tijolo gelado
};
// AUTO-ATRIBUIÇÃO de caracteres de grid p/ os materiais novos (ids 48+): o alfabeto
// ASCII acabou, então usamos chars Unicode BMP de 1 unidade (Latin-1/Extended), que
// o formato de grid (1 char/célula) suporta sem qualquer mudança estrutural — editor,
// prefabs, masmorras, galeria e criações salvas passam a aceitá-los automaticamente.
// É DETERMINÍSTICO e estável: só anexe materiais no fim de MAT (nunca insira no meio),
// senão os ids/chars deslocam e quebram criações salvas antigas.
(function () {
  let pool = '';
  for (let cp = 0x00C0; cp <= 0x024F; cp++) { if (cp === 0x00D7 || cp === 0x00F7) continue; pool += String.fromCharCode(cp); } // ~140 chars (evita × ÷)
  const used = new Set(Object.keys(CHAR2MAT));
  const hasChar = id => { for (const k in CHAR2MAT) if (CHAR2MAT[k] === id) return true; return false; };
  let pi = 0;
  for (let id = 1; id < MAT.length; id++) {
    if (!MAT[id] || hasChar(id)) continue;                 // pula vazios e os que já têm char ASCII
    while (pi < pool.length && used.has(pool[pi])) pi++;
    const ch = pool[pi++]; if (!ch) break;
    CHAR2MAT[ch] = id; used.add(ch);
  }
})();
// decor char -> type (shared by the level loader, buildings and the gallery)
const DECOR_CHARS = {
  't': 'torch', 'L': 'banner', 'N': 'window', 'I': 'pillar', 'V': 'vines', 'Y': 'web', 'G': 'grass', 'J': 'bars', 'U': 'rack', 'M': 'crate',
  'W': 'lantern', '[': 'chain', ':': 'candle', ';': 'cauldron', '"': 'bookshelf', "'": 'bed', '|': 'table', 'Z': 'idol', '_': 'sign', '}': 'flower', '{': 'shield',
  's': 'door',
};

/* a single tile detached by gravity, falling until it lands & re-deposits */
class FallingBlock {
  constructor(c, r, id, world) {
    this.T = world.T; this.x = c * this.T; this.y = r * this.T; this.id = id; this.world = world;
    this.vy = 0; this.alive = true; this.hit = null;
  }
  update(dt, game) {
    const T = this.T, w = this.world;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    const ny = this.y + this.vy * dt;
    const c = Math.floor((this.x + T / 2) / T);
    const belowRow = Math.floor((ny + T) / T);
    // crush whatever it falls onto
    if (this.vy > 250) {
      const box = { x: this.x + 2, y: this.y, w: T - 4, h: T };
      if (game.player && !game.player.dead && aabb(box, game.player)) { if (this.hit !== 'p') { game.player.hurt(14, 0, game); this.hit = 'p'; } }
      for (const e of game.enemies) if (e.alive && aabb(box, e)) e.hurt(16, 0, game);
    }
    if (belowRow >= w.rows || w.solid(c, belowRow)) {
      const restRow = belowRow - 1;
      this.alive = false;
      if (restRow >= 0 && !w.solid(c, restRow)) {
        w.set(c, restRow, this.id);
        w.maybeFall(c, restRow - 1);   // anything stacked above now follows
      } else {
        game.fx.debrisBurst(this.x + T / 2, this.y + T / 2, MAT[this.id].c2, 90);
      }
      game.fx.chips(this.x + T / 2, this.y + T / 2, MAT[this.id].c, 5);
      game.cam.addShake(2); Sound.crumble();
    } else {
      this.y = ny;
    }
  }
  draw(ctx, cam) {
    const img = TEX.tiles[this.id] && TEX.tiles[this.id][0];
    const x = Math.round(this.x + cam.ox), y = Math.round(this.y + cam.oy);
    if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = MAT[this.id].c; ctx.fillRect(x, y, this.T, this.T); }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + this.T - 3, this.T, 3);
  }
}

class World {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.T = CONFIG.TILE;
    this.pixelW = cols * this.T;
    this.pixelH = rows * this.T;
    this.mat = new Uint8Array(cols * rows);   // material id (solid/collidable layer)
    this.bg = new Uint8Array(cols * rows);    // background-fill layer (interiors/tunnels; non-collidable, drawn darker behind)
    this.grass = new Uint8Array(cols * rows); // grass-cap flag: only the ORIGINAL surface layer grows grass (Minecraft-like)
    this.hp = new Int32Array(cols * rows);    // current hp
    this.fallers = [];                        // active FallingBlocks
    this.game = null;                         // set by Game
  }
  setBg(c, r, id) { if (this.inBounds(c, r)) this.bg[this.idx(c, r)] = id; }
  bgAt(c, r) { return this.inBounds(c, r) ? this.bg[this.idx(c, r)] : 0; }
  // when a destructible (non-gravity) tile is removed, leave a painted "fundo" behind it,
  // showing that a structure stood there (just like building interiors already do).
  _ghostBg(c, r, id) {
    if (!this.inBounds(c, r)) return;
    const i = this.idx(c, r);
    if (this.bg[i]) return;              // an interior fill is already painted here
    const m = MAT[id];
    if (!m || m.falls) return;           // gravity blocks (sand/gravel) leave no ghost
    if (m.barrel || m.rocket) {          // bombs leave no block of their own behind —
      const nb = this.bgAt(c - 1, r) || this.bgAt(c + 1, r) || this.bgAt(c, r - 1) || this.bgAt(c, r + 1);
      if (nb) this.bg[i] = nb;           // inherit the surrounding interior shade, or none if outdoors
      return;
    }
    this.bg[i] = id;
  }
  // mark every tile that is currently a sun-exposed earth surface as "grassy".
  // Dirt later uncovered by digging/destruction is NOT marked → never grows grass.
  markGrass() {
    for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.rows; r++) {
      const id = this.at(c, r);
      if (id && MAT[id] && MAT[id].cap === 'grass' && !this.solid(c, r - 1)) this.grass[this.idx(c, r)] = 1;
    }
  }
  // detach a gravity-affected tile (and cascade upward) when unsupported
  maybeFall(c, r) {
    if (!this.inBounds(c, r) || this.fallers.length > 400) return;
    const id = this.at(c, r);
    if (!id || !MAT[id].falls || this.solid(c, r + 1)) return;
    this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0;
    this.fallers.push(new FallingBlock(c, r, id, this));
    this.maybeFall(c, r - 1);
  }
  updateFallers(dt, game) {
    for (const f of this.fallers) f.update(dt, game);
    if (this.fallers.length) this.fallers = this.fallers.filter(f => f.alive);
  }
  // instantly drop any unsupported gravity tiles to their resting cell (level build)
  settle() {
    for (let c = 0; c < this.cols; c++) for (let r = this.rows - 1; r >= 0; r--) {
      const id = this.at(c, r);
      if (!id || !MAT[id].falls || this.solid(c, r + 1)) continue;
      let rr = r; while (rr + 1 < this.rows && !this.solid(c, rr + 1)) rr++;
      if (rr !== r) { this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0; this.mat[this.idx(c, rr)] = id; this.hp[this.idx(c, rr)] = MAT[id].hp; }
    }
  }
  idx(c, r) { return r * this.cols + c; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }

  set(c, r, id) {
    if (!this.inBounds(c, r)) return;
    const i = this.idx(c, r);
    this.mat[i] = id;
    this.hp[i] = id ? MAT[id].hp : 0;
  }
  at(c, r) { return this.inBounds(c, r) ? this.mat[this.idx(c, r)] : 2; } // OOB = solid wall
  solid(c, r) { const m = this.at(c, r); return m !== 0 && MAT[m] && MAT[m].solid; }
  solidPx(x, y) { return this.solid(Math.floor(x / this.T), Math.floor(y / this.T)); }
  ladderAt(x, y) { const m = this.at(Math.floor(x / this.T), Math.floor(y / this.T)); return m && MAT[m] && MAT[m].ladder; }

  // ---- destruction ------------------------------------------
  // returns true if tile was destroyed this call
  damage(c, r, dmg, opts = {}) {
    if (!this.inBounds(c, r)) return false;
    const i = this.idx(c, r); const id = this.mat[i];
    if (!id) return false;
    const m = MAT[id];
    if (m.indestructible) { if (this.game) this.game.fx.spark(c * this.T + 14, r * this.T + 14, m.edge, 2); return false; }
    this.hp[i] -= dmg;
    if (this.game) {
      Sound.crumble();
      if (!m.noDebris) this.game.fx.chips(c * this.T + 14, r * this.T + 14, m.c, 2);
    }
    if (this.hp[i] <= 0) {
      this.mat[i] = 0; this.hp[i] = 0;
      this._ghostBg(c, r, id);                                     // leave a painted background where the block stood
      if (this.game) {
        const T = this.T;
        // mini-block crumbs (≈1/10 of a tile) that fall with gravity and settle on the ground.
        // Earth-type blocks (dirt, jungle, mud) drop no crumbs.
        if (!m.noDebris) this.game.fx.crumbsBurst(c * T + T / 2, r * T + T / 2, m, opts.power || 70);
        this.game.fx.smoke(c * T + T / 2, r * T + T / 2, 2, 'rgba(120,110,95,');
        if (m.gold) { this.game.fx.spark(c * T + 14, r * T + 14, '#ffe27a', 8); this.game.spawnOregano(c * T + T / 2, r * T + T / 2, 1 + (Math.random() * 2 | 0)); }
      }
      if (m.barrel && !opts.noBarrelChain) {
        // chained explosion (queued to avoid deep recursion)
        if (this.game) this.game.queueExplosion(c * this.T + this.T / 2, r * this.T + this.T / 2, 86, 64);
      }
      if (m.rocket && this.game) {  // launch a rocket toward the player
        const px = c * this.T + this.T / 2, py = r * this.T + this.T / 2;
        const dir = this.game.player ? sign(this.game.player.cx - px) || 1 : 1;
        this.game.spawnRocket(px, py, dir);
        this.game.queueExplosion(px, py, 44, 30);
      }
      // novos explosivos: descritor `boom` (ígneo, cacho, paiol, nitro, morteiro).
      // É enfileirado (processado no próximo frame) → encadeia sem recursão profunda.
      if (m.boom && this.game) {
        const px = c * this.T + this.T / 2, py = r * this.T + this.T / 2;
        this.game.explosionQ.push({ x: px, y: py, r: m.boom.r, dmg: m.boom.dmg, boom: m.boom });
      }
      this.maybeFall(c, r - 1);  // unsupported gravity blocks above collapse
      return true;
    }
    return false;
  }

  // big radial explosion: damages tiles + entities, debris, cave-in
  explode(x, y, radius, dmg) {
    const T = this.T;
    const c0 = Math.floor((x - radius) / T), c1 = Math.floor((x + radius) / T);
    const r0 = Math.floor((y - radius) / T), r1 = Math.floor((y + radius) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cx = c * T + T / 2, cy = r * T + T / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d <= radius) this.damage(c, r, dmg * (1 - d / radius) + 14, { power: 140, noBarrelChain: false });
    }
    this._caveIn(c0 - 1, c1 + 1, r0 - 2, r1 + 1);
    if (this.game) {
      this.game.fx.explosion(x, y, radius);
      this.game.cam.addShake(radius * 0.18);
      Sound.explode();
      this.game.damageEntitiesRadial(x, y, radius * 1.05, dmg);
    }
  }

  // lightweight cave-in: soft tiles with nothing beneath crumble into debris
  _caveIn(c0, c1, r0, r1) {
    c0 = Math.max(0, c0); r0 = Math.max(0, r0);
    c1 = Math.min(this.cols - 1, c1); r1 = Math.min(this.rows - 1, r1);
    for (let pass = 0; pass < 2; pass++) {
      for (let r = r1; r >= r0; r--) for (let c = c0; c <= c1; c++) {
        const id = this.at(c, r);
        if (!id || !MAT[id].soft) continue;
        if (!this.solid(c, r + 1) && r + 1 < this.rows) {
          this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0;
          this._ghostBg(c, r, id);
          if (this.game && !MAT[id].noDebris) this.game.fx.crumbsBurst(c * this.T + 14, r * this.T + 14, MAT[id], 50);
          this.maybeFall(c, r - 1);
        }
      }
    }
  }

  // auto step-up over a 1-tile ledge/obstacle (smooth ground traversal)
  _tryStep(e, col) {
    const T = this.T;
    const feetRow = Math.floor((e.y + e.h - 1) / T);
    if (!this.solid(col, feetRow) || this.solid(col, feetRow - 1)) return false; // must be a single-tile step
    if ((e.y + e.h) - feetRow * T > T + 3) return false;                         // feet must be near the ledge top
    const newY = feetRow * T - e.h;
    const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 1) / T);
    const nr0 = Math.floor(newY / T), nr1 = feetRow - 1;
    for (let c = c0; c <= c1; c++) for (let r = nr0; r <= nr1; r++) if (this.solid(c, r)) return false; // headroom
    e.y = newY; return true;
  }

  // ---- physics: move entity, resolve vs solid tiles ----------
  moveAndCollide(e, dt) {
    const T = this.T;
    e.onGround = false; e.hitWall = 0; e.hitCeil = false;

    // ---- X axis ----
    e.x += e.vx * dt;
    let r0 = Math.floor(e.y / T), r1 = Math.floor((e.y + e.h - 1) / T);
    if (e.vx > 0) {
      const col = Math.floor((e.x + e.w) / T);
      let hit = false; for (let r = r0; r <= r1; r++) if (this.solid(col, r)) { hit = true; break; }
      if (hit && !(e.canStep !== false && this._tryStep(e, col))) { e.x = col * T - e.w; e.vx = 0; e.hitWall = 1; }
    } else if (e.vx < 0) {
      const col = Math.floor(e.x / T);
      let hit = false; for (let r = r0; r <= r1; r++) if (this.solid(col, r)) { hit = true; break; }
      if (hit && !(e.canStep !== false && this._tryStep(e, col))) { e.x = (col + 1) * T; e.vx = 0; e.hitWall = -1; }
    }

    // ---- Y axis ----
    e.y += e.vy * dt;
    let c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 1) / T);
    if (e.vy > 0) {
      const row = Math.floor((e.y + e.h) / T);
      for (let c = c0; c <= c1; c++) if (this.solid(c, row)) { e.y = row * T - e.h; e.vy = 0; e.onGround = true; break; }
    } else if (e.vy < 0) {
      const row = Math.floor(e.y / T);
      for (let c = c0; c <= c1; c++) if (this.solid(c, row)) { e.y = (row + 1) * T; e.vy = 0; e.hitCeil = true; break; }
    }
    // keep inside world horizontally
    if (e.x < 0) { e.x = 0; e.vx = Math.max(0, e.vx); }
    if (e.x + e.w > this.pixelW) { e.x = this.pixelW - e.w; e.vx = Math.min(0, e.vx); }
  }

  // ---- render -----------------------------------------------
  // opts (editor only): { front, back } — restrict which layers are drawn.
  // Defaults to drawing both (normal gameplay).
  draw(ctx, cam, opts) {
    if (!TEX.ready) TEX.build();
    const showFront = !opts || opts.front !== false;
    const showBack = !opts || opts.back !== false;
    const T = this.T;
    const c0 = Math.max(0, Math.floor(cam.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((cam.x + cam.vw) / T) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((cam.y + cam.vh) / T) + 1);
    const ox = cam.ox, oy = cam.oy;
    // ---- background-fill layer (building interiors, tunnel walls): darker, behind solids ----
    if (showBack) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = this.idx(c, r); const bid = this.bg[i];
      // a SOLID front tile covers it (unless the front layer is hidden — editor "Fundo only" view)
      if (!bid || (showFront && this.mat[i] && MAT[this.mat[i]] && MAT[this.mat[i]].solid)) continue;
      const x = Math.round(c * T + ox), y = Math.round(r * T + oy);
      const variant = ((c * 2 + r * 3) % TEX.V + TEX.V) % TEX.V;
      const img = TEX.tiles[bid] && TEX.tiles[bid][variant];
      if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = MAT[bid].c; ctx.fillRect(x, y, T, T); }
      ctx.fillStyle = 'rgba(8,8,14,0.52)'; ctx.fillRect(x, y, T, T);   // recess into shadow
      // inner-edge shading where the interior meets open air / floors (depth)
      if (!this.bg[this.idx(c, r - 1)] && !this.solid(c, r - 1)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y, T, 4); }
    }
    if (showFront) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = this.idx(c, r); const id = this.mat[i];
      if (!id) continue;
      const m = MAT[id];
      const x = Math.round(c * T + ox), y = Math.round(r * T + oy);
      const variant = ((c * 2 + r * 3) % TEX.V + TEX.V) % TEX.V;
      const img = TEX.tiles[id] && TEX.tiles[id][variant];
      if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = m.c; ctx.fillRect(x, y, T, T); }
      if (!m.solid) continue;   // ladders & other non-solid props: no block shading/cracks
      const openAbove = !this.solid(c, r - 1);
      // shade neighbours that face open space for depth
      if (openAbove) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, T, 2); }
      if (!this.solid(c, r + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(x, y + T - 3, T, 3); }
      // grass cap on exposed earth — ONLY on the original surface layer (this.grass flag),
      // so dirt uncovered by digging stays bare dirt (Minecraft-style).
      if (openAbove && m.cap === 'grass' && this.grass[i]) {
        ctx.fillStyle = '#356a22'; ctx.fillRect(x, y, T, 4);
        ctx.fillStyle = '#478c2e';
        for (let k = 0; k < T; k += 5) ctx.fillRect(x + k, y - 2 - ((c + k) % 2), 3, 4);
      }
      // damage cracks
      const frac = this.hp[i] / m.hp;
      if (!m.indestructible && frac < 0.6) {
        ctx.strokeStyle = 'rgba(0,0,0,' + (0.55 * (1 - frac)) + ')';
        ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 12, y + 14); ctx.lineTo(x + 8, y + T - 4);
        if (frac < 0.3) { ctx.moveTo(x + T - 6, y + 6); ctx.lineTo(x + T - 14, y + 16); }
        ctx.stroke();
      }
    }
    for (const f of this.fallers) if (cam.visible(f.x, f.y, T, T)) f.draw(ctx, cam);
  }
}

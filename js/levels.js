/* ============================================================
   levels.js — Oddyssey Chronicles campaign.
   Cada fase agora segue um ESCOPO MAIS COMPACTO na horizontal
   (~70% do tamanho antigo) porém com uma grande REDE DE TÚNEIS
   subterrânea (dungeon de até 3 andares) escavada na terra
   espessa: corredores conectando câmaras temáticas, tesouros
   (orégano/tokens) e monstros espalhados. A superfície contínua
   continua sendo a rota garantida até a saída; o subsolo é a
   verdadeira exploração.  (Rede gerada por dungeons.js.)

   Legend: terrain # D B = ~ C S m  X barril K foguete $ tesouro
           A sand R gravel  h ESCADA(climb)  l tábua  v folhagem
           decor t L N I V Y G J U M W [ : ; " ' | Z _ } {
           oregano o  potion Q  token T  life H
           enemies z zombie w werewolf f wolf F direwolf r dragonman d demon O boss
           P start  E exit
   ============================================================ */

const LEVELS = (function () {
  const mul = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const blank = (W, H) => { const g = []; for (let r = 0; r < H; r++) g.push(new Array(W).fill('.')); return g; };
  const put = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch; };
  const air = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length && g[r][c] === '.') g[r][c] = ch; };
  const hline = (g, r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) put(g, c, r, ch); };
  const vline = (g, c, r0, r1, ch) => { for (let r = r0; r <= r1; r++) put(g, c, r, ch); };
  const rect = (g, c0, r0, w, h, ch) => { for (let r = r0; r < r0 + h; r++) hline(g, r, c0, c0 + w - 1, ch); };
  const toRows = g => g.map(a => a.join(''));

  // limita o LOOT colhível da fase: no máx. `oreganoMax` orégano ('o') e `tokenMax`
  // tokens ('T'). Remove o excedente aleatoriamente; garante ao menos 1 token.
  function capLoot(g, oreganoMax, tokenMax) {
    const ore = [], tok = [];
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
      const ch = g[r][c]; if (ch === 'o') ore.push([c, r]); else if (ch === 'T') tok.push([c, r]);
    }
    if (tok.length === 0 && ore.length) { const i = (Math.random() * ore.length) | 0; const p = ore.splice(i, 1)[0]; g[p[1]][p[0]] = 'T'; tok.push(p); }
    const trim = (list, max) => {
      for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = list[i]; list[i] = list[j]; list[j] = t; }
      for (let i = max; i < list.length; i++) { const p = list[i]; g[p[1]][p[0]] = '.'; }
    };
    trim(tok, tokenMax); trim(ore, oreganoMax);
  }

  // ---- camada de fundo (interiores de construções e túneis) ----
  let CUR_BG = null;
  const bgPut = (c, r, ch) => { if (CUR_BG && r >= 0 && r < CUR_BG.length && c >= 0 && c < CUR_BG[0].length) CUR_BG[r][c] = ch; };
  const bgRect = (c0, r0, w, h, ch) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) bgPut(c, r, ch); };

  // base de terra ESPESSA (≈ depth tiles abaixo da superfície) p/ caber a dungeon
  function rollingGround(g, W, H, matFn, amp, seed, pits, depth) {
    depth = depth || 48;
    const surf = H - depth;
    const top = new Array(W), rng = mul(seed); let gr = surf, target = gr;
    for (let c = 0; c < W; c++) {
      if (c % 6 === 0) target = Math.max(surf - 6, Math.min(surf + 6, Math.round(surf - (Math.sin(c * 0.045 + seed) * amp + Math.sin(c * 0.12) * amp * 0.5 + (rng() * 2 - 1) * 1.1))));
      if (gr < target) gr++; else if (gr > target) gr--;
      top[c] = gr;
      for (let r = gr; r < H - 2; r++) put(g, c, r, matFn(r - gr));
      put(g, c, H - 2, '~'); put(g, c, H - 1, '~');
    }
    (pits || []).forEach(([c, w]) => { for (let r = 0; r < H; r++) for (let k = 0; k < w; k++) put(g, c + k, r, '.'); });
    return top;
  }
  function platform(g, c, r, w, mat) { hline(g, r, c, c + w - 1, mat); }
  function ladder(g, c, r0, r1) { for (let r = r0; r <= r1; r++) put(g, c, r, 'h'); }
  function startCliff(g, S, mat) { const r = S(8) - 8; rect(g, 0, r, 13, 2, mat); for (let i = 0; i < 13; i += 3) put(g, i, r - 1, mat); put(g, 2, r - 1, 't'); ladder(g, 6, r + 1, S(6) - 1); return r; }
  const coinAt = (g, c, r) => air(g, c, r, 'o');
  function barrels(g, S, cols, ch) { (cols || []).forEach(c => { put(g, c, S(c) - 1, ch || 'X'); put(g, c + 1, S(c) - 1, ch || 'X'); }); }
  const enemies = (g, S, cols, ch) => (cols || []).forEach(c => put(g, c, S(c) - 1, ch));
  const enemiesAt = (g, cols, r, ch) => cols.forEach(c => put(g, c, r, ch));

  // construção de superfície (vários andares; vão de passagem embaixo)
  function building(g, S, c0, w, floors, fh, mat, content, o) {
    o = o || {}; const baseR = S(c0), lc = c0 + 1, topR = baseR - floors * fh;
    const bgm = o.bgMat || mat;
    bgRect(c0, topR, w, baseR - topR, bgm);
    vline(g, c0, topR, baseR - 3, mat); vline(g, c0 + w - 1, topR, baseR - 3, mat);
    hline(g, topR, c0, c0 + w - 1, mat); for (let i = 0; i < w; i += 3) put(g, c0 + i, topR - 1, mat);
    for (let f = 1; f <= floors; f++) {
      const fr = baseR - f * fh;
      hline(g, fr, c0, c0 + w - 1, mat); hline(g, fr + 1, c0, c0 + w - 1, mat);
      put(g, lc, fr, '.'); put(g, lc, fr + 1, '.');
      put(g, c0 + (w >> 1), fr - 2, 'N');
      air(g, c0 + 2, fr - 1, f % 2 ? 'V' : '.');
      if (content) content(g, fr, f, c0, w, lc);
    }
    ladder(g, lc, topR + 1, baseR - 1);
    if (o.banner) put(g, c0 + (w >> 1) - 2, topR + 1, 'L');
    air(g, c0 + 1, topR, 'V'); air(g, c0 + w - 2, topR, 'V');
    put(g, c0 + 2, baseR - 4, 't');
  }
  const prison = loot => (g, fr, f, c0, w, lc) => {
    for (let c = c0 + 2; c < c0 + w - 1; c++) if (c !== lc && c !== lc + 1) put(g, c, fr - 2, 'J');
    put(g, c0 + 3, fr - 1, f === 1 ? 'T' : (f % 2 ? 'Q' : loot || 'o'));
    coinAt(g, c0 + w - 3, fr - 1);
  };
  const arsenal = (g, fr, f, c0, w, lc) => {
    put(g, c0 + 3, fr - 1, 'U'); put(g, c0 + w - 3, fr - 1, 'U');
    put(g, c0 + 4, fr - 1, f % 2 ? 'X' : 'K'); put(g, c0 + w - 4, fr - 1, f % 2 ? 'K' : 'X');
    put(g, c0 + (w >> 1) + 1, fr - 1, 'M');
  };
  const barracks = mob => (g, fr, f, c0, w, lc) => {
    enemiesAt(g, [c0 + 3, c0 + w - 3], fr - 1, mob || 'z'); put(g, c0 + (w >> 1) + 1, fr - 1, 'M');
    if (f === 1) put(g, c0 + w - 4, fr - 1, 'X');
  };
  function grnd(g, S) { for (let c = 6; c < g[0].length - 6; c += 5) coinAt(g, c, S(c) - 2); for (let c = 3; c < g[0].length - 3; c += 7) air(g, c, S(c) - 1, 'G'); }

  // ============ TEMPLATE de fase: superfície compacta + GRANDE DUNGEON ============
  function mk(cfg) {
    const W = cfg.W, H = 92, g = blank(W, H), bg = blank(W, H); CUR_BG = bg;
    const top = rollingGround(g, W, H, cfg.matFn, cfg.amp, cfg.seed, cfg.pits, 46);
    const S = c => top[c]; const startR = startCliff(g, S, cfg.cliff);
    (cfg.builds || []).forEach(b => building(g, S, b.c, b.w, b.f, 5, cfg.wall, b.content, b.o || {}));
    if (cfg.extra) cfg.extra(g, S, W, top);
    grnd(g, S);
    barrels(g, S, cfg.bx, 'X'); barrels(g, S, cfg.bk, 'K');
    (cfg.enem || []).forEach(e => enemies(g, S, e.cols, e.ch));
    (cfg.surfMobs || []).forEach(([c, ch]) => put(g, c, S(c) - 1, ch));
    (cfg.loot || []).forEach(l => put(g, l.c, S(l.c) - (l.up || 1), l.ch));
    // ===== GRANDE REDE DE TÚNEIS SUBTERRÂNEA =====
    const d = cfg.dun; let baseSurf = 0;
    for (let c = d.c0; c < d.c0 + d.w; c++) baseSurf = Math.max(baseSurf, S(c));
    carveDungeon(g, bg, d.c0, baseSurf, {
      w: d.w, seed: cfg.seed * 3 + 17, bg: d.bg, floors: 3,
      rooms: d.rooms, entrances: d.ent || 3, mob: d.mob, surfAt: S, cap: 3,
    });
    if (cfg.keep) cfg.keep(g, S, W, rect, hline, vline, ladder, put);
    capLoot(g, cfg.oregano || 40, cfg.tokens || 1);   // limita orégano/tokens colhíveis na fase
    put(g, 4, startR - 1, 'P');
    const ex = cfg.exit || (W - 5); put(g, ex, S(ex) - 1, 'E');
    return { name: cfg.name, sub: cfg.sub, win: cfg.keep ? 'boss' : 'exit', biome: cfg.biome, sky: cfg.sky, bannerColor: cfg.banner, rows: toRows(g), bg: toRows(bg), surface: top.slice() };
  }

  // ===================== CAMPANHA ============================
  const CAMPAIGN = [
    mk({
      name: 'PORTÃO DE FERRO', sub: 'Tome a base e desça às masmorras do castelo: 3 andares de túneis.',
      oregano: 25, tokens: 1,
      biome: 'castle', sky: ['#1e2740', '#080a14'], banner: '#6a1a1a',
      W: 252, amp: 6, seed: 3, cliff: 'B', wall: 'B',
      matFn: d => d < 8 ? 'D' : '#', pits: [[105, 2], [180, 2]],
      builds: [
        { c: 30, w: 13, f: 3, content: barracks('z'), o: { banner: true } },
        { c: 110, w: 14, f: 3, content: prison('Q'), o: { banner: true } },
        { c: 192, w: 14, f: 4, content: arsenal, o: { banner: true } },
      ],
      bx: [50, 150, 210], bk: [80, 168, 232],
      enem: [{ cols: [24, 70, 160, 235], ch: 'z' }, { cols: [50, 140], ch: 'w' }, { cols: [90, 200], ch: 'f' }, { cols: [120], ch: 'r' }],
      surfMobs: [[175, 'F']], loot: [{ c: 60, ch: 'H' }],
      dun: { c0: 18, w: 216, bg: 'B', rooms: ['cell', 'vault', 'crypt', 'powder', 'grotto'], ent: 3, mob: ['z', 'z', 'f', 'r'] },
    }),
    mk({
      name: 'VILA DOS LAMENTOS', sub: 'Casas saqueadas e, sob elas, catacumbas e tocas em três níveis.',
      oregano: 40, tokens: 1,
      biome: 'village', sky: ['#3a2e26', '#100a08'], banner: '#5a1e34',
      W: 260, amp: 7, seed: 7, cliff: 'S', wall: 'S',
      matFn: d => d < 2 ? 'D' : 'S', pits: [[112, 2], [186, 2]],
      builds: [
        { c: 30, w: 12, f: 2, content: barracks('z') },
        { c: 110, w: 14, f: 3, content: prison('o'), o: { banner: true } },
        { c: 200, w: 13, f: 2, content: arsenal },
      ],
      bx: [50, 150, 230], bk: [90, 190],
      enem: [{ cols: [24, 70, 150, 240], ch: 'z' }, { cols: [110, 205], ch: 'w' }, { cols: [80, 180], ch: 'f' }, { cols: [130], ch: 'r' }],
      surfMobs: [[250, 'F']], loot: [{ c: 60, ch: 'H' }, { c: 230, ch: '$' }],
      dun: { c0: 18, w: 224, bg: 'D', rooms: ['crypt', 'cell', 'den', 'vault'], ent: 3, mob: ['z', 'f', 'w', 'r'] },
    }),
    mk({
      name: 'CATACUMBAS PROFUNDAS', sub: 'Uma necrópole de três andares: celas, santuários e a matilha.',
      oregano: 55, tokens: 2,
      biome: 'dungeon', sky: ['#14101c', '#060409'], banner: '#2a1e44',
      W: 250, amp: 8, seed: 13, cliff: 'C', wall: 'C',
      matFn: d => d < 1 ? 'C' : (d % 4 === 3 ? 'm' : 'C'), pits: [[84, 2], [200, 2]],
      builds: [
        { c: 34, w: 14, f: 3, content: prison('o') },
        { c: 140, w: 16, f: 4, content: prison('Q'), o: { banner: true } },
        { c: 210, w: 13, f: 2, content: barracks('w') },
      ],
      bx: [60, 180], bk: [120, 220],
      enem: [{ cols: [40, 130, 230], ch: 'z' }, { cols: [24, 100], ch: 'w' }, { cols: [70, 200], ch: 'f' }, { cols: [160], ch: 'r' }],
      surfMobs: [[100, 'd'], [180, 'd'], [60, 'F']], loot: [{ c: 90, ch: 'H' }],
      dun: { c0: 16, w: 218, bg: 'm', rooms: ['crypt', 'shrine', 'cell', 'grotto'], ent: 3, mob: ['z', 'w', 'r', 'd'] },
    }),
    mk({
      name: 'O TRONO DO DEVORADOR', sub: 'Cruze o arsenal e as criptas e destrua o Devorador de Mentes.',
      oregano: 100, tokens: 2,
      biome: 'battlefield', sky: ['#3a1812', '#0c0605'], banner: '#5a1414',
      W: 296, amp: 7, seed: 21, cliff: 'B', wall: 'B', exit: 262,
      matFn: d => d < 2 ? 'D' : 'B', pits: [[105, 2], [200, 2]],
      builds: [
        { c: 36, w: 13, f: 3, content: barracks('r'), o: { banner: true } },
        { c: 130, w: 16, f: 4, content: arsenal, o: { banner: true } },
        { c: 210, w: 14, f: 3, content: prison('Q') },
      ],
      bx: [70, 170, 240], bk: [100, 200],
      enem: [{ cols: [40, 150, 250], ch: 'z' }, { cols: [60, 180], ch: 'w' }, { cols: [50, 120, 230], ch: 'r' }, { cols: [100], ch: 'f' }],
      surfMobs: [[170, 'F'], [110, 'd'], [240, 'd']], loot: [{ c: 90, ch: 'H' }],
      dun: { c0: 16, w: 238, bg: 'B', rooms: ['powder', 'vault', 'shrine', 'cell'], ent: 3, mob: ['r', 'w', 'd', 'z'] },
      keep(g, S, W, rect, hline, vline, ladder, put) {            // torre do trono (chefe)
        const kb = S(272);
        rect(g, 272, kb - 16, 20, 3, 'B'); hline(g, kb - 17, 272, 291, 'B');
        for (let i = 0; i < 20; i += 3) put(g, 272 + i, kb - 18, 'B');
        vline(g, 291, kb - 16, kb - 1, 'B'); ladder(g, 274, kb - 15, kb - 1);
        put(g, 276, kb - 13, 'N'); put(g, 286, kb - 13, 'N'); put(g, 281, kb - 16, 'L'); put(g, 289, kb - 2, '$');
        put(g, 282, kb - 1, 'O');
      },
    }),
    mk({
      name: 'A PRISÃO DE PEDRA', sub: 'Blocos de celas verticais e, no subsolo, uma prisão de três andares.',
      oregano: 70, tokens: 1,
      biome: 'dungeon', sky: ['#161320', '#070509'], banner: '#2a1e44',
      W: 238, amp: 5, seed: 33, cliff: 'C', wall: 'C',
      matFn: d => d < 1 ? 'C' : '#', pits: [[84, 2], [160, 2]],
      builds: [
        { c: 28, w: 16, f: 5, content: prison('Q'), o: { banner: true } },
        { c: 120, w: 18, f: 5, content: prison('o'), o: { banner: true } },
        { c: 200, w: 16, f: 4, content: arsenal },
      ],
      bx: [60, 150, 210], bk: [100, 190],
      enem: [{ cols: [40, 96, 168, 224], ch: 'z' }, { cols: [70, 190], ch: 'w' }, { cols: [56, 144], ch: 'f' }, { cols: [120, 210], ch: 'r' }],
      surfMobs: [[180, 'F'], [200, 'd']], loot: [{ c: 60, ch: 'H' }, { c: 150, ch: 'T' }],
      dun: { c0: 16, w: 206, bg: 'C', rooms: ['cell', 'cell', 'grotto', 'vault'], ent: 4, mob: ['z', 'w', 'r', 'f'] },
    }),
    mk({
      name: 'O ARSENAL', sub: 'Pólvora por toda parte — e um paiol subterrâneo de três andares!',
      oregano: 85, tokens: 2,
      biome: 'battlefield', sky: ['#2a1810', '#0a0604'], banner: '#6a1a1a',
      W: 280, amp: 6, seed: 51, cliff: 'B', wall: 'B',
      matFn: d => d < 2 ? 'D' : 'B', pits: [[98, 2], [175, 3]],
      builds: [
        { c: 30, w: 14, f: 4, content: arsenal, o: { banner: true } },
        { c: 120, w: 16, f: 5, content: arsenal, o: { banner: true } },
        { c: 200, w: 16, f: 4, content: arsenal, o: { banner: true } },
        { c: 252, w: 13, f: 3, content: barracks('r') },
      ],
      bx: [70, 160, 230], bk: [50, 120, 200, 260],
      enem: [{ cols: [40, 96, 224], ch: 'z' }, { cols: [70, 190], ch: 'w' }, { cols: [140], ch: 'f' }, { cols: [120, 260], ch: 'r' }],
      surfMobs: [[200, 'F'], [180, 'd']], loot: [{ c: 60, ch: 'H' }, { c: 250, ch: 'Q' }],
      dun: { c0: 18, w: 244, bg: 'B', rooms: ['powder', 'powder', 'vault', 'den'], ent: 3, mob: ['w', 'r', 'd', 'f'] },
      extra(g, S, W) {
        for (let i = 0; i < 5; i++) put(g, 150 + i, S(150) - 1 - i, 'K');
        for (let i = 0; i < 5; i++) put(g, 218 + i, S(218) - 1 - i, 'X');
      },
    }),
    mk({
      name: 'TEMPLO NA SELVA', sub: 'Ruínas tomadas pela mata; sob os zigurautes, uma cripta de três andares.',
      oregano: 100, tokens: 2,
      biome: 'jungle', sky: ['#5aa0c8', '#23566b'], banner: '#2a6a2a',
      W: 268, amp: 9, seed: 77, cliff: 'p', wall: 'p',
      matFn: d => d < 1 ? 'j' : (d < 4 ? 'j' : (d % 5 === 4 ? 'p' : 'D')), pits: [[105, 3], [184, 2]],
      builds: [
        { c: 36, w: 14, f: 4, content: barracks('z'), o: { banner: true } },
        { c: 130, w: 16, f: 4, content: prison('Q'), o: { banner: true, bgMat: 'p' } },
        { c: 210, w: 15, f: 5, content: arsenal, o: { banner: true } },
      ],
      bx: [80, 200], bk: [120, 250],
      enem: [{ cols: [34, 110, 224], ch: 'z' }, { cols: [56, 144], ch: 'w' }, { cols: [88, 200], ch: 'f' }, { cols: [160, 250], ch: 'r' }],
      surfMobs: [[250, 'F'], [150, 'd']], loot: [{ c: 60, ch: 'H' }, { c: 210, up: 6, ch: 'Q' }],
      dun: { c0: 18, w: 232, bg: 'p', rooms: ['crypt', 'grotto', 'shrine', 'den'], ent: 3, mob: ['z', 'w', 'r', 'f'] },
      extra(g, S, W) {
        platform(g, 42, S(42) - 12, 9, 'l'); platform(g, 128, S(128) - 15, 11, 'l'); platform(g, 210, S(210) - 11, 8, 'l');
        for (let c = 60; c < 76; c += 2) put(g, c, S(c) - 1, 'v');
        for (let c = 160; c < 176; c += 2) put(g, c, S(c) - 1, 'v');
        for (let c = 22; c < W - 12; c += 24) air(g, c, S(c) - 6, 'V');
      },
    }),
  ];

  // ---- fase de testes (escada, parede para escalar, props) ----
  function lvlTest() {
    const W = 340, H = 50, g = blank(W, H), gr = H - 6; const bg = blank(W, H); CUR_BG = bg;
    for (let c = 0; c < W; c++) { for (let r = gr; r < H - 2; r++) put(g, c, r, r === gr ? 'D' : '#'); put(g, c, H - 2, '~'); put(g, c, H - 1, '~'); }
    for (let r = 0; r < H; r++) for (let k = 0; k < 3; k++) put(g, 130 + k, r, '.');
    for (let c = 190; c < 250; c++) for (let r = gr - 8; r < gr; r++) put(g, c, r, r === gr - 8 ? 'D' : '#');
    platform(g, 40, gr - 5, 8, '='); platform(g, 56, gr - 9, 8, '#'); platform(g, 74, gr - 13, 8, '=');
    ladder(g, 96, gr - 16, gr - 1); platform(g, 92, gr - 16, 8, '#');   // ladder test
    vline(g, 170, gr - 14, gr - 3, '#'); vline(g, 171, gr - 14, gr - 3, '#'); // wall-climb test (doorway at bottom)
    hline(g, gr - 15, 169, 172, '#'); put(g, 170, gr - 16, 'Q');
    platform(g, 285, gr - 17, 16, '#');
    for (let c = 6; c < W - 6; c += 4) coinAt(g, c, gr - 2);
    put(g, 60, gr - 1, 'Q'); put(g, 110, gr - 1, 'T'); put(g, 100, gr - 1, 'X'); put(g, 115, gr - 1, 'K');
    put(g, 30, gr - 1, 'z'); put(g, 124, gr - 1, 'f'); put(g, 160, gr - 1, 'r'); put(g, 230, gr - 1, 'F');
    put(g, 50, gr - 2, 's'); put(g, 48, gr - 1, 't');   // porta (abre ao passar) + tocha (demo de iluminação)
    capLoot(g, 30, 1);
    put(g, 3, gr - 1, 'P'); put(g, W - 5, gr - 1, 'E');
    return { name: 'FASE DE TESTES', sub: 'Escada (col 96), parede para escalar (col 170), poções, tokens e barris.', win: 'exit', biome: 'castle', sky: ['#1e2740', '#080a14'], bannerColor: '#6a1a1a', rows: toRows(g), bg: toRows(bg), surface: new Array(W).fill(gr) };
  }

  return [...CAMPAIGN, lvlTest()];
})();

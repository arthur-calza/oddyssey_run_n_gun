/* ============================================================
   levels.js — Oddyssey Chronicles campaign: functional, themed,
   Broforce-style levels. Each stretch reads as a real place —
   gatehouse, barracks, PRISON cell-blocks, ARSENAL, catacombs —
   linked by ladders, climbable walls and trenches. The continuous
   ground is the guaranteed route to the exit; buildings, ladders
   and tunnels are the explorable verticality.

   Legend: terrain # D B = ~ C S m  X barril K foguete $ tesouro
           A sand R gravel  h ESCADA(climb)
           decor t L N I V Y G  J grades(prisão)  U rack(arsenal)  M caixa
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

  // ---- background-fill layer (interiores de construções e túneis) ----
  // CUR_BG é a grade de fundo da fase em construção; os helpers escrevem nela.
  let CUR_BG = null;
  const bgPut = (c, r, ch) => { if (CUR_BG && r >= 0 && r < CUR_BG.length && c >= 0 && c < CUR_BG[0].length) CUR_BG[r][c] = ch; };
  const bgRect = (c0, r0, w, h, ch) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) bgPut(c, r, ch); };

  // base de terra ESPESSA (≈ `depth` tiles abaixo da superfície) para encaixar
  // construções subterrâneas. A superfície oscila ±amp em torno de (H - depth).
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
  function climb(g, c, fromR, toR, mat, dir) { dir = dir || 1; let r = fromR, x = c; while (r > toR) { platform(g, x, r, 5, mat); x += dir * 4; r -= 3; } }
  function startCliff(g, S, mat) { const r = S(8) - 8; rect(g, 0, r, 13, 2, mat); for (let i = 0; i < 13; i += 3) put(g, i, r - 1, mat); put(g, 2, r - 1, 't'); ladder(g, 6, r + 1, S(6) - 1); return r; }
  const coinAt = (g, c, r) => air(g, c, r, 'o');
  function coinLine(g, r, c0, c1, step) { for (let c = c0; c <= c1; c += (step || 1)) coinAt(g, c, r); }
  function barrels(g, S, cols, ch) { cols.forEach(c => { put(g, c, S(c) - 1, ch || 'X'); put(g, c + 1, S(c) - 1, ch || 'X'); }); }
  const enemies = (g, S, cols, ch) => cols.forEach(c => put(g, c, S(c) - 1, ch));
  const enemiesAt = (g, cols, r, ch) => cols.forEach(c => put(g, c, r, ch));

  // a multi-floor building you climb with the inner ladder; floors hold themed
  // content. Open at ground level so the walking route passes straight through.
  function building(g, S, c0, w, floors, fh, mat, content, o) {
    o = o || {}; const baseR = S(c0), lc = c0 + 1, topR = baseR - floors * fh;
    const bgm = o.bgMat || mat;                                                          // material do interior (fundo)
    bgRect(c0, topR, w, baseR - topR, bgm);                                              // <<< INTERIOR preenchido (fundo escuro)
    vline(g, c0, topR, baseR - 3, mat); vline(g, c0 + w - 1, topR, baseR - 3, mat);     // overhead side walls
    hline(g, topR, c0, c0 + w - 1, mat); for (let i = 0; i < w; i += 3) put(g, c0 + i, topR - 1, mat); // roof + battlements
    for (let f = 1; f <= floors; f++) {
      const fr = baseR - f * fh;
      hline(g, fr, c0, c0 + w - 1, mat); hline(g, fr + 1, c0, c0 + w - 1, mat);
      put(g, lc, fr, '.'); put(g, lc, fr + 1, '.');                                     // ladder hole
      put(g, c0 + (w >> 1), fr - 2, 'N');                                               // window
      air(g, c0 + 2, fr - 1, f % 2 ? 'V' : '.');                                        // hanging vines (alternating floors)
      if (content) content(g, fr, f, c0, w, lc);
    }
    ladder(g, lc, topR + 1, baseR - 1);
    if (o.banner) put(g, c0 + (w >> 1) - 2, topR + 1, 'L');
    air(g, c0 + 1, topR, 'V'); air(g, c0 + w - 2, topR, 'V');                            // vines off the roof edges
    put(g, c0 + 2, baseR - 4, 't');
  }
  // prison content: barred cells with a reward locked inside
  const prison = loot => (g, fr, f, c0, w, lc) => {
    for (let c = c0 + 2; c < c0 + w - 1; c++) if (c !== lc && c !== lc + 1) put(g, c, fr - 2, 'J');
    put(g, c0 + 3, fr - 1, f === 1 ? 'T' : (f % 2 ? 'Q' : loot || 'o'));
    coinAt(g, c0 + w - 3, fr - 1);
  };
  // arsenal content: racks + powder & rocket barrels
  const arsenal = (g, fr, f, c0, w, lc) => {
    put(g, c0 + 3, fr - 1, 'U'); put(g, c0 + w - 3, fr - 1, 'U');
    put(g, c0 + 4, fr - 1, f % 2 ? 'X' : 'K'); put(g, c0 + w - 4, fr - 1, f % 2 ? 'K' : 'X');
    put(g, c0 + (w >> 1) + 1, fr - 1, 'M');
  };
  // barracks content: guards + crates
  const barracks = mob => (g, fr, f, c0, w, lc) => {
    enemiesAt(g, [c0 + 3, c0 + w - 3], fr - 1, mob || 'z'); put(g, c0 + (w >> 1) + 1, fr - 1, 'M');
    if (f === 1) put(g, c0 + w - 4, fr - 1, 'X');
  };
  // ramped trench / catacomb passage (always walkable; terraces above are the high road)
  function tunnel(g, S, c0, c1, mat, loot) {
    const depth = 5, bottom = Math.min(g.length - 4, Math.max(S(c0), S(c1)) + depth);
    for (let c = c0; c <= c1; c++) {
      let wh = (c <= c0 + depth) ? S(c0) + (c - c0) : (c >= c1 - depth) ? S(c1) + (c1 - c) : bottom; if (wh > bottom) wh = bottom;
      for (let r = S(c); r < wh; r++) { put(g, c, r, '.'); bgPut(c, r, mat); }                  // <<< parede de fundo do túnel (cavado na terra)
    }
    if (loot) put(g, (c0 + c1) >> 1, bottom - 1, loot);
    for (let c = c0 + depth + 1; c < c1 - depth; c += 3) coinAt(g, c, bottom - 1);
  }
  // a tall wall with a 2-tile doorway at the bottom: walk under it OR jump into
  // the doorway and WALL-CLIMB up its face to reach the high route/loot on top.
  function climbWall(g, S, c, h, mat, loot) {
    const baseR = S(c);
    vline(g, c, baseR - h, baseR - 3, mat); vline(g, c + 1, baseR - h, baseR - 3, mat);
    hline(g, baseR - h - 1, c - 1, c + 2, mat);             // a small ledge on top
    if (loot) put(g, c, baseR - h - 2, loot); coinAt(g, c + 1, baseR - h - 2);
  }

  // ---- CONSTRUÇÕES SUBTERRÂNEAS ----------------------------------------------
  // Uma sala "encravada" na terra, ABAIXO da superfície, com fundo sombreado e um
  // ALÇAPÃO: um poço de escada que desce da superfície (atravessando o solo) até a sala.
  // Como o topo da escada é "sólido", o jogador pisa nele e desce com a seta p/ baixo.
  function underground(g, S, c0, w, roomH, mat, content, o) {
    o = o || {}; const lc = c0 + 1; const surfR = S(lc);
    // ancora o teto ABAIXO do ponto mais baixo da superfície no vão, p/ enterrar a sala inteira
    let baseSurf = 0; for (let c = c0; c < c0 + w; c++) baseSurf = Math.max(baseSurf, S(c));
    const ceil = baseSurf + (o.gap || 5), floor = ceil + roomH, bgm = o.bgMat || mat;
    // escava a câmara e pinta o fundo sombreado (igual aos interiores das construções)
    for (let r = ceil + 1; r < floor; r++) for (let c = c0 + 1; c < c0 + w - 1; c++) { put(g, c, r, '.'); bgPut(c, r, bgm); }
    // paredes, teto e piso de pedra/tijolo
    vline(g, c0, ceil, floor, mat); vline(g, c0 + w - 1, ceil, floor, mat);
    hline(g, ceil, c0, c0 + w - 1, mat); hline(g, floor, c0, c0 + w - 1, mat);
    // ALÇAPÃO: poço de escada da superfície até o piso (atravessa solo + teto da sala)
    for (let r = surfR; r < floor; r++) { put(g, lc, r, 'h'); bgPut(lc, r, bgm); }
    // patamares internos opcionais (salas mais altas)
    if (o.mids) for (let f = 1; f <= o.mids; f++) { const fr = ceil + Math.round(roomH * f / (o.mids + 1)); hline(g, fr, c0 + 2, c0 + w - 2, mat); put(g, lc, fr, 'h'); }
    if (content) content(g, floor, ceil, c0, w, lc);
    return { ceil, floor, lc };
  }
  // conteúdos subterrâneos (≥5 tipos)
  const ugCrypt = (g, floor, ceil, c0, w, lc) => {          // catacumba: caixões, ossos, teias, tesouro
    for (let c = c0 + 3; c < c0 + w - 2; c += 3) air(g, c, floor - 1, "'");
    put(g, c0 + w - 3, floor - 1, '$'); coinAt(g, c0 + 2, floor - 1);
    air(g, c0 + 2, ceil + 1, 'Y'); air(g, c0 + w - 3, ceil + 1, 'Y'); put(g, c0 + w - 4, floor - 1, 'z');
  };
  const ugVault = (g, floor, ceil, c0, w, lc) => {          // cofre enterrado: ouro e token
    hline(g, floor - 1, c0 + 3, c0 + w - 3, '$'); put(g, c0 + (w >> 1), floor - 1, 'T');
    air(g, c0 + 2, floor - 2, 'W'); air(g, c0 + w - 3, floor - 2, 'W');
  };
  const ugPowder = (g, floor, ceil, c0, w, lc) => {         // paiol subterrâneo: pólvora e foguetes
    ['X', 'K', 'X', 'K', 'X'].forEach((b, i) => put(g, c0 + 3 + i, floor - 1, b));
    put(g, c0 + w - 3, floor - 1, 'M'); air(g, c0 + 2, ceil + 1, 't');
  };
  const ugCell = loot => (g, floor, ceil, c0, w, lc) => {   // masmorra/cela subterrânea
    for (let c = c0 + 2; c < c0 + w - 1; c++) if (c !== lc) put(g, c, ceil + 2, 'J');
    put(g, c0 + 3, floor - 1, loot || 'Q'); coinAt(g, c0 + w - 3, floor - 1); put(g, c0 + w - 4, floor - 1, 'z');
  };
  const ugGrotto = (g, floor, ceil, c0, w, lc) => {         // gruta de cristais
    for (let c = c0 + 2; c < c0 + w - 1; c += 2) put(g, c, floor - 1, '<');
    put(g, c0 + (w >> 1), floor - 1, 'Q'); air(g, c0 + 2, ceil + 1, 'V'); air(g, c0 + w - 3, ceil + 1, 'V');
  };

  function grnd(g, S) { for (let c = 6; c < g[0].length - 6; c += 5) coinAt(g, c, S(c) - 2); for (let c = 3; c < g[0].length - 3; c += 7) air(g, c, S(c) - 1, 'G'); }

  // ===================== CAMPAIGN ============================
  function lvl1() { // castle base: gatehouse → barracks → armory → ramparts
    const W = 360, H = 92, g = blank(W, H); const bg = blank(W, H); CUR_BG = bg;
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : (d < 8 ? 'D' : '#'), 6, 3, [[150, 2], [256, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'B');
    building(g, S, 40, 13, 3, 5, 'B', barracks('z'), { banner: true });   // barracks
    building(g, S, 120, 14, 3, 5, 'B', prison('Q'), { banner: true });    // prison block
    building(g, S, 230, 14, 4, 5, 'B', arsenal, { banner: true });        // armory (explosive!)
    underground(g, S, 64, 11, 6, 'B', ugCell('Q'), { bgMat: 'B' });        // masmorra enterrada
    underground(g, S, 286, 10, 5, 'B', ugVault, { bgMat: 'D' });           // cofre enterrado
    tunnel(g, S, 90, 116, 'D', 'T');
    barrels(g, S, [70, 180, 300], 'X'); barrels(g, S, [100, 210, 330], 'K');
    grnd(g, S); put(g, 86, S(86) - 1, 'H'); put(g, 305, S(305) - 6, 'Q');
    put(g, 4, startR - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [34, 70, 108, 168, 224, 296, 330], 'z'); enemies(g, S, [56, 144, 260], 'w');
    enemies(g, S, [88, 188, 280], 'f'); enemies(g, S, [200], 'r'); put(g, 250, S(250) - 1, 'F');
    return { name: 'PORTÃO DE FERRO', sub: 'Tome a base: quartel, prisão e arsenal. Suba pelas escadas e muralhas.', win: 'exit', biome: 'castle', sky: ['#1e2740', '#080a14'], bannerColor: '#6a1a1a', rows: toRows(g), bg: toRows(bg) };
  }

  function lvl2() { // village: houses → ransacked prison → cellars
    const W = 372, H = 92, g = blank(W, H); const bg = blank(W, H); CUR_BG = bg;
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'S', 7, 7, [[160, 2], [266, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'S');
    building(g, S, 36, 12, 2, 5, 'S', barracks('z'), {});
    building(g, S, 96, 14, 3, 5, 'S', prison('o'), { banner: true });
    building(g, S, 210, 13, 2, 5, 'S', barracks('w'), {});
    building(g, S, 300, 14, 3, 5, 'S', arsenal, {});
    underground(g, S, 64, 12, 6, 'S', ugCrypt, { bgMat: 'D' });            // catacumba sob a vila
    underground(g, S, 200, 11, 5, 'S', ugPowder, { bgMat: 'S' });          // paiol enterrado
    tunnel(g, S, 130, 156, 'S', 'Q'); tunnel(g, S, 230, 260, 'S', 'T');
    barrels(g, S, [60, 190, 340], 'X'); barrels(g, S, [120, 280], 'K');
    grnd(g, S); put(g, 86, S(86) - 1, 'H'); put(g, 350, S(350) - 1, '$');
    put(g, 4, startR - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [28, 70, 132, 196, 312, 348], 'z'); enemies(g, S, [120, 256], 'w');
    enemies(g, S, [80, 190, 290], 'f'); enemies(g, S, [210], 'F'); enemies(g, S, [180, 320], 'r');
    return { name: 'VILA DOS LAMENTOS', sub: 'Casas, a prisão saqueada e os porões — vários caminhos até a saída.', win: 'exit', biome: 'village', sky: ['#3a2e26', '#100a08'], bannerColor: '#5a1e34', rows: toRows(g), bg: toRows(bg) };
  }

  function lvl3() { // catacombs: descending tunnels, dungeon cells, climb shafts
    const W = 356, H = 92, g = blank(W, H); const bg = blank(W, H); CUR_BG = bg;
    const top = rollingGround(g, W, H, d => d < 1 ? 'C' : (d % 4 === 3 ? 'm' : 'C'), 8, 13, [[120, 2], [300, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'C');
    hline(g, 0, 0, W - 1, 'm'); hline(g, 1, 0, W - 1, 'm');
    for (let c = 14; c < W - 10; c += 26) { vline(g, c, 2, 6, 'C'); air(g, c + 1, 7, 'Y'); }
    building(g, S, 40, 14, 3, 5, 'C', prison('o'), {});       // dungeon cell-block
    building(g, S, 200, 16, 4, 5, 'C', prison('Q'), { banner: true });
    underground(g, S, 70, 11, 6, 'C', ugGrotto, { bgMat: 'm' });           // gruta de cristais
    underground(g, S, 238, 12, 6, 'C', ugCrypt, { bgMat: 'm' });           // catacumba profunda
    tunnel(g, S, 130, 200, 'C', 'T'); tunnel(g, S, 260, 320, 'm', 'Q');
    barrels(g, S, [60, 250], 'X'); barrels(g, S, [160, 300], 'K');
    grnd(g, S); put(g, 86, S(86) - 1, 'H');
    put(g, 4, startR - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [40, 130, 240, 330], 'z'); enemies(g, S, [22, 96, 264], 'w');
    enemies(g, S, [70, 150, 290], 'f'); enemies(g, S, [320], 'F'); enemies(g, S, [56, 190, 280], 'r');
    put(g, 100, S(100) - 1, 'd'); put(g, 240, S(240) - 1, 'd');
    return { name: 'CATACUMBAS PROFUNDAS', sub: 'Desça pelos poços e escale as paredes. Blocos de celas e a matilha.', win: 'exit', biome: 'dungeon', sky: ['#14101c', '#060409'], bannerColor: '#2a1e44', rows: toRows(g), bg: toRows(bg) };
  }

  function lvl4() { // battlefield → arsenal → throne keep (BOSS)
    const W = 420, H = 92, g = blank(W, H); const bg = blank(W, H); CUR_BG = bg;
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'B', 7, 21, [[150, 2], [270, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'B');
    building(g, S, 44, 13, 3, 5, 'B', barracks('r'), { banner: true });
    building(g, S, 150, 16, 4, 5, 'B', arsenal, { banner: true });     // grand arsenal
    building(g, S, 300, 14, 3, 5, 'B', prison('Q'), {});
    underground(g, S, 80, 11, 6, 'B', ugPowder, { bgMat: 'D' });           // paiol enterrado
    underground(g, S, 348, 10, 5, 'B', ugVault, { bgMat: 'B' });           // cripta do tesouro
    tunnel(g, S, 200, 270, 'B', 'T');
    barrels(g, S, [70, 230, 340], 'X'); barrels(g, S, [100, 200, 360], 'K');
    grnd(g, S); put(g, 130, S(130) - 1, 'H');
    const kb = S(388);
    rect(g, 380, kb - 16, 22, 3, 'B'); hline(g, kb - 17, 380, 401, 'B');
    for (let i = 0; i < 22; i += 3) put(g, 380 + i, kb - 18, 'B');
    vline(g, 401, kb - 16, kb - 1, 'B'); ladder(g, 382, kb - 15, kb - 1);
    put(g, 384, kb - 13, 'N'); put(g, 394, kb - 13, 'N'); put(g, 389, kb - 16, 'L'); put(g, 397, kb - 2, '$');
    put(g, 4, startR - 1, 'P'); put(g, 372, S(372) - 1, 'E');
    enemies(g, S, [40, 90, 200, 260, 330], 'z'); enemies(g, S, [60, 180, 240, 310], 'w');
    enemies(g, S, [50, 140, 210, 290, 360], 'r'); enemies(g, S, [110, 250], 'f'); enemies(g, S, [170, 300], 'F');
    put(g, 110, S(110) - 1, 'd'); put(g, 320, S(320) - 1, 'd'); put(g, 390, kb - 1, 'O');
    return { name: 'O TRONO DO DEVORADOR', sub: 'Atravesse o arsenal em chamas e destrua o Devorador de Mentes.', win: 'boss', biome: 'battlefield', sky: ['#3a1812', '#0c0605'], bannerColor: '#5a1414', rows: toRows(g), bg: toRows(bg) };
  }

  function lvl5() { // THE STONE PRISON — vertical cell-blocks, ladders & wall-climb
    const Wd = 340, H = 92, g = blank(Wd, H); const bg = blank(Wd, H); CUR_BG = bg;
    const top = rollingGround(g, Wd, H, d => d < 1 ? 'C' : '#', 5, 33, [[120, 2], [230, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'C');
    building(g, S, 30, 16, 5, 5, 'C', prison('Q'), { banner: true });     // tall cell-block A
    building(g, S, 150, 18, 5, 5, 'C', prison('o'), { banner: true });    // cell-block B
    building(g, S, 270, 16, 4, 5, 'C', arsenal, {});
    underground(g, S, 55, 10, 6, 'C', ugCell('Q'), { bgMat: 'C' });        // bloco de celas subterrâneo
    underground(g, S, 252, 10, 6, 'C', ugGrotto, { bgMat: '#' });          // gruta sob a prisão
    tunnel(g, S, 75, 140, 'C', 'T'); tunnel(g, S, 175, 250, '#', 'Q');
    barrels(g, S, [60, 200, 300], 'X'); barrels(g, S, [110, 250], 'K');
    grnd(g, S); put(g, 86, S(86) - 1, 'H'); put(g, 200, S(200) - 16, 'T');
    put(g, 4, startR - 1, 'P'); put(g, Wd - 5, S(Wd - 5) - 1, 'E');
    enemies(g, S, [40, 96, 168, 224, 296, 320], 'z'); enemies(g, S, [70, 190, 280], 'w');
    enemies(g, S, [56, 144, 240], 'f'); enemies(g, S, [180], 'F'); enemies(g, S, [120, 260], 'r');
    put(g, 200, S(200) - 1, 'd');
    return { name: 'A PRISÃO DE PEDRA', sub: 'Escale os blocos de celas — escadas, paredes e poços por toda parte.', win: 'exit', biome: 'dungeon', sky: ['#161320', '#070509'], bannerColor: '#2a1e44', rows: toRows(g), bg: toRows(bg) };
  }

  function lvl6() { // THE ARSENAL — explosive chaos, racks, rocket walls
    const W2 = 400, H = 92, g = blank(W2, H); const bg = blank(W2, H); CUR_BG = bg;
    const top = rollingGround(g, W2, H, d => d < 2 ? 'D' : 'B', 6, 51, [[140, 2], [250, 3]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'B');
    building(g, S, 34, 14, 4, 5, 'B', arsenal, { banner: true });
    building(g, S, 130, 16, 5, 5, 'B', arsenal, { banner: true });
    building(g, S, 250, 16, 4, 5, 'B', arsenal, { banner: true });
    building(g, S, 330, 13, 3, 5, 'B', barracks('r'), {});
    underground(g, S, 60, 10, 6, 'B', ugPowder, { bgMat: 'D' });           // depósito subterrâneo de pólvora
    underground(g, S, 366, 10, 5, 'B', ugVault, { bgMat: 'B' });           // cofre enterrado
    tunnel(g, S, 170, 240, 'B', 'T');
    // rocket-barrel walls — shoot one and watch the chain
    for (let i = 0; i < 5; i++) put(g, 190 + i, S(190) - 1 - i, 'K');
    for (let i = 0; i < 5; i++) put(g, 280 + i, S(280) - 1 - i, 'X');
    barrels(g, S, [70, 160, 300, 360], 'K'); barrels(g, S, [110, 210, 340], 'X');
    grnd(g, S); put(g, 86, S(86) - 1, 'H'); put(g, 360, S(360) - 1, 'Q'); put(g, 150, S(150) - 16, 'T');
    put(g, 4, startR - 1, 'P'); put(g, W2 - 5, S(W2 - 5) - 1, 'E');
    enemies(g, S, [40, 96, 168, 224, 296, 360], 'z'); enemies(g, S, [70, 190, 320], 'w');
    enemies(g, S, [56, 144, 240], 'f'); enemies(g, S, [200, 300], 'F'); enemies(g, S, [120, 260, 350], 'r');
    put(g, 180, S(180) - 1, 'd'); put(g, 320, S(320) - 1, 'd');
    return { name: 'O ARSENAL', sub: 'Pólvora e foguetes por toda parte — provoque a reação em cadeia!', win: 'exit', biome: 'battlefield', sky: ['#2a1810', '#0a0604'], bannerColor: '#6a1a1a', rows: toRows(g), bg: toRows(bg) };
  }

  function lvlJungle() { // TEMPLO NA SELVA — ruínas de pedra tomadas pela mata (estilo Broforce)
    const W = 384, H = 92, g = blank(W, H); const bg = blank(W, H); CUR_BG = bg;
    // solo: terra de selva no topo, pedra de templo e terra abaixo
    const top = rollingGround(g, W, H, d => d < 1 ? 'j' : (d < 4 ? 'j' : (d % 5 === 4 ? 'p' : 'D')), 9, 77, [[150, 3], [262, 2]]);
    const S = c => top[c]; const startR = startCliff(g, S, 'p');
    // zigurautes / templos: pedra de templo e pedra escura, com fundos de interior
    building(g, S, 40, 14, 4, 5, 'p', barracks('z'), { banner: true });
    building(g, S, 130, 16, 4, 5, 'k', prison('Q'), { banner: true, bgMat: 'p' });
    building(g, S, 250, 15, 5, 5, 'p', arsenal, { banner: true });
    // câmaras subterrâneas do templo (escavadas na terra, com alçapão de escada)
    underground(g, S, 64, 11, 6, 'p', ugCrypt, { bgMat: 'p' });            // tumba de pedra do templo
    underground(g, S, 350, 10, 6, 'k', ugGrotto, { bgMat: 'p' });          // gruta de cristais
    // passarelas de tábua suspensas entre as estruturas
    platform(g, 58, S(58) - 13, 10, 'l'); platform(g, 182, S(182) - 16, 12, 'l'); platform(g, 300, S(300) - 12, 9, 'l');
    // folhagem densa como cobertura
    for (let c = 72; c < 90; c += 2) put(g, c, S(c) - 1, 'v');
    for (let c = 228; c < 244; c += 2) put(g, c, S(c) - 1, 'v');
    tunnel(g, S, 150, 222, 'D', 'T');
    barrels(g, S, [80, 200, 300], 'X'); barrels(g, S, [120, 260, 344], 'K');
    grnd(g, S); put(g, 86, S(86) - 1, 'H'); put(g, 300, S(300) - 6, 'Q'); put(g, 182, S(182) - 17, 'T');
    for (let c = 22; c < W - 12; c += 24) air(g, c, S(c) - 6, 'V');   // vinhas penduradas pela mata
    put(g, 4, startR - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [34, 70, 110, 168, 224, 300, 342], 'z'); enemies(g, S, [56, 144, 262], 'w');
    enemies(g, S, [88, 188, 282], 'f'); enemies(g, S, [200, 322], 'r'); put(g, 250, S(250) - 1, 'F');
    put(g, 150, S(150) - 1, 'd');
    return { name: 'TEMPLO NA SELVA', sub: 'Ruínas de pedra tomadas pela mata: zigurautes, passarelas de tábua e folhagem.', win: 'exit', biome: 'jungle', sky: ['#5aa0c8', '#23566b'], bannerColor: '#2a6a2a', rows: toRows(g), bg: toRows(bg) };
  }

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
    put(g, 3, gr - 1, 'P'); put(g, W - 5, gr - 1, 'E');
    return { name: 'FASE DE TESTES', sub: 'Escada (col 96), parede para escalar (col 170), poções, tokens e barris.', win: 'exit', biome: 'castle', sky: ['#1e2740', '#080a14'], bannerColor: '#6a1a1a', rows: toRows(g), bg: toRows(bg) };
  }

  return [lvl1(), lvl2(), lvl3(), lvl4(), lvl5(), lvl6(), lvlJungle(), lvlTest()];
})();

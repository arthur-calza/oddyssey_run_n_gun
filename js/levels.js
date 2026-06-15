/* ============================================================
   levels.js — large, vertical, explorable campaign maps
   The rolling ground at the bottom is the guaranteed path to the
   exit (±1 tile/col, always walkable). Above it, multi-tier
   fortress floors, towers and climbs fill the (3x taller) space
   with optional exploration: enemies, coins and 1-ups.

   Legend: terrain # D B = ~ X $ C S m   A sand(falls) R gravel(falls)
           decor t L N I V Y G   coin o   life H
           enemies z zombie w werewolf r dragonman d demon  O boss
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

  function rollingGround(g, W, H, matFn, amp, seed, pits) {
    const top = new Array(W), rng = mul(seed); let gr = H - 9, target = gr;
    for (let c = 0; c < W; c++) {
      if (c % 5 === 0) target = Math.max(H - 16, Math.min(H - 4, Math.round((H - 9) - (Math.sin(c * 0.05 + seed) * amp + Math.sin(c * 0.13) * amp * 0.5 + (rng() * 2 - 1) * 1.2))));
      if (gr < target) gr++; else if (gr > target) gr--;
      top[c] = gr;
      for (let r = gr; r < H - 2; r++) put(g, c, r, matFn(r - gr));
      put(g, c, H - 2, '~'); put(g, c, H - 1, '~');
    }
    (pits || []).forEach(([c, w]) => { for (let r = 0; r < H; r++) for (let k = 0; k < w; k++) put(g, c + k, r, '.'); });
    return top;
  }
  function platform(g, c, r, w, mat) { hline(g, r, c, c + w - 1, mat); }
  // a solid fortress floor (2 thick) with optional battlements / torches
  function terrace(g, c0, w, r, mat, o) {
    o = o || {}; hline(g, r, c0, c0 + w - 1, mat); hline(g, r + 1, c0, c0 + w - 1, mat);
    if (o.batt) for (let i = 0; i < w; i += 3) put(g, c0 + i, r - 1, mat);
    if (o.torch) { put(g, c0 + 2, r - 1, 't'); put(g, c0 + w - 3, r - 1, 't'); }
    if (o.window) put(g, c0 + (w >> 1), r - 2, 'N');
    if (o.banner) put(g, c0 + (w >> 1) - 4, r - 1, 'L');
  }
  // a climbable zig-zag of platforms from fromR up to toR
  function climb(g, c, fromR, toR, mat, dir) {
    dir = dir || 1; let r = fromR, x = c;
    while (r > toR) { platform(g, x, r, 5, mat); x += dir * 4; r -= 3; }
    return { x, r };
  }
  function tower(g, c, baseR, topR, mat, o) {
    o = o || {}; const w = o.w || 4;
    rect(g, c, topR, w, (baseR - 3) - topR, mat);
    for (let i = 0; i < w; i += 2) put(g, c + i, topR - 1, mat);
    if (o.window) { put(g, c + (w >> 1), topR + 3, 'N'); put(g, c + (w >> 1), topR + 9, 'N'); }
    if (o.banner) put(g, c + (w >> 1), topR + 1, 'L');
    if (o.torch) { put(g, c - 1, baseR - 5, 't'); put(g, c + w, baseR - 5, 't'); }
  }
  function sandColumn(g, c, baseR, h, mat) { for (let i = 1; i <= h; i++) put(g, c, baseR - i, mat); }
  const coinAt = (g, c, r) => air(g, c, r, 'o');
  function coinLine(g, r, c0, c1, step) { for (let c = c0; c <= c1; c += (step || 1)) coinAt(g, c, r); }
  function coinArc(g, cx, baseR, span, hgt) { for (let i = -span; i <= span; i++) { const r = baseR - Math.round(hgt * (1 - (i / span) * (i / span))); coinAt(g, cx + i, r); } }
  function sandBridge(g, c0, w, r, sandH, mat) { hline(g, r, c0, c0 + w - 1, '='); for (let i = 0; i < sandH; i++) hline(g, r - 1 - i, c0, c0 + w - 1, mat || 'A'); }
  const enemies = (g, S, cols, ch) => cols.forEach(c => put(g, c, S(c) - 1, ch));
  const enemiesAt = (g, cols, r, ch) => cols.forEach(c => put(g, c, r, ch));

  const TIERS = H => [H - 24, H - 44, H - 64];  // three fortress floors up the height

  // ---------- LEVEL 1 — castle (sky fortress) -----------------
  function lvl1() {
    const W = 336, H = 90, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : (d < 8 ? 'D' : '#'), 7, 3, [[120, 2], [212, 2], [288, 3]]);
    const S = c => top[c], T = TIERS(H);
    // big towers spanning ground to the sky
    [40, 110, 196, 268, 320].forEach((c, i) => tower(g, c, S(c), T[2] - 6, 'B', { w: 5, window: true, banner: i % 2 === 0, torch: true }));
    // tier floors (battlements) + connecting climbs from the ground
    terrace(g, 24, 40, T[0], 'B', { batt: true, torch: true, window: true });
    terrace(g, 150, 60, T[0], 'B', { batt: true, torch: true, banner: true });
    terrace(g, 250, 60, T[0], 'B', { batt: true, torch: true });
    terrace(g, 60, 50, T[1], '#', { batt: true, torch: true, banner: true });
    terrace(g, 190, 70, T[1], '#', { batt: true, torch: true, window: true });
    terrace(g, 110, 60, T[2], 'B', { batt: true, torch: true, window: true });
    climb(g, 14, S(14) - 4, T[0] + 1, '=', 1); climb(g, 70, T[0] - 2, T[1] + 1, '=', 1);
    climb(g, 150, T[1] - 2, T[2] + 1, '=', 1); climb(g, 232, S(232) - 4, T[0] + 1, '=', -1);
    climb(g, 270, T[0] - 2, T[1] + 1, '=', -1);
    // collapsing sand + bridges over pits
    sandColumn(g, 100, S(100), 2, 'A'); sandColumn(g, 101, S(101), 2, 'A');
    sandBridge(g, 120, 2, S(120) - 5, 3, 'A'); coinLine(g, S(120) - 9, 120, 121);
    sandBridge(g, 212, 2, S(212) - 5, 3, 'A');
    // loot: coins along ground + tiers, 1-ups high
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    coinLine(g, T[0] - 2, 26, 60); coinLine(g, T[0] - 2, 152, 205); coinLine(g, T[1] - 2, 62, 105);
    coinLine(g, T[2] - 2, 114, 165); put(g, 138, T[2] - 2, 'H'); put(g, 86, T[1] - 2, 'H');
    [50, 130, 230, 300].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    put(g, 308, S(308) - 1, '$'); put(g, 309, S(309) - 1, '$'); put(g, 140, T[2] - 2, '$');
    for (let c = 3; c < W - 3; c += 6) air(g, c, top[c] - 1, 'G');
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    // enemies — ground + tiers
    enemies(g, S, [16, 34, 56, 96, 132, 168, 184, 224, 256, 296, 318], 'z');
    enemies(g, S, [78, 144, 240, 284], 'w');
    enemies(g, S, [62, 176, 260], 'r');
    enemiesAt(g, [30, 48, 160, 180, 200], T[0] - 1, 'z'); enemiesAt(g, [40, 170], T[0] - 1, 'w');
    enemiesAt(g, [70, 90, 210, 240], T[1] - 1, 'w'); enemiesAt(g, [200], T[1] - 1, 'r');
    enemiesAt(g, [120, 140, 160], T[2] - 1, 'z'); enemiesAt(g, [150], T[2] - 1, 'd');
    return { name: 'MURALHAS DE FERRO', sub: 'Escale a fortaleza infestada até a saída.', win: 'exit', biome: 'castle', sky: ['#3a4a6e', '#15182a'], bannerColor: '#8a2b2b', rows: toRows(g) };
  }

  // ---------- LEVEL 2 — village (tiered rooftops) -------------
  function lvl2() {
    const W = 368, H = 90, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'S', 8, 7, [[150, 2], [250, 2]]);
    const S = c => top[c], T = TIERS(H);
    // houses along the ground
    for (let c = 16; c < W - 20; c += 34) { rect(g, c, S(c) - 8, 9, 3, 'S'); hline(g, S(c) - 9, c, c + 8, '='); put(g, c + 4, S(c) - 7, 'N'); put(g, c + 2, S(c) - 10, 't'); if ((c / 34 | 0) % 2) put(g, c + 4, S(c) - 10, 'L'); }
    // tiered terraces (market galleries) + climbs
    terrace(g, 40, 70, T[0], 'S', { torch: true, banner: true });
    terrace(g, 180, 80, T[0], 'S', { torch: true, window: true });
    terrace(g, 90, 90, T[1], 'S', { torch: true, window: true });
    terrace(g, 240, 70, T[1], '#', { torch: true });
    terrace(g, 150, 70, T[2], 'S', { torch: true, banner: true });
    climb(g, 20, S(20) - 4, T[0] + 1, '=', 1); climb(g, 110, T[0] - 2, T[1] + 1, '=', 1);
    climb(g, 180, T[1] - 2, T[2] + 1, '=', 1); climb(g, 300, S(300) - 4, T[0] + 1, '=', -1);
    sandColumn(g, 70, S(70), 2, 'A'); sandColumn(g, 71, S(71), 2, 'A');
    sandColumn(g, 200, S(200), 2, 'R'); sandColumn(g, 201, S(201), 2, 'R');
    sandBridge(g, 150, 2, S(150) - 5, 3, 'A'); sandBridge(g, 250, 2, S(250) - 5, 3, 'R');
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    coinLine(g, T[0] - 2, 42, 105); coinLine(g, T[1] - 2, 92, 175); coinLine(g, T[2] - 2, 152, 215);
    put(g, 188, T[2] - 2, 'H'); put(g, 130, T[1] - 2, 'H');
    [30, 100, 200, 280, 340].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    [10, 160, 300].forEach(c => put(g, c, S(c) - 1, 'V'));
    put(g, 350, S(350) - 1, '$'); put(g, 351, S(351) - 1, '$'); put(g, 190, T[2] - 2, '$');
    for (let c = 3; c < W - 3; c += 6) air(g, c, top[c] - 1, 'G');
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [14, 28, 58, 96, 132, 168, 196, 224, 268, 312, 348], 'z');
    enemies(g, S, [44, 120, 188, 256, 320], 'w');
    enemies(g, S, [80, 210, 290], 'r');
    enemiesAt(g, [50, 70, 200, 230], T[0] - 1, 'z'); enemiesAt(g, [60, 220], T[0] - 1, 'w');
    enemiesAt(g, [100, 130, 250, 280], T[1] - 1, 'w'); enemiesAt(g, [120], T[1] - 1, 'r');
    enemiesAt(g, [160, 190, 210], T[2] - 1, 'z'); enemiesAt(g, [180], T[2] - 1, 'd');
    return { name: 'VILA DOS LAMENTOS', sub: 'Suba pelos telhados tomados pelos mortos.', win: 'exit', biome: 'village', sky: ['#5a4a3a', '#1a1410'], bannerColor: '#7a2a4a', rows: toRows(g) };
  }

  // ---------- LEVEL 3 — dungeon (deep shafts) ----------------
  function lvl3() {
    const W = 352, H = 90, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 1 ? 'C' : (d % 4 === 3 ? 'm' : 'C'), 8, 13, [[110, 2], [220, 2], [300, 2]]);
    const S = c => top[c], T = TIERS(H);
    hline(g, 0, 0, W - 1, 'm'); hline(g, 1, 0, W - 1, 'm');
    for (let c = 14; c < W - 10; c += 24) { vline(g, c, 2, 6, 'C'); air(g, c + 1, 7, 'Y'); put(g, c, S(c) - 4, 't'); }
    terrace(g, 30, 70, T[0], 'C', { torch: true }); terrace(g, 200, 90, T[0], 'm', { torch: true, window: true });
    terrace(g, 100, 90, T[1], 'C', { torch: true, window: true }); terrace(g, 250, 70, T[1], 'C', { torch: true });
    terrace(g, 150, 80, T[2], 'm', { torch: true, banner: true });
    climb(g, 18, S(18) - 4, T[0] + 1, 'C', 1); climb(g, 120, T[0] - 2, T[1] + 1, 'C', 1);
    climb(g, 190, T[1] - 2, T[2] + 1, 'C', 1); climb(g, 290, S(290) - 4, T[0] + 1, 'C', -1);
    sandColumn(g, 90, S(90), 2, 'R'); sandColumn(g, 91, S(91), 2, 'R');
    sandBridge(g, 110, 2, S(110) - 5, 3, 'R'); sandBridge(g, 220, 2, S(220) - 5, 3, 'A');
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    coinLine(g, T[0] - 2, 32, 95); coinLine(g, T[1] - 2, 102, 185); coinLine(g, T[2] - 2, 152, 225);
    put(g, 188, T[2] - 2, 'H'); put(g, 140, T[1] - 2, 'H');
    [60, 160, 280].forEach(c => put(g, c, S(c) - 1, 'X'));
    put(g, 320, S(320) - 1, '$'); put(g, 190, T[2] - 2, '$');
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    enemies(g, S, [40, 70, 130, 170, 200, 240, 300, 330], 'z');
    enemies(g, S, [22, 96, 150, 196, 264, 316], 'w');
    enemies(g, S, [56, 190, 280], 'r');
    enemiesAt(g, [50, 70, 220, 250], T[0] - 1, 'w'); enemiesAt(g, [40, 240], T[0] - 1, 'z');
    enemiesAt(g, [110, 140, 260, 290], T[1] - 1, 'z'); enemiesAt(g, [130, 270], T[1] - 1, 'r');
    enemiesAt(g, [160, 190, 210], T[2] - 1, 'w'); enemiesAt(g, [180], T[2] - 1, 'd');
    put(g, 240, S(240) - 1, 'd');
    return { name: 'CATACUMBAS PROFUNDAS', sub: 'Desça e suba pelas galerias. Cuidado com os demônios.', win: 'exit', biome: 'dungeon', sky: ['#1a1622', '#0a070e'], bannerColor: '#3a2a5a', rows: toRows(g) };
  }

  // ---------- LEVEL 4 — battlefield & throne -----------------
  function lvl4() {
    const W = 420, H = 90, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'B', 7, 21, [[150, 2], [270, 2], [350, 3]]);
    const S = c => top[c], T = TIERS(H);
    [40, 120, 220, 320].forEach((c, i) => tower(g, c, S(c), T[2] - 6, 'B', { w: 5, window: true, banner: true, torch: true }));
    terrace(g, 24, 60, T[0], 'B', { batt: true, torch: true, banner: true });
    terrace(g, 170, 80, T[0], 'B', { batt: true, torch: true, window: true });
    terrace(g, 90, 70, T[1], '#', { batt: true, torch: true });
    terrace(g, 240, 80, T[1], 'B', { batt: true, torch: true, window: true });
    terrace(g, 150, 80, T[2], 'B', { batt: true, torch: true, banner: true });
    climb(g, 14, S(14) - 4, T[0] + 1, '#', 1); climb(g, 110, T[0] - 2, T[1] + 1, '=', 1);
    climb(g, 180, T[1] - 2, T[2] + 1, '#', 1); climb(g, 300, S(300) - 4, T[0] + 1, '#', -1);
    sandColumn(g, 100, S(100), 2, 'R'); sandColumn(g, 101, S(101), 2, 'R');
    sandBridge(g, 150, 2, S(150) - 5, 3, 'A'); sandBridge(g, 270, 2, S(270) - 5, 3, 'R');
    for (let c = 6; c < W - 10; c += 5) coinAt(g, c, top[c] - 2);
    coinLine(g, T[0] - 2, 26, 95); coinLine(g, T[1] - 2, 92, 175); coinLine(g, T[2] - 2, 152, 225);
    put(g, 188, T[2] - 2, 'H'); put(g, 130, T[1] - 2, 'H');
    // throne keep at the end
    const kb = S(388);
    rect(g, 380, kb - 14, 20, 3, 'B'); hline(g, kb - 15, 380, 399, 'B');
    for (let i = 0; i < 20; i += 3) put(g, 380 + i, kb - 16, 'B');
    vline(g, 399, kb - 14, kb - 1, 'B');
    put(g, 384, kb - 13, 'N'); put(g, 394, kb - 13, 'N'); put(g, 389, kb - 14, 'L');
    put(g, 379, kb - 4, 't'); put(g, 398, kb - 4, 't'); put(g, 397, kb - 2, '$'); put(g, 398, kb - 2, '$');
    [60, 130, 230, 300].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    for (let c = 3; c < 376; c += 7) air(g, c, top[c] - 1, 'G');
    put(g, 3, S(3) - 1, 'P'); put(g, 372, S(372) - 1, 'E');
    enemies(g, S, [16, 40, 90, 130, 200, 260, 330], 'z');
    enemies(g, S, [60, 110, 180, 240, 310], 'w');
    enemies(g, S, [50, 140, 210, 290, 360], 'r');
    enemiesAt(g, [40, 60, 180, 210], T[0] - 1, 'z'); enemiesAt(g, [50, 200], T[0] - 1, 'r');
    enemiesAt(g, [100, 130, 260, 290], T[1] - 1, 'w'); enemiesAt(g, [120, 270], T[1] - 1, 'r');
    enemiesAt(g, [160, 190, 210], T[2] - 1, 'z'); enemiesAt(g, [175], T[2] - 1, 'd');
    put(g, 110, S(110) - 1, 'd'); put(g, 320, S(320) - 1, 'd');
    put(g, 390, kb - 1, 'O');
    return { name: 'O TRONO DO DEVORADOR', sub: 'Cruze o campo dilacerado e destrua o Devorador de Mentes.', win: 'boss', biome: 'battlefield', sky: ['#5a2018', '#160808'], bannerColor: '#6a1a1a', rows: toRows(g) };
  }

  // ---------- TEST STAGE — calibrate animations ---------------
  function lvlTest() {
    const W = 340, H = 50, g = blank(W, H), gr = H - 6;
    for (let c = 0; c < W; c++) { for (let r = gr; r < H - 2; r++) put(g, c, r, r === gr ? 'D' : '#'); put(g, c, H - 2, '~'); put(g, c, H - 1, '~'); }
    // small jumpable pit (run + jump test)
    for (let r = 0; r < H; r++) for (let k = 0; k < 3; k++) put(g, 130 + k, r, '.');
    // raised mesa (climb + run + drop-off test)
    for (let c = 190; c < 250; c++) for (let r = gr - 8; r < gr; r++) put(g, c, r, r === gr - 8 ? 'D' : '#');
    platform(g, 176, gr - 3, 6, '='); platform(g, 183, gr - 6, 6, '=');     // stairs up to mesa
    // floating platforms (jump test) on the left
    platform(g, 40, gr - 5, 8, '='); platform(g, 56, gr - 9, 8, '#'); platform(g, 74, gr - 13, 8, '=');
    // a tall ledge to fall from (fall test) on the right
    platform(g, 285, gr - 17, 16, '#'); climb(g, 270, gr - 4, gr - 16, '=', 1);
    for (let c = 6; c < W - 6; c += 4) coinAt(g, c, gr - 2);
    coinLine(g, gr - 6, 40, 47); coinLine(g, gr - 18, 285, 300);
    // one of each enemy to watch them animate / die
    put(g, 92, gr - 1, 'z'); put(g, 104, gr - 1, 'w'); put(g, 160, gr - 1, 'r'); put(g, 220, gr - 9, 'z'); put(g, 256, gr - 1, 'd');
    put(g, 3, gr - 1, 'P'); put(g, W - 5, gr - 1, 'E');
    return { name: 'FASE DE TESTES', sub: 'Corra longas distâncias, pule e caia para avaliar as animações.', win: 'exit', biome: 'castle', sky: ['#3a4a6e', '#15182a'], bannerColor: '#8a2b2b', rows: toRows(g) };
  }

  return [lvl1(), lvl2(), lvl3(), lvl4(), lvlTest()];
})();

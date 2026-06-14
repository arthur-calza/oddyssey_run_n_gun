/* ============================================================
   levels.js — vertical, explorable campaign maps (procedural)
   Ground rolls by at most ±1 tile/column, so big hills & valleys
   stay fully walkable (auto-step). Upper platform routes, sand
   columns that collapse, coins and 1-ups reward exploration.

   Legend: terrain # D B = ~ X $ C S m   A sand(cai)  R cascalho(cai)
           decor t L N I V Y G   coin o   vida H
           enemies g s a c k w z l M O   P start  E exit  2..7 prisioneiros
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

  // undulating ground (±1/col). matFn(depth) -> material char. returns top[] per column.
  function rollingGround(g, W, H, matFn, amp, seed, pits) {
    const top = new Array(W), rng = mul(seed); let gr = H - 9, target = gr;
    for (let c = 0; c < W; c++) {
      if (c % 5 === 0) target = Math.max(8, Math.min(H - 4, Math.round((H - 9) - (Math.sin(c * 0.05 + seed) * amp + Math.sin(c * 0.13) * amp * 0.5 + (rng() * 2 - 1) * 1.2))));
      if (gr < target) gr++; else if (gr > target) gr--;
      top[c] = gr;
      for (let r = gr; r < H - 2; r++) put(g, c, r, matFn(r - gr));
      put(g, c, H - 2, '~'); put(g, c, H - 1, '~');
    }
    (pits || []).forEach(([c, w]) => { for (let r = 0; r < H; r++) for (let k = 0; k < w; k++) put(g, c + k, r, '.'); });
    return top;
  }
  function platform(g, c, r, w, mat) { hline(g, r, c, c + w - 1, mat); }
  function tower(g, c, baseR, mat, o) {
    o = o || {}; const w = o.w || 4, topR = baseR - (o.tall || 11), bottom = baseR - 3;
    rect(g, c, topR, w, bottom - topR, mat);
    for (let i = 0; i < w; i += 2) put(g, c + i, topR - 1, mat);
    if (o.window) put(g, c + (w >> 1), topR + 2, 'N');
    if (o.banner) put(g, c + (w >> 1), topR + 1, 'L');
    if (o.torch) { put(g, c - 1, baseR - 4, 't'); put(g, c + w, baseR - 4, 't'); }
  }
  // a sand/gravel column resting on the ground — shoot the base and it all caves in
  function sandColumn(g, c, baseR, h, mat) { for (let i = 1; i <= h; i++) put(g, c, baseR - i, mat); }
  // coins
  const coinAt = (g, c, r) => air(g, c, r, 'o');
  function coinLine(g, r, c0, c1, step) { for (let c = c0; c <= c1; c += step) coinAt(g, c, r); }
  function coinArc(g, cx, baseR, span, hgt) { for (let i = -span; i <= span; i++) { const r = baseR - Math.round(hgt * (1 - (i / span) * (i / span))); coinAt(g, cx + i, r); } }
  // a wooden ledge over a pit, loaded with sand: break the wood and the sand caves into the gap
  function sandBridge(g, c0, w, r, sandH, mat) { hline(g, r, c0, c0 + w - 1, '='); for (let i = 0; i < sandH; i++) hline(g, r - 1 - i, c0, c0 + w - 1, mat || 'A'); }

  // ---------- LEVEL 1 — castle, sky route ----------------------
  function lvl1() {
    const W = 168, H = 30, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : (d < 6 ? 'D' : '#'), 6, 3, [[70, 2], [120, 2]]);
    const S = c => top[c];
    // overhead towers anchored to local ground
    [18, 46, 86, 116, 150].forEach((c, i) => tower(g, c, S(c), 'B', { w: 4, window: true, banner: i % 2 === 0, torch: true }));
    // upper sky-route platforms (climb up for coins / a 1-up)
    platform(g, 30, S(30) - 6, 7, '='); platform(g, 40, S(40) - 10, 6, '#'); platform(g, 52, S(52) - 13, 6, '=');
    platform(g, 96, S(96) - 6, 7, '='); platform(g, 106, S(106) - 10, 6, '#'); platform(g, 132, S(132) - 7, 7, '=');
    put(g, 54, S(52) - 14, 'H');                       // a heart high on the sky route
    coinArc(g, 35, S(35) - 1, 4, 4); coinArc(g, 101, S(101) - 1, 4, 4);
    coinLine(g, S(52) - 14, 52, 57, 1); coinLine(g, S(106) - 11, 106, 111, 1);
    // collapsing sand columns + a sand bridge over the first pit
    sandColumn(g, 64, S(64), 2, 'A'); sandColumn(g, 65, S(65), 2, 'A');
    sandBridge(g, 70, 2, S(70) - 5, 3, 'A'); coinLine(g, S(70) - 9, 70, 71, 1);
    // ground trail of coins
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    // kegs / treasure
    [24, 60, 100, 140].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    put(g, 144, S(144) - 1, '$'); put(g, 145, S(145) - 1, '$');
    // grass
    for (let c = 3; c < W - 3; c += 6) air(g, c, top[c] - 1, 'G');
    // actors
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    put(g, 53, S(53) - 1, '2');                        // Ladina
    [14, 30, 50, 78, 92, 110, 128, 152].forEach(c => put(g, c, S(c) - 1, 'g'));
    [22, 66, 104, 138].forEach(c => put(g, c, S(c) - 1, 's'));
    put(g, 41, S(40) - 11, 'a'); put(g, 107, S(106) - 11, 'a');
    [84, 124].forEach(c => put(g, c, S(c) - 1, 'c'));
    return { name: 'MURALHAS DE FERRO', sub: 'Escale as muralhas, salve a Ladina e alcance a saída.', win: 'exit', biome: 'castle', sky: ['#3a4a6e', '#15182a'], bannerColor: '#8a2b2b', rows: toRows(g) };
  }

  // ---------- LEVEL 2 — village, hills & cellars ---------------
  function lvl2() {
    const W = 184, H = 30, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'S', 7, 7, [[96, 2]]);
    const S = c => top[c];
    [16, 44, 80, 120, 158].forEach((c, i) => { rect(g, c, S(c) - 8, 9, 3, 'S'); hline(g, S(c) - 9, c, c + 8, '='); put(g, c + 4, S(c) - 7, 'N'); put(g, c + 2, S(c) - 10, 't'); if (i % 2) put(g, c + 4, S(c) - 10, 'L'); });
    // stepped platforms up to rooftops (coins + heart)
    platform(g, 30, S(30) - 6, 6, '='); platform(g, 38, S(38) - 10, 6, '='); platform(g, 60, S(60) - 7, 6, '#'); platform(g, 100, S(100) - 7, 7, '='); platform(g, 140, S(140) - 9, 7, '#');
    coinLine(g, S(38) - 11, 38, 43, 1); put(g, 103, S(100) - 8, 'H');
    coinArc(g, 70, S(70) - 1, 5, 5); coinArc(g, 130, S(130) - 1, 4, 4);
    // sand mounds & a gravel pile that collapse
    sandColumn(g, 52, S(52), 2, 'A'); sandColumn(g, 53, S(53), 2, 'A'); sandColumn(g, 54, S(54), 2, 'A');
    sandColumn(g, 110, S(110), 2, 'R'); sandColumn(g, 111, S(111), 2, 'R');
    sandBridge(g, 96, 2, S(96) - 6, 3, 'A'); coinLine(g, S(96) - 10, 96, 97, 1);
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    [24, 70, 134, 166].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    [10, 92].forEach(c => put(g, c, S(c) - 1, 'V'));
    put(g, 168, S(168) - 1, '$'); put(g, 169, S(169) - 1, '$');
    for (let c = 3; c < W - 3; c += 6) air(g, c, top[c] - 1, 'G');
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    put(g, 39, S(39) - 1, '3'); put(g, 145, S(145) - 1, '4');
    [12, 28, 66, 88, 116, 150, 172].forEach(c => put(g, c, S(c) - 1, 'g'));
    [40, 104, 132].forEach(c => put(g, c, S(c) - 1, 'l'));
    [20, 74, 124, 160].forEach(c => put(g, c, S(c) - 1, 'c'));
    [58, 108].forEach(c => put(g, c, S(c) - 1, 's'));
    return { name: 'VILA DOS LAMENTOS', sub: 'Suba pelos telhados e desça aos becos; salve o Mago e a Barda.', win: 'exit', biome: 'village', sky: ['#5a4a3a', '#1a1410'], bannerColor: '#7a2a4a', rows: toRows(g) };
  }

  // ---------- LEVEL 3 — dungeon, shafts & chasms --------------
  function lvl3() {
    const W = 176, H = 30, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 1 ? 'C' : (d % 4 === 3 ? 'm' : 'C'), 7, 13, [[58, 2], [118, 2]]);
    const S = c => top[c];
    hline(g, 0, 0, W - 1, 'm'); hline(g, 1, 0, W - 1, 'm');           // catacomb ceiling
    [14, 34, 56, 80, 104, 134, 160].forEach((c, i) => { vline(g, c, 2, 5, 'C'); if (i % 2) air(g, c + 1, 6, 'Y'); put(g, c, S(c) - 4, 't'); });
    // vertical climbs between tiers
    platform(g, 24, S(24) - 6, 7, 'C'); platform(g, 34, S(34) - 10, 6, 'm'); platform(g, 44, S(44) - 13, 6, 'C');
    platform(g, 90, S(90) - 6, 7, 'C'); platform(g, 100, S(100) - 10, 6, 'm'); platform(g, 146, S(146) - 8, 8, 'C');
    put(g, 46, S(44) - 14, 'H'); coinLine(g, S(44) - 14, 44, 49, 1);
    coinArc(g, 70, S(70) - 1, 4, 5); coinArc(g, 128, S(128) - 1, 4, 4);
    sandColumn(g, 50, S(50), 2, 'R'); sandColumn(g, 51, S(51), 2, 'R');
    sandBridge(g, 58, 2, S(58) - 5, 3, 'R'); coinLine(g, S(58) - 9, 58, 59, 1);
    sandColumn(g, 112, S(112), 2, 'A'); sandColumn(g, 113, S(113), 2, 'A');
    for (let c = 6; c < W - 6; c += 5) coinAt(g, c, top[c] - 2);
    [30, 86, 140].forEach(c => put(g, c, S(c) - 1, 'X'));
    put(g, 36, S(36) - 1, 'm'); put(g, 37, S(37) - 1, 'm'); put(g, 96, S(96) - 1, 'm');
    put(g, 3, S(3) - 1, 'P'); put(g, W - 5, S(W - 5) - 1, 'E');
    put(g, 45, S(45) - 1, '5'); put(g, 150, S(150) - 1, '6');
    [12, 32, 64, 84, 110, 138, 164].forEach(c => put(g, c, S(c) - 1, 's'));
    [52, 108, 144].forEach(c => put(g, c, S(c) - 1, 'a'));
    [42, 92, 126].forEach(c => put(g, c, S(c) - 6, 'w'));
    [70, 120].forEach(c => put(g, c, S(c) - 1, 'z'));
    put(g, 100, S(100) - 1, 'M');
    return { name: 'CATACUMBAS PROFUNDAS', sub: 'Galerias verticais — solte o Bárbaro e a Druida. Cuidado com o ogro.', win: 'exit', biome: 'dungeon', sky: ['#1a1622', '#0a070e'], bannerColor: '#3a2a5a', rows: toRows(g) };
  }

  // ---------- LEVEL 4 — battlefield & throne ------------------
  function lvl4() {
    const W = 210, H = 30, g = blank(W, H);
    const top = rollingGround(g, W, H, d => d < 2 ? 'D' : 'B', 6, 21, [[78, 2], [140, 2]]);
    const S = c => top[c];
    [18, 48, 84, 116].forEach((c, i) => tower(g, c, S(c), 'B', { w: 4, window: i % 2 === 0, banner: true, torch: true }));
    // siege ramps up to the keep
    platform(g, 34, S(34) - 6, 7, '#'); platform(g, 64, S(64) - 9, 7, '='); platform(g, 100, S(100) - 7, 7, '#'); platform(g, 150, S(150) - 8, 8, '#');
    put(g, 67, S(64) - 10, 'H'); coinArc(g, 50, S(50) - 1, 5, 5); coinArc(g, 124, S(124) - 1, 4, 5);
    sandColumn(g, 72, S(72), 2, 'R'); sandColumn(g, 73, S(73), 2, 'R');
    sandBridge(g, 78, 2, S(78) - 5, 3, 'A'); coinLine(g, S(78) - 9, 78, 79, 1);
    sandColumn(g, 132, S(132), 2, 'A'); sandColumn(g, 133, S(133), 2, 'A');
    for (let c = 6; c < W - 8; c += 5) coinAt(g, c, top[c] - 2);
    // the open throne keep at the end
    const kb = S(186);
    rect(g, 178, kb - 13, 18, 3, 'B'); hline(g, kb - 14, 178, 195, 'B');
    for (let i = 0; i < 18; i += 3) put(g, 178 + i, kb - 15, 'B');
    vline(g, 195, kb - 13, kb - 1, 'B');
    put(g, 182, kb - 12, 'N'); put(g, 191, kb - 12, 'N'); put(g, 186, kb - 13, 'L');
    put(g, 177, kb - 4, 't'); put(g, 194, kb - 4, 't');
    put(g, 193, kb - 2, '$'); put(g, 194, kb - 2, '$');
    [28, 56, 96, 126].forEach(c => { put(g, c, S(c) - 1, 'X'); put(g, c + 1, S(c) - 1, 'X'); });
    for (let c = 3; c < 176; c += 7) air(g, c, top[c] - 1, 'G');
    put(g, 3, S(3) - 1, 'P'); put(g, 170, S(170) - 1, 'E');
    put(g, 35, S(35) - 1, '7');
    [12, 30, 60, 104, 144].forEach(c => put(g, c, S(c) - 1, 'k'));
    [46, 90, 120, 156].forEach(c => put(g, c, S(c) - 1, 'z'));
    [54, 98, 134].forEach(c => put(g, c, S(c) - 6, 'w'));
    put(g, 110, S(110) - 1, 'M');
    put(g, 188, kb - 1, 'O');
    return { name: 'O TRONO DO LICH-REI', sub: 'Cruze o campo dilacerado e destrua o Lich-Rei.', win: 'boss', biome: 'battlefield', sky: ['#5a2018', '#160808'], bannerColor: '#6a1a1a', rows: toRows(g) };
  }

  return [lvl1(), lvl2(), lvl3(), lvl4()];
})();

/* ============================================================
   buildings.js — prefabs de CONSTRUÇÕES reutilizáveis.
   Cada prefab "carimba" (stamp) sua estrutura numa grade de chars:
     g  = camada sólida/decoração (mesmos chars do level loader)
     bg = camada de fundo (interior preenchido)
   Usado tanto pelas FASES (levels.js) quanto pela GALERIA (preview).
   Convenção: stamp(g, bg, c0, baseR, opt)
     c0    = coluna esquerda da construção
     baseR = linha do CHÃO (a construção sobe a partir daqui)
   Cada def tem w/h (em tiles) p/ a galeria dimensionar o preview.
   ============================================================ */
(function () {
  const put = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch; };
  const air = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length && g[r][c] === '.') g[r][c] = ch; };
  const hline = (g, r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) put(g, c, r, ch); };
  const vline = (g, c, r0, r1, ch) => { for (let r = r0; r <= r1; r++) put(g, c, r, ch); };
  const bgrect = (bg, c0, r0, w, h, ch) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) put(bg, c, r, ch); };
  const ladder = (g, c, r0, r1) => { for (let r = r0; r <= r1; r++) put(g, c, r, 'h'); };

  // casca genérica: paredes laterais (com vão de passagem embaixo) + teto + interior + escada
  function shell(g, bg, c0, baseR, w, h, wall, bgch, o) {
    o = o || {}; const top = baseR - h, lc = c0, rc = c0 + w - 1, ladc = c0 + 1;
    bgrect(bg, c0, top, w, h, bgch);
    vline(g, lc, top, baseR - 3, wall); vline(g, rc, top, baseR - 3, wall);     // paredes (vão de 2 embaixo p/ atravessar)
    hline(g, top, c0, rc, o.roof || wall);                                       // teto
    if (o.crenel) for (let i = 0; i < w; i += 3) put(g, c0 + i, top - 1, o.roof || wall); // ameias
    if (o.ladder !== false) ladder(g, ladc, top + 1, baseR - 1);                 // escada interna
    return { top, lc, rc, ladc };
  }
  // piso horizontal com furo para a escada
  function floorRow(g, c0, w, fr, mat, ladc) { hline(g, fr, c0, c0 + w - 1, mat); if (ladc != null) put(g, ladc, fr, '.'); }

  const BUILDINGS = [
    {
      key: 'casaPequena', name: 'Casa pequena', desc: 'Choupana de reboco e madeira com telhado de barro.',
      w: 8, h: 5, ground: 'D',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'g', 'g', { roof: '^', ladder: false });
        vline(g, c0, s.top, baseR - 3, 'e'); vline(g, c0 + w - 1, s.top, baseR - 3, 'e');   // cantos de viga
        for (let i = -1; i < w; i++) put(g, c0 + i, s.top - 1, '^');                          // beiral do telhado
        put(g, c0 + 3, s.top + 1, 'N'); put(g, c0 + 5, s.top + 1, 'N');                       // janelas
        air(g, c0 + 1, baseR - 1, 'W'); air(g, c0 + w - 2, baseR - 1, '}');                   // lanterna + flores
        if (o.enemy !== false) put(g, c0 + (w >> 1), baseR - 1, o.enemy || 'z');
      }
    },
    {
      key: 'casaGrande', name: 'Casa grande', desc: 'Sobrado de enxaimel: dois andares, mobília e sótão.',
      w: 12, h: 9, ground: 'D',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'g', 'g', { roof: '^', crenel: false });
        vline(g, c0, s.top, baseR - 3, 'e'); vline(g, c0 + w - 1, s.top, baseR - 3, 'e');
        for (let i = -1; i <= w; i++) put(g, c0 + i, s.top - 1, '^');                          // beiral largo
        floorRow(g, c0, w, baseR - 4, '&', s.ladc); floorRow(g, c0, w, baseR - 4 - 4, '&', s.ladc); // 2 pisos de madeira
        put(g, c0 + (w >> 1), baseR - 6, 'N'); put(g, c0 + (w >> 1), baseR - 2, 'N');
        air(g, c0 + 2, baseR - 5, '"'); air(g, c0 + w - 3, baseR - 5, '|');                    // estante + mesa (1º andar)
        air(g, c0 + 3, baseR - 1, '|'); air(g, c0 + 1, baseR - 1, 'W');
        air(g, c0 + w - 2, baseR - 9, '}');
        if (o.enemy !== false) { put(g, c0 + (w >> 1) + 2, baseR - 1, o.enemy || 'z'); put(g, c0 + (w >> 1) - 1, baseR - 5, o.enemy || 'z'); }
      }
    },
    {
      key: 'taverna', name: 'Taverna', desc: 'Estalagem com placa, barris, mesas e candeeiros.',
      w: 14, h: 7, ground: 'D',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'b', 'b', { roof: '^' });
        for (let c = c0 + 1; c < c0 + w - 1; c++) put(g, c, baseR - 4, 'l');                   // mezanino de tábuas
        put(g, s.ladc, baseR - 4, '.');
        for (let i = -1; i <= w; i++) put(g, c0 + i, s.top - 1, '^');
        air(g, c0 + 2, s.top + 1, '_');                                                        // placa
        put(g, c0 + 4, baseR - 1, 'M'); put(g, c0 + 5, baseR - 1, 'X');                        // barris/caixas
        air(g, c0 + 8, baseR - 1, '|'); air(g, c0 + 10, baseR - 1, '|');                       // mesas
        air(g, c0 + 3, baseR - 5, ':'); air(g, c0 + w - 3, baseR - 5, ':');                    // velas no mezanino
        air(g, c0 + w - 2, baseR - 1, 'W');
        put(g, c0 + (w >> 1), baseR - 6, 'N');
        if (o.enemy !== false) { put(g, c0 + 7, baseR - 1, o.enemy || 'z'); put(g, c0 + 9, baseR - 5, o.enemy || 'z'); }
      }
    },
    {
      key: 'torreVigia', name: 'Torre de vigilância', desc: 'Torre alta de pedra com escada e mirante ameado.',
      w: 6, h: 14, ground: '#',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'c', 'c', { crenel: true });
        for (let f = 1; f <= 2; f++) floorRow(g, c0, w, baseR - 5 * f, 'c', s.ladc);           // plataformas internas
        put(g, c0 + (w >> 1), baseR - 8, 'N'); put(g, c0 + (w >> 1), baseR - 3, 'N');
        air(g, c0 + 1, s.top + 1, 't'); air(g, c0 + w - 2, s.top + 1, 'L');                     // tocha + estandarte no topo
        air(g, c0 + 2, baseR - 1, '[');
        if (o.enemy !== false) { put(g, c0 + (w >> 1), s.top + 1, o.enemy || 'r'); put(g, c0 + 2, baseR - 6, 'z'); }
      }
    },
    {
      key: 'postoComando', name: 'Posto de comando', desc: 'Bastião fortificado: mesa de guerra, escudos e estandartes.',
      w: 13, h: 7, ground: '#',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'c', 'c', { roof: 'q', crenel: true });
        for (let c = c0 + 1; c < c0 + w - 1; c++) put(g, c, baseR - 4, 'q');                   // piso de metal (mezanino)
        put(g, s.ladc, baseR - 4, '.');
        hline(g, baseR - 1, c0 + 1, c0 + w - 2, '%');                                          // tapete
        air(g, c0 + 3, s.top + 1, 'L'); air(g, c0 + w - 4, s.top + 1, 'L');                     // estandartes
        air(g, c0 + 2, baseR - 5, '{'); air(g, c0 + w - 3, baseR - 5, '{');                     // escudos
        air(g, c0 + (w >> 1), baseR - 1, '|');                                                 // mesa de guerra
        air(g, c0 + (w >> 1) - 2, baseR - 1, 'W'); air(g, c0 + (w >> 1) + 2, baseR - 1, 'W');
        put(g, c0 + 4, baseR - 5, 'N'); put(g, c0 + w - 5, baseR - 5, 'N');
        if (o.enemy !== false) { put(g, c0 + 3, baseR - 1, o.enemy || 'r'); put(g, c0 + w - 4, baseR - 1, o.enemy || 'r'); put(g, c0 + (w >> 1), baseR - 5, 'd'); }
      }
    },
    {
      key: 'dormitorioMilitar', name: 'Dormitório militar', desc: 'Alojamento de tropas: beliches, baús e armário de armas.',
      w: 14, h: 6, ground: '#',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'C', 'C', { roof: 'C' });
        for (let c = c0 + 1; c < c0 + w - 1; c++) put(g, c, baseR - 3, '&');                   // assoalho do 2º nível
        put(g, s.ladc, baseR - 3, '.');
        air(g, c0 + 2, baseR - 1, "'"); air(g, c0 + 5, baseR - 1, "'"); air(g, c0 + 8, baseR - 1, "'"); // catres
        air(g, c0 + 3, baseR - 4, "'"); air(g, c0 + 6, baseR - 4, "'");                          // catres em cima
        put(g, c0 + w - 3, baseR - 1, 'U'); put(g, c0 + w - 4, baseR - 1, 'M');                  // rack + caixa
        air(g, c0 + 1, baseR - 4, 'W'); put(g, c0 + (w >> 1), baseR - 5, 'N');
        if (o.enemy !== false) { put(g, c0 + 10, baseR - 1, o.enemy || 'z'); put(g, c0 + 7, baseR - 4, o.enemy || 'z'); put(g, c0 + 12, baseR - 1, 'w'); }
      }
    },
    {
      key: 'altarFeiticaria', name: 'Altar de feitiçaria', desc: 'Santuário sombrio: runas, cristais, caldeirão e ídolo.',
      w: 12, h: 7, ground: 'C',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, '*', '*', { roof: '+', crenel: true });
        vline(g, c0 + 2, baseR - 5, baseR - 3, '+'); vline(g, c0 + w - 3, baseR - 5, baseR - 3, '+'); // colunas rúnicas
        put(g, c0 + 2, baseR - 6, '<'); put(g, c0 + w - 3, baseR - 6, '<');                    // cristais no topo das colunas
        hline(g, baseR - 1, c0 + 1, c0 + w - 2, '%');                                          // tapete ritual
        air(g, c0 + (w >> 1), baseR - 1, ';');                                                 // caldeirão central
        air(g, c0 + (w >> 1) - 3, baseR - 1, 'Z'); air(g, c0 + (w >> 1) + 3, baseR - 1, 'Z');   // ídolos
        air(g, c0 + 1, baseR - 5, ':'); air(g, c0 + w - 2, baseR - 5, ':');                     // velas
        air(g, c0 + 3, s.top + 1, 'Y'); air(g, c0 + w - 4, s.top + 1, 'Y');                     // teias
        if (o.enemy !== false) { put(g, c0 + (w >> 1), baseR - 1, 'd'); put(g, c0 + 3, baseR - 1, 'z'); }
      }
    },
    {
      key: 'armazemExplosivos', name: 'Armazém de explosivos', desc: 'Depósito de pólvora e foguetes — cuidado com a cadeia!',
      w: 14, h: 7, ground: '#',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const s = shell(g, bg, c0, baseR, w, h, 'x', 'x', { roof: 'q' });
        for (let c = c0 + 1; c < c0 + w - 1; c++) put(g, c, baseR - 4, 'l');                   // prateleira de tábuas
        put(g, s.ladc, baseR - 4, '.');
        ['X', 'K', 'X', 'K'].forEach((b, i) => put(g, c0 + 3 + i * 2, baseR - 1, b));          // pólvora/foguetes embaixo
        put(g, c0 + 4, baseR - 5, 'K'); put(g, c0 + 6, baseR - 5, 'X'); put(g, c0 + 8, baseR - 5, 'K'); // na prateleira
        put(g, c0 + w - 3, baseR - 1, 'U'); put(g, c0 + w - 4, baseR - 1, 'M');
        air(g, c0 + 2, s.top + 1, 'L'); air(g, c0 + 1, baseR - 1, '{');
        if (o.enemy !== false) put(g, c0 + w - 5, baseR - 1, o.enemy || 'r');
      }
    },
    {
      key: 'muralhaPortao', name: 'Muralha com portão', desc: 'Trecho de muralha com torres e passagem fortificada.',
      w: 16, h: 9, ground: '#',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const top = baseR - h;
        bgrect(bg, c0, top, w, h, 'B');
        // torres nas pontas
        [c0, c0 + w - 2].forEach(tc => { vline(g, tc, top, baseR - 1, 'B'); vline(g, tc + 1, top, baseR - 1, 'B'); for (let i = 0; i < 2; i++) put(g, tc + i, top - 1, 'B'); });
        // parapeito ligando as torres (passa-se por baixo, pelo portão)
        hline(g, top + 1, c0 + 2, c0 + w - 3, 'B'); hline(g, top + 2, c0 + 2, c0 + w - 3, 'B');
        for (let i = 2; i < w - 2; i += 3) put(g, c0 + i, top, 'B');                            // ameias
        air(g, c0 + (w >> 1) - 1, top + 1, 'L');                                                // estandarte
        air(g, c0 + 1, baseR - 1, 't'); air(g, c0 + w - 2, baseR - 1, 't');                     // tochas no portão
        ladder(g, c0 + 1, top + 3, baseR - 1); ladder(g, c0 + w - 2, top + 3, baseR - 1);
        if (o.enemy !== false) { put(g, c0 + 3, top + 1, o.enemy || 'z'); put(g, c0 + w - 4, top + 1, o.enemy || 'z'); }
      }
    },
    {
      key: 'ruinaTemplo', name: 'Ruína de templo', desc: 'Zigurate de pedra esculpida tomado pela mata.',
      w: 13, h: 8, ground: 'j',
      stamp(g, bg, c0, baseR, o) {
        o = o || {}; const w = this.w, h = this.h; const top = baseR - h;
        bgrect(bg, c0, top, w, h, 'p');
        // degraus de zigurate
        for (let f = 0; f < 4; f++) { const fr = baseR - 1 - f * 2, c1 = c0 + f, c2 = c0 + w - 1 - f; hline(g, fr, c1, c2, 'p'); hline(g, fr - 1, c1, c2, 'p'); }
        // câmara interna no topo
        const tc = c0 + (w >> 1);
        vline(g, tc - 3, top + 1, baseR - 7, 'k'); vline(g, tc + 3, top + 1, baseR - 7, 'k');
        hline(g, top, tc - 3, tc + 3, 'k');
        air(g, tc, baseR - 8, 'Z');                                                            // ídolo no santuário
        air(g, tc - 2, top + 1, 'V'); air(g, tc + 2, top + 1, 'V');                             // vinhas
        air(g, c0 + 1, baseR - 1, 'v'); air(g, c0 + w - 2, baseR - 1, 'v');                     // folhagem nas bordas
        if (o.enemy !== false) { put(g, tc, baseR - 9, o.enemy || 'r'); put(g, c0 + 3, baseR - 3, 'z'); }
      }
    },
  ];

  // índice por chave (conveniência)
  const BY_KEY = {}; BUILDINGS.forEach(b => BY_KEY[b.key] = b);
  window.BUILDINGS = BUILDINGS;
  window.BUILD = BY_KEY;
})();

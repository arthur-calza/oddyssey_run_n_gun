/* ============================================================
   dungeons.js — REDES DE TÚNEIS SUBTERRÂNEOS (dungeons).
   Muito maiores que as Construções: uma dungeon pode ter ~120
   tiles de largura e 20-30 de profundidade, com ATÉ 3 ANDARES
   de corredores (2-4 tiles de altura), câmaras temáticas, escadas
   que ligam os andares e alçapões vindos da superfície. Guarda
   tesouros (orégano/tokens) e monstros espalhados.

   `carveDungeon(g, bg, c0, surfR, o)` ESCAVA a rede no terreno
   (terra/pedra já preenchidos ao redor). Usado tanto pelas FASES
   (levels.js) quanto pela ENCICLOPÉDIA (gallery.js, aba Masmorras).
   ============================================================ */
(function () {
  const put = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch; };
  const air = (g, c, r, ch) => { if (r >= 0 && r < g.length && c >= 0 && c < g[0].length && g[r][c] === '.') g[r][c] = ch; };
  const bgp = (bg, c, r, ch) => { if (bg && r >= 0 && r < bg.length && c >= 0 && c < bg[0].length) bg[r][c] = ch; };
  const hline = (g, r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) put(g, c, r, ch); };
  const mul = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const rndi = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const pickr = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  // corredor horizontal (2-4 de altura) com fundo sombreado
  function corridor(g, bg, cs, ce, r, h, bgm) {
    for (let c = cs; c <= ce; c++) for (let rr = r; rr < r + h; rr++) { put(g, c, rr, '.'); bgp(bg, c, rr, bgm); }
  }
  // câmara: escava uma caixa de ar + fundo
  function chamberCarve(g, bg, c0, r0, w, h, bgm) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) { put(g, c, r, '.'); bgp(bg, c, r, bgm); }
  }
  // poço de escada vertical (não-sólido) com fundo sombreado.
  // O topo vira um "alçapão" pisável (pisa no topo, desce com ↓).
  function shaft(g, bg, c, r0, r1, bgm) {
    for (let r = r0; r <= r1; r++) { put(g, c, r, 'h'); bgp(bg, c, r, bgm); }
  }

  // conteúdos de câmara (≥6 temas). Operam numa câmara já escavada (c0,r0,w,h).
  const ROOMS = {
    crypt(g, bg, c0, r0, w, h, rng) {                                  // catacumba: caixões, ossos, tesouro
      for (let c = c0 + 1; c < c0 + w - 1; c += 3) air(g, c, r0 + h - 1, "'");
      put(g, c0 + w - 2, r0 + h - 1, '$'); air(g, c0 + 1, r0, 'Y'); air(g, c0 + w - 2, r0, 'Y');
      put(g, c0 + 2, r0 + h - 1, 'z'); air(g, c0 + 3, r0 + h - 1, 'o');
    },
    vault(g, bg, c0, r0, w, h, rng) {                                  // cofre soterrado: ouro + token
      put(g, c0 + 2, r0 + h - 1, '$'); put(g, c0 + (w >> 1), r0 + h - 1, 'T'); put(g, c0 + w - 3, r0 + h - 1, '$');
      air(g, c0 + 1, r0 + h - 2, 'W'); air(g, c0 + w - 2, r0 + h - 2, 'W');
    },
    powder(g, bg, c0, r0, w, h, rng) {                                 // paiol: pólvora e foguetes
      ['X', 'K', 'X', 'K'].forEach((b, i) => put(g, c0 + 1 + i, r0 + h - 1, b));
      put(g, c0 + w - 2, r0 + h - 1, 'M'); air(g, c0 + 1, r0 + h - 1, 't');
    },
    cell(g, bg, c0, r0, w, h, rng) {                                   // masmorra: grades + recompensa + guarda
      for (let c = c0 + 1; c < c0 + w - 1; c++) put(g, c, r0, 'J');
      put(g, c0 + 2, r0 + h - 1, pickr(rng, ['Q', 'o', 'T', 'H'])); air(g, c0 + w - 3, r0 + h - 1, 'o');
      put(g, c0 + w - 2, r0 + h - 1, 'z');
    },
    grotto(g, bg, c0, r0, w, h, rng) {                                 // gruta de cristais
      for (let c = c0 + 1; c < c0 + w - 1; c += 2) put(g, c, r0 + h - 1, '<');
      put(g, c0 + (w >> 1), r0 + h - 1, 'Q'); air(g, c0 + 1, r0, 'V'); air(g, c0 + w - 2, r0, 'V');
    },
    shrine(g, bg, c0, r0, w, h, rng) {                                 // santuário sombrio: ídolo, velas, demônio
      put(g, c0 + (w >> 1), r0 + h - 1, 'Z'); air(g, c0 + 1, r0 + h - 1, ':'); air(g, c0 + w - 2, r0 + h - 1, ':');
      put(g, c0 + 2, r0 + h - 1, 'd'); air(g, c0 + (w >> 1), r0, 'Y');
    },
    den(g, bg, c0, r0, w, h, rng) {                                    // toca da matilha
      put(g, c0 + 2, r0 + h - 1, 'f'); put(g, c0 + w - 3, r0 + h - 1, 'w'); put(g, c0 + (w >> 1), r0 + h - 1, 'o');
      air(g, c0 + 1, r0 + h - 1, 'o');
    },
  };

  // ===== gerador principal da rede =====
  // o = { w, seed, mat, bg, floors(1-3), rooms[], entrances, surfAt(c)->row, cap, mob[] }
  function carveDungeon(g, bg, c0, surfR, o) {
    o = o || {}; const rng = mul((o.seed || 7) >>> 0);
    const W = o.w || 110, bgm = o.bg || 'D';
    const cap = o.cap != null ? o.cap : rndi(rng, 3, 6);
    const c1 = c0 + W - 1, nF = Math.max(1, Math.min(3, o.floors || 3));
    const mobs = o.mob || ['z', 'z', 'f', 'w', 'r'];
    const roomKeys = o.rooms || ['crypt', 'vault', 'powder', 'cell', 'grotto', 'shrine', 'den'];

    // ---- distribui ANDARES (largura/altura variáveis; cada um se conecta ao seguinte) ----
    const floors = []; let r = surfR + cap;
    for (let f = 0; f < nF; f++) {
      const h = rndi(rng, 2, 4);
      const lp = f === 0 ? 2 : rndi(rng, 2, Math.max(3, (W * 0.22) | 0));
      const rp = f === 0 ? 2 : rndi(rng, 2, Math.max(3, (W * 0.22) | 0));
      floors.push({ cs: c0 + lp, ce: c1 - rp, r, h });
      r += h + rndi(rng, 3, 5);                         // terra entre os andares
    }
    // ---- corredores ----
    floors.forEach(fl => corridor(g, bg, fl.cs, fl.ce, fl.r, fl.h, bgm));

    // ---- câmaras temáticas ao longo de cada andar ----
    floors.forEach(fl => {
      const span = fl.ce - fl.cs; if (span < 10) return;
      const nRooms = Math.max(1, Math.round(span / 24));
      for (let i = 0; i < nRooms; i++) {
        const rw = rndi(rng, 7, 10), rh = fl.h + rndi(rng, 1, 2);
        let rc = fl.cs + 2 + Math.floor((span - rw - 4) * ((i + 0.5) / nRooms)) + rndi(rng, -2, 2);
        rc = Math.max(fl.cs + 1, Math.min(rc, fl.ce - rw - 1));
        chamberCarve(g, bg, rc, fl.r, rw, rh, bgm);                    // alcova mais alta saindo do corredor
        ROOMS[pickr(rng, roomKeys)](g, bg, rc, fl.r, rw, rh, rng);
      }
      // ---- tesouros (orégano/token) e monstros espalhados pelo corredor ----
      for (let c = fl.cs + 3; c < fl.ce - 2; c += rndi(rng, 5, 9)) {
        const fr = fl.r + fl.h - 1, roll = rng();
        if (roll < 0.42) air(g, c, fr, 'o');
        else if (roll < 0.50) air(g, c, fr, 'T');
        else if (roll < 0.78) { if (g[fr][c] === '.') put(g, c, fr, pickr(rng, mobs)); }
      }
    });

    // ---- escadas ligando andares adjacentes (topo pisável; desce com ↓) ----
    for (let f = 0; f < floors.length - 1; f++) {
      const a = floors[f], b = floors[f + 1];
      const ov0 = Math.max(a.cs, b.cs) + 2, ov1 = Math.min(a.ce, b.ce) - 2;
      if (ov1 <= ov0) continue;
      shaft(g, bg, rndi(rng, ov0, ov1), a.r + a.h, b.r + b.h - 1, bgm);
      if (rng() < 0.6) shaft(g, bg, rndi(rng, ov0, ov1), a.r + a.h, b.r + b.h - 1, bgm);
    }
    // ---- alçapões da SUPERFÍCIE até o primeiro andar ----
    const nEnt = o.entrances || 2, f0 = floors[0];
    for (let e = 0; e < nEnt; e++) {
      const ec = rndi(rng, c0 + 3, c1 - 3);
      const sr = o.surfAt ? o.surfAt(ec) : surfR;
      shaft(g, bg, ec, sr, f0.r + f0.h - 1, bgm);
    }
    return floors;
  }

  // ===== CATÁLOGO p/ a ENCICLOPÉDIA (aba Masmorras) =====
  // cada def: stamp(g, bg, c0, surfR, o) — o terreno ao redor já vem preenchido.
  const D = (key, name, desc, w, h, surf, opt) => ({
    key, name, desc, w, h, surf,
    stamp(g, bg, c0, surfR, o) { carveDungeon(g, bg, c0, surfR, Object.assign({ w }, opt)); },
  });
  const DUNGEONS = [
    D('catacumba', 'Catacumba de Três Andares', 'Cripta funerária em 3 níveis: caixões, celas e um santuário sombrio.',
      104, 27, 'C', { seed: 11, bg: 'm', floors: 3, rooms: ['crypt', 'cell', 'shrine', 'crypt'], entrances: 3, mob: ['z', 'z', 'd', 'r'] }),
    D('mina', 'Mina Abandonada', 'Galerias de mineração escoradas: paióis de pólvora e veios de cristal.',
      120, 24, 'D', { seed: 23, bg: 'D', floors: 3, rooms: ['powder', 'grotto', 'vault', 'den'], entrances: 3, mob: ['z', 'f', 'w'] }),
    D('necropole', 'Necrópole', 'Cidade dos mortos em pedra escura: corredores longos e ossadas.',
      112, 28, 'k', { seed: 37, bg: 'k', floors: 3, rooms: ['crypt', 'shrine', 'crypt', 'grotto'], entrances: 3, mob: ['z', 'd', 'r'] }),
    D('cofre', 'Cofre Soterrado', 'Bunker do tesouro em dois andares fortificados: ouro e tokens.',
      88, 20, 'B', { seed: 51, bg: 'B', floors: 2, rooms: ['vault', 'cell', 'vault'], entrances: 2, mob: ['z', 'r'] }),
    D('toca', 'Toca da Matilha', 'Rede de tocas cavadas na terra: ninhos de lobos e despojos.',
      96, 22, 'D', { seed: 67, bg: 'D', floors: 2, rooms: ['den', 'cell', 'den'], entrances: 3, mob: ['f', 'w', 'F'] }),
    D('gruta', 'Gruta de Cristais', 'Caverna natural em três níveis irregulares, cheia de cristais.',
      110, 26, '#', { seed: 83, bg: 'm', floors: 3, rooms: ['grotto', 'grotto', 'shrine', 'crypt'], entrances: 3, mob: ['z', 'r', 'd'] }),
  ];

  window.carveDungeon = carveDungeon;
  window.DUNGEONS = DUNGEONS;
  window.DUNGEON_ROOMS = ROOMS;
})();

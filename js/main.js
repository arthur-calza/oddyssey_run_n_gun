/* ============================================================
   main.js — bootstrap, menus, level select, master loop
   ============================================================ */
(function () {
  const canvas = document.getElementById('game');
  const screen = document.getElementById('screen');
  const menu = document.getElementById('menu');
  const subtitle = document.querySelector('.subtitle');
  const controlsBox = document.getElementById('controlsBox');
  Input.init(canvas);
  SPR.build();        // bake procedural fallbacks
  SPR.loadImages();   // concept-art portraits (assets/*.png)
  RIG.load();         // cut-out rig parts (assets/parts/*) — the in-game characters
  Creations.load();   // criações salvas pelo jogador (editor)
  Creations.registerAll();   // registra-as como prefabs reutilizáveis (enciclopédia/editor)

  let game = new Game(canvas);
  window.GAME = game; // debug handle
  let appState = 'menu';
  let highestLevel = 0;

  // unlock audio on first interaction
  const unlock = () => { Sound.ensure(); Sound.resume(); };
  addEventListener('pointerdown', unlock, { once: false });
  addEventListener('keydown', unlock, { once: false });

  function showScreen(show) {
    screen.style.display = show ? 'flex' : 'none';
    game.showHUD(!show);
    controlsBox.style.display = (appState === 'menu') ? 'block' : 'none';
  }

  function btn(label, fn, disabled) {
    const b = document.createElement('button');
    b.className = 'mbtn'; b.textContent = label; b.disabled = !!disabled;
    b.onclick = () => { unlock(); fn(); };
    return b;
  }

  function purse() {
    const d = document.createElement('div');
    d.style.cssText = 'pointer-events:none;color:#7be08a;font-size:16px;margin-bottom:6px;letter-spacing:1px;';
    d.innerHTML = `🌿 <b>${Save.oregano}</b> orégano &nbsp;·&nbsp; <span style="color:#e0843a">⬡ ${Save.tokens} Rei do Picadão</span>`;
    return d;
  }
  function showMenu() {
    appState = 'menu'; subtitle.textContent = 'CRÔNICAS DE FERRO E SANGUE';
    menu.innerHTML = '';
    menu.appendChild(purse());
    menu.appendChild(btn('▶  INICIAR CRUZADA', () => startLevel(0)));
    menu.appendChild(btn('☰  SELECIONAR FASE', showLevelSelect));
    menu.appendChild(btn('🛒  LOJA', showShop));
    menu.appendChild(btn('♟  HERÓIS', showHeroes));
    menu.appendChild(btn('📖  ENCICLOPÉDIA VISUAL', showGallery));
    menu.appendChild(btn('🔨  CRIAÇÃO', showEditor));
    menu.appendChild(btn('🛠  FASE DE TESTES', () => startLevel(LEVELS.length - 1)));
    showScreen(true);
  }

  function showShop() {
    appState = 'shop'; subtitle.textContent = 'LOJA DO MERCADOR';
    menu.innerHTML = ''; menu.appendChild(purse());
    PERKS.forEach(perk => {
      const owned = Save.hasPerk(perk.id);
      const b = btn(`${owned ? '✔ ' : ''}${perk.name} — ${owned ? 'ADQUIRIDO' : '🌿 ' + perk.cost}`, () => {
        if (!owned && Save.buy(perk.id, perk.cost)) { Sound.coin(); showShop(); }
        else if (!owned) { Sound.hurt(); }
      }, owned || Save.oregano < perk.cost);
      b.title = perk.desc; b.style.fontSize = '15px';
      const wrap = document.createElement('div'); wrap.style.cssText = 'pointer-events:auto;text-align:left;';
      wrap.appendChild(b);
      const dd = document.createElement('div'); dd.style.cssText = 'color:#9a8f7d;font-size:12px;margin:-4px 0 8px 4px;'; dd.textContent = perk.desc;
      wrap.appendChild(dd); menu.appendChild(wrap);
    });
    const note = document.createElement('div'); note.style.cssText = 'color:#9a8f7d;font-size:12px;margin-top:4px;';
    note.textContent = 'Os tokens "Rei do Picadão" são artefatos colecionáveis — junte-os para recompensas futuras.';
    menu.appendChild(note);
    menu.appendChild(btn('‹ Voltar', showMenu));
    showScreen(true);
  }

  // seletor de fases = MAPA-MÚNDI top-down (ilha de Termath)
  function showLevelSelect() {
    appState = 'map';
    screen.style.display = 'none';          // libera o canvas para o mapa
    controlsBox.style.display = 'none';
    game.showHUD(false);
    WorldMap.open(canvas, {
      onBack: () => { WorldMap.close(); showMenu(); },
      onPlay: (i) => { WorldMap.close(); startLevel(i); },
    });
  }

  function showHeroes() {
    appState = 'heroes'; subtitle.textContent = 'OS LIBERTADORES';
    menu.innerHTML = '';
    HEROES.forEach(h => {
      const d = document.createElement('div');
      d.style.cssText = 'pointer-events:auto;background:#241a10;border:2px solid #5a4326;border-radius:8px;padding:10px 14px;text-align:left;';
      d.innerHTML = `<div style="color:#e8b94a;font-size:17px">${h.icon} ${h.name}</div>
        <div style="color:#9a8f7d;font-size:13px;margin-top:3px">${h.desc}</div>`;
      menu.appendChild(d);
    });
    menu.appendChild(btn('‹ Voltar', showMenu));
    showScreen(true);
  }

  function showGallery() {
    appState = 'gallery';
    screen.style.display = 'none';          // libera o canvas para o visualizador
    controlsBox.style.display = 'none';
    game.showHUD(false);
    Gallery.open(canvas, () => { Gallery.close(); showMenu(); });
  }

  function showEditor() {
    appState = 'editor';
    screen.style.display = 'none';          // libera o canvas para a ferramenta
    controlsBox.style.display = 'none';
    game.showHUD(false);
    Editor.open(canvas, {
      onBack: () => { Editor.close(); showMenu(); },
      onPlay: (def) => { Editor.close(); startEditorTest(def); },
    });
  }

  // joga uma CRIAÇÃO do editor como fase temporária (botão "Testar")
  function startEditorTest(def) {
    appState = 'playing';
    resumeGame();
    game.testMode = false;
    game.roster = [0, 1, 2, 3, 4]; game.currentHero = 0; game.score = 0;
    game.oregano = 0; game.tokens = 0; game.nextLifeAt = 50;
    game.lives = 3; game.levelIndex = -1; game._editorReturn = true;
    game.onEnd = (res) => {
      game._editorReturn = false;
      Sound.music && Sound.music.stop();
      showEditor();                          // volta direto à ferramenta
    };
    game.loadLevelDef(def);
    showScreen(false);
    Sound.music && Sound.music.start(0);
  }

  // ---- micromenu de PAUSA -----------------------------------
  let pauseEl = null, controlsEl = null, controlsOpen = false;
  function buildPauseMenu() {
    if (pauseEl) return pauseEl;
    const ov = document.createElement('div');
    ov.id = 'pauseMenu';
    ov.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;';
    const title = document.createElement('div');
    title.style.cssText = 'color:#e8b94a;font-size:44px;letter-spacing:4px;text-shadow:2px 2px 0 #000;';
    title.textContent = 'PAUSADO';
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:min(360px,80vw);';
    box.appendChild(btn('▶  Continuar', resumeGame));
    box.appendChild(btn('⌨  Personalizar controles', openControls));
    const quit = btn('⌂  Retornar ao menu', quitToMenu);
    quit.style.borderColor = '#b1322c';
    box.appendChild(quit);
    const warn = document.createElement('div');
    warn.style.cssText = 'color:#9a8f7d;font-size:12px;margin-top:2px;';
    warn.textContent = 'Ao retornar, o orégano e os tokens coletados NESTA fase serão perdidos.';
    ov.appendChild(title); ov.appendChild(box); ov.appendChild(warn);
    document.body.appendChild(ov);
    pauseEl = ov; return ov;
  }
  function pauseGame() {
    if (game.state !== 'playing' || game.paused) return;
    game.paused = true; Sound.swap();
    buildPauseMenu().style.display = 'flex';
  }
  function resumeGame() {
    if (!game.paused) return;
    game.paused = false;
    closeControls();
    if (pauseEl) pauseEl.style.display = 'none';
  }
  function quitToMenu() {
    game.paused = false;
    closeControls();
    if (pauseEl) pauseEl.style.display = 'none';
    Sound.music && Sound.music.stop();
    if (game._editorReturn) { game._editorReturn = false; showEditor(); return; }
    showMenu();                       // progresso da fase (orégano/tokens) é descartado — não foi salvo
  }
  function toggleGamePause() { game.paused ? resumeGame() : pauseGame(); }

  // ---- personalização de CONTROLES (rebind) -----------------
  function buildControlsMenu() {
    if (controlsEl) return controlsEl;
    const ov = document.createElement('div');
    ov.id = 'controlsMenu';
    ov.style.cssText = 'position:fixed;inset:0;z-index:70;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(6,4,3,0.86);';
    document.body.appendChild(ov);
    controlsEl = ov; return ov;
  }
  function renderControls() {
    const ov = buildControlsMenu(); ov.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'color:#e8b94a;font-size:30px;letter-spacing:3px;text-shadow:2px 2px 0 #000;';
    title.textContent = 'CONTROLES';
    ov.appendChild(title);
    const sub = document.createElement('div');
    sub.style.cssText = 'color:#9a8f7d;font-size:12px;margin-bottom:4px;';
    sub.textContent = 'Clique numa tecla para removê-la · “+” adiciona · cada ação aceita várias teclas';
    ov.appendChild(sub);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:7px;width:min(520px,92vw);max-height:62vh;overflow-y:auto;padding:4px;';
    Keys.ACTIONS.forEach(a => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;background:#241a10;border:2px solid #4a3826;border-radius:7px;padding:6px 10px;';
      const lab = document.createElement('div');
      lab.style.cssText = 'flex:0 0 150px;color:#e8e0cf;font-size:14px;font-weight:bold;';
      lab.textContent = a.label;
      row.appendChild(lab);
      const chips = document.createElement('div');
      chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;';
      (Keys.map[a.id] || []).forEach(k => {
        const chip = document.createElement('button');
        chip.className = 'mbtn';
        chip.style.cssText = 'pointer-events:auto;cursor:pointer;font-weight:bold;font-size:13px;color:#e8e0cf;background:#3a2c1c;border:2px solid #5a4326;border-radius:6px;padding:4px 10px;letter-spacing:1px;';
        chip.textContent = Keys.pretty(k);
        chip.title = 'Remover';
        chip.onclick = () => { Keys.removeKey(a.id, k); renderControls(); };
        chips.appendChild(chip);
      });
      const add = document.createElement('button');
      add.textContent = '＋';
      add.style.cssText = 'pointer-events:auto;cursor:pointer;font-weight:bold;font-size:14px;color:#7be08a;background:#1a2414;border:2px solid #3a5a2a;border-radius:6px;padding:4px 11px;';
      add.title = 'Adicionar tecla';
      add.onclick = () => captureKeyFor(a.id, add);
      chips.appendChild(add);
      row.appendChild(chips);
      list.appendChild(row);
    });
    ov.appendChild(list);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;margin-top:6px;';
    const reset = btn('↺  Restaurar padrões', () => { Keys.reset(); renderControls(); });
    reset.style.fontSize = '14px';
    const back = btn('‹  Voltar', closeControls);
    back.style.fontSize = '14px';
    actions.appendChild(reset); actions.appendChild(back);
    ov.appendChild(actions);
  }
  function captureKeyFor(action, btnEl) {
    if (Keys.capturing) return;
    Keys.capturing = true;
    const old = btnEl.textContent; btnEl.textContent = '…'; btnEl.style.borderColor = '#e8b94a';
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      removeEventListener('keydown', handler, true);
      Keys.capturing = false;
      const k = e.key.toLowerCase();
      if (k !== 'escape') Keys.add(action, k);   // Esc = cancela a captura
      renderControls();
    };
    addEventListener('keydown', handler, true);
  }
  function openControls() {
    controlsOpen = true;
    renderControls();
    controlsEl.style.display = 'flex';
  }
  function closeControls() {
    controlsOpen = false;
    if (controlsEl) controlsEl.style.display = 'none';
  }
  // Esc fecha o submenu de controles (sem despausar) quando aberto
  addEventListener('keydown', (e) => {
    if (controlsOpen && !Keys.capturing && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeControls(); }
  }, true);

  function startLevel(i) {
    appState = 'playing';
    resumeGame();                     // garante que o micromenu de pausa não fique aberto
    game.testMode = (i === LEVELS.length - 1);   // fase de testes: troca de arma por teclas
    game.roster = [0, 1, 2, 3, 4]; game.currentHero = 0; game.score = 0;   // os 4 heróis disponíveis (troca com S/D)
    game.oregano = 0; game.tokens = 0; game.nextLifeAt = 50;
    game.lives = 3 + (Save.hasPerk('extralife') ? 1 : 0);
    game.onEnd = onGameEnd;
    game.loadLevel(i);
    showScreen(false);
    Sound.music && Sound.music.start(i);   // trilha única por fase
  }

  function onGameEnd(result) {
    Sound.music && Sound.music.stop();
    setTimeout(() => {
      appState = result;
      menu.innerHTML = '';
      if (result === 'win') {
        const last = game.levelIndex >= LEVELS.length - 2;   // index 0..3 campaign; last entry is the test stage
        highestLevel = Math.max(highestLevel, game.levelIndex + 1);
        subtitle.innerHTML = `<span class="big win">VITÓRIA!</span>`;
        const stat = document.createElement('div');
        stat.style.cssText = 'color:#e8e0cf;margin:6px 0 4px;font-size:15px';
        stat.innerHTML = `🌿 +${game.oregano} orégano${game.tokens ? ` · ⬡ +${game.tokens} token` : ''} · total: <b style="color:#7be08a">${Save.oregano}</b> 🌿`;
        menu.appendChild(stat);
        if (last) {
          subtitle.innerHTML = `<span class="big win">CRUZADA VENCIDA!</span>`;
          menu.appendChild(btn('♚  Jogar novamente', () => startLevel(0)));
        } else {
          menu.appendChild(btn('▶  Próxima fase', () => startLevel(game.levelIndex + 1)));
          menu.appendChild(btn('↻  Repetir fase', () => startLevel(game.levelIndex)));
        }
      } else {
        subtitle.innerHTML = `<span class="big lose">DERROTA</span>`;
        const stat = document.createElement('div');
        stat.style.cssText = 'color:#9a8f7d;margin:6px 0 4px;font-size:14px';
        stat.textContent = 'O reino chorará vossa queda...';
        menu.appendChild(stat);
        menu.appendChild(btn('↻  Tentar de novo', () => startLevel(game.levelIndex)));
      }
      menu.appendChild(btn('☰  Selecionar fase', showLevelSelect));
      menu.appendChild(btn('⌂  Menu principal', showMenu));
      showScreen(true);
    }, 700);
  }

  // ---- master loop -----------------------------------------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > CONFIG.MAX_DT) dt = CONFIG.MAX_DT;

    if (appState === 'playing') {
      if (!Keys.capturing && !controlsOpen && Keys.once('pause')) toggleGamePause();
      game.update(dt);
      game.draw();
      game.updateHUD();
    } else if (appState === 'map') {
      WorldMap.tick(dt);
    } else if (appState === 'gallery') {
      Gallery.tick(dt);
    } else if (appState === 'editor') {
      Editor.tick(dt);
    }
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  showMenu();
  requestAnimationFrame(frame);
})();

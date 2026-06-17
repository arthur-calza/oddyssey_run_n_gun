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

  function showLevelSelect() {
    appState = 'levelselect'; subtitle.textContent = 'ESCOLHA O CAMPO DE BATALHA';
    menu.innerHTML = '';
    const grid = document.createElement('div'); grid.className = 'lvgrid';
    LEVELS.slice(0, LEVELS.length - 1).forEach((L, i) => {   // campaign levels (last entry is the test stage)
      const locked = i > highestLevel;
      const b = btn(`${i + 1}. ${L.name}${locked ? '  🔒' : ''}`, () => startLevel(i), locked);
      b.style.fontSize = '15px';
      grid.appendChild(b);
    });
    menu.appendChild(grid);
    menu.appendChild(btn('‹ Voltar', showMenu));
    showScreen(true);
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

  function startLevel(i) {
    appState = 'playing';
    game.roster = [0, 1]; game.currentHero = 0; game.score = 0;
    game.oregano = 0; game.tokens = 0; game.nextLifeAt = 50;
    game.lives = 3 + (Save.hasPerk('extralife') ? 1 : 0);
    game.onEnd = onGameEnd;
    game.loadLevel(i);
    showScreen(false);
  }

  function onGameEnd(result) {
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
      if (Input.once('p') || Input.once('escape')) game.togglePause();
      game.update(dt);
      game.draw();
      game.updateHUD();
    }
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  showMenu();
  requestAnimationFrame(frame);
})();

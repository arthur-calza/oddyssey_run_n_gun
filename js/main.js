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

  function showMenu() {
    appState = 'menu'; subtitle.textContent = 'CRUZADA DE FERRO E FOGO';
    menu.innerHTML = '';
    menu.appendChild(btn('▶  INICIAR CRUZADA', () => startLevel(0)));
    menu.appendChild(btn('☰  SELECIONAR FASE', showLevelSelect));
    menu.appendChild(btn('♟  HERÓIS', showHeroes));
    showScreen(true);
  }

  function showLevelSelect() {
    appState = 'levelselect'; subtitle.textContent = 'ESCOLHA O CAMPO DE BATALHA';
    menu.innerHTML = '';
    const grid = document.createElement('div'); grid.className = 'lvgrid';
    LEVELS.forEach((L, i) => {
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
    game.roster = [0]; game.currentHero = 0; game.lives = 3; game.score = 0;
    game.coins = 0; game.nextLifeAt = 50;
    game.onEnd = onGameEnd;
    game.loadLevel(i);
    showScreen(false);
  }

  function onGameEnd(result) {
    setTimeout(() => {
      appState = result;
      menu.innerHTML = '';
      if (result === 'win') {
        const last = game.levelIndex >= LEVELS.length - 1;
        highestLevel = Math.max(highestLevel, game.levelIndex + 1);
        subtitle.innerHTML = `<span class="big win">VITÓRIA!</span>`;
        const stat = document.createElement('div');
        stat.style.cssText = 'color:#e8e0cf;margin:6px 0 4px;font-size:15px';
        stat.innerHTML = `Pontuação: <b style="color:#e8b94a">${game.score}</b> · Resgatados: ${game.prisonersRescued}/${game.prisonersTotal}`;
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

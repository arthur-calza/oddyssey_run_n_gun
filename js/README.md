# `js/` — Guia técnico do código

Documentação interna do código de **ODDYSSEY CHRONICLES**. Para a visão de jogador
(história, controles, como jogar) veja o [README na raiz](../README.md).

---

## Arquitetura sem build

O jogo é **JavaScript puro sobre HTML5 Canvas**, sem bundler, sem `import`/`export`,
sem `npm`. Todos os arquivos são **scripts clássicos** (`<script src="…">`) carregados
em sequência pelo [`index.html`](../index.html). Cada módulo registra seus objetos no
**escopo global** (`SPR`, `RIG`, `HEROES`, …) e os demais módulos os consomem dali.

Três consequências práticas:

1. **A ordem de carregamento importa.** Um módulo só pode usar o global de outro se
   esse outro já tiver sido carregado antes no `index.html`. As pastas abaixo são
   só organização visual — **a ordem real é a do `index.html`**, não a alfabética
   nem a por pasta. Ao adicionar um arquivo novo, insira a tag `<script>` na posição
   certa da cadeia de dependências.
2. **Cache-buster `?v=N`.** As tags terminam em `?v=12`. Ao editar os `.js` durante
   o desenvolvimento, suba esse número para forçar o navegador a recarregar a versão
   nova (evita ficar com um módulo antigo em cache). Suba **todas** de uma vez.
3. **Roda do `file://`.** Dá pra abrir o `index.html` com duplo-clique, sem servidor.
   (Por isso o rig usa `rigdata.js` em vez de `fetch` de JSON: `file://` não faz fetch.)

> Os caminhos de imagem no código (`assets/…`, `pictures/…`) resolvem contra a **URL
> da página**, não contra a pasta do `.js`. Por isso mover scripts entre subpastas
> não quebra o carregamento de assets — só é preciso ajustar as tags no `index.html`.

---

## Mapa das pastas

### `core/` — fundação do motor
| Arquivo | Responsabilidade |
|---------|------------------|
| `core.js` | Constantes, helpers de matemática, **`Input`/`Controller`** (entrada isolada por jogador, pronta p/ co-op) e **`Camera`**. |
| `save.js` | Persistência em `localStorage` (orégano acumulado, perks, tokens, progresso). |
| `game.js` | **Máquina de estados**, parser de fase (caracteres → blocos/inimigos), colisões, `meleeArc`, montagem do **HUD**. Expõe `window.GAME` (handle de debug). |
| `main.js` | **Bootstrap**: monta menus, seleção de fase, dispara `SPR.loadImages()` / `RIG.load()` e roda o **loop principal**. É o último script a carregar. |

### `render/` — tudo que desenha
| Arquivo | Responsabilidade |
|---------|------------------|
| `textures.js` | **`TEX`**: texturas de bloco pré-renderizadas (offscreen) + arte de decoração. |
| `background.js` | **`BG`**: fundos pixel-art em parallax por bioma (castelo/vila/masmorra/floresta/selva/campo). |
| `sprites.js` | **`SPR`**: spritesheets pixel-art **assadas sob demanda** (bake preguiçoso por personagem/ação; `SPR.warm` pré-assa no load da fase) + paletas, `gunAnchor`, `attackHand` (mão do golpe), `drawTinted` (status no corpo), `bodyPoint` (pontos da silhueta) e retratos do HUD. |
| `rig.js` | **`RIG`**: animação *cut-out* da concept art (topo posado + pernas blindadas que oscilam). Carrega de `assets/parts/` em runtime. |
| `rigdata.js` | **`RIG_DATA`**: dados de recorte do rig. **Gerado** por `tools/python/build_parts.py` — não editar à mão. |
| `particles.js` | Partículas, detritos, **decals persistentes** (sangue/ossos/queimadura), **cadáveres persistentes** (`fx.addCorpse`/`drawCorpses`, com física de suporte), cápsulas ejetadas, poeira de passos/aterrissagem, cura, arcos de golpe, magia, raios. |

### `world/` — terreno, construções e fases
| Arquivo | Responsabilidade |
|---------|------------------|
| `world.js` | **Tilemap destrutível**, física/colisão (auto-step), explosões, desabamento. **`MAT`**/**`CHAR2MAT`** (materiais de bloco). |
| `buildings.js` | **`BUILDINGS`/`BUILD`**: prefabs de construções (portão, quartel, celas…). |
| `dungeons.js` | Geração de masmorras/interiores. |
| `props.js` | Objetos de cenário (tochas, estandartes, barris, baús, decoração). |
| `levels.js` | Gerador de **fases grandes e verticais** (`lvlN()`, ajudantes `ground`/`tower`/`platform`) + seleção de bioma. |

### `gameplay/` — mecânicas e personagens
| Arquivo | Responsabilidade |
|---------|------------------|
| `entities.js` | `Entity`, `Bullet`, **`Player`**, `Pickup`. |
| `enemies.js` | **`ENEMY_TYPES`**/**`CHAR2ENEMY`**: bestiário + IA + morte com gore. Inclui os **Mythos** (`mythos:true`, desenho em `MYTHOS_DRAW`, ataques em `Enemy._atk<Nome>`). |
| `heroes.js` | **`HEROES`** (Ragnarok, Zracks, Nicolau, Silvyr, Edward, Vex): arma-base (`weapon.fire`), especial (`special.use`) e movimento. |
| `spells.js` | **Árvores de habilidade**: Grimório de Edward (27 feitiços) e Códice de Guerra de Ragnarok (26 técnicas), o seletor in-game e a classe **`Minion`** (invocações aliadas). |

### `audio/`
| Arquivo | Responsabilidade |
|---------|------------------|
| `audio.js` | **`Sound`**: SFX procedurais via WebAudio (sem arquivos). A trilha procedural está desligada (`Sound.music.enabled = false`). |

### `ui/` — telas fora do gameplay
| Arquivo | Responsabilidade |
|---------|------------------|
| `worldmap.js` | Mapa-múndi / seleção de fase. |
| `gallery.js` | Galeria (visualização de personagens/animações). |

### `editors/` — ferramentas in-game (Modo Criação)
| Arquivo | Responsabilidade |
|---------|------------------|
| `spritelab.js` | **Estúdio de animação**: editar quadros, paleta, exportar PNG/`.js`. |
| `editor.js` | **Editor de fases/construções**: monta prefabs e exporta como módulo `.js`. |

---

## Pipeline de assets (Python)

A arte detalhada dos personagens vem dos concepts e é processada **fora do jogo** por
dois scripts (precisam de Python 3 + Pillow; rodam manualmente, não em runtime):

```
concept/*.png ──build_assets.py──▶ assets/<chave>.png      (chroma-key + trim + resize)
assets/<chave>.png ──build_parts.py──▶ assets/parts/<chave>_{top,legF,legB}.png
                                       js/render/rigdata.js  (RIG_DATA, fatiamento do rig)
```

```bash
py -3 tools/python/build_assets.py   # concepts limpos → assets/
py -3 tools/python/build_parts.py    # fatia em peças do rig → parts/ + render/rigdata.js
```

Em runtime, `RIG.load()` (`rig.js`) carrega `assets/parts/*` e usa `RIG_DATA` para
posar as peças. Enquanto a arte não chega, `SPR` (`sprites.js`) desenha um **fallback
procedural**. As pastas `concept/`, `assets/`, `references/` e `pictures/` estão no
`.gitignore` (exceto os retratos versionados em `pictures/`).

---

## Como estender

- **Nova arte de personagem:** PNG em `concept/`, mapeie em `tools/python/build_assets.py`,
  rode-o (gera `assets/<chave>.png`), rode `build_parts.py` e aponte `spr:'<chave>'` no
  herói/inimigo. Um `SPR.define('<chave>',{…})` opcional serve de fallback procedural.
- **Nova arma de fogo:** adicione uma entrada em `WEAPONS` (`gameplay/heroes.js`) com
  `name/icon/visual/cool/clip/reload/gunLen/desc` e `fire(p, game)` (chame `p.shoot(...)`);
  registre a chave em `WEAPON_ORDER` p/ aparecer no Modo Criação. Mecânicas de projétil
  (cadeia, ricochete, bumerangue, fragmentação, teleguiado, congelar, envenenar, `launch`
  arremessar-pro-alto, `blast` mandar-voando, `teleUp` teletransportar) são flags do `Bullet`
  em `gameplay/entities.js`; novos visuais de cano vão em `SPR._weapon`. O **coice** ao
  disparar vem da tabela `WEAPON_KICK` (aplicada em `Player.recoilKick`).
- **Nova arma branca:** adicione uma entrada em `MELEE` (`gameplay/heroes.js`) definindo o
  perfil do golpe `C` (alcance/dano/cor + flags `swing/deflect/launch/blast/teleUp/pull/ignite/…`)
  e registre em `MELEE_ORDER`. O desenho empunhado é **pixelizado** por `SPR.drawMeleeSwing`
  (assado a partir do vetor `SPR.drawMeleeWeapon`); a lógica do golpe (rebate/onda/cadeia/quake/
  reações) mora em `Game.meleeRadial` (`core/game.js`).
- **Novo herói:** adicione um objeto em `HEROES` (`gameplay/heroes.js`) com `weapon.fire`
  e `special.use`.
- **Novo inimigo:** adicione em `ENEMY_TYPES` e em `CHAR2ENEMY` (`gameplay/enemies.js`);
  o parser de `core/game.js` já o coloca a partir do mapa de caracteres da fase.
- **Nova fase:** escreva uma função `lvlN()` em `world/levels.js` usando os ajudantes
  (`ground`, `tower`, `platform`…).
- **Novo bloco/textura:** adicione em `MAT`/`CHAR2MAT` (`world/world.js`) e um caso de
  pintura em `TEX._paint` (`render/textures.js`). Marque `falls:true` para bloco com gravidade.
- **Novo bioma de fundo:** adicione um método em `BG` (`render/background.js`) e aponte
  `level.biome`.
- **Co-op local:** `Controller` (`core/core.js`) já isola o input de um jogador; basta
  instanciar um segundo `Controller` (ex.: gamepad) e um segundo `Player`.

---

## Lembrete ao mover/renomear arquivos

Se mexer na localização de um `.js`, atualize **os dois** lugares:
1. a tag `<script src>` no `index.html` (mantendo a ordem da cadeia de dependências);
2. qualquer caminho que o gere/aponte — em especial, `build_parts.py` escreve em
   `js/render/rigdata.js`.

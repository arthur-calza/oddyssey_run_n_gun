# PÓLVORA & AÇO — Cruzada de Ferro e Fogo

Run-and-gun 2D destrutivo, inspirado na sensação de *Broforce*, em um **mundo dark-fantasy medieval com pólvora**. Feito em **HTML5 Canvas + JavaScript puro**, sem build e sem dependências. Roda a **1280×720 com zoom 1.7×**, usando a **arte dos concepts como sprites** (processados em `assets/`), texturas de bloco e fundos em parallax por bioma.

## Como jogar

Basta **abrir `index.html` no navegador** (duplo-clique). Não precisa de Node, Python nem servidor — os scripts são carregados como `<script>` clássicos e funcionam direto do `file://`.

> Se preferir servir por HTTP (opcional): `py -3 -m http.server 5180` e abra `http://localhost:5180`.

### Controles
| Ação | Tecla |
|------|-------|
| Mover | `A` / `D` (ou setas) |
| Pular (duplo p/ alguns heróis) | `W` / `Espaço` |
| Mira | **Mouse** |
| Atirar | Botão esquerdo / `J` |
| Especial | Botão direito / `K` |
| Trocar de herói | `Q` / `E` |
| Pausar | `P` / `Esc` |

## Heróis (ambos disponíveis em todas as fases — troque com `Q`/`E`)
- **RAGNAROK** — cavaleiro de placas. Base: **espingarda** de dispersão. Especial: **Tiro Explosivo**. Resistente.
- **ZRACKS** — lagarto caçador. Base: **arco** perfurante (salto duplo). Especial: **Investida** com lâmina (avanço veloz).

## Mecânicas
- Cenário **destrutível em tempo real** com **materiais texturizados**: terra (com grama), pedra, tijolo de castelo, madeira, cobblestone de masmorra, arenito de vila, pedra com musgo, rocha-base e os **blocos com gravidade** areia e cascalho.
- **Desabamento estrutural**: areia/cascalho **caem quando perdem o suporte de baixo** (estilo Minecraft) e se reempilham ao pousar — atire na base de uma coluna e ela desmorona; blocos em queda **esmagam** quem estiver embaixo.
- **Fases verticais e exploráveis**: terreno ondulado com colinas e vales (sempre transponível por *auto-step*), **rotas elevadas** com recompensas e **descidas** com tesouros.
- **Moedas** espalhadas e largadas por inimigos/baús: a cada **50 moedas você ganha 1 vida**; há também **corações de 1-up** escondidos nas alturas.
- **Barris de pólvora** que detonam em **reação em cadeia**.
- **Bestiário monstruoso** (baseado nos concepts) com IA: **zumbi** (mosquete), **lobisomem** (rápido, saltador), **homem-dragão** (rifle preciso), **demônio** (canhão, mini-chefe) e o **Devorador de Mentes** (chefe — orbes arcanos + invoca servos).
- **Sprites animados quadro-a-quadro** (`sprites.js`): corpo desenhado por partes com **formas arredondadas e sombreamento** (cabeças ovais, membros afunilados, contorno escuro), em maior resolução. A corrida é **travada ao passo** (`runDist`), então a velocidade das pernas casa com o deslocamento (sem o "pisca-pisca" anterior). Spritesheets de idle/corrida/pulo/queda/dano/**morte**. O **braço+arma fica na altura do peito/mãos** (`gunAnchor`), com mira em 360° e recuo. Concepts (`assets/`) viram o **retrato do HUD**.
- **Fase de testes** (botão 🛠 no menu): corrida longa, plataformas, pulos e quedas para avaliar/calibrar as animações.
- **Rastro de destruição persistente**: mortes geram fartas partículas de **sangue e ossos** que ficam no chão (*decals*); explosões deixam **marcas de queimadura** — o cenário muda visivelmente conforme você avança.
- **Fundos em parallax por bioma** (castelo, vila, masmorra, campo de guerra) com lua, estrelas, nuvens, névoa, vaga-lumes e relâmpagos; **decoração** de tochas, estandartes, janelas, pilares, vinhas, teias e grama.
- Game feel: *camera shake*, **sangue/gore**, **magia**, **golpes em arco**, raios, knockback, *hit-stop* e flash de tela.
- HUD: vida, carga do especial, retrato/nome do herói, vidas, moedas, objetivo e rodízio.
- **4 fases grandes e verticais** (uma por bioma, ~10–13k px de largura × 90 tiles de altura), com terraços/torres/escaladas exploráveis e ~34 inimigos cada. A **1280×720 com zoom 1.7×**.

## Arquitetura (`js/`)
| Arquivo | Responsabilidade |
|---------|------------------|
| `core.js` | constantes, matemática, **Input/Controller** (pronto p/ co-op), **Camera** |
| `audio.js` | SFX procedurais via WebAudio (sem arquivos) |
| `textures.js` | **texturas de bloco pré-renderizadas** (offscreen) + arte de decoração |
| `background.js` | **fundos em parallax por bioma** (castelo/vila/masmorra/campo/floresta) |
| `sprites.js` | **animador de sprites quadro-a-quadro** (corpo por partes, contorno) + braço-arma no peito (`gunAnchor`) |
| `tools/build_assets.py` | pipeline (Python/Pillow): recorta o fundo dos concepts → `assets/` (retratos do HUD) |
| `world.js` | **tilemap destrutível**, física/colisão (auto-step), explosões, desabamento |
| `particles.js` | partículas, detritos, **decals persistentes** (sangue/ossos/queimadura), golpes, magia, raios |
| `entities.js` | `Entity`, `Bullet`, **`Player`**, `Pickup` |
| `enemies.js` | bestiário monstruoso + IA + **morte com gore e rastro** |
| `heroes.js` | os dois heróis (Ragnarok, Zracks): ataque-base, especial, movimento |
| `levels.js` | gerador de **fases grandes e verticais** (terraços/torres/escaladas) + bioma |
| `game.js` | máquina de estados, parser de fase, colisões, **meleeArc**, HUD |
| `main.js` | bootstrap, menus, seleção de fase, loop principal |

### Como estender
- **Nova arte de personagem:** coloque um PNG em `concept/`, mapeie-o em `tools/build_assets.py`, rode `py -3 tools/build_assets.py` (gera `assets/<chave>.png`) e aponte `spr: '<chave>'` no herói/inimigo. Um `SPR.define('<chave>',{...})` opcional serve de *fallback* procedural.
- **Novo herói (mecânica):** adicione um objeto em `HEROES` (`heroes.js`) com `weapon.fire` e `special.use`.
- **Novo inimigo:** adicione em `ENEMY_TYPES` e em `CHAR2ENEMY` (`enemies.js`); o parser de `game.js` já o coloca.
- **Nova fase:** escreva uma função `lvlN()` no gerador de `levels.js` usando os ajudantes (`ground`, `tower`, `platform`...).
- **Novo bloco/textura:** adicione em `MAT`/`CHAR2MAT` (`world.js`) e um caso de pintura em `TEX._paint` (`textures.js`). Marque `falls: true` para um bloco com gravidade.
- **Novo bioma de fundo:** adicione um método em `BG` (`background.js`) e aponte `level.biome`.
- **Co-op local:** `Controller` já isola o input de um jogador; basta instanciar um segundo `Controller` (ex.: gamepad) e um segundo `Player`.

## Pendências / próximos passos
- **Co-op simultâneo (2 jogadores na tela)** ainda não existe — hoje os dois heróis estão sempre disponíveis e você **alterna** entre eles (`Q`/`E`). A base (`Controller`) está pronta para um 2º jogador.
- Os sprites são **gerados por código** no estilo dos concepts (não importam os PNGs); trocar por spritesheets externos é só adaptar `SPR.draw`.
- Blocos com gravidade caem por **suporte vertical direto** (como no Minecraft); sem coesão lateral.
- Fossos são "sem fundo" (queda = morte); cruza-se com salto/salto-duplo.
- `window.GAME` fica exposto como handle de debug.

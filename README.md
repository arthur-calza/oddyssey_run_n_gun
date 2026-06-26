# ⚔️ ODDYSSEY CHRONICLES
### *Crônicas de Ferro e Sangue*

> Um **run-and-gun 2D** frenético e destrutivo, num mundo **medieval-fantasia
> sombrio e adulto**. Pense em *Broforce* — mas com cavaleiros de placas, magos
> com grimórios e chefes colossais saídos de um pesadelo. Cada tiro arranca um
> pedaço do cenário; cada morte deixa rastro no chão.

Feito em **HTML5 Canvas + JavaScript puro** — sem engine, sem build, sem
dependências. **É só dar duplo-clique no `index.html`.** 🎮

---

## ▶️ Como jogar

**Abra o `index.html` no navegador** (duplo-clique). Não precisa de Node, Python
nem servidor — pronto.

> Prefere servir por HTTP? (opcional) `py -3 -m http.server 5180` e abra
> `http://localhost:5180`.

### Controles

| Ação | Tecla |
|------|-------|
| Mover | `A` / `D` (ou setas) |
| Pular *(duplo p/ alguns heróis)* | `W` / `Espaço` |
| Mirar | **Mouse** |
| Atirar | Botão esquerdo / `J` |
| Especial · **conjurar feitiço** (Edward) | `X` |
| **Grimório / Códice** (abrir/fechar) | `G` |
| Trocar de feitiço/técnica | `[` / `]` |
| Escadas (sobe/desce) · escalar paredes | `W` / `S` *(segure)* |
| Wall-jump | pular encostado na parede |
| Trocar de herói | `Q` / `E` |
| Pausar | `P` / `Esc` |

---

## 🛡️ Os heróis

Os heróis ficam **todos disponíveis em todas as fases** — você **alterna** entre
eles com `Q`/`E` no meio da ação.

- **RAGNAROK** — cavaleiro de placas. Espingarda de dispersão, especial **Tiro
  Explosivo**, resistente. Tem o **Códice de Guerra** (`G`): **26 técnicas
  marciais** em 5 caminhos (Bárbaro, Guerra, Fúria, Paladino, Lâmina). O recurso
  é a **FÚRIA**, que ele acumula golpeando corpo-a-corpo — várias técnicas são
  **posturas** que trocam a arma branca e mudam o golpe `C`.
- **ZRACKS** — lagarto caçador. Arco perfurante com salto duplo, especial
  **Investida** de lâmina.
- **EDWARD** — o **mago** da campanha. Em vez de um especial fixo, carrega um
  **GRIMÓRIO** (`G`) com **27 feitiços** em 5 tradições: ☄ Elementos,
  ⛰ Transmutação, ☠ Invocação, ✷ Mente e ✦ Arcana & Mobilidade. O `X` conjura o
  feitiço ativo e a barra azul vira **MANA**.

*(Por enquanto tudo já vem liberado — é campo de testes. A ideia é o jogador
desbloquear e evoluir as árvores à sua escolha.)*

## 👹 Mythos — chefes colossais

Chefes de **2× a 4× o tamanho** dos personagens, com desenho procedural próprio e
ataques em 3 fases: **O Devorador de Mentes**, **O Necromante Ancião**, **Chittr,
o Bicéfalo**, **Fenrahk** (lobisomem colossal) e **O Carrasco Infernal**.

---

## 💥 O que torna o jogo especial

- **Cenário destrutível em tempo real** com materiais texturizados (terra, pedra,
  tijolo, madeira, arenito…) — e **desabamento estrutural** estilo Minecraft:
  areia e cascalho **caem quando perdem o apoio** e esmagam quem estiver embaixo.
- **Fases verticais e exploráveis** (6 + fase de testes): cada trecho é um lugar
  de verdade — portão/quartel, bloco de celas, arsenal, catacumbas — com rotas por
  cima, pelo chão, por túneis embaixo e por dentro das construções.
- **Mobilidade Broforce-like**: escadas, escalada de paredes, wall-jump e auto-step.
- **Tiroteio frenético**: barris de pólvora em **reação em cadeia**, barris-foguete
  🚀, blocos que desabam e enxames de inimigos.
- **Status mágicos que marcam o corpo** dos inimigos: quem pega fogo **queima**,
  congelados **tremem e estilhaçam** o gelo, raios soltam mini-choques, terremotos
  arremessam todo mundo pro alto.
- **Personagens em *cut-out* da arte dos concepts**: a arte detalhada é fatiada e
  animada (balanço, mira, recuo do tiro, tombo na morte), com pernas blindadas que
  oscilam do quadril — o realismo da concept art **com** animação.
- **Fundos pixel-art em camadas por bioma** (castelo, vila, masmorra, floresta,
  selva, campo de guerra), com 4–7 camadas de parallax, perspectiva atmosférica,
  lua, estrelas, névoa, vaga-lumes e relâmpagos.
- **Rastro de destruição persistente**: sangue, ossos e marcas de queimadura ficam
  no chão — o mundo muda visivelmente conforme você avança.
- **Game feel**: *camera shake*, gore, knockback, *hit-stop* e flash de tela.

Roda a **1280×720 com zoom 1.7×**.

---

## 🌿 Progressão

Tudo salva sozinho na memória do navegador (`localStorage`).

- **Orégano 🌿** é a moeda: colete nas fases e **acumule no perfil** ao completá-las.
- **Loja do Mercador** (menu): gaste orégano em **perks permanentes** — vida extra,
  vigor, bandoleira, saqueador.
- **Tokens "Rei do Picadão" ⬡** — artefatos colecionáveis para recompensas futuras.
- **Poções azuis ⚗** — power-up temporário que turbina o ataque-base.
- A cada **50 moedas → +1 vida**; há **corações de 1-up** escondidos nas alturas.

---

## 🛠️ Modo Criação

No menu, **MODO CRIAÇÃO** abre as ferramentas internas: a **Fase de Testes** (um
campo aberto pra calibrar animações e testar tudo já como Edward — troque pra
Ragnarok com `S`/`D`, cicle os Mythos com `N`), o **Estúdio de animação** e o
**Editor de fases/construções**.

---

## 👩‍💻 Para desenvolvedores

O código vive em [`js/`](js/) e está organizado por assunto (core, render, world,
gameplay, audio, ui, editors). O **guia técnico completo** — arquitetura,
mapa dos arquivos, objetos globais, pipeline de assets e como estender o jogo —
está em **[`js/README.md`](js/README.md)**.

Resumão: é tudo *script clássico* carregado em ordem pelo `index.html` (sem build).
A arte dos personagens é processada por dois scripts Python em
[`tools/python/`](tools/python/) que geram `assets/` e `js/render/rigdata.js`.

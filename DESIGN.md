---
name: Super 8 ao vivo
description: Sorteio, placar e ranking do play de beach tennis, ao vivo no celular de todo mundo.
colors:
  areia: "#f4e7d3"
  creme: "#fff6ea"
  azul-profundo: "#1e3557"
  coral-saque: "#e37a63"
  coral-botao: "#bf5440"
  coral-tinta: "#a84a36"
  verde-coqueiro: "#1f5c52"
  coqueiro-elevado: "#2b7064"
  turquesa-mare: "#4dbbb5"
  dourado-sol: "#f2c45a"
  manteiga: "#f9e2a6"
  pessego: "#f6b8a5"
  por-do-sol: "#fde3cf"
  turquesa-veu: "#d5efec"
  coral-veu: "#f9ddd5"
  ok-veu: "#e3f3f1"
  cinza-mare: "#5b6678"
  fio-areia: "#e8d7bc"
  linha-madeira: "#8f7a5c"
  perigo: "#b42318"
  branco: "#ffffff"
  noite-fundo: "#0f1e2e"
  noite-cartao: "#172b3f"
  noite-faixa: "#0b1622"
  noite-destaque: "#21463f"
  noite-muted: "#b7c0cc"
  noite-fio: "#24394f"
  noite-linha: "#6f8197"
  noite-coral-tinta: "#f0a08f"
  noite-perigo: "#ff8e7f"
typography:
  display:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 1
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
  title:
    fontFamily: "\"DM Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "\"DM Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "\"DM Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "\"DM Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  sm: "6px"
  lg: "16px"
  xl: "22px"
  sheet: "16px"
  full: "9999px"
spacing:
  gutter: "16px"
  card: "16px"
  stack-tight: "6px"
  stack: "8px"
  stack-loose: "12px"
components:
  button-primary:
    backgroundColor: "{colors.coral-botao}"
    textColor: "{colors.branco}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    height: "48px"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.azul-profundo}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.azul-profundo}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.perigo}"
    textColor: "{colors.branco}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    height: "48px"
  button-game:
    backgroundColor: "{colors.verde-coqueiro}"
    textColor: "{colors.branco}"
    rounded: "{rounded.full}"
    size: "52px"
  card:
    backgroundColor: "{colors.creme}"
    textColor: "{colors.azul-profundo}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pill:
    backgroundColor: "{colors.fio-areia}"
    textColor: "{colors.azul-profundo}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  choice:
    backgroundColor: "{colors.areia}"
    textColor: "{colors.azul-profundo}"
    rounded: "{rounded.lg}"
    padding: "12px"
    height: "52px"
  choice-selected:
    backgroundColor: "{colors.creme}"
    textColor: "{colors.azul-profundo}"
    rounded: "{rounded.lg}"
    padding: "12px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.cinza-mare}"
    rounded: "{rounded.lg}"
    height: "56px"
  tab-active:
    backgroundColor: "{colors.coral-veu}"
    textColor: "{colors.coral-tinta}"
    rounded: "{rounded.lg}"
    height: "56px"
  toast:
    backgroundColor: "{colors.azul-profundo}"
    textColor: "{colors.areia}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  undo-chip:
    backgroundColor: "{colors.coral-botao}"
    textColor: "{colors.branco}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "28px"
  offline-badge:
    backgroundColor: "{colors.creme}"
    textColor: "{colors.verde-coqueiro}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "1px 8px"
---

# Design System: Super 8 ao vivo

## Overview

**Creative North Star: "Fim de tarde na quadra"**

O Super 8 tem a luz do fim de tarde num play de beach tennis. O fundo é areia quente, os cartões são creme e o destaque esquenta para pêssego, como o sol baixando. O texto é sempre um azul profundo, nunca preto. Por cima disso a quadra continua funcionando: placar grande, alvos de toque generosos e informação que se lê sob sol forte. A atmosfera mora nas bordas e o jogo fica no centro.

O clima vem de poucas peças bem escolhidas. São os 21 personagens no lugar de foto, as palhas de coqueiro pendendo do canto de cima e a onda de areia como enfeite, a rede tracejada entre as duplas e a bola que quica enquanto carrega. A densidade é a de um app de celular feito para uma mão só: uma coluna, cartões empilhados e navegação embaixo, ao alcance do polegar. À noite o mesmo clube vira o tema Noite, azul-marinho com creme, seguindo o modo escuro do aparelho.

O sistema é um "clube de sol": social e ensolarado, mas nunca bagunçado. A cor tem trabalho a fazer. Coral é ação, verde coqueiro é placar e faixa, turquesa é seleção e dourado é conquista.

**Key Characteristics:**
- Areia e creme como base quente, com azul profundo no lugar do preto.
- Cada cor de destaque tem um papel fixo: ação, placar, seleção ou conquista.
- Componentes firmes e amigáveis: alvos de 48 a 56 px, cantos macios de 16 px e bordas sólidas de 1,5 px.
- Uma única sombra estrutural, a do cartão pousado na areia.
- Personagens e enfeites de praia dão o clima, sempre longe do placar.
- Tema Noite automático, com os mesmos papéis de cor.

## Colors

O app tem uma base quente de areia e creme, tinta azul-profunda e quatro destaques praianos, cada um com um papel que não se troca.

### Primary
- **Coral Saque** (`coral-saque`): o coral da marca. Aparece puro em enfeites, na barra lateral da dupla B, na costura do divisor e como botão no tema Noite.
- **Coral de Botão** (`coral-botao`): o coral mais fechado dos botões primários, do selo "Venceu", da barra de progresso e do "Desfazer" no cartão. Existe porque branco sobre o coral puro não passa no contraste.
- **Tinta Coral** (`coral-tinta`): texto coral sobre o véu coral, usado na aba ativa e no "(você)". No Noite vira `noite-coral-tinta`.

### Secondary
- **Verde Coqueiro** (`verde-coqueiro`): é a cor do placar e da faixa. O botão "+ game" e as faixas de cabeçalho usam ela, e ela também é a `theme-color` do navegador. `coqueiro-elevado` é a faixa levantada sobre a faixa. No Noite, o placar passa para turquesa.
- **Turquesa Maré** (`turquesa-mare`): é a cor de seleção e de "em jogo". Marca a barra lateral da dupla A e o status "Em jogo", e aparece como cartinha de jogador comum. `turquesa-veu` é o fundo suave dos avisos de "jogo extra".

### Tertiary
- **Dourado Sol** (`dourado-sol`): é a cor da conquista. Fica no 1º lugar do pódio, na cartinha do campeão e na coroa, e não aparece em mais nada.
- **Manteiga** (`manteiga`): o destaque do vencedor dentro do cartão de partida e do status "Game de desempate".
- **Pêssego** (`pessego`) e **Pôr do sol** (`por-do-sol`): o calor do fim de tarde. O cartão de destaque `.sol` vai de creme a pôr do sol num degradê de 135°.

### Neutral
- **Areia Clara** (`areia`): o fundo de toda tela e o fundo das opções não escolhidas.
- **Creme Solar** (`creme`): os cartões, os painéis, a barra de navegação e as folhas (sheets). É também a tinta sobre a faixa coqueiro.
- **Azul Profundo** (`azul-profundo`): todo texto principal, a borda dos botões de linha, a opção escolhida e o fundo do toast.
- **Cinza Maré** (`cinza-mare`): texto secundário, dicas, abas inativas e cabeçalho do cartão de partida.
- **Fio de Areia** (`fio-areia`): os fios mais leves, como divisores, a rede tracejada e o fundo de pill neutra.
- **Linha de Madeira** (`linha-madeira`): bordas de campos, steppers, opções não escolhidas e botões fantasma.
- **Perigo** (`perigo`): só ações destrutivas e avisos. O véu de aviso é ele mesmo a 10% de opacidade, e `ok-veu` é o véu de confirmação.
- **Tema Noite**: o fundo vira `noite-fundo`, os cartões `noite-cartao` e a faixa `noite-faixa`. A tinta passa a ser creme. O botão primário vira o coral puro com texto `noite-fundo`, e o placar vira turquesa.

### Named Rules
**The One Job Rule.** Cada destaque tem um papel só: coral é ação, coqueiro é placar e faixa, turquesa é seleção e jogo em andamento, dourado é conquista. Uma cor nova de destaque precisa de um papel novo, não de gosto.

**The No Black Rule.** O texto nunca é preto. No Sol a tinta é azul profundo, e no Noite é creme. O preto só aparece como véu do fundo das folhas (50%).

**The Gold Is Earned Rule.** O dourado só aparece onde alguém ganhou alguma coisa: 1º lugar, campeão, coroa. Se não houve conquista, não há dourado.

## Typography

**Display Font:** Outfit (com system-ui, sans-serif), pesos de 600 a 800.
**Body Font:** DM Sans (com system-ui, -apple-system, Segoe UI, Roboto), eixo óptico com pesos de 400 a 800.

**Character:** Outfit é geométrica e cheia, perfeita para placar e títulos que precisam ser lidos de longe. DM Sans é calorosa e compacta, para nomes e textos de interface. Juntas, soam como um clube, não como um painel de controle.

### Hierarchy
- **Display** (Outfit 800, 48px, line-height 1): o número do placar. Cai para 40 px em telas de até 380 px. Os placares de pódio e do Telão sobem até 52 px.
- **Headline** (Outfit 800, 24 a 26px, line-height 1): títulos de painel e de folha.
- **Title** (DM Sans 700, 17 a 18px, line-height 1.25): nomes de jogadores e o texto do botão primário.
- **Body** (DM Sans 400, 16px, line-height 1.45): o texto corrido. Avisos e notas usam 15 px.
- **Body small** (DM Sans 400, 13px, line-height 1.35): dicas embaixo de rótulos e de opções, sempre em cinza maré.
- **Label** (DM Sans 800, 11 a 12px, tracking 0.12em, CAIXA ALTA): cabeçalho do cartão de partida, status e selos como "Venceu", "Fim" e "Avança direto".

### Named Rules
**The Tabular Score Rule.** Todo número que muda ao vivo (placar, contagem de jogos, ranking) usa algarismos tabulares (`.tabnum`). O placar não pode dançar quando vira de 9 para 10.

**The Outfit Is for Reading Far Rule.** Outfit fica para o que se lê a distância: placar, títulos e números grandes. Texto de interface e nomes são DM Sans.

## Layout

Uma coluna feita para o celular. O conteúdo fica centralizado com largura máxima de 760 px, e as folhas (sheets) ficam limitadas a 520 px em telas maiores. A margem lateral é de 16 px e respeita a área segura do aparelho (`.gutter`), e o corpo da página também respeita a área segura em cima e embaixo.

A navegação do torneio fica presa embaixo, ao alcance do polegar. São três abas iguais (Jogos, Ranking, Info), com uma barra de progresso de 3 px por cima que vai enchendo conforme os jogos terminam. As folhas sobem de baixo no celular e viram um diálogo centralizado a partir de `sm` (640 px). Os toasts de confirmação aparecem acima da navegação.

O ritmo é apertado e regular. Os cartões têm 16 px de respiro interno, as linhas de um cartão se separam por 6 a 8 px e os grupos de campos por 12 px. As grades de opções começam em uma coluna e passam a duas a partir de 420 px. Os ajustes de tamanho para telas pequenas entram em 380 e 400 px, não nos breakpoints padrão do Tailwind.

**The Thumb Zone Rule.** O que se toca durante o jogo (placar, abas, desfazer) fica na metade de baixo da tela ou dentro do cartão da partida. Nada essencial depende de esticar o polegar até o topo.

## Elevation & Depth

A profundidade vem de uma única metáfora: o cartão creme pousado na areia. Há uma sombra estrutural, curta e azulada, que separa o cartão do fundo. Ela não serve para fazer nada flutuar, e não existem níveis empilhados de elevação. O resto da hierarquia vem de cor (areia → creme → manteiga) e de bordas sólidas.

### Shadow Vocabulary
- **Cartão na areia** (`0 1px 2px rgba(30,53,87,.06), 0 10px 24px -14px rgba(30,53,87,.35)`): em cartões, painéis e toasts. No Noite vira `0 1px 0 #00000066, 0 10px 22px -14px #000000d9`.
- **Barra de navegação** (`0 -8px 24px -16px rgba(0,0,0,.5)`): a mesma ideia virada para cima, separando a navegação fixa do conteúdo que rola por baixo.
- **Seleção por dentro** (`inset 0 0 0 1px` na cor da tinta): a opção escolhida ganha uma borda dupla para dentro, nunca uma sombra para fora.

### Named Rules
**The Card on Sand Rule.** Existe uma sombra para cartões e nenhuma outra para conteúdo. Hover não levanta o cartão. Para mostrar estado, muda a cor ou a borda.

**The Focus Ring Rule.** O foco de teclado é um anel duplo: 2 px na cor do fundo e mais 2 px na cor da tinta (`--focus-ring`). Ele aparece em todo elemento focável e nunca é removido.

## Shapes

Os cantos são macios e generosos, como um seixo. O raio de 16 px vale para quase tudo que se toca ou que contém algo: botões, cartões, opções, abas, campos e toasts. As folhas usam 16 px só nos cantos de cima no celular, e nos quatro cantos no diálogo. O que é redondo é redondo de verdade: avatares, botões de game, pills, selos de status e a bolinha de gênero.

As bordas são sólidas e de 1,5 px, nunca de 1 px, para não sumirem sob sol forte. A borda tracejada aparece em dois lugares: a rede entre as duplas e o botão fantasma, que indica "adicionar".

A logo é o S em duas faixas, laranja e branca, segurando a bola (`public/marca/`). A costura da bola vira o divisor `.costura`: um traço de 2,5 px em coral com o símbolo no meio.

## Components

### Buttons
Firmes e amigáveis: grandes o bastante para mão suada, com cantos macios que convidam o toque.
- **Shape:** cantos macios (16px), altura mínima de 48 px e respiro de 10 × 16 px.
- **Primary:** coral de botão com texto branco, DM Sans 700 a 17 px. No Noite vira coral puro com texto azul-marinho. Ao tocar, desce 1 px.
- **Line:** fundo transparente com borda sólida de 1,5 px na cor da tinta. É a ação secundária padrão.
- **Ghost:** borda tracejada de 1,5 px em linha de madeira, para "adicionar" ou "mais um".
- **Danger:** vermelho de perigo com texto branco, só para apagar ou encerrar.
- **Quiet:** texto com sublinhado afastado (4 px) em linha de madeira, para ações terciárias. Também é o atalho para um ajuste que o app sugere, sempre com o verbo "Usar" e o valor: "Usar 28" ao lado das rodadas, "Usar média por partida" no fim do aviso de partidas desiguais, "Usar o padrão" no ranking mexido. Fica do lado ou embaixo do texto que explica, com 48 px de alvo, e nunca liga nada sozinho: o organizador toca e um toast confirma quando a mudança não está à vista.
- **Disabled:** 40% de opacidade, sem sombra e sem o deslocamento do toque.

### Chips / Pills
- **Style:** cápsula inteira com label em caixa alta, peso 800 e tracking de 0.08 a 0.12em. O fundo padrão é fio de areia.
- **Status da partida:** "A jogar" leva só um contorno de 1,5 px. "Em jogo" é turquesa com texto azul profundo. "Game de desempate" é manteiga. "Fim" é azul profundo com texto areia. "Venceu" é coral de botão. Com o torneio encerrado à mão, o que não acabou vira "Não jogado" ou "Não terminou": o mesmo contorno do "A jogar", com o texto em cinza maré.
- **Aviso de jogo que não conta:** pílula em `turquesa-veu` logo abaixo do cabeçalho do cartão, a mesma do "Extra · vale só para…". O amistoso diz "Amistoso · não conta no ranking". Nunca coral (não é ação) nem dourado (não é conquista).

### Cards / Containers
- **Corner Style:** cantos macios (16px).
- **Background:** creme. O cartão de destaque (`.sol`) vai de creme a pôr do sol num degradê de 135°.
- **Shadow Strategy:** a sombra "Cartão na areia" (ver Elevation & Depth).
- **Border:** nenhuma. O cartão do próprio jogador ganha um anel coral de 3 px.
- **Internal Padding:** 16 px. Os títulos de painel são Outfit 800 a 26 px.

### Inputs / Fields
- **Style:** fundo areia, borda de 1,5 px em linha de madeira e cantos de 16 px. As setas nativas do campo numérico ficam escondidas.
- **Stepper:** botões de − e + de 44 px nas pontas e o número no meio, em 28 px peso 700 tabular.
- **Choices (rádio em cartão):** opção de pelo menos 52 px, com bolinha de 20 px e título com dica. A opção escolhida ganha fundo creme e borda dupla para dentro na cor da tinta. As não escolhidas ficam sobre areia com borda linha de madeira.
- **Segmented:** botões colados de 42 px dentro de uma borda só. O escolhido fica em azul profundo com texto areia (ou na cor própria da opção, como H e M).
- **Focus:** o anel duplo `--focus-ring`.

### Navigation
- **Tab bar inferior:** fica presa embaixo, com fundo creme e um fio de areia em cima. As três abas são iguais, com 56 px de altura, ícone e rótulo DM Sans 700 a 13 px. A aba ativa ganha véu coral com tinta coral, e as inativas ficam em cinza maré. A aba Jogos leva um contador `feitos/total`.
- **Barra de progresso:** 3 px em fio de areia, que enche em coral de botão conforme os jogos terminam.

### Cartão de partida (signature)
É o coração do app.
- **Cabeçalho:** label em caixa alta com "Jogo N · Quadra X" e um pill de status alinhado à direita.
- **Duplas:** cada uma ocupa uma linha com uma barra lateral de 5 px, turquesa para a dupla A e coral para a dupla B.
- **Rede:** um tracejado de 1,5 px em fio de areia separa as duas duplas.
- **Placar:** número em Outfit 800 a 48 px, com − (36 px, contorno) e + game (52 px, coqueiro sólido) para o árbitro.
- **Desfazer:** por 5 s depois de cada game, ocupa o lugar do "Jogo N · Quadra X" (ver Desfazer no cartão).
- **Fim:** a dupla vencedora ganha fundo manteiga e um "pop" de 0,55 s, e a perdedora fica em cinza maré.

### Desfazer no cartão
O "Desfazer" mora no cabeçalho do cartão de partida, não num aviso flutuante: assim o segundo toque no "+" nunca cai nele por engano.
- **Quando:** aparece logo depois de cada game lançado e fica 5 s depois do último toque. Cada toque entra numa pilha curta (até 5), e cada "Desfazer" volta o mais recente.
- **Onde:** no lugar do "Jogo N · Quadra X", do lado oposto aos botões de game. O cabeçalho já reserva 28 px de altura para quem lança placar, então nada embaixo se mexe quando ele aparece ou some.
- **Forma:** pílula de 28 px em coral de botão com texto branco (no Noite, coral puro com tinta azul-marinho), label em caixa alta, seta de voltar desenhada e "+1" ou "−1" ao lado. Em telas de até 380 px fica só "Desfazer". O alvo de toque cresce para 48 px por uma extensão invisível que só avança sobre a área dos nomes da dupla A.
- **Nome acessível:** diz o que volta e de quem ("Desfazer +1 game de Fê e Edu").

### Modo de exclusão
Excluir jogos é um modo do organizador, não um botão em cada cartão: assim o "Excluir" nunca fica ao lado do + e do − de placar.
- **Entrada:** "Excluir jogos" fica no fim da rodada que está rolando, junto do "+ Criar jogo" (fantasma), só no celular de quem organiza.
- **Enquanto dura:** os botões de placar somem dos cartões e entra, no rodapé de cada um, "Excluir jogo" em contorno de perigo. Um aviso creme com anel de perigo de 1,5 px fica preso no topo dizendo que o placar volta no "Pronto".
- **Sem placar:** sai num toque, e o "Desfazer" (coral de botão) ocupa o aviso preso por 10 s, nunca um toast por cima dos cartões.
- **Com placar:** o primeiro toque abre a confirmação em véu de aviso, com o botão de perigo à esquerda e "Cancelar" à direita, dizendo o placar que se perde. É o mesmo desenho do "Sortear de novo", do "Trocar PIN" e do "Encerrar torneio agora".

### Toast
É uma pílula azul profundo com texto areia, logo acima da navegação, só para confirmar ("+1 game: Fê e Edu", "Copiado. É só colar no grupo."). Não pega toque: o dedo atravessa o aviso e chega no que está embaixo. Aparecem no máximo três ao mesmo tempo, e cada um some depois de 3,2 s.

### Selo "Sem conexão"
Quando o servidor não responde, o placar na tela é o último que chegou neste celular, e isso precisa ficar dito.
- **No cabeçalho:** um selo em caixa alta, creme sobre a faixa (as cores da faixa invertidas), seguido de "último placar às HH:MM" e, se houver, "· N na fila". O mesmo selo vale para abrir sem internet e para cair no meio do play.
- **No Telão:** a mesma frase em tamanho de longe, numa faixa creme logo abaixo do título. Sem nada guardado, a tela inteira diz "Sem conexão com o servidor · Tentando de novo…".
- **O que trava:** só o que grava no servidor (editar, trocar PIN, sortear, inscrever, entrar com o PIN). Fica visível e desligado, com o motivo num aviso perto. O placar continua lançando pela fila, e copiar mensagens continua funcionando.

### Avatar de personagem
É um círculo com o personagem ilustrado sobre a cor derivada do nome, com um anel de 2 px na cor do cartão. Sem personagem, mostra as iniciais em Outfit 700. Tem 30 px ao lado do nome na partida e 36 px por padrão.

### Enfeites de praia
O enfeite é o fim de tarde visto da areia: palhas de coqueiro contra o céu, pendendo de cima.
- **Palhas de coqueiro (`Folha`):** três palhas que nascem fora do quadro, no canto de cima à direita, e caem em arco para a esquerda, com os folíolos longos pendendo. Vivem só no canto de cima de uma faixa ou de um cartão, com o pai em `overflow-hidden`, e são uma silhueta chapada na cor da tinta (`currentColor`), sem traço nem degradê.
- **Opacidade e tamanho:** na faixa de cabeçalho (início e torneio), 14 a 15% sobre a faixa, com 160 a 176 px no celular, um pouco para fora do canto, e 176 a 208 px a partir de `sm`, mais para dentro. No cartão "Sou eu", 50% em dourado, com 144 px.
- **Onda de areia (`OndaAreia`):** duas ondas, pêssego a 45% e dourado a 35%, coladas na base de um cartão de destaque, com 28 px de altura.
- **Onde nunca:** perto do placar, dos botões de game ou de qualquer texto que precise ser lido. O enfeite não pega toque, some para leitores de tela e não se mexe.

### Estimativas
Todo número aproximado leva "≈" colado ("≈2h25", "≈5 games"), nunca "~" nem "cerca de". O tempo do torneio sai de uma conta só (rodadas × minutos de uma partida, contando extras, final e mata-mata), arredondado de 5 em 5 min, e aparece igual na criação, no resumo e no sorteio da inscrição. Com ajuste pendente, o app não mostra tamanho nem tempo, para não exibir uma conta torta.

## Do's and Don'ts

### Do:
- **Do** usar azul profundo (`#1e3557`) como cor de todo texto principal no tema Sol, e creme no tema Noite.
- **Do** manter os alvos de toque com pelo menos 48 px. O "+ game" tem 52 px e as abas têm 56 px.
- **Do** usar `coral-botao` (`#bf5440`), e não o coral puro, sempre que houver texto branco sobre coral.
- **Do** usar Outfit 800 com algarismos tabulares em todo número de placar.
- **Do** dar a cada tela nova os dois temas, Sol e Noite, por meio das variáveis de `src/index.css`. Nunca escreva hex direto num componente.
- **Do** usar bordas de 1,5 px, para que continuem visíveis sob sol forte.
- **Do** respeitar `prefers-reduced-motion`. As animações de quique, pop e pulso já são desligadas globalmente.

### Don't:
- **Don't** colocar folha de coqueiro, onda de areia, confete ou qualquer enfeite perto do placar ou dos botões de game.
- **Don't** usar dourado fora de conquista (1º lugar, campeão, coroa).
- **Don't** trocar os papéis das cores: coral não marca seleção e turquesa não é botão de ação.
- **Don't** criar uma segunda sombra de cartão nem levantar o cartão no hover.
- **Don't** usar preto puro como texto nem como fundo de superfície.
- **Don't** usar borda de 1 px nem bordas cinza-frias. Os fios são de areia, e as linhas, de madeira.

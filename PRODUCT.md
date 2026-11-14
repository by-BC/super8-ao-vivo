# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Web pensada para o celular, publicada no GitHub Pages e instalável como PWA (`public/manifest.webmanifest`). Também tem o modo Telão, para uma TV na beira da quadra.

## Users

O público principal é o play de beach tennis que o Bruno frequenta. O app está aberto para outros grupos usarem, mas as decisões partem desse play real. Há três papéis, todos sem cadastro:

- **Galera**: entra pelo código de 6 letras que chega no grupo do WhatsApp. Acompanha jogos, ranking e pódio, e usa o "Sou eu" para achar o próprio próximo jogo, a quadra, o parceiro e os adversários.
- **Árbitro**: entra com o PIN e lança ou corrige o placar na quadra, com o celular na mão no meio do jogo.
- **Organizador**: quem criou o torneio. A chave fica guardada no celular dele. Cola a lista do WhatsApp, escolhe o formato, sorteia e pode editar o torneio inteiro depois.

## Product Purpose

Tirar do papel e de uma pessoa só o trabalho de um play com rodízio: sortear as duplas, anotar o placar de cada quadra e fazer a conta do ranking. Tudo passa para o celular que cada jogador já tem.

O sucesso é o play rodar sem papel, com a galera usando de verdade. O projeto é gratuito e não tem meta de monetização. Também serve de portfólio do Bruno.

## Positioning

**"Nada pode atrapalhar o jogo."** Toda decisão passa por essa regra. Se algo exige login, atrasa a quadra ou perde um ponto quando a internet cai, não entra.

- Funciona sem cadastro, sem senha e sem instalar app: só um código no grupo do WhatsApp.
- O placar nunca perde ponto. Funciona offline com fila no aparelho, tem trava de versão por partida (dois árbitros juntos dão +2, não +1) e permite desfazer.
- A lista entra colada do jeito que veio do WhatsApp.
- As artes de story e a cartinha de cada jogador são geradas no próprio celular, e a foto nunca sai do aparelho.

## Operating Context

- **Na quadra de areia**: sol forte na tela, mão suada e 4G fraco. O árbitro toca um game por vez no meio do jogo. A tela não apaga para o árbitro nem no modo Telão.
- **No WhatsApp**: a lista de inscritos vem de lá, o código do torneio é compartilhado lá e o app gera mensagens prontas para o grupo.
- **Depois do play**: ranking, pódio e artes para story ou post.
- **Ritual recorrente**: a "Liga da quinta", o play semanal. O ranking da temporada ainda está no backlog.

## Capabilities and Constraints

- **Tipos de torneio**: misto, feminino e masculino no mesmo código (cada um com sua chave e seu ranking), só feminino, só masculino ou livre.
- **Formatos**: rodízio (Super 8), duplas fixas em todos contra todos, grupos com mata-mata, e mexicano.
- **Duplas**: por sorteio, equilibradas por nível de A a D, ou montadas à mão.
- **Partida e ranking**: tipos de partida e regras de pontuação configuráveis, com ordem de desempate escolhida pelo organizador.
- **Entrada de jogadores**: lista colada ou inscrição pelo link, com nível, vagas e lista de espera.
- **Edição depois de criado**: o organizador pode editar sem perder placar. O app mostra antes o que fica e o que é sorteado de novo.
- **Personagens**: 21 personagens ilustrados fazem as vezes de foto de perfil. Nenhuma foto de jogador é guardada.
- **Segurança**: PIN com bcrypt e bloqueio após tentativas erradas, e chave do organizador só no aparelho de quem criou. O banco só é acessado por funções `s8_*`.
- **Limpeza automática**: os torneios são apagados depois de um tempo. É uma ferramenta de play, não um arquivo histórico.
- **Fora do escopo declarado**: impedir que quem tem o PIN lance placar errado de propósito. Também não esconde o torneio de quem adivinhar o código.
- **Terminologia**: play, rodízio, Super 8, mexicano, game, quadra, rodada, Telão, "Sou eu", Corrigir, cartinha.
- **Backlog**: Liga da quinta (ranking da temporada), levar a chave do organizador para outro celular, cada jogador escolher o próprio personagem, testes de tela no CI e disputa de 3º lugar.

## Brand Commitments

- **Nome**: Super 8 (repositório `super8-ao-vivo`).
- **Voz**: português brasileiro, coloquial e de quadra ("cola a lista", "o ponto não se perde", "pro story"), frases curtas e concretas.
- **Identidade vigente**: "Clube de sol", o beach tennis como clube social, divertido e ensolarado. Os detalhes visuais pertencem ao DESIGN.md quando ele existir.
- **Logo oficial**: o S em duas faixas, laranja e branca, segurando a bola (`public/marca/`).
- **Enfeites**: folha de coqueiro e onda de areia, sempre longe do placar.

## Evidence on Hand

- Screenshots do fluxo em `docs/play/` (lista, formato, jogos, placar, ranking).
- `docs/demo-placar.gif`, `docs/artes.webp`, `docs/personagens.webp`, `docs/paleta.webp` e `docs/banner.jpg`.
- Os 21 personagens em `public/avatares/`.
- 51 testes do motor e dos personagens.
- **Não existem**: depoimentos, números de uso, arenas parceiras ou imprensa. Nada disso deve ser inventado.

## Product Principles

1. **Nada atrapalha o jogo.** Na dúvida entre um recurso e a velocidade da quadra, ganha a quadra.
2. **O ponto é sagrado.** O placar sobrevive a internet fraca, a dois árbitros ao mesmo tempo e ao toque errado.
3. **Zero atrito para entrar.** Basta um código. Sem cadastro, sem senha e sem instalar nada.
4. **Fala a língua do grupo.** Aceita a lista do jeito que vem do WhatsApp e devolve mensagens e artes prontas para lá.
5. **O organizador muda de ideia sem medo.** Toda edição mostra antes o que fica e o que se perde.

## Accessibility & Inclusion

Não há meta formal de norma. O requisito é o uso na areia: dar para ler sob sol forte, alvos de toque grandes para mão suada e em movimento, e funcionar com 4G fraco ou offline.

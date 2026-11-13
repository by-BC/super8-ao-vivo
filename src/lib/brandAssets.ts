/** Arquivos da logo oficial (public/marca). Mesma origem: dá pra desenhar no canvas sem "sujar". */
const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

/** Símbolo (o S com a bola) pra fundo escuro ou colorido: parte de baixo branca. */
export const SIMBOLO = `${BASE}marca/simbolo.webp`;
/** Símbolo pra fundo claro: a parte branca vira azul profundo. */
export const SIMBOLO_CLARO = `${BASE}marca/simbolo-claro.webp`;
/** Logo completa (símbolo + SUPER8 + "Sistema de beach tênis"), letras brancas: só em fundo escuro. */
export const LOGO = `${BASE}marca/logo.webp`;

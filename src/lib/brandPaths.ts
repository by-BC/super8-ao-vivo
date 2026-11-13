/**
 * Monograma do Super 8 ("Clube de sol"): o 8 desenhado como a trajetória da bola,
 * aberto em cima, lançando a bola coral com os raios do sol. Mesmo desenho na interface,
 * no ícone e nas artes. Caixa de 64×64; aplique MONO_TRANSFORM para centralizar.
 */
export const MONO_TRANSFORM = 'translate(32 33) scale(0.9) translate(-35.5 -32.5)';
/** a trajetória em 8 (traço, sem preenchimento) */
export const MONO_EIGHT = 'M40.5 24.5C37.5 27.5 34 29.8 30.5 31.6C17 38.5 16.5 57.6 31 57.6C45.5 57.6 47.5 41.5 33.2 32.6C20.5 24.8 19.5 8.2 31.5 8C37.2 7.9 41 10.8 42.6 14.8';
export const MONO_STROKE = 6.6;
/** a bola: centro e raio */
export const MONO_BALL = { x: 52.2, y: 17.6, r: 6.3 };
/** a costura da bola (traço creme) */
export const MONO_SEAM = 'M47.48 14.14C51.57 16.97 52.83 20.75 53.46 23.90';
/** os três raios do sol */
export const MONO_RAYS = 'M53.75 8.84L54.34 5.49 M59.49 12.50L62.28 10.55 M60.96 19.15L64.31 19.74';
export const MONO_RAY_STROKE = 3;
/** matriz de MONO_TRANSFORM (para o canvas): a, d = escala; e, f = deslocamento */
export const MONO_MATRIX = { s: 0.9, e: 32 - 35.5 * 0.9, f: 33 - 32.5 * 0.9 };

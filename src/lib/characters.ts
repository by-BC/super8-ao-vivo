/**
 * Os personagens que fazem as vezes de foto de perfil (10 mulheres e 11 homens): ilustrações
 * em círculo, com fundo de praia próprio, em public/avatares (WebP 336×336, ~20 KB cada).
 * O mesmo arquivo serve pro app (<img>) e pras artes (canvas, mesma origem, sem "sujar" o canvas).
 * A ordem é o número salvo no jogador (Player.avatar): só acrescente no fim, nunca reordene.
 */

export type CharGender = 'M' | 'H';

const LIST: { id: string; gender: CharGender; label: string }[] = [
  { id: 'm1', gender: 'M', label: 'Coque com óculos na cabeça' },
  { id: 'm2', gender: 'M', label: 'Rabo de cavalo loiro com viseira' },
  { id: 'm3', gender: 'M', label: 'Coque alto e brincos' },
  { id: 'm4', gender: 'M', label: 'Trança com viseira azul' },
  { id: 'm5', gender: 'M', label: 'Cachos ruivos com óculos na cabeça' },
  { id: 'h1', gender: 'H', label: 'Cabelo ondulado e barba' },
  { id: 'h2', gender: 'H', label: 'Cachos com óculos escuros' },
  { id: 'h3', gender: 'H', label: 'Loiro de boné pra trás' },
  { id: 'h4', gender: 'H', label: 'Boné pra trás e barba' },
  { id: 'h5', gender: 'H', label: 'Óculos esportivo verde' },
  // segunda leva: entram no fim pra não mudar o número dos que já foram escolhidos
  { id: 'm6', gender: 'M', label: 'Rabo de cavalo com raquete' },
  { id: 'h6', gender: 'H', label: 'Cachos e barba com raquete' },
  { id: 'h7', gender: 'H', label: 'Boné branco e camisa branca' },
  { id: 'h8', gender: 'H', label: 'Grisalho de camisa vinho' },
  { id: 'h9', gender: 'H', label: 'Camisa amarela fazendo joinha' },
  { id: 'm7', gender: 'M', label: 'Casaco lilás com raquete' },
  { id: 'm8', gender: 'M', label: 'Camisa azul-marinho com raquete' },
  { id: 'm9', gender: 'M', label: 'Camisa branca de gola vermelha' },
  { id: 'm10', gender: 'M', label: 'Regata azul-marinho' },
  { id: 'h10', gender: 'H', label: 'Barba e camisa vinho' },
  { id: 'h11', gender: 'H', label: 'Barba, tatuagem no pescoço e raquete' },
];

const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

export const CHARACTERS = LIST;
export const CHARACTER_URLS = LIST.map((c) => `${BASE}avatares/${c.id}.webp`);

/** Índices por gênero, na ordem da lista. */
export const WOMEN = LIST.flatMap((c, i) => (c.gender === 'M' ? [i] : []));
export const MEN = LIST.flatMap((c, i) => (c.gender === 'H' ? [i] : []));

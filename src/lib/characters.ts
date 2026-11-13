/**
 * Os 10 personagens que fazem as vezes de foto de perfil (5 mulheres e 5 homens): ilustrações
 * em círculo, com fundo de praia próprio, em public/avatares (WebP 336×336, ~20 KB cada).
 * O mesmo arquivo serve pro app (<img>) e pras artes (canvas, mesma origem, sem "sujar" o canvas).
 * A ordem importa: 0–4 mulheres, 5–9 homens (ver WOMEN e MEN em avatar.ts).
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
];

const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

export const CHARACTERS = LIST;
export const CHARACTER_URLS = LIST.map((c) => `${BASE}avatares/${c.id}.webp`);

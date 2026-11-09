/**
 * Nível de jogo, de A (profissional) a D (iniciante).
 * Por dentro vira número (A = 4 … D = 1) para as contas de equilíbrio: maior = mais forte.
 */
export type LevelLetter = 'A' | 'B' | 'C' | 'D';

export const LEVELS: { letter: LevelLetter; value: number; title: string; hint: string }[] = [
  { letter: 'A', value: 4, title: 'Profissional', hint: 'Joga torneio forte, domina todos os golpes.' },
  { letter: 'B', value: 3, title: 'Avançado', hint: 'Joga torneio amador, ataca e defende com consistência.' },
  { letter: 'C', value: 2, title: 'Intermediário', hint: 'Troca bola, saca e volea sem muito erro.' },
  { letter: 'D', value: 1, title: 'Iniciante', hint: 'Começando ou com pouco tempo de areia.' },
];

/** Quem não marcou nível conta como meio-termo entre C e B. */
export const DEFAULT_LEVEL = 2.5;

export function levelLetter(n: number | null | undefined): LevelLetter | null {
  if (n == null) return null;
  return LEVELS.find((l) => l.value === Math.round(n))?.letter ?? null;
}

export function levelValue(letter: string | null | undefined): number | undefined {
  return LEVELS.find((l) => l.letter === letter?.toUpperCase())?.value;
}

export const levelOf = (p: { level?: number | null }) => p.level ?? DEFAULT_LEVEL;

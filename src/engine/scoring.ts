import type { Scoring, SetScore } from './types';

export interface MatchResult {
  started: boolean;
  done: boolean;
  winner: 'a' | 'b' | null;
  draw: boolean;
  gamesA: number;
  gamesB: number;
  /** Placar parcial "em jogo": games jogados / total, quando faz sentido. */
  progress: string | null;
}

const MATCH_TB = 10;

function setDone(a: number, b: number, n: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi >= n && hi - lo >= 2) || (hi === n + 1 && lo === n);
}

function tieBreakDone(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  return hi >= MATCH_TB && hi - Math.min(a, b) >= 2;
}

function sum(sets: SetScore[]): number {
  return sets.reduce((acc, s) => acc + s[0] + s[1], 0);
}

/**
 * Lê o placar e diz se a partida acabou e quem venceu.
 * `knockout`: no mata-mata não existe empate; no formato "total" o empate vai para um game de desempate.
 * `bye`: partida sem adversário (folga no mata-mata) conta como vitória de A.
 */
export function evaluate(sets: SetScore[], scoring: Scoring, knockout = false, bye = false): MatchResult {
  if (bye) return { started: true, done: true, winner: 'a', draw: false, gamesA: 0, gamesB: 0, progress: null };
  const n = scoring.games;
  const started = sum(sets) > 0;
  const [a, b] = sets[0] ?? [0, 0];

  if (scoring.type === 'melhor3') {
    let wonA = 0;
    let wonB = 0;
    let gamesA = 0;
    let gamesB = 0;
    sets.forEach((s, i) => {
      if (i < 2) {
        gamesA += s[0];
        gamesB += s[1];
        if (setDone(s[0], s[1], n)) s[0] > s[1] ? wonA++ : wonB++;
      } else if (tieBreakDone(s[0], s[1])) {
        // match tie-break vale 1 game para quem vence
        if (s[0] > s[1]) { wonA++; gamesA++; } else { wonB++; gamesB++; }
      }
    });
    const done = wonA === 2 || wonB === 2;
    return { started, done, winner: done ? (wonA > wonB ? 'a' : 'b') : null, draw: false, gamesA, gamesB, progress: null };
  }

  let done: boolean;
  if (scoring.type === 'total') done = a + b >= n && (!knockout || a !== b);
  else if (scoring.type === 'corrida') done = Math.max(a, b) >= n;
  else done = setDone(a, b, n);

  const draw = done && a === b;
  const winner = done && a !== b ? (a > b ? 'a' : 'b') : null;
  const progress = scoring.type === 'total' && started && !done ? (a + b >= n ? 'desempate' : `${a + b}/${n}`) : null;
  return { started, done, winner, draw, gamesA: a, gamesB: b, progress };
}

/** Índice do set que está em disputa (ou do último set jogado). */
export function currentSetIndex(sets: SetScore[], scoring: Scoring): number {
  if (scoring.type !== 'melhor3' || sets.length === 0) return 0;
  return sets.length - 1;
}

function isSetFinished(s: SetScore, index: number, n: number): boolean {
  return index < 2 ? setDone(s[0], s[1], n) : tieBreakDone(s[0], s[1]);
}

/**
 * Soma (+1) ou tira (-1) um game de um lado. Devolve o novo placar ou null se o movimento não é permitido.
 * É uma função pura: a mesma intenção pode ser reaplicada sobre o placar mais recente do servidor.
 */
export function applyGame(
  sets: SetScore[],
  side: 'a' | 'b',
  delta: 1 | -1,
  scoring: Scoring,
  knockout = false,
): SetScore[] | null {
  const next: SetScore[] = sets.length ? sets.map((s) => [s[0], s[1]] as SetScore) : [[0, 0]];
  const idx = side === 'a' ? 0 : 1;

  if (delta > 0) {
    if (evaluate(next, scoring, knockout).done) return null;
    if (scoring.type === 'melhor3') {
      const lastIndex = next.length - 1;
      if (isSetFinished(next[lastIndex], lastIndex, scoring.games)) {
        if (next.length >= 3) return null;
        next.push([0, 0]);
      }
      next[next.length - 1][idx] += 1;
    } else {
      next[0][idx] += 1;
    }
    return next;
  }

  if (scoring.type === 'melhor3') {
    if (next.length > 1 && next[next.length - 1][0] === 0 && next[next.length - 1][1] === 0) next.pop();
    const last = next[next.length - 1];
    if (last[idx] === 0) return null;
    last[idx] -= 1;
  } else {
    if (next[0][idx] === 0) return null;
    next[0][idx] -= 1;
  }
  return next.every((s) => s[0] === 0 && s[1] === 0) ? [] : next;
}

/** Placar em texto: "3 x 1" ou "6-4 3-6 [10-8]". */
export function formatScore(sets: SetScore[], scoring: Scoring): string {
  if (!sets.length) return '0 x 0';
  if (scoring.type !== 'melhor3') return `${sets[0][0]} x ${sets[0][1]}`;
  return sets.map((s, i) => (i === 2 ? `[${s[0]}-${s[1]}]` : `${s[0]}-${s[1]}`)).join(' ');
}

export function scoringLabel(s: Scoring): string {
  switch (s.type) {
    case 'total': return `${s.games} games no total (pode empatar)`;
    case 'corrida': return `Primeiro a ${s.games} games`;
    case 'set': return `Set de ${s.games} games com tie-break no ${s.games}x${s.games}`;
    case 'melhor3': return `Melhor de 3 sets de ${s.games}, 3º set em match tie-break de 10`;
  }
}

/** Estimativa grosseira de games por partida, para mostrar o tamanho do torneio. */
export function gamesPerMatch(s: Scoring): number {
  switch (s.type) {
    case 'total': return s.games;
    case 'corrida': return Math.round(s.games * 1.6);
    case 'set': return Math.round(s.games * 1.7);
    case 'melhor3': return Math.round(s.games * 3.4);
  }
}

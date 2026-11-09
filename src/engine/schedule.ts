import { DEFAULT_LEVEL, levelOf } from './levels';
import { mulberry32, pairKey, shuffle, type Rng } from './rng';
import type { Config, Division, Modality, NewMatch, Player, Stage, Team } from './types';

export const BYE = '__bye__';

export function divisionsOf(players: Player[], modality: Modality): Division[] {
  if (modality === 'mesmo_genero') {
    return [
      { id: 'H', label: 'Masculino', players: players.filter((p) => p.gender === 'H') },
      { id: 'M', label: 'Feminino', players: players.filter((p) => p.gender === 'M') },
    ].filter((d) => d.players.length > 0);
  }
  return [{ id: 'all', label: 'Geral', players }];
}

/** Método do círculo: todos contra todos. Com número ímpar, um folga por rodada. */
export function circleRounds(ids: string[]): [string, string][][] {
  const list = ids.length % 2 ? [...ids, BYE] : [...ids];
  const n = list.length;
  const rounds: [string, string][][] = [];
  let arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i];
      const y = arr[n - 1 - i];
      if (x !== BYE && y !== BYE) pairs.push([x, y]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

/** Quantas partidas simultâneas uma divisão comporta. */
export function capacity(div: Division, mixed: boolean): number {
  if (mixed) {
    const h = div.players.filter((p) => p.gender === 'H').length;
    const m = div.players.filter((p) => p.gender === 'M').length;
    return Math.floor(Math.min(h, m) / 2);
  }
  return Math.floor(div.players.length / 4);
}

/** Divide as quadras entre as divisões, proporcional ao tamanho de cada uma. */
export function allocateCourts(caps: number[], sizes: number[], courts: number): number[] {
  const alloc = caps.map(() => 0);
  for (let left = courts; left > 0; left--) {
    let best = -1;
    let bestScore = -1;
    caps.forEach((cap, i) => {
      if (alloc[i] >= cap) return;
      const score = sizes[i] / (alloc[i] + 1);
      if (score > bestScore) { best = i; bestScore = score; }
    });
    if (best < 0) break;
    alloc[best]++;
  }
  return alloc;
}

export function matchesPerRound(players: Player[], config: Config): { div: Division; m: number }[] {
  const divs = divisionsOf(players, config.modality);
  const mixed = config.modality === 'mista';
  const alloc = allocateCourts(divs.map((d) => capacity(d, mixed)), divs.map((d) => d.players.length), config.courts);
  return divs.map((div, i) => ({ div, m: alloc[i] }));
}

/* ------------------------------------------------------------------ */
/* Rodízio individual                                                  */
/* ------------------------------------------------------------------ */

type Pair = [string, string];
export type RoundPlan = [Pair, Pair][];

interface Counts {
  partner: Map<string, number>;
  opp: Map<string, number>;
  games: Map<string, number>;
  /** Nível de cada um, só quando a divisão tem níveis diferentes marcados. */
  lv: Map<string, number> | null;
  /** Força média de uma dupla (soma de 2 níveis). */
  mean: number;
}

const get = (m: Map<string, number>, k: string) => m.get(k) ?? 0;
const bump = (m: Map<string, number>, k: string, d = 1) => m.set(k, get(m, k) + d);
function newCounts(div: Division): Counts {
  const has = div.players.some((p) => p.level != null) && new Set(div.players.map(levelOf)).size > 1;
  const lv = has ? new Map(div.players.map((p) => [p.id, levelOf(p)])) : null;
  const mean = lv ? (2 * [...lv.values()].reduce((a, b) => a + b, 0)) / lv.size : 0;
  return { partner: new Map(), opp: new Map(), games: new Map(), lv, mean };
}

/** Pesos do equilíbrio por nível: jogo com duplas de força diferente e dupla forte demais (ou fraca demais). */
const LEVEL_W = 3;
const PAIR_W = 2;
const strength = (c: Counts, p: Pair) => (c.lv!.get(p[0]) ?? DEFAULT_LEVEL) + (c.lv!.get(p[1]) ?? DEFAULT_LEVEL);

function levelCost(c: Counts, p: Pair, q: Pair): number {
  if (!c.lv) return 0;
  const d = strength(c, p) - strength(c, q);
  return d * d * LEVEL_W;
}

function pairBal(c: Counts, p: Pair): number {
  if (!c.lv) return 0;
  const d = strength(c, p) - c.mean;
  return d * d * PAIR_W;
}

function partnerCost(c: Counts, x: string, y: string): number {
  const p = get(c.partner, pairKey(x, y));
  return p * p * 100;
}

function oppCost(c: Counts, p: Pair, q: Pair): number {
  let s = 0;
  for (const x of p) for (const y of q) { const o = get(c.opp, pairKey(x, y)); s += o * o; }
  return s;
}

/** Escolhe quem joga a rodada: quem jogou menos até aqui, empate decidido no sorteio. */
export function pickPlaying(pool: string[], need: number, games: Map<string, number>, rng: Rng): string[] {
  return shuffle(pool, rng).sort((x, y) => get(games, x) - get(games, y)).slice(0, need);
}

function mixedPairs(men: string[], women: string[], c: Counts, rng: Rng): Pair[] {
  const w = shuffle(women, rng);
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < men.length; i++) {
      for (let j = i + 1; j < men.length; j++) {
        const cur = partnerCost(c, men[i], w[i]) + partnerCost(c, men[j], w[j]) + pairBal(c, [men[i], w[i]]) + pairBal(c, [men[j], w[j]]);
        const alt = partnerCost(c, men[i], w[j]) + partnerCost(c, men[j], w[i]) + pairBal(c, [men[i], w[j]]) + pairBal(c, [men[j], w[i]]);
        if (alt < cur) { [w[i], w[j]] = [w[j], w[i]]; improved = true; }
      }
    }
  }
  return men.map((m, i) => [m, w[i]]);
}

function freePairs(ps: string[], c: Counts, rng: Rng): Pair[] {
  const s = shuffle(ps, rng);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) pairs.push([s[i], s[i + 1]]);
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [a, b] = pairs[i];
        const [x, y] = pairs[j];
        const cur = partnerCost(c, a, b) + partnerCost(c, x, y) + pairBal(c, [a, b]) + pairBal(c, [x, y]);
        const o1 = partnerCost(c, a, x) + partnerCost(c, b, y) + pairBal(c, [a, x]) + pairBal(c, [b, y]);
        const o2 = partnerCost(c, a, y) + partnerCost(c, b, x) + pairBal(c, [a, y]) + pairBal(c, [b, x]);
        if (o1 < cur && o1 <= o2) { pairs[i] = [a, x]; pairs[j] = [b, y]; improved = true; }
        else if (o2 < cur) { pairs[i] = [a, y]; pairs[j] = [b, x]; improved = true; }
      }
    }
  }
  return pairs;
}

function matchPairs(pairs: Pair[], c: Counts, rng: Rng): RoundPlan {
  const s = shuffle(pairs, rng);
  const ms: [Pair, Pair][] = [];
  for (let i = 0; i + 1 < s.length; i += 2) ms.push([s[i], s[i + 1]]);
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const [p, q] = ms[i];
        const [r, t] = ms[j];
        const cur = oppCost(c, p, q) + oppCost(c, r, t) + levelCost(c, p, q) + levelCost(c, r, t);
        const o1 = oppCost(c, p, r) + oppCost(c, q, t) + levelCost(c, p, r) + levelCost(c, q, t);
        const o2 = oppCost(c, p, t) + oppCost(c, q, r) + levelCost(c, p, t) + levelCost(c, q, r);
        if (o1 < cur && o1 <= o2) { ms[i] = [p, r]; ms[j] = [q, t]; improved = true; }
        else if (o2 < cur) { ms[i] = [p, t]; ms[j] = [q, r]; improved = true; }
      }
    }
  }
  return ms;
}

function record(c: Counts, plan: RoundPlan): void {
  for (const [p, q] of plan) {
    bump(c.partner, pairKey(p[0], p[1]));
    bump(c.partner, pairKey(q[0], q[1]));
    for (const x of p) for (const y of q) bump(c.opp, pairKey(x, y));
    for (const x of [...p, ...q]) bump(c.games, x);
  }
}

function idsBy(div: Division) {
  return {
    all: div.players.map((p) => p.id),
    men: div.players.filter((p) => p.gender === 'H').map((p) => p.id),
    women: div.players.filter((p) => p.gender === 'M').map((p) => p.id),
  };
}

function greedySchedule(div: Division, mixed: boolean, rounds: number, m: number, rng: Rng): RoundPlan[] {
  const c = newCounts(div);
  const { all, men, women } = idsBy(div);
  const out: RoundPlan[] = [];
  for (let r = 0; r < rounds; r++) {
    let pairs: Pair[];
    if (mixed) pairs = mixedPairs(pickPlaying(men, 2 * m, c.games, rng), pickPlaying(women, 2 * m, c.games, rng), c, rng);
    else pairs = freePairs(pickPlaying(all, 4 * m, c.games, rng), c, rng);
    const plan = matchPairs(pairs, c, rng);
    record(c, plan);
    out.push(plan);
  }
  return out;
}

/** Quadrado latino: cada homem joga uma vez com cada mulher. Com número ímpar, a fórmula também equilibra adversários. */
function latinSchedule(div: Division, rounds: number, m: number, rng: Rng): RoundPlan[] | null {
  const men = shuffle(idsBy(div).men, rng);
  const women = shuffle(idsBy(div).women, rng);
  const k = men.length;
  if (women.length !== k || k < 3) return null;
  const odd = k % 2 === 1;
  if (!(odd ? 2 * m === k - 1 : 2 * m === k)) return null;
  const c = newCounts(div);
  const out: RoundPlan[] = [];
  for (let r = 0; r < rounds; r++) {
    const rr = r % k;
    const pair = (i: number): Pair => {
      const x = ((i % k) + k) % k;
      return [men[x], women[(x + rr) % k]];
    };
    let plan: RoundPlan;
    if (odd) {
      plan = [];
      for (let j = 1; j <= (k - 1) / 2; j++) plan.push([pair(rr + j), pair(rr - j)]);
    } else {
      plan = matchPairs(men.map((_, i) => pair(i)), c, rng);
    }
    record(c, plan);
    out.push(plan);
  }
  return out;
}

/** Método do círculo para parceiros: com N múltiplo de 4, ninguém repete parceiro em N-1 rodadas (o Super 8 clássico). */
function circleSchedule(div: Division, rounds: number, m: number, rng: Rng): RoundPlan[] | null {
  const ids = shuffle(idsBy(div).all, rng);
  if (ids.length % 4 !== 0 || 4 * m !== ids.length) return null;
  const pm = circleRounds(ids);
  const c = newCounts(div);
  const out: RoundPlan[] = [];
  for (let r = 0; r < rounds; r++) {
    const plan = matchPairs(pm[r % pm.length], c, rng);
    record(c, plan);
    out.push(plan);
  }
  return out;
}

export interface ScheduleQuality {
  partnerRepeats: number;
  oppSquares: number;
  gamesSpread: number;
  /** Soma, em todos os jogos, da diferença de força entre as duplas ao quadrado (0 sem nível). */
  levelGap: number;
}

export function scheduleQuality(div: Division, mixed: boolean, plans: RoundPlan[]): ScheduleQuality {
  const c = newCounts(div);
  plans.forEach((p) => record(c, p));
  let partnerRepeats = 0;
  for (const v of c.partner.values()) partnerRepeats += Math.max(0, v - 1);
  let oppSquares = 0;
  for (const v of c.opp.values()) oppSquares += v * v;
  const { all, men, women } = idsBy(div);
  const spread = (ids: string[]) => {
    if (!ids.length) return 0;
    const g = ids.map((id) => get(c.games, id));
    return Math.max(...g) - Math.min(...g);
  };
  const gamesSpread = mixed ? Math.max(spread(men), spread(women)) : spread(all);
  let levelGap = 0;
  if (c.lv) for (const plan of plans) for (const [p, q] of plan) levelGap += (strength(c, p) - strength(c, q)) ** 2;
  return { partnerRepeats, oppSquares, gamesSpread, levelGap };
}

const cost = (q: ScheduleQuality) => q.partnerRepeats * 1000 + q.gamesSpread * 300 + q.oppSquares + q.levelGap * LEVEL_W;

/** Monta todas as rodadas do rodízio de uma divisão, testando várias tentativas e ficando com a melhor. */
export function rodizioPlans(div: Division, mixed: boolean, rounds: number, m: number, rng: Rng, budgetMs = 400): RoundPlan[] {
  if (m <= 0) return Array.from({ length: rounds }, () => []);
  const candidates: RoundPlan[][] = [];
  const structured = mixed ? latinSchedule(div, rounds, m, rng) : circleSchedule(div, rounds, m, rng);
  if (structured) candidates.push(structured);
  const start = Date.now();
  for (let i = 0; i < 80; i++) {
    if (i >= 6 && Date.now() - start > budgetMs) break;
    candidates.push(greedySchedule(div, mixed, rounds, m, rng));
  }
  let best = candidates[0];
  let bestCost = Infinity;
  for (const cand of candidates) {
    const k = cost(scheduleQuality(div, mixed, cand));
    if (k < bestCost) { best = cand; bestCost = k; }
  }
  return best;
}

export function plansToMatches(perDiv: { div: Division; plans: RoundPlan[]; grp?: string | null }[], roundOffset = 0): NewMatch[] {
  const out: NewMatch[] = [];
  const total = Math.max(0, ...perDiv.map((d) => d.plans.length));
  for (let r = 0; r < total; r++) {
    let slot = 0;
    for (const { div, plans, grp } of perDiv) {
      for (const [p, q] of plans[r] ?? []) {
        out.push({
          stage: 'rodada', round: roundOffset + r + 1, division: div.id, grp: grp ?? null, slot, court: slot + 1,
          label: null, a: [...p], b: [...q], teamA: null, teamB: null, sets: [],
        });
        slot++;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rodízio em grupos e jogo extra                                      */
/* ------------------------------------------------------------------ */

/** Um pedaço do rodízio que roda separado: a divisão inteira ou um grupo dela, com suas quadras. */
export interface Unit {
  div: Division;
  grp: string | null;
  /** partidas por rodada (= quadras deste grupo) */
  m: number;
}

/**
 * Divide a divisão em 2 grupos equilibrados: ordena pelo nível e distribui em serpentina (A B B A A B…).
 * No misto, homens e mulheres são distribuídos separado, pra cada grupo ter os dois. Sem rng, só os tamanhos importam.
 */
export function splitGroups(div: Division, mixed: boolean, rng: Rng | null): [Player[], Player[]] {
  const order = (ps: Player[]) => (rng ? shuffle(ps, rng) : [...ps]).sort((x, y) => levelOf(y) - levelOf(x));
  const snake = (ps: Player[]): [Player[], Player[]] => {
    const g: [Player[], Player[]] = [[], []];
    ps.forEach((p, i) => g[Math.floor(i / 2) % 2 === 0 ? i % 2 : 1 - (i % 2)].push(p));
    return g[0].length >= g[1].length ? g : [g[1], g[0]];
  };
  if (mixed) {
    const [ha, hb] = snake(order(div.players.filter((p) => p.gender === 'H')));
    const [ma, mb] = snake(order(div.players.filter((p) => p.gender === 'M')));
    return [[...ha, ...ma], [...hb, ...mb]];
  }
  return snake(order(div.players));
}

export function rodizioUnits(players: Player[], config: Config, rng: Rng | null): Unit[] {
  const mixed = config.modality === 'mista';
  const two = config.format === 'rodizio' && config.rodizioGroups === 2;
  const subs: { div: Division; grp: string | null }[] = [];
  for (const div of divisionsOf(players, config.modality)) {
    if (!two) { subs.push({ div, grp: null }); continue; }
    const [a, b] = splitGroups(div, mixed, rng);
    subs.push({ div: { ...div, players: a }, grp: 'A' }, { div: { ...div, players: b }, grp: 'B' });
  }
  const alloc = allocateCourts(subs.map((x) => capacity(x.div, mixed)), subs.map((x) => x.div.players.length), config.courts);
  return subs.map((x, i) => ({ ...x, m: alloc[i] }));
}

/** Quantos jogos cada um faz no rodízio, a partir das rodadas montadas. */
function gamesOf(plans: RoundPlan[]): Map<string, number> {
  const g = new Map<string, number>();
  for (const plan of plans) for (const [p, q] of plan) for (const id of [...p, ...q]) bump(g, id);
  return g;
}

/**
 * Jogo extra no fim pra todo mundo somar o mesmo número de partidas dentro do grupo.
 * Primeiro junta quem ficou devendo dos dois grupos num jogo A x B (vale pros 4, cada um no seu grupo).
 * O que sobrar joga dentro do próprio grupo; se faltar gente, completa com quem já fechou e o jogo vale só pra quem devia.
 */
export function equalizeExtras(units: Unit[], games: Map<string, number>[], mixed: boolean, startRound: number, rng: Rng): NewMatch[] {
  const out: NewMatch[] = [];
  // quadras de cada grupo, na mesma ordem em que as rodadas normais foram numeradas
  const courts: number[][] = [];
  units.reduce((c, u) => { courts.push(Array.from({ length: u.m }, (_, k) => c + k)); return c + u.m; }, 1);
  const usedCourt = new Set<string>();
  const usedPlayer = new Set<string>();
  const divIds = [...new Set(units.map((u) => u.div.id))];
  for (const divId of divIds) {
    const idx = units.map((_, i) => i).filter((i) => units[i].div.id === divId && units[i].m > 0);
    const nextSlot = new Map<number, number>();
    /** Põe o jogo na primeira rodada extra em que tem quadra livre do grupo e ninguém dos 4 já está jogando. */
    const add = (unit: number, grp: string | null, a: string[], b: string[], counts: string[] | null, label: string) => {
      const ids = [...a, ...b];
      for (let round = startRound; ; round++) {
        if (ids.some((id) => usedPlayer.has(`${round}|${id}`))) continue;
        const court = courts[unit].find((c) => !usedCourt.has(`${round}|${c}`));
        if (court === undefined) continue;
        usedCourt.add(`${round}|${court}`);
        ids.forEach((id) => usedPlayer.add(`${round}|${id}`));
        const slot = nextSlot.get(round) ?? 0;
        nextSlot.set(round, slot + 1);
        out.push({ stage: 'rodada', round, division: divId, grp, slot, court, label, a, b, teamA: null, teamB: null, sets: [], counts });
        return;
      }
    };
    // quem deve jogo, por grupo e (no misto) por gênero
    const info = idx.map((i) => {
      const u = units[i];
      const g = games[i];
      const kinds = mixed ? (['H', 'M'] as const) : (['all'] as const);
      const shorts: Record<string, string[]> = {};
      const fillers: Record<string, string[]> = {};
      for (const k of kinds) {
        const ids = u.div.players.filter((p) => k === 'all' || p.gender === k).map((p) => p.id);
        if (!ids.length) { shorts[k] = []; fillers[k] = []; continue; }
        const max = Math.max(...ids.map((id) => g.get(id) ?? 0));
        shorts[k] = shuffle(ids.filter((id) => (g.get(id) ?? 0) < max), rng);
        fillers[k] = shuffle(ids.filter((id) => (g.get(id) ?? 0) >= max), rng);
      }
      return { i, u, shorts, fillers };
    });

    // quem já pagou o jogo que devia passa a poder completar quadra
    const settle = (x: (typeof info)[number], k: string, n: number) => {
      const done = x.shorts[k].splice(-n, n);
      x.fillers[k].push(...done);
      return done;
    };
    if (info.length === 2) {
      const [A, B] = info;
      if (mixed) {
        while (A.shorts.H.length && A.shorts.M.length && B.shorts.H.length && B.shorts.M.length) {
          add(A.i, null, [...settle(A, 'H', 1), ...settle(A, 'M', 1)], [...settle(B, 'H', 1), ...settle(B, 'M', 1)], null, 'Extra · A x B');
        }
      } else {
        while (A.shorts.all.length >= 2 && B.shorts.all.length >= 2) {
          add(A.i, null, settle(A, 'all', 2), settle(B, 'all', 2), null, 'Extra · A x B');
        }
      }
    }

    for (const x of info) {
      const fill = (k: string, n: number) => {
        const f = x.fillers[k];
        const got = f.splice(0, n);
        f.push(...got); // roda a fila pra não ser sempre o mesmo completando
        return got;
      };
      if (mixed) {
        while (x.shorts.H.length || x.shorts.M.length) {
          const hs = x.shorts.H.splice(0, 2);
          const ms = x.shorts.M.splice(0, 2);
          const h = [...hs, ...fill('H', 2 - hs.length)];
          const m = [...ms, ...fill('M', 2 - ms.length)];
          if (h.length < 2 || m.length < 2) break;
          const owed = [...hs, ...ms];
          add(x.i, x.u.grp, [h[0], m[0]], [h[1], m[1]], owed.length === 4 ? null : owed, 'Extra');
        }
      } else {
        while (x.shorts.all.length) {
          const owed = x.shorts.all.splice(0, 4);
          const ids = [...owed, ...fill('all', 4 - owed.length)];
          if (ids.length < 4) break;
          add(x.i, x.u.grp, [ids[0], ids[1]], [ids[2], ids[3]], owed.length === 4 ? null : owed, 'Extra');
        }
      }
    }
  }
  return out;
}

export function rodizioMatches(players: Player[], config: Config, rng: Rng): NewMatch[] {
  const mixed = config.modality === 'mista';
  const units = rodizioUnits(players, config, rng);
  const perUnit = units.map((u) => ({ div: u.div, grp: u.grp, plans: rodizioPlans(u.div, mixed, config.rounds, u.m, rng) }));
  const out = plansToMatches(perUnit);
  if (config.extraGames) out.push(...equalizeExtras(units, perUnit.map((x) => gamesOf(x.plans)), mixed, config.rounds + 1, rng));
  return out;
}

/** Jogos extras que o torneio vai ter, sem montar as rodadas de verdade (para o resumo antes de criar). */
export function plannedExtras(players: Player[], config: Config): NewMatch[] {
  if (config.format !== 'rodizio' || !config.extraGames) return [];
  const mixed = config.modality === 'mista';
  const units = rodizioUnits(players, config, null);
  const games = units.map((u) => {
    const g = new Map<string, number>();
    const kinds = mixed ? ['H', 'M'] : ['all'];
    for (const k of kinds) {
      const ids = u.div.players.filter((p) => k === 'all' || p.gender === k).map((p) => p.id);
      if (!ids.length) continue;
      const slots = (mixed ? 2 : 4) * u.m * config.rounds;
      const base = Math.floor(slots / ids.length);
      const more = slots % ids.length;
      ids.forEach((id, i) => g.set(id, base + (i < more ? 1 : 0)));
    }
    return g;
  });
  return equalizeExtras(units, games, mixed, config.rounds + 1, mulberry32(1));
}

/* ------------------------------------------------------------------ */
/* Duplas fixas                                                        */
/* ------------------------------------------------------------------ */

function byLevel(ps: Player[], desc: boolean, rng: Rng): Player[] {
  return shuffle(ps, rng).sort((x, y) => (desc ? -1 : 1) * (levelOf(x) - levelOf(y)));
}

/** Forma as duplas fixas: sorteio, equilibrado por nível (forte com mais fraco) ou manual. */
export function formTeams(players: Player[], config: Config, rng: Rng, manual?: [string, string][]): Team[] {
  const teams: Team[] = [];
  let n = 0;
  for (const div of divisionsOf(players, config.modality)) {
    let pairs: [string, string][] = [];
    const inDiv = new Set(div.players.map((p) => p.id));
    if (config.pairing === 'manual' && manual) {
      pairs = manual.filter(([x, y]) => inDiv.has(x) && inDiv.has(y));
    } else if (config.modality === 'mista') {
      const eq = config.pairing === 'equilibrado';
      const men = eq ? byLevel(div.players.filter((p) => p.gender === 'H'), true, rng) : shuffle(div.players.filter((p) => p.gender === 'H'), rng);
      const women = eq ? byLevel(div.players.filter((p) => p.gender === 'M'), false, rng) : shuffle(div.players.filter((p) => p.gender === 'M'), rng);
      for (let i = 0; i < Math.min(men.length, women.length); i++) pairs.push([men[i].id, women[i].id]);
    } else if (config.pairing === 'equilibrado') {
      const list = byLevel(div.players, true, rng);
      for (let i = 0; i < Math.floor(list.length / 2); i++) pairs.push([list[i].id, list[list.length - 1 - i].id]);
    } else {
      const list = shuffle(div.players, rng);
      for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i].id, list[i + 1].id]);
    }
    for (const p of pairs) teams.push({ id: `t${++n}`, players: p, division: div.id, group: null });
  }
  return teams;
}

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP';

/** Distribui as duplas nos grupos em "serpentina" (1-2-3-3-2-1), equilibrando força quando há nível. */
export function assignGroups(teams: Team[], groups: number, players: Player[], config: Config, rng: Rng): Team[] {
  const level = new Map(players.map((p) => [p.id, levelOf(p)]));
  const strength = (t: Team) => t.players.reduce((s, id) => s + (level.get(id) ?? DEFAULT_LEVEL), 0);
  const out: Team[] = [];
  const byDiv = new Map<string, Team[]>();
  teams.forEach((t) => byDiv.set(t.division, [...(byDiv.get(t.division) ?? []), t]));
  for (const list of byDiv.values()) {
    let ordered = shuffle(list, rng);
    if (config.pairing === 'equilibrado') ordered = ordered.sort((x, y) => strength(y) - strength(x));
    const g = Math.max(1, Math.min(groups, Math.floor(list.length / 2)));
    ordered.forEach((t, i) => {
      const lap = Math.floor(i / g);
      const pos = i % g;
      const idx = lap % 2 === 0 ? pos : g - 1 - pos;
      out.push({ ...t, group: GROUP_LETTERS[idx] });
    });
  }
  return out;
}

interface PendingMatch {
  stage: Stage;
  division: string;
  grp: string | null;
  a: string[];
  b: string[];
  teamA: string;
  teamB: string;
}

/**
 * Agrupa as partidas em rodadas que cabem nas quadras: ninguém joga duas vezes na mesma rodada
 * e cada rodada tem no máximo uma partida por quadra.
 */
export function packIntoRounds(list: PendingMatch[], courts: number, roundOffset = 0): NewMatch[] {
  const out: NewMatch[] = [];
  let remaining = list.slice();
  let round = roundOffset;
  while (remaining.length) {
    round++;
    const used = new Set<string>();
    const taken: PendingMatch[] = [];
    for (const m of remaining) {
      if (taken.length >= courts) break;
      const ps = [...m.a, ...m.b];
      if (ps.some((p) => used.has(p))) continue;
      taken.push(m);
      ps.forEach((p) => used.add(p));
    }
    remaining = remaining.filter((m) => !taken.includes(m));
    taken.forEach((m, i) => out.push({ ...m, round, slot: i, court: i + 1, label: null, sets: [] }));
  }
  return out;
}

/** Todos contra todos dentro de cada unidade (divisão ou grupo), intercalando as unidades rodada a rodada. */
export function teamRoundRobin(teams: Team[], stage: Stage, courts: number): NewMatch[] {
  const units = new Map<string, Team[]>();
  for (const t of teams) {
    const key = `${t.division}|${t.group ?? ''}`;
    units.set(key, [...(units.get(key) ?? []), t]);
  }
  const perUnit = [...units.values()].map((ts) => {
    const byId = new Map(ts.map((t) => [t.id, t]));
    return circleRounds(ts.map((t) => t.id)).map((round) =>
      round.map(([x, y]): PendingMatch => {
        const tx = byId.get(x)!;
        const ty = byId.get(y)!;
        return { stage, division: tx.division, grp: tx.group ?? null, a: [...tx.players], b: [...ty.players], teamA: tx.id, teamB: ty.id };
      }),
    );
  });
  const list: PendingMatch[] = [];
  const maxRounds = Math.max(0, ...perUnit.map((u) => u.length));
  for (let r = 0; r < maxRounds; r++) for (const u of perUnit) list.push(...(u[r] ?? []));
  return packIntoRounds(list, courts);
}

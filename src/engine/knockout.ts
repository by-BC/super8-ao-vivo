import { evaluate } from './scoring';
import { standings, teamEntities, teamSides, type Row } from './standings';
import type { Config, Match, NewMatch, Player, Team } from './types';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

/** Ordem clássica da chave: 1 x 8, 4 x 5, 2 x 7, 3 x 6... (cabeças 1 e 2 só se cruzam na final). */
export function bracketOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function roundLabel(teamsInRound: number): string {
  if (teamsInRound <= 2) return 'Final';
  if (teamsInRound === 4) return 'Semifinal';
  if (teamsInRound === 8) return 'Quartas';
  if (teamsInRound === 16) return 'Oitavas';
  return `Fase de ${teamsInRound}`;
}

export function groupTables(division: string, teams: Team[], players: Player[], matches: Match[], config: Config): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  const groups = [...new Set(teams.filter((t) => t.division === division).map((t) => t.group ?? ''))].sort();
  for (const g of groups) {
    const ts = teams.filter((t) => t.division === division && (t.group ?? '') === g);
    const ms = matches.filter((m) => m.stage === 'grupo' && m.division === division && (m.grp ?? '') === g);
    out.set(g, standings(teamEntities(ts, players), ms, config, teamSides));
  }
  return out;
}

const perGame = (x: number, j: number) => (j ? x / j : 0);

/** Ordena classificados de grupos diferentes. Usa média por partida porque os grupos podem ter tamanhos diferentes. */
function crossCompare(config: Config) {
  return (x: Row, y: Row) => {
    const mx = perGame(config.ranking.base === 'games' ? x.gf : x.pts, x.j);
    const my = perGame(config.ranking.base === 'games' ? y.gf : y.pts, y.j);
    return my - mx || perGame(y.v, y.j) - perGame(x.v, x.j) || perGame(y.sg, y.j) - perGame(x.sg, x.j) || x.label.localeCompare(y.label, 'pt-BR');
  };
}

function teamMatch(division: string, round: number, slot: number, label: string, ta: Team, tb: Team | null): NewMatch {
  return {
    stage: 'mata', round, division, grp: null, slot, court: 1, label,
    a: [...ta.players], b: tb ? [...tb.players] : [], teamA: ta.id, teamB: tb?.id ?? null, sets: [],
  };
}

/** Primeira fase do mata-mata de uma divisão, quando todos os jogos de grupo acabaram. */
export function knockoutStart(division: string, teams: Team[], players: Player[], matches: Match[], config: Config): NewMatch[] | null {
  const groupMatches = matches.filter((m) => m.stage === 'grupo' && m.division === division);
  if (!groupMatches.length || groupMatches.some((m) => !evaluate(m.sets, config.scoring).done)) return null;
  if (matches.some((m) => m.stage === 'mata' && m.division === division)) return null;

  const tables = groupTables(division, teams, players, matches, config);
  const seeds: Row[] = [];
  for (let q = 0; q < config.qualify; q++) {
    const atQ = [...tables.values()].map((rows) => rows[q]).filter(Boolean);
    seeds.push(...atQ.sort(crossCompare(config)));
  }
  if (seeds.length < 2) return null;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const size = nextPow2(seeds.length);
  const order = bracketOrder(size);
  const pos: (Team | null)[] = order.map((s) => (seeds[s - 1] ? teamById.get(seeds[s - 1].key)! : null));

  // Evita dupla do mesmo grupo se enfrentando logo na primeira fase, quando dá para trocar.
  const sameGroup = (x: Team | null, y: Team | null) => !!x && !!y && x.group === y.group;
  for (let k = 0; k < size / 2; k++) {
    if (!sameGroup(pos[2 * k], pos[2 * k + 1])) continue;
    for (let j = 0; j < size / 2; j++) {
      if (j === k) continue;
      const a1 = pos[2 * k];
      const b1 = pos[2 * j + 1];
      const a2 = pos[2 * j];
      const b2 = pos[2 * k + 1];
      if (b1 && !sameGroup(a1, b1) && !sameGroup(a2, b2)) {
        pos[2 * k + 1] = b1;
        pos[2 * j + 1] = b2;
        break;
      }
    }
  }

  const label = roundLabel(size);
  const out: NewMatch[] = [];
  for (let k = 0; k < size / 2; k++) {
    const x = pos[2 * k];
    const y = pos[2 * k + 1];
    const lbl = size > 2 ? `${label} ${k + 1}` : label;
    if (x) out.push(teamMatch(division, 1, k, lbl, x, y));
    else if (y) out.push(teamMatch(division, 1, k, lbl, y, null));
  }
  return out;
}

export function matchWinnerTeam(m: Match, config: Config): string | null {
  const r = evaluate(m.sets, config.scoring, true, m.b.length === 0);
  if (!r.done) return null;
  return r.winner === 'a' ? m.teamA : m.teamB;
}

/** Próxima fase do mata-mata de uma divisão, quando a fase atual terminou. */
export function knockoutNext(division: string, teams: Team[], matches: Match[], config: Config): NewMatch[] | null {
  const ko = matches.filter((m) => m.stage === 'mata' && m.division === division);
  if (!ko.length) return null;
  const last = Math.max(...ko.map((m) => m.round));
  const current = ko.filter((m) => m.round === last).sort((x, y) => x.slot - y.slot);
  const slots = Math.max(...current.map((m) => m.slot)) + 1;
  if (slots <= 1) return null;
  const winners = new Map<number, string | null>(current.map((m) => [m.slot, matchWinnerTeam(m, config)]));
  if ([...winners.values()].some((w) => !w)) return null;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const nextSlots = slots / 2;
  const label = roundLabel(slots);
  const out: NewMatch[] = [];
  for (let j = 0; j < nextSlots; j++) {
    const a = winners.get(2 * j);
    const b = winners.get(2 * j + 1);
    const ta = a ? teamById.get(a) : undefined;
    const tb = b ? teamById.get(b) : undefined;
    const lbl = nextSlots > 1 ? `${label} ${j + 1}` : label;
    if (ta) out.push(teamMatch(division, last + 1, j, lbl, ta, tb ?? null));
    else if (tb) out.push(teamMatch(division, last + 1, j, lbl, tb, null));
  }
  return out;
}

/** Campeão do mata-mata da divisão (id da dupla), se a final já acabou. */
export function knockoutChampion(division: string, matches: Match[], config: Config): string | null {
  const ko = matches.filter((m) => m.stage === 'mata' && m.division === division);
  if (!ko.length) return null;
  const last = Math.max(...ko.map((m) => m.round));
  const final = ko.filter((m) => m.round === last);
  if (final.length !== 1 || final[0].slot !== 0 || final[0].label !== 'Final') return null;
  return matchWinnerTeam(final[0], config);
}

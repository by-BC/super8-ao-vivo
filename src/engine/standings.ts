import { evaluate } from './scoring';
import type { Config, Gender, Match, Player, Team, Tiebreak } from './types';

export interface Entity {
  key: string;
  ids: string[];
  label: string;
  gender: Gender | null;
}

export interface Row extends Entity {
  /** partidas encerradas */
  j: number;
  v: number;
  e: number;
  d: number;
  /** games feitos e sofridos */
  gf: number;
  gs: number;
  sg: number;
  /** pontos por resultado (3/1/0) */
  pts: number;
  /** valor do critério principal (games ou resultado, total ou média) */
  main: number;
  pos: number;
}

export type SideKeys = (m: Match, side: 'a' | 'b') => string[];

export const individualSides: SideKeys = (m, side) => (side === 'a' ? m.a : m.b);
export const teamSides: SideKeys = (m, side) => {
  const t = side === 'a' ? m.teamA : m.teamB;
  return t ? [t] : [];
};

export function playerEntities(players: Player[]): Entity[] {
  return players.map((p) => ({ key: p.id, ids: [p.id], label: p.name, gender: p.gender }));
}

export function teamEntities(teams: Team[], players: Player[]): Entity[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return teams.map((t) => {
    const ps = t.players.map((id) => byId.get(id));
    const g = ps[0]?.gender && ps.every((p) => p?.gender === ps[0]?.gender) ? ps[0]!.gender : null;
    return { key: t.id, ids: [...t.players], label: ps.map((p) => p?.name ?? '?').join(' e '), gender: g };
  });
}

const EPS = 1e-9;

/**
 * Classificação. Critério principal (games ou resultado), depois a lista de desempates na ordem escolhida.
 * Quem continua empatado em tudo divide a posição.
 */
export function standings(entities: Entity[], matches: Match[], config: Pick<Config, 'scoring' | 'ranking'>, sides: SideKeys): Row[] {
  const rows = new Map<string, Row>(
    entities.map((e) => [e.key, { ...e, j: 0, v: 0, e: 0, d: 0, gf: 0, gs: 0, sg: 0, pts: 0, main: 0, pos: 1 }]),
  );
  const finished: { m: Match; ga: number; gb: number }[] = [];

  for (const m of matches) {
    if (m.b.length === 0) continue; // folga no mata-mata não conta
    const r = evaluate(m.sets, config.scoring, m.stage === 'mata');
    if (!r.done) continue;
    finished.push({ m, ga: r.gamesA, gb: r.gamesB });
    for (const side of ['a', 'b'] as const) {
      const own = side === 'a' ? r.gamesA : r.gamesB;
      const opp = side === 'a' ? r.gamesB : r.gamesA;
      for (const k of sides(m, side)) {
        if (m.counts?.length && sides === individualSides && !m.counts.includes(k)) continue;
        const row = rows.get(k);
        if (!row) continue;
        row.j++;
        row.gf += own;
        row.gs += opp;
        if (r.draw) row.e++;
        else if (r.winner === side) row.v++;
        else row.d++;
      }
    }
  }

  const media = config.ranking.media;
  const per = (x: number, row: Row) => (media && row.j ? x / row.j : x);
  for (const row of rows.values()) {
    row.sg = row.gf - row.gs;
    row.pts = row.v * 3 + row.e;
    row.main = per(config.ranking.base === 'games' ? row.gf : row.pts, row);
  }

  const headToHead = (key: string, block: Set<string>): number => {
    let diff = 0;
    for (const { m, ga, gb } of finished) {
      if (m.counts?.length && sides === individualSides && !m.counts.includes(key)) continue;
      const ka = sides(m, 'a');
      const kb = sides(m, 'b');
      if (ka.includes(key) && kb.some((k) => k !== key && block.has(k))) diff += ga - gb;
      else if (kb.includes(key) && ka.some((k) => k !== key && block.has(k))) diff += gb - ga;
    }
    return diff;
  };

  const value = (row: Row, crit: 'main' | Tiebreak, block: Set<string>): number => {
    switch (crit) {
      case 'main': return row.main;
      case 'vitorias': return per(row.v, row);
      case 'saldo': return per(row.sg, row);
      case 'games': return per(row.gf, row);
      case 'confronto': return headToHead(row.key, block);
    }
  };

  const byLabel = (x: Row, y: Row) => x.label.localeCompare(y.label, 'pt-BR');
  let blocks: Row[][] = [[...rows.values()].sort(byLabel)];
  const criteria: ('main' | Tiebreak)[] = ['main', ...new Set(config.ranking.desempate)];

  for (const crit of criteria) {
    blocks = blocks.flatMap((block) => {
      if (block.length < 2) return [block];
      const keys = new Set(block.map((r) => r.key));
      const vals = new Map(block.map((r) => [r.key, value(r, crit, keys)]));
      const sorted = [...block].sort((x, y) => vals.get(y.key)! - vals.get(x.key)! || byLabel(x, y));
      const out: Row[][] = [];
      for (const r of sorted) {
        const last = out[out.length - 1];
        if (last && Math.abs(vals.get(last[0].key)! - vals.get(r.key)!) < EPS) last.push(r);
        else out.push([r]);
      }
      return out;
    });
  }

  // Empate que nenhum critério resolveu: divide a posição, mas a ordem (e a vaga no mata-mata) sai de um
  // sorteio fixo do torneio, igual em todos os aparelhos.
  const seed = config.ranking.sorteio;
  if (seed !== undefined) {
    for (const block of blocks) block.sort((x, y) => drawKey(seed, x.key) - drawKey(seed, y.key));
  }

  let i = 0;
  for (const block of blocks) {
    for (const r of block) r.pos = i + 1;
    i += block.length;
  }
  return blocks.flat();
}

/** FNV-1a: número estável a partir da semente e da chave. */
function drawKey(seed: number, key: string): number {
  let h = 0x811c9dc5 ^ seed;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

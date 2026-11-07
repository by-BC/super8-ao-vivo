import { evaluate } from './scoring';
import { matchesPerRound, pickPlaying } from './schedule';
import { individualSides, playerEntities, standings } from './standings';
import { shuffle, type Rng } from './rng';
import type { Config, Match, NewMatch, Player } from './types';

/**
 * Monta uma rodada do mexicano. Na 1ª rodada a ordem é sorteada (ou por nível);
 * depois, quem está perto no ranking joga junto: 1º e 4º contra 2º e 3º de cada grupo de quatro.
 * No misto, homens e mulheres são ordenados em separado e o homem mais bem colocado joga com a mulher menos colocada do grupo.
 */
export function mexicanoRound(roundNo: number, players: Player[], config: Config, played: Match[], rng: Rng): NewMatch[] {
  const mixed = config.modality === 'mista';
  const out: NewMatch[] = [];
  let slot = 0;

  for (const { div, m } of matchesPerRound(players, config)) {
    if (m <= 0) continue;
    const divMatches = played.filter((x) => x.division === div.id && x.stage === 'rodada');
    const games = new Map<string, number>();
    for (const x of divMatches) for (const id of [...x.a, ...x.b]) games.set(id, (games.get(id) ?? 0) + 1);

    let order: string[];
    if (roundNo === 1 || divMatches.length === 0) {
      order = shuffle(div.players, rng).sort((x, y) => (y.level ?? 2) - (x.level ?? 2)).map((p) => p.id);
    } else {
      order = standings(playerEntities(div.players), divMatches, config, individualSides).map((r) => r.key);
    }
    const rank = new Map(order.map((id, i) => [id, i]));
    const byRank = (ids: string[]) => ids.sort((x, y) => rank.get(x)! - rank.get(y)!);

    const push = (a: string[], b: string[]) => {
      out.push({ stage: 'rodada', round: roundNo, division: div.id, grp: null, slot, court: slot + 1, label: null, a, b, teamA: null, teamB: null, sets: [] });
      slot++;
    };

    if (mixed) {
      const men = byRank(pickPlaying(div.players.filter((p) => p.gender === 'H').map((p) => p.id), 2 * m, games, rng));
      const women = byRank(pickPlaying(div.players.filter((p) => p.gender === 'M').map((p) => p.id), 2 * m, games, rng));
      for (let i = 0; i < m; i++) {
        const [m1, m2] = [men[2 * i], men[2 * i + 1]];
        const [w1, w2] = [women[2 * i], women[2 * i + 1]];
        push([m1, w2], [m2, w1]);
      }
    } else {
      const ps = byRank(pickPlaying(div.players.map((p) => p.id), 4 * m, games, rng));
      for (let i = 0; i < m; i++) {
        const [p1, p2, p3, p4] = ps.slice(4 * i, 4 * i + 4);
        push([p1, p4], [p2, p3]);
      }
    }
  }
  return out;
}

/** Próxima rodada do mexicano, se a rodada atual acabou e ainda faltam rodadas. */
export function nextMexicano(players: Player[], config: Config, matches: Match[], rng: Rng): NewMatch[] | null {
  const current = Math.max(0, ...matches.filter((m) => m.stage === 'rodada').map((m) => m.round));
  if (current >= config.rounds) return null;
  const pending = matches.some((m) => m.round === current && !evaluate(m.sets, config.scoring).done);
  if (pending) return null;
  return mexicanoRound(current + 1, players, config, matches, rng);
}

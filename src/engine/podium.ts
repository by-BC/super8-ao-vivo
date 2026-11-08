import { knockoutChampion } from './knockout';
import { divisionsOf } from './schedule';
import { evaluate, formatScore } from './scoring';
import { divisionsWithFinal, rankingSections, tournamentStatus } from './setup';
import type { Config, Match, Player, Team } from './types';

export interface PodiumPlace {
  pos: number;
  names: string[];
}

/** O que vai na imagem de campeões de uma divisão. */
export interface Podium {
  division: string;
  /** "Feminino", "Masculino" ou vazio quando só tem uma divisão. */
  label: string;
  /** "Campeãs", "Campeões", "Campeã" ou "Campeão". */
  headline: string;
  places: PodiumPlace[];
  /** Placar da final, quando o torneio termina numa final. */
  final?: string;
}

function headlineFor(ids: string[], byId: Map<string, Player>): string {
  const fem = ids.length > 0 && ids.every((id) => byId.get(id)?.gender === 'M');
  if (ids.length === 1) return fem ? 'Campeã' : 'Campeão';
  return fem ? 'Campeãs' : 'Campeões';
}

function finalScore(m: Match, config: Config, winner: 'a' | 'b'): string {
  if (config.scoring.type === 'melhor3') return formatScore(m.sets, config.scoring);
  const r = evaluate(m.sets, config.scoring, true);
  const [w, l] = winner === 'a' ? [r.gamesA, r.gamesB] : [r.gamesB, r.gamesA];
  return `${w} x ${l}`;
}

/**
 * Pódio de cada divisão que já tem campeão.
 * Rodízio em grupos: campeões e vices da final. Grupos + mata-mata: campeões e vices da chave.
 * Demais formatos: os 3 primeiros do ranking, quando o torneio acaba.
 */
export function podiums(players: Player[], teams: Team[], config: Config, matches: Match[]): Podium[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const nm = (ids: string[]) => ids.map((id) => byId.get(id)?.name ?? '?');
  const divs = divisionsOf(players, config.modality);
  const label = (id: string) => (divs.length > 1 ? divs.find((d) => d.id === id)?.label ?? '' : '');
  const out: Podium[] = [];

  const withFinal = divisionsWithFinal(players, config, matches);
  if (withFinal.length) {
    for (const d of withFinal) {
      const f = matches.find((m) => m.division === d && m.stage === 'mata' && m.label === 'Final' && !m.teamA);
      if (!f) continue;
      const r = evaluate(f.sets, config.scoring, true);
      if (!r.done || !r.winner) continue;
      const [w, l] = r.winner === 'a' ? [f.a, f.b] : [f.b, f.a];
      out.push({ division: d, label: label(d), headline: headlineFor(w, byId), places: [{ pos: 1, names: nm(w) }, { pos: 2, names: nm(l) }], final: finalScore(f, config, r.winner) });
    }
    return out;
  }

  if (config.format === 'grupos') {
    for (const div of divs) {
      const champ = knockoutChampion(div.id, matches, config);
      if (!champ) continue;
      const f = matches.find((m) => m.division === div.id && m.stage === 'mata' && m.label === 'Final');
      const team = (id: string | null | undefined) => teams.find((t) => t.id === id);
      const wt = team(champ);
      if (!wt || !f) continue;
      const lt = team(f.teamA === champ ? f.teamB : f.teamA);
      const places: PodiumPlace[] = [{ pos: 1, names: nm(wt.players) }];
      if (lt) places.push({ pos: 2, names: nm(lt.players) });
      out.push({ division: div.id, label: label(div.id), headline: headlineFor(wt.players, byId), places, final: finalScore(f, config, f.teamA === champ ? 'a' : 'b') });
    }
    return out;
  }

  if (tournamentStatus(players, config, matches) !== 'encerrado') return out;
  for (const s of rankingSections(players, teams, config, matches)) {
    if (s.kind !== 'geral' || !s.rows.some((r) => r.j > 0)) continue;
    const top = s.rows.slice(0, 3);
    out.push({ division: s.division, label: label(s.division), headline: headlineFor(top[0].ids, byId), places: top.map((r) => ({ pos: r.pos, names: nm(r.ids) })) });
  }
  return out;
}

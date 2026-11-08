import { knockoutChampion } from './knockout';
import { evaluate } from './scoring';
import { divisionsOf } from './schedule';
import { divisionsWithFinal, rankingSections, tournamentStatus } from './setup';
import type { Config, Match, Player, Team } from './types';

export type CardTier = 'ouro' | 'prata' | 'azul';

/** Dados da "cartinha" de um jogador no torneio (estilo carta de videogame de futebol). */
export interface PlayerCard {
  id: string;
  name: string;
  gender: Player['gender'];
  /** Nota de 60 a 99: aproveitamento, saldo por jogo e bônus de título. */
  rating: number;
  tier: CardTier;
  /** "CAMPEÃ", "VICE", "1º GRUPO A", "3º LUGAR". */
  tag: string;
  /** "Grupo A" ou "Ranking". */
  scope: string;
  pos: number;
  of: number;
  /** "Feminino", "Masculino" ou vazio. */
  division: string;
  v: number;
  e: number;
  d: number;
  j: number;
  gf: number;
  sg: number;
  pts: number;
}

export function playerCard(players: Player[], teams: Team[], config: Config, matches: Match[], id: string): PlayerCard | null {
  const p = players.find((x) => x.id === id);
  if (!p) return null;
  const sections = rankingSections(players, teams, config, matches);
  const sec = sections.find((s) => (s.kind === 'grupo' || s.kind === 'geral') && s.rows.some((r) => r.ids.includes(id)));
  if (!sec) return null;
  const row = sec.rows.find((r) => r.ids.includes(id))!;
  const div = sec.division;

  let champ = false;
  let vice = false;
  if (divisionsWithFinal(players, config, matches).includes(div)) {
    const f = matches.find((m) => m.division === div && m.stage === 'mata' && m.label === 'Final' && !m.teamA);
    const r = f ? evaluate(f.sets, config.scoring, true) : null;
    if (f && r?.done && r.winner) {
      champ = (r.winner === 'a' ? f.a : f.b).includes(id);
      vice = (r.winner === 'a' ? f.b : f.a).includes(id);
    }
  } else if (config.format === 'grupos') {
    const ch = knockoutChampion(div, matches, config);
    const f = matches.find((m) => m.division === div && m.stage === 'mata' && m.label === 'Final');
    if (ch && f) {
      const mine = teams.find((t) => t.players.includes(id))?.id;
      champ = mine === ch;
      vice = !champ && (mine === f.teamA || mine === f.teamB);
    }
  } else if (tournamentStatus(players, config, matches) === 'encerrado') {
    champ = row.pos === 1;
    vice = row.pos === 2;
  }

  // a cartinha conta o torneio inteiro: jogos de grupo + mata-mata/final
  const st = { v: row.v, e: row.e, d: row.d, j: row.j, gf: row.gf, sg: row.sg, pts: row.pts };
  for (const m of matches) {
    if (m.stage !== 'mata' || m.b.length === 0) continue;
    const side = m.a.includes(id) ? 'a' : m.b.includes(id) ? 'b' : null;
    if (!side) continue;
    const r = evaluate(m.sets, config.scoring, true);
    if (!r.done) continue;
    const own = side === 'a' ? r.gamesA : r.gamesB;
    const opp = side === 'a' ? r.gamesB : r.gamesA;
    st.j++;
    st.gf += own;
    st.sg += own - opp;
    if (r.draw) { st.e++; st.pts += 1; } else if (r.winner === side) { st.v++; st.pts += 3; } else st.d++;
  }

  const fem = p.gender === 'M';
  const scope = sec.kind === 'grupo' ? (sec.title.split(' · ').pop() ?? sec.title) : 'Ranking';
  const tag = champ ? (fem ? 'CAMPEÃ' : 'CAMPEÃO') : vice ? 'VICE' : sec.kind === 'grupo' ? `${row.pos}º ${scope.toUpperCase()}` : `${row.pos}º LUGAR`;

  const j = st.j;
  const wr = j ? (st.v + st.e * 0.5) / j : 0;
  const sgj = j ? st.sg / j : 0;
  const norm = Math.max(0, Math.min(1, (sgj + 4) / 8));
  let rating = 60 + 30 * (0.7 * wr + 0.3 * norm);
  if (champ) rating += 7;
  else if (vice) rating += 4;
  else if (row.pos === 1 && j) rating += 2;
  rating = Math.round(Math.max(60, Math.min(99, j ? rating : 60)));

  const divs = divisionsOf(players, config.modality);
  return {
    id, name: p.name, gender: p.gender, rating, tier: champ ? 'ouro' : vice ? 'prata' : 'azul', tag, scope,
    pos: row.pos, of: sec.rows.length, division: divs.length > 1 ? divs.find((d) => d.id === div)?.label ?? '' : '',
    ...st,
  };
}

import { evaluate } from './scoring';
import { divisionsOf } from './schedule';
import { isAmistoso, isIndividual, AMISTOSO, type Config, type Match, type NewMatch, type Player, type Team } from './types';

/**
 * Jogos criados à mão pelo organizador ficam com slot a partir daqui. Os jogos sorteados usam slots pequenos
 * (um por quadra), então o número marca o jogo como manual sem coluna nova no banco (slot vai até 500).
 */
export const MANUAL_SLOT = 300;
export const isManual = (m: Pick<NewMatch, 'slot'>): boolean => m.slot >= MANUAL_SLOT;

export const MANUAL_LABEL = 'Jogo extra';
export const MANUAL_LABEL_MAX = 30;

const done = (m: Match, config: Pick<Config, 'scoring'>) =>
  evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done;

/** Partida de verdade (não é a passagem direta do mata-mata) que vale pro ranking. */
export const isRealMatch = (m: Match): boolean => !(m.stage === 'mata' && m.b.length === 0) && !isAmistoso(m);

export interface ManualInput {
  a: string[];
  b: string[];
  court: number;
  label: string;
  /** "Vale pro ranking": desligado vira amistoso. */
  counts: boolean;
}

export interface ManualPlan {
  ok: boolean;
  errors: string[];
  /** Por que o jogo vai como amistoso mesmo com "Vale pro ranking" ligado (null quando pode valer). */
  forcedAmistoso: string | null;
  /** O jogo que vai pro banco (só quando ok). */
  match: NewMatch | null;
}

/** Os jogos válidos da rodada atual de uma divisão: a primeira com jogo valendo por terminar, ou a última. */
function currentRound(matches: Match[], division: string, config: Pick<Config, 'scoring'>): number {
  const ms = matches.filter((m) => m.stage !== 'mata' && m.division === division);
  if (!ms.length) return 1;
  const pending = ms.filter((m) => !isAmistoso(m) && !done(m, config)).map((m) => m.round);
  return pending.length ? Math.min(...pending) : Math.max(...ms.map((m) => m.round));
}

/**
 * Monta o jogo que o organizador criou à mão.
 * - Individual (rodízio, mexicano): quaisquer 2 contra 2; ninguém dos dois lados ao mesmo tempo.
 * - Duplas (duplas fixas, grupos): se cada lado é uma dupla do torneio, o jogo pode valer pra tabela
 *   dessas duplas. Dupla avulsa não tem linha na tabela, então vira amistoso.
 * - Valer pro ranking também exige a mesma chave (feminino/masculino) e, nos grupos, o mesmo grupo,
 *   senão o jogo não entraria em tabela nenhuma.
 * O jogo entra como 'rodada' (a única fase que o organizador grava sem refazer a tabela), na rodada que
 * está rolando na chave, depois dos jogos sorteados dela.
 */
export function buildManualMatch(
  input: ManualInput,
  ctx: { players: Player[]; teams: Team[]; config: Config; matches: Match[] },
): ManualPlan {
  const errors: string[] = [];
  const { config, matches } = ctx;
  const active = ctx.players.filter((p) => !p.left);
  const byId = new Map(active.map((p) => [p.id, p]));
  const a = [...input.a];
  const b = [...input.b];
  const all = [...a, ...b];

  if (a.length !== 2 || b.length !== 2) errors.push('Escolha 2 jogadores de cada lado.');
  if (new Set(all).size !== all.length) errors.push('Ninguém pode jogar dos dois lados.');
  if (all.some((id) => !byId.has(id))) errors.push('Tem jogador que não está mais no torneio.');
  if (!Number.isInteger(input.court) || input.court < 1 || input.court > 60) errors.push('A quadra vai de 1 a 60.');
  const label = input.label.trim() || MANUAL_LABEL;
  if (label.length > MANUAL_LABEL_MAX) errors.push(`O nome do jogo vai até ${MANUAL_LABEL_MAX} letras.`);
  if (errors.length) return { ok: false, errors, forcedAmistoso: null, match: null };

  const sameSet = (t: Team, ids: string[]) => t.players.length === ids.length && ids.every((id) => t.players.includes(id));
  const teamA = isIndividual(config.format) ? undefined : ctx.teams.find((t) => sameSet(t, a));
  const teamB = isIndividual(config.format) ? undefined : ctx.teams.find((t) => sameSet(t, b));

  const divs = divisionsOf(active, config.modality);
  const divOf = (id: string) => divs.find((d) => d.players.some((p) => p.id === id))?.id ?? divs[0]?.id ?? 'all';
  const playerDivs = new Set(all.map(divOf));
  const division = divOf(a[0]);

  let grp: string | null = null;
  let forced: string | null = null;
  if (playerDivs.size > 1) forced = 'Tem jogador de chaves diferentes: o jogo não entra em tabela nenhuma.';
  if (!isIndividual(config.format)) {
    if (!teamA || !teamB) forced ??= 'Dupla avulsa não tem linha no ranking.';
    else if (config.format === 'grupos') {
      if ((teamA.group ?? '') !== (teamB.group ?? '')) forced ??= 'As duplas são de grupos diferentes.';
      else grp = teamA.group ?? null;
    }
  } else {
    // rodízio em grupos: se os 4 são do mesmo grupo, o jogo é do grupo; senão é jogo entre grupos (sem grupo)
    const groupOf = new Map<string, string>();
    for (const m of matches) if (m.stage === 'rodada' && m.grp && !isManual(m)) for (const id of [...m.a, ...m.b]) groupOf.set(id, m.grp);
    const gs = new Set(all.map((id) => groupOf.get(id) ?? ''));
    grp = gs.size === 1 ? [...gs][0] || null : null;
  }
  if (forced && grp && !isIndividual(config.format)) grp = null;

  const counted = input.counts && !forced;
  const round = currentRound(matches, division, config);
  const sameRound = matches.filter((m) => m.stage === 'rodada' && m.division === division && m.round === round);
  const slot = Math.max(MANUAL_SLOT, ...sameRound.map((m) => m.slot + 1));
  if (slot > 500) return { ok: false, errors: ['Essa rodada já tem jogos demais.'], forcedAmistoso: forced, match: null };

  return {
    ok: true,
    errors: [],
    forcedAmistoso: forced,
    match: {
      stage: 'rodada', round, division, grp, slot, court: input.court, label, a, b,
      teamA: counted ? teamA?.id ?? null : null, teamB: counted ? teamB?.id ?? null : null,
      sets: [], counts: counted ? null : [AMISTOSO],
    },
  };
}

export interface DeletePlan {
  ok: boolean;
  /** Por que não dá pra excluir. */
  reason: string | null;
  /** Partidas que saem juntas (no mata-mata, a fase inteira da chave). */
  ids: string[];
  /** Quantas delas têm placar. */
  scored: number;
  /** "Semifinal (2 jogos)", quando sai mais de um. */
  scope: string | null;
}

/**
 * O que sai quando o organizador exclui uma partida.
 * - Rodada ou grupo: só ela. As rodadas e o mata-mata já gerados não mudam; o ranking é recalculado.
 * - Mata-mata (e a final do rodízio em grupos): a fase seguinte depende do vencedor, então só dá pra excluir
 *   a última fase da chave, e ela sai inteira. Assim o botão "Gerar" volta e monta a fase de novo
 *   com os resultados de antes, sem chave pela metade.
 */
export function deletionPlan(matches: Match[], id: string): DeletePlan {
  const m = matches.find((x) => x.id === id);
  if (!m) return { ok: false, reason: 'Esse jogo não existe mais.', ids: [], scored: 0, scope: null };
  if (m.stage !== 'mata') return { ok: true, reason: null, ids: [m.id], scored: m.sets.length ? 1 : 0, scope: null };
  const ko = matches.filter((x) => x.stage === 'mata' && x.division === m.division);
  const later = ko.find((x) => x.round > m.round);
  if (later) {
    const name = later.label?.replace(/ \d+$/, '') ?? 'a fase seguinte';
    return { ok: false, reason: `Exclua antes ${name === 'Final' ? 'a Final' : name}: ela saiu do resultado deste jogo.`, ids: [], scored: 0, scope: null };
  }
  const phase = ko.filter((x) => x.round === m.round);
  const name = m.label?.replace(/ \d+$/, '') ?? 'Mata-mata';
  return {
    ok: true, reason: null, ids: phase.map((x) => x.id), scored: phase.filter((x) => x.sets.length > 0).length,
    scope: phase.length > 1 ? `${name} (${phase.length} jogos)` : null,
  };
}

/** Jogos que valem pro ranking e não terminaram: ficam de fora quando o organizador encerra o torneio. */
export function unfinishedMatches(matches: Match[], config: Pick<Config, 'scoring'>): Match[] {
  return matches.filter((m) => isRealMatch(m) && !done(m, config));
}

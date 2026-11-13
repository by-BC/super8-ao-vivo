import { buildInitial } from './setup';
import { isIndividual, type Config, type Match, type NewMatch, type Player, type Team } from './types';

/**
 * nada: a tabela não muda (nome, partida, ranking, nível, nome de jogador) — todo placar fica.
 * resto: rodízio/mexicano — ficam as rodadas já jogadas, as próximas são sorteadas de novo.
 * tudo: muda a estrutura (formato, duplas, grupos...) — a tabela é refeita do zero.
 */
export type EditMode = 'nada' | 'resto' | 'tudo';

export interface EditPlan {
  mode: EditMode;
  /** ids das partidas que continuam no banco */
  keep: string[];
  /** partidas novas a inserir */
  matches: NewMatch[];
  /** jogadores gravados: os de agora + quem saiu mas já tinha jogado (left: true) */
  players: Player[];
  teams: Team[];
  /** última rodada mantida (modo resto) */
  keptUpTo: number;
  /** quantas partidas com placar ficam */
  keptScored: number;
  /** quantas partidas com placar somem (modo tudo) */
  lostScored: number;
  /** nomes de quem saiu mas tem jogo com placar (os jogos continuam valendo) */
  leftNames: string[];
  /** por que vai refazer tudo, quando vai */
  reason: string | null;
}

const KEYS_TUDO: (keyof Config)[] = ['format', 'modality', 'pairing', 'groups', 'qualify', 'rodizioGroups'];
const KEYS_RESTO: (keyof Config)[] = ['rounds', 'courts', 'extraGames'];
const REASON: Partial<Record<keyof Config, string>> = {
  format: 'o formato mudou', modality: 'o tipo de torneio mudou', pairing: 'a formação das duplas mudou',
  groups: 'o número de grupos mudou', qualify: 'os classificados por grupo mudaram', rodizioGroups: 'a divisão em grupos do rodízio mudou',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function planEdit(
  old: { config: Config; players: Player[]; teams: Team[] },
  matches: Match[],
  next: { config: Config; players: Player[]; manual?: [string, string][] },
  seed: number,
): EditPlan {
  const o = old.config;
  const n = next.config;
  const active = next.players.map(({ left: _l, ...p }) => p);
  const activeIds = new Set(active.map((p) => p.id));
  const oldActive = old.players.filter((p) => !p.left);
  const oldLeft = old.players.filter((p) => p.left);
  const scored = matches.filter((m) => m.sets.length > 0);

  const playersChanged = oldActive.length !== active.length || oldActive.some((p) => !activeIds.has(p.id));
  const genderChanged = n.modality !== 'livre' && oldActive.some((p) => {
    const q = active.find((x) => x.id === p.id);
    return q && q.gender !== p.gender;
  });
  const teamsFormat = n.format === 'duplas' || n.format === 'grupos';
  const manualChanged = teamsFormat && n.pairing === 'manual' && !same(
    old.teams.map((t) => [...t.players].sort().join('+')).sort(),
    (next.manual ?? []).map((p) => [...p].sort().join('+')).sort(),
  );
  const tudoKey = KEYS_TUDO.find((k) => !same(o[k], n[k]));
  const restoChanged = KEYS_RESTO.some((k) => !same(o[k], n[k])) || playersChanged || genderChanged;

  // quem já jogou não some do torneio: fica marcado como "saiu"
  const goneButPlayed = (keptMatches: Match[]) => {
    const inKept = new Set(keptMatches.flatMap((m) => [...m.a, ...m.b]));
    return old.players.filter((p) => !p.left && !activeIds.has(p.id) && inKept.has(p.id)).map((p) => ({ ...p, left: true }));
  };

  const base = { keptUpTo: 0, keptScored: 0, lostScored: 0, leftNames: [] as string[], reason: null as string | null };

  // 1) nada que mexa na tabela
  if (!tudoKey && !restoChanged && !manualChanged) {
    return {
      ...base, mode: 'nada', keep: matches.map((m) => m.id), matches: [],
      players: [...active, ...oldLeft], teams: old.teams, keptScored: scored.length,
    };
  }

  const redrawAll = (reason: string | null): EditPlan => {
    const built = buildInitial(active, n, seed, next.manual);
    return { ...base, mode: 'tudo', keep: [], matches: built.matches, players: active, teams: built.teams, lostScored: scored.length, reason };
  };

  // 2) sem placar nenhum: refazer tudo não perde nada
  if (!scored.length) return redrawAll(null);

  // 3) estrutura mudou, ou formato de duplas (a chave depende das duplas)
  if (tudoKey) return redrawAll(REASON[tudoKey] ?? 'a estrutura mudou');
  if (!isIndividual(n.format)) return redrawAll(manualChanged ? 'as duplas mudaram' : playersChanged ? 'os jogadores mudaram e as duplas são fixas' : 'a chave de duplas precisa ser refeita');
  if (scored.some((m) => m.stage !== 'rodada')) return redrawAll('a final já tem placar');

  // 4) rodízio/mexicano: ficam as rodadas até a última com placar
  const keptUpTo = Math.max(...scored.map((m) => m.round));
  const kept = matches.filter((m) => m.stage === 'rodada' && m.round <= keptUpTo
    && (m.sets.length > 0 || [...m.a, ...m.b].every((id) => activeIds.has(id))));
  const left = goneButPlayed(kept);
  const keepLeft = oldLeft.filter((p) => kept.some((m) => m.a.includes(p.id) || m.b.includes(p.id)));
  const players = [...active, ...keepLeft, ...left.filter((p) => !keepLeft.some((x) => x.id === p.id))];

  let fresh: NewMatch[] = [];
  if (n.format === 'rodizio') {
    const remaining = n.rounds - keptUpTo;
    if (remaining > 0) {
      fresh = buildInitial(active, { ...n, rounds: remaining }, seed).matches.map((m) => ({ ...m, round: m.round + keptUpTo }));
    }
  }
  // mexicano: as rodadas seguintes saem do ranking pelo botão "Gerar rodada", já com os jogadores novos

  return {
    ...base, mode: 'resto', keep: kept.map((m) => m.id), matches: fresh, players, teams: [],
    keptUpTo, keptScored: scored.length, leftNames: left.map((p) => p.name),
    lostScored: scored.filter((m) => !kept.includes(m)).length,
  };
}

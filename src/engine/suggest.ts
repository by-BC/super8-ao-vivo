import { divisionsOf } from './schedule';
import { gamesPerMatch } from './scoring';
import { suggestRounds, summarize, validateSetup, type Summary } from './setup';
import type { Config, Format, Modality, Player, Scoring } from './types';

/** Minutos de uma partida, contando a troca de quadra: ~4 min por game. */
export function matchMinutes(s: Scoring): number {
  return Math.round(gamesPerMatch(s) * 4 + 2);
}

export interface Suggestion {
  key: string;
  title: string;
  why: string;
  config: Config;
  summary: Summary;
  /** duração estimada, do primeiro jogo ao último (com final, se tiver) */
  minutes: number;
  fits: boolean;
}

const countG = (ps: Player[], g: 'H' | 'M') => ps.filter((p) => p.gender === g).length;

function modalityLabel(players: Player[], m: Modality): string {
  if (m === 'mista') return 'misto';
  if (m === 'livre') return '';
  const divs = divisionsOf(players, m);
  return divs.length > 1 ? 'feminino e masculino' : divs[0]?.id === 'M' ? 'feminino' : 'masculino';
}

/** Modalidades possíveis com quem se inscreveu. */
export function possibleModalities(players: Player[], askedGender: boolean): Modality[] {
  if (!askedGender) return ['livre'];
  const h = countG(players, 'H');
  const m = countG(players, 'M');
  const out: Modality[] = [];
  if (h >= 2 && m >= 2) out.push('mista');
  if (h >= 4 || m >= 4) out.push('mesmo_genero');
  return out.length ? out : ['livre'];
}

/**
 * Sugestões de formato para a lista que fechou, cabendo no tempo que a galera tem.
 * Cada sugestão já vem com rodadas, grupos e jogo extra acertados; o organizador pode mexer depois.
 */
export function suggestFormats(players: Player[], base: Config, opts: { minutes: number; modalities: Modality[] }): Suggestion[] {
  const mm = matchMinutes(base.scoring);
  const budget = Math.max(2, Math.floor(opts.minutes / mm));
  const hasLevel = players.some((p) => p.level != null);
  const out: Suggestion[] = [];

  const add = (key: string, title: string, why: (s: Summary) => string, config: Config, extraRounds = 0) => {
    if (!validateSetup(players, config, []).ok) return;
    const summary = summarize(players, config);
    const rounds = isTeams(config.format) ? Math.ceil(summary.matches / Math.max(1, config.courts)) : summary.rounds + extraRounds;
    const minutes = rounds * mm;
    out.push({ key, title: title.replace(/\s+/g, ' ').trim(), why: why(summary), config, summary, minutes, fits: minutes <= opts.minutes });
  };

  for (const modality of opts.modalities) {
    const b: Config = { ...base, modality, ranking: { ...base.ranking, separarGenero: modality === 'mista' } };
    const divs = divisionsOf(players, modality);
    const label = modalityLabel(players, modality);

    // Rodízio: junto e (se a lista for grande e tiver quadra) em 2 grupos com final; em cada um, jogo extra ou média,
    // ficando com o que dá mais jogo pra cada um dentro do tempo
    const big = divs.some((d) => d.players.length >= 11);
    for (const groups of (big && base.courts >= divs.length * 2 ? [2, 1] : [1]) as (1 | 2)[]) {
      let best: { config: Config; rounds: number; ideal: number; score: number } | null = null;
      for (const extraGames of [true, false]) {
        const rc: Config = { ...b, format: 'rodizio', rodizioGroups: groups, extraGames, rounds: 1, ranking: { ...b.ranking, media: !extraGames } };
        const ideal = suggestRounds(players, rc);
        const finalRound = groups === 2 ? 1 : 0;
        let rounds = Math.max(2, Math.min(ideal, budget - finalRound));
        while (rounds > 2 && summarize(players, { ...rc, rounds }).rounds + finalRound > budget) rounds--;
        const config = { ...rc, rounds };
        if (!validateSetup(players, config, []).ok) continue;
        const sm = summarize(players, config);
        const score = sm.minGames * 10 + (sm.minGames === sm.maxGames ? 4 : 0) + (extraGames ? 1 : 0);
        if (!best || score > best.score) best = { config, rounds, ideal, score };
      }
      if (!best) continue;
      const { rounds, ideal, config } = best;
      add(`rodizio-${modality}-${groups}`, `Rodízio ${label}${groups === 2 ? ' em 2 grupos + final' : ''}`,
        (sm) => `Parceiro novo a cada rodada. Cada um joga ${sm.minGames === sm.maxGames ? sm.minGames : `${sm.minGames} a ${sm.maxGames}`} partidas${groups === 2 ? '; no fim, final cruzada entre os grupos' : ''}${!config.extraGames && sm.minGames !== sm.maxGames ? ' (ranking pela média)' : ''}${rounds < ideal ? '. Encurtado pra caber no tempo' : ''}.`,
        config, groups === 2 ? 1 : 0);
    }

    // Duplas fixas, todos contra todos
    const pairing = hasLevel ? 'equilibrado' : 'sorteio';
    add(`duplas-${modality}`, `Duplas fixas ${label}`,
      (s) => `Todas as duplas se enfrentam: ${s.minGames === s.maxGames ? s.minGames : `${s.minGames} a ${s.maxGames}`} jogos por dupla${hasLevel ? ', duplas equilibradas pelo nível' : ''}.`,
      { ...b, format: 'duplas', pairing });

    // Grupos + mata-mata, quando tem dupla suficiente
    const teams = Math.min(...divs.map((d) => (modality === 'mista' ? Math.min(countG(d.players, 'H'), countG(d.players, 'M')) : Math.floor(d.players.length / 2))));
    if (teams >= 6) {
      const g = teams >= 12 ? 4 : 2;
      add(`grupos-${modality}`, `Grupos + mata-mata ${label}`,
        () => `${g} grupos de duplas fixas; os 2 melhores de cada grupo vão pra chave${hasLevel ? '. Duplas e grupos equilibrados pelo nível' : ''}.`,
        { ...b, format: 'grupos', pairing, groups: g, qualify: 2 }, Math.ceil(Math.log2(g * 2)));
    }

    // Mexicano: rodadas montadas pelo ranking, bom pra grupo de nível misturado
    if (divs.every((d) => d.players.length >= 8)) {
      const mrounds = Math.max(3, Math.min(6, budget));
      add(`mexicano-${modality}`, `Mexicano ${label}`,
        () => `Cada rodada junta 1º e 4º contra 2º e 3º: os jogos ficam parelhos sozinhos. ${mrounds} rodadas.`,
        { ...b, format: 'mexicano', rounds: mrounds });
    }
  }

  // primeiro o que cabe no tempo; depois o rodízio (o queridinho), as duplas e o mexicano; e quem joga mais
  const order: Record<Format, number> = { rodizio: 0, duplas: 1, grupos: 1, mexicano: 2 };
  const rank = (s: Suggestion) => (s.fits ? 0 : 1000) + order[s.config.format] * 15 - s.summary.minGames * 5 + (s.summary.minGames !== s.summary.maxGames ? 4 : 0);
  return out.filter((s) => s.summary.minGames >= 2).sort((x, y) => rank(x) - rank(y)).slice(0, 5);
}

function isTeams(f: Format) {
  return f === 'duplas' || f === 'grupos';
}

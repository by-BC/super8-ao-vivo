export type Gender = 'H' | 'M';

export interface Player {
  id: string;
  name: string;
  gender: Gender | null;
  /** Nível: 4 = A (profissional), 3 = B, 2 = C, 1 = D (iniciante). Usado para equilibrar duplas e jogos. */
  level?: number;
  /** Saiu no meio do torneio: os jogos que fez continuam valendo, mas não entra nas próximas rodadas. */
  left?: boolean;
  /** Personagem escolhido pelo organizador (índice em src/lib/characters.ts); sem isso o app sorteia um do gênero. */
  avatar?: number;
}

/** mista: H+M · mesmo_genero: H+H contra H+H e M+M contra M+M · livre: qualquer combinação */
export type Modality = 'mista' | 'mesmo_genero' | 'livre';

/** rodizio: parceiro muda toda rodada · duplas: duplas fixas todos x todos · grupos: grupos + mata-mata · mexicano: próxima rodada pelo ranking */
export type Format = 'rodizio' | 'duplas' | 'grupos' | 'mexicano';

export type PairingMethod = 'sorteio' | 'equilibrado' | 'manual';

/**
 * total: joga N games no total, pode empatar (2x2)
 * corrida: primeiro a N games
 * set: set de N games com 2 de diferença e tie-break no N x N
 * melhor3: melhor de 3 sets de N games, 3º set vira match tie-break de 10
 */
export type ScoringType = 'total' | 'corrida' | 'set' | 'melhor3';

export interface Scoring {
  type: ScoringType;
  games: number;
}

/** games: soma de games feitos · resultado: vitória 3, empate 1, derrota 0 */
export type RankingBase = 'games' | 'resultado';
/**
 * vitorias · saldo (games feitos − sofridos) · confronto (só com 2 empatados) · games (games feitos)
 * · media_games (games feitos ÷ games jogados, feitos + sofridos).
 */
export type Tiebreak = 'vitorias' | 'saldo' | 'confronto' | 'games' | 'media_games';

export interface RankingConfig {
  base: RankingBase;
  /** Usa média por partida, para quando nem todo mundo joga o mesmo número de partidas. */
  media: boolean;
  desempate: Tiebreak[];
  /** Ranking separado por gênero (Rei e Rainha da areia) nos formatos individuais. */
  separarGenero: boolean;
  /** Semente do sorteio que decide empates que nenhum critério resolveu (igual em todos os aparelhos). */
  sorteio?: number;
}

export interface Config {
  modality: Modality;
  format: Format;
  scoring: Scoring;
  ranking: RankingConfig;
  courts: number;
  /** Rodadas do rodízio e do mexicano. */
  rounds: number;
  pairing: PairingMethod;
  /** Grupos por divisão (formato grupos). */
  groups: number;
  /** Quantas duplas de cada grupo vão para o mata-mata. */
  qualify: number;
  /** Rodízio: 1 = todo mundo junto · 2 = dois grupos por divisão, com final cruzada no fim. */
  rodizioGroups?: 1 | 2;
  /** Rodízio: quem ficou com uma partida a menos ganha um jogo extra no fim, pra todo mundo somar o mesmo número. */
  extraGames?: boolean;
  /** Inscrição aberta sem formato: o organizador escolhe no sorteio, com sugestões pela lista. */
  formatLater?: boolean;
}

export interface Team {
  id: string;
  players: [string, string];
  division: string;
  group?: string | null;
}

export interface TournamentData {
  players: Player[];
  teams: Team[];
  /**
   * Encerrado à mão pelo organizador (ISO da hora). Vale por cima da conta de jogos: o torneio fica
   * encerrado mesmo com jogo pendente, e só os jogos que terminaram contam. Sem o campo, a conta decide.
   */
  closed?: string | null;
}

export type Stage = 'rodada' | 'grupo' | 'mata';
export type SetScore = [number, number];

/** Partida antes de ir para o banco (sem id nem versão). */
export interface NewMatch {
  stage: Stage;
  round: number;
  division: string;
  grp: string | null;
  slot: number;
  court: number;
  label: string | null;
  a: string[];
  b: string[];
  teamA: string | null;
  teamB: string | null;
  sets: SetScore[];
  /** Jogo extra que só conta para estes jogadores (os outros completam a quadra). */
  counts?: string[] | null;
}

/**
 * Jogo amistoso: aparece na lista e pode ter placar, mas não conta pra nada (ranking, pódio, cartinha,
 * mensagens). Reaproveita o campo `counts` do jogo extra ("só conta para estes jogadores") com um marcador
 * que não é id de jogador: ninguém está na lista, então ninguém pontua. O banco aceita (`counts` com 1 item)
 * sem migração nova.
 */
export const AMISTOSO = '-amistoso';
export const isAmistoso = (m: Pick<NewMatch, 'counts'>): boolean => !!m.counts?.includes(AMISTOSO);

export interface Match extends NewMatch {
  id: string;
  version: number;
}

export interface Division {
  id: string;
  label: string;
  players: Player[];
}

export const DEFAULT_CONFIG: Config = {
  modality: 'mista',
  format: 'rodizio',
  scoring: { type: 'total', games: 4 },
  ranking: { base: 'games', media: false, desempate: ['vitorias', 'saldo', 'confronto'], separarGenero: true },
  courts: 2,
  rounds: 5,
  pairing: 'sorteio',
  groups: 2,
  qualify: 2,
  rodizioGroups: 1,
  extraGames: true,
};

/**
 * Ranking padrão de cada formato (só critério e desempate; média, Rei e Rainha e sorteio ficam como estão).
 * - Individual (rodízio/Super 8, mexicano): games feitos, depois vitórias, saldo e confronto, como nos
 *   regulamentos de Super 8.
 * - Duplas fixas e grupos + mata-mata: vitórias primeiro (V3 · E1 · D0), como nos regulamentos amadores de
 *   fase de grupos (FPT 2022, Arapiraca 2024, Sesc SP, Copa SP): com 2 empatados, confronto direto; com 3 ou
 *   mais, saldo de games e depois média de games. O que sobrar empatado vai pro sorteio fixo do torneio.
 *   Vitórias não entra na lista porque o critério principal já é o resultado.
 */
export function defaultRanking(format: Format): Pick<RankingConfig, 'base' | 'desempate'> {
  return isIndividual(format)
    ? { base: 'games', desempate: ['vitorias', 'saldo', 'confronto'] }
    : { base: 'resultado', desempate: ['confronto', 'saldo', 'media_games'] };
}

const sameRanking = (r: Pick<RankingConfig, 'base' | 'desempate'>, d: Pick<RankingConfig, 'base' | 'desempate'>) =>
  r.base === d.base && r.desempate.length === d.desempate.length && r.desempate.every((k, i) => k === d.desempate[i]);

/** O ranking é um dos padrões (de formato individual ou de duplas), ou seja, ninguém mexeu nele. */
export function isDefaultRanking(r: Pick<RankingConfig, 'base' | 'desempate'>): boolean {
  return sameRanking(r, defaultRanking('rodizio')) || sameRanking(r, defaultRanking('duplas'));
}

/** Ranking para o formato: troca para o padrão dele, a não ser que o organizador tenha escolhido outro. */
export function rankingFor(format: Format, r: RankingConfig, touched = !isDefaultRanking(r)): RankingConfig {
  if (touched) return r;
  const d = defaultRanking(format);
  return sameRanking(r, d) ? r : { ...r, base: d.base, desempate: [...d.desempate] };
}

export const MAX_PLAYERS = 64;

export function isIndividual(format: Format): boolean {
  return format === 'rodizio' || format === 'mexicano';
}

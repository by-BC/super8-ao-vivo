export type Gender = 'H' | 'M';

export interface Player {
  id: string;
  name: string;
  gender: Gender | null;
  /** 1 = iniciante, 2 = intermediário, 3 = avançado. Usado no sorteio equilibrado. */
  level?: number;
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
export type Tiebreak = 'vitorias' | 'saldo' | 'confronto' | 'games';

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
}

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
};

export const MAX_PLAYERS = 64;

export function isIndividual(format: Format): boolean {
  return format === 'rodizio' || format === 'mexicano';
}

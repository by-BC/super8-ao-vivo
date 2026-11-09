import type { Config, Gender, Match, NewMatch, SetScore, TournamentData } from '../engine';
import { supabase } from './supabase';

export type ApiErrorCode =
  | 'NAO_ENCONTRADO' | 'PIN_INVALIDO' | 'PIN_FORMATO' | 'BLOQUEADO' | 'SEM_PERMISSAO' | 'DADOS_INVALIDOS'
  | 'CONFLITO' | 'JA_GERADO' | 'MUITAS_TENTATIVAS' | 'REDE' | 'SERVIDOR'
  | 'INSCRICAO_FECHADA' | 'NOME_REPETIDO' | 'NOME_INVALIDO' | 'GENERO_FALTANDO' | 'NIVEL_FALTANDO' | 'LOTADO';

export class ApiFail extends Error {
  constructor(public code: ApiErrorCode, public extra?: Record<string, unknown>) {
    super(code);
  }
}

export const errorText: Record<ApiErrorCode, string> = {
  NAO_ENCONTRADO: 'Não achei torneio com esse código. Confira as letras.',
  PIN_INVALIDO: 'PIN errado. Confira com quem organizou.',
  PIN_FORMATO: 'O PIN precisa ter de 4 a 8 números.',
  BLOQUEADO: 'Muitas tentativas de PIN. Espere 15 minutos e tente de novo.',
  SEM_PERMISSAO: 'Seu acesso de árbitro expirou ou o PIN mudou. Entre de novo com o PIN.',
  DADOS_INVALIDOS: 'O servidor recusou os dados. Atualize a página e tente de novo.',
  CONFLITO: 'Alguém mexeu nesse jogo ao mesmo tempo. O placar foi atualizado.',
  JA_GERADO: 'Essa rodada já foi gerada por outro árbitro.',
  MUITAS_TENTATIVAS: 'Muitos torneios criados agora. Espere um minuto.',
  REDE: 'Sem conexão. O que você lançar fica guardado e sobe quando a internet voltar.',
  SERVIDOR: 'O servidor não respondeu como esperado. Tente de novo em instantes.',
  INSCRICAO_FECHADA: 'As inscrições estão fechadas. Fale com quem organiza.',
  NOME_REPETIDO: 'Já tem alguém com esse nome na lista. Coloque o sobrenome ou um apelido.',
  NOME_INVALIDO: 'O nome precisa ter de 2 a 40 letras.',
  GENERO_FALTANDO: 'Escolha se você joga no feminino ou no masculino.',
  NIVEL_FALTANDO: 'Escolha seu nível, de A a D.',
  LOTADO: 'A lista chegou no máximo de inscritos.',
};

export interface SignupSettings {
  open: boolean;
  askGender: boolean;
  askLevel: boolean;
  /** Torneio de um gênero só: todo inscrito entra com esse gênero. */
  gender: Gender | null;
  /** Vagas contadas por gênero (ex.: 8 homens e 8 mulheres). */
  perGender: boolean;
  limit: number | null;
}

/** Inscrito como a lista pública mostra (sem nível). */
export interface PublicEntry {
  id: string;
  name: string;
  gender: Gender | null;
}

/** Inscrito como o organizador vê. */
export interface AdminEntry extends PublicEntry {
  level: number | null;
  byAdmin: boolean;
  createdAt: string;
}

export interface TournamentRow {
  id: string;
  code: string;
  name: string;
  config: Config;
  data: TournamentData;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** inscricao: lista aberta antes do sorteio · jogos: já sorteado (torneios antigos vêm sem o campo). */
  phase?: 'inscricao' | 'jogos';
  signup?: Partial<SignupSettings>;
}

type Ok<T> = T & { ok: true };

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Ok<T>> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch {
    throw new ApiFail('REDE');
  }
  const { data, error } = res;
  if (error) {
    // sem código = a requisição nem chegou (rede); com código = erro do PostgREST/Postgres
    throw new ApiFail(error.code ? 'SERVIDOR' : 'REDE');
  }
  if (!data || data.ok !== true) throw new ApiFail((data?.error as ApiErrorCode) ?? 'SERVIDOR', data ?? undefined);
  return data as Ok<T>;
}

const strip = (ms: NewMatch[]) => ms.map(({ sets: _sets, ...m }) => m);

export const api = {
  get: (code: string) => call<{ tournament: TournamentRow; matches: Match[]; entries?: PublicEntry[] | null }>('s8_get', { p_code: code }),

  createSignup: (name: string, config: Config, pin: string, signup: Partial<SignupSettings>) =>
    call<{ code: string; adminKey: string; token: string }>('s8_create_signup', { p_name: name, p_config: config, p_pin: pin, p_signup: signup }),

  signup: (code: string, name: string, gender: Gender | null, level: number | null) =>
    call<{ id: string; token: string; position: number; waiting: boolean }>('s8_signup', { p_code: code, p_name: name, p_gender: gender, p_level: level }),

  signupEdit: (code: string, id: string, token: string, name: string, gender: Gender | null, level: number | null) =>
    call<{ position: number; waiting: boolean }>('s8_signup_edit', { p_code: code, p_id: id, p_token: token, p_name: name, p_gender: gender, p_level: level, p_leave: false }),

  signupLeave: (code: string, id: string, token: string) =>
    call<object>('s8_signup_edit', { p_code: code, p_id: id, p_token: token, p_name: null, p_gender: null, p_level: null, p_leave: true }),

  adminEntries: (code: string, adminKey: string) => call<{ entries: AdminEntry[] }>('s8_admin_entries', { p_code: code, p_admin_key: adminKey }),

  adminEntry: (code: string, adminKey: string, id: string | null, name: string | null, gender: Gender | null, level: number | null, remove = false) =>
    call<{ id: string }>('s8_admin_entry', { p_code: code, p_admin_key: adminKey, p_id: id, p_name: name, p_gender: gender, p_level: level, p_remove: remove }),

  adminSignup: (code: string, adminKey: string, signup: Partial<SignupSettings>) =>
    call<object>('s8_admin_signup', { p_code: code, p_admin_key: adminKey, p_signup: signup }),

  adminStart: (code: string, adminKey: string, config: Config, data: TournamentData, matches: NewMatch[]) =>
    call<object>('s8_admin_start', { p_code: code, p_admin_key: adminKey, p_config: config, p_data: data, p_matches: strip(matches) }),

  create: (name: string, config: Config, data: TournamentData, pin: string, matches: NewMatch[]) =>
    call<{ code: string; adminKey: string; token: string }>('s8_create', {
      p_name: name, p_config: config, p_data: data, p_pin: pin, p_matches: strip(matches),
    }),

  unlock: (code: string, pin: string) => call<{ token: string }>('s8_unlock', { p_code: code, p_pin: pin }),

  score: (code: string, token: string, matchId: string, expected: number, sets: SetScore[]) =>
    call<{ match: Match }>('s8_score', { p_code: code, p_token: token, p_match: matchId, p_expected: expected, p_sets: sets }),

  addMatches: (code: string, token: string, matches: NewMatch[]) =>
    call<object>('s8_add_matches', { p_code: code, p_token: token, p_matches: strip(matches) }),

  adminUpdate: (code: string, adminKey: string, name: string, data: TournamentData, expected: number) =>
    call<object>('s8_admin_update', { p_code: code, p_admin_key: adminKey, p_name: name, p_data: data, p_expected: expected }),

  adminReset: (code: string, adminKey: string, config: Config, data: TournamentData, matches: NewMatch[]) =>
    call<object>('s8_admin_reset', { p_code: code, p_admin_key: adminKey, p_config: config, p_data: data, p_matches: strip(matches) }),

  adminCheck: (code: string, adminKey: string) => call<object>('s8_admin_check', { p_code: code, p_admin_key: adminKey }),

  adminRanking: (code: string, adminKey: string, ranking: Config['ranking']) =>
    call<object>('s8_admin_ranking', { p_code: code, p_admin_key: adminKey, p_ranking: ranking }),

  adminPin: (code: string, adminKey: string, pin: string) =>
    call<object>('s8_admin_pin', { p_code: code, p_admin_key: adminKey, p_pin: pin }),
};

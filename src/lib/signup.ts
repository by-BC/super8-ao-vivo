import type { Gender, Player } from '../engine';
import type { AdminEntry, PublicEntry, SignupSettings } from './api';

export function settingsOf(s: Partial<SignupSettings> | undefined): SignupSettings {
  return {
    open: s?.open ?? false,
    askGender: s?.askGender ?? true,
    askLevel: s?.askLevel ?? true,
    gender: s?.gender ?? null,
    perGender: s?.perGender ?? false,
    limit: s?.limit ?? null,
  };
}

/** Quem está dentro e quem está na lista de espera, pela ordem de inscrição (igual ao servidor). */
export function splitEntries<T extends PublicEntry>(entries: T[], s: SignupSettings): { confirmed: T[]; waiting: T[] } {
  if (!s.limit) return { confirmed: entries, waiting: [] };
  const seen = new Map<string, number>();
  const confirmed: T[] = [];
  const waiting: T[] = [];
  for (const e of entries) {
    const k = s.perGender ? e.gender ?? '-' : 'all';
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    (n <= s.limit ? confirmed : waiting).push(e);
  }
  return { confirmed, waiting };
}

/** Inscritos confirmados viram jogadores do sorteio, na ordem de inscrição. */
export function entriesToPlayers(entries: AdminEntry[], fixed: Gender | null): Player[] {
  return entries.map((e, i) => ({ id: `p${i + 1}`, name: e.name, gender: fixed ?? e.gender, level: e.level ?? undefined }));
}

export function signupSummary(s: SignupSettings): string {
  const parts: string[] = [];
  if (s.askLevel) parts.push('pergunta o nível');
  if (s.limit) parts.push(s.perGender ? `${s.limit} vagas por gênero` : `${s.limit} vagas`);
  else parts.push('sem limite de vagas');
  return parts.join(' · ');
}

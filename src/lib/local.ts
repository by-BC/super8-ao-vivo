/** Tudo que fica só neste aparelho: torneios que a pessoa abriu, chaves de acesso e a fila de pontos offline. */

export type Role = 'organizador' | 'arbitro' | 'publico';

export interface Saved {
  code: string;
  name: string;
  role: Role;
  adminKey?: string;
  token?: string;
  savedAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado ou armazenamento cheio: segue sem guardar */
  }
}

const LIST = 's8:meus';

export function listSaved(): Saved[] {
  return read<Saved[]>(LIST, []).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getSaved(code: string): Saved | undefined {
  return read<Saved[]>(LIST, []).find((s) => s.code === code);
}

export function upsertSaved(entry: Partial<Saved> & { code: string }): Saved {
  const all = read<Saved[]>(LIST, []);
  const cur = all.find((s) => s.code === entry.code);
  const merged: Saved = {
    name: '', role: 'publico', ...cur, ...entry,
    savedAt: new Date().toISOString(),
  };
  if (merged.adminKey) merged.role = 'organizador';
  else if (merged.token) merged.role = 'arbitro';
  else merged.role = 'publico';
  write(LIST, [merged, ...all.filter((s) => s.code !== entry.code)].slice(0, 40));
  return merged;
}

export function dropToken(code: string): void {
  const cur = getSaved(code);
  if (cur) upsertSaved({ ...cur, token: undefined });
}

export function forget(code: string): void {
  write(LIST, read<Saved[]>(LIST, []).filter((s) => s.code !== code));
  try { localStorage.removeItem(`s8:fila:${code}`); } catch { /* ignore */ }
}

export interface Intent {
  id: string;
  matchId: string;
  side: 'a' | 'b';
  delta: 1 | -1;
}

export const loadQueue = (code: string) => read<Intent[]>(`s8:fila:${code}`, []);
export const saveQueue = (code: string, q: Intent[]) => write(`s8:fila:${code}`, q);

export const loadDraft = <T,>(fallback: T) => read<T>('s8:rascunho', fallback);
export const saveDraft = (d: unknown) => write('s8:rascunho', d);

/** Minha inscrição neste aparelho: com o token dá para editar ou sair da lista. */
export interface MyEntry {
  id: string;
  token: string;
  name: string;
  gender: 'H' | 'M' | null;
  level: number | null;
}

export const getMyEntry = (code: string) => read<MyEntry | null>(`s8:inscricao:${code}`, null);
export const saveMyEntry = (code: string, e: MyEntry) => write(`s8:inscricao:${code}`, e);
export function dropMyEntry(code: string): void {
  try { localStorage.removeItem(`s8:inscricao:${code}`); } catch { /* ignore */ }
}

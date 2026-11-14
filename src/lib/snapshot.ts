/**
 * Último placar que este aparelho recebeu do servidor, guardado por código.
 * Serve para abrir o torneio (e o Telão) sem internet: a tela mostra o último placar conhecido,
 * avisa que está sem conexão e continua tentando falar com o servidor.
 *
 * Nada daqui volta para o servidor: é só leitura. O placar novo sempre vem do servidor,
 * e os pontos lançados offline continuam indo pela fila (local.ts), com trava de versão.
 */
import { applyGame, type Match, type Scoring } from '../engine';
import type { PublicEntry, TournamentRow } from './api';
import type { Intent } from './local';

export interface Snapshot {
  v: 1;
  /** Quando o aparelho recebeu esses dados do servidor (ms). */
  at: number;
  tournament: TournamentRow;
  matches: Match[];
  entries: PublicEntry[];
}

const PREFIX = 's8:ultimo:';
/** O torneio some do servidor depois do play; dois dias sobra para o "abri no dia seguinte". */
export const SNAPSHOT_MAX_AGE = 2 * 24 * 60 * 60 * 1000;
/** Quantos torneios ficam guardados no aparelho, no máximo. */
export const SNAPSHOT_MAX_CODES = 6;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function store(s?: Store): Store | null {
  if (s) return s;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function parse(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Snapshot;
    if (s?.v !== 1 || typeof s.at !== 'number' || !s.tournament || !Array.isArray(s.matches)) return null;
    return { ...s, entries: Array.isArray(s.entries) ? s.entries : [] };
  } catch {
    return null;
  }
}

/** Lê o último placar guardado do código; descarta o que passou da validade. */
export function readSnapshot(code: string, now = Date.now(), s?: Store): Snapshot | null {
  const st = store(s);
  if (!st) return null;
  try {
    const snap = parse(st.getItem(PREFIX + code));
    if (!snap) return null;
    if (now - snap.at > SNAPSHOT_MAX_AGE) { st.removeItem(PREFIX + code); return null; }
    return snap;
  } catch {
    return null;
  }
}

/**
 * Apaga os guardados vencidos e, se sobrar mais que `max`, os mais antigos.
 * `keep` nunca é apagado (o torneio aberto agora).
 */
export function pruneSnapshots(now = Date.now(), max = SNAPSHOT_MAX_CODES, keep?: string, s?: Store): void {
  const st = store(s);
  if (!st) return;
  try {
    const found: { key: string; at: number }[] = [];
    for (let i = 0; i < st.length; i++) {
      const key = st.key(i);
      if (key?.startsWith(PREFIX)) {
        const snap = parse(st.getItem(key));
        found.push({ key, at: snap?.at ?? 0 });
      }
    }
    const kept = keep ? PREFIX + keep : null;
    const valid = (at: number) => at > 0 && now - at <= SNAPSHOT_MAX_AGE;
    const drop = found.filter((f) => f.key !== kept && !valid(f.at));
    const alive = found.filter((f) => f.key !== kept && valid(f.at)).sort((a, b) => b.at - a.at);
    const room = Math.max(0, kept && found.some((f) => f.key === kept) ? max - 1 : max);
    drop.push(...alive.slice(room));
    for (const f of drop) st.removeItem(f.key);
  } catch {
    /* armazenamento indisponível: segue sem limpar */
  }
}

/** Guarda o placar que acabou de chegar do servidor. Se o armazenamento encher, limpa e tenta uma vez mais. */
export function writeSnapshot(code: string, data: Omit<Snapshot, 'v' | 'at'>, now = Date.now(), s?: Store): boolean {
  const st = store(s);
  if (!st) return false;
  const raw = JSON.stringify({ v: 1, at: now, tournament: data.tournament, matches: data.matches, entries: data.entries } satisfies Snapshot);
  try {
    st.setItem(PREFIX + code, raw);
    pruneSnapshots(now, SNAPSHOT_MAX_CODES, code, st);
    return true;
  } catch {
    try {
      // cheio: fica só o deste torneio
      pruneSnapshots(now, 0, code, st);
      st.setItem(PREFIX + code, raw);
      return true;
    } catch {
      return false;
    }
  }
}

export function dropSnapshot(code: string, s?: Store): void {
  const st = store(s);
  try { st?.removeItem(PREFIX + code); } catch { /* ignore */ }
}

/**
 * Placar que aparece na tela: o do servidor (ou o último guardado) mais a fila local ainda não enviada.
 * A intenção em voo pode já ter chegado numa leitura antes da resposta do RPC: aí ela não conta duas vezes.
 */
export function overlayQueue(
  server: Map<string, Match>, queue: Intent[], scoring: Scoring,
  inflight: { id: string; base: number } | null = null,
): Map<string, Match> {
  const map = new Map(server);
  for (const it of queue) {
    const m = map.get(it.matchId);
    if (!m) continue;
    if (inflight && inflight.id === it.id && m.version > inflight.base) continue;
    const sets = applyGame(m.sets, it.side, it.delta, scoring, m.stage === 'mata');
    if (sets) map.set(m.id, { ...m, sets });
  }
  return map;
}

/** "às 14:32" no mesmo dia; "em 13/11 às 21:05" se o guardado é de outro dia. */
export function updatedLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date(now).toDateString()) return `às ${hm}`;
  return `em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hm}`;
}

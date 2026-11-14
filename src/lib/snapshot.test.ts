import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type Match } from '../engine';
import type { TournamentRow } from './api';
import type { Intent } from './local';
import {
  dropSnapshot, overlayQueue, pruneSnapshots, readSnapshot, SNAPSHOT_MAX_AGE, SNAPSHOT_MAX_CODES, updatedLabel, writeSnapshot,
} from './snapshot';

/** localStorage de mentira, com cota opcional para simular armazenamento cheio. */
function fakeStore(quota = Infinity) {
  const m = new Map<string, string>();
  const size = () => [...m.values()].reduce((n, v) => n + v.length, 0);
  return {
    map: m,
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const before = m.get(k)?.length ?? 0;
      if (size() - before + v.length > quota) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => { m.delete(k); },
  };
}

const scoring = { type: 'total', games: 8 } as const;
const match = (id: string, sets: [number, number][] = [], version = 1): Match => ({
  id, version, sets, a: ['p1', 'p2'], b: ['p3', 'p4'], stage: 'rodada', round: 1, slot: 0, court: 1, division: 'geral',
} as unknown as Match);
const tour = (code: string): TournamentRow => ({
  id: `id-${code}`, code, name: 'Liga da quinta', config: { ...DEFAULT_CONFIG, scoring }, data: { players: [], teams: [] },
  version: 3, createdAt: '2026-11-14T18:00:00Z', updatedAt: '2026-11-14T18:00:00Z', phase: 'jogos',
} as unknown as TournamentRow);
const data = (code: string) => ({ tournament: tour(code), matches: [match('m1', [[2, 1]])], entries: [] });

const NOW = new Date(2026, 10, 14, 20, 0).getTime();

describe('último placar guardado no aparelho', () => {
  it('guarda e lê de volta, com a hora em que chegou do servidor', () => {
    const st = fakeStore();
    expect(writeSnapshot('ABCDEF', data('ABCDEF'), NOW, st)).toBe(true);
    const snap = readSnapshot('ABCDEF', NOW + 1000, st)!;
    expect(snap.at).toBe(NOW);
    expect(snap.tournament.code).toBe('ABCDEF');
    expect(snap.matches[0].sets).toEqual([[2, 1]]);
  });

  it('sem guardado, ou guardado corrompido, devolve null', () => {
    const st = fakeStore();
    expect(readSnapshot('ABCDEF', NOW, st)).toBeNull();
    st.setItem('s8:ultimo:ABCDEF', '{quebrado');
    expect(readSnapshot('ABCDEF', NOW, st)).toBeNull();
    st.setItem('s8:ultimo:ABCDEF', JSON.stringify({ v: 99 }));
    expect(readSnapshot('ABCDEF', NOW, st)).toBeNull();
  });

  it('guardado com mais de dois dias some na leitura', () => {
    const st = fakeStore();
    writeSnapshot('ABCDEF', data('ABCDEF'), NOW, st);
    expect(readSnapshot('ABCDEF', NOW + SNAPSHOT_MAX_AGE - 1, st)).not.toBeNull();
    expect(readSnapshot('ABCDEF', NOW + SNAPSHOT_MAX_AGE + 1, st)).toBeNull();
    expect(st.map.has('s8:ultimo:ABCDEF')).toBe(false);
  });

  it('guarda no máximo alguns torneios e apaga os mais antigos, nunca o atual', () => {
    const st = fakeStore();
    const codes = ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE', 'FFFFFF', 'GGGGGG', 'HHHHHH'];
    codes.forEach((c, i) => writeSnapshot(c, data(c), NOW + i * 1000, st));
    const kept = [...st.map.keys()].filter((k) => k.startsWith('s8:ultimo:'));
    expect(kept).toHaveLength(SNAPSHOT_MAX_CODES);
    expect(kept).toContain('s8:ultimo:HHHHHH');
    expect(kept).not.toContain('s8:ultimo:AAAAAA');
    expect(kept).not.toContain('s8:ultimo:BBBBBB');
  });

  it('a limpeza tira os vencidos e não mexe no resto do aparelho', () => {
    const st = fakeStore();
    st.setItem('s8:meus', '[]');
    st.setItem('s8:fila:ABCDEF', '[]');
    writeSnapshot('VELHO1', data('VELHO1'), NOW - SNAPSHOT_MAX_AGE - 1000, st);
    writeSnapshot('NOVO01', data('NOVO01'), NOW, st);
    pruneSnapshots(NOW, SNAPSHOT_MAX_CODES, undefined, st);
    expect(st.map.has('s8:ultimo:VELHO1')).toBe(false);
    expect(st.map.has('s8:ultimo:NOVO01')).toBe(true);
    expect(st.map.has('s8:meus')).toBe(true);
    expect(st.map.has('s8:fila:ABCDEF')).toBe(true);
  });

  it('armazenamento cheio: abre espaço apagando os outros guardados', () => {
    const one = JSON.stringify({ v: 1, at: NOW, ...data('AAAAAA') }).length;
    const st = fakeStore(one * 1.5);
    expect(writeSnapshot('AAAAAA', data('AAAAAA'), NOW, st)).toBe(true);
    expect(writeSnapshot('BBBBBB', data('BBBBBB'), NOW + 1, st)).toBe(true);
    expect(st.map.has('s8:ultimo:BBBBBB')).toBe(true);
    expect(st.map.has('s8:ultimo:AAAAAA')).toBe(false);
  });

  it('não quebra quando o armazenamento recusa tudo', () => {
    const st = fakeStore(0);
    expect(writeSnapshot('ABCDEF', data('ABCDEF'), NOW, st)).toBe(false);
    expect(readSnapshot('ABCDEF', NOW, st)).toBeNull();
  });

  it('dropSnapshot apaga o do código', () => {
    const st = fakeStore();
    writeSnapshot('ABCDEF', data('ABCDEF'), NOW, st);
    dropSnapshot('ABCDEF', st);
    expect(readSnapshot('ABCDEF', NOW, st)).toBeNull();
  });
});

describe('fila local por cima do placar', () => {
  const server = new Map([['m1', match('m1', [[2, 1]], 5)], ['m2', match('m2', [], 1)]]);
  const q = (...xs: [string, 'a' | 'b', 1 | -1][]): Intent[] => xs.map(([matchId, side, delta], i) => ({ id: `i${i}`, matchId, side, delta }));

  it('soma os games ainda não enviados sem mexer no original', () => {
    const out = overlayQueue(server, q(['m1', 'a', 1], ['m1', 'b', 1], ['m2', 'b', 1]), scoring);
    expect(out.get('m1')!.sets).toEqual([[3, 2]]);
    expect(out.get('m2')!.sets).toEqual([[0, 1]]);
    expect(server.get('m1')!.sets).toEqual([[2, 1]]);
  });

  it('ignora intenção de partida que não existe e a que não cabe mais', () => {
    const out = overlayQueue(server, q(['zz', 'a', 1], ['m2', 'a', -1]), scoring);
    expect(out.get('m2')!.sets).toEqual([]);
  });

  it('a intenção em voo não conta duas vezes quando o servidor já tem versão nova', () => {
    const intents = q(['m1', 'a', 1]);
    expect(overlayQueue(server, intents, scoring, { id: 'i0', base: 5 }).get('m1')!.sets).toEqual([[3, 1]]);
    expect(overlayQueue(server, intents, scoring, { id: 'i0', base: 4 }).get('m1')!.sets).toEqual([[2, 1]]);
  });
});

describe('hora do último placar', () => {
  it('mesmo dia: só a hora; outro dia: a data também', () => {
    expect(updatedLabel(new Date(2026, 10, 14, 14, 5).getTime(), NOW)).toBe('às 14:05');
    expect(updatedLabel(new Date(2026, 10, 13, 21, 30).getTime(), NOW)).toBe('em 13/11 às 21:30');
  });
});

import { describe, expect, it } from 'vitest';
import { buildInitial, DEFAULT_CONFIG, planEdit, type Config, type Match, type NewMatch, type Player } from './index';

const mk = (n: number, prefix = 'p'): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix.toUpperCase()}${i}`, gender: i % 2 ? 'H' : 'M' }));
const asMatches = (ms: NewMatch[]): Match[] => ms.map((m, i) => ({ ...m, id: `m${i}`, version: 1 }));
/** lança placar nas rodadas até `upTo` */
const play = (ms: Match[], upTo: number): Match[] => ms.map((m) => (m.stage === 'rodada' && m.round <= upTo ? { ...m, sets: [[3, 1]] } : m));

const rodizio: Config = { ...DEFAULT_CONFIG, format: 'rodizio', modality: 'mista', rounds: 6, courts: 2, extraGames: false };

function setup(cfg: Config, players: Player[], upTo: number) {
  const built = buildInitial(players, cfg, 7);
  return { matches: play(asMatches(built.matches), upTo), old: { config: cfg, players, teams: built.teams } };
}

describe('editar sem apagar placar', () => {
  it('mudança que não mexe na tabela mantém todas as partidas', () => {
    const ps = mk(8);
    const { matches, old } = setup(rodizio, ps, 3);
    const plan = planEdit(old, matches, { config: { ...rodizio, scoring: { type: 'total', games: 6 }, ranking: { ...rodizio.ranking, base: 'resultado' } }, players: ps.map((p) => ({ ...p, name: `${p.name}!` })) }, 1);
    expect(plan.mode).toBe('nada');
    expect(plan.keep).toHaveLength(matches.length);
    expect(plan.matches).toHaveLength(0);
    expect(plan.players[0].name).toBe('P0!');
  });

  it('rodízio com jogador novo mantém as rodadas jogadas e sorteia só o resto', () => {
    const ps = mk(8);
    const { matches, old } = setup(rodizio, ps, 3);
    const novos = [...ps, ...mk(2, 'n')];
    const plan = planEdit(old, matches, { config: rodizio, players: novos }, 1);
    expect(plan.mode).toBe('resto');
    expect(plan.keptUpTo).toBe(3);
    const kept = matches.filter((m) => plan.keep.includes(m.id));
    expect(kept.every((m) => m.round <= 3)).toBe(true);
    expect(kept.filter((m) => m.sets.length)).toHaveLength(matches.filter((m) => m.sets.length).length);
    expect(plan.matches.length).toBeGreaterThan(0);
    expect(Math.min(...plan.matches.map((m) => m.round))).toBe(4);
    expect(Math.max(...plan.matches.filter((m) => !m.counts?.length).map((m) => m.round))).toBe(6);
    expect(plan.matches.some((m) => [...m.a, ...m.b].includes('n0'))).toBe(true);
  });

  it('quem sai depois de jogar fica marcado e não entra nas próximas rodadas', () => {
    const ps = mk(10);
    const { matches, old } = setup(rodizio, ps, 2);
    const saiu = matches.find((m) => m.sets.length)!.a[0];
    const plan = planEdit(old, matches, { config: rodizio, players: ps.filter((p) => p.id !== saiu) }, 1);
    expect(plan.mode).toBe('resto');
    expect(plan.players.find((p) => p.id === saiu)?.left).toBe(true);
    expect(plan.leftNames).toHaveLength(1);
    expect(plan.matches.some((m) => [...m.a, ...m.b].includes(saiu))).toBe(false);
  });

  it('jogo da rodada em andamento sem placar fica, a não ser que tenha quem saiu', () => {
    const ps = mk(8);
    const built = buildInitial(ps, rodizio, 7);
    let ms = asMatches(built.matches);
    const r2 = ms.filter((m) => m.round === 2);
    ms = ms.map((m) => (m.round === 1 || m.id === r2[0].id ? { ...m, sets: [[3, 1]] } : m));
    const plan = planEdit({ config: rodizio, players: ps, teams: [] }, ms, { config: { ...rodizio, rounds: 8 }, players: ps }, 1);
    expect(plan.keep).toContain(r2[1].id);
    expect(Math.min(...plan.matches.map((m) => m.round))).toBe(3);
  });

  it('mudar o formato refaz tudo e avisa quantos placares somem', () => {
    const ps = mk(8);
    const { matches, old } = setup(rodizio, ps, 2);
    const plan = planEdit(old, matches, { config: { ...rodizio, format: 'duplas' }, players: ps }, 1);
    expect(plan.mode).toBe('tudo');
    expect(plan.lostScored).toBeGreaterThan(0);
    expect(plan.reason).toBe('o formato mudou');
  });

  it('sem placar nenhum, refazer tudo não perde nada', () => {
    const ps = mk(8);
    const { matches, old } = setup(rodizio, ps, 0);
    const plan = planEdit(old, matches, { config: { ...rodizio, format: 'duplas' }, players: ps }, 1);
    expect(plan.mode).toBe('tudo');
    expect(plan.lostScored).toBe(0);
  });

  it('mexicano com jogador novo mantém o que foi jogado e deixa a próxima rodada pro botão', () => {
    const mex: Config = { ...rodizio, format: 'mexicano' };
    const ps = mk(8);
    const { matches, old } = setup(mex, ps, 1);
    const plan = planEdit(old, matches, { config: mex, players: [...ps, ...mk(4, 'n')] }, 1);
    expect(plan.mode).toBe('resto');
    expect(plan.keep).toHaveLength(matches.length);
    expect(plan.matches).toHaveLength(0);
  });
});

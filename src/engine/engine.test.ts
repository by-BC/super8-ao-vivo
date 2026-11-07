import { describe, expect, it } from 'vitest';
import {
  applyGame, buildInitial, DEFAULT_CONFIG, evaluate, individualSides, knockoutChampion, mulberry32, nextStep,
  parsePlayerList, playerEntities, rankingMessage, rankingSections, rodizioPlans, scheduleQuality, standings,
  suggestRounds, tournamentStatus, validateSetup, matchesPerRound, finalWinners,
  type Config, type Match, type NewMatch, type Player, type Scoring,
} from './index';

const SABADO = `LISTA PLAY SÁBADO

👩 Mulheres

1. Ana Luiza
2. Priscila Pinheiro
3. Priscilla Teles
4. Stephanie
5. Sil
6. Rita
7. Deninha
8. ⁠Paloma
9. Hosana
10. ⁠Raianne
11. ⁠Day
12. ⁠Taisa
13. ⁠Dani

👨 Homens

1. Leo
2. Ruan Lobo
3. Marcelo
4. Bruno
5. Lucas Albuquerque
6. Francisco
7. ⁠Jr
8. Daniel
9. David
10. ⁠Danilo
11. ⁠André.
12. ⁠Raul
13. Lucas
14. ⁠Matheus Rocha`;

function mkPlayers(h: number, m: number): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < h; i++) out.push({ id: `h${i}`, name: `Homem ${i}`, gender: 'H' });
  for (let i = 0; i < m; i++) out.push({ id: `m${i}`, name: `Mulher ${i}`, gender: 'M' });
  return out;
}

const cfg = (over: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...over, ranking: { ...DEFAULT_CONFIG.ranking, ...(over.ranking ?? {}) } });
const toMatches = (ms: NewMatch[], start = 0): Match[] => ms.map((m, i) => ({ ...m, id: `x${start + i}`, version: 0 }));

function noOneTwicePerRound(ms: NewMatch[]) {
  const byRound = new Map<string, string[]>();
  for (const m of ms) {
    const k = `${m.stage}|${m.round}`;
    byRound.set(k, [...(byRound.get(k) ?? []), ...m.a, ...m.b]);
  }
  for (const ids of byRound.values()) expect(new Set(ids).size).toBe(ids.length);
}

describe('pontuação', () => {
  const total: Scoring = { type: 'total', games: 4 };
  it('total de 4 games: 3x1 acaba, 2x2 empata, 2x1 segue', () => {
    expect(evaluate([[3, 1]], total)).toMatchObject({ done: true, winner: 'a', draw: false });
    expect(evaluate([[2, 2]], total)).toMatchObject({ done: true, draw: true, winner: null });
    expect(evaluate([[2, 1]], total)).toMatchObject({ done: false, progress: '3/4' });
    expect(applyGame([[3, 1]], 'a', 1, total)).toBeNull();
  });
  it('no mata-mata o 2x2 vai para um game de desempate', () => {
    expect(evaluate([[2, 2]], total, true).done).toBe(false);
    const next = applyGame([[2, 2]], 'b', 1, total, true)!;
    expect(evaluate(next, total, true)).toMatchObject({ done: true, winner: 'b' });
  });
  it('set de 6 com tie-break no 6x6', () => {
    const set: Scoring = { type: 'set', games: 6 };
    expect(evaluate([[6, 4]], set).done).toBe(true);
    expect(evaluate([[6, 5]], set).done).toBe(false);
    expect(evaluate([[7, 5]], set).done).toBe(true);
    expect(evaluate([[6, 6]], set).done).toBe(false);
    expect(evaluate([[7, 6]], set)).toMatchObject({ done: true, winner: 'a' });
  });
  it('melhor de 3 com match tie-break de 10', () => {
    const bo3: Scoring = { type: 'melhor3', games: 6 };
    let s = [[6, 4], [3, 6]] as [number, number][];
    expect(evaluate(s, bo3).done).toBe(false);
    s = applyGame(s, 'a', 1, bo3)!;
    expect(s).toEqual([[6, 4], [3, 6], [1, 0]]);
    s = [[6, 4], [3, 6], [10, 8]];
    expect(evaluate(s, bo3)).toMatchObject({ done: true, winner: 'a', gamesA: 10, gamesB: 10 });
    expect(evaluate([[6, 4], [6, 2]], bo3)).toMatchObject({ done: true, winner: 'a' });
  });
  it('tirar game volta o placar e nunca fica negativo', () => {
    expect(applyGame([[1, 0]], 'a', -1, total)).toEqual([]);
    expect(applyGame([], 'a', -1, total)).toBeNull();
    const bo3: Scoring = { type: 'melhor3', games: 4 };
    expect(applyGame([[4, 1], [0, 0]], 'a', -1, bo3)).toEqual([[3, 1]]);
  });
});

describe('importar lista do WhatsApp', () => {
  it('lê a lista de sábado com cabeçalhos, números e caracteres invisíveis', () => {
    const { players, duplicates } = parsePlayerList(SABADO);
    expect(players.filter((p) => p.gender === 'M')).toHaveLength(13);
    expect(players.filter((p) => p.gender === 'H')).toHaveLength(14);
    expect(players.map((p) => p.name)).toContain('André');
    expect(players.map((p) => p.name)).toContain('Raianne');
    expect(players.map((p) => p.name)).not.toContain('LISTA PLAY SÁBADO');
    expect(duplicates).toEqual([]);
  });
  it('entende "Nome homem" e "Nome mulher"', () => {
    const { players } = parsePlayerList('Bruno homem\nRafa mulher\nRuan H\nSophia (M)\nAna (F)\nLeo - h');
    expect(players).toEqual([
      { name: 'Bruno', gender: 'H' }, { name: 'Rafa', gender: 'M' }, { name: 'Ruan', gender: 'H' }, { name: 'Sophia', gender: 'M' },
      { name: 'Ana', gender: 'M' }, { name: 'Leo', gender: 'H' },
    ]);
  });
  const names = (t: string, f?: 'H' | 'M') => parsePlayerList(t, f).players;
  it('cabeçalho sem emoji, um nome por linha', () => {
    const ps = names('Mulheres\nAna\nBia\n\nHOMENS:\nCaio\nDiego');
    expect(ps).toEqual([
      { name: 'Ana', gender: 'M' }, { name: 'Bia', gender: 'M' }, { name: 'Caio', gender: 'H' }, { name: 'Diego', gender: 'H' },
    ]);
  });
  it('nomes separados por vírgula, ponto e vírgula, barra e "e"', () => {
    expect(names('Ana, Bia, Carla e Duda').map((p) => p.name)).toEqual(['Ana', 'Bia', 'Carla', 'Duda']);
    expect(names('Ana; Bia / Carla').map((p) => p.name)).toEqual(['Ana', 'Bia', 'Carla']);
    expect(names('Ana, Bia').every((p) => p.gender === null)).toBe(true);
  });
  it('cabeçalho com nomes na mesma linha e numeração corrida', () => {
    const ps = names('Mulheres: Ana Luiza, Bia e Carla\nHomens (3): 1. Caio 2. Diego 3. Edu');
    expect(ps.map((p) => `${p.name}:${p.gender}`)).toEqual(['Ana Luiza:M', 'Bia:M', 'Carla:M', 'Caio:H', 'Diego:H', 'Edu:H']);
  });
  it('ignora título, recado com horário e lista de espera', () => {
    const r = parsePlayerList('Play de domingo 19h\nConfirmados: Ana, Bia\nCaio\nLista de espera\nZeca\nTião');
    expect(r.players.map((p) => p.name)).toEqual(['Ana', 'Bia', 'Caio']);
    expect(r.ignored.join(' ')).toMatch(/Zeca/);
  });
  it('marca todos com um gênero quando a pessoa escolhe', () => {
    expect(names('Ana\nBia', 'M').every((p) => p.gender === 'M')).toBe(true);
    expect(names('1- Caio\n2- Diego', 'H').map((p) => `${p.name}:${p.gender}`)).toEqual(['Caio:H', 'Diego:H']);
  });
});

describe('rodízio individual', () => {
  it('5H + 5M em 2 quadras: ninguém repete parceiro e todo mundo joga 4', () => {
    const ps = mkPlayers(5, 5);
    const c = cfg({ modality: 'mista', format: 'rodizio', courts: 2, rounds: 5 });
    const { div, m } = matchesPerRound(ps, c)[0];
    const plans = rodizioPlans(div, true, 5, m, mulberry32(1));
    expect(scheduleQuality(div, true, plans)).toMatchObject({ partnerRepeats: 0, gamesSpread: 0 });
  });
  it('4H + 4M em 2 quadras (Super 8 misto): cada homem joga com cada mulher', () => {
    const ps = mkPlayers(4, 4);
    const c = cfg({ modality: 'mista', courts: 2, rounds: 4 });
    const { div, m } = matchesPerRound(ps, c)[0];
    expect(scheduleQuality(div, true, rodizioPlans(div, true, 4, m, mulberry32(2)))).toMatchObject({ partnerRepeats: 0, gamesSpread: 0 });
  });
  it('8 jogadores livres em 2 quadras e 7 rodadas: o Super 8 clássico sem repetir parceiro', () => {
    const ps = mkPlayers(8, 0);
    const c = cfg({ modality: 'livre', courts: 2, rounds: 7 });
    const { div, m } = matchesPerRound(ps, c)[0];
    expect(scheduleQuality(div, false, rodizioPlans(div, false, 7, m, mulberry32(3)))).toMatchObject({ partnerRepeats: 0, gamesSpread: 0 });
  });
  it('lista de sábado (14H, 13M) em 4 quadras: duplas mistas, ninguém joga duas vezes na rodada, folgas equilibradas', () => {
    const ps: Player[] = parsePlayerList(SABADO).players.map((p, i) => ({ id: `p${i}`, ...p }));
    const c = cfg({ modality: 'mista', courts: 4 });
    c.rounds = suggestRounds(ps, c);
    expect(validateSetup(ps, c).ok).toBe(true);
    const { matches } = buildInitial(ps, c, 42);
    expect(matches).toHaveLength(4 * c.rounds);
    noOneTwicePerRound(matches);
    const g = new Map(ps.map((p) => [p.id, p.gender]));
    for (const m of matches) {
      expect(new Set(m.a.map((id) => g.get(id)))).toEqual(new Set(['H', 'M']));
      expect(new Set(m.b.map((id) => g.get(id)))).toEqual(new Set(['H', 'M']));
    }
    const { div, m } = matchesPerRound(ps, c)[0];
    const plans = rodizioPlans(div, true, c.rounds, m, mulberry32(7));
    const q = scheduleQuality(div, true, plans);
    expect(q.partnerRepeats).toBe(0);
    expect(q.gamesSpread).toBeLessThanOrEqual(1);
  });
  it('mesmo gênero: masculino e feminino jogam separados', () => {
    const ps = mkPlayers(8, 8);
    const { matches } = buildInitial(ps, cfg({ modality: 'mesmo_genero', courts: 4, rounds: 3 }), 5);
    expect(new Set(matches.map((m) => m.division))).toEqual(new Set(['H', 'M']));
    for (const m of matches) expect([...m.a, ...m.b].every((id) => id[0] === m.division.toLowerCase())).toBe(true);
  });
});

describe('duplas fixas todos contra todos', () => {
  it('5 duplas mistas em 2 quadras: 10 jogos, cada dupla joga 4, nunca duas vezes na rodada', () => {
    const ps = mkPlayers(5, 5);
    const c = cfg({ format: 'duplas', courts: 2 });
    const { teams, matches } = buildInitial(ps, c, 9);
    expect(teams).toHaveLength(5);
    expect(matches).toHaveLength(10);
    noOneTwicePerRound(matches);
    for (const t of teams) expect(matches.filter((m) => m.teamA === t.id || m.teamB === t.id)).toHaveLength(4);
    expect(Math.max(...matches.map((m) => m.slot))).toBeLessThan(2);
  });
  it('não deixa criar duplas fixas mistas com 14 homens e 13 mulheres', () => {
    const ps: Player[] = parsePlayerList(SABADO).players.map((p, i) => ({ id: `p${i}`, ...p }));
    const check = validateSetup(ps, cfg({ format: 'duplas' }));
    expect(check.ok).toBe(false);
    expect(check.errors[0]).toMatch(/mesmo número/);
  });
});

describe('grupos + mata-mata', () => {
  const play = (ms: Match[], score: (m: Match) => [number, number]) => ms.map((m) => ({ ...m, sets: [score(m)] }));

  it('8 duplas em 2 grupos, 2 classificam: semis cruzadas, final e campeão', () => {
    const ps = mkPlayers(8, 8);
    const c = cfg({ format: 'grupos', groups: 2, qualify: 2, courts: 3 });
    const { teams, matches } = buildInitial(ps, c, 11);
    expect(new Set(teams.map((t) => t.group))).toEqual(new Set(['A', 'B']));
    expect(matches).toHaveLength(12);
    noOneTwicePerRound(matches);

    let all = toMatches(matches);
    // a dupla de id menor sempre vence: dá uma ordem previsível
    all = play(all, (m) => (m.teamA! < m.teamB! ? [3, 1] : [1, 3]));
    const semis = nextStep(ps, teams, c, all, 1)!;
    expect(semis.title).toBe('Gerar mata-mata');
    expect(semis.matches).toHaveLength(2);
    const grp = new Map(teams.map((t) => [t.id, t.group]));
    for (const m of semis.matches) expect(grp.get(m.teamA!)).not.toBe(grp.get(m.teamB!));

    all = [...all, ...play(toMatches(semis.matches, 100), () => [3, 1])];
    const final = nextStep(ps, teams, c, all, 1)!;
    expect(final.matches).toHaveLength(1);
    expect(final.matches[0].label).toBe('Final');
    all = [...all, ...play(toMatches(final.matches, 200), () => [1, 3])];
    expect(knockoutChampion('all', all, c)).toBe(final.matches[0].teamB);
    expect(tournamentStatus(ps, c, all)).toBe('encerrado');
    expect(nextStep(ps, teams, c, all, 1)).toBeNull();
  });

  it('3 classificados: um avança direto e a chave fecha', () => {
    const ps = mkPlayers(6, 6);
    const c = cfg({ format: 'grupos', groups: 3, qualify: 1, courts: 3 });
    const { teams, matches } = buildInitial(ps, c, 4);
    let all = play(toMatches(matches), () => [3, 1]);
    const r1 = nextStep(ps, teams, c, all, 1)!;
    expect(r1.matches.filter((m) => m.b.length === 0)).toHaveLength(1);
    all = [...all, ...play(toMatches(r1.matches.filter((m) => m.b.length > 0), 100), () => [1, 3]), ...toMatches(r1.matches.filter((m) => m.b.length === 0), 150)];
    const fin = nextStep(ps, teams, c, all, 1)!;
    expect(fin.matches).toHaveLength(1);
    expect(fin.matches[0].label).toBe('Final');
  });
});

describe('mexicano', () => {
  it('2ª rodada junta 1º com 4º contra 2º com 3º', () => {
    const ps = mkPlayers(8, 0);
    const c = cfg({ modality: 'livre', format: 'mexicano', courts: 2, rounds: 3 });
    const { matches } = buildInitial(ps, c, 3);
    expect(matches).toHaveLength(2);
    let all = toMatches(matches).map((m, i) => ({ ...m, sets: [i === 0 ? [4, 0] : [3, 1]] as [number, number][] }));
    const step = nextStep(ps, [], c, all, 2)!;
    expect(step.title).toBe('Gerar rodada 2');
    const order = standings(playerEntities(ps), all, c, individualSides).map((r) => r.key);
    const top = step.matches.find((m) => m.court === 1)!;
    expect(new Set(top.a)).toEqual(new Set([order[0], order[3]]));
    expect(new Set(top.b)).toEqual(new Set([order[1], order[2]]));
    all = [...all, ...toMatches(step.matches, 10)];
    expect(nextStep(ps, [], c, all, 3)).toBeNull(); // rodada 2 ainda não acabou
  });
});

describe('ranking', () => {
  const ps = mkPlayers(2, 2);
  const m = (a: string[], b: string[], s: [number, number], id: string): Match => ({
    id, version: 0, stage: 'rodada', round: 1, division: 'all', grp: null, slot: 0, court: 1, label: null, a, b, teamA: null, teamB: null, sets: [s],
  });
  it('vitória 3, empate 1, derrota 0', () => {
    const c = cfg({ ranking: { ...DEFAULT_CONFIG.ranking, base: 'resultado' } });
    const rows = standings(playerEntities(ps), [m(['h0', 'm0'], ['h1', 'm1'], [3, 1], '1'), m(['h0', 'm1'], ['h1', 'm0'], [2, 2], '2')], c, individualSides);
    expect(rows.find((r) => r.key === 'h0')).toMatchObject({ main: 4, v: 1, e: 1, pos: 1 });
    expect(rows.find((r) => r.key === 'h1')).toMatchObject({ main: 1, d: 1, e: 1 });
  });
  it('confronto direto desempata quem ficou igual em pontos e vitórias', () => {
    const c = cfg({ ranking: { ...DEFAULT_CONFIG.ranking, desempate: ['vitorias', 'confronto'] } });
    const ms = [m(['h0', 'm0'], ['h1', 'm1'], [3, 1], '1'), m(['h1', 'm1'], ['h0', 'm0'], [3, 1], '2'), m(['h0', 'm0'], ['h1', 'm1'], [1, 3], '3')];
    const rows = standings(playerEntities(ps), ms, c, individualSides);
    expect(rows[0].key === 'h1' || rows[0].key === 'm1').toBe(true);
    expect(rows[0].pos).toBe(1);
    expect(rows[2].pos).toBe(3);
  });
  it('empate em tudo: divide a posição, mas a ordem sai de um sorteio fixo do torneio', () => {
    const four = mkPlayers(2, 2);
    const ents = playerEntities(four);
    const c1 = cfg({ ranking: { ...DEFAULT_CONFIG.ranking, sorteio: 123 } });
    const r1 = standings(ents, [], c1, individualSides).map((r) => r.key);
    const r2 = standings([...ents].reverse(), [], c1, individualSides).map((r) => r.key);
    expect(r1).toEqual(r2);
    expect(standings(ents, [], c1, individualSides).every((r) => r.pos === 1)).toBe(true);
  });
  it('jogo extra só conta para quem está em "vale só para"', () => {
    const c = cfg();
    const extra = { ...m(['h0', 'm0'], ['h1', 'm1'], [3, 1], 'x'), counts: ['h0', 'm1'] };
    const rows = standings(playerEntities(ps), [extra], c, individualSides);
    expect(rows.find((r) => r.key === 'h0')).toMatchObject({ j: 1, v: 1, gf: 3 });
    expect(rows.find((r) => r.key === 'm1')).toMatchObject({ j: 1, d: 1, gf: 1 });
    expect(rows.find((r) => r.key === 'm0')).toMatchObject({ j: 0, gf: 0 });
    expect(rows.find((r) => r.key === 'h1')).toMatchObject({ j: 0, gf: 0 });
  });
  it('rodízio dividido em grupos: um ranking por grupo', () => {
    const players = mkPlayers(8, 0);
    const c = cfg({ modality: 'mesmo_genero', format: 'rodizio' });
    const mk = (a: string[], b: string[], grp: string, id: string): Match => ({ ...m(a, b, [3, 1], id), division: 'H', grp });
    const secs = rankingSections(players, [], c, [mk(['h0', 'h1'], ['h2', 'h3'], 'A', '1'), mk(['h4', 'h5'], ['h6', 'h7'], 'B', '2')]);
    expect(secs.map((s) => s.title)).toEqual(['Grupo A', 'Grupo B']);
    expect(secs[0].rows.map((r) => r.key).sort()).toEqual(['h0', 'h1', 'h2', 'h3']);
  });
  it('rodízio em 2 grupos termina na final: 1º e 2º do A contra 1º e 2º do B', () => {
    const players = mkPlayers(8, 0);
    const c = cfg({ modality: 'mesmo_genero', format: 'rodizio' });
    const mk = (a: string[], b: string[], grp: string, id: string, s: [number, number]): Match => ({ ...m(a, b, s, id), division: 'H', grp });
    let all: Match[] = [mk(['h0', 'h1'], ['h2', 'h3'], 'A', '1', [3, 1]), mk(['h4', 'h5'], ['h6', 'h7'], 'B', '2', [1, 3])];
    expect(tournamentStatus(players, c, all)).toBe('andamento');
    const step = nextStep(players, [], c, all, 1)!;
    expect(step.title).toBe('Gerar final');
    const f = step.matches[0];
    expect(new Set(f.a)).toEqual(new Set(['h0', 'h1']));
    expect(new Set(f.b)).toEqual(new Set(['h6', 'h7']));
    all = [...all, { ...f, id: 'f', version: 0, sets: [[2, 2]] }];
    expect(finalWinners('H', c, all)).toBeNull(); // 2x2 na final vai para o game de desempate
    all = all.map((x) => (x.id === 'f' ? { ...x, sets: [[2, 3]] as [number, number][] } : x));
    expect(finalWinners('H', c, all)).toEqual(f.b);
    expect(tournamentStatus(players, c, all)).toBe('encerrado');
  });
  it('Rei e Rainha: ranking separado por gênero no rodízio misto', () => {
    const c = cfg({ modality: 'mista', format: 'rodizio' });
    const secs = rankingSections(mkPlayers(4, 4), [], c, []);
    expect(secs.map((s) => s.title)).toEqual(['Geral', 'Homens', 'Mulheres']);
  });
  it('mensagem do WhatsApp traz medalhas e link', () => {
    const c = cfg({ modality: 'mista', format: 'rodizio', courts: 1, rounds: 1 });
    const players = mkPlayers(2, 2);
    const { matches } = buildInitial(players, c, 1);
    const all = toMatches(matches).map((x) => ({ ...x, sets: [[3, 1]] as [number, number][] }));
    const msg = rankingMessage({ name: 'Play', link: 'https://exemplo/#/t/ABC234', code: 'ABC234', players, teams: [], config: c, matches: all });
    expect(msg).toContain('🥇');
    expect(msg).toContain('https://exemplo/#/t/ABC234');
    expect(msg).toContain('Resultado final');
  });
});

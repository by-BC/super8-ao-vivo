import { describe, expect, it } from 'vitest';
import {
  applyGame, buildInitial, DEFAULT_CONFIG, evaluate, individualSides, knockoutChampion, mulberry32, nextStep,
  parsePlayerList, playerEntities, rankingMessage, rankingSections, rodizioPlans, scheduleQuality, standings,
  suggestRounds, tournamentStatus, validateSetup, teamSides, defaultRanking, isDefaultRanking, rankingFor, type Entity, matchesPerRound, finalWinners, podiums, playerCard, levelLetter, levelValue, formTeams, keptPairs, summarize, splitGroups, suggestFormats, possibleModalities, estimateMinutes, matchMinutes, durationText,
  type Config, type Match, type NewMatch, type Player, type Scoring, type SetScore,
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

function noCourtTwicePerRound(ms: NewMatch[]) {
  const keys = ms.map((m) => `${m.stage}|${m.round}|${m.court}`);
  expect(new Set(keys).size).toBe(keys.length);
}

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
  it('lista de duplas: toda linha com dois nomes vira dupla', () => {
    const r = parsePlayerList('Duplas do sábado\n1. Ana e Bia\n2. Carla / Duda\n3- Edu, Fábio\nLista de espera\nZeca e Tião');
    expect(r.pairs).toEqual([['Ana', 'Bia'], ['Carla', 'Duda'], ['Edu', 'Fábio']]);
    expect(r.players).toHaveLength(6);
  });
  it('duplas mistas com gênero no nome', () => {
    const r = parsePlayerList('Ana (F) e Caio (H)\nBia mulher / Diego homem');
    expect(r.pairs).toEqual([['Ana', 'Caio'], ['Bia', 'Diego']]);
    expect(r.players.map((p) => `${p.name}:${p.gender}`)).toEqual(['Ana:M', 'Caio:H', 'Bia:M', 'Diego:H']);
  });
  it('não inventa dupla: basta uma linha fora do padrão', () => {
    expect(parsePlayerList('Ana e Bia\nCarla\nDuda').pairs).toBeNull();
    expect(parsePlayerList('Ana e Bia\nCarla, Duda e Edu').pairs).toBeNull();
    expect(parsePlayerList('Ana e Bia').pairs).toBeNull();
    expect(parsePlayerList('Ana\nBia\nCarla\nDuda').pairs).toBeNull();
    expect(parsePlayerList('Mulheres: Ana, Bia\nHomens: Caio, Diego').pairs).toEqual([['Ana', 'Bia'], ['Caio', 'Diego']]);
    // nome repetido desfaz a leitura em duplas
    expect(parsePlayerList('Ana e Bia\nAna e Carla').pairs).toBeNull();
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
    expect(matches.filter((m) => m.label !== 'Extra')).toHaveLength(4 * c.rounds);
    expect(matches.filter((m) => m.label === 'Extra').every((m) => m.round > c.rounds)).toBe(true);
    noOneTwicePerRound(matches);
    noCourtTwicePerRound(matches);
    // com o jogo extra, cada gênero soma o mesmo número de partidas que contam
    const counted = new Map<string, number>();
    for (const m of matches) for (const id of [...m.a, ...m.b]) if (!m.counts || m.counts.includes(id)) counted.set(id, (counted.get(id) ?? 0) + 1);
    for (const gnd of ['H', 'M']) expect(new Set(ps.filter((p) => p.gender === gnd).map((p) => counted.get(p.id))).size).toBe(1);
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
  it('rodízio em 2 grupos termina na final cruzada: 1º A + 2º B contra 2º A + 1º B', () => {
    const players = mkPlayers(8, 0);
    const c = cfg({ modality: 'mesmo_genero', format: 'rodizio' });
    const mk = (a: string[], b: string[], grp: string, id: string, s: [number, number]): Match => ({ ...m(a, b, s, id), division: 'H', grp });
    let all: Match[] = [mk(['h0', 'h1'], ['h2', 'h3'], 'A', '1', [3, 1]), mk(['h4', 'h5'], ['h6', 'h7'], 'B', '2', [1, 3])];
    expect(tournamentStatus(players, c, all)).toBe('andamento');
    const step = nextStep(players, [], c, all, 1)!;
    expect(step.title).toBe('Gerar final');
    const f = step.matches[0];
    const topA = rankingSections(players, [], c, all)[0].rows.slice(0, 2).map((r) => r.key);
    const topB = rankingSections(players, [], c, all)[1].rows.slice(0, 2).map((r) => r.key);
    expect(new Set(topA)).toEqual(new Set(['h0', 'h1']));
    expect(new Set(topB)).toEqual(new Set(['h6', 'h7']));
    expect(f.a).toEqual([topA[0], topB[1]]);
    expect(f.b).toEqual([topA[1], topB[0]]);
    all = [...all, { ...f, id: 'f', version: 0, sets: [[2, 2]] }];
    expect(finalWinners('H', c, all)).toBeNull(); // 2x2 na final vai para o game de desempate
    all = all.map((x) => (x.id === 'f' ? { ...x, sets: [[2, 3]] as [number, number][] } : x));
    expect(finalWinners('H', c, all)).toEqual(f.b);
    expect(tournamentStatus(players, c, all)).toBe('encerrado');
    const [pod] = podiums(players, [], c, all);
    expect(pod).toMatchObject({ division: 'H', headline: 'Campeões', final: '3 x 2' });
    expect(pod.places.map((x) => x.pos)).toEqual([1, 2]);
    expect(pod.places[0].names).toEqual(f.b.map((id) => players.find((p) => p.id === id)!.name));
    const champ = playerCard(players, [], c, all, f.b[0])!;
    expect(champ).toMatchObject({ tier: 'ouro', tag: 'CAMPEÃO', j: 2, v: 2 });
    expect(champ.rating).toBeGreaterThanOrEqual(60);
    expect(champ.rating).toBeLessThanOrEqual(99);
    expect(playerCard(players, [], c, all, f.a[0])).toMatchObject({ tier: 'prata', tag: 'VICE' });
    const other = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'].find((id) => !f.a.includes(id) && !f.b.includes(id))!;
    expect(playerCard(players, [], c, all, other)?.tier).toBe('azul');
  });
  it('jogo extra entre grupos vale para os 4, cada um no ranking do seu grupo', () => {
    const players = mkPlayers(8, 0);
    const c = cfg({ modality: 'mesmo_genero', format: 'rodizio' });
    const mk = (a: string[], b: string[], grp: string | null, id: string, s: [number, number] | null): Match =>
      ({ ...m(a, b, s ?? [0, 0], id), sets: s ? [s] : [], division: 'H', grp });
    let all: Match[] = [
      mk(['h0', 'h1'], ['h2', 'h3'], 'A', '1', [4, 2]),
      mk(['h4', 'h5'], ['h6', 'h7'], 'B', '2', [2, 4]),
      mk(['h2', 'h3'], ['h4', 'h5'], null, 'x', null), // extra A x B
    ];
    expect(rankingSections(players, [], c, all).map((s) => s.title)).toEqual(['Grupo A', 'Grupo B']);
    expect(nextStep(players, [], c, all, 1)).toBeNull(); // final espera o extra
    all = all.map((x) => (x.id === 'x' ? { ...x, sets: [[5, 1]] as [number, number][] } : x));
    const [ga, gb] = rankingSections(players, [], c, all);
    expect(ga.rows.map((r) => r.key).sort()).toEqual(['h0', 'h1', 'h2', 'h3']);
    expect(gb.rows.map((r) => r.key).sort()).toEqual(['h4', 'h5', 'h6', 'h7']);
    expect(ga.rows.find((r) => r.key === 'h2')).toMatchObject({ j: 2, v: 1, d: 1 });
    expect(gb.rows.find((r) => r.key === 'h4')).toMatchObject({ j: 2, v: 0, d: 2 });
    const f = nextStep(players, [], c, all, 1)!.matches[0];
    expect(f.label).toBe('Final');
    expect(f.a).toEqual([ga.rows[0].key, gb.rows[1].key]);
    expect(f.b).toEqual([ga.rows[1].key, gb.rows[0].key]);
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

describe('níveis A–D', () => {
  it('converte letra e número (A é o mais forte)', () => {
    expect(levelValue('a')).toBe(4);
    expect(levelValue('D')).toBe(1);
    expect(levelValue('X')).toBeUndefined();
    expect(levelLetter(4)).toBe('A');
    expect(levelLetter(1)).toBe('D');
    expect(levelLetter(undefined)).toBeNull();
  });

  it('rodízio com nível monta jogos mais parelhos e sem repetir parceiro', () => {
    const lv = [4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1];
    const withLevel: Player[] = lv.map((l, i) => ({ id: `x${i}`, name: `J${i}`, gender: null, level: l }));
    const plain: Player[] = withLevel.map(({ level: _l, ...p }) => p);
    const s = new Map(withLevel.map((p) => [p.id, p.level!]));
    const gap = (plans: ReturnType<typeof rodizioPlans>) => {
      const ds = plans.flat().map(([p, q]) => Math.abs(s.get(p[0])! + s.get(p[1])! - s.get(q[0])! - s.get(q[1])!));
      return ds.reduce((a, b) => a + b, 0) / ds.length;
    };
    const balanced = rodizioPlans({ id: 'all', label: '', players: withLevel }, false, 6, 3, mulberry32(7));
    const random = rodizioPlans({ id: 'all', label: '', players: plain }, false, 6, 3, mulberry32(7));
    expect(gap(balanced)).toBeLessThan(gap(random));
    expect(gap(balanced)).toBeLessThanOrEqual(1);
    expect(scheduleQuality({ id: 'all', label: '', players: withLevel }, false, balanced)).toMatchObject({ partnerRepeats: 0, gamesSpread: 0 });
  });

  it('duplas fixas equilibradas juntam A com D e B com C', () => {
    const ps: Player[] = [4, 3, 2, 1].map((l, i) => ({ id: `y${i}`, name: `P${i}`, gender: null, level: l }));
    const teams = formTeams(ps, { ...cfg(), modality: 'livre', format: 'duplas', pairing: 'equilibrado' }, mulberry32(1));
    const sums = teams.map((t) => t.players.reduce((a, id) => a + ps.find((p) => p.id === id)!.level!, 0));
    expect(sums).toEqual([5, 5]);
  });
});

describe('rodízio em 2 grupos', () => {
  const counted = (matches: NewMatch[]) => {
    const c = new Map<string, number>();
    for (const m of matches) for (const id of [...m.a, ...m.b]) if (!m.counts || m.counts.includes(id)) c.set(id, (c.get(id) ?? 0) + 1);
    return c;
  };

  it('sábado (13 F + 14 M, 4 quadras): uma quadra por grupo, extra A x B iguala os jogos e a final cruzada sai no fim', () => {
    const ps: Player[] = parsePlayerList(SABADO).players.map((p, i) => ({ id: `p${i}`, ...p }));
    const c = cfg({ modality: 'mesmo_genero', courts: 4, rodizioGroups: 2, extraGames: true, ranking: { ...DEFAULT_CONFIG.ranking, base: 'resultado' } });
    c.rounds = suggestRounds(ps, c);
    expect(validateSetup(ps, c).ok).toBe(true);
    const { matches } = buildInitial(ps, c, 11);
    noOneTwicePerRound(matches);
    noCourtTwicePerRound(matches);
    for (const div of ['H', 'M']) {
      const ms = matches.filter((m) => m.division === div);
      const regular = ms.filter((m) => m.grp);
      expect(new Set(regular.map((m) => m.grp))).toEqual(new Set(['A', 'B']));
      // cada grupo sempre na mesma quadra
      for (const g of ['A', 'B']) expect(new Set(regular.filter((m) => m.grp === g && !m.label).map((m) => m.court)).size).toBe(1);
      // ninguém do grupo A joga com alguém do B fora do extra A x B
      const grpOf = new Map<string, string>();
      for (const m of regular.filter((x) => !x.label)) for (const id of [...m.a, ...m.b]) grpOf.set(id, m.grp!);
      for (const m of regular) expect(new Set([...m.a, ...m.b].map((id) => grpOf.get(id))).size).toBe(1);
      const cross = ms.filter((m) => m.label === 'Extra · A x B');
      expect(cross.length).toBeGreaterThan(0);
      for (const m of cross) {
        expect(new Set(m.a.map((id) => grpOf.get(id)))).toEqual(new Set(['A']));
        expect(new Set(m.b.map((id) => grpOf.get(id)))).toEqual(new Set(['B']));
      }
      // dentro de cada grupo todo mundo soma o mesmo número de partidas
      const cnt = counted(ms);
      for (const g of ['A', 'B']) expect(new Set([...grpOf].filter(([, x]) => x === g).map(([id]) => cnt.get(id))).size).toBe(1);
    }
    // jogando tudo, sai a final cruzada de cada divisão
    const played: Match[] = matches.map((m, i) => ({ ...m, id: `m${i}`, version: 1, sets: [[4, 2]] as SetScore[] }));
    const step = nextStep(ps, [], c, played, 1);
    expect(step?.title).toBe('Gerar final');
    expect(step!.matches.map((m) => m.division).sort()).toEqual(['H', 'M']);
    // o resumo conta a tabela inteira e mais uma final por divisão, numa rodada a mais
    const s = summarize(ps, c);
    expect(s.matches).toBe(matches.length + 2);
    expect(s.rounds).toBe(Math.max(...matches.map((m) => m.round)) + 1);
    expect(s.extra).toMatch(/as 2 finais cruzadas/);
  });

  it('grupos equilibrados pelo nível e, no misto, com homens e mulheres nos dois', () => {
    const lv = [4, 4, 3, 3, 2, 2, 1, 1];
    const ps: Player[] = [...lv.map((l, i) => ({ id: `h${i}`, name: `H${i}`, gender: 'H' as const, level: l })), ...lv.map((l, i) => ({ id: `m${i}`, name: `M${i}`, gender: 'M' as const, level: l }))];
    const [a, b] = splitGroups({ id: 'all', label: '', players: ps }, true, mulberry32(3));
    const sum = (g: Player[]) => g.reduce((x, p) => x + p.level!, 0);
    expect(a.length).toBe(8);
    expect(b.length).toBe(8);
    expect(a.filter((p) => p.gender === 'H').length).toBe(4);
    expect(Math.abs(sum(a) - sum(b))).toBeLessThanOrEqual(2);
  });

  it('pede uma quadra por grupo e grupo com pelo menos 4', () => {
    const ps = mkPlayers(0, 14);
    expect(validateSetup(ps, cfg({ modality: 'livre', courts: 1, rounds: 6, rodizioGroups: 2 })).issues[0]?.text).toMatch(/2 quadras/);
    expect(validateSetup(mkPlayers(0, 7), cfg({ modality: 'livre', courts: 2, rounds: 6, rodizioGroups: 2 })).issues[0]?.text).toMatch(/pelo menos 4/);
  });
});

describe('ranking de duplas fixas e grupos: vitórias primeiro', () => {
  // Regulamentos amadores de fase de grupos (FPT 2022, Arapiraca 2024, Sesc SP, Copa SP): vitórias; com 2
  // empatados, confronto direto; com 3 ou mais, saldo de games, depois média de games; por fim, sorteio.
  const pair = cfg({ format: 'duplas', scoring: { type: 'corrida', games: 4 }, ranking: { ...DEFAULT_CONFIG.ranking, ...defaultRanking('duplas') } });
  const ents = (keys: string[]): Entity[] => keys.map((k) => ({ key: k, ids: [], label: k, gender: null }));
  let n = 0;
  const g = (a: string, b: string, s: [number, number]): Match => ({
    id: `g${n++}`, version: 0, stage: 'grupo', round: 1, division: 'all', grp: 'A', slot: 0, court: 1, label: null, a: [`${a}1`, `${a}2`], b: [`${b}1`, `${b}2`], teamA: a, teamB: b, sets: [s],
  });
  const order = (keys: string[], ms: Match[], c: Config = pair) => standings(ents(keys), ms, c, teamSides).map((r) => r.key);

  it('padrão por formato: individual por games, duplas e grupos por resultado', () => {
    expect(defaultRanking('rodizio')).toEqual({ base: 'games', desempate: ['vitorias', 'saldo', 'confronto'] });
    expect(defaultRanking('mexicano')).toEqual(defaultRanking('rodizio'));
    expect(defaultRanking('duplas')).toEqual({ base: 'resultado', desempate: ['confronto', 'saldo', 'media_games'] });
    expect(defaultRanking('grupos')).toEqual(defaultRanking('duplas'));
    expect(DEFAULT_CONFIG.ranking).toMatchObject(defaultRanking(DEFAULT_CONFIG.format));
  });
  it('trocar o formato troca o ranking padrão, mas nunca o que o organizador escolheu', () => {
    const ind = DEFAULT_CONFIG.ranking;
    const dup = rankingFor('duplas', ind);
    expect(dup).toMatchObject({ base: 'resultado', desempate: ['confronto', 'saldo', 'media_games'], separarGenero: ind.separarGenero, media: ind.media });
    expect(rankingFor('rodizio', dup)).toMatchObject(defaultRanking('rodizio'));
    expect(rankingFor('grupos', dup)).toBe(dup); // já está no padrão: nada muda
    const custom = { ...ind, desempate: ['saldo', 'vitorias'] as typeof ind.desempate };
    expect(isDefaultRanking(custom)).toBe(false);
    expect(rankingFor('duplas', custom)).toBe(custom);
    // rankingTouched: mesmo igual a um padrão, a escolha explícita fica
    expect(rankingFor('duplas', ind, true)).toBe(ind);
  });
  it('sugestões de duplas e grupos já vêm com vitórias primeiro; rodízio continua por games', () => {
    const s = suggestFormats(mkPlayers(8, 8), cfg({ courts: 4 }), { minutes: 300, modalities: ['mista'] });
    const by = (f: string) => s.find((x) => x.config.format === f)!.config.ranking;
    expect(by('duplas')).toMatchObject(defaultRanking('duplas'));
    expect(by('rodizio')).toMatchObject(defaultRanking('rodizio'));
  });
  it('2 empatados em vitórias: confronto direto decide, mesmo com saldo pior', () => {
    // E e F com 2 vitórias; F ganhou de E, mas E tem saldo bem melhor
    const ms = [g('F', 'E', [4, 3]), g('E', 'G', [4, 0]), g('E', 'H', [4, 0]), g('F', 'G', [4, 3]), g('H', 'F', [4, 3]), g('G', 'H', [4, 2])];
    expect(order(['E', 'F', 'G', 'H'], ms)).toEqual(['F', 'E', 'G', 'H']);
  });
  it('3 empatados: confronto direto não entra; decide saldo e depois média de games', () => {
    // A ganha de B, B de C, C de A: ciclo. Antes, o confronto virava um mini-campeonato entre os 3 (C, B, A).
    // Pela regra, com 3 ou mais empatados vale o saldo: C (+4), depois A e B com +1, separados pela média de games.
    const ms = [g('A', 'B', [4, 3]), g('B', 'C', [4, 3]), g('C', 'A', [4, 0]), g('A', 'D', [4, 0]), g('B', 'D', [4, 3]), g('C', 'D', [4, 3])];
    const rows = standings(ents(['A', 'B', 'C', 'D']), ms, pair, teamSides);
    expect(rows.map((r) => r.key)).toEqual(['C', 'A', 'B', 'D']);
    expect(rows.find((r) => r.key === 'A')!.sg).toBe(rows.find((r) => r.key === 'B')!.sg);
    expect(rows.map((r) => r.pos)).toEqual([1, 2, 3, 4]);
    // só confronto na lista: com 3 empatados ninguém se separa e dividem a posição
    const onlyH2H = cfg({ ...pair, ranking: { ...pair.ranking, desempate: ['confronto'] } });
    expect(standings(ents(['A', 'B', 'C', 'D']), ms, onlyH2H, teamSides).map((r) => r.pos)).toEqual([1, 1, 1, 4]);
  });
  it('média de games: games feitos ÷ games jogados', () => {
    const c = cfg({ ...pair, ranking: { ...pair.ranking, desempate: ['media_games'] } });
    // X e Y com 1 vitória e 4 games feitos; X sofreu 3 (4/7), Y sofreu 0 (4/4). Z não jogou: 0, sem quebrar.
    const ms = [g('X', 'W', [4, 3]), g('Y', 'V', [4, 0])];
    expect(order(['X', 'Y', 'Z'], ms, c).slice(0, 2)).toEqual(['Y', 'X']);
    expect(order(['Z'], [], c)).toEqual(['Z']);
  });
  it('desempate de torneio salvo continua valendo; critério desconhecido não quebra', () => {
    const ms = [g('A', 'B', [4, 3]), g('B', 'C', [4, 3]), g('C', 'A', [4, 0])];
    const old = cfg({ ...pair, ranking: { ...DEFAULT_CONFIG.ranking } });
    expect(order(['A', 'B', 'C'], ms, old)).toHaveLength(3);
    const weird = cfg({ ...pair, ranking: { ...pair.ranking, desempate: ['futuro' as never, 'saldo'] } });
    expect(order(['A', 'B', 'C'], ms, weird)).toEqual(['C', 'B', 'A']); // saldo: C +3, B 0, A -3
  });
});

describe('sugestões de formato pela lista', () => {
  it('cada sugestão é válida, cabe no tempo pedido e muda com o tempo', () => {
    const ps = mkPlayers(8, 8);
    const base = cfg({ courts: 4, scoring: { type: 'total', games: 6 } });
    const mods = possibleModalities(ps, true);
    expect(mods).toEqual(['mista', 'mesmo_genero']);
    const short = suggestFormats(ps, base, { minutes: 90, modalities: mods });
    const long = suggestFormats(ps, base, { minutes: 240, modalities: mods });
    expect(short.length).toBeGreaterThan(0);
    for (const x of [...short, ...long]) expect(validateSetup(ps, x.config, []).ok).toBe(true);
    expect(short.filter((x) => x.fits).length).toBeGreaterThan(0);
    expect(Math.max(...long.map((x) => x.summary.minGames))).toBeGreaterThan(Math.max(...short.map((x) => x.summary.minGames)));
  });
  it('lista grande e 4 quadras sugere rodízio em 2 grupos quando o tempo deixa', () => {
    const ps = mkPlayers(14, 13);
    const s = suggestFormats(ps, cfg({ courts: 4, scoring: { type: 'total', games: 6 } }), { minutes: 300, modalities: ['mesmo_genero'] });
    expect(s.some((x) => x.config.format === 'rodizio' && x.config.rodizioGroups === 2)).toBe(true);
  });
});

describe('final cruzada do rodízio em 2 grupos', () => {
  /** Joga todos os jogos com placar aleatório (sem empate) e devolve a final gerada. */
  const playAll = (ps: Player[], c: Config, seed: number) => {
    const { matches } = buildInitial(ps, c, seed);
    const rng = mulberry32(seed * 7 + 1);
    const played: Match[] = matches.map((m, i) => {
      const lose = Math.floor(rng() * 3);
      return { ...m, id: `m${i}`, version: 1, sets: [rng() < 0.5 ? [4, lose] : [lose, 4]] as SetScore[] };
    });
    return { played, step: nextStep(ps, [], c, played, 1) };
  };
  const genderOf = (ps: Player[]) => new Map(ps.map((p) => [p.id, p.gender]));

  it('misto: 1º homem do A + 1ª mulher do B contra 1º homem do B + 1ª mulher do A, em todo sorteio', () => {
    for (const [h, mm] of [[7, 7], [8, 6], [14, 13]] as const) {
      const ps = mkPlayers(h, mm);
      const g = genderOf(ps);
      const c = cfg({ modality: 'mista', format: 'rodizio', rodizioGroups: 2, courts: 4, extraGames: true });
      c.rounds = suggestRounds(ps, c);
      expect(validateSetup(ps, c).ok).toBe(true);
      for (let seed = 1; seed <= 40; seed++) {
        const { played, step } = playAll(ps, c, seed);
        expect(step?.title).toBe('Gerar final');
        const [f] = step!.matches;
        expect(step!.matches).toHaveLength(1);
        for (const side of [f.a, f.b]) expect(side.map((id) => g.get(id)).sort()).toEqual(['H', 'M']);
        const [ga, gb] = rankingSections(ps, [], c, played);
        expect([ga.title, gb.title]).toEqual(['Grupo A', 'Grupo B']);
        const first = (rows: typeof ga.rows, x: 'H' | 'M') => rows.find((r) => g.get(r.key) === x)!.key;
        expect(f.a).toEqual([first(ga.rows, 'H'), first(gb.rows, 'M')]);
        expect(f.b).toEqual([first(gb.rows, 'H'), first(ga.rows, 'M')]);
        // a tabela marca exatamente quem joga a final
        expect(ga.finalists).toEqual([f.a[0], f.b[1]]);
        expect(gb.finalists).toEqual([f.b[0], f.a[1]]);
      }
    }
  });

  it('fora do misto continua 1º A + 2º B contra 2º A + 1º B', () => {
    for (const modality of ['mesmo_genero', 'livre'] as const) {
      const ps = modality === 'livre' ? mkPlayers(10, 0).map((p) => ({ ...p, gender: null })) : mkPlayers(10, 10);
      const c = cfg({ modality, format: 'rodizio', rodizioGroups: 2, courts: 4, extraGames: true });
      c.rounds = suggestRounds(ps, c);
      expect(validateSetup(ps, c).ok).toBe(true);
      for (let seed = 1; seed <= 10; seed++) {
        const { played, step } = playAll(ps, c, seed);
        const secs = rankingSections(ps, [], c, played).filter((s) => s.kind === 'grupo');
        for (const f of step!.matches) {
          const [ga, gb] = secs.filter((s) => s.division === f.division);
          expect(f.a).toEqual([ga.rows[0].key, gb.rows[1].key]);
          expect(f.b).toEqual([ga.rows[1].key, gb.rows[0].key]);
          expect(ga.finalists).toEqual([ga.rows[0].key, ga.rows[1].key]);
        }
      }
    }
  });

  it('misto com grupo sem mulher: não gera final nem promete vaga, e o torneio fecha', () => {
    const ps = mkPlayers(6, 2);
    const c = cfg({ modality: 'mista', format: 'rodizio' });
    const mk = (a: string[], b: string[], grp: string, id: string): Match =>
      ({ id, version: 1, stage: 'rodada', round: 1, division: 'all', grp, slot: 0, court: grp === 'A' ? 1 : 2, label: null, a, b, teamA: null, teamB: null, sets: [[4, 1]] });
    const all = [mk(['h0', 'm0'], ['h1', 'm1'], 'A', '1'), mk(['h2', 'h3'], ['h4', 'h5'], 'B', '2')];
    expect(nextStep(ps, [], c, all, 1)).toBeNull();
    const secs = rankingSections(ps, [], c, all);
    expect(secs.map((s) => [s.title, s.qualify, s.finalists])).toEqual([['Grupo A', undefined, undefined], ['Grupo B', undefined, undefined]]);
    expect(tournamentStatus(ps, c, all)).toBe('encerrado');
  });
});

describe('sortear de novo com duplas montadas à mão', () => {
  const pairKeys = (ts: { players: [string, string] }[]) => ts.map((t) => [...t.players].sort().join('+')).sort();

  it('mantém as duplas e só sorteia a tabela de novo', () => {
    const ps = mkPlayers(6, 6);
    const c = cfg({ format: 'duplas', pairing: 'manual', courts: 3 });
    const manual: [string, string][] = ps.slice(0, 6).map((h, i) => [h.id, `m${(i + 2) % 6}`]);
    const first = buildInitial(ps, c, 1, manual);
    const seeds = [2, 3, 4, 5];
    const redraws = seeds.map((seed) => {
      const kp = keptPairs(first.teams, ps, c, seed);
      expect(kp).toMatchObject({ kept: 6, loose: 0 });
      expect(validateSetup(ps, c, kp.manual).ok).toBe(true);
      return buildInitial(ps, c, seed, kp.manual);
    });
    for (const r of redraws) expect(pairKeys(r.teams)).toEqual(pairKeys(first.teams));
    // a tabela muda em pelo menos um dos sorteios (antes, com as mesmas duplas, saía sempre igual)
    const order = (ms: NewMatch[]) => ms.map((m) => [...m.a, ...m.b].join(',')).join('|');
    expect(redraws.some((r) => order(r.matches) !== order(first.matches))).toBe(true);
  });

  it('quem perdeu o parceiro entra no sorteio; o resto das duplas fica', () => {
    const ps = mkPlayers(4, 4);
    const c = cfg({ format: 'grupos', pairing: 'manual', groups: 1, qualify: 2 });
    const manual: [string, string][] = [['h0', 'm0'], ['h1', 'm1'], ['h2', 'm2'], ['h3', 'm3']];
    const { teams } = buildInitial(ps, c, 1, manual);
    // h3 e m0 saíram: as duplas h0+m0 e h3+m3 se desfazem, h0 e m3 viram dupla no sorteio
    const active = ps.filter((p) => p.id !== 'h3' && p.id !== 'm0');
    const kp = keptPairs(teams, active, c, 9);
    expect(kp).toMatchObject({ kept: 2, loose: 2 });
    expect(pairKeys(kp.manual.map((p) => ({ players: p })))).toEqual(['h0+m3', 'h1+m1', 'h2+m2']);
    expect(validateSetup(active, c, kp.manual).ok).toBe(true);
  });

  it('dupla que não fecha mais com a modalidade se desfaz', () => {
    const ps = mkPlayers(2, 2);
    const teams = [{ id: 't1', players: ['h0', 'h1'] as [string, string], division: 'all' }, { id: 't2', players: ['m0', 'm1'] as [string, string], division: 'all' }];
    const kp = keptPairs(teams, ps, cfg({ format: 'duplas', pairing: 'manual', modality: 'mista' }), 3);
    expect(kp).toMatchObject({ kept: 0, loose: 4 });
    for (const [x, y] of kp.manual) expect(x[0]).not.toBe(y[0]);
  });
});

describe('tamanho e tempo antes de criar', () => {
  const lastRound = (ms: NewMatch[]) => Math.max(...ms.map((m) => m.round));

  it('duplas fixas: as rodadas são as da tabela de verdade, encaixada nas quadras', () => {
    for (const [n, courts] of [[8, 2], [10, 2], [6, 3], [12, 4]] as const) {
      const ps = mkPlayers(0, n);
      const c = cfg({ format: 'duplas', modality: 'livre', courts });
      const { matches } = buildInitial(ps, c, 5);
      const s = summarize(ps, c);
      expect(s.matches).toBe(matches.length);
      expect(s.rounds).toBe(lastRound(matches));
    }
  });

  it('grupos + mata-mata: conta as rodadas e os jogos do mata-mata, não só a fase de grupos', () => {
    // 8 duplas, 2 grupos de 4, 2 classificam: 12 jogos de grupo, semifinal (2) e final (1)
    const ps = mkPlayers(0, 16);
    const c = cfg({ format: 'grupos', modality: 'livre', courts: 2, groups: 2, qualify: 2 });
    const { matches } = buildInitial(ps, c, 9);
    const s = summarize(ps, c);
    expect(matches.length).toBe(12);
    expect(s.matches).toBe(12 + 3);
    expect(s.rounds).toBe(lastRound(matches) + 2); // semifinal numa rodada (2 quadras) e final
    expect(s.extra).toBe('12 jogos de grupo + 3 no mata-mata');
    // com 1 quadra, as 2 semifinais ocupam 2 rodadas
    expect(summarize(ps, { ...c, courts: 1 }).rounds).toBe(lastRound(buildInitial(ps, { ...c, courts: 1 }, 9).matches) + 3);
    // 6 classificados: 2 jogos na 1ª fase (o resto passa direto), semifinal e final
    const big = mkPlayers(0, 24);
    const g3 = cfg({ format: 'grupos', modality: 'livre', courts: 4, groups: 3, qualify: 2 });
    expect(summarize(big, g3).matches).toBe(buildInitial(big, g3, 2).matches.length + 5);
  });

  it('rodízio em 2 grupos de uma divisão só: uma final, uma rodada a mais', () => {
    const ps = mkPlayers(0, 12);
    const c = cfg({ modality: 'livre', courts: 2, rodizioGroups: 2, extraGames: false, rounds: 5 });
    expect(validateSetup(ps, c).ok).toBe(true);
    const { matches } = buildInitial(ps, c, 4);
    const s = summarize(ps, c);
    expect(s.matches).toBe(matches.length + 1);
    expect(s.rounds).toBe(lastRound(matches) + 1);
    expect(s.extra).toBe('Inclui a final cruzada');
  });

  it('tempo: rodadas × minutos por partida, a mesma conta na criação e nas sugestões do sorteio', () => {
    const ps = mkPlayers(8, 8);
    const c = cfg({ courts: 2, scoring: { type: 'total', games: 6 }, rounds: 7 });
    expect(matchMinutes(c.scoring)).toBe(26);
    expect(estimateMinutes(ps, c)).toBe(summarize(ps, c).rounds * 26);
    for (const x of suggestFormats(ps, cfg({ courts: 4, scoring: { type: 'total', games: 6 } }), { minutes: 240, modalities: ['mista', 'mesmo_genero'] })) {
      expect(x.minutes).toBe(estimateMinutes(ps, x.config));
    }
  });

  it('duração pra tela, de 5 em 5 minutos', () => {
    expect(durationText(26)).toBe('25 min');
    expect(durationText(60)).toBe('1h');
    expect(durationText(108)).toBe('1h50');
    expect(durationText(182)).toBe('3h');
    expect(durationText(0)).toBe('5 min');
  });
});

describe('partidas desiguais e a média por partida', () => {
  it('mexicano com 9: avisa que o ranking soma games e sugere a média, mesmo com o jogo extra ligado', () => {
    const ps = mkPlayers(0, 9);
    const c = cfg({ format: 'mexicano', modality: 'livre', courts: 2, rounds: 6, extraGames: true, ranking: { ...DEFAULT_CONFIG.ranking, media: false } });
    const s = summarize(ps, c);
    expect(s.minGames).toBeLessThan(s.maxGames);
    const v = validateSetup(ps, c);
    expect(v.ok).toBe(true);
    expect(v.uneven).toMatch(/média por partida/);
    expect(v.uneven).not.toMatch(/jogo extra/);
    expect(v.warnings).toContain(v.uneven);
    // com a média ligada, nada a avisar
    expect(validateSetup(ps, { ...c, ranking: { ...c.ranking, media: true } }).uneven).toBeUndefined();
  });

  it('rodízio: com jogo extra não avisa; sem ele, sugere jogo extra ou média', () => {
    const ps = mkPlayers(0, 9);
    const c = cfg({ modality: 'livre', courts: 2, rounds: 5, ranking: { ...DEFAULT_CONFIG.ranking, media: false } });
    expect(validateSetup(ps, { ...c, extraGames: true }).uneven).toBeUndefined();
    const off = validateSetup(ps, { ...c, extraGames: false });
    expect(summarize(ps, { ...c, extraGames: false })).toMatchObject({ minGames: 4, maxGames: 5 });
    expect(off.uneven).toMatch(/jogo extra/);
  });
});

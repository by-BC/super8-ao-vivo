import { describe, expect, it } from 'vitest';
import {
  AMISTOSO, buildInitial, buildManualMatch, DEFAULT_CONFIG, deletionPlan, individualSides, isAmistoso, isManual, MANUAL_SLOT,
  nextStep, playerCard, playerEntities, podiums, rankingMessage, rankingSections, scheduleMessage, standings, teamEntities, teamSides,
  tournamentStatus, unfinishedMatches, type Config, type Match, type NewMatch, type Player, type SetScore,
} from './index';

function mkPlayers(h: number, m: number): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < h; i++) out.push({ id: `h${i}`, name: `Homem ${i}`, gender: 'H' });
  for (let i = 0; i < m; i++) out.push({ id: `m${i}`, name: `Mulher ${i}`, gender: 'M' });
  return out;
}
const cfg = (over: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...over, ranking: { ...DEFAULT_CONFIG.ranking, ...(over.ranking ?? {}) } });
const toMatches = (ms: NewMatch[], start = 0): Match[] => ms.map((m, i) => ({ ...m, id: `x${start + i}`, version: 0 }));
const scored = (m: Match, s: SetScore): Match => ({ ...m, sets: [s] });
const input = (a: string[], b: string[], counts = true) => ({ a, b, court: 3, label: '', counts });

describe('jogo criado pelo organizador', () => {
  const ps = mkPlayers(4, 4);
  const c = cfg({ format: 'rodizio', courts: 2, rounds: 3 });
  const base = toMatches(buildInitial(ps, c, 5).matches);

  it('rodízio: qualquer 2 contra 2, na rodada que está rolando, depois dos jogos sorteados', () => {
    const plan = buildManualMatch(input(['h0', 'h1'], ['m0', 'm1']), { players: ps, teams: [], config: c, matches: base });
    expect(plan.ok).toBe(true);
    expect(plan.forcedAmistoso).toBeNull();
    const m = plan.match!;
    expect(m).toMatchObject({ stage: 'rodada', round: 1, court: 3, label: 'Jogo extra', a: ['h0', 'h1'], b: ['m0', 'm1'], counts: null, teamA: null });
    expect(m.slot).toBe(MANUAL_SLOT);
    expect(isManual(m)).toBe(true);
    expect(base.some(isManual)).toBe(false);

    // segundo jogo na mesma rodada não bate no slot do primeiro
    const again = buildManualMatch(input(['h2', 'h3'], ['m2', 'm3']), { players: ps, teams: [], config: c, matches: [...base, { ...m, id: 'man1', version: 0 }] });
    expect(again.match!.slot).toBe(MANUAL_SLOT + 1);
  });

  it('vai pra rodada atual: com a 1ª acabada, entra na 2ª', () => {
    const r1done = base.map((m) => (m.round === 1 ? scored(m, [4, 2]) : m));
    const plan = buildManualMatch(input(['h0', 'h1'], ['m0', 'm1']), { players: ps, teams: [], config: c, matches: r1done });
    expect(plan.match!.round).toBe(2);
  });

  it('valida: 2 de cada lado, ninguém dos dois lados, quadra e nome', () => {
    const ctx = { players: ps, teams: [], config: c, matches: base };
    expect(buildManualMatch(input(['h0'], ['m0', 'm1']), ctx).errors[0]).toMatch(/2 jogadores de cada lado/);
    expect(buildManualMatch(input(['h0', 'm0'], ['m0', 'm1']), ctx).errors).toContain('Ninguém pode jogar dos dois lados.');
    expect(buildManualMatch(input(['h0', 'zz'], ['m0', 'm1']), ctx).errors[0]).toMatch(/não está mais/);
    expect(buildManualMatch({ ...input(['h0', 'h1'], ['m0', 'm1']), court: 0 }, ctx).ok).toBe(false);
    expect(buildManualMatch({ ...input(['h0', 'h1'], ['m0', 'm1']), label: 'x'.repeat(31) }, ctx).ok).toBe(false);
    expect(buildManualMatch({ ...input(['h0', 'h1'], ['m0', 'm1']), label: '  Desafio  ' }, ctx).match!.label).toBe('Desafio');
    // jogador que saiu não entra
    const left = ps.map((p) => (p.id === 'h0' ? { ...p, left: true } : p));
    expect(buildManualMatch(input(['h0', 'h1'], ['m0', 'm1']), { ...ctx, players: left }).ok).toBe(false);
  });

  it('"Vale pro ranking" desligado vira amistoso pelo campo counts', () => {
    const plan = buildManualMatch(input(['h0', 'h1'], ['m0', 'm1'], false), { players: ps, teams: [], config: c, matches: base });
    expect(plan.match!.counts).toEqual([AMISTOSO]);
    expect(isAmistoso(plan.match!)).toBe(true);
  });

  it('amistoso não conta no ranking individual nem no de duplas; o jogo que vale conta', () => {
    const vale = { ...buildManualMatch(input(['h0', 'h1'], ['m0', 'm1']), { players: ps, teams: [], config: c, matches: base }).match!, id: 'v', version: 1, sets: [[4, 0]] as SetScore[] };
    const amis = { ...vale, id: 'a', counts: [AMISTOSO] };
    const ind = (ms: Match[]) => standings(playerEntities(ps), ms, c, individualSides).find((r) => r.key === 'h0')!;
    expect(ind([amis]).j).toBe(0);
    expect(ind([vale])).toMatchObject({ j: 1, gf: 4, v: 1 });

    const team = [{ id: 't1', players: ['h0', 'h1'] as [string, string], division: 'all' }, { id: 't2', players: ['m0', 'm1'] as [string, string], division: 'all' }];
    const tm = { ...amis, teamA: 't1', teamB: 't2' };
    expect(standings(teamEntities(team, ps), [tm], c, teamSides).find((r) => r.key === 't1')!.j).toBe(0);
  });
});

describe('jogo extra nos formatos de dupla', () => {
  const ps = mkPlayers(8, 8);

  it('duplas fixas: duas duplas do torneio valem pra tabela; dupla avulsa vira amistoso', () => {
    const c = cfg({ format: 'duplas', courts: 2 });
    const { teams, matches } = buildInitial(ps, c, 9);
    const ms = toMatches(matches);
    const [t1, t2] = teams;
    const ok = buildManualMatch(input([...t1.players], [...t2.players]), { players: ps, teams, config: c, matches: ms });
    expect(ok.forcedAmistoso).toBeNull();
    expect(ok.match).toMatchObject({ teamA: t1.id, teamB: t2.id, counts: null });

    const all = [...ms, { ...ok.match!, id: 'extra', version: 1, sets: [[4, 1]] as SetScore[] }];
    const row = rankingSections(ps, teams, c, all)[0].rows.find((r) => r.key === t1.id)!;
    expect(row.j).toBe(1);

    const loose = buildManualMatch(input([t1.players[0], t2.players[0]], [t1.players[1], t2.players[1]]), { players: ps, teams, config: c, matches: ms });
    expect(loose.forcedAmistoso).toMatch(/avulsa/);
    expect(isAmistoso(loose.match!)).toBe(true);
  });

  it('grupos: jogo extra entre duplas do mesmo grupo conta na tabela do grupo; de grupos diferentes vira amistoso', () => {
    const c = cfg({ format: 'grupos', groups: 2, qualify: 2, courts: 3 });
    const { teams, matches } = buildInitial(ps, c, 11);
    const ms = toMatches(matches);
    const [x, y] = teams.filter((t) => t.group === 'A');
    const z = teams.find((t) => t.group === 'B')!;
    const same = buildManualMatch(input([...x.players], [...y.players]), { players: ps, teams, config: c, matches: ms });
    expect(same.match).toMatchObject({ stage: 'rodada', grp: 'A', teamA: x.id, teamB: y.id, counts: null });
    const all = [...ms, { ...same.match!, id: 'extra', version: 1, sets: [[4, 1]] as SetScore[] }];
    const sec = rankingSections(ps, teams, c, all).find((s) => s.id.endsWith('-A'))!;
    expect(sec.rows.find((r) => r.key === x.id)!.j).toBe(1);

    const cross = buildManualMatch(input([...x.players], [...z.players]), { players: ps, teams, config: c, matches: ms });
    expect(cross.forcedAmistoso).toMatch(/grupos diferentes/);
    expect(cross.match!.grp).toBeNull();

    // jogo extra que vale e ainda não acabou segura o mata-mata (mexe na classificação)
    const groupDone = ms.map((m) => scored(m, [3, 1]));
    const pendingExtra = [...groupDone, { ...same.match!, id: 'extra', version: 0 }];
    expect(nextStep(ps, teams, c, pendingExtra, 1)).toBeNull();
    const pendingFriendly = [...groupDone, { ...same.match!, id: 'extra', version: 0, counts: [AMISTOSO] }];
    expect(nextStep(ps, teams, c, pendingFriendly, 1)?.title).toBe('Gerar mata-mata');
  });

  it('mesmo gênero: jogadores de chaves diferentes não valem pra tabela nenhuma', () => {
    const c = cfg({ modality: 'mesmo_genero', format: 'rodizio', courts: 2, rounds: 2 });
    const { matches } = buildInitial(ps, c, 2);
    const plan = buildManualMatch(input(['h0', 'h1'], ['m0', 'm1']), { players: ps, teams: [], config: c, matches: toMatches(matches) });
    expect(plan.forcedAmistoso).toMatch(/chaves diferentes/);
    expect(plan.match!.division).toBe('H');
  });
});

describe('mexicano com jogo extra', () => {
  const ps = mkPlayers(8, 0);
  const c = cfg({ modality: 'livre', format: 'mexicano', courts: 2, rounds: 3 });
  const r1 = toMatches(buildInitial(ps, c, 3).matches).map((m, i) => scored(m, i === 0 ? [4, 0] : [3, 1]));

  it('amistoso pendente não segura a próxima rodada nem mexe na ordem', () => {
    const friendly = { ...buildManualMatch(input(['h0', 'h1'], ['h2', 'h3'], false), { players: ps, teams: [], config: c, matches: r1 }).match!, id: 'f', version: 0 };
    expect(friendly.round).toBe(1);
    const withPending = nextStep(ps, [], c, [...r1, friendly], 2);
    expect(withPending?.title).toBe('Gerar rodada 2');
    // placar do amistoso não muda quem joga com quem
    const withScore = nextStep(ps, [], c, [...r1, { ...friendly, sets: [[0, 9]] }], 2)!;
    expect(withScore.matches.map((m) => [m.a, m.b])).toEqual(nextStep(ps, [], c, r1, 2)!.matches.map((m) => [m.a, m.b]));
  });

  it('jogo extra que vale segura a próxima rodada até acabar', () => {
    const extra = { ...buildManualMatch(input(['h0', 'h1'], ['h2', 'h3']), { players: ps, teams: [], config: c, matches: r1 }).match!, id: 'e', version: 0 };
    expect(nextStep(ps, [], c, [...r1, extra], 2)).toBeNull();
    expect(nextStep(ps, [], c, [...r1, scored(extra, [4, 2])], 2)?.title).toBe('Gerar rodada 2');
  });
});

describe('excluir jogo', () => {
  it('rodada: sai só ele, e diz se tinha placar', () => {
    const ms: Match[] = toMatches(buildInitial(mkPlayers(4, 4), cfg({ courts: 2, rounds: 2 }), 1).matches);
    expect(deletionPlan(ms, ms[0].id)).toMatchObject({ ok: true, ids: [ms[0].id], scored: 0 });
    const withScore = [scored(ms[0], [2, 1]), ...ms.slice(1)];
    expect(deletionPlan(withScore, ms[0].id).scored).toBe(1);
    expect(deletionPlan(ms, 'nada').ok).toBe(false);
  });

  it('mata-mata: só a última fase da chave, e ela sai inteira pra ser gerada de novo', () => {
    const ps = mkPlayers(8, 8);
    const c = cfg({ format: 'grupos', groups: 2, qualify: 2, courts: 3 });
    const { teams, matches } = buildInitial(ps, c, 11);
    let all = toMatches(matches).map((m) => scored(m, m.teamA! < m.teamB! ? [3, 1] : [1, 3]));
    const semis = toMatches(nextStep(ps, teams, c, all, 1)!.matches, 100).map((m) => scored(m, [3, 1]));
    all = [...all, ...semis];
    const final = toMatches(nextStep(ps, teams, c, all, 1)!.matches, 200);
    all = [...all, ...final];

    const blocked = deletionPlan(all, semis[0].id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/Final/);

    const fin = deletionPlan(all, final[0].id);
    expect(fin).toMatchObject({ ok: true, ids: [final[0].id], scored: 0 });
    const rest = all.filter((m) => !fin.ids.includes(m.id));
    // sem a final, o botão volta e monta a mesma final
    expect(nextStep(ps, teams, c, rest, 1)?.matches[0].label).toBe('Final');

    const semi = deletionPlan(rest, semis[1].id);
    expect(semi.ids.sort()).toEqual(semis.map((m) => m.id).sort());
    expect(semi.scored).toBe(2);
    expect(semi.scope).toBe('Semifinal (2 jogos)');
  });
});

describe('encerrar o torneio na mão', () => {
  const ps = mkPlayers(4, 4);
  const c = cfg({ format: 'rodizio', courts: 2, rounds: 3 });
  const ms = toMatches(buildInitial(ps, c, 5).matches);
  const half = ms.map((m) => (m.round === 1 ? scored(m, [4, 2]) : m));

  it('fica encerrado mesmo com jogo pendente; sem a marca, a conta decide', () => {
    expect(tournamentStatus(ps, c, half)).toBe('andamento');
    expect(tournamentStatus(ps, c, half, true)).toBe('encerrado');
  });

  it('só conta o que terminou: os pendentes ficam de fora, amistoso nem entra na conta', () => {
    const friendly: Match = { ...half[0], id: 'f', slot: MANUAL_SLOT, sets: [], counts: [AMISTOSO] };
    const left = unfinishedMatches([...half, friendly], c);
    expect(left).toHaveLength(ms.filter((m) => m.round > 1).length);
    expect(left.some(isAmistoso)).toBe(false);
    const rows = rankingSections(ps, [], c, half)[0].rows;
    expect(rows.reduce((n, r) => n + r.j, 0)).toBe(4 * half.filter((m) => m.round === 1).length);
  });

  it('pódio, cartinha e mensagem saem com o que foi jogado', () => {
    expect(podiums(ps, [], c, half)).toHaveLength(0);
    const pods = podiums(ps, [], c, half, true);
    expect(pods).toHaveLength(1);
    const champ = rankingSections(ps, [], c, half)[0].rows[0];
    expect(playerCard(ps, [], c, half, champ.key, true)?.tag).toMatch(/CAMPE/);
    const ctx = { name: 'Play', link: 'x', code: 'ABCDEF', players: ps, teams: [], config: c, matches: half, closed: true };
    const done = half.filter((m) => m.sets.length).length;
    const out = half.length - done;
    expect(rankingMessage(ctx)).toContain(`Resultado final · ${done} jogos · ${out} não jogados`);
    expect(scheduleMessage(ctx)).toContain('(não jogado)');
  });
});

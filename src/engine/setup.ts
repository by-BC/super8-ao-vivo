import { knockoutChampion, knockoutNext, knockoutStart } from './knockout';
import { mexicanoRound, nextMexicano } from './mexicano';
import { mulberry32, type Rng } from './rng';
import { assignGroups, capacity, divisionsOf, formTeams, matchesPerRound, plannedExtras, rodizioMatches, rodizioUnits, splitGroups, teamRoundRobin, type Unit } from './schedule';
import { evaluate } from './scoring';
import { individualSides, playerEntities, standings, teamEntities, teamSides, type Row } from './standings';
import { isIndividual, MAX_PLAYERS, type Config, type Match, type NewMatch, type Player, type Team } from './types';

export type SetupArea = 'jogadores' | 'formato' | 'regras';

export interface SetupCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** cada erro com a etapa da tela onde ele se resolve */
  issues: { text: string; area: SetupArea }[];
}

const countG = (ps: Player[], g: 'H' | 'M') => ps.filter((p) => p.gender === g).length;

export function validateSetup(players: Player[], config: Config, manual?: [string, string][]): SetupCheck {
  const issues: { text: string; area: SetupArea }[] = [];
  const warnings: string[] = [];
  const fail = (area: SetupArea, text: string) => issues.push({ text, area });
  const names = players.map((p) => p.name.trim());

  if (players.length < 4) fail('jogadores', 'Precisa de pelo menos 4 jogadores.');
  if (players.length > MAX_PLAYERS) fail('jogadores', `O máximo é ${MAX_PLAYERS} jogadores.`);
  if (names.some((n) => !n)) fail('jogadores', 'Tem nome em branco. Preencha ou remova a linha.');
  if (names.some((n) => n.length > 40)) fail('jogadores', 'Nome muito longo: use até 40 letras.');
  const lower = names.map((n) => n.toLocaleLowerCase('pt-BR'));
  const dup = lower.filter((n, i) => n && lower.indexOf(n) !== i);
  if (dup.length) fail('jogadores', `Nome repetido: ${[...new Set(dup)].join(', ')}. Use apelido ou sobrenome para diferenciar.`);

  const noGender = players.filter((p) => !p.gender).map((p) => p.name || 'sem nome');
  if (noGender.length && config.modality !== 'livre') fail('jogadores', `Marque H ou M para: ${noGender.slice(0, 6).join(', ')}${noGender.length > 6 ? '…' : ''}.`);
  if (noGender.length && config.modality === 'livre' && config.ranking.separarGenero && isIndividual(config.format)) {
    warnings.push('O ranking por gênero deixa de fora quem está sem H ou M.');
  }

  if (config.courts < 1 || config.courts > 30) fail('formato', 'Número de quadras inválido.');
  const s = config.scoring;
  if (s.games < 1 || s.games > 30) fail('regras', 'Número de games inválido.');
  if ((s.type === 'set' || s.type === 'melhor3') && (s.games < 3 || s.games > 9)) fail('regras', 'O set precisa ter entre 3 e 9 games.');

  const divs = divisionsOf(players, config.modality);
  const mixed = config.modality === 'mista';

  if (isIndividual(config.format)) {
    if (config.rounds < 1 || config.rounds > 60) fail('formato', 'Escolha entre 1 e 60 rodadas.');
    for (const d of divs) {
      const where = divs.length > 1 ? ` no ${d.label}` : '';
      if (mixed && (countG(d.players, 'H') < 2 || countG(d.players, 'M') < 2)) fail('jogadores', 'O misto precisa de pelo menos 2 homens e 2 mulheres.');
      else if (!mixed && d.players.length < 4) fail('jogadores', `Precisa de pelo menos 4 jogadores${where}.`);
    }
    if (config.format === 'rodizio' && config.rodizioGroups === 2) {
      for (const d of divs) {
        const where = divs.length > 1 ? ` no ${d.label}` : '';
        const small = splitGroups(d, mixed, null).some((g) => (mixed ? countG(g, 'H') < 2 || countG(g, 'M') < 2 : g.length < 4));
        if (small) fail('formato', `Com 2 grupos${where}, cada grupo precisa de pelo menos ${mixed ? '2 homens e 2 mulheres' : '4 jogadores'}. Junte num grupo só ou chame mais gente.`);
      }
    }
    const units = individualUnits(players, config);
    const idle = units.filter((u) => u.m === 0 && capacity(u.div, mixed) > 0);
    if (idle.length && !issues.length) {
      fail('formato', units.length > 1
        ? `São ${units.length} ${config.rodizioGroups === 2 ? 'grupos' : 'chaves'} jogando ao mesmo tempo: precisa de pelo menos ${units.length} quadras.`
        : 'Precisa de pelo menos 1 quadra.');
    }
    if (mixed && config.rodizioGroups !== 2) {
      const h = countG(players, 'H');
      const m = countG(players, 'M');
      if (h !== m && h >= 2 && m >= 2) warnings.push(`São ${h} homens e ${m} mulheres: ${h > m ? 'os homens folgam' : 'as mulheres folgam'} um pouco mais.`);
    }
    if (!issues.length && !config.extraGames && !config.ranking.media) {
      const sm = summarize(players, config);
      if (sm.minGames !== sm.maxGames) warnings.push(`Tem gente com ${sm.minGames} e gente com ${sm.maxGames} partidas: ligue o jogo extra ou a média por partida pro ranking ficar justo.`);
    }
  } else {
    for (const d of divs) {
      const where = divs.length > 1 ? ` no ${d.label}` : '';
      if (mixed) {
        const h = countG(d.players, 'H');
        const m = countG(d.players, 'M');
        if (h !== m) fail('formato', `Duplas fixas mistas precisam do mesmo número de homens e mulheres (agora ${h} H e ${m} M). Use rodízio ou mexicano, ou ajuste a lista.`);
      } else if (d.players.length % 2) fail('formato', `Número ímpar de jogadores${where}: sobra um sem dupla.`);
      const teams = Math.floor(d.players.length / 2);
      if (config.format === 'duplas' && teams < 2) fail('formato', `Precisa de pelo menos 2 duplas${where}.`);
      if (config.format === 'grupos') {
        const g = Math.min(config.groups, Math.floor(teams / 2));
        if (teams < 3) fail('formato', `Grupos + mata-mata precisa de pelo menos 3 duplas${where}.`);
        else if (config.groups < 1) fail('formato', 'Escolha pelo menos 1 grupo.');
        else {
          const smallest = Math.floor(teams / g);
          if (config.qualify < 1 || config.qualify > smallest) fail('formato', `Classificados por grupo deve ficar entre 1 e ${smallest}${where}.`);
          else if (config.qualify * g < 2) fail('formato', `Precisa de pelo menos 2 classificados para o mata-mata${where}.`);
          if (g < config.groups) warnings.push(`Com ${teams} duplas${where}, cabem no máximo ${g} grupos.`);
        }
      }
    }
    if (config.pairing === 'manual') {
      const used = new Set<string>();
      const all = new Set(players.map((p) => p.id));
      const g = new Map(players.map((p) => [p.id, p.gender]));
      let bad = false;
      for (const [x, y] of manual ?? []) {
        if (!all.has(x) || !all.has(y) || x === y || used.has(x) || used.has(y)) bad = true;
        if (mixed && g.get(x) === g.get(y)) bad = true;
        if (config.modality === 'mesmo_genero' && g.get(x) !== g.get(y)) bad = true;
        used.add(x);
        used.add(y);
      }
      if (bad) fail('formato', 'Tem dupla montada errada: confira se cada pessoa está em uma dupla só e se as duplas seguem a modalidade.');
      else if (used.size !== players.length) fail('formato', `Faltam ${players.length - used.size} jogadores sem dupla na montagem manual.`);
    }
  }
  return { ok: issues.length === 0, errors: issues.map((i) => i.text), warnings, issues };
}

/** Divisões (ou grupos do rodízio) que rodam separado, cada uma com suas quadras. */
export function individualUnits(players: Player[], config: Config): Unit[] {
  if (config.format === 'rodizio') return rodizioUnits(players, config, null);
  return matchesPerRound(players, config).map(({ div, m }) => ({ div, grp: null, m }));
}

/** Sugestão de rodadas para o rodízio: cada um joga ~ com todos os parceiros possíveis, até 7 partidas. */
export function suggestRounds(players: Player[], config: Config): number {
  const mixed = config.modality === 'mista';
  let best = 1;
  for (const { div, m } of individualUnits(players, config)) {
    if (!m) continue;
    const n = div.players.length;
    const partners = mixed ? Math.max(countG(div.players, 'H'), countG(div.players, 'M')) : n - 1;
    const target = Math.min(partners, 7);
    best = Math.max(best, Math.ceil((target * n) / (4 * m)));
  }
  best = Math.min(best, 60);
  if (config.format !== 'rodizio' || !config.extraGames) return best;
  // com jogo extra, prefere um número de rodadas perto da sugestão que precise de menos extras
  // (e, de preferência, só extras que valem pros 4)
  let pick = best;
  let pickScore = Infinity;
  for (let r = Math.max(1, best - 2); r <= Math.min(60, best + 2); r++) {
    const ex = plannedExtras(players, { ...config, rounds: r });
    const score = ex.length * 10 + ex.filter((x) => x.counts?.length).length * 15 + Math.abs(r - best) * 6 + (r < best ? 2 : 0);
    if (score < pickScore) { pick = r; pickScore = score; }
  }
  return pick;
}

export interface Summary {
  rounds: number;
  matches: number;
  minGames: number;
  maxGames: number;
  extra?: string;
}

/** Tamanho do torneio para mostrar antes de criar. */
export function summarize(players: Player[], config: Config): Summary {
  const mixed = config.modality === 'mista';
  if (isIndividual(config.format)) {
    let matches = 0;
    let minG = Infinity;
    let maxG = 0;
    const extras = plannedExtras(players, config);
    for (const { div, m } of individualUnits(players, config)) {
      matches += m * config.rounds;
      const groups = mixed ? [countG(div.players, 'H'), countG(div.players, 'M')] : [div.players.length];
      for (const n of groups) {
        if (!n) continue;
        const slots = (mixed ? 2 : 4) * m * config.rounds;
        // com jogo extra, quem ficou devendo sobe pro máximo do grupo
        minG = Math.min(minG, extras.length ? Math.ceil(slots / n) : Math.floor(slots / n));
        maxG = Math.max(maxG, Math.ceil(slots / n));
      }
    }
    const extraRounds = extras.length ? Math.max(...extras.map((x) => x.round)) - config.rounds : 0;
    return {
      rounds: config.rounds + extraRounds,
      matches: matches + extras.length,
      minGames: minG === Infinity ? 0 : minG,
      maxGames: maxG,
      extra: extras.length ? `${extras.length} ${extras.length === 1 ? 'é jogo extra' : 'são jogos extras'} no fim, pra igualar as partidas` : undefined,
    };
  }
  let matches = 0;
  let ko = 0;
  let minG = Infinity;
  let maxG = 0;
  for (const div of divisionsOf(players, config.modality)) {
    const teams = mixed ? Math.min(countG(div.players, 'H'), countG(div.players, 'M')) : Math.floor(div.players.length / 2);
    if (config.format === 'duplas') {
      matches += (teams * (teams - 1)) / 2;
      minG = Math.min(minG, teams - 1);
      maxG = Math.max(maxG, teams - 1);
    } else {
      const g = Math.max(1, Math.min(config.groups, Math.floor(teams / 2)));
      for (let i = 0; i < g; i++) {
        const size = Math.floor(teams / g) + (i < teams % g ? 1 : 0);
        matches += (size * (size - 1)) / 2;
        minG = Math.min(minG, size - 1);
        maxG = Math.max(maxG, size - 1);
      }
      ko += Math.max(0, Math.min(teams, config.qualify * g) - 1);
    }
  }
  const rounds = Math.ceil(matches / Math.max(1, config.courts));
  return {
    rounds,
    matches: matches + ko,
    minGames: minG === Infinity ? 0 : minG,
    maxGames: maxG,
    extra: ko ? `${matches} jogos de grupo + ${ko} no mata-mata` : undefined,
  };
}

export interface Built {
  teams: Team[];
  matches: NewMatch[];
}

/** Sorteia e monta a chave inicial do torneio. */
export function buildInitial(players: Player[], config: Config, seed: number, manual?: [string, string][]): Built {
  const rng: Rng = mulberry32(seed);
  switch (config.format) {
    case 'rodizio':
      return { teams: [], matches: rodizioMatches(players, config, rng) };
    case 'mexicano':
      return { teams: [], matches: mexicanoRound(1, players, config, [], rng) };
    case 'duplas': {
      const teams = formTeams(players, config, rng, manual);
      return { teams, matches: teamRoundRobin(teams, 'rodada', config.courts) };
    }
    case 'grupos': {
      const teams = assignGroups(formTeams(players, config, rng, manual), config.groups, players, config, rng);
      return { teams, matches: teamRoundRobin(teams, 'grupo', config.courts) };
    }
  }
}

/**
 * Jogos que contam para um grupo do rodízio: os do próprio grupo e os jogos entre grupos (sem grupo marcado)
 * em que alguém do grupo joga. No jogo entre grupos, cada jogador pontua só no ranking do seu grupo.
 */
export function groupScope(ms: Match[], g: string): { ids: Set<string>; matches: Match[] } {
  const own = ms.filter((m) => m.grp === g);
  const ids = new Set(own.flatMap((m) => [...m.a, ...m.b]));
  const cross = ms.filter((m) => !m.grp && [...m.a, ...m.b].some((id) => ids.has(id)));
  return { ids, matches: [...own, ...cross] };
}

/**
 * Rodízio dividido em 2 grupos: quando os jogos de grupo da divisão acabam, a final é cruzada:
 * 1º do A + 2º do B contra 2º do A + 1º do B. Quem vence é campeão.
 */
export function groupFinals(players: Player[], config: Config, matches: Match[]): NewMatch[] {
  const out: NewMatch[] = [];
  for (const div of divisionsOf(players, config.modality)) {
    const ms = matches.filter((m) => m.division === div.id && m.stage === 'rodada');
    const grps = [...new Set(ms.map((m) => m.grp).filter((g): g is string => !!g))].sort();
    if (grps.length !== 2) continue;
    if (matches.some((m) => m.division === div.id && m.stage === 'mata')) continue;
    if (ms.some((m) => !evaluate(m.sets, config.scoring).done)) continue;
    const [ta, tb] = grps.map((g) => {
      const { ids, matches: gm } = groupScope(ms, g);
      return standings(playerEntities(div.players.filter((p) => ids.has(p.id))), gm, config, individualSides).slice(0, 2).map((r) => r.key);
    });
    if (ta.length < 2 || tb.length < 2) continue;
    // Final na primeira quadra que a divisão já usava (feminino e masculino não caem na mesma quadra).
    const court = Math.min(...ms.map((m) => m.court));
    out.push({ stage: 'mata', round: 1, division: div.id, grp: null, slot: 0, court, label: 'Final', a: [ta[0], tb[1]], b: [ta[1], tb[0]], teamA: null, teamB: null, sets: [] });
  }
  return out;
}

/** Divisões do rodízio que estão em 2 grupos e, por isso, terminam numa final. */
export function divisionsWithFinal(players: Player[], config: Config, matches: Match[]): string[] {
  if (!isIndividual(config.format)) return [];
  return divisionsOf(players, config.modality)
    .filter((d) => new Set(matches.filter((m) => m.division === d.id && m.stage === 'rodada' && m.grp).map((m) => m.grp)).size === 2)
    .map((d) => d.id);
}

/** Jogadores campeões da final da divisão (rodízio em grupos), se a final já acabou. */
export function finalWinners(division: string, config: Config, matches: Match[]): string[] | null {
  const f = matches.find((m) => m.division === division && m.stage === 'mata' && m.label === 'Final' && !m.teamA);
  if (!f) return null;
  const r = evaluate(f.sets, config.scoring, true);
  return r.done ? (r.winner === 'a' ? f.a : f.b) : null;
}

export interface NextStep {
  title: string;
  matches: NewMatch[];
}

/** O que dá para gerar agora: próxima rodada do mexicano ou próxima fase do mata-mata. */
export function nextStep(players: Player[], teams: Team[], config: Config, matches: Match[], seed: number): NextStep | null {
  const rng = mulberry32(seed);
  if (isIndividual(config.format)) {
    const finals = groupFinals(players, config, matches);
    if (finals.length) return { title: 'Gerar final', matches: finals };
  }
  if (config.format === 'mexicano') {
    const ms = nextMexicano(players, config, matches, rng);
    if (!ms || !ms.length) return null;
    return { title: `Gerar rodada ${ms[0].round}`, matches: ms };
  }
  if (config.format === 'grupos') {
    const out: NewMatch[] = [];
    let starting = false;
    for (const div of divisionsOf(players, config.modality)) {
      const hasKo = matches.some((m) => m.stage === 'mata' && m.division === div.id);
      const ms = hasKo ? knockoutNext(div.id, teams, matches, config) : knockoutStart(div.id, teams, players, matches, config);
      if (ms?.length) { out.push(...ms); if (!hasKo) starting = true; }
    }
    if (!out.length) return null;
    return { title: starting ? 'Gerar mata-mata' : `Gerar ${out[0].label?.replace(/ \d+$/, '').toLowerCase() ?? 'próxima fase'}`, matches: out };
  }
  return null;
}

export type Status = 'andamento' | 'encerrado';

export function tournamentStatus(players: Player[], config: Config, matches: Match[]): Status {
  const allDone = matches.length > 0 && matches.every((m) => evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done);
  if (!allDone) return 'andamento';
  if (config.format === 'mexicano') {
    const last = Math.max(0, ...matches.map((m) => m.round));
    return last >= config.rounds ? 'encerrado' : 'andamento';
  }
  if (config.format === 'grupos') {
    return divisionsOf(players, config.modality).every((d) => knockoutChampion(d.id, matches, config)) ? 'encerrado' : 'andamento';
  }
  if (divisionsWithFinal(players, config, matches).some((d) => !finalWinners(d, config, matches))) return 'andamento';
  return 'encerrado';
}

export interface RankingSection {
  id: string;
  title: string;
  kind: 'geral' | 'genero' | 'grupo';
  division: string;
  rows: Row[];
  /** Quantos se classificam (grupos). */
  qualify?: number;
}

/** Tabelas de classificação a mostrar, conforme formato e modalidade. */
export function rankingSections(players: Player[], teams: Team[], config: Config, matches: Match[]): RankingSection[] {
  const divs = divisionsOf(players, config.modality);
  const out: RankingSection[] = [];
  for (const div of divs) {
    const prefix = divs.length > 1 ? div.label : '';
    if (isIndividual(config.format)) {
      const ms = matches.filter((m) => m.division === div.id && m.stage === 'rodada');
      const grps = [...new Set(ms.map((m) => m.grp).filter((g): g is string => !!g))].sort();
      if (grps.length > 1) {
        // rodízio dividido em grupos: cada grupo tem o seu ranking
        for (const g of grps) {
          const { ids, matches: gm } = groupScope(ms, g);
          out.push({
            id: `${div.id}-${g}`, title: `${prefix ? prefix + ' · ' : ''}Grupo ${g}`, kind: 'grupo', division: div.id,
            rows: standings(playerEntities(div.players.filter((p) => ids.has(p.id))), gm, config, individualSides),
            qualify: grps.length === 2 ? 2 : undefined,
          });
        }
        continue;
      }
      out.push({ id: `${div.id}-geral`, title: prefix || 'Geral', kind: 'geral', division: div.id, rows: standings(playerEntities(div.players), ms, config, individualSides) });
      const hasBoth = countG(div.players, 'H') > 0 && countG(div.players, 'M') > 0;
      if (config.ranking.separarGenero && config.modality !== 'mesmo_genero' && hasBoth) {
        for (const g of ['H', 'M'] as const) {
          const ps = div.players.filter((p) => p.gender === g);
          out.push({ id: `${div.id}-${g}`, title: g === 'H' ? 'Homens' : 'Mulheres', kind: 'genero', division: div.id, rows: standings(playerEntities(ps), ms, config, individualSides) });
        }
      }
    } else if (config.format === 'duplas') {
      const ts = teams.filter((t) => t.division === div.id);
      const ms = matches.filter((m) => m.division === div.id && m.stage === 'rodada');
      out.push({ id: `${div.id}-geral`, title: prefix || 'Geral', kind: 'geral', division: div.id, rows: standings(teamEntities(ts, players), ms, config, teamSides) });
    } else {
      const groups = [...new Set(teams.filter((t) => t.division === div.id).map((t) => t.group ?? ''))].sort();
      for (const g of groups) {
        const ts = teams.filter((t) => t.division === div.id && (t.group ?? '') === g);
        const ms = matches.filter((m) => m.stage === 'grupo' && m.division === div.id && (m.grp ?? '') === g);
        out.push({
          id: `${div.id}-${g}`, title: `${prefix ? prefix + ' · ' : ''}Grupo ${g}`, kind: 'grupo', division: div.id,
          rows: standings(teamEntities(ts, players), ms, config, teamSides), qualify: config.qualify,
        });
      }
    }
  }
  return out;
}

export { capacity, divisionsOf };

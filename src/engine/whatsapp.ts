import { knockoutChampion } from './knockout';
import { divisionsOf, divisionsWithFinal, finalWinners, rankingSections, tournamentStatus } from './setup';
import { evaluate, formatScore } from './scoring';
import type { Row } from './standings';
import type { Config, Match, Player, Team } from './types';

const KEYCAP = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const posIcon = (pos: number) => (pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : KEYCAP[pos] ?? `${pos}º`);

interface Ctx {
  name: string;
  link: string;
  code: string;
  players: Player[];
  teams: Team[];
  config: Config;
  matches: Match[];
}

function namer(players: Player[]) {
  const byId = new Map(players.map((p) => [p.id, p.name]));
  return (ids: string[]) => ids.map((id) => byId.get(id) ?? '?').join(' e ');
}

function ptsText(r: Row, config: Config): string {
  if (config.ranking.media) return `${r.main.toFixed(1).replace('.', ',')} por jogo`;
  return `${r.main} ${r.main === 1 ? 'pt' : 'pts'}`;
}

/** Mensagem do ranking para colar no grupo (negrito e itálico do WhatsApp). */
export function rankingMessage(ctx: Ctx): string {
  const { config, matches } = ctx;
  const nm = namer(ctx.players);
  const real = matches.filter((m) => !(m.stage === 'mata' && m.b.length === 0));
  const done = real.filter((m) => evaluate(m.sets, config.scoring, m.stage === 'mata').done).length;
  const fin = tournamentStatus(ctx.players, config, matches) === 'encerrado';
  const L: string[] = [`🎾 *${ctx.name.toUpperCase()}* 🎾`];
  L.push(fin ? `🏁 _Resultado final · ${real.length} jogos_` : `📊 _Ranking parcial · ${done} de ${real.length} jogos_`, '');

  if (config.format === 'grupos') {
    for (const div of divisionsOf(ctx.players, config.modality)) {
      const champ = knockoutChampion(div.id, matches, config);
      const team = ctx.teams.find((t) => t.id === champ);
      if (team) L.push(`🏆 Campeões${div.id === 'all' ? '' : ` ${div.label.toLowerCase()}`}: *${nm(team.players)}*`);
    }
    if (L[L.length - 1] !== '') L.push('');
  }

  const withFinal = divisionsWithFinal(ctx.players, config, matches);
  for (const d of withFinal) {
    const w = finalWinners(d, config, matches);
    const label = divisionsOf(ctx.players, config.modality).find((x) => x.id === d)?.label ?? '';
    if (w) L.push(`🏆 Campeões${d === 'all' ? '' : ` ${label.toLowerCase()}`}: *${nm(w)}*`);
  }
  if (withFinal.some((d) => finalWinners(d, config, matches))) L.push('');

  const sections = rankingSections(ctx.players, ctx.teams, config, matches);
  const many = sections.length > 1;
  for (const s of sections) {
    if (many) L.push(`*${s.kind === 'genero' ? (s.title === 'Homens' ? '👑 Rei da areia' : '👑 Rainha da areia') : s.title}*`);
    const anyPlayed = s.rows.some((r) => r.j > 0);
    const rows = s.kind === 'genero' ? s.rows.slice(0, 3) : s.rows;
    for (const r of rows) {
      L.push(`${anyPlayed ? posIcon(r.pos) : '▫️'} *${r.label}* · *${ptsText(r, config)}*`);
      if (s.kind !== 'genero') L.push(`      ${r.v}V · ${r.e}E · ${r.d}D · ${r.j} ${r.j === 1 ? 'jogo' : 'jogos'}`);
    }
    L.push('');
  }

  if (!fin) {
    const pending = matches.filter((m) => !evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done);
    if (pending.length) {
      const first = pending[0];
      const next = pending.filter((m) => m.stage === first.stage && m.round === first.round);
      L.push(first.stage === 'mata' ? `⏭️ *${first.label?.replace(/ \d+$/, '') ?? 'Mata-mata'}*` : `⏭️ *Rodada ${first.round}*`);
      for (const m of next) {
        const live = m.sets.length ? ` _(${formatScore(m.sets, config.scoring)} rolando)_` : '';
        L.push(`🎾 Quadra ${m.court}: ${nm(m.a)} x ${nm(m.b)}${live}`);
      }
      L.push('');
    }
  }

  L.push(`🔗 Ao vivo: ${ctx.link}`);
  L.push(`_Código ${ctx.code} · ${config.ranking.base === 'games' ? 'Pts = games feitos' : 'Vitória 3 · Empate 1 · Derrota 0'}_`);
  return L.join('\n');
}

/** Tabela de jogos com placares, para colar no grupo. */
export function scheduleMessage(ctx: Ctx): string {
  const nm = namer(ctx.players);
  const L: string[] = [`🎾 *${ctx.name.toUpperCase()}* · tabela de jogos`, ''];
  const keyOf = (m: Match) => `${m.stage === 'mata' ? 'z' : 'a'}|${String(m.round).padStart(3, '0')}|${m.stage === 'mata' ? m.division : ''}`;
  const groups = new Map<string, Match[]>();
  for (const m of [...ctx.matches].sort((x, y) => keyOf(x).localeCompare(keyOf(y)) || x.slot - y.slot)) {
    groups.set(keyOf(m), [...(groups.get(keyOf(m)) ?? []), m]);
  }
  for (const ms of groups.values()) {
    const f = ms[0];
    L.push(f.stage === 'mata' ? `*${f.label?.replace(/ \d+$/, '')}*` : `*Rodada ${f.round}*`);
    for (const m of ms) {
      if (m.b.length === 0) { L.push(`   ${nm(m.a)} avança direto`); continue; }
      const sc = m.sets.length ? ` ${formatScore(m.sets, ctx.config.scoring)} ` : ' x ';
      L.push(`   Q${m.court}${m.grp ? ` · G${m.grp}` : ''}: ${nm(m.a)}${sc}${nm(m.b)}`);
    }
    L.push('');
  }
  L.push(`🔗 Ao vivo: ${ctx.link}`);
  return L.join('\n');
}

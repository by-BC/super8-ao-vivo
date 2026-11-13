import { evaluate, knockoutChampion, type Config, type Match, type Player, type Podium, type PodiumPlace, type RankingSection, type Row, type Team } from '../engine';
import { Name } from './MatchCard';
import { Avatar, cx, Pill } from './ui';
import { Coroa } from './Decor';

const fmt = (n: number, media: boolean) => (media ? n.toFixed(1).replace('.', ',') : String(n));

function RowItem({ r, players, showGender, media, played, qualifies, compact, onPlayer }: {
  r: Row; players: Map<string, Player>; showGender: boolean; media: boolean; played: boolean; qualifies: boolean; compact?: boolean; onPlayer?: (id: string) => void;
}) {
  const tap = onPlayer && r.ids.length === 1 && r.j > 0 ? () => onPlayer(r.ids[0]) : undefined;
  return (
    <li className={cx('grid grid-cols-[40px_auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-hair px-2.5 py-3', played && r.pos === 1 && 'rounded-lg border-transparent bg-highlight', tap && 'cursor-pointer active:bg-hair')}
      onClick={tap} role={tap ? 'button' : undefined} tabIndex={tap ? 0 : undefined} aria-label={tap ? `Cartinha de ${r.label}` : undefined}
      onKeyDown={tap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } } : undefined}>
      <span className={cx('relative grid h-10 w-10 place-items-center rounded-xl font-display text-[20px] font-extrabold leading-none tabnum', played && r.pos === 1 ? 'bg-dourado text-profundo' : played && r.pos === 2 ? 'bg-creme text-profundo' : played && r.pos === 3 ? 'bg-pessego text-profundo' : '')}>
        {played && r.pos === 1 && <Coroa className="absolute -top-3 left-1/2 h-4 w-6 -translate-x-1/2" />}
        {played ? `${r.pos}º` : '–'}
      </span>
      <span className="flex -space-x-2">
        {r.ids.map((id) => <Avatar key={id} id={id} name={players.get(id)?.name ?? '?'} size={r.ids.length > 1 ? 34 : 42} />)}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          {r.ids.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} size="md" avatar={false} />)}
        </div>
        {!compact && (
          <span className="text-[13px] font-semibold text-muted tabnum">
            {r.v}V · {r.e}E · {r.d}D · {r.j} {r.j === 1 ? 'jogo' : 'jogos'} · saldo {r.sg > 0 ? '+' : ''}{r.sg}
            {qualifies && <b className="ml-1.5 text-accentink">· {r.ids.length === 1 ? 'vai pra final' : 'classifica'}</b>}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end leading-none">
        <b className="font-display text-[38px] font-extrabold tabnum">{fmt(r.main, media)}</b>
        <small className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-muted">{media ? 'média' : 'pts'}</small>
      </div>
    </li>
  );
}

/** Pódio 2-1-3 do resultado final: fundo verde coqueiro, degraus dourado/creme/pêssego com avatar. Feito pra virar print. */
export function ResultPodium({ podium: p }: { podium: Podium }) {
  const first = p.places[0];
  const order = p.places.length >= 3 ? [p.places[1], first, p.places[2]] : p.places.length === 2 ? [p.places[1], first] : [first];
  const step = (pl: PodiumPlace) => {
    const top = pl === first;
    return (
      <li key={pl.pos + pl.names.join()} className={cx('relative flex min-w-0 flex-col items-center gap-0.5 rounded-t-lg px-2 pb-4 text-center',
        top ? 'min-h-[176px] bg-podium pt-9 text-podiumink' : pl.pos === 2 ? 'min-h-[136px] bg-creme pt-8 text-profundo' : 'min-h-[118px] bg-pessego pt-8 text-profundo')}>
        <span className="absolute -top-[26px] left-1/2 flex -translate-x-1/2 -space-x-3">
          {pl.names.map((n, i) => <Avatar key={n + i} name={n} size={top ? 52 : 44} className="ring-[3px] ring-[var(--creme)]" />)}
        </span>
        <span className={cx('font-display font-extrabold leading-none tabnum', top ? 'text-[52px]' : 'text-[38px]')}>{pl.pos}º</span>
        <span className="flex flex-col text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">
          {pl.names.map((n, i) => <span key={n + i}>{n}</span>)}
        </span>
        {pl.pts && <span className="text-[12px] font-semibold opacity-85">{pl.pts}</span>}
      </li>
    );
  };
  return (
    <section className="rounded-lg bg-band px-4 pb-4 pt-5 text-bandink shadow-card" aria-label={`Resultado final${p.label ? `, ${p.label}` : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-[.12em]">Resultado final{p.label ? ` · ${p.label}` : ''}</span>
        <Pill className="bg-bandraised text-bandink">Fechado</Pill>
      </div>
      <h2 className="m-0 mb-12 mt-1 font-display text-[44px] font-extrabold leading-none text-dourado">{p.headline}</h2>
      <ol className={cx('m-0 grid list-none items-end gap-2 p-0', order.length === 3 ? 'grid-cols-[1fr_1.15fr_1fr]' : order.length === 2 ? 'mx-auto w-full max-w-[420px] grid-cols-[1fr_1.15fr]' : 'mx-auto w-full max-w-[240px] grid-cols-1')}>
        {order.map(step)}
      </ol>
      {p.final && <p className="m-0 mt-3 text-center text-sm font-semibold opacity-85">Final {p.final}</p>}
    </section>
  );
}

export function RankingSections({ sections, players, config, finished, onPlayer }: {
  sections: RankingSection[]; players: Map<string, Player>; config: Config; finished: boolean; onPlayer?: (id: string) => void;
}) {
  const showGender = config.modality !== 'mesmo_genero';
  const individual = config.format === 'rodizio' || config.format === 'mexicano';
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => {
        const played = s.rows.some((r) => r.j > 0);
        const title = s.kind === 'genero' ? (finished ? (s.title === 'Homens' ? 'Rei da areia' : 'Rainha da areia') : `Melhores ${s.title.toLowerCase()}`) : s.title;
        const rows = s.kind === 'genero' ? s.rows.slice(0, 3) : s.rows;
        return (
          <section key={s.id} className="rounded-lg bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[26px] font-extrabold leading-none">{title}</h2>
              {s.kind === 'grupo' && s.qualify ? <Pill>{s.qualify} {individual ? 'vão pra final' : `classifica${s.qualify > 1 ? 'm' : ''}`}</Pill> : null}
            </div>
            <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-2.5 border-b-[1.5px] border-hair px-2.5 pb-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-muted" aria-hidden>
              <span>#</span><span>{individual ? 'Jogador' : 'Dupla'}</span><span className="text-right">{config.ranking.base === 'games' ? 'Games' : 'Pontos'}</span>
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
              {rows.map((r, i) => (
                <RowItem key={r.key} r={r} players={players} showGender={showGender && s.kind !== 'genero'} media={config.ranking.media} played={played}
                  qualifies={s.kind === 'grupo' && played && i < (s.qualify ?? 0)} compact={s.kind === 'genero'} onPlayer={s.kind === 'genero' ? undefined : onPlayer} />
              ))}
            </ol>
            {s.kind === 'grupo' && played && s.qualify && rows[s.qualify] && rows[s.qualify - 1].pos === rows[s.qualify].pos && (
              <p className="m-0 mt-2 text-[13px] text-muted">Empate em tudo na briga pela vaga: quem passa saiu do sorteio do torneio, igual em todos os celulares.</p>
            )}
          </section>
        );
      })}
      {individual && sections.some((s) => s.kind === 'grupo' && s.qualify === 2) && (
        <p className="m-0 rounded-lg bg-surface px-3 py-2.5 text-sm font-semibold shadow-card">
          Final cruzada: <b>1º do A + 2º do B</b> contra <b>2º do A + 1º do B</b>.
        </p>
      )}
      <p className="m-0 text-[13px] text-muted">
        {config.ranking.base === 'games' ? 'Pontos = games feitos nas partidas encerradas.' : 'Vitória 3 · Empate 1 · Derrota 0.'}
        {config.ranking.media && ' Média por partida, porque nem todo mundo joga o mesmo número de jogos.'}
        {' '}Desempate: {config.ranking.desempate.map((d) => ({ vitorias: 'vitórias', saldo: 'saldo de games', confronto: 'confronto direto', games: 'games feitos' })[d]).join(', ') || 'nenhum'}.
      </p>
    </div>
  );
}

/** Chave do mata-mata em colunas por fase. */
export function Bracket({ matches, teams, players, config, divisionLabel }: {
  matches: Match[]; teams: Team[]; players: Map<string, Player>; config: Config; divisionLabel: (id: string) => string;
}) {
  const ko = matches.filter((m) => m.stage === 'mata');
  if (!ko.length) return null;
  const divisions = [...new Set(ko.map((m) => m.division))];
  const name = (teamId: string | null) => {
    const t = teams.find((x) => x.id === teamId);
    return t ? t.players.map((id) => players.get(id)?.name ?? '?').join(' e ') : '—';
  };
  return (
    <div className="flex flex-col gap-4">
      {divisions.map((d) => {
        const ms = ko.filter((m) => m.division === d);
        const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
        const champ = knockoutChampion(d, matches, config);
        return (
          <section key={d} className="rounded-lg bg-surface p-4 shadow-card">
            <h2 className="m-0 mb-3 font-display text-[26px] font-extrabold leading-none">Mata-mata{d !== 'all' ? ` · ${divisionLabel(d)}` : ''}</h2>
            {champ && (
              <div className="mb-3 rounded-lg bg-accent px-3 py-3 text-onaccent">
                <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">Campeões</span>
                <div className="font-display text-[28px] font-extrabold leading-tight">{name(champ)}</div>
              </div>
            )}
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-3">
                {rounds.map((rd) => (
                  <div key={rd} className="flex w-[220px] flex-col justify-around gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-muted">{ms.find((m) => m.round === rd)?.label?.replace(/ \d+$/, '')}</span>
                    {ms.filter((m) => m.round === rd).sort((x, y) => x.slot - y.slot).map((m) => {
                      const bye = m.b.length === 0;
                      const r = evaluate(m.sets, config.scoring, true, bye);
                      const line = (team: string | null, s: 'a' | 'b', score: number | null) => (
                        <div className={cx('flex items-center justify-between gap-2 px-2.5 py-1.5', r.done && r.winner === s ? 'bg-highlight font-bold' : r.done ? 'text-muted' : '')}>
                          <span className="min-w-0 truncate text-sm">{team ? name(team) : 'Folga'}</span>
                          {score !== null && <b className="font-display text-xl tabnum">{score}</b>}
                        </div>
                      );
                      return (
                        <div key={m.id} className="overflow-hidden rounded-lg border-[1.5px] border-line bg-bg">
                          {line(m.teamA, 'a', bye ? null : r.gamesA)}
                          <div className="border-t border-hair" />
                          {line(bye ? null : m.teamB, 'b', bye ? null : r.gamesB)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

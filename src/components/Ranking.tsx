import { evaluate, knockoutChampion, type Config, type Match, type Player, type RankingSection, type Row, type Team } from '../engine';
import { Name } from './MatchCard';
import { cx, Pill } from './ui';

const fmt = (n: number, media: boolean) => (media ? n.toFixed(1).replace('.', ',') : String(n));

function RowItem({ r, players, showGender, media, played, qualifies, compact }: {
  r: Row; players: Map<string, Player>; showGender: boolean; media: boolean; played: boolean; qualifies: boolean; compact?: boolean;
}) {
  return (
    <li className={cx('grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-hair px-2.5 py-3', played && r.pos === 1 && 'rounded-[10px] border-transparent bg-win')}>
      <span className="font-display text-[26px] font-extrabold leading-none tabnum">{played ? `${r.pos}º` : '–'}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          {r.ids.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} size="md" />)}
        </div>
        {!compact && (
          <span className="text-[13px] font-semibold text-muted tabnum">
            {r.v}V · {r.e}E · {r.d}D · {r.j} {r.j === 1 ? 'jogo' : 'jogos'} · saldo {r.sg > 0 ? '+' : ''}{r.sg}
            {qualifies && <b className="ml-1.5 text-sea">· {r.ids.length === 1 ? 'vai pra final' : 'classifica'}</b>}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end leading-none">
        <b className="font-display text-[38px] font-black tabnum">{fmt(r.main, media)}</b>
        <small className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-muted">{media ? 'média' : 'pts'}</small>
      </div>
    </li>
  );
}

function Podium({ rows }: { rows: Row[] }) {
  const step = (r: Row | undefined, cls: string, first = false) =>
    r ? (
      <div className={cx('flex min-w-0 flex-col items-center gap-1 rounded-t-[10px] rounded-b px-2 py-3 text-center', cls)}>
        {first && <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">Campeão</span>}
        <span className="font-display text-[42px] font-black leading-none">{r.pos}º</span>
        <span className="text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">{r.label}</span>
      </div>
    ) : <div />;
  return (
    <div className="mb-3.5 grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2">
      {step(rows[1], 'min-h-[146px] bg-court')}
      {step(rows[0], 'min-h-[178px] bg-ball text-ballink', true)}
      {step(rows[2], 'min-h-[122px] bg-court')}
    </div>
  );
}

export function RankingSections({ sections, players, config, finished }: {
  sections: RankingSection[]; players: Map<string, Player>; config: Config; finished: boolean;
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
          <section key={s.id} className="rounded-xl bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[26px] font-extrabold uppercase leading-none">{title}</h2>
              {s.kind === 'grupo' && s.qualify ? <Pill>{s.qualify} {individual ? 'vão pra final' : `classifica${s.qualify > 1 ? 'm' : ''}`}</Pill> : null}
            </div>
            {finished && s.kind === 'geral' && played && individual && <Podium rows={s.rows} />}
            <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-2.5 border-b-[1.5px] border-hair px-2.5 pb-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-muted" aria-hidden>
              <span>#</span><span>{individual ? 'Jogador' : 'Dupla'}</span><span className="text-right">{config.ranking.base === 'games' ? 'Games' : 'Pontos'}</span>
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
              {rows.map((r, i) => (
                <RowItem key={r.key} r={r} players={players} showGender={showGender && s.kind !== 'genero'} media={config.ranking.media} played={played}
                  qualifies={s.kind === 'grupo' && played && i < (s.qualify ?? 0)} compact={s.kind === 'genero'} />
              ))}
            </ol>
            {s.kind === 'grupo' && played && s.qualify && rows[s.qualify] && rows[s.qualify - 1].pos === rows[s.qualify].pos && (
              <p className="m-0 mt-2 text-[13px] text-muted">Empate em tudo na briga pela vaga: quem passa saiu do sorteio do torneio, igual em todos os celulares.</p>
            )}
          </section>
        );
      })}
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
    return t ? t.players.map((id) => players.get(id)?.name ?? '?').join(' & ') : '—';
  };
  return (
    <div className="flex flex-col gap-4">
      {divisions.map((d) => {
        const ms = ko.filter((m) => m.division === d);
        const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
        const champ = knockoutChampion(d, matches, config);
        return (
          <section key={d} className="rounded-xl bg-surface p-4 shadow-card">
            <h2 className="m-0 mb-3 font-display text-[26px] font-extrabold uppercase leading-none">Mata-mata{d !== 'all' ? ` · ${divisionLabel(d)}` : ''}</h2>
            {champ && (
              <div className="mb-3 rounded-[10px] bg-ball px-3 py-3 text-ballink">
                <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">Campeões</span>
                <div className="font-display text-[28px] font-black uppercase leading-tight">{name(champ)}</div>
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
                        <div className={cx('flex items-center justify-between gap-2 px-2.5 py-1.5', r.done && r.winner === s ? 'bg-win font-bold' : r.done ? 'text-muted' : '')}>
                          <span className="min-w-0 truncate text-sm">{team ? name(team) : 'Folga'}</span>
                          {score !== null && <b className="font-display text-xl tabnum">{score}</b>}
                        </div>
                      );
                      return (
                        <div key={m.id} className="overflow-hidden rounded-lg border-[1.5px] border-hair bg-bg">
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

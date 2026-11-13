import { useMemo } from 'react';
import { evaluate, formatScore, rankingSections, tournamentStatus, type Player } from '../engine';
import { cx } from '../components/ui';
import { shareLink } from '../lib/router';
import { useTournament } from '../lib/useTournament';
import { useWakeLock } from '../lib/useWakeLock';
import { Carregando, Simbolo } from '../components/Brand';

/** Tela grande para TV ou notebook na beira da quadra: jogos da rodada atual e ranking, ao vivo. */
export function TvPage({ code }: { code: string }) {
  const t = useTournament(code);
  useWakeLock(true);
  const tour = t.tournament;
  const players = useMemo(() => new Map<string, Player>((tour?.data.players ?? []).map((p) => [p.id, p])), [tour]);

  if (!tour) {
    return <main className="grid min-h-screen place-items-center bg-band text-bandink">{t.state === 'nao_encontrado' ? <p className="font-display text-4xl font-extrabold">Código não encontrado</p> : <Carregando label="Carregando…" className="text-bandink [&_span]:text-bandink" />}</main>;
  }

  if (tour.phase === 'inscricao') {
    const open = tour.signup?.open ?? false;
    return (
      <main className="min-h-screen bg-band p-[max(24px,env(safe-area-inset-left,0px))] text-bandink">
        <header className="mb-6 flex flex-wrap items-center gap-4">
          <Simbolo onBand size={56} />
          <h1 className="m-0 font-display text-[clamp(36px,5vw,72px)] font-extrabold leading-none">{tour.name}</h1>
          <span className="ml-auto text-right text-lg opacity-80">
            Inscreva-se: <b className="font-display text-3xl tracking-[.12em]">{code}</b>
            <br />
            <small className="opacity-70">{shareLink(code).replace(/^https?:\/\//, '')}</small>
          </span>
        </header>
        <h2 className="m-0 mb-4 font-display text-5xl font-extrabold">Inscrições {open ? 'abertas' : 'fechadas'} · {t.entries.length}</h2>
        <ol className="m-0 list-none columns-2 gap-8 p-0 text-[clamp(20px,2.4vw,34px)] font-bold lg:columns-4">
          {t.entries.map((e, i) => <li key={e.id} className="break-inside-avoid py-1"><span className="opacity-60 tabnum">{i + 1}.</span> {e.name}</li>)}
        </ol>
      </main>
    );
  }

  const { config } = tour;
  const nm = (ids: string[]) => ids.map((id) => players.get(id)?.name ?? '?').join(' e ');
  const isDone = (m: (typeof t.matches)[number]) => evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done;
  const pending = t.matches.filter((m) => !isDone(m));
  const first = pending[0];
  const current = first ? t.matches.filter((m) => m.stage === first.stage && m.round === first.round && m.b.length > 0) : [];
  const sections = rankingSections(tour.data.players, tour.data.teams, config, t.matches).filter((s) => s.kind !== 'genero');
  const finished = tournamentStatus(tour.data.players, config, t.matches) === 'encerrado';

  return (
    <main className="min-h-screen bg-band p-[max(24px,env(safe-area-inset-left,0px))] text-bandink">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <Simbolo onBand size={56} />
        <h1 className="m-0 font-display text-[clamp(36px,5vw,72px)] font-extrabold leading-none">{tour.name}</h1>
        <span className="ml-auto text-right text-lg opacity-80">
          Acompanhe: <b className="font-display text-3xl tracking-[.12em]">{code}</b>
          <br />
          <small className="opacity-70">{shareLink(code).replace(/^https?:\/\//, '')}</small>
        </span>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="m-0 mb-3 font-display text-4xl font-extrabold">
            {finished ? 'Torneio encerrado' : first ? (first.stage === 'mata' ? first.label?.replace(/ \d+$/, '') : `Rodada ${first.round}`) : 'Aguardando'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {current.map((m) => {
              const r = evaluate(m.sets, config.scoring, m.stage === 'mata');
              return (
                <div key={m.id} className="rounded-lg bg-white/10 p-4">
                  <div className="mb-2 text-sm font-bold uppercase tracking-[.12em] opacity-70">Quadra {m.court}{m.grp ? ` · Grupo ${m.grp}` : ''}</div>
                  {(['a', 'b'] as const).map((s) => (
                    <div key={s} className={cx('flex items-center justify-between gap-3 py-1', r.done && r.winner && r.winner !== s && 'opacity-50')}>
                      <span className="text-2xl font-bold">{nm(s === 'a' ? m.a : m.b)}</span>
                      <span className="font-display text-5xl font-extrabold tabnum">{m.sets[m.sets.length - 1]?.[s === 'a' ? 0 : 1] ?? 0}</span>
                    </div>
                  ))}
                  {config.scoring.type === 'melhor3' && m.sets.length > 1 && <div className="text-sm opacity-70">{formatScore(m.sets, config.scoring)}</div>}
                </div>
              );
            })}
          </div>
        </section>
        <section className="flex flex-col gap-4">
          {sections.slice(0, 4).map((s) => (
            <div key={s.id}>
              <h2 className="m-0 mb-2 font-display text-3xl font-extrabold">{s.title}</h2>
              <ol className="m-0 list-none p-0">
                {s.rows.slice(0, 10).map((r) => (
                  <li key={r.key} className={cx('flex items-center gap-3 border-b border-white/10 py-1.5 text-xl', r.pos === 1 && r.j > 0 && '-mx-2 rounded-lg border-transparent bg-bandraised px-2')}>
                    <b className="w-10 font-display text-3xl tabnum">{r.j > 0 || s.rows.some((x) => x.j > 0) ? `${r.pos}º` : '–'}</b>
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.label}</span>
                    <b className="font-display text-3xl tabnum">{config.ranking.media ? r.main.toFixed(1).replace('.', ',') : r.main}</b>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

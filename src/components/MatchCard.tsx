import { useEffect, useRef, useState } from 'react';
import { evaluate, type Match, type Player, type Scoring } from '../engine';
import { cx, GenderDot } from './ui';

interface Props {
  match: Match;
  number: number;
  players: Map<string, Player>;
  scoring: Scoring;
  canScore: boolean;
  showGender: boolean;
  onPoint: (side: 'a' | 'b', delta: 1 | -1) => void;
}

export function MatchCard({ match: m, number, players, scoring, canScore, showGender, onPoint }: Props) {
  const knockout = m.stage === 'mata';
  const bye = knockout && m.b.length === 0;
  const r = evaluate(m.sets, scoring, knockout, bye);
  const wasDone = useRef(r.done);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (r.done && !wasDone.current) {
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 700);
      wasDone.current = r.done;
      return () => window.clearTimeout(t);
    }
    wasDone.current = r.done;
  }, [r.done]);

  const head = [m.label ?? `Jogo ${number}`, m.grp ? `Grupo ${m.grp}` : `Quadra ${m.court}`].join(' · ');

  if (bye) {
    return (
      <article className="court rounded-lg px-[18px] py-4 shadow-card">
        <header className="relative px-1 text-xs font-extrabold uppercase tracking-[.12em] text-muted">{m.label}</header>
        <div className="relative mt-2 flex flex-wrap items-center gap-2 px-2 py-2">
          {m.a.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} />)}
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-onaccent">Avança direto</span>
        </div>
      </article>
    );
  }

  const status = r.done
    ? ['Fim', 'bg-ink text-bg']
    : r.progress === 'desempate'
      ? ['Game de desempate', 'bg-highlight text-ink']
      : r.started
        ? [r.progress ? `Em jogo · ${r.progress}` : 'Em jogo', 'bg-accent text-onaccent']
        : ['A jogar', 'shadow-[inset_0_0_0_1.5px_var(--line)]'];
  const multi = scoring.type === 'melhor3';
  const lastIdx = Math.max(0, m.sets.length - 1);

  const side = (s: 'a' | 'b') => {
    const ids = s === 'a' ? m.a : m.b;
    const idx = s === 'a' ? 0 : 1;
    const won = r.done && r.winner === s;
    const lost = r.done && r.winner && r.winner !== s;
    const draw = r.done && r.draw;
    const score = m.sets[lastIdx]?.[idx] ?? 0;
    const label = ids.map((id) => players.get(id)?.name ?? '?').join(' e ');
    return (
      <div className={cx('relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg py-2 pl-2 pr-1.5 transition-colors', won && 'bg-highlight', draw && 'bg-hair', pop && (won || draw) && 'pop')}>
        <div className="flex min-w-0 flex-col gap-0.5">
          {ids.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} muted={!!lost} />)}
          {won && <span className="mt-1 self-start rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-onaccent">Venceu</span>}
          {draw && <span className="mt-1 self-start rounded-full border-[1.5px] border-line px-2 py-px text-[11px] font-extrabold uppercase tracking-[.12em]">Empate</span>}
        </div>
        <div className="flex items-center gap-1">
          {multi && m.sets.length > 1 && (
            <span className="flex gap-1 text-sm font-bold text-muted tabnum" aria-label="Sets anteriores">
              {m.sets.slice(0, lastIdx).map((st, i) => <span key={i}>{st[idx]}</span>)}
            </span>
          )}
          {canScore && (
            <button type="button" aria-label={`Tirar um game de ${label}`} disabled={score <= 0 && !(multi && m.sets.length > 1)} onClick={() => onPoint(s, -1)}
              className="h-9 w-9 rounded-full border-[1.5px] border-line text-xl leading-none disabled:opacity-25 max-[380px]:h-8 max-[380px]:w-8">−</button>
          )}
          <output aria-label={`${label}: ${score}`} className={cx('min-w-[1.1em] text-center font-display text-[48px] font-extrabold leading-none tabnum max-[380px]:text-[40px]', lost && 'text-muted')}>{score}</output>
          {canScore && (
            <button type="button" aria-label={`Game para ${label}`} disabled={r.done} onClick={() => onPoint(s, 1)}
              className="h-[52px] w-[52px] rounded-full bg-accent text-3xl font-semibold leading-none text-onaccent active:translate-y-px disabled:opacity-25 max-[380px]:h-12 max-[380px]:w-12">+</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <article className="court flex flex-col gap-1.5 rounded-lg px-4 py-4 shadow-card" aria-label={head}>
      <header className="relative flex items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-[.12em] text-muted">
        <span className="min-w-0 truncate">{head}</span>
        <span className={cx('ml-auto whitespace-nowrap rounded-full px-2 py-0.5 tracking-[.08em]', status[1])}>{status[0]}</span>
      </header>
      {m.counts?.length ? (
        <p className="relative m-0 rounded bg-highlight px-2 py-1 text-[13px] font-semibold text-ink">
          Vale só para {m.counts.map((id) => players.get(id)?.name ?? '?').join(' e ')}
        </p>
      ) : null}
      {side('a')}
      <div className="net" aria-hidden><span /></div>
      {side('b')}
    </article>
  );
}

export function Name({ p, showGender, muted, size = 'lg' }: { p: Player | undefined; showGender: boolean; muted?: boolean; size?: 'lg' | 'md' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {showGender && <GenderDot g={p?.gender} />}
      <span className={cx('font-bold leading-tight [overflow-wrap:break-word]', size === 'lg' ? 'text-[17px] min-[400px]:text-lg' : 'text-base', muted && 'text-muted')}>{p?.name ?? '?'}</span>
    </span>
  );
}

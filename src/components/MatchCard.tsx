import { useContext, useEffect, useRef, useState } from 'react';
import { applyGame, evaluate, isAmistoso, type DeletePlan, type Match, type Player, type Scoring } from '../engine';
import { Avatar, cx, GenderDot, RosterCtx } from './ui';

interface Props {
  match: Match;
  number: number;
  players: Map<string, Player>;
  scoring: Scoring;
  canScore: boolean;
  showGender: boolean;
  /** Torneio encerrado: placar travado até o árbitro tocar em "Corrigir". */
  locked?: boolean;
  /** Aviso mostrado enquanto corrige um jogo de torneio encerrado. */
  lockedNote?: string;
  /** Jogador "sou eu" deste celular: o nome dele fica destacado. */
  me?: string | null;
  /** Encerrado à mão pelo organizador: jogo que não terminou aparece como "Não jogado". */
  closed?: boolean;
  /**
   * Modo de excluir do organizador: o placar some do cartão (nada de + e − por perto) e entra o botão de excluir.
   * Com placar, pede o segundo toque dizendo o que se perde.
   */
  remove?: { plan: DeletePlan; busy: boolean; onConfirm: () => void };
  onPoint: (side: 'a' | 'b', delta: 1 | -1) => void;
}

/** Quanto tempo o "Desfazer" fica no cartão depois do último toque. */
const UNDO_MS = 5000;
interface Step { side: 'a' | 'b'; delta: 1 | -1 }

export function MatchCard({ match: m, number, players, scoring, canScore, showGender, locked = false, lockedNote, me, closed = false, remove, onPoint }: Props) {
  const knockout = m.stage === 'mata';
  const bye = knockout && m.b.length === 0;
  const r = evaluate(m.sets, scoring, knockout, bye);
  const wasDone = useRef(r.done);
  const [pop, setPop] = useState(false);
  const [editing, setEditing] = useState(false);
  const scoreable = canScore && (!locked || editing) && !remove;
  const friendly = isAmistoso(m);
  // Desfazer mora no cartão, não num toast por cima dos botões: o segundo toque no "+"
  // nunca cai nele. Cada toque fica numa pilha curta; cada "Desfazer" volta o mais recente.
  const [undo, setUndo] = useState<Step[]>([]);
  const undoTimer = useRef<number | undefined>(undefined);
  const armUndo = (steps: Step[]) => {
    window.clearTimeout(undoTimer.current);
    setUndo(steps);
    if (steps.length) undoTimer.current = window.setTimeout(() => setUndo([]), UNDO_MS);
  };
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  // saiu do modo de lançar (tocou em "Pronto" ou perdeu o PIN): some o desfazer junto
  useEffect(() => {
    if (!scoreable) { window.clearTimeout(undoTimer.current); setUndo([]); }
  }, [scoreable]);

  useEffect(() => {
    if (r.done && !wasDone.current) {
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 700);
      wasDone.current = r.done;
      return () => window.clearTimeout(t);
    }
    wasDone.current = r.done;
  }, [r.done]);

  const score1 = (s: 'a' | 'b', delta: 1 | -1) => {
    // só guarda para desfazer o que de fato muda o placar (um "−" no zero não vira "+1" depois)
    const applies = !!applyGame(m.sets, s, delta, scoring, knockout);
    onPoint(s, delta);
    if (applies) armUndo([...undo, { side: s, delta }].slice(-5));
  };
  const last = scoreable ? undo[undo.length - 1] : undefined;
  const pairName = (s: 'a' | 'b') => (s === 'a' ? m.a : m.b).map((id) => players.get(id)?.name ?? '?').join(' e ');
  const undoLast = () => {
    if (!last) return;
    onPoint(last.side, last.delta > 0 ? -1 : 1);
    armUndo(undo.slice(0, -1));
  };

  const head = [m.label ?? `Jogo ${number}`, m.grp ? `Grupo ${m.grp}` : `Quadra ${m.court}`].join(' · ');

  if (bye) {
    return (
      <article className="court rounded-lg px-[18px] py-4 shadow-card">
        <header className="relative px-1 text-xs font-extrabold uppercase tracking-[.12em] text-muted">{m.label}</header>
        <div className="relative mt-2 flex flex-wrap items-center gap-2 px-2 py-2">
          {m.a.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} />)}
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-onaccent">Avança direto</span>
        </div>
        {remove && <RemoveRow plan={remove.plan} busy={remove.busy} onConfirm={remove.onConfirm} score={null} />}
      </article>
    );
  }

  const status = r.done
    ? ['Fim', 'bg-ink text-bg']
    : closed && !friendly
      // encerrado antes do fim: o jogo fica na lista, mas fora do ranking
      ? [r.started ? 'Não terminou' : 'Não jogado', 'text-muted shadow-[inset_0_0_0_1.5px_var(--line)]']
    : r.progress === 'desempate'
      ? ['Game de desempate', 'bg-highlight text-ink']
      : r.started
        ? [r.progress ? `Em jogo · ${r.progress}` : 'Em jogo', 'bg-select text-onselect']
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
      <div className={cx('relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg py-2 pl-3.5 pr-1.5 transition-colors before:absolute before:inset-y-2 before:left-0 before:w-[5px] before:rounded-full', s === 'a' ? 'before:bg-turquesa' : 'before:bg-coral', won && 'bg-highlight', draw && 'bg-hair', pop && (won || draw) && 'pop')}>
        <div className="flex min-w-0 flex-col gap-0.5">
          {ids.map((id) => <Name key={id} p={players.get(id)} showGender={showGender} muted={!!lost} mine={!!me && id === me} />)}
          {won && <span className="mt-1 self-start rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-onaccent">Venceu</span>}
          {draw && <span className="mt-1 self-start rounded-full border-[1.5px] border-line px-2 py-px text-[11px] font-extrabold uppercase tracking-[.12em]">Empate</span>}
        </div>
        <div className="flex items-center gap-1">
          {multi && m.sets.length > 1 && (
            <span className="flex gap-1 text-sm font-bold text-muted tabnum" aria-label="Sets anteriores">
              {m.sets.slice(0, lastIdx).map((st, i) => <span key={i}>{st[idx]}</span>)}
            </span>
          )}
          {scoreable && (
            <button type="button" aria-label={`Tirar um game de ${label}`} disabled={score <= 0 && !(multi && m.sets.length > 1)} onClick={() => score1(s, -1)}
              className="h-9 w-9 rounded-full border-[1.5px] border-line text-xl leading-none disabled:opacity-25 max-[380px]:h-8 max-[380px]:w-8">−</button>
          )}
          <output aria-label={`${label}: ${score}`} className={cx('min-w-[1.1em] text-center font-display text-[48px] font-extrabold leading-none tabnum max-[380px]:text-[40px]', lost && 'text-muted')}>{score}</output>
          {scoreable && (
            <button type="button" aria-label={`Game para ${label}`} disabled={r.done} onClick={() => score1(s, 1)}
              className="h-[52px] w-[52px] rounded-full bg-score text-3xl font-semibold leading-none text-onscore active:translate-y-px disabled:opacity-25 max-[380px]:h-12 max-[380px]:w-12">+</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <article id={`jogo-${m.id}`} className={cx('court flex scroll-mt-24 flex-col gap-1.5 rounded-lg px-4 py-4 shadow-card', !!me && (m.a.includes(me) || m.b.includes(me)) && 'ring-[3px] ring-accent')} aria-label={head}>
      <header className={cx('relative flex items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-[.12em] text-muted', canScore && 'min-h-7')}>
        {last ? (
          // fica no lugar do "Jogo N · Quadra X", do lado oposto aos botões de game; a altura
          // do cabeçalho já está reservada (min-h-7), então nada embaixo se mexe. O alvo de
          // toque cresce para 48 px por um ::before que só invade a área dos nomes.
          <button type="button" onClick={undoLast}
            aria-label={`Desfazer ${last.delta > 0 ? '+1' : '−1'} game de ${pairName(last.side)}`}
            className="relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 font-extrabold tracking-[.08em] text-onaccent before:absolute before:inset-x-0 before:-inset-y-[10px] before:content-[''] active:translate-y-px">
            <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <path d="M5.5 3 2.5 6l3 3" />
              <path d="M2.5 6h7a4 4 0 0 1 0 8H7" />
            </svg>
            <span>Desfazer<span className="tabnum max-[380px]:hidden"> {last.delta > 0 ? '+1' : '−1'}</span></span>
          </button>
        ) : (
          <span className="min-w-0 truncate">{head}</span>
        )}
        <span className={cx('ml-auto whitespace-nowrap rounded-full px-2 py-0.5 tracking-[.08em]', last && 'min-w-0 truncate', status[1])}>{status[0]}</span>
        {canScore && (locked || editing) && !remove && (
          <button type="button" onClick={() => setEditing((e) => !e)} aria-pressed={editing}
            className={cx('whitespace-nowrap rounded-full px-2 py-0.5 font-extrabold tracking-[.08em]', editing ? 'bg-accent text-onaccent' : 'shadow-[inset_0_0_0_1.5px_var(--line)] text-ink')}>
            {editing ? 'Pronto' : 'Corrigir'}
          </button>
        )}
      </header>
      {editing && lockedNote && (
        <p className="relative m-0 rounded bg-hair px-2 py-1 text-[13px] font-semibold text-ink">{lockedNote}</p>
      )}
      {friendly ? (
        <p className="relative m-0 self-start rounded-full bg-selecttint px-2.5 py-0.5 text-[12px] font-bold text-ink">
          <span className="font-extrabold uppercase tracking-[.08em]">Amistoso</span> · não conta no ranking
        </p>
      ) : m.counts?.length ? (
        <p className="relative m-0 self-start rounded-full bg-selecttint px-2.5 py-0.5 text-[12px] font-bold text-ink">
          Extra · vale só para {m.counts.map((id) => players.get(id)?.name ?? '?').join(' e ')}
        </p>
      ) : null}
      {side('a')}
      <div className="net" aria-hidden><span /></div>
      {side('b')}
      {remove && <RemoveRow plan={remove.plan} busy={remove.busy} onConfirm={remove.onConfirm} score={m.sets.length ? `${m.sets[lastIdx][0]} x ${m.sets[lastIdx][1]}` : null} />}
    </article>
  );
}

/**
 * Rodapé do cartão no modo de excluir. Sem placar, um toque exclui (e o aviso traz o Desfazer).
 * Com placar, o primeiro toque só abre a confirmação em vermelho dizendo o que se perde.
 */
function RemoveRow({ plan, busy, onConfirm, score }: { plan: DeletePlan; busy: boolean; onConfirm: () => void; score: string | null }) {
  const [confirm, setConfirm] = useState(false);
  if (!plan.ok) return <p className="relative m-0 mt-1 rounded-lg bg-hair px-3 py-2 text-[13px] font-semibold text-ink">{plan.reason}</p>;
  const scope = plan.scope ? <>Sai a <b>{plan.scope}</b>: o botão de gerar monta a fase de novo. </> : null;
  if (!confirm) {
    return (
      <div className="relative mt-1 flex flex-col gap-1.5">
        {scope && <p className="m-0 text-[13px] text-muted">{scope}</p>}
        <button type="button" disabled={busy} onClick={() => (plan.scored ? setConfirm(true) : onConfirm())}
          className="min-h-[48px] rounded-lg border-[1.5px] border-danger font-bold text-danger disabled:opacity-40">
          {busy ? 'Excluindo…' : plan.ids.length > 1 ? 'Excluir a fase' : 'Excluir jogo'}
        </button>
      </div>
    );
  }
  const what = plan.ids.length > 1
    ? `${plan.scored} ${plan.scored === 1 ? 'jogo dessa fase tem placar' : 'jogos dessa fase têm placar'}`
    : `O placar${score ? ` ${score}` : ''}`;
  return (
    <div role="alert" className="relative mt-1 flex flex-col gap-2 rounded-lg bg-tintwarn p-3">
      <p className="m-0 text-[15px]"><b>{what} some e o ranking muda.</b> Não dá pra desfazer.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onConfirm} className="min-h-[48px] rounded-lg bg-danger px-2 font-bold leading-tight text-ondanger disabled:opacity-40">
          {busy ? 'Excluindo…' : 'Excluir jogo e placar'}
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-[48px] rounded-lg border-[1.5px] border-ink font-bold">Cancelar</button>
      </div>
    </div>
  );
}

/**
 * Nome do jogador. Dentro de um torneio vem com o personagem dele (que já diz o gênero);
 * fora, ou com `avatar={false}`, cai na bolinha H/M quando o gênero importa.
 */
export function Name({ p, showGender, muted, mine, size = 'lg', avatar = true }: { p: Player | undefined; showGender: boolean; muted?: boolean; mine?: boolean; size?: 'lg' | 'md'; avatar?: boolean }) {
  const roster = useContext(RosterCtx);
  const withAvatar = avatar && !!p && !!roster?.byId.has(p.id);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {withAvatar ? <Avatar id={p!.id} name={p!.name} size={size === 'lg' ? 30 : 24} className={muted ? 'opacity-60' : ''} /> : showGender && <GenderDot g={p?.gender} />}
      <span className={cx('font-bold leading-tight [overflow-wrap:break-word]', size === 'lg' ? 'text-[17px] min-[400px]:text-lg' : 'text-base', muted && 'text-muted', mine && 'rounded-md bg-accenttint px-1.5 text-accentink')}>{p?.name ?? '?'}{mine ? ' (você)' : ''}</span>
    </span>
  );
}

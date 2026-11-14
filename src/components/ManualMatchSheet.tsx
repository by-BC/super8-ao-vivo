import { useEffect, useMemo, useState } from 'react';
import { buildManualMatch, evaluate, isIndividual, MANUAL_LABEL, MANUAL_LABEL_MAX, type Config, type Match, type NewMatch, type Player, type Team } from '../engine';
import { Button, cx, GenderDot, Note, Segmented, Sheet, Stepper } from './ui';

type Pick = 'duplas' | 'jogadores';

/**
 * Jogo criado pelo organizador: toca nos nomes pra encher a dupla A e depois a dupla B (como no montar duplas),
 * escolhe a quadra, o nome do jogo e se ele vale pro ranking. Nos formatos de dupla, dá pra tocar direto
 * na dupla do torneio ou montar uma dupla avulsa (que vira amistoso, porque não tem linha na tabela).
 */
export function ManualMatchSheet({ open, onClose, players, teams, config, matches, offline, onCreate }: {
  open: boolean; onClose: () => void; players: Player[]; teams: Team[]; config: Config; matches: Match[]; offline: boolean;
  onCreate: (m: NewMatch) => Promise<boolean>;
}) {
  const individual = isIndividual(config.format);
  const active = useMemo(() => players.filter((p) => !p.left).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')), [players]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [mode, setMode] = useState<Pick>(individual ? 'jogadores' : 'duplas');
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [court, setCourt] = useState(1);
  const [label, setLabel] = useState('');
  const [counts, setCounts] = useState(true);
  const [busy, setBusy] = useState(false);

  // abre limpo, numa quadra que não tem jogo rolando agora
  useEffect(() => {
    if (!open) return;
    setA([]); setB([]); setLabel(''); setCounts(true); setMode(individual ? 'jogadores' : 'duplas');
    const busyCourts = new Set(matches.filter((m) => m.b.length && m.sets.length && !evaluate(m.sets, config.scoring, m.stage === 'mata').done).map((m) => m.court));
    const free = Array.from({ length: Math.max(1, config.courts) }, (_, i) => i + 1).find((c) => !busyCourts.has(c));
    setCourt(free ?? 1);
  }, [open]);

  const plan = a.length === 2 && b.length === 2
    ? buildManualMatch({ a, b, court, label, counts }, { players, teams, config, matches })
    : null;
  const forced = plan?.forcedAmistoso ?? null;
  const chosen = new Set([...a, ...b]);
  const showGender = config.modality === 'mista' || config.modality === 'mesmo_genero' || (config.modality === 'livre' && config.ranking.separarGenero);

  /** Põe os nomes no primeiro lado com vaga; tocar em quem já está escolhido tira ele. */
  const tap = (ids: string[]) => {
    if (ids.every((id) => chosen.has(id))) {
      setA(a.filter((id) => !ids.includes(id)));
      setB(b.filter((id) => !ids.includes(id)));
      return;
    }
    const fresh = ids.filter((id) => !chosen.has(id));
    if (a.length + fresh.length <= 2) setA([...a, ...fresh]);
    else if (b.length + fresh.length <= 2) setB([...b, ...fresh]);
  };
  const full = a.length === 2 && b.length === 2;
  const nm = (ids: string[]) => ids.map((id) => byId.get(id)?.name ?? '?').join(' e ');
  const prompt = full
    ? <><b className="text-ink">{nm(a)}</b> contra <b className="text-ink">{nm(b)}</b>.</>
    : a.length < 2 ? (mode === 'duplas' ? 'Toque na primeira dupla.' : 'Toque em 2 nomes pra dupla A.') : (mode === 'duplas' ? 'Agora a dupla adversária.' : 'Agora 2 nomes pra dupla B.');

  const side = (s: 'a' | 'b') => {
    const ids = s === 'a' ? a : b;
    return (
      <div className={cx('relative flex min-h-[56px] flex-wrap items-center gap-1.5 rounded-lg bg-bg py-2 pl-4 pr-2 before:absolute before:inset-y-2 before:left-1.5 before:w-[5px] before:rounded-full', s === 'a' ? 'before:bg-turquesa' : 'before:bg-coral')}>
        {ids.length === 0 && <span className="text-[15px] text-muted">Dupla {s.toUpperCase()}</span>}
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => tap([id])} aria-label={`Tirar ${byId.get(id)?.name ?? '?'} da dupla ${s.toUpperCase()}`}
            className="relative flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface pl-3 pr-2 font-semibold shadow-card after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']">
            {byId.get(id)?.name ?? '?'} <span aria-hidden className="text-lg leading-none text-muted">×</span>
          </button>
        ))}
        {ids.length === 1 && <span className="px-1 text-[13px] text-muted">falta 1</span>}
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Criar jogo" closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {side('a')}
          <div className="net" aria-hidden><span /></div>
          {side('b')}
        </div>

        <div className="flex flex-col gap-2">
          {!individual && (
            // as duas opções ocupam a largura toda (cada uma cresce a partir do próprio texto, sem quebrar linha a 360 px)
            <div className="[&_button]:grow">
              <Segmented label="Escolher por" value={mode} onChange={(v) => setMode(v)}
                options={[{ value: 'duplas', label: 'Duplas do torneio' }, { value: 'jogadores', label: 'Dupla avulsa' }]} />
            </div>
          )}
          <p className="m-0 text-[13px] text-muted" aria-live="polite">{prompt}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {mode === 'duplas'
              ? teams.filter((t) => t.players.every((id) => byId.get(id) && !byId.get(id)!.left)).map((t) => {
                const on = t.players.every((id) => chosen.has(id));
                const clash = !on && t.players.some((id) => chosen.has(id));
                return (
                  <li key={t.id}>
                    <button type="button" aria-pressed={on} disabled={clash || (full && !on)} onClick={() => tap([...t.players])}
                      className={cx('flex min-h-[48px] items-center gap-1.5 rounded-full border-[1.5px] px-4 text-left font-semibold leading-tight disabled:opacity-35',
                        on ? 'border-select bg-select text-onselect' : 'border-line bg-bg text-ink')}>
                      {nm([...t.players])}{t.group ? <span className="text-[12px] font-bold text-muted">· {t.group}</span> : null}
                    </button>
                  </li>
                );
              })
              : active.map((p) => {
                const on = chosen.has(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" aria-pressed={on} disabled={full && !on} onClick={() => tap([p.id])}
                      className={cx('flex min-h-[48px] items-center gap-1.5 rounded-full border-[1.5px] px-4 font-semibold disabled:opacity-35',
                        on ? 'border-select bg-select text-onselect' : 'border-line bg-bg text-ink')}>
                      {showGender && <GenderDot g={p.gender} />}
                      {p.name}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="manual-quadra" className="font-bold">Quadra</label>
          <Stepper id="manual-quadra" label="quadra" value={court} min={1} max={60} onChange={setCourt} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-nome" className="font-bold">Nome do jogo</label>
          <input id="manual-nome" value={label} maxLength={MANUAL_LABEL_MAX} placeholder={MANUAL_LABEL} onChange={(e) => setLabel(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border-[1.5px] border-line bg-bg px-3 font-semibold text-ink placeholder:font-normal placeholder:text-muted" />
        </div>

        <label className="flex min-h-[48px] items-start gap-3 text-[15px]">
          <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--accent)] disabled:opacity-40" checked={counts && !forced} disabled={!!forced}
            onChange={(e) => setCounts(e.target.checked)} />
          <span>
            <b>Vale pro ranking</b>
            <small className="block text-[13px] text-muted">
              {forced
                ? `${forced} Entra como amistoso: tem placar, mas não conta.`
                : counts ? 'Conta no ranking como qualquer jogo.' : 'Amistoso: aparece na lista e tem placar, mas não conta no ranking, no pódio nem na cartinha.'}
            </small>
          </span>
        </label>

        {plan && !plan.ok && <Note kind="warn">{plan.errors[0]}</Note>}
        {offline && <p className="m-0 text-center text-[13px] text-muted">Sem conexão: dá pra criar o jogo quando a internet voltar.</p>}
        <Button kind="primary" block disabled={!plan?.ok || busy || offline} onClick={async () => {
          if (!plan?.match || busy) return;
          setBusy(true);
          try { if (await onCreate(plan.match)) onClose(); } finally { setBusy(false); }
        }}>{busy ? 'Criando…' : 'Criar jogo'}</Button>
      </div>
    </Sheet>
  );
}

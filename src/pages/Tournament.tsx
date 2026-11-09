import QRCode from 'qrcode';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  buildInitial, divisionsOf, divisionsWithFinal, evaluate, finalWinners, formatScore, isIndividual, nextStep, playerCard, podiums, randomSeed, rankingMessage, rankingSections, scheduleMessage,
  scoringLabel, tournamentStatus, type Match, type Player,
} from '../engine';
import { MatchCard, Name } from '../components/MatchCard';
import { PodiumSheet } from '../components/PodiumSheet';
import { CardSheet } from '../components/CardSheet';
import { SignupView } from './Signup';
import { Bracket, RankingSections } from '../components/Ranking';
import { Button, copyText, CopySheet, cx, Note, Panel, Pill, Sheet, useToast } from '../components/ui';
import { api, ApiFail, errorText } from '../lib/api';
import { getSaved, upsertSaved } from '../lib/local';
import { go, shareLink } from '../lib/router';
import { useTournament } from '../lib/useTournament';

type Tab = 'jogos' | 'ranking' | 'info';

const FORMAT_LABEL = { rodizio: 'Rodízio (Super 8)', duplas: 'Duplas fixas, todos contra todos', grupos: 'Grupos + mata-mata', mexicano: 'Mexicano' } as const;
const MODALITY_LABEL = { mista: 'Mista', mesmo_genero: 'Mesmo gênero', livre: 'Livre' } as const;

export function TournamentPage({ code }: { code: string }) {
  const toast = useToast();
  const t = useTournament(code);
  const [tab, setTab] = useState<Tab>('jogos');
  const [pinOpen, setPinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [podiumOpen, setPodiumOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<{ code: string; pin: string } | null>(null);
  const [saved, setSaved] = useState(() => getSaved(code));
  const [generating, setGenerating] = useState(false);
  const [divF, setDivFState] = useState<string>(() => {
    try { return localStorage.getItem(`s8:div:${code}`) ?? 'todos'; } catch { return 'todos'; }
  });
  const setDivF = (v: string) => {
    setDivFState(v);
    try { localStorage.setItem(`s8:div:${code}`, v); } catch { /* ok */ }
  };
  const [grpF, setGrpFState] = useState<string>(() => {
    try { return localStorage.getItem(`s8:grp:${code}`) ?? 'todos'; } catch { return 'todos'; }
  });
  const setGrpF = (v: string) => {
    setGrpFState(v);
    try { localStorage.setItem(`s8:grp:${code}`, v); } catch { /* ok */ }
  };

  const tour = t.tournament;
  const credential = saved?.token ?? saved?.adminKey ?? null;
  const canScore = !!credential;
  const isAdmin = !!saved?.adminKey;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('s8:novo');
      if (raw) {
        const v = JSON.parse(raw);
        if (v.code === code) { setWelcome(v); sessionStorage.removeItem('s8:novo'); }
      }
    } catch { /* ok */ }
  }, [code]);

  useEffect(() => {
    if (tour) setSaved(upsertSaved({ code, name: tour.name }));
  }, [tour?.name, code]);

  useEffect(() => {
    if (t.authLost) {
      setSaved(getSaved(code));
      toast(errorText.SEM_PERMISSAO);
      t.clearAuthLost();
    }
  }, [t.authLost]);

  useEffect(() => {
    if (t.lastError) { toast(errorText[t.lastError as keyof typeof errorText] ?? errorText.SERVIDOR); t.clearError(); }
  }, [t.lastError]);

  const players = useMemo(() => new Map<string, Player>((tour?.data.players ?? []).map((p) => [p.id, p])), [tour]);

  if (t.state === 'carregando') return <Shell code={code}><p className="text-muted">Carregando o torneio…</p></Shell>;
  if (t.state === 'nao_encontrado') {
    return (
      <Shell code={code}>
        <Note kind="warn">{errorText.NAO_ENCONTRADO}</Note>
        <Button block onClick={() => go('/')}>Voltar para o início</Button>
      </Shell>
    );
  }
  if (t.state === 'erro' || !tour) {
    return (
      <Shell code={code}>
        <Note kind="warn">Não consegui falar com o servidor. Confira a internet e tente de novo.</Note>
        <Button block onClick={() => void t.reload()}>Tentar de novo</Button>
      </Shell>
    );
  }

  const { config } = tour;
  const header = (
    <header className="band-lines bg-band text-bandink">
      <div className="gutter relative z-[1] mx-auto flex max-w-[760px] items-center gap-3 py-4">
        <a href="#/" aria-label="Início" className="ball h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-display text-[clamp(24px,7.5vw,32px)] font-black uppercase leading-[.92] [overflow-wrap:break-word]">{tour.name}</h1>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-snug opacity-90">
            <LiveBadge live={t.live} reachable={t.reachable} pending={t.pending} />
            <span>· {FORMAT_LABEL[config.format]}</span>
          </p>
        </div>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-none flex-col items-center rounded-[10px] border-[1.5px] border-current px-2 py-1" aria-label={`Compartilhar código ${code}`}>
          <span className="text-[9px] font-bold uppercase tracking-[.14em] opacity-80">Código</span>
          <span className="font-display text-xl font-black tracking-[.1em]">{code}</span>
        </button>
      </div>
    </header>
  );
  const welcomeSheet = (
    <Sheet open={!!welcome} onClose={() => setWelcome(null)} title="Torneio criado">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px]">{tour.phase === 'inscricao' ? 'Agora copie o convite e mande no grupo: cada um se inscreve pelo link. Quando fechar a lista, você sorteia aqui.' : 'Mande o link ou o código para a galera. O PIN é só para quem vai lançar placar.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[10px] bg-bg p-3"><small className="block text-xs font-bold uppercase tracking-[.12em] text-muted">Código</small><b className="font-display text-3xl tracking-[.12em]">{code}</b></div>
          <div className="rounded-[10px] bg-bg p-3"><small className="block text-xs font-bold uppercase tracking-[.12em] text-muted">PIN árbitro</small><b className="font-display text-3xl tracking-[.2em]">{welcome?.pin}</b></div>
        </div>
        <Note kind="ok">Este aparelho ficou como <b>organizador</b>: só daqui dá para editar nomes, trocar o PIN e sortear de novo.</Note>
        <Button kind="primary" block onClick={() => { setWelcome(null); if (tour.phase !== 'inscricao') setShareOpen(true); }}>{tour.phase === 'inscricao' ? 'Entendi' : 'Compartilhar'}</Button>
      </div>
    </Sheet>
  );

  if (tour.phase === 'inscricao') {
    return (
      <>
        {header}
        <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-4">
          <SignupView code={code} tour={tour} entries={t.entries} adminKey={saved?.adminKey ?? null} onChanged={async () => { t.notify(); await t.reload(); }} />
        </main>
        <ShareSheet open={shareOpen} code={code} name={tour.name} onClose={() => setShareOpen(false)} onCopy={share} />
        <CopySheet text={copyFallback} onClose={() => setCopyFallback(null)} />
        {welcomeSheet}
      </>
    );
  }

  const { players: plist, teams } = tour.data;
  const status = tournamentStatus(plist, config, t.matches);
  const finished = status === 'encerrado';
  const real = t.matches.filter((m) => !(m.stage === 'mata' && m.b.length === 0));
  const done = real.filter((m) => evaluate(m.sets, config.scoring, m.stage === 'mata').done).length;
  const step = canScore ? nextStep(plist, teams, config, t.serverMatches, 1) : null;
  const sections = rankingSections(plist, teams, config, t.matches);
  const ctx = { name: tour.name, link: shareLink(code), code, players: plist, teams, config, matches: t.matches };
  const divs = divisionsOf(plist, config.modality);
  const division = divs.length > 1 && divs.some((d) => d.id === divF) ? divF : 'todos';
  const byDivision = division === 'todos' ? t.matches : t.matches.filter((m) => m.division === division);
  const groupIds = [...new Set(byDivision.map((m) => m.grp).filter((g): g is string => !!g))].sort();
  const group = groupIds.length > 1 && groupIds.includes(grpF) ? grpF : 'todos';
  // a final junta os grupos, então aparece em qualquer filtro de grupo
  const shownMatches = group === 'todos' ? byDivision : byDivision.filter((m) => m.grp === group || !m.grp);
  const shownPlayers = division === 'todos' ? plist : divs.find((d) => d.id === division)!.players;
  const pods = podiums(plist, teams, config, t.matches).filter((p) => division === 'todos' || p.division === division);
  const artInfo = { name: tour.name, date: new Date(tour.createdAt).toLocaleDateString('pt-BR'), site: `${location.host}${location.pathname.replace(/\/$/, '')}` || 'super8 ao vivo', code };
  const openCard = (id: string | null) => { setCardId(id); setCardOpen(true); };
  const shownSections = sections.filter((s) => (division === 'todos' || s.division === division) && (group === 'todos' || s.kind !== 'grupo' || s.id.endsWith(`-${group}`)));

  async function share(text: string) {
    if (await copyText(text)) toast('Copiado. É só colar no grupo.');
    else setCopyFallback(text);
  }

  async function generate() {
    if (!credential || generating) return;
    const fresh = nextStep(plist, teams, config, t.serverMatches, randomSeed());
    if (!fresh) return;
    setGenerating(true);
    try {
      await api.addMatches(code, credential, fresh.matches);
      t.notify();
      toast(`${fresh.title.replace('Gerar ', '')} gerada.`.replace(/^./, (s) => s.toUpperCase()));
    } catch (e) {
      const c = e instanceof ApiFail ? e.code : 'SERVIDOR';
      if (c === 'SEM_PERMISSAO') setSaved(upsertSaved({ code, token: undefined }));
      toast(errorText[c]);
    } finally {
      await t.reload();
      setGenerating(false);
    }
  }

  return (
    <>
      {header}

      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4">
        {divs.length > 1 && tab !== 'info' && (
          <div role="group" aria-label="Mostrar" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 shadow-card">
            {[{ id: 'todos', label: 'Todos' }, ...divs.map((d) => ({ id: d.id, label: d.label }))].map((o) => (
              <button key={o.id} type="button" aria-pressed={division === o.id} onClick={() => setDivF(o.id)}
                className={cx('min-h-[44px] rounded-lg font-bold', division === o.id ? (o.id === 'M' ? 'bg-sun text-surface' : o.id === 'H' ? 'bg-sea text-surface' : 'bg-ink text-bg') : 'text-muted')}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {groupIds.length > 1 && tab !== 'info' && (
          <div role="group" aria-label="Grupo" className="flex gap-1 rounded-xl bg-surface p-1 shadow-card">
            {['todos', ...groupIds].map((g) => (
              <button key={g} type="button" aria-pressed={group === g} onClick={() => setGrpF(g)}
                className={cx('min-h-[44px] flex-1 rounded-lg font-bold', group === g ? 'bg-ink text-bg' : 'text-muted')}>
                {g === 'todos' ? 'Todos' : `Grupo ${g}`}
              </button>
            ))}
          </div>
        )}
        {!canScore && tab === 'jogos' && !finished && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 shadow-card">
            <span className="text-[15px]">Você está assistindo. Para lançar placar, entre com o PIN.</span>
            <Button onClick={() => setPinOpen(true)}>Sou árbitro</Button>
          </div>
        )}

        {tab === 'jogos' && (
          <GamesView
            matches={shownMatches} players={players} plist={shownPlayers} config={config} canScore={canScore}
            onPoint={(id, side, delta) => t.point(id, side, delta)}
            step={step} generating={generating} onGenerate={generate} finished={finished} onRanking={() => setTab('ranking')}
          />
        )}

        {tab === 'ranking' && (
          <>
            {pods.length > 0 && (
              <button type="button" onClick={() => setPodiumOpen(true)}
                className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3.5 text-left text-bg shadow-card">
                <span className="ball h-11 w-11 flex-none" aria-hidden />
                <span className="min-w-0 flex-1">
                  <b className="block font-display text-[22px] font-black uppercase leading-none">Arte dos campeões</b>
                  <span className="text-sm opacity-85">Põe a foto do pódio e vira capa de revista. Story ou Feed.</span>
                </span>
                <span className="flex-none rounded-full bg-ball px-3 py-1.5 text-sm font-extrabold text-ballink">Abrir</span>
              </button>
            )}
            {done > 0 && (
              <button type="button" onClick={() => openCard(null)}
                className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-left shadow-card">
                <span aria-hidden className="grid h-12 w-10 flex-none place-items-center rounded-md bg-ball font-display text-xl font-black text-ballink [clip-path:polygon(18%_0,82%_0,100%_14%,100%_80%,50%_100%,0_80%,0_14%)]">87</span>
                <span className="min-w-0 flex-1">
                  <b className="block font-display text-[22px] font-black uppercase leading-none">Minha cartinha</b>
                  <span className="text-sm text-muted">Sua carta com nota e números do torneio. Ou toque no seu nome no ranking.</span>
                </span>
                <span className="flex-none rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-extrabold">Gerar</span>
              </button>
            )}
            {config.format === 'grupos' && <Bracket matches={shownMatches} teams={teams} players={players} config={config} divisionLabel={(id) => divisionsOf(plist, config.modality).find((d) => d.id === id)?.label ?? id} />}
            {divisionsWithFinal(plist, config, t.matches).filter((d) => division === 'todos' || d === division).map((d) => {
              const f = t.matches.find((m) => m.division === d && m.stage === 'mata' && m.label === 'Final');
              const w = finalWinners(d, config, t.matches);
              const nm = (ids: string[]) => ids.map((id) => players.get(id)?.name ?? '?').join(' & ');
              const label = divs.find((x) => x.id === d)?.label ?? '';
              return (
                <section key={`final-${d}`} className={cx('rounded-xl p-4 shadow-card', w ? 'bg-ball text-ballink' : 'bg-surface')}>
                  <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">{w ? (pods.find((p) => p.division === d)?.headline ?? 'Campeões') : 'Final'}{divs.length > 1 ? ` · ${label}` : ''}</span>
                  {w ? (
                    <div className="font-display text-[28px] font-black uppercase leading-tight">{nm(w)}</div>
                  ) : f ? (
                    <p className="m-0 mt-1 text-[15px]"><b>{nm(f.a)}</b> x <b>{nm(f.b)}</b>{f.sets.length ? ` · ${formatScore(f.sets, config.scoring)}` : ''}</p>
                  ) : (
                    <p className="m-0 mt-1 text-[15px] text-muted">Final cruzada: 1º do A + 2º do B contra 2º do A + 1º do B, quando os jogos de grupo acabarem.</p>
                  )}
                  {w && f && <p className="m-0 mt-1 text-sm font-semibold">Final: {nm(f.a)} {formatScore(f.sets, config.scoring)} {nm(f.b)}</p>}
                </section>
              );
            })}
            <RankingSections sections={shownSections} players={players} config={config} finished={finished} onPlayer={isIndividual(config.format) ? (id) => openCard(id) : undefined} />
            <Button block onClick={() => share(rankingMessage(ctx))}>Copiar ranking para o grupo</Button>
          </>
        )}

        {tab === 'info' && (
          <InfoView
            code={code} tour={tour} isAdmin={isAdmin} canScore={canScore} adminKey={saved?.adminKey}
            onShare={() => setShareOpen(true)} onCopySchedule={() => share(scheduleMessage(ctx))}
            onPin={() => setPinOpen(true)}
            onLeave={() => { setSaved(upsertSaved({ code, token: undefined })); toast('Você saiu do modo árbitro neste aparelho.'); }}
            onAdmin={(key) => { setSaved(upsertSaved({ code, adminKey: key })); toast('Pronto: este aparelho agora é organizador.'); }}
            reload={async () => { const ok = await t.reload(); t.notify(); return ok; }} anyScore={t.matches.some((m) => m.sets.length > 0)}
          />
        )}
      </main>

      <nav aria-label="Seções" className="gutter fixed inset-x-0 bottom-0 z-20 border-t border-hair bg-surface pb-[max(8px,env(safe-area-inset-bottom,0px))] pt-0 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.5)]">
        <div className="-mx-4 h-[3px] bg-hair sm:mx-0" aria-hidden><i className="block h-full bg-ball transition-[width]" style={{ width: real.length ? `${(done / real.length) * 100}%` : '0%' }} /></div>
        <div className="mx-auto flex max-w-[760px] gap-1 pt-2" role="tablist">
          {(['jogos', 'ranking', 'info'] as Tab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); window.scrollTo(0, 0); }}
              className={cx('flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-[10px] px-1 text-[15px] font-bold leading-tight', tab === k ? 'bg-ink text-bg' : 'text-muted')}>
              {k === 'jogos' ? 'Jogos' : k === 'ranking' ? 'Ranking' : 'Info'}
              {k === 'jogos' && <span className={cx('mt-0.5 rounded-full px-2 text-[11px] tabnum', tab === k ? 'bg-ball text-ballink' : 'bg-hair')}>{done}/{real.length}</span>}
            </button>
          ))}
        </div>
      </nav>

      <PinSheet open={pinOpen} code={code} onClose={() => setPinOpen(false)} onUnlocked={(token) => { setSaved(upsertSaved({ code, token })); setPinOpen(false); toast('Pronto: você pode lançar placar.'); }} />
      <ShareSheet open={shareOpen} code={code} name={tour.name} onClose={() => setShareOpen(false)} onCopy={share} />
      <CopySheet text={copyFallback} onClose={() => setCopyFallback(null)} />
      <PodiumSheet open={podiumOpen} onClose={() => setPodiumOpen(false)} podiums={pods} info={artInfo} />
      <CardSheet open={cardOpen} onClose={() => setCardOpen(false)} info={artInfo} initialId={cardId}
        groups={divs.map((d) => ({ label: divs.length > 1 ? d.label : 'Jogadores', players: d.players }))}
        makeCard={(id) => playerCard(plist, teams, config, t.matches, id)} />
      {welcomeSheet}
    </>
  );
}

function Shell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <>
      <header className="band-lines bg-band text-bandink">
        <div className="gutter relative z-[1] mx-auto flex max-w-[760px] items-center gap-3 py-5">
          <a href="#/" aria-label="Início" className="ball h-11 w-11" />
          <h1 className="m-0 font-display text-[34px] font-black uppercase tracking-[.12em]">{code}</h1>
        </div>
      </header>
      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-16 pt-5">{children}</main>
    </>
  );
}

function LiveBadge({ live, reachable, pending }: { live: string; reachable: boolean; pending: number }) {
  if (!reachable) return <span className="inline-flex items-center gap-1.5 font-semibold text-ball">● Sem conexão{pending ? ` · ${pending} na fila` : ''}</span>;
  if (pending) return <span className="inline-flex items-center gap-1.5 font-semibold text-ball">● Enviando {pending}</span>;
  if (live === 'ao_vivo') return <span className="inline-flex items-center gap-1.5 font-semibold"><i className="live-dot" aria-hidden /> Ao vivo</span>;
  if (live === 'offline') return <span className="font-semibold opacity-80">Atualiza a cada 15 s</span>;
  return <span className="font-semibold opacity-80">Conectando…</span>;
}

function GamesView({ matches, players, plist, config, canScore, onPoint, step, generating, onGenerate, finished, onRanking }: {
  matches: Match[]; players: Map<string, Player>; plist: Player[]; config: import('../engine').Config; canScore: boolean;
  onPoint: (id: string, side: 'a' | 'b', delta: 1 | -1) => void; step: { title: string } | null; generating: boolean;
  onGenerate: () => void; finished: boolean; onRanking: () => void;
}) {
  const showGender = config.modality === 'mista' || (config.modality === 'livre' && config.ranking.separarGenero);
  const blocks = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const k = m.stage === 'mata' ? `mata|${String(m.round).padStart(3, '0')}` : `r|${String(m.round).padStart(3, '0')}`;
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, ms]) => ({ key: k, ms }));
  }, [matches]);

  const isDone = (m: Match) => evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done;
  const current = blocks.findIndex((b) => b.ms.some((m) => !isDone(m)));
  const numbers = new Map(matches.map((m, i) => [m.id, i + 1]));
  const divs = divisionsOf(plist, config.modality);
  const individual = isIndividual(config.format);
  const groupOf = useMemo(() => {
    const g = new Map<string, string>();
    for (const m of matches) if (m.grp && m.stage === 'rodada') for (const id of [...m.a, ...m.b]) g.set(id, `${m.division}|${m.grp}`);
    return g;
  }, [matches]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="navigation" aria-label="Rodadas">
        {blocks.map((b, i) => {
          const allDone = b.ms.every(isDone);
          const label = b.ms[0].stage === 'mata' ? (b.ms[0].label?.replace(/ \d+$/, '') ?? 'Mata') : `R${b.ms[0].round}`;
          return (
            <a key={b.key} href={`#bloco-${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`bloco-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={cx('flex min-h-[38px] flex-none items-center rounded-full border-[1.5px] px-3.5 text-sm font-bold no-underline', i === current ? 'border-transparent bg-ball text-ballink' : allDone ? 'border-hair bg-surface text-muted' : 'border-hair bg-surface text-ink')}>
              {label}{allDone ? ' ✓' : ''}
            </a>
          );
        })}
      </div>

      {finished && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ball px-4 py-3 text-ballink">
          <b className="font-display text-2xl font-black uppercase">Torneio encerrado</b>
          <button type="button" onClick={onRanking} className="rounded-lg bg-ballink px-3 py-2 font-bold text-ball">Ver resultado</button>
        </div>
      )}

      {step && (
        <Button kind="primary" block disabled={generating} onClick={onGenerate}>{generating ? 'Gerando…' : step.title}</Button>
      )}

      <div className="flex flex-col gap-7">
        {blocks.map((b, i) => {
          const first = b.ms[0];
          const allDone = b.ms.every(isDone);
          const playing = new Set(b.ms.flatMap((m) => [...m.a, ...m.b]));
          // com grupos, folga só de quem é de um grupo que joga nesta rodada
          const rest = individual && first.stage !== 'mata'
            ? plist.filter((p) => !playing.has(p.id) && divs.some((d) => d.players.some((x) => x.id === p.id))
              && (!groupOf.size || b.ms.some((m) => `${m.division}|${m.grp}` === groupOf.get(p.id))))
            : [];
          const collapsed = allDone && i !== current && !open.has(b.key);
          const title = first.stage === 'mata' ? (first.label?.replace(/ \d+$/, '') ?? 'Mata-mata') : `Rodada ${first.round}`;
          if (collapsed) {
            return (
              <section key={b.key} id={`bloco-${i}`} className="scroll-mt-4">
                <button type="button" onClick={() => toggle(b.key)} aria-expanded={false}
                  className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl bg-surface px-4 text-left shadow-card">
                  <span className="font-display text-2xl font-black uppercase text-muted">{title}</span>
                  <Pill className="border-[1.5px] border-hair text-muted">Encerrada</Pill>
                  <span className="ml-auto text-sm font-bold text-muted">Ver {b.ms.length} jogo{b.ms.length > 1 ? 's' : ''} ▾</span>
                </button>
              </section>
            );
          }
          return (
            <section key={b.key} id={`bloco-${i}`} className="flex scroll-mt-4 flex-col gap-2.5">
              <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <h3 className={cx('m-0 font-display text-[28px] font-black uppercase leading-none', allDone && 'text-muted')}>
                  {first.stage === 'mata' ? (first.label?.replace(/ \d+$/, '') ?? 'Mata-mata') : `Rodada ${first.round}`}
                </h3>
                {i === current && <Pill className="bg-ball text-ballink">Agora</Pill>}
                {allDone && <button type="button" onClick={() => toggle(b.key)} aria-expanded className="rounded-full border-[1.5px] border-hair px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">Encerrada · recolher ▴</button>}
                {rest.length > 0 && (
                  <p className="m-0 ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span className="text-[11px] font-extrabold uppercase tracking-[.12em]">Folga</span>
                    {rest.map((p) => <Name key={p.id} p={p} showGender={showGender} size="md" />)}
                  </p>
                )}
              </header>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {b.ms.map((m) => (
                  <MatchCard key={m.id} match={m} number={numbers.get(m.id) ?? 0} players={players} scoring={config.scoring} canScore={canScore && !finished} showGender={showGender}
                    onPoint={(side, delta) => onPoint(m.id, side, delta)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function InfoView({ code, tour, isAdmin, canScore, adminKey, onShare, onCopySchedule, onPin, onLeave, onAdmin, reload, anyScore }: {
  code: string; tour: NonNullable<ReturnType<typeof useTournament>['tournament']>; isAdmin: boolean; canScore: boolean; adminKey?: string;
  onShare: () => void; onCopySchedule: () => void; onPin: () => void; onLeave: () => void; onAdmin: (key: string) => void; reload: () => Promise<boolean>; anyScore: boolean;
}) {
  const toast = useToast();
  const { config } = tour;
  const [names, setNames] = useState<Player[] | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyOpen, setKeyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows: [string, string][] = [
    ['Modalidade', MODALITY_LABEL[config.modality]],
    ['Formato', FORMAT_LABEL[config.format]],
    ['Partida', scoringLabel(config.scoring)],
    ['Ranking', `${config.ranking.base === 'games' ? 'Games feitos' : 'Vitória 3 · Empate 1 · Derrota 0'}${config.ranking.media ? ' (média por jogo)' : ''}`],
    ['Quadras', String(config.courts)],
    ...(isIndividual(config.format) ? [['Rodadas', String(config.rounds)] as [string, string]] : []),
    ...(config.format === 'grupos' ? [['Grupos', `${config.groups}, classificam ${config.qualify} por grupo`] as [string, string]] : []),
    ['Jogadores', String(tour.data.players.length)],
  ];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); await reload(); return true; }
    catch (e) { toast(errorText[e instanceof ApiFail ? e.code : 'SERVIDOR']); return false; }
    finally { setBusy(false); }
  };

  return (
    <>
      <Panel title="Compartilhar">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Button kind="primary" className="!text-lg" onClick={onShare}>Link e QR code</Button>
          <Button onClick={onCopySchedule}>Copiar tabela de jogos</Button>
          <a href={`#/t/${code}/telao`} className="flex min-h-[48px] items-center justify-center rounded-[10px] border-[1.5px] border-ink font-bold text-ink no-underline min-[420px]:col-span-2">Abrir modo telão</a>
        </div>
      </Panel>

      <Panel title="Regras">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
          {rows.map(([k, v]) => (<Fragment key={k}><dt className="font-bold">{k}</dt><dd className="m-0 text-muted">{v}</dd></Fragment>))}
        </dl>
      </Panel>

      <Panel title="Acesso">
        <p className="m-0 mb-3 text-[15px]">
          Neste aparelho você é <b>{isAdmin ? 'organizador' : canScore ? 'árbitro' : 'público'}</b>.
        </p>
        {!canScore && <Button block onClick={onPin}>Entrar com o PIN de árbitro</Button>}
        {canScore && !isAdmin && <Button block onClick={onLeave}>Sair do modo árbitro</Button>}
        {!isAdmin && (
          !keyOpen ? (
            <Button kind="quiet" className="mt-2" onClick={() => setKeyOpen(true)}>Tenho a chave do organizador</Button>
          ) : (
            <form className="mt-3 flex flex-col gap-2" onSubmit={async (e) => {
              e.preventDefault();
              const key = keyInput.trim();
              if (!key || busy) return;
              setBusy(true);
              try { await api.adminCheck(code, key); onAdmin(key); setKeyInput(''); setKeyOpen(false); }
              catch (x) { toast(x instanceof ApiFail && x.code === 'SEM_PERMISSAO' ? 'Chave errada. Confira se copiou inteira.' : errorText[x instanceof ApiFail ? x.code : 'SERVIDOR']); }
              finally { setBusy(false); }
            }}>
              <input id="chave-org" aria-label="Chave do organizador" autoComplete="off" autoCapitalize="none" spellCheck={false} value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)} placeholder="Cole a chave aqui"
                className="min-h-[48px] w-full rounded-[10px] border-[1.5px] border-hair bg-bg px-3 font-mono text-base text-ink" />
              <Button kind="primary" type="submit" className="!text-xl" disabled={busy || keyInput.trim().length < 16}>Entrar como organizador</Button>
            </form>
          )
        )}
      </Panel>

      {isAdmin && adminKey && (
        <Panel title="Organizador">
          <div className="flex flex-col gap-4">
            <div>
              <b>Critério do ranking</b>
              <p className="m-0 text-[13px] text-muted">Pode trocar quando quiser: o ranking é recalculado com os placares que já foram lançados.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['games', 'Games feitos'], ['resultado', 'Vitória 3 · Empate 1']] as const).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={config.ranking.base === v} disabled={busy}
                    onClick={() => { if (config.ranking.base !== v) void run(() => api.adminRanking(code, adminKey, { ...config.ranking, base: v }), 'Critério do ranking trocado.'); }}
                    className={cx('min-h-[52px] rounded-[10px] border-[1.5px] px-2 font-bold', config.ranking.base === v ? 'border-ink bg-ink text-bg' : 'border-hair')}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex min-h-[44px] items-center gap-3 text-[15px]">
                <input type="checkbox" className="h-6 w-6 accent-[var(--sea)]" checked={config.ranking.media} disabled={busy}
                  onChange={(e) => void run(() => api.adminRanking(code, adminKey, { ...config.ranking, media: e.target.checked }), e.target.checked ? 'Ranking por média por partida.' : 'Ranking pelo total.')} />
                Usar média por partida
              </label>
            </div>

            <div>
              <b>Corrigir nomes</b>
              {names === null ? (
                <Button className="mt-2" block onClick={() => setNames(tour.data.players.map((p) => ({ ...p })))}>Editar nomes</Button>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {names.map((p, i) => (
                    <input key={p.id} id={`edit-${p.id}`} aria-label={`Nome ${i + 1}`} value={p.name} maxLength={40}
                      onChange={(e) => setNames(names.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                      className="min-h-[44px] rounded-[9px] border-[1.5px] border-hair bg-bg px-3 font-semibold text-ink" />
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <Button kind="primary" className="!text-lg" disabled={busy || names.some((p) => !p.name.trim())}
                      onClick={async () => { if (await run(() => api.adminUpdate(code, adminKey, tour.name, { ...tour.data, players: names.map((p) => ({ ...p, name: p.name.trim() })) }, tour.version), 'Nomes salvos.')) setNames(null); }}>Salvar</Button>
                    <Button onClick={() => setNames(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <b>Trocar PIN do árbitro</b>
              <p className="m-0 text-[13px] text-muted">Quem entrou com o PIN antigo perde o acesso na hora.</p>
              <div className="mt-2 flex gap-2">
                <input id="novo-pin" aria-label="Novo PIN" inputMode="numeric" maxLength={8} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Novo PIN" className="min-h-[44px] w-full min-w-0 rounded-[9px] border-[1.5px] border-hair bg-bg px-3 font-display text-2xl font-black tracking-[.25em] text-ink" />
                <Button disabled={busy || !/^\d{4,8}$/.test(newPin)} onClick={async () => { if (await run(() => api.adminPin(code, adminKey, newPin), `PIN trocado para ${newPin}.`)) setNewPin(''); }}>Trocar</Button>
              </div>
            </div>

            <div>
              <b>Sortear de novo</b>
              <p className="m-0 text-[13px] text-muted">Refaz a chave com os mesmos jogadores e regras. O código continua o mesmo.</p>
              {!confirmReset ? (
                <Button className="mt-2" block onClick={() => setConfirmReset(true)}>Sortear de novo</Button>
              ) : (
                <div className="mt-2 flex flex-col gap-2 rounded-xl bg-tintwarn p-3">
                  <b>{anyScore ? 'Isso apaga os placares que já foram lançados.' : 'A chave atual vai ser trocada por um sorteio novo.'}</b>
                  <div className="grid grid-cols-2 gap-2">
                    <Button kind="danger" disabled={busy} onClick={async () => {
                      const built = buildInitial(tour.data.players, config, randomSeed());
                      if (await run(() => api.adminReset(code, adminKey, config, { players: tour.data.players, teams: built.teams }, built.matches), 'Chave sorteada de novo.')) setConfirmReset(false);
                    }}>{anyScore ? 'Apagar e sortear' : 'Sortear'}</Button>
                    <Button onClick={() => setConfirmReset(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}

function PinSheet({ open, code, onClose, onUnlocked }: { open: boolean; code: string; onClose: () => void; onUnlocked: (token: string) => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="PIN do árbitro">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^\d{4,8}$/.test(pin) || busy) return;
          setBusy(true);
          setErr(null);
          try {
            const r = await api.unlock(code, pin);
            setPin('');
            onUnlocked(r.token);
          } catch (x) {
            setErr(errorText[x instanceof ApiFail ? x.code : 'SERVIDOR']);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input id="pin-arbitro" aria-label="PIN" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="min-h-[56px] rounded-[10px] border-[1.5px] border-hair bg-bg px-3 text-center font-display text-4xl font-black tracking-[.4em] text-ink" />
        {err && <Note kind="warn">{err}</Note>}
        <Button kind="primary" type="submit" block disabled={busy || !/^\d{4,8}$/.test(pin)}>{busy ? 'Conferindo…' : 'Entrar'}</Button>
      </form>
    </Sheet>
  );
}

function ShareSheet({ open, code, name, onClose, onCopy }: { open: boolean; code: string; name: string; onClose: () => void; onCopy: (t: string) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const link = shareLink(code);
  useEffect(() => {
    if (!open) return;
    const dark = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#12334a';
    void QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: dark.startsWith('#') && dark.length === 7 ? dark : '#12334a', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
  }, [open, link]);
  return (
    <Sheet open={open} onClose={onClose} title="Compartilhar">
      <div className="flex flex-col items-center gap-3">
        {qr && <img src={qr} alt={`QR code do torneio ${code}`} className="w-[min(260px,70vw)] rounded-xl bg-white p-2" />}
        <p className="m-0 font-display text-4xl font-black tracking-[.14em]">{code}</p>
        <p className="m-0 w-full select-all break-all rounded-[10px] bg-bg p-3 text-center text-sm">{link}</p>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Button kind="primary" className="!text-lg" onClick={() => onCopy(`🎾 ${name}\nAcompanhe ao vivo: ${link}\nCódigo: ${code}`)}>Copiar convite</Button>
          <Button onClick={() => onCopy(link)}>Copiar só o link</Button>
        </div>
      </div>
    </Sheet>
  );
}

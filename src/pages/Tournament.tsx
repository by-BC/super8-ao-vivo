import QRCode from 'qrcode';
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildInitial, divisionsOf, divisionsWithFinal, evaluate, finalWinners, formatScore, isIndividual, nextStep, playerCard, podiums, randomSeed, rankingMessage, rankingSections, scheduleMessage,
  scoringLabel, tournamentStatus, type Match, type Player,
} from '../engine';
import { MatchCard, Name } from '../components/MatchCard';
import { PodiumSheet } from '../components/PodiumSheet';
import { CardSheet } from '../components/CardSheet';
import { SignupView } from './Signup';
import { Check, TiebreakEditor } from './Create';
import { Bracket, RankingSections, ResultPodium } from '../components/Ranking';
import { Avatar, Button, copyText, CopySheet, cx, Note, Panel, Pill, RosterCtx, Sheet, useToast } from '../components/ui';
import { api, ApiFail, errorText } from '../lib/api';
import { getSaved, upsertSaved } from '../lib/local';
import { go, shareLink } from '../lib/router';
import { useTournament } from '../lib/useTournament';
import { useWakeLock } from '../lib/useWakeLock';
import { characterRoster, charactersFor } from '../lib/avatar';
import { CHARACTERS } from '../lib/characters';
import { Carregando, Costura, Simbolo } from '../components/Brand';
import { IconInfo, IconJogos, IconRanking } from '../components/Icons';
import { Folha, OndaAreia } from '../components/Decor';

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
  const [me, setMeState] = useState<string | null>(() => {
    try { return localStorage.getItem(`s8:eu:${code}`); } catch { return null; }
  });
  const setMe = (id: string | null) => {
    setMeState(id);
    try { if (id) localStorage.setItem(`s8:eu:${code}`, id); else localStorage.removeItem(`s8:eu:${code}`); } catch { /* ok */ }
  };
  const [meOpen, setMeOpen] = useState(false);
  // árbitro na aba de jogos: a tela não apaga no meio da partida
  useWakeLock(canScore && tab === 'jogos');

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
  const roster = useMemo(() => characterRoster(tour?.data.players ?? []), [tour]);

  if (t.state === 'carregando') return <Shell code={code}><Carregando label="Carregando o torneio…" /></Shell>;
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
    <header className="relative overflow-hidden bg-band text-bandink">
      <Folha className="absolute -right-6 -top-8 h-36 w-36 rotate-[200deg] opacity-[.13]" />
      <div className="gutter relative mx-auto flex max-w-[760px] items-center gap-3 py-4">
        <a href="#/" aria-label="Início" className="flex-none"><Simbolo onBand size={40} /></a>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-display text-[clamp(24px,7.5vw,32px)] font-extrabold leading-[.92] [overflow-wrap:break-word]">{tour.name}</h1>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-snug opacity-90">
            <LiveBadge live={t.live} reachable={t.reachable} pending={t.pending} />
            <span>· {config.formatLater && tour.phase === 'inscricao' ? 'Formato a definir' : FORMAT_LABEL[config.format]}</span>
          </p>
        </div>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-none flex-col items-center rounded-lg border-[1.5px] border-current px-2 py-1" aria-label={`Compartilhar código ${code}`}>
          <span className="text-[9px] font-bold uppercase tracking-[.14em] opacity-80">Código</span>
          <span className="font-display text-xl font-extrabold tracking-[.1em]">{code}</span>
        </button>
      </div>
    </header>
  );
  const welcomeSheet = (
    <Sheet open={!!welcome} onClose={() => setWelcome(null)} title="Torneio criado">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px]">{tour.phase === 'inscricao' ? 'Agora copie o convite e mande no grupo: cada um se inscreve pelo link. Quando fechar a lista, você sorteia aqui.' : 'Mande o link ou o código para a galera. O PIN é só para quem vai lançar placar.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-bg p-3"><small className="block text-xs font-bold uppercase tracking-[.12em] text-muted">Código</small><b className="font-display text-3xl tracking-[.12em]">{code}</b></div>
          <div className="rounded-lg bg-bg p-3"><small className="block text-xs font-bold uppercase tracking-[.12em] text-muted">PIN árbitro</small><b className="font-display text-3xl tracking-[.2em]">{welcome?.pin}</b></div>
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
  const active = plist.filter((p) => !p.left);
  const step = canScore ? nextStep(active, teams, config, t.serverMatches, 1) : null;
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
  const artInfo = { charOf: (n: string) => roster.byName.get(n), name: tour.name, date: new Date(tour.createdAt).toLocaleDateString('pt-BR'), site: `${location.host}${location.pathname.replace(/\/$/, '')}` || 'super8 ao vivo', code };
  const openCard = (id: string | null) => { setCardId(id); setCardOpen(true); };
  const shownSections = sections.filter((s) => (division === 'todos' || s.division === division) && (group === 'todos' || s.kind !== 'grupo' || s.id.endsWith(`-${group}`)));

  const meId = me && players.has(me) ? me : null;

  /** Lança o game e oferece desfazer por alguns segundos (dedo grosso na areia). */
  function point(id: string, side: 'a' | 'b', delta: 1 | -1) {
    t.point(id, side, delta);
    const m = t.matches.find((x) => x.id === id);
    const who = m ? (side === 'a' ? m.a : m.b).map((p) => players.get(p)?.name ?? '?').join(' e ') : '';
    toast(delta > 0 ? `+1 game: ${who}` : `−1 game: ${who}`, {
      key: 'ponto', ms: 4500,
      action: { label: 'Desfazer', run: () => t.point(id, side, delta > 0 ? -1 : 1) },
    });
  }

  async function share(text: string) {
    if (await copyText(text)) toast('Copiado. É só colar no grupo.');
    else setCopyFallback(text);
  }

  async function generate() {
    if (!credential || generating) return;
    const fresh = nextStep(active, teams, config, t.serverMatches, randomSeed());
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
    <RosterCtx.Provider value={roster}>
      {header}

      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4">
        {divs.length > 1 && tab !== 'info' && (
          <div role="group" aria-label="Mostrar" className="grid grid-cols-3 gap-1 rounded-lg bg-surface p-1 shadow-card">
            {[{ id: 'todos', label: 'Todos' }, ...divs.map((d) => ({ id: d.id, label: d.label }))].map((o) => (
              <button key={o.id} type="button" aria-pressed={division === o.id} onClick={() => setDivF(o.id)}
                className={cx('min-h-[44px] rounded-lg font-bold', division === o.id ? 'bg-ink text-bg' : 'text-muted')}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {groupIds.length > 1 && tab !== 'info' && (
          <div role="group" aria-label="Grupo" className="flex gap-1 rounded-lg bg-surface p-1 shadow-card">
            {['todos', ...groupIds].map((g) => (
              <button key={g} type="button" aria-pressed={group === g} onClick={() => setGrpF(g)}
                className={cx('min-h-[44px] flex-1 rounded-lg font-bold', group === g ? 'bg-ink text-bg' : 'text-muted')}>
                {g === 'todos' ? 'Todos' : `Grupo ${g}`}
              </button>
            ))}
          </div>
        )}
        {!canScore && tab === 'jogos' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-4 py-3 shadow-card">
            <span className="text-[15px]">{finished ? 'Precisa corrigir algum placar? Entre com o PIN.' : 'Você está assistindo. Para lançar placar, entre com o PIN.'}</span>
            <Button onClick={() => setPinOpen(true)}>Sou árbitro</Button>
          </div>
        )}

        {tab === 'jogos' && (
          <MeCard me={meId} matches={t.matches} players={players} config={config} onPick={() => setMeOpen(true)} />
        )}

        {tab === 'jogos' && (
          <GamesView
            matches={shownMatches} players={players} plist={shownPlayers} config={config} canScore={canScore} me={meId} jumpOnOpen={!meId}
            onPoint={point}
            step={step} generating={generating} onGenerate={generate} finished={finished} onRanking={() => setTab('ranking')}
          />
        )}

        {tab === 'ranking' && (
          <>
            {pods.map((p) => <ResultPodium key={p.division} podium={p} />)}
            {pods.length > 0 && (
              <button type="button" onClick={() => setPodiumOpen(true)}
                className="sol relative flex items-center gap-3 overflow-hidden rounded-lg px-4 pb-6 pt-3.5 text-left shadow-card">
                <OndaAreia />
                <span aria-hidden className="flex h-12 w-10 flex-none items-end justify-center gap-[3px] rounded-md bg-band px-1.5 pb-1.5">
                  <i className="block h-4 w-2 rounded-t-sm bg-bandraised" /><i className="block h-7 w-2 rounded-t-sm bg-podium" /><i className="block h-3 w-2 rounded-t-sm bg-bandraised" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block font-display text-[22px] font-extrabold leading-none">Arte dos campeões</b>
                  <span className="text-sm text-muted">Põe a foto do pódio e vira capa de revista. Story ou Feed.</span>
                </span>
                <span className="flex-none rounded-full bg-accent px-3 py-1.5 text-sm font-extrabold text-onaccent">Abrir</span>
              </button>
            )}
            {done > 0 && (
              <button type="button" onClick={() => openCard(null)}
                className="sol relative flex items-center gap-3 overflow-hidden rounded-lg px-4 pb-6 pt-3.5 text-left shadow-card">
                <OndaAreia />
                <span aria-hidden className="grid h-12 w-10 flex-none place-items-center rounded-md bg-accent font-display text-xl font-extrabold text-onaccent [clip-path:polygon(18%_0,82%_0,100%_14%,100%_80%,50%_100%,0_80%,0_14%)]">87</span>
                <span className="min-w-0 flex-1">
                  <b className="block font-display text-[22px] font-extrabold leading-none">Minha cartinha</b>
                  <span className="text-sm text-muted">Sua carta com nota e números do torneio. Ou toque no seu nome no ranking.</span>
                </span>
                <span className="flex-none rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-extrabold">Gerar</span>
              </button>
            )}
            {done > 0 && (
              <p className="m-0 px-1 text-[13px] text-muted">
                {finished ? 'Torneio encerrado: os dados somem às 3h da madrugada. Gere a arte e as cartinhas antes.' : 'Depois que o torneio acaba, os dados somem às 3h da madrugada.'}
              </p>
            )}
            {config.format === 'grupos' && <Bracket matches={shownMatches} teams={teams} players={players} config={config} divisionLabel={(id) => divisionsOf(plist, config.modality).find((d) => d.id === id)?.label ?? id} />}
            {divisionsWithFinal(plist, config, t.matches).filter((d) => division === 'todos' || d === division).map((d) => {
              const f = t.matches.find((m) => m.division === d && m.stage === 'mata' && m.label === 'Final');
              const w = finalWinners(d, config, t.matches);
              const nm = (ids: string[]) => ids.map((id) => players.get(id)?.name ?? '?').join(' e ');
              const label = divs.find((x) => x.id === d)?.label ?? '';
              if (w && pods.some((p) => p.division === d)) return null; // o pódio já mostra
              return (
                <section key={`final-${d}`} className={cx('rounded-lg p-4 shadow-card', w ? 'bg-accent text-onaccent' : 'bg-surface')}>
                  <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">{w ? (pods.find((p) => p.division === d)?.headline ?? 'Campeões') : 'Final'}{divs.length > 1 ? ` · ${label}` : ''}</span>
                  {w ? (
                    <div className="font-display text-[28px] font-extrabold leading-tight">{nm(w)}</div>
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
        <div className="-mx-4 h-[3px] bg-hair sm:mx-0" aria-hidden><i className="block h-full bg-accent transition-[width]" style={{ width: real.length ? `${(done / real.length) * 100}%` : '0%' }} /></div>
        <div className="mx-auto flex max-w-[760px] gap-1 pt-2" role="tablist">
          {(['jogos', 'ranking', 'info'] as Tab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); window.scrollTo(0, 0); }}
              className={cx('relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[13px] font-bold leading-tight', tab === k ? 'bg-accenttint text-accentink' : 'text-muted')}>
              {k === 'jogos' ? <IconJogos /> : k === 'ranking' ? <IconRanking /> : <IconInfo />}
              <span className="flex items-center gap-1">
                {k === 'jogos' ? 'Jogos' : k === 'ranking' ? 'Ranking' : 'Info'}
                {k === 'jogos' && <span className={cx('rounded-full px-1.5 text-[10px] tabnum', tab === k ? 'bg-accent text-onaccent' : 'bg-hair text-ink')}>{done}/{real.length}</span>}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <MeSheet open={meOpen} players={active} me={meId} onClose={() => setMeOpen(false)} onPick={(id) => { setMe(id); setMeOpen(false); }} />
      <PinSheet open={pinOpen} code={code} onClose={() => setPinOpen(false)} onUnlocked={(token) => { setSaved(upsertSaved({ code, token })); setPinOpen(false); toast('Pronto: você pode lançar placar.'); }} />
      <ShareSheet open={shareOpen} code={code} name={tour.name} onClose={() => setShareOpen(false)} onCopy={share} />
      <CopySheet text={copyFallback} onClose={() => setCopyFallback(null)} />
      <PodiumSheet open={podiumOpen} onClose={() => setPodiumOpen(false)} podiums={pods} info={artInfo} />
      <CardSheet open={cardOpen} onClose={() => setCardOpen(false)} info={artInfo} initialId={cardId}
        groups={divs.map((d) => ({ label: divs.length > 1 ? d.label : 'Jogadores', players: d.players }))}
        makeCard={(id) => playerCard(plist, teams, config, t.matches, id)} />
      {welcomeSheet}
    </RosterCtx.Provider>
  );
}

function Shell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <>
      <header className="bg-band text-bandink">
        <div className="gutter mx-auto flex max-w-[760px] items-center gap-3 py-5">
          <a href="#/" aria-label="Início" className="flex-none"><Simbolo onBand size={44} /></a>
          <h1 className="m-0 font-display text-[34px] font-extrabold tracking-[.12em]">{code}</h1>
        </div>
      </header>
      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-16 pt-5">{children}</main>
    </>
  );
}

function LiveBadge({ live, reachable, pending }: { live: string; reachable: boolean; pending: number }) {
  if (!reachable) return <span className="inline-flex items-center gap-1.5 font-semibold">● Sem conexão{pending ? ` · ${pending} na fila` : ''}</span>;
  if (pending) return <span className="inline-flex items-center gap-1.5 font-semibold">● Enviando {pending}</span>;
  if (live === 'ao_vivo') return <span className="inline-flex items-center gap-1.5 font-semibold"><i className="live-dot" aria-hidden /> Ao vivo</span>;
  if (live === 'offline') return <span className="font-semibold opacity-80">Atualiza a cada 15 s</span>;
  return <span className="font-semibold opacity-80">Conectando…</span>;
}

function GamesView({ matches, players, plist, config, canScore, me, jumpOnOpen, onPoint, step, generating, onGenerate, finished, onRanking }: {
  matches: Match[]; players: Map<string, Player>; plist: Player[]; config: import('../engine').Config; canScore: boolean; me: string | null; jumpOnOpen: boolean;
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
  const hasNextStages = config.format === 'mexicano' || matches.some((m) => m.stage === 'mata');
  const [open, setOpen] = useState<Set<string>>(new Set());

  // abre direto na rodada que está rolando e mostra um atalho quando ela sai da tela
  const jumped = useRef(false);
  const [away, setAway] = useState<'up' | 'down' | null>(null);
  const goCurrent = (smooth = true) => document.getElementById(`bloco-${current}`)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  useEffect(() => {
    if (jumped.current || current < 0) return;
    jumped.current = true;
    if (jumpOnOpen && current > 0) window.setTimeout(() => goCurrent(false), 50);
  }, [current]);
  useEffect(() => {
    const el = current >= 0 ? document.getElementById(`bloco-${current}`) : null;
    if (!el || typeof IntersectionObserver === 'undefined') { setAway(null); return; }
    const io = new IntersectionObserver(([e]) => {
      setAway(e.isIntersecting ? null : e.boundingClientRect.top < 0 ? 'up' : 'down');
    }, { rootMargin: '-80px 0px -120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [current, blocks.length]);
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="navigation" aria-label="Rodadas">
        {blocks.map((b, i) => {
          const allDone = b.ms.every(isDone);
          const label = b.ms[0].stage === 'mata' ? (b.ms[0].label?.replace(/ \d+$/, '') ?? 'Mata') : `R${b.ms[0].round}`;
          return (
            <a key={b.key} href={`#bloco-${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`bloco-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={cx('flex min-h-[38px] flex-none items-center rounded-full border-[1.5px] px-3.5 text-sm font-bold no-underline', i === current ? 'border-transparent bg-select text-onselect' : allDone ? 'border-line bg-surface text-muted' : 'border-line bg-surface text-ink')}>
              {label}{allDone ? ' ✓' : ''}
            </a>
          );
        })}
      </div>

      {away && (
        <button type="button" onClick={() => goCurrent()}
          className="fixed right-4 z-30 flex min-h-[48px] items-center gap-1.5 rounded-full bg-accent px-4 font-extrabold text-onaccent shadow-card bottom-[calc(100px+env(safe-area-inset-bottom,0px))]">
          {away === 'up' ? '↑' : '↓'} Rodada atual
        </button>
      )}

      {finished && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent px-4 py-3 text-onaccent">
          <b className="font-display text-2xl font-extrabold">Torneio encerrado</b>
          <button type="button" onClick={onRanking} className="rounded-lg bg-surface px-3 py-2 font-bold text-ink">Ver resultado</button>
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
                  className="flex min-h-[52px] w-full items-center gap-2.5 rounded-lg bg-surface px-4 text-left shadow-card">
                  <span className="font-display text-2xl font-extrabold text-muted">{title}</span>
                  <Pill className="border-[1.5px] border-line text-muted">Encerrada</Pill>
                  <span className="ml-auto text-sm font-bold text-muted">Ver {b.ms.length} jogo{b.ms.length > 1 ? 's' : ''} ▾</span>
                </button>
              </section>
            );
          }
          return (
            <section key={b.key} id={`bloco-${i}`} className="flex scroll-mt-4 flex-col gap-2.5">
              <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <h3 className={cx('m-0 font-display text-[28px] font-extrabold leading-none', allDone && 'text-muted')}>
                  {first.stage === 'mata' ? (first.label?.replace(/ \d+$/, '') ?? 'Mata-mata') : `Rodada ${first.round}`}
                </h3>
                {i === current && <Pill className="bg-select text-onselect">Agora</Pill>}
                {allDone && <button type="button" onClick={() => toggle(b.key)} aria-expanded className="rounded-full border-[1.5px] border-line px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">Encerrada · recolher ▴</button>}
                {rest.length > 0 && (
                  <p className="m-0 ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span className="text-[11px] font-extrabold uppercase tracking-[.12em]">Folga</span>
                    {rest.map((p) => <Name key={p.id} p={p} showGender={showGender} size="md" />)}
                  </p>
                )}
              </header>
              {i === current && <Costura className="my-1" />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {b.ms.map((m) => (
                  <MatchCard key={m.id} match={m} number={numbers.get(m.id) ?? 0} players={players} scoring={config.scoring} canScore={canScore} locked={finished} showGender={showGender} me={me}
                    lockedNote={hasNextStages && m.stage !== 'mata' ? 'Atenção: mudar esse placar atualiza o ranking, mas não refaz as rodadas ou o mata-mata que já foram gerados.' : undefined}
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
  const [pick, setPick] = useState<string | null>(null);
  const roster = useContext(RosterCtx) ?? { byId: new Map<string, number>(), byName: new Map<string, number>() };
  const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyOpen, setKeyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const showSeparar = isIndividual(config.format) && config.modality !== 'mesmo_genero';
  const TB: Record<string, string> = { vitorias: 'vitórias', saldo: 'saldo', confronto: 'confronto direto', games: 'games feitos' };

  const rows: [string, string][] = [
    ['Modalidade', MODALITY_LABEL[config.modality]],
    ['Formato', FORMAT_LABEL[config.format]],
    ['Partida', scoringLabel(config.scoring)],
    ['Ranking', `${config.ranking.base === 'games' ? 'Games feitos' : 'Vitória 3 · Empate 1 · Derrota 0'}${config.ranking.media ? ' (média por jogo)' : ''}`],
    ['Desempate', config.ranking.desempate.length ? config.ranking.desempate.map((k) => TB[k]).join(' → ') : 'sorteio'],
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
          <Button kind="primary" onClick={onShare}>Link e QR code</Button>
          <Button onClick={onCopySchedule}>Copiar tabela de jogos</Button>
          <a href={`#/t/${code}/telao`} className="flex min-h-[48px] items-center justify-center rounded-lg border-[1.5px] border-ink font-bold text-ink no-underline min-[420px]:col-span-2">Abrir modo telão</a>
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
                className="min-h-[48px] w-full rounded-lg border-[1.5px] border-line bg-bg px-3 font-mono text-base text-ink" />
              <Button kind="primary" type="submit" disabled={busy || keyInput.trim().length < 16}>Entrar como organizador</Button>
            </form>
          )
        )}
      </Panel>

      {isAdmin && adminKey && (
        <Panel title="Organizador">
          <div className="flex flex-col gap-4">
            <div>
              <b>Editar torneio</b>
              <p className="m-0 text-[13px] text-muted">
                Jogadores (incluir, tirar, gênero, nível), formato, tipo de partida, games, quadras, rodadas, grupos e duplas. Os placares ficam sempre que dá; antes de salvar o app mostra o que muda.
              </p>
              <Button kind="primary" className="mt-2" block onClick={() => go(`/t/${code}/editar`)}>Editar jogadores e regras</Button>
            </div>

            <div>
              <b>Nome do torneio</b>
              {newName === null ? (
                <Button className="mt-2" block onClick={() => setNewName(tour.name)}>Trocar o nome</Button>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <input id="novo-nome" aria-label="Nome do torneio" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="min-h-[44px] rounded-lg border-[1.5px] border-line bg-bg px-3 font-semibold text-ink" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button kind="primary" disabled={busy || !newName.trim()}
                      onClick={async () => { if (await run(() => api.adminUpdate(code, adminKey, newName.trim(), tour.data, tour.version), 'Nome trocado.')) setNewName(null); }}>Salvar</Button>
                    <Button onClick={() => setNewName(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <b>Critério do ranking</b>
              <p className="m-0 text-[13px] text-muted">Pode trocar quando quiser: o ranking é recalculado com os placares que já foram lançados.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['games', 'Games feitos'], ['resultado', 'Vitória 3 · Empate 1']] as const).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={config.ranking.base === v} disabled={busy}
                    onClick={() => { if (config.ranking.base !== v) void run(() => api.adminRanking(code, adminKey, { ...config.ranking, base: v }), 'Critério do ranking trocado.'); }}
                    className={cx('min-h-[52px] rounded-lg border-[1.5px] px-2 font-bold', config.ranking.base === v ? 'border-ink bg-ink text-bg' : 'border-line')}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex min-h-[44px] items-center gap-3 text-[15px]">
                <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={config.ranking.media} disabled={busy}
                  onChange={(e) => void run(() => api.adminRanking(code, adminKey, { ...config.ranking, media: e.target.checked }), e.target.checked ? 'Ranking por média por partida.' : 'Ranking pelo total.')} />
                Usar média por partida
              </label>
              {showSeparar && (
                <div className="mt-1">
                  <Check checked={config.ranking.separarGenero} title="Mostrar Rei e Rainha da areia" hint="Ranking dos homens e das mulheres, além do geral."
                    onChange={(v) => { if (!busy) void run(() => api.adminRanking(code, adminKey, { ...config.ranking, separarGenero: v }), v ? 'Rei e Rainha ligados.' : 'Rei e Rainha desligados.'); }} />
                </div>
              )}
              <div className={cx('mt-3', busy && 'pointer-events-none opacity-60')}>
                <TiebreakEditor value={config.ranking.desempate}
                  onChange={(desempate) => void run(() => api.adminRanking(code, adminKey, { ...config.ranking, desempate }), 'Desempate atualizado.')} />
              </div>
            </div>

            <div>
              <b>Nomes e personagens</b>
              {names === null ? (
                <Button className="mt-2" block onClick={() => setNames(tour.data.players.filter((p) => !p.left).map((p) => ({ ...p })))}>Editar nomes e personagens</Button>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="m-0 text-[13px] text-muted">Toque no boneco pra escolher o personagem de cada um.</p>
                  {names.map((p, i) => (
                    <div key={p.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Personagem de ${p.name}`} aria-expanded={pick === p.id} onClick={() => setPick(pick === p.id ? null : p.id)} className="rounded-full">
                          <Avatar name={p.name} character={p.avatar ?? roster.byId.get(p.id)} size={44} className={pick === p.id ? 'ring-[3px] ring-[var(--accent)]' : ''} />
                        </button>
                        <input id={`edit-${p.id}`} aria-label={`Nome ${i + 1}`} value={p.name} maxLength={40}
                          onChange={(e) => setNames(names.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                          className="min-h-[44px] min-w-0 flex-1 rounded-lg border-[1.5px] border-line bg-bg px-3 font-semibold text-ink" />
                      </div>
                      {pick === p.id && (
                        <div className="grid grid-cols-5 gap-2 rounded-lg bg-bg p-2.5" role="group" aria-label={`Escolher personagem de ${p.name}`}>
                          {charactersFor(p.gender).map((ci) => ({ c: CHARACTERS[ci], ci })).map(({ c, ci }) => (
                            <button key={c.id} type="button" title={c.label} aria-label={c.label} aria-pressed={p.avatar === ci}
                              onClick={() => { setNames(names.map((x) => (x.id === p.id ? { ...x, avatar: ci } : x))); setPick(null); }}
                              className={cx('grid place-items-center rounded-full p-0.5', p.avatar === ci && 'ring-[3px] ring-[var(--accent)]')}>
                              <Avatar name={p.name} character={ci} size={46} />
                            </button>
                          ))}
                          <button type="button" onClick={() => { setNames(names.map((x) => (x.id === p.id ? { ...x, avatar: undefined } : x))); setPick(null); }}
                            className="col-span-5 min-h-[40px] rounded-lg text-sm font-bold text-muted underline underline-offset-2">Deixar o app escolher</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <Button kind="primary" disabled={busy || names.some((p) => !p.name.trim())}
                      onClick={async () => { if (await run(() => api.adminUpdate(code, adminKey, tour.name, { ...tour.data, players: tour.data.players.map((p) => { const n = names.find((x) => x.id === p.id); return n ? { ...n, name: n.name.trim() } : p; }) }, tour.version), 'Nomes e personagens salvos.')) setNames(null); }}>Salvar</Button>
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
                  placeholder="Novo PIN" className="min-h-[44px] w-full min-w-0 rounded-lg border-[1.5px] border-line bg-bg px-3 font-body text-2xl font-bold tracking-[.25em] text-ink" />
                <Button disabled={busy || !/^\d{4,8}$/.test(newPin)} onClick={async () => { if (await run(() => api.adminPin(code, adminKey, newPin), `PIN trocado para ${newPin}.`)) setNewPin(''); }}>Trocar</Button>
              </div>
            </div>

            <div>
              <b>Sortear de novo</b>
              <p className="m-0 text-[13px] text-muted">Refaz a chave com os mesmos jogadores e regras. O código continua o mesmo. Pra mudar jogadores ou regras antes, use Editar jogadores e regras.</p>
              {!confirmReset ? (
                <Button className="mt-2" block onClick={() => setConfirmReset(true)}>Sortear de novo</Button>
              ) : (
                <div className="mt-2 flex flex-col gap-2 rounded-lg bg-tintwarn p-3">
                  <b>{anyScore ? 'Isso apaga os placares que já foram lançados.' : 'A chave atual vai ser trocada por um sorteio novo.'}</b>
                  <div className="grid grid-cols-2 gap-2">
                    <Button kind="danger" disabled={busy} onClick={async () => {
                      const ps = tour.data.players.filter((p) => !p.left);
                      const built = buildInitial(ps, config, randomSeed());
                      if (await run(() => api.adminReset(code, adminKey, config, { players: ps, teams: built.teams }, built.matches), 'Chave sorteada de novo.')) setConfirmReset(false);
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

/** "Sou eu": o próximo jogo de quem está com o celular na mão, no topo da aba Jogos. */
function MeCard({ me, matches, players, config, onPick }: {
  me: string | null; matches: Match[]; players: Map<string, Player>; config: import('../engine').Config; onPick: () => void;
}) {
  if (!me) {
    return (
      <button type="button" onClick={onPick} className="flex min-h-[56px] items-center gap-3 rounded-lg bg-surface px-4 py-3 text-left shadow-card">
        <span className="flex-1 text-[15px]"><b>Você está jogando?</b> <span className="text-muted">Toque e escolha seu nome pra ver seu próximo jogo.</span></span>
        <span className="flex-none rounded-full bg-accent px-3 py-1.5 text-sm font-extrabold text-onaccent">Sou eu</span>
      </button>
    );
  }
  const nm = (ids: string[]) => ids.map((id) => players.get(id)?.name ?? '?').join(' e ');
  const isDone = (m: Match) => evaluate(m.sets, config.scoring, m.stage === 'mata', m.stage === 'mata' && m.b.length === 0).done;
  const order = (m: Match) => (m.stage === 'mata' ? 1e6 : 0) + m.round * 1000 + m.slot;
  const mine = matches.filter((m) => m.a.includes(me) || m.b.includes(me)).sort((x, y) => order(x) - order(y));
  const next = mine.find((m) => !isDone(m) && m.b.length > 0);
  const played = mine.filter(isDone).length;
  const firstPending = [...matches].sort((x, y) => order(x) - order(y)).find((m) => !isDone(m));
  const now = next && firstPending && (next.stage === firstPending.stage && next.round === firstPending.round);
  const name = players.get(me)?.name ?? '?';
  return (
    <section className="sol relative flex flex-col gap-2 overflow-hidden rounded-lg px-4 pb-7 pt-3 shadow-card" aria-label={`Jogos de ${name}`}>
      <Folha className="absolute -right-5 -top-6 h-28 w-28 rotate-[205deg] text-dourado opacity-40" />
      <OndaAreia />
      <div className="relative flex items-center gap-2">
        <Avatar id={me} name={name} size={30} />
        <span className="text-xs font-extrabold uppercase tracking-[.12em] text-muted">{next ? (now ? 'Você joga agora' : 'Seu próximo jogo') : 'Seus jogos'}</span>
        <button type="button" onClick={onPick} className="ml-auto text-sm font-bold text-muted underline underline-offset-2">Não é {name}?</button>
      </div>
      {next ? (
        <>
          <p className="relative m-0 font-display text-2xl font-extrabold leading-tight">
            {next.stage === 'mata' ? next.label : `Rodada ${next.round}`} · Quadra {next.court}
          </p>
          {(() => {
            const mySide = next.a.includes(me) ? next.a : next.b;
            const other = next.a.includes(me) ? next.b : next.a;
            const partner = mySide.filter((id) => id !== me);
            return (
              <p className="relative m-0 text-[15px]">
                {partner.length ? <>Com <b>{nm(partner)}</b> contra </> : 'Contra '}<b>{nm(other)}</b>
              </p>
            );
          })()}
          <button type="button" onClick={() => document.getElementById(`jogo-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className={cx('relative min-h-[44px] rounded-lg font-bold', now ? 'bg-accent text-onaccent' : 'border-[1.5px] border-line bg-surface')}>Ver o jogo</button>
        </>
      ) : (
        <p className="relative m-0 text-[15px]">{mine.length ? `Você já jogou ${played} ${played === 1 ? 'partida' : 'partidas'}. Confira sua posição no Ranking.` : 'Ainda não tem jogo seu na tabela.'}</p>
      )}
    </section>
  );
}

function MeSheet({ open, players, me, onClose, onPick }: { open: boolean; players: Player[]; me: string | null; onClose: () => void; onPick: (id: string | null) => void }) {
  const list = [...players].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return (
    <Sheet open={open} onClose={onClose} title="Quem é você?">
      <p className="m-0 mb-3 text-sm text-muted">Fica salvo só neste celular. Serve pra destacar seus jogos.</p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p.id)} aria-pressed={me === p.id}
              className={cx('flex min-h-[52px] w-full items-center gap-2 rounded-lg border-[1.5px] px-2.5 text-left font-bold', me === p.id ? 'border-ink bg-ink text-bg' : 'border-line')}><Avatar id={p.id} name={p.name} size={32} />{p.name}</button>
          </li>
        ))}
      </ul>
      {me && <Button kind="quiet" className="mt-3" block onClick={() => onPick(null)}>Só estou assistindo</Button>}
    </Sheet>
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
          className="min-h-[56px] rounded-lg border-[1.5px] border-line bg-bg px-3 text-center font-body text-4xl font-bold tracking-[.4em] text-ink" />
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
        {qr && <img src={qr} alt={`QR code do torneio ${code}`} className="w-[min(260px,70vw)] rounded-lg bg-white p-2" />}
        <p className="m-0 font-display text-4xl font-extrabold tracking-[.14em]">{code}</p>
        <p className="m-0 w-full select-all break-all rounded-lg bg-bg p-3 text-center text-sm">{link}</p>
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Button kind="primary" onClick={() => onCopy(`🎾 ${name}\nAcompanhe ao vivo: ${link}\nCódigo: ${code}`)}>Copiar convite</Button>
          <Button onClick={() => onCopy(link)}>Copiar só o link</Button>
        </div>
      </div>
    </Sheet>
  );
}

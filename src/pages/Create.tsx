import { useEffect, useMemo, useState } from 'react';
import {
  buildInitial, DEFAULT_CONFIG, gamesPerMatch, isIndividual, matchesPerRound, parsePlayerList, randomSeed, scoringLabel,
  suggestRounds, summarize, validateSetup, type Config, type Format, type Gender, type Modality, type PairingMethod,
  type Player, type RankingBase, type ScoringType, type SetupArea, type Tiebreak,
} from '../engine';
import { Button, Choices, cx, Field, GenderDot, Note, Panel, Segmented, Sheet, Stepper, useToast } from '../components/ui';
import { api, ApiFail, errorText } from '../lib/api';
import { loadDraft, saveDraft, upsertSaved } from '../lib/local';
import { go } from '../lib/router';

/** Como a pessoa enxerga a modalidade. "Só feminino/masculino" usa só parte da lista. */
type Tipo = 'mista' | 'separado' | 'so_f' | 'so_m' | 'livre';

interface Draft {
  name: string;
  players: Player[];
  config: Config;
  pin: string;
  useLevel: boolean;
  manual: [string, string][];
  roundsTouched: boolean;
  tipo: Tipo;
}

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pid = () => `p${Math.random().toString(36).slice(2, 8)}`;
const randomPin = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
const modalityOf = (t: Tipo): Modality => (t === 'mista' ? 'mista' : t === 'livre' ? 'livre' : 'mesmo_genero');
const onlyOf = (t: Tipo): Gender | null => (t === 'so_f' ? 'M' : t === 'so_m' ? 'H' : null);
const tipoOf = (m: Modality): Tipo => (m === 'mista' ? 'mista' : m === 'livre' ? 'livre' : 'separado');

const fresh = (): Draft => ({
  name: `Play de ${WEEKDAY[new Date().getDay()]}`,
  players: [],
  config: DEFAULT_CONFIG,
  pin: randomPin(),
  useLevel: false,
  manual: [],
  roundsTouched: false,
  tipo: 'mista',
});

const STEPS = ['Jogadores', 'Formato', 'Regras', 'Confirmar'] as const;
const AREA_STEP: Record<SetupArea, number> = { jogadores: 0, formato: 1, regras: 2 };

const TIPOS = [
  { value: 'mista', title: 'Misto', hint: 'Toda dupla tem um homem e uma mulher.' },
  { value: 'separado', title: 'Feminino e masculino', hint: 'Cada um com sua chave e seu ranking, no mesmo código.' },
  { value: 'so_f', title: 'Só feminino', hint: 'Usa só as mulheres da lista.' },
  { value: 'so_m', title: 'Só masculino', hint: 'Usa só os homens da lista.' },
  { value: 'livre', title: 'Livre', hint: 'Qualquer dupla, sem olhar gênero.' },
] satisfies { value: Tipo; title: string; hint: string }[];

const FORMATS = [
  { value: 'rodizio', title: 'Rodízio · Super 8', hint: 'Parceiro novo a cada rodada. Ranking individual.' },
  { value: 'duplas', title: 'Duplas fixas', hint: 'Sorteia as duplas e todas se enfrentam.' },
  { value: 'grupos', title: 'Grupos + mata-mata', hint: 'Duplas em grupos; os melhores vão para a chave.' },
  { value: 'mexicano', title: 'Mexicano', hint: 'Cada rodada é montada pelo ranking: 1º e 4º contra 2º e 3º.' },
] satisfies { value: Format; title: string; hint: string }[];

const PAIRINGS = [
  { value: 'sorteio', title: 'Sorteio', hint: 'Duplas no sorteio.' },
  { value: 'equilibrado', title: 'Equilibrado', hint: 'Nível alto com nível baixo.' },
  { value: 'manual', title: 'Manual', hint: 'Você monta as duplas.' },
] satisfies { value: PairingMethod; title: string; hint: string }[];

const SCORINGS = [
  { value: 'total', title: 'Total de games', hint: 'Joga um total fixo (ex.: 4). 3x1 acaba, 2x2 é empate.' },
  { value: 'corrida', title: 'Primeiro a X', hint: 'Vence quem chegar primeiro. Sem empate.' },
  { value: 'set', title: 'Set com tie-break', hint: 'Set de 4 ou 6, 2 de diferença, tie-break no empate.' },
  { value: 'melhor3', title: 'Melhor de 3', hint: 'Sets com tie-break; o 3º vira match tie-break de 10.' },
] satisfies { value: ScoringType; title: string; hint: string }[];

const BASES = [
  { value: 'games', title: 'Games feitos', hint: 'Soma dos games de cada partida.' },
  { value: 'resultado', title: 'Vitória 3 · Empate 1', hint: 'Derrota 0. Games entram no desempate.' },
] satisfies { value: RankingBase; title: string; hint: string }[];

const TIEBREAKS: Record<Tiebreak, string> = { vitorias: 'Vitórias', saldo: 'Saldo de games', confronto: 'Confronto direto', games: 'Games feitos' };
const DIV_LABEL: Record<string, string> = { H: 'Masculino', M: 'Feminino', all: 'Geral' };

export function CreatePage() {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => {
    const saved = loadDraft<Partial<Draft> | null>(null);
    if (!saved?.config) return fresh();
    const config = { ...DEFAULT_CONFIG, ...saved.config };
    return { ...fresh(), ...saved, config, tipo: saved.tipo ?? tipoOf(config.modality), pin: randomPin(), name: fresh().name } as Draft;
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const c = d.config;

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setC = (patch: Partial<Config>) => setD((x) => ({ ...x, config: { ...x.config, ...patch } }));

  useEffect(() => { saveDraft(d); }, [d]);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const only = onlyOf(d.tipo);
  /** quem entra de fato no torneio */
  const players = useMemo(
    () => d.players.filter((p) => !only || p.gender === only).map((p) => ({ ...p, name: p.name.trim(), level: d.useLevel ? p.level ?? 2 : undefined })),
    [d.players, d.useLevel, only],
  );
  const suggested = useMemo(() => suggestRounds(players, c), [players, c]);

  useEffect(() => {
    if (!d.roundsTouched && isIndividual(c.format) && suggested !== c.rounds) setC({ rounds: suggested });
  }, [suggested, d.roundsTouched, c.format]);

  const check = useMemo(() => validateSetup(players, c, d.manual), [players, c, d.manual]);
  const summary = useMemo(() => summarize(players, c), [players, c]);
  const courtSplit = useMemo(() => matchesPerRound(players, c), [players, c]);
  const pinOk = /^\d{4,8}$/.test(d.pin);
  const nameOk = d.name.trim().length > 0 && d.name.trim().length <= 60;
  const women = d.players.filter((p) => p.gender === 'M');
  const men = d.players.filter((p) => p.gender === 'H');
  const teamsFormat = c.format === 'duplas' || c.format === 'grupos';
  const ready = check.ok && pinOk && nameOk;

  async function create() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const config: Config = { ...c, ranking: { ...c.ranking, sorteio: randomSeed() } };
      const built = buildInitial(players, config, randomSeed(), d.manual);
      const r = await api.create(d.name.trim(), config, { players, teams: built.teams }, d.pin, built.matches);
      upsertSaved({ code: r.code, name: d.name.trim(), adminKey: r.adminKey, token: r.token });
      try { sessionStorage.setItem('s8:novo', JSON.stringify({ code: r.code, pin: d.pin })); } catch { /* ok */ }
      go(`/t/${r.code}`);
    } catch (e) {
      toast(errorText[e instanceof ApiFail ? e.code : 'SERVIDOR']);
    } finally {
      setBusy(false);
    }
  }

  const barInfo = [
    `${players.length} jogadores${only ? '' : ` · ${women.length} M · ${men.length} H`}`,
    check.ok ? `${summary.rounds} rodadas · ${summary.matches} jogos` : `${check.issues.length} ajuste${check.issues.length > 1 ? 's' : ''} pendente${check.issues.length > 1 ? 's' : ''}`,
    scoringLabel(c.scoring),
    '',
  ][step];

  return (
    <>
      <header className="band-lines bg-band text-bandink">
        <div className="gutter relative z-[1] mx-auto max-w-[760px] py-4">
          <div className="flex items-center gap-3">
            <a href="#/" aria-label="Voltar para o início" className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-current text-xl no-underline text-bandink">←</a>
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[30px] font-black uppercase leading-none">Novo torneio</h1>
              <p className="m-0 mt-0.5 text-sm opacity-85">Passo {step + 1} de {STEPS.length} · {STEPS[step]}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden>
            {STEPS.map((s, i) => <i key={s} className={cx('block h-1.5 rounded-full', i <= step ? 'bg-ball' : 'bg-white/20')} />)}
          </div>
        </div>
      </header>

      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))] pt-4">
        {step === 0 && (
          <>
            <Panel title="Tipo de torneio">
              <Choices name="Tipo de torneio" value={d.tipo} options={TIPOS} cols={1} compact
                onChange={(t) => { set({ tipo: t, manual: [] }); setC({ modality: modalityOf(t) }); }} />
            </Panel>
            <AddNames tipo={d.tipo} onAdd={(list) => {
              const have = new Set(d.players.map((p) => p.name.trim().toLocaleLowerCase('pt-BR')));
              const fresh = list.filter((p) => !have.has(p.name.toLocaleLowerCase('pt-BR')));
              set({ players: [...d.players, ...fresh.map((p) => ({ id: pid(), name: p.name, gender: p.gender }))] });
              toast(fresh.length === list.length ? `${fresh.length} nomes adicionados.` : `${fresh.length} nomes adicionados, ${list.length - fresh.length} já estavam na lista.`);
            }} />
            <PlayersPanel
              d={d} tipo={d.tipo}
              onUpdate={(id, patch) => set({ players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })}
              onRemove={(id) => set({ players: d.players.filter((p) => p.id !== id), manual: d.manual.filter((m) => !m.includes(id)) })}
              onClear={() => set({ players: [], manual: [] })}
              onLevel={(useLevel) => set({ useLevel })}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Panel title="Formato">
              <Choices name="Formato" value={c.format} options={FORMATS} cols={1} compact onChange={(v) => setC({ format: v })} />
            </Panel>
            <Panel title="Ajustes">
              <div className="flex flex-col gap-4">
                {isIndividual(c.format) && (
                  <Field label="Rodadas" hint={`Sugestão: ${suggested}${!d.roundsTouched ? ' (automático)' : ''}`}>
                    <div className="flex items-center gap-2">
                      {d.roundsTouched && suggested !== c.rounds && <Button kind="quiet" onClick={() => { setC({ rounds: suggested }); set({ roundsTouched: false }); }}>Usar {suggested}</Button>}
                      <Stepper id="rodadas" label="rodadas" value={c.rounds} min={1} max={60} onChange={(n) => { setC({ rounds: n }); set({ roundsTouched: true }); }} />
                    </div>
                  </Field>
                )}
                {c.format === 'grupos' && (
                  <>
                    <Field label="Grupos" hint={c.modality === 'mesmo_genero' && !only ? 'Em cada gênero' : undefined}>
                      <Stepper id="grupos" label="grupos" value={c.groups} min={1} max={8} onChange={(n) => setC({ groups: n })} />
                    </Field>
                    <Field label="Classificam por grupo">
                      <Stepper id="classificam" label="classificados por grupo" value={c.qualify} min={1} max={4} onChange={(n) => setC({ qualify: n })} />
                    </Field>
                  </>
                )}
                <Field label="Quadras" hint={courtSplit.length > 1 ? courtSplit.map((x) => `${DIV_LABEL[x.div.id]}: ${x.m}`).join(' · ') : 'Jogos ao mesmo tempo'}>
                  <Stepper id="quadras" label="quadras" value={c.courts} min={1} max={30} onChange={(n) => setC({ courts: n })} />
                </Field>
                {check.ok && (
                  <Note kind="ok">
                    <b>{summary.rounds} rodadas · {summary.matches} jogos.</b>{summary.extra && <> {summary.extra}.</>} Cada {isIndividual(c.format) ? 'pessoa' : 'dupla'} joga{' '}
                    {summary.minGames === summary.maxGames ? summary.minGames : `de ${summary.minGames} a ${summary.maxGames}`} partidas.
                  </Note>
                )}
              </div>
            </Panel>
            {teamsFormat && (
              <Panel title="Duplas">
                <Choices name="Formação das duplas" value={c.pairing} options={PAIRINGS} cols={1} compact onChange={(v) => { setC({ pairing: v }); if (v === 'equilibrado') set({ useLevel: true }); }} />
                {c.pairing === 'equilibrado' && <p className="m-0 mt-3 text-sm text-muted">Toque no nome de cada jogador, no passo 1, para marcar o nível.</p>}
                {c.pairing === 'manual' && <ManualPairs players={players} modality={c.modality} pairs={d.manual} onChange={(manual) => set({ manual })} />}
              </Panel>
            )}
            {check.issues.filter((i) => i.area !== 'regras').map((i) => <Note key={i.text} kind="warn">{i.text}</Note>)}
          </>
        )}

        {step === 2 && (
          <>
            <Panel title="Partida">
              <Choices name="Tipo de partida" value={c.scoring.type} options={SCORINGS} cols={1} compact
                onChange={(t) => setC({ scoring: { type: t, games: t === 'set' || t === 'melhor3' ? (c.scoring.games >= 6 ? 6 : 4) : c.scoring.games } })} />
              <div className="mt-4">
                {c.scoring.type === 'set' || c.scoring.type === 'melhor3' ? (
                  <Field label="Games por set" hint="4 é o set curto; 6 é o oficial">
                    <Segmented<string> label="Games por set" value={String(c.scoring.games)} onChange={(v) => setC({ scoring: { ...c.scoring, games: Number(v) } })}
                      options={[{ value: '4', label: '4' }, { value: '6', label: '6' }]} />
                  </Field>
                ) : (
                  <Field label={c.scoring.type === 'total' ? 'Games no total' : 'Games para vencer'}>
                    <Stepper id="games" label="games" value={c.scoring.games} min={1} max={c.scoring.type === 'total' ? 30 : 15} onChange={(n) => setC({ scoring: { ...c.scoring, games: n } })} />
                  </Field>
                )}
                <p className="m-0 mt-2 text-[13px] text-muted">{scoringLabel(c.scoring)}. O app conta só os games.</p>
              </div>
            </Panel>
            <Panel title="Ranking">
              <Choices name="Critério do ranking" value={c.ranking.base} options={BASES} cols={1} compact onChange={(v) => setC({ ranking: { ...c.ranking, base: v } })} />
              <div className="mt-4 flex flex-col gap-3">
                <Check checked={c.ranking.media} onChange={(v) => setC({ ranking: { ...c.ranking, media: v } })} title="Usar média por partida" hint="Justo quando nem todo mundo joga o mesmo número de partidas." />
                {isIndividual(c.format) && d.tipo !== 'separado' && d.tipo !== 'so_f' && d.tipo !== 'so_m' && (
                  <Check checked={c.ranking.separarGenero} onChange={(v) => setC({ ranking: { ...c.ranking, separarGenero: v } })} title="Mostrar Rei e Rainha da areia" hint="Ranking dos homens e das mulheres, além do geral." />
                )}
                <TiebreakEditor value={c.ranking.desempate} onChange={(desempate) => setC({ ranking: { ...c.ranking, desempate } })} />
              </div>
            </Panel>
          </>
        )}

        {step === 3 && (
          <>
            <Panel title="Nome">
              <input id="nome-torneio" aria-label="Nome do torneio" maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })}
                className="min-h-[48px] w-full rounded-[10px] border-[1.5px] border-hair bg-bg px-3 text-lg font-semibold text-ink" />
            </Panel>
            <Panel title="PIN do árbitro">
              <p className="m-0 mb-3 text-[15px] text-muted">Quem tiver esse PIN lança placar. Quem só tiver o código assiste.</p>
              <div className="flex gap-2">
                <input id="pin" aria-label="PIN do árbitro" inputMode="numeric" autoComplete="off" maxLength={8} value={d.pin}
                  onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })}
                  className="min-h-[48px] w-full min-w-0 rounded-[10px] border-[1.5px] border-hair bg-bg px-3 font-display text-3xl font-black tracking-[.3em] text-ink" />
                <Button onClick={() => set({ pin: randomPin() })}>Gerar</Button>
              </div>
              {!pinOk && <p className="m-0 mt-2 text-sm text-danger">Use de 4 a 8 números.</p>}
            </Panel>
            <Panel title="Resumo">
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
                {[
                  ['Tipo', TIPOS.find((t) => t.value === d.tipo)!.title],
                  ['Jogadores', `${players.length}${d.tipo === 'livre' ? '' : ` (${players.filter((p) => p.gender === 'M').length} M · ${players.filter((p) => p.gender === 'H').length} H)`}`],
                  ['Formato', FORMATS.find((f) => f.value === c.format)!.title],
                  ['Tamanho', `${summary.rounds} rodadas · ${summary.matches} jogos`],
                  ['Cada um joga', summary.minGames === summary.maxGames ? `${summary.minGames} partidas` : `${summary.minGames} a ${summary.maxGames} partidas`],
                  ['Partida', `${scoringLabel(c.scoring)} (≈${gamesPerMatch(c.scoring)} games)`],
                  ['Ranking', c.ranking.base === 'games' ? 'Games feitos' : 'Vitória 3 · Empate 1 · Derrota 0'],
                  ['Quadras', courtSplit.length > 1 ? `${c.courts} (${courtSplit.map((x) => `${DIV_LABEL[x.div.id]} ${x.m}`).join(', ')})` : String(c.courts)],
                ].map(([k, v]) => (
                  <div key={k} className="contents"><dt className="font-bold">{k}</dt><dd className="m-0 text-muted">{v}</dd></div>
                ))}
              </dl>
              {only && <p className="m-0 mt-3 text-sm text-muted">{d.players.length - players.length} pessoas da lista ficam de fora deste torneio.</p>}
            </Panel>
            {check.warnings.map((w) => <Note key={w} kind="ok">{w}</Note>)}
            {check.issues.map((i) => (
              <Note key={i.text} kind="warn">
                {i.text}{' '}
                <button type="button" className="font-bold underline underline-offset-2" onClick={() => setStep(AREA_STEP[i.area])}>Corrigir</button>
              </Note>
            ))}
            {!nameOk && <Note kind="warn">Dê um nome ao torneio.</Note>}
          </>
        )}
      </main>

      <nav className="gutter fixed inset-x-0 bottom-0 z-20 border-t border-hair bg-surface pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.5)]">
        <div className="mx-auto flex max-w-[760px] items-center gap-2">
          <Button className="flex-none" onClick={() => (step === 0 ? go('/') : setStep(step - 1))}>{step === 0 ? 'Cancelar' : 'Voltar'}</Button>
          <span className="line-clamp-2 min-w-0 flex-1 text-center text-[11px] font-semibold leading-tight text-muted tabnum">{barInfo}</span>
          {step < STEPS.length - 1 ? (
            <Button kind="primary" className="flex-none !text-xl" onClick={() => setStep(step + 1)}>Continuar</Button>
          ) : (
            <Button kind="primary" className="flex-none !text-xl" disabled={!ready || busy} onClick={create}>{busy ? 'Criando…' : 'Criar'}</Button>
          )}
        </div>
      </nav>
    </>
  );
}

function Check({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <label className="flex min-h-[44px] items-start gap-3 text-[15px]">
      <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--sea)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{title}{hint && <small className="block text-muted">{hint}</small>}</span>
    </label>
  );
}

type Batch = 'auto' | Gender;

function AddNames({ tipo, onAdd }: { tipo: Tipo; onAdd: (l: { name: string; gender: Gender | null }[]) => void }) {
  const [text, setText] = useState('');
  const [batch, setBatch] = useState<Batch>(tipo === 'so_f' ? 'M' : tipo === 'so_m' ? 'H' : 'auto');
  useEffect(() => { if (tipo === 'so_f') setBatch('M'); else if (tipo === 'so_m') setBatch('H'); }, [tipo]);
  const parsed = useMemo(() => parsePlayerList(text, batch === 'auto' ? null : batch), [text, batch]);
  const h = parsed.players.filter((p) => p.gender === 'H').length;
  const m = parsed.players.filter((p) => p.gender === 'M').length;
  const none = parsed.players.length - h - m;
  return (
    <Panel title="Adicionar nomes">
      <textarea
        id="nomes"
        aria-label="Nomes dos jogadores"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Cole a lista do grupo ou digite:\nAna, Bia, Carla\nou um nome por linha'}
        className="w-full rounded-[10px] border-[1.5px] border-hair bg-bg p-3 text-base text-ink"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">Esses nomes são</span>
        <Segmented<Batch> label="Gênero desses nomes" value={batch} onChange={setBatch}
          options={[{ value: 'auto', label: 'Pela lista' }, { value: 'M', label: 'Mulheres', className: 'bg-sun text-surface' }, { value: 'H', label: 'Homens', className: 'bg-sea text-surface' }]} />
      </div>
      <p className="m-0 mt-3 text-sm text-muted tabnum">
        {parsed.players.length
          ? <><b className="text-ink">{parsed.players.length} nomes</b>{h || m ? ` · ${m} M · ${h} H` : ''}{none && tipo !== 'livre' ? ` · ${none} sem gênero (marque depois)` : ''}</>
          : 'Funciona com vírgula, um por linha, lista numerada, “Mulheres:” e “Homens:”, com ou sem emoji.'}
        {parsed.ignored.length > 0 && <span className="block">Ignorei: {parsed.ignored.slice(0, 3).join(' · ')}{parsed.ignored.length > 3 ? '…' : ''}</span>}
        {parsed.duplicates.length > 0 && <span className="block">Repetidos: {parsed.duplicates.join(', ')}</span>}
      </p>
      <Button kind="primary" block className="mt-3 !text-xl" disabled={!parsed.players.length} onClick={() => { onAdd(parsed.players); setText(''); }}>
        {parsed.players.length ? `Adicionar ${parsed.players.length} nome${parsed.players.length > 1 ? 's' : ''}` : 'Adicionar'}
      </Button>
    </Panel>
  );
}

function PlayersPanel({ d, tipo, onUpdate, onRemove, onClear, onLevel }: {
  d: Draft; tipo: Tipo; onUpdate: (id: string, patch: Partial<Player>) => void; onRemove: (id: string) => void; onClear: () => void; onLevel: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const only = onlyOf(tipo);
  const groups: { key: string; title: string; list: Player[]; out?: boolean }[] = tipo === 'livre'
    ? [{ key: 'all', title: 'Jogadores', list: d.players }]
    : [
        { key: 'M', title: 'Mulheres', list: d.players.filter((p) => p.gender === 'M'), out: only === 'H' },
        { key: 'H', title: 'Homens', list: d.players.filter((p) => p.gender === 'H'), out: only === 'M' },
        { key: 'x', title: 'Sem gênero', list: d.players.filter((p) => !p.gender) },
      ];
  const current = d.players.find((p) => p.id === editing) ?? null;

  return (
    <Panel title={`Jogadores · ${only ? d.players.filter((p) => p.gender === only).length : d.players.length}`}>
      {d.players.length === 0 && <p className="m-0 text-[15px] text-muted">Ninguém ainda. Cole ou digite os nomes acima.</p>}
      <div className="flex flex-col gap-4">
        {groups.filter((g) => g.list.length).map((g) => (
          <section key={g.key} className={cx(g.out && 'opacity-45')}>
            <h3 className="m-0 mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted">
              {g.key !== 'all' && g.key !== 'x' && <GenderDot g={g.key as Gender} />}
              {g.title} · {g.list.length}
              {g.out && <span className="normal-case tracking-normal">(ficam de fora)</span>}
            </h3>
            {g.key === 'x' && <p className="m-0 mb-2 text-sm text-danger">Toque em M ou H em cada nome.</p>}
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {g.list.map((p) => (
                <li key={p.id} className="flex items-center overflow-hidden rounded-full border-[1.5px] border-hair bg-bg">
                  <button type="button" onClick={() => setEditing(p.id)} className="flex min-h-[40px] items-center gap-1.5 px-3 text-[15px] font-semibold text-ink">
                    {p.name || 'sem nome'}
                    {d.useLevel && <span className="rounded-full bg-hair px-1.5 text-[11px] font-bold tabnum">{p.level ?? 2}</span>}
                  </button>
                  {g.key === 'x' && (
                    <>
                      <button type="button" aria-label={`${p.name} é mulher`} onClick={() => onUpdate(p.id, { gender: 'M' })} className="min-h-[40px] w-10 border-l border-hair font-extrabold text-sun">M</button>
                      <button type="button" aria-label={`${p.name} é homem`} onClick={() => onUpdate(p.id, { gender: 'H' })} className="min-h-[40px] w-10 border-l border-hair font-extrabold text-sea">H</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {d.players.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-hair pt-3">
          <Check checked={d.useLevel} onChange={onLevel} title="Usar nível" hint="1 iniciante · 2 intermediário · 3 avançado. Toque no nome para marcar." />
          {!confirmClear ? (
            <Button kind="quiet" className="self-start" onClick={() => setConfirmClear(true)}>Apagar a lista toda</Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-tintwarn p-3">
              <span className="flex-1 font-semibold">Apagar os {d.players.length} nomes?</span>
              <Button kind="danger" onClick={() => { onClear(); setConfirmClear(false); }}>Apagar</Button>
              <Button onClick={() => setConfirmClear(false)}>Cancelar</Button>
            </div>
          )}
        </div>
      )}

      <Sheet open={!!current} onClose={() => setEditing(null)} title="Jogador">
        {current && (
          <div className="flex flex-col gap-4">
            <input id={`edit-${current.id}`} aria-label="Nome" maxLength={40} value={current.name} onChange={(e) => onUpdate(current.id, { name: e.target.value })}
              className="min-h-[48px] w-full rounded-[10px] border-[1.5px] border-hair bg-bg px-3 text-lg font-semibold text-ink" />
            <Field label="Gênero">
              <Segmented<Gender> label="Gênero" value={current.gender} onChange={(g) => onUpdate(current.id, { gender: g })}
                options={[{ value: 'M', label: 'Mulher', className: 'bg-sun text-surface' }, { value: 'H', label: 'Homem', className: 'bg-sea text-surface' }]} />
            </Field>
            {d.useLevel && (
              <Field label="Nível" hint="1 iniciante · 3 avançado">
                <Segmented<string> label="Nível" value={String(current.level ?? 2)} onChange={(v) => onUpdate(current.id, { level: Number(v) })}
                  options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button kind="danger" onClick={() => { onRemove(current.id); setEditing(null); }}>Remover</Button>
              <Button kind="primary" className="!text-xl" onClick={() => setEditing(null)}>Pronto</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Panel>
  );
}

function TiebreakEditor({ value, onChange }: { value: Tiebreak[]; onChange: (v: Tiebreak[]) => void }) {
  const all = [...value, ...(Object.keys(TIEBREAKS) as Tiebreak[]).filter((k) => !value.includes(k))];
  const move = (k: Tiebreak, dir: -1 | 1) => {
    const i = value.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <b className="text-[15px]">Desempate, na ordem</b>
      <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {all.map((k) => {
          const on = value.includes(k);
          const i = value.indexOf(k);
          return (
            <li key={k} className={cx('flex min-h-[48px] items-center gap-2 rounded-[9px] border-[1.5px] px-2.5', on ? 'border-ink' : 'border-hair text-muted')}>
              <input type="checkbox" aria-label={`Usar ${TIEBREAKS[k]}`} className="h-6 w-6 accent-[var(--sea)]" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
              <span className="flex-1 font-semibold">{on ? `${i + 1}. ` : ''}{TIEBREAKS[k]}</span>
              {on && (
                <>
                  <button type="button" aria-label={`Subir ${TIEBREAKS[k]}`} disabled={i === 0} onClick={() => move(k, -1)} className="h-10 w-10 rounded-lg text-lg disabled:opacity-25">↑</button>
                  <button type="button" aria-label={`Descer ${TIEBREAKS[k]}`} disabled={i === value.length - 1} onClick={() => move(k, 1)} className="h-10 w-10 rounded-lg text-lg disabled:opacity-25">↓</button>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ManualPairs({ players, modality, pairs, onChange }: { players: Player[]; modality: Modality; pairs: [string, string][]; onChange: (p: [string, string][]) => void }) {
  const used = new Set(pairs.flat().filter(Boolean));
  const options = (current: string, other: string) => {
    const g = players.find((p) => p.id === other)?.gender;
    return players.filter((p) => {
      if (p.id === current) return true;
      if (used.has(p.id) || p.id === other) return false;
      if (modality === 'mista' && g && p.gender === g) return false;
      if (modality === 'mesmo_genero' && g && p.gender !== g) return false;
      return true;
    });
  };
  const free = players.filter((p) => !used.has(p.id));
  const setAt = (i: number, side: 0 | 1, id: string) => onChange(pairs.map((p, j) => (j === i ? (side === 0 ? [id, p[1]] : [p[0], id]) : p)));
  return (
    <div className="mt-4 flex flex-col gap-3">
      {pairs.map((p, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-xl bg-bg p-2.5">
          <div className="flex items-center justify-between">
            <b className="text-sm">Dupla {i + 1}</b>
            <button type="button" aria-label={`Remover dupla ${i + 1}`} className="h-9 w-9 text-xl text-muted" onClick={() => onChange(pairs.filter((_, j) => j !== i))}>×</button>
          </div>
          {([0, 1] as const).map((side) => (
            <select key={side} aria-label={`Dupla ${i + 1}, jogador ${side + 1}`} value={p[side]} onChange={(e) => setAt(i, side, e.target.value)}
              className="min-h-[48px] w-full rounded-[9px] border-[1.5px] border-hair bg-surface px-2 text-base font-semibold text-ink">
              <option value="">Escolha…</option>
              {options(p[side], p[side === 0 ? 1 : 0]).map((o) => <option key={o.id} value={o.id}>{o.name || '?'}{o.gender ? ` (${o.gender})` : ''}</option>)}
            </select>
          ))}
        </div>
      ))}
      <Button kind="ghost" disabled={free.length < 2} onClick={() => onChange([...pairs, ['', '']])}>+ Dupla</Button>
      {free.length > 0 && <span className="text-sm text-muted">Sem dupla: {free.map((p) => p.name).join(', ')}</span>}
    </div>
  );
}

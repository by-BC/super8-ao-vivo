import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildInitial, DEFAULT_CONFIG, gamesPerMatch, individualUnits, isIndividual, LEVELS, levelLetter, matchesPerRound, parsePlayerList, randomSeed, scoringLabel,
  planEdit, suggestRounds, summarize, validateSetup, type Config, type Match, type Format, type Gender, type Modality, type PairingMethod,
  type Player, type RankingBase, type ScoringType, type SetupArea, type Tiebreak,
} from '../engine';
import { signupSummary } from '../lib/signup';
import { Avatar, Button, Choices, cx, Field, GenderDot, Note, Panel, Segmented, Sheet, Stepper, useToast } from '../components/ui';
import { assignCharacters, charactersFor } from '../lib/avatar';
import { CHARACTERS } from '../lib/characters';
import { api, ApiFail, errorText, type ApiErrorCode, type TournamentRow } from '../lib/api';
import { Carregando } from '../components/Brand';
import { getSaved, loadDraft, saveDraft, upsertSaved } from '../lib/local';
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
  /** o organizador escolheu o tipo na mão: o app para de deduzir pela lista */
  tipoPicked: boolean;
  /** lista: o organizador coloca os nomes · inscricao: cada um se inscreve pelo link */
  entry: 'lista' | 'inscricao';
  signup: { askLevel: boolean; limitOn: boolean; limit: number; perGender: boolean; formatLater: boolean };
}

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pid = () => `p${Math.random().toString(36).slice(2, 8)}`;
const randomPin = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
const modalityOf = (t: Tipo): Modality => (t === 'mista' ? 'mista' : t === 'livre' ? 'livre' : 'mesmo_genero');
const onlyOf = (t: Tipo): Gender | null => (t === 'so_f' ? 'M' : t === 'so_m' ? 'H' : null);
const tipoOf = (m: Modality): Tipo => (m === 'mista' ? 'mista' : m === 'livre' ? 'livre' : 'separado');

/**
 * O tipo que a lista colada sugere. Nunca escolhe "feminino e masculino separados":
 * esse só entra se o organizador pedir. Quem está sem gênero no meio de uma lista
 * com gênero puxa para misto, pra o app pedir M ou H em vez de deixar gente de fora.
 */
function inferTipo(players: { gender: Gender | null }[]): Tipo {
  const w = players.some((p) => p.gender === 'M');
  const h = players.some((p) => p.gender === 'H');
  const none = players.some((p) => !p.gender);
  if (!w && !h) return 'livre';
  if (w && h) return 'mista';
  if (none) return 'mista';
  return w ? 'so_f' : 'so_m';
}

const fresh = (): Draft => ({
  name: `Play de ${WEEKDAY[new Date().getDay()]}`,
  players: [],
  config: DEFAULT_CONFIG,
  pin: randomPin(),
  useLevel: false,
  manual: [],
  roundsTouched: false,
  tipo: 'mista',
  tipoPicked: false,
  entry: 'lista',
  signup: { askLevel: true, limitOn: false, limit: 8, perGender: true, formatLater: true },
});

const STEPS = ['Jogadores', 'Formato', 'Regras', 'Confirmar'] as const;
/** O caminho é Jogadores → Confirmar. Formato e Regras são desvios a partir do Confirmar, que voltam pra ele. */
const FLOW = [0, 3] as const;
const CONFIRM = 3;
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

/** Torneio em edição: o assistente abre com os dados dele e, no fim, sorteia de novo no mesmo código. */
interface EditCtx {
  code: string;
  adminKey: string;
  tour: TournamentRow;
  matches: Match[];
  anyScore: boolean;
}

/** Monta o rascunho a partir de um torneio que já existe. */
function draftFrom(t: TournamentRow): Draft {
  const players = t.data.players.filter((p) => !p.left).map((p) => ({ ...p }));
  const m = t.config.modality;
  const genders = new Set(players.map((p) => p.gender));
  const tipo: Tipo = m === 'mesmo_genero' && genders.size === 1 ? (genders.has('M') ? 'so_f' : 'so_m') : tipoOf(m);
  return {
    ...fresh(),
    name: t.name,
    players,
    config: { ...DEFAULT_CONFIG, ...t.config, formatLater: false },
    useLevel: players.some((p) => !!p.level),
    manual: t.config.pairing === 'manual' ? t.data.teams.map((x) => [...x.players] as [string, string]) : [],
    roundsTouched: true,
    tipo,
    tipoPicked: true,
    entry: 'lista',
  };
}

/** Rota #/t/CODIGO/editar: só para o organizador (quem tem a chave neste aparelho). */
export function EditPage({ code }: { code: string }) {
  const adminKey = getSaved(code)?.adminKey;
  const [state, setState] = useState<{ tour: TournamentRow; matches: Match[]; anyScore: boolean } | 'erro' | null>(null);
  useEffect(() => {
    if (!adminKey) return;
    api.get(code)
      .then((r) => setState({ tour: r.tournament, matches: r.matches, anyScore: r.matches.some((x) => x.sets.length > 0) }))
      .catch(() => setState('erro'));
  }, [code, adminKey]);
  if (!adminKey || state === 'erro') {
    return (
      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pt-10">
        <Note kind="warn">{adminKey ? 'Não consegui abrir o torneio. Confira a conexão.' : 'Só o organizador edita o torneio. Entre com a chave do organizador na aba Info.'}</Note>
        <Button onClick={() => go(`/t/${code}`)}>Voltar ao torneio</Button>
      </main>
    );
  }
  if (!state) return <Carregando label="Abrindo o torneio…" className="pt-16" />;
  return <CreatePage edit={{ code, adminKey, tour: state.tour, matches: state.matches, anyScore: state.anyScore }} />;
}

export function CreatePage({ edit }: { edit?: EditCtx } = {}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => {
    if (edit) return draftFrom(edit.tour);
    const saved = loadDraft<Partial<Draft> | null>(null);
    if (!saved?.config) return fresh();
    const config = { ...DEFAULT_CONFIG, ...saved.config };
    return { ...fresh(), ...saved, config, tipo: saved.tipo ?? tipoOf(config.modality), tipoPicked: saved.tipoPicked ?? (saved.tipo !== undefined && saved.tipo !== 'mista'), signup: { ...fresh().signup, ...saved.signup }, pin: randomPin(), name: fresh().name } as Draft;
  });
  const [step, setStep] = useState(0);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Trava síncrona contra criar duas vezes (toque + volta da internet no mesmo instante). */
  const busyRef = useRef(false);
  /** Falha da última tentativa. auto = já foi a nova tentativa automática. */
  const [fail, setFail] = useState<{ code: ApiErrorCode; auto: boolean } | null>(null);
  const [retrying, setRetrying] = useState(false);
  /** edição que apaga placares: primeiro toque pede confirmação, o segundo salva */
  const [confirmWipe, setConfirmWipe] = useState(false);
  const c = d.config;

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setC = (patch: Partial<Config>) => setD((x) => ({ ...x, config: { ...x.config, ...patch } }));

  useEffect(() => { if (!edit) saveDraft(d); }, [d]);
  // mexeu em qualquer coisa: o aviso de falha sai e a nova tentativa automática é desarmada
  useEffect(() => { setFail(null); setConfirmWipe(false); }, [d]);
  useEffect(() => { window.scrollTo(0, 0); setConfirmWipe(false); }, [step]);

  // enquanto o organizador não escolhe o tipo na mão, ele sai da lista colada
  const inferred = inferTipo(d.players);
  useEffect(() => {
    if (edit || d.tipoPicked || d.entry !== 'lista' || !d.players.length || inferred === d.tipo) return;
    set({ tipo: inferred, manual: [] });
    setC({ modality: modalityOf(inferred) });
  }, [inferred, d.tipoPicked, d.entry, d.tipo]);
  const pickTipo = (t: Tipo) => { set({ tipo: t, tipoPicked: true, manual: [] }); setC({ modality: modalityOf(t) }); setTipoOpen(false); };
  const autoTipo = () => { set({ tipoPicked: false }); setTipoOpen(false); };

  const only = onlyOf(d.tipo);
  /** quem entra de fato no torneio */
  const players = useMemo(
    () => d.players.filter((p) => !only || p.gender === only).map((p) => ({ ...p, name: p.name.trim(), level: d.useLevel ? p.level : undefined })),
    [d.players, d.useLevel, only],
  );
  const suggested = useMemo(() => suggestRounds(players, c), [players, c]);

  useEffect(() => {
    if (!d.roundsTouched && isIndividual(c.format) && suggested !== c.rounds) setC({ rounds: suggested });
  }, [suggested, d.roundsTouched, c.format]);

  const check = useMemo(() => validateSetup(players, c, d.manual), [players, c, d.manual]);
  const [editSeed] = useState(() => randomSeed());
  const plan = useMemo(() => (edit && check.ok
    ? planEdit({ config: edit.tour.config, players: edit.tour.data.players, teams: edit.tour.data.teams }, edit.matches, { config: c, players, manual: d.manual }, editSeed)
    : null), [edit, check.ok, c, players, d.manual, editSeed]);
  const summary = useMemo(() => summarize(players, c), [players, c]);
  const courtSplit = useMemo(
    () => (isIndividual(c.format) ? individualUnits(players, c) : matchesPerRound(players, c).map((x) => ({ ...x, grp: null as string | null }))),
    [players, c],
  );
  const splitLabel = (x: { div: { id: string }; grp: string | null }) => `${DIV_LABEL[x.div.id]}${x.grp ? ` ${x.grp}` : ''}`;
  const pinOk = !!edit || /^\d{4,8}$/.test(d.pin);
  const nameOk = d.name.trim().length > 0 && d.name.trim().length <= 60;
  const teamsFormat = c.format === 'duplas' || c.format === 'grupos';
  const viaLink = d.entry === 'inscricao';
  const later = viaLink && d.signup.formatLater;
  /** Formato e Regras contam como parte do Confirmar no indicador de passos */
  const detour = step === 1 || step === 2;
  const pos = detour ? FLOW.length - 1 : Math.max(0, FLOW.indexOf(step as 0 | 3));
  const gendered = d.tipo === 'mista' || d.tipo === 'separado';
  const ready = (viaLink || check.ok) && pinOk && nameOk;
  const signupSettings = {
    open: true,
    askGender: d.tipo !== 'livre' && !only,
    gender: only,
    askLevel: d.signup.askLevel,
    perGender: d.signup.limitOn && d.signup.perGender && gendered,
    limit: d.signup.limitOn ? d.signup.limit : null,
  };

  async function save(e: EditCtx) {
    if (!plan) return;
    const config: Config = { ...c, formatLater: false, ranking: { ...c.ranking, sorteio: e.tour.config.ranking.sorteio ?? randomSeed() } };
    const name = d.name.trim();
    try {
      await api.adminEdit(e.code, e.adminKey, {
        name, config, data: { players: plan.players, teams: plan.teams }, keep: plan.keep, matches: plan.matches,
        wipe: plan.mode === 'tudo', expected: e.tour.version,
      });
    } catch (x) {
      // banco sem a função nova: refazer tudo ainda funciona pelo caminho antigo
      if (!(x instanceof ApiFail && x.code === 'SEM_FUNCAO' && plan.mode === 'tudo')) throw x;
      if (name !== e.tour.name) await api.adminUpdate(e.code, e.adminKey, name, e.tour.data, e.tour.version);
      await api.adminReset(e.code, e.adminKey, config, { players: plan.players, teams: plan.teams }, plan.matches);
    }
    toast(plan.mode === 'nada' ? 'Torneio atualizado. Os placares ficaram.' : plan.mode === 'resto' ? 'Torneio atualizado. As rodadas jogadas ficaram.' : 'Torneio atualizado e sorteado de novo.');
    go(`/t/${e.code}`);
  }

  async function create(auto = false) {
    if (!ready || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFail(null);
    setConfirmWipe(false);
    setRetrying(auto);
    try {
      if (edit) { await save(edit); return; }
      const config: Config = { ...c, ranking: { ...c.ranking, sorteio: randomSeed() } };
      if (viaLink) {
        const r = await api.createSignup(d.name.trim(), { ...config, formatLater: later, pairing: config.pairing === 'manual' ? 'sorteio' : config.pairing }, d.pin, signupSettings);
        upsertSaved({ code: r.code, name: d.name.trim(), adminKey: r.adminKey, token: r.token });
        try { sessionStorage.setItem('s8:novo', JSON.stringify({ code: r.code, pin: d.pin })); } catch { /* ok */ }
        go(`/t/${r.code}`);
        return;
      }
      const built = buildInitial(players, config, randomSeed(), d.manual);
      const r = await api.create(d.name.trim(), config, { players, teams: built.teams }, d.pin, built.matches);
      upsertSaved({ code: r.code, name: d.name.trim(), adminKey: r.adminKey, token: r.token });
      try { sessionStorage.setItem('s8:novo', JSON.stringify({ code: r.code, pin: d.pin })); } catch { /* ok */ }
      go(`/t/${r.code}`);
    } catch (e) {
      setFail({ code: e instanceof ApiFail ? e.code : 'SERVIDOR', auto });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setRetrying(false);
    }
  }

  // sem internet: quando a conexão voltar, tenta criar de novo uma vez sozinho
  const createRef = useRef(create);
  createRef.current = create;
  useEffect(() => {
    if (!fail || fail.code !== 'REDE' || fail.auto) return;
    const onOnline = () => { void createRef.current(true); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [fail]);

  /** salvar esta edição apaga placares já lançados */
  const destructive = !!edit && plan?.mode === 'tudo' && plan.lostScored > 0;
  const lost = destructive ? plan!.lostScored : 0;
  const actionLabel = destructive ? 'Apagar e sortear' : edit ? 'Salvar' : viaLink ? 'Abrir inscrição' : 'Criar';
  const failText = !fail ? '' : (() => {
    const didnt = edit ? 'Não deu pra salvar' : viaLink ? 'Não deu pra abrir a inscrição' : 'Não deu pra criar';
    if (fail.code === 'REDE') {
      const kept = edit ? 'Suas mudanças continuam nesta tela.' : viaLink ? 'Seus ajustes estão salvos aqui.' : 'Sua lista está salva aqui.';
      const next = fail.auto ? `Toque em ${actionLabel} de novo.` : `Toque em ${actionLabel} de novo. Se a internet voltar com esta tela aberta, eu tento sozinho.`;
      return `${didnt}: sem internet. ${kept} ${next}`;
    }
    if (edit && fail.code === 'CONFLITO') return `${didnt}: alguém lançou placar enquanto você editava. Abra a edição de novo.`;
    return `${didnt}. ${errorText[fail.code]}`;
  })();

  /** o aviso manda tocar no botão de criar: só aparece na tela que tem esse botão */
  const failShown = !!fail && step === CONFIRM;
  const wipeAsk = confirmWipe && destructive && step === CONFIRM && !busy;
  const tallBar = failShown || retrying || wipeAsk;
  const pending = `${check.issues.length} ajuste${check.issues.length > 1 ? 's' : ''} pendente${check.issues.length > 1 ? 's' : ''}`;
  const size = check.ok ? `${summary.rounds} rodadas · ${summary.matches} jogos` : pending;
  const barInfo = [
    viaLink ? 'Inscrição pelo link' : players.length ? `${players.length} jogadores · ${size}` : 'Cole a lista pra começar',
    viaLink ? 'Rodadas no sorteio' : size,
    scoringLabel(c.scoring),
    '',
  ][step];
  const tipoInfo = TIPOS.find((t) => t.value === d.tipo)!;

  return (
    <>
      <header className="bg-band text-bandink">
        <div className="gutter mx-auto max-w-[760px] py-4">
          <div className="flex items-center gap-3">
            <a href={edit ? `#/t/${edit.code}` : '#/'} aria-label={edit ? 'Voltar ao torneio' : 'Voltar para o início'} className="grid h-12 w-12 flex-none place-items-center rounded-full border-[1.5px] border-current text-xl no-underline text-bandink">←</a>
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[30px] font-extrabold leading-none">{edit ? 'Editar torneio' : 'Novo torneio'}</h1>
              <p className="m-0 mt-0.5 text-sm opacity-85">Passo {pos + 1} de {FLOW.length} · {detour ? `Ajustar ${STEPS[step].toLowerCase()}` : STEPS[step]}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5" aria-hidden>
            {FLOW.map((v, i) => <i key={v} className={cx('block h-1.5 rounded-full', i <= pos ? 'bg-accent' : 'bg-white/20')} />)}
          </div>
        </div>
      </header>

      <main className={cx('gutter mx-auto flex max-w-[760px] flex-col gap-4 pt-4', tallBar ? 'pb-[calc(220px+env(safe-area-inset-bottom,0px))]' : 'pb-[calc(110px+env(safe-area-inset-bottom,0px))]')}>
        {destructive && step !== CONFIRM && (
          <Note kind="warn">
            <b>Essa mudança apaga placares.</b> O app vai refazer a tabela inteira porque {plan!.reason}, e os {lost} placares lançados somem. Desfaça a mudança se quiser manter os jogos.
          </Note>
        )}
        {step === 0 && (
          <>
            {edit && !destructive && (
              <Note kind="ok">
                Mude o que quiser: jogadores, formato, partida, ranking, quadras. O app guarda os placares sempre que dá: no fim ele mostra o que fica e o que é sorteado de novo, antes de salvar.
              </Note>
            )}
            {viaLink ? (<>
              <Panel title="Inscrição pelo link">
                <p className="m-0 mb-4 text-[15px] text-muted">Cada um põe nome, gênero e nível no celular. Você fecha a lista e sorteia.</p>
                <div className="flex flex-col gap-3">
                  <Check checked={d.signup.askLevel} onChange={(v) => { set({ signup: { ...d.signup, askLevel: v } }); if (v) setC({ pairing: 'equilibrado' }); }}
                    title="Perguntar o nível (A a D)" hint="A profissional · B avançado · C intermediário · D iniciante. Só você vê." />
                  <Check checked={d.signup.limitOn} onChange={(v) => set({ signup: { ...d.signup, limitOn: v } })}
                    title="Limitar vagas" hint="Quem passar do limite cai na lista de espera." />
                  {d.signup.limitOn && (
                    <>
                      <Field label="Vagas" hint={gendered && d.signup.perGender ? 'Pra cada gênero' : 'No total'}>
                        <Stepper id="vagas" label="vagas" value={d.signup.limit} min={2} max={64} onChange={(n) => set({ signup: { ...d.signup, limit: n } })} />
                      </Field>
                      {gendered && <Check checked={d.signup.perGender} onChange={(v) => set({ signup: { ...d.signup, perGender: v } })} title="Vagas por gênero" hint="Ex.: 8 homens e 8 mulheres." />}
                    </>
                  )}
                  <Check checked={d.signup.formatLater} onChange={(v) => set({ signup: { ...d.signup, formatLater: v } })}
                    title="Decido o formato depois" hint="Com a lista fechada, o app sugere o formato que cabe no número de gente, nas quadras e no tempo que vocês têm." />
                  <Note kind="ok">Depois de criar, você manda o link no grupo. Quando fechar a lista, toca em <b>Sortear</b> e o app monta os jogos com quem se inscreveu.</Note>
                </div>
              </Panel>
              <Panel title="Quem se inscreve">
                <Choices name="Tipo de torneio" value={d.tipo} cols={1} compact
                  options={TIPOS.map((t) => ({ ...t, hint: t.hint.replace('Usa só as mulheres da lista.', 'Só mulheres se inscrevem.').replace('Usa só os homens da lista.', 'Só homens se inscrevem.') }))}
                  onChange={pickTipo} />
              </Panel>
              <Button kind="quiet" className="self-center" onClick={() => set({ entry: 'lista' })}>Prefere colar a lista do grupo?</Button>
            </>) : (<>
            <AddNames tipo={d.tipo} picked={d.tipoPicked} onAdd={(list) => {
              const have = new Set(d.players.map((p) => p.name.trim().toLocaleLowerCase('pt-BR')));
              const fresh = list.filter((p) => !have.has(p.name.toLocaleLowerCase('pt-BR')));
              set({ players: [...d.players, ...fresh.map((p) => ({ id: pid(), name: p.name, gender: p.gender }))] });
              toast(fresh.length === list.length ? `${fresh.length} nomes adicionados.` : `${fresh.length} nomes adicionados, ${list.length - fresh.length} já estavam na lista.`);
            }} />
            {(d.players.length > 0 || d.tipoPicked) && (
              <div className="flex min-h-[56px] items-center gap-3 rounded-lg bg-surface py-2 pl-4 pr-2 shadow-card">
                <p className="m-0 min-w-0 flex-1 leading-tight">
                  <b>Tipo: {tipoInfo.title}</b>
                  <small className="block text-[13px] text-muted">{d.tipoPicked ? tipoInfo.hint : `Pela lista. ${tipoInfo.hint}`}</small>
                </p>
                <Button kind="quiet" className="flex-none" aria-haspopup="dialog" onClick={() => setTipoOpen(true)}>Mudar</Button>
              </div>
            )}
            <PlayersPanel
              d={d} tipo={d.tipo}
              onUpdate={(id, patch) => set({ players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })}
              onRemove={(id) => set({ players: d.players.filter((p) => p.id !== id), manual: d.manual.filter((m) => !m.includes(id)) })}
              onClear={() => set({ players: [], manual: [] })}
              onLevel={(useLevel) => set({ useLevel })}
            />
            {!edit && (
              <Button kind="quiet" className="self-center text-balance"
                onClick={() => { set({ entry: 'inscricao' }); setC({ pairing: d.signup.askLevel ? 'equilibrado' : c.pairing === 'manual' ? 'sorteio' : c.pairing }); }}>
                Prefere abrir inscrição pelo link?
              </Button>
            )}
            <Sheet open={tipoOpen} onClose={() => setTipoOpen(false)} title="Tipo de torneio">
              <div className="flex flex-col gap-3">
                <Choices name="Tipo de torneio" value={d.tipo} options={TIPOS} cols={1} compact onChange={pickTipo} />
                {d.tipoPicked && !edit && (
                  <Button kind="quiet" className="self-start" onClick={autoTipo}>Deixar o app escolher pela lista ({TIPOS.find((t) => t.value === inferred)!.title})</Button>
                )}
              </div>
            </Sheet>
            </>)}
          </>
        )}

        {step === 1 && (
          <>
            <Panel title="Formato">
              <Choices name="Formato" value={c.format} options={FORMATS} cols={1} compact onChange={(v) => setC({ format: v })} />
            </Panel>
            <Panel title="Ajustes">
              <div className="flex flex-col gap-4">
                {isIndividual(c.format) && viaLink && <p className="m-0 text-sm text-muted">As rodadas o app sugere na hora do sorteio, com quem se inscreveu. Dá pra mudar lá.</p>}
                {isIndividual(c.format) && !viaLink && (
                  <Field label="Rodadas" hint={`Sugestão: ${suggested}${!d.roundsTouched ? ' (automático)' : ''}`}>
                    <div className="flex items-center gap-2">
                      {d.roundsTouched && suggested !== c.rounds && <Button kind="quiet" onClick={() => { setC({ rounds: suggested }); set({ roundsTouched: false }); }}>Usar {suggested}</Button>}
                      <Stepper id="rodadas" label="rodadas" value={c.rounds} min={1} max={60} onChange={(n) => { setC({ rounds: n }); set({ roundsTouched: true }); }} />
                    </div>
                  </Field>
                )}
                {c.format === 'rodizio' && (
                  <>
                    <Check checked={c.rodizioGroups === 2} onChange={(v) => setC({ rodizioGroups: v ? 2 : 1 })} title="Dividir em 2 grupos"
                      hint="Cada grupo faz seu rodízio na sua quadra e tem seu ranking. No fim, final cruzada: 1º A + 2º B x 2º A + 1º B. Com nível, os grupos saem equilibrados." />
                    <Check checked={!!c.extraGames} onChange={(v) => setC({ extraGames: v })} title="Igualar jogos com jogo extra"
                      hint="Quem ficou com uma partida a menos joga um extra no fim (A x B quando tem grupos), pra todo mundo somar o mesmo número." />
                  </>
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
                <Field label="Quadras" hint={courtSplit.length > 1 && !viaLink ? courtSplit.map((x) => `${splitLabel(x)}: ${x.m}`).join(' · ') : 'Jogos ao mesmo tempo'}>
                  <Stepper id="quadras" label="quadras" value={c.courts} min={1} max={30} onChange={(n) => setC({ courts: n })} />
                </Field>
                {check.ok && !viaLink && (
                  <Note kind="ok">
                    <b>{summary.rounds} rodadas · {summary.matches} jogos.</b>{summary.extra && <> {summary.extra}.</>} Cada {isIndividual(c.format) ? 'pessoa' : 'dupla'} joga{' '}
                    {summary.minGames === summary.maxGames ? summary.minGames : `de ${summary.minGames} a ${summary.maxGames}`} partidas{c.format === 'rodizio' && c.rodizioGroups === 2 && c.extraGames && summary.minGames !== summary.maxGames ? ' (igual dentro de cada grupo)' : ''}.
                  </Note>
                )}
              </div>
            </Panel>
            {teamsFormat && (
              <Panel title="Duplas">
                <Choices name="Formação das duplas" value={c.pairing} options={viaLink ? PAIRINGS.filter((o) => o.value !== 'manual') : PAIRINGS} cols={1} compact
                  onChange={(v) => { setC({ pairing: v }); if (v === 'equilibrado') { if (viaLink) set({ signup: { ...d.signup, askLevel: true } }); else set({ useLevel: true }); } }} />
                {c.pairing === 'equilibrado' && <p className="m-0 mt-3 text-sm text-muted">{viaLink ? 'O nível de cada um vem da inscrição. Você pode corrigir antes de sortear.' : 'Toque no nome de cada jogador, no passo Jogadores, para marcar o nível.'}</p>}
                {c.pairing === 'manual' && <ManualPairs players={players} modality={c.modality} pairs={d.manual} onChange={(manual) => set({ manual })} />}
              </Panel>
            )}
            {c.format === 'rodizio' && (viaLink ? d.signup.askLevel : d.useLevel) && <Note kind="ok">Com nível, o rodízio monta cada jogo com duplas de força parecida.</Note>}
            {!viaLink && check.issues.filter((i) => i.area !== 'regras').map((i) => <Note key={i.text} kind="warn">{i.text}</Note>)}
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
            {plan && <EditPlanNote plan={plan} rounds={c.rounds} format={c.format} />}
            <Panel title="Resumo">
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
                {[
                  ['Tipo', TIPOS.find((t) => t.value === d.tipo)!.title],
                  ...(viaLink
                    ? [['Inscrição', `Pelo link · ${signupSummary({ ...signupSettings, gender: only })}`]]
                    : [['Jogadores', `${players.length}${d.tipo === 'livre' ? '' : ` (${players.filter((p) => p.gender === 'M').length} M · ${players.filter((p) => p.gender === 'H').length} H)`}`]]),
                  ['Formato', later ? 'Decide no sorteio, com sugestões pela lista' : FORMATS.find((f) => f.value === c.format)!.title],
                  ...(viaLink ? [] : [
                    ['Tamanho', `${summary.rounds} rodadas · ${summary.matches} jogos`],
                    ['Cada um joga', summary.minGames === summary.maxGames ? `${summary.minGames} partidas` : `${summary.minGames} a ${summary.maxGames} partidas`],
                  ]),
                  ...(later ? [] : [['Partida', c.scoring.type === 'total' ? scoringLabel(c.scoring) : `${scoringLabel(c.scoring)} · ≈${gamesPerMatch(c.scoring)} games`]]),
                  ...(later ? [] : [
                    ['Ranking', c.ranking.base === 'games' ? 'Games feitos' : 'Vitória 3 · Empate 1 · Derrota 0'],
                    ['Quadras', courtSplit.length > 1 && !viaLink ? `${c.courts} (${courtSplit.map((x) => `${splitLabel(x)} ${x.m}`).join(', ')})` : String(c.courts)],
                  ]),
                ].map(([k, v]) => (
                  <div key={k} className="contents"><dt className="font-bold">{k}</dt><dd className="m-0 text-muted">{v}</dd></div>
                ))}
              </dl>
              {only && !viaLink && <p className="m-0 mt-3 text-sm text-muted">{d.players.length - players.length} pessoas da lista ficam de fora deste torneio.</p>}
              {!later && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="!px-2" onClick={() => setStep(1)}>Ajustar formato</Button>
                  <Button className="!px-2" onClick={() => setStep(2)}>Ajustar regras</Button>
                </div>
              )}
            </Panel>
            {!viaLink && check.warnings.map((w) => <Note key={w} kind="ok">{w}</Note>)}
            {!viaLink && check.issues.map((i) => (
              <Note key={i.text} kind="warn">
                {i.text}{' '}
                <button type="button" className="font-bold underline underline-offset-2" onClick={() => setStep(AREA_STEP[i.area])}>Corrigir</button>
              </Note>
            ))}
            <Panel title="Nome">
              <input id="nome-torneio" aria-label="Nome do torneio" maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })}
                className="min-h-[48px] w-full rounded-lg border-[1.5px] border-line bg-bg px-3 text-lg font-semibold text-ink" />
            </Panel>
            {!edit && <Panel title="PIN do árbitro">
              <p className="m-0 mb-3 text-[15px] text-muted">Quem tiver esse PIN lança placar. Quem só tiver o código assiste.</p>
              <div className="flex gap-2">
                <input id="pin" aria-label="PIN do árbitro" inputMode="numeric" autoComplete="off" maxLength={8} value={d.pin}
                  onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })}
                  className="min-h-[48px] w-full min-w-0 rounded-lg border-[1.5px] border-line bg-bg px-3 font-body text-3xl font-bold tracking-[.3em] text-ink" />
                <Button onClick={() => set({ pin: randomPin() })}>Gerar</Button>
              </div>
              {!pinOk && <p className="m-0 mt-2 text-sm text-danger">Use de 4 a 8 números.</p>}
            </Panel>}
            {!nameOk && <Note kind="warn">Dê um nome ao torneio.</Note>}
          </>
        )}
      </main>

      <nav className="gutter fixed inset-x-0 bottom-0 z-20 border-t border-hair bg-surface pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.5)]">
        <div className="mx-auto max-w-[760px] empty:hidden" role="status" aria-live="polite">
          {retrying ? <Note kind="ok">A internet voltou. Tentando de novo…</Note> : failShown ? <Note kind="warn">{failText}</Note> : wipeAsk && (
            <Note kind="warn"><b>Apagar os {lost} placares lançados?</b> A tabela é sorteada de novo e não dá pra desfazer.</Note>
          )}
        </div>
        <div className={cx('mx-auto flex max-w-[760px] items-center gap-2', tallBar && 'mt-3')}>
          {wipeAsk ? (
            <>
              <Button className="flex-1" onClick={() => setConfirmWipe(false)}>Manter placares</Button>
              <Button kind="danger" className="flex-1" onClick={() => void create()}>Apagar e sortear</Button>
            </>
          ) : (<>
          {!detour && <Button className="flex-none" onClick={() => (step === 0 ? go(edit ? `/t/${edit.code}` : '/') : setStep(0))}>{step === 0 ? 'Cancelar' : 'Voltar'}</Button>}
          <span className={cx('line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-tight text-muted tabnum', detour ? 'text-left' : 'text-center')}>{barInfo}</span>
          {step === 0 ? (
            <Button kind="primary" className="flex-none" onClick={() => setStep(CONFIRM)}>Continuar</Button>
          ) : detour ? (
            <Button kind="primary" className="flex-none" onClick={() => setStep(CONFIRM)}>Pronto</Button>
          ) : (
            <Button kind={destructive ? 'danger' : 'primary'} className="flex-none" disabled={!ready || busy}
              onClick={() => (destructive && !fail ? setConfirmWipe(true) : void create())}>
              {busy ? (edit ? 'Salvando…' : 'Criando…') : actionLabel}
            </Button>
          )}
          </>)}
        </div>
      </nav>
    </>
  );
}

function EditPlanNote({ plan, rounds, format }: { plan: import('../engine').EditPlan; rounds: number; format: Format }) {
  if (plan.mode === 'nada') return <Note kind="ok"><b>A tabela não muda.</b> Todos os placares ficam como estão.</Note>;
  if (plan.mode === 'resto') {
    return (
      <>
        <Note kind="ok">
          <b>Ficam as rodadas 1 a {plan.keptUpTo}</b>, com os {plan.keptScored} placares lançados.{' '}
          {format === 'mexicano'
            ? 'A próxima rodada sai pelo botão Gerar rodada, já com as mudanças.'
            : plan.matches.length ? `Da rodada ${plan.keptUpTo + 1} à ${rounds} o app sorteia de novo com as mudanças.` : ''}
        </Note>
        {plan.leftNames.length > 0 && <Note kind="ok">{plan.leftNames.join(', ')} {plan.leftNames.length > 1 ? 'saem' : 'sai'} das próximas rodadas, mas os jogos que já {plan.leftNames.length > 1 ? 'fizeram' : 'fez'} continuam valendo.</Note>}
        {format === 'rodizio' && rounds <= plan.keptUpTo && <Note kind="warn">Já foram {plan.keptUpTo} rodadas. Aumente as rodadas em Ajustar formato pra ter jogos novos.</Note>}
      </>
    );
  }
  if (!plan.lostScored) return <Note kind="ok">Ainda não tem placar lançado: o app sorteia a tabela de novo.</Note>;
  return <Note kind="warn"><b>Vai refazer a tabela inteira</b> porque {plan.reason}. Os {plan.lostScored} placares lançados são apagados.</Note>;
}

export function Check({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <label className="flex min-h-[48px] items-start gap-3 text-[15px]">
      <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{title}{hint && <small className="block text-muted">{hint}</small>}</span>
    </label>
  );
}

type Batch = 'auto' | Gender;

function AddNames({ tipo, picked, onAdd }: { tipo: Tipo; picked: boolean; onAdd: (l: { name: string; gender: Gender | null }[]) => void }) {
  const [text, setText] = useState('');
  // só segue o tipo quando ele foi escolhido na mão; o tipo deduzido não muda como a próxima lista é lida
  const [batch, setBatch] = useState<Batch>(picked && tipo === 'so_f' ? 'M' : picked && tipo === 'so_m' ? 'H' : 'auto');
  useEffect(() => { if (!picked) return; if (tipo === 'so_f') setBatch('M'); else if (tipo === 'so_m') setBatch('H'); }, [tipo, picked]);
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
        className="w-full rounded-lg border-[1.5px] border-line bg-bg p-3 text-base text-ink"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">Esses nomes são</span>
        <Segmented<Batch> label="Gênero desses nomes" value={batch} onChange={setBatch}
          options={[{ value: 'auto', label: 'Pela lista' }, { value: 'M', label: 'Mulheres', className: 'bg-accent text-onaccent' }, { value: 'H', label: 'Homens', className: 'bg-ink text-bg' }]} />
      </div>
      <p className="m-0 mt-3 text-sm text-muted tabnum">
        {parsed.players.length
          ? <><b className="text-ink">{parsed.players.length} nomes</b>{h || m ? ` · ${m} M · ${h} H` : ''}{none && (h || m) ? ` · ${none} sem gênero (marque depois)` : ''}</>
          : 'Funciona com vírgula, um por linha, lista numerada, “Mulheres:” e “Homens:”, com ou sem emoji.'}
        {parsed.ignored.length > 0 && <span className="block">Ignorei: {parsed.ignored.slice(0, 3).join(' · ')}{parsed.ignored.length > 3 ? '…' : ''}</span>}
        {parsed.duplicates.length > 0 && <span className="block">Repetidos: {parsed.duplicates.join(', ')}</span>}
      </p>
      <Button kind="primary" block className="mt-3" disabled={!parsed.players.length} onClick={() => { onAdd(parsed.players); setText(''); }}>
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
  const auto = useMemo(() => assignCharacters(d.players), [d.players]);

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
                <li key={p.id} className="flex items-center overflow-hidden rounded-full border-[1.5px] border-line bg-bg">
                  <button type="button" onClick={() => setEditing(p.id)} className="flex min-h-[48px] items-center gap-1.5 pl-2 pr-3 text-[15px] font-semibold text-ink">
                    <Avatar name={p.name || '?'} character={p.avatar ?? auto.get(p.id)} size={30} />
                    {p.name || 'sem nome'}
                    {d.useLevel && <span className="rounded-full bg-hair px-1.5 text-[11px] font-bold">{levelLetter(p.level) ?? '?'}</span>}
                  </button>
                  {g.key === 'x' && (
                    <>
                      <button type="button" aria-label={`${p.name} é mulher`} onClick={() => onUpdate(p.id, { gender: 'M' })} className="min-h-[48px] w-12 border-l border-hair font-extrabold text-accentink">M</button>
                      <button type="button" aria-label={`${p.name} é homem`} onClick={() => onUpdate(p.id, { gender: 'H' })} className="min-h-[48px] w-12 border-l border-hair font-extrabold text-ink">H</button>
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
          <Check checked={d.useLevel} onChange={onLevel} title="Usar nível" hint="A profissional · B avançado · C intermediário · D iniciante. Toque no nome para marcar." />
          {!confirmClear ? (
            <Button kind="quiet" className="self-start" onClick={() => setConfirmClear(true)}>Apagar a lista toda</Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-tintwarn p-3">
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
              className="min-h-[48px] w-full rounded-lg border-[1.5px] border-line bg-bg px-3 text-lg font-semibold text-ink" />
            <Field label="Gênero">
              <Segmented<Gender> label="Gênero" value={current.gender}
                onChange={(g) => onUpdate(current.id, { gender: g, avatar: current.avatar !== undefined && charactersFor(g).includes(current.avatar) ? current.avatar : undefined })}
                options={[{ value: 'M', label: 'Mulher', className: 'bg-accent text-onaccent' }, { value: 'H', label: 'Homem', className: 'bg-ink text-bg' }]} />
            </Field>
            <div>
              <b className="text-[15px]">Personagem</b>
              <small className="block text-muted">{current.avatar === undefined ? 'O app escolhe um do gênero. Toque pra trocar.' : 'Escolhido por você.'}</small>
            </div>
            <div className="-mt-2 grid grid-cols-5 gap-2" role="group" aria-label="Personagem">
              {charactersFor(current.gender).map((ci) => {
                const c = CHARACTERS[ci];
                const on = (current.avatar ?? auto.get(current.id)) === ci;
                return (
                  <button key={c.id} type="button" title={c.label} aria-label={c.label} aria-pressed={on}
                    onClick={() => onUpdate(current.id, { avatar: ci })}
                    className={cx('grid place-items-center rounded-full p-0.5', on && 'ring-[3px] ring-[var(--accent)]')}>
                    <Avatar name={current.name || '?'} character={ci} size={46} />
                  </button>
                );
              })}
            </div>
            {d.useLevel && (
              <Field label="Nível" hint={LEVELS.find((l) => l.value === current.level)?.title ?? 'Sem nível marcado'}>
                <Segmented<string> label="Nível" value={current.level ? String(current.level) : null} onChange={(v) => onUpdate(current.id, { level: Number(v) })}
                  options={LEVELS.map((l) => ({ value: String(l.value), label: l.letter }))} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button kind="danger" onClick={() => { onRemove(current.id); setEditing(null); }}>Remover</Button>
              <Button kind="primary" onClick={() => setEditing(null)}>Pronto</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Panel>
  );
}

export function TiebreakEditor({ value, onChange }: { value: Tiebreak[]; onChange: (v: Tiebreak[]) => void }) {
  const all = [...value, ...(Object.keys(TIEBREAKS) as Tiebreak[]).filter((k) => !value.includes(k))];
  const move = (k: Tiebreak, dir: -1 | 1) => {
    const i = value.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex min-h-[48px] items-center gap-3">
        <p className="m-0 min-w-0 flex-1 leading-tight">
          <b className="text-[15px]">Desempate</b>
          <small className="block text-[13px] text-muted">{value.length ? value.map((k, i) => `${i + 1}. ${TIEBREAKS[k]}`).join(' · ') : 'Nenhum critério: empate fica empatado.'}</small>
        </p>
        <Button kind="quiet" className="flex-none" aria-expanded={false} onClick={() => setOpen(true)}>Mudar ordem</Button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex min-h-[48px] items-center justify-between gap-3">
        <b className="text-[15px]">Desempate, na ordem</b>
        <Button kind="quiet" className="flex-none" aria-expanded onClick={() => setOpen(false)}>Fechar</Button>
      </div>
      <ol className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
        {all.map((k) => {
          const on = value.includes(k);
          const i = value.indexOf(k);
          return (
            <li key={k} className={cx('flex min-h-[52px] items-center gap-2 rounded-lg border-[1.5px] pl-2.5 pr-1.5', on ? 'border-ink' : 'border-line text-muted')}>
              <input type="checkbox" aria-label={`Usar ${TIEBREAKS[k]}`} className="h-6 w-6 accent-[var(--accent)]" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
              <span className="flex-1 font-semibold">{on ? `${i + 1}. ` : ''}{TIEBREAKS[k]}</span>
              {on && (
                <>
                  <button type="button" aria-label={`Subir ${TIEBREAKS[k]}`} disabled={i === 0} onClick={() => move(k, -1)} className="h-12 w-12 rounded-lg text-lg disabled:opacity-25">↑</button>
                  <button type="button" aria-label={`Descer ${TIEBREAKS[k]}`} disabled={i === value.length - 1} onClick={() => move(k, 1)} className="h-12 w-12 rounded-lg text-lg disabled:opacity-25">↓</button>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-2 text-[13px] leading-snug text-muted">
        Vale o primeiro critério que separar os empatados. <b className="text-ink">Saldo</b>: games feitos menos sofridos. <b className="text-ink">Confronto direto</b>: quem venceu o jogo entre eles.
      </p>
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
        <div key={i} className="flex flex-col gap-1.5 rounded-lg bg-bg p-2.5">
          <div className="flex items-center justify-between">
            <b className="text-sm">Dupla {i + 1}</b>
            <button type="button" aria-label={`Remover dupla ${i + 1}`} className="-my-2 -mr-1 h-12 w-12 text-xl text-muted" onClick={() => onChange(pairs.filter((_, j) => j !== i))}>×</button>
          </div>
          {([0, 1] as const).map((side) => (
            <select key={side} aria-label={`Dupla ${i + 1}, jogador ${side + 1}`} value={p[side]} onChange={(e) => setAt(i, side, e.target.value)}
              className="min-h-[48px] w-full rounded-lg border-[1.5px] border-line bg-surface px-2 text-base font-semibold text-ink">
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

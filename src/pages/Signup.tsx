import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildInitial, isIndividual, LEVELS, levelLetter, levelValue, parsePlayerList, randomSeed, suggestRounds, summarize, validateSetup,
  type Config, type Gender, type LevelLetter, type PairingMethod,
} from '../engine';
import { Button, Choices, copyText, CopySheet, cx, Field, GenderDot, Note, Panel, Segmented, Sheet, Stepper, useToast } from '../components/ui';
import { api, ApiFail, errorText, type AdminEntry, type PublicEntry, type SignupSettings, type TournamentRow } from '../lib/api';
import { dropMyEntry, getMyEntry, saveMyEntry, type MyEntry } from '../lib/local';
import { shareLink } from '../lib/router';
import { entriesToPlayers, settingsOf, signupSummary, splitEntries } from '../lib/signup';

const fail = (e: unknown) => errorText[e instanceof ApiFail ? e.code : 'SERVIDOR'];
const GENDERS = [
  { value: 'M' as Gender, label: 'Mulher', className: 'bg-sun text-surface' },
  { value: 'H' as Gender, label: 'Homem', className: 'bg-sea text-surface' },
];

/** Página do torneio enquanto a lista está aberta: a galera se inscreve e quem organiza sorteia. */
export function SignupView({ code, tour, entries, adminKey, onChanged }: {
  code: string; tour: TournamentRow; entries: PublicEntry[]; adminKey: string | null; onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const s = settingsOf(tour.signup);
  const [mine, setMine] = useState<MyEntry | null>(() => getMyEntry(code));
  const [editing, setEditing] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const { confirmed, waiting } = splitEntries(entries, s);
  const gendered = s.askGender && !s.gender;

  // se a pessoa saiu por outro aparelho ou o organizador tirou ela da lista, a inscrição guardada aqui perde a validade
  const mineListed = mine ? entries.find((e) => e.id === mine.id) : undefined;
  const fresh = useRef<string | null>(null);
  useEffect(() => {
    if (!mine) return;
    if (mineListed) { fresh.current = null; return; }
    if (fresh.current === mine.id) return; // acabou de se inscrever e a lista ainda não recarregou
    dropMyEntry(code);
    setMine(null);
  }, [mineListed, mine?.id]);

  const myPlace = mine ? placeOf(mine.id, entries, s) : null;

  async function share() {
    const msg = [
      `🎾 *${tour.name.toUpperCase()}* · inscrições abertas!`,
      `Coloca teu nome${gendered ? ', gênero' : ''}${s.askLevel ? ' e nível (A a D)' : ''} aqui:`,
      shareLink(code),
      s.limit ? `_${s.perGender ? `${s.limit} vagas pra cada gênero` : `${s.limit} vagas`}. Depois disso entra na lista de espera._` : '',
    ].filter(Boolean).join('\n');
    if (await copyText(msg)) toast('Copiado. É só colar no grupo.');
    else setCopyFallback(msg);
  }

  return (
    <>
      <section className={cx('rounded-xl px-4 py-4 shadow-card', s.open ? 'bg-ball text-ballink' : 'bg-surface')}>
        <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">{s.open ? 'Inscrições abertas' : 'Inscrições fechadas'}</span>
        <div className="mt-1 font-display text-[30px] font-black uppercase leading-none tabnum">
          {confirmed.length} {confirmed.length === 1 ? 'inscrito' : 'inscritos'}
          {waiting.length > 0 && <span className="text-[20px]"> · {waiting.length} na espera</span>}
        </div>
        <p className="m-0 mt-1 text-sm font-semibold opacity-85">
          {gendered && `${entries.filter((e) => e.gender === 'M').length} M · ${entries.filter((e) => e.gender === 'H').length} H · `}
          {signupSummary(s)}
        </p>
        <Button className="mt-3" block onClick={share}>Copiar convite pro grupo</Button>
      </section>

      {mine && mineListed && !editing ? (
        <Panel title="Você está na lista">
          <div className="flex items-center gap-2 text-lg font-bold">
            {gendered && <GenderDot g={mineListed.gender} />}
            {mineListed.name}
            {mine.level != null && <span className="rounded-full bg-hair px-2 text-sm">Nível {levelLetter(mine.level)}</span>}
          </div>
          {myPlace && (
            <p className={cx('m-0 mt-1 font-semibold', myPlace.waiting ? 'text-danger' : 'text-sea')}>
              {myPlace.waiting ? `Lista de espera · ${myPlace.n}º da fila` : `Confirmado · ${myPlace.n}º da lista`}
            </p>
          )}
          {s.open && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => setEditing(true)}>Editar</Button>
              <LeaveButton code={code} mine={mine} onDone={async () => { dropMyEntry(code); setMine(null); toast('Você saiu da lista.'); await onChanged(); }} />
            </div>
          )}
          {!s.open && <p className="m-0 mt-2 text-sm text-muted">A lista fechou. Se precisar sair, avise quem organiza.</p>}
        </Panel>
      ) : s.open ? (
        <SignupForm code={code} s={s} initial={editing ? mine : null}
          onCancel={editing ? () => setEditing(false) : undefined}
          onSaved={async (e, place) => {
            saveMyEntry(code, e);
            fresh.current = e.id;
            setMine(e);
            setEditing(false);
            toast(place.waiting ? `Você entrou na lista de espera (${place.position}º).` : 'Inscrição confirmada!');
            await onChanged();
          }} />
      ) : (
        <Note kind="warn">As inscrições estão fechadas. O sorteio sai aqui mesmo, nesta página.</Note>
      )}

      <PublicList entries={entries} s={s} mineId={mine?.id ?? null} />

      {adminKey && <AdminPanel code={code} adminKey={adminKey} tour={tour} entries={entries} onChanged={onChanged} />}

      <CopySheet text={copyFallback} onClose={() => setCopyFallback(null)} />
    </>
  );
}

function placeOf(id: string, entries: PublicEntry[], s: SignupSettings): { n: number; waiting: boolean } | null {
  const { confirmed, waiting } = splitEntries(entries, s);
  const e = entries.find((x) => x.id === id);
  if (!e) return null;
  const same = (x: PublicEntry) => !s.perGender || x.gender === e.gender;
  const wi = waiting.filter(same).findIndex((x) => x.id === id);
  if (wi >= 0) return { n: wi + 1, waiting: true };
  return { n: confirmed.filter(same).findIndex((x) => x.id === id) + 1, waiting: false };
}

function LeaveButton({ code, mine, onDone }: { code: string; mine: MyEntry; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!sure) return <Button kind="danger" onClick={() => setSure(true)}>Sair da lista</Button>;
  return (
    <Button kind="danger" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api.signupLeave(code, mine.id, mine.token); await onDone(); } catch (e) { toast(fail(e)); } finally { setBusy(false); setSure(false); }
    }}>{busy ? 'Saindo…' : 'Confirmar saída'}</Button>
  );
}

export function LevelPicker({ value, onChange }: { value: LevelLetter | null; onChange: (l: LevelLetter) => void }) {
  return (
    <Choices<LevelLetter> name="Nível" value={value ?? ('' as LevelLetter)} cols={1} compact onChange={onChange}
      options={LEVELS.map((l) => ({ value: l.letter, title: `${l.letter} · ${l.title}`, hint: l.hint }))} />
  );
}

function SignupForm({ code, s, initial, onSaved, onCancel }: {
  code: string; s: SignupSettings; initial: MyEntry | null;
  onSaved: (e: MyEntry, place: { position: number; waiting: boolean }) => Promise<void>; onCancel?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [level, setLevel] = useState<LevelLetter | null>(levelLetter(initial?.level));
  const [busy, setBusy] = useState(false);
  const needGender = s.askGender && !s.gender;
  const ok = name.trim().length >= 2 && (!needGender || gender) && (!s.askLevel || level);

  async function submit() {
    if (!ok || busy) return;
    setBusy(true);
    const lv = s.askLevel ? levelValue(level) ?? null : null;
    const g = s.gender ?? (needGender ? gender : null);
    try {
      if (initial) {
        const r = await api.signupEdit(code, initial.id, initial.token, name.trim(), g, lv);
        await onSaved({ ...initial, name: name.trim(), gender: g, level: lv }, r);
      } else {
        const r = await api.signup(code, name.trim(), g, lv);
        await onSaved({ id: r.id, token: r.token, name: name.trim(), gender: g, level: lv }, r);
      }
    } catch (e) {
      toast(fail(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={initial ? 'Editar inscrição' : 'Quero jogar'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 font-bold">
          Seu nome
          <input id="inscricao-nome" maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como a galera te chama"
            className="min-h-[48px] w-full rounded-[10px] border-[1.5px] border-hair bg-bg px-3 text-lg font-semibold text-ink" />
        </label>
        {needGender && (
          <Field label="Joga no">
            <Segmented<Gender> label="Gênero" value={gender} onChange={setGender} options={GENDERS} />
          </Field>
        )}
        {s.askLevel && (
          <div className="flex flex-col gap-2">
            <b>Seu nível</b>
            <LevelPicker value={level} onChange={setLevel} />
            <small className="text-[13px] text-muted">Seja sincero: o nível serve pra montar duplas e jogos parelhos. Só quem organiza vê.</small>
          </div>
        )}
        <div className={cx('grid gap-2', onCancel ? 'grid-cols-2' : 'grid-cols-1')}>
          {onCancel && <Button onClick={onCancel}>Cancelar</Button>}
          <Button kind="primary" className="!text-xl" disabled={!ok || busy} onClick={submit}>
            {busy ? 'Enviando…' : initial ? 'Salvar' : 'Confirmar inscrição'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function PublicList({ entries, s, mineId }: { entries: PublicEntry[]; s: SignupSettings; mineId: string | null }) {
  const gendered = s.askGender && !s.gender;
  const groups = gendered
    ? [{ key: 'M', title: 'Mulheres', list: entries.filter((e) => e.gender === 'M') }, { key: 'H', title: 'Homens', list: entries.filter((e) => e.gender === 'H') }]
    : [{ key: 'all', title: 'Jogadores', list: entries }];
  if (!entries.length) return <Panel title="Lista"><p className="m-0 text-muted">Ninguém ainda. Seja o primeiro!</p></Panel>;
  const waitIds = new Set(splitEntries(entries, s).waiting.map((e) => e.id));
  return (
    <Panel title="Lista">
      <div className={cx('grid gap-4', gendered && 'min-[420px]:grid-cols-2')}>
        {groups.map((g) => {
          const conf = g.list.filter((e) => !waitIds.has(e.id));
          const wait = g.list.filter((e) => waitIds.has(e.id));
          return (
            <section key={g.key}>
              <h3 className="m-0 mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted">
                {g.key !== 'all' && <GenderDot g={g.key as Gender} />}{g.title} · {conf.length}{s.perGender && s.limit ? `/${s.limit}` : ''}
              </h3>
              <ol className="m-0 flex list-none flex-col p-0">
                {conf.map((e, i) => <EntryRow key={e.id} n={i + 1} name={e.name} me={e.id === mineId} />)}
              </ol>
              {wait.length > 0 && (
                <>
                  <h4 className="m-0 mb-1 mt-3 text-xs font-extrabold uppercase tracking-[.12em] text-danger">Lista de espera</h4>
                  <ol className="m-0 flex list-none flex-col p-0 opacity-70">
                    {wait.map((e, i) => <EntryRow key={e.id} n={i + 1} name={e.name} me={e.id === mineId} />)}
                  </ol>
                </>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function EntryRow({ n, name, me }: { n: number; name: string; me: boolean }) {
  return (
    <li className={cx('flex items-center gap-2 border-b border-hair py-2 text-[17px]', me && 'font-bold')}>
      <span className="w-7 text-right text-sm text-muted tabnum">{n}.</span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{name}</span>
      {me && <span className="rounded-full bg-ball px-2 text-[11px] font-extrabold uppercase text-ballink">você</span>}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Organizador                                                         */
/* ------------------------------------------------------------------ */

function AdminPanel({ code, adminKey, tour, entries, onChanged }: {
  code: string; adminKey: string; tour: TournamentRow; entries: PublicEntry[]; onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const s = settingsOf(tour.signup);
  const [list, setList] = useState<AdminEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const gendered = s.askGender && !s.gender;
  const key = entries.map((e) => `${e.id}:${e.name}:${e.gender}`).join('|') + tour.updatedAt;

  async function load() {
    try { setList((await api.adminEntries(code, adminKey)).entries); } catch (e) { toast(fail(e)); }
  }
  useEffect(() => { void load(); }, [key]);

  async function run(id: string, f: () => Promise<unknown>) {
    setBusy(id);
    try { await f(); await load(); await onChanged(); } catch (e) { toast(fail(e)); } finally { setBusy(null); }
  }
  const setSettings = (patch: Partial<SignupSettings>) => run('settings', () => api.adminSignup(code, adminKey, { ...s, ...patch }));

  const { confirmed, waiting } = splitEntries(list ?? [], s);
  const noLevel = confirmed.filter((e) => e.level == null).length;

  return (
    <>
      <Panel title="Organizador">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2">
            <Button kind={s.open ? 'line' : 'primary'} disabled={busy === 'settings'} onClick={() => setSettings({ open: !s.open })}>
              {s.open ? 'Fechar inscrições' : 'Reabrir inscrições'}
            </Button>
          </div>
          <label className="flex min-h-[44px] items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--sea)]" checked={s.askLevel} disabled={busy === 'settings'} onChange={(e) => setSettings({ askLevel: e.target.checked })} />
            <span>Perguntar o nível (A a D)<small className="block text-muted">Pra montar duplas e jogos equilibrados.</small></span>
          </label>
          <label className="flex min-h-[44px] items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--sea)]" checked={!!s.limit} disabled={busy === 'settings'} onChange={(e) => setSettings({ limit: e.target.checked ? 16 : null })} />
            <span>Limitar vagas<small className="block text-muted">Quem passar do limite cai na lista de espera e sobe sozinho se alguém sair.</small></span>
          </label>
          {!!s.limit && (
            <>
              <Field label="Vagas" hint={s.perGender ? 'Pra cada gênero' : 'No total'}>
                <Stepper id="vagas" label="vagas" value={s.limit} min={2} max={64} onChange={(n) => setSettings({ limit: n })} />
              </Field>
              {gendered && (
                <label className="flex min-h-[44px] items-start gap-3 text-[15px]">
                  <input type="checkbox" className="mt-0.5 h-6 w-6 flex-none accent-[var(--sea)]" checked={s.perGender} onChange={(e) => setSettings({ perGender: e.target.checked })} />
                  <span>Vagas por gênero<small className="block text-muted">Ex.: 8 homens e 8 mulheres no misto.</small></span>
                </label>
              )}
            </>
          )}
        </div>
      </Panel>

      <Panel title={`Níveis · ${list?.length ?? '…'}`}>
        <p className="m-0 mb-3 text-sm text-muted">Só você vê. Toque na letra pra corrigir o nível de alguém.</p>
        {list === null ? <p className="m-0 text-muted">Carregando…</p> : (
          <ol className="m-0 flex list-none flex-col p-0">
            {list.map((e) => {
              const wait = waiting.some((w) => w.id === e.id);
              return (
                <li key={e.id} className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hair py-2', wait && 'opacity-60')}>
                  <span className="flex min-w-[96px] flex-1 items-start gap-1.5">
                    {gendered && <span className="mt-1"><GenderDot g={e.gender} /></span>}
                    <span className="flex min-w-0 flex-col">
                      <b className="leading-tight [overflow-wrap:break-word]">{e.name}</b>
                      {(wait || e.byAdmin) && (
                        <small className="text-[12px] font-semibold leading-tight">
                          {wait && <span className="text-danger">lista de espera</span>}
                          {wait && e.byAdmin && ' · '}
                          {e.byAdmin && <span className="text-muted">por você</span>}
                        </small>
                      )}
                    </span>
                  </span>
                  <span className="ml-auto flex items-center gap-1" role="group" aria-label={`Nível de ${e.name}`}>
                    {LEVELS.map((l) => (
                      <button key={l.letter} type="button" aria-pressed={e.level === l.value} disabled={busy === e.id}
                        onClick={() => run(e.id, () => api.adminEntry(code, adminKey, e.id, e.name, e.gender, e.level === l.value ? null : l.value))}
                        className={cx('h-8 w-8 rounded-lg border-[1.5px] font-display text-base font-black', e.level === l.value ? 'border-ink bg-ink text-bg' : 'border-hair text-muted')}>
                        {l.letter}
                      </button>
                    ))}
                    {removing === e.id ? (
                      <Button kind="danger" className="!min-h-[36px] !px-2 !py-1 text-sm" disabled={busy === e.id}
                        onClick={() => { setRemoving(null); void run(e.id, () => api.adminEntry(code, adminKey, e.id, null, null, null, true)); }}>Tirar</Button>
                    ) : (
                      <button type="button" aria-label={`Tirar ${e.name} da lista`} onClick={() => setRemoving(e.id)} className="h-8 w-7 text-xl text-muted">×</button>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <AddPeople code={code} adminKey={adminKey} s={s} onDone={async () => { await load(); await onChanged(); }} />
      </Panel>

      <section className="rounded-xl bg-ink px-4 py-4 text-bg shadow-card">
        <b className="block font-display text-[24px] font-black uppercase leading-none">Fechar e sortear</b>
        <p className="m-0 mt-1 text-sm opacity-85">
          Entram os {confirmed.length} confirmados{waiting.length ? `; ${waiting.length} da espera ficam de fora` : ''}.
          {s.askLevel && noLevel > 0 && ` ${noLevel} sem nível contam como meio-termo.`}
        </p>
        <Button kind="primary" block className="mt-3 !text-xl" disabled={!list || confirmed.length < 4} onClick={() => setDrawOpen(true)}>Sortear</Button>
      </section>

      {list && (
        <DrawSheet open={drawOpen} onClose={() => setDrawOpen(false)} code={code} adminKey={adminKey} tour={tour} confirmed={confirmed}
          onStarted={async () => { setDrawOpen(false); toast('Sorteio feito. Bora jogar!'); await onChanged(); }} />
      )}
    </>
  );
}

function AddPeople({ code, adminKey, s, onDone }: { code: string; adminKey: string; s: SignupSettings; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [gender, setGender] = useState<Gender | null>(s.gender);
  const [busy, setBusy] = useState(false);
  const gendered = s.askGender && !s.gender;
  const parsed = useMemo(() => parsePlayerList(text, s.gender ?? gender), [text, gender, s.gender]);

  async function add() {
    if (!parsed.players.length || busy) return;
    if (gendered && parsed.players.some((p) => !p.gender)) { toast('Marque se esses nomes são mulheres ou homens.'); return; }
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const p of parsed.players) {
      try { await api.adminEntry(code, adminKey, null, p.name, s.gender ?? p.gender, null); ok++; } catch { failed.push(p.name); }
    }
    setBusy(false);
    setText('');
    toast(failed.length ? `${ok} adicionados. Não entraram: ${failed.join(', ')} (nome repetido?).` : `${ok} adicionado${ok > 1 ? 's' : ''}.`);
    await onDone();
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-hair pt-3">
      <b>Adicionar quem não tem celular</b>
      <textarea id="admin-nomes" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Um nome ou a lista do grupo"
        className="w-full rounded-[10px] border-[1.5px] border-hair bg-bg p-3 text-base text-ink" />
      {gendered && (
        <Segmented<Gender | 'auto'> label="Gênero desses nomes" value={gender ?? 'auto'} onChange={(g) => setGender(g === 'auto' ? null : g)}
          options={[{ value: 'auto', label: 'Pela lista' }, ...GENDERS]} />
      )}
      <Button disabled={!parsed.players.length || busy} onClick={add}>
        {busy ? 'Adicionando…' : parsed.players.length ? `Adicionar ${parsed.players.length}` : 'Adicionar'}
      </Button>
    </div>
  );
}

function DrawSheet({ open, onClose, code, adminKey, tour, confirmed, onStarted }: {
  open: boolean; onClose: () => void; code: string; adminKey: string; tour: TournamentRow; confirmed: AdminEntry[]; onStarted: () => Promise<void>;
}) {
  const toast = useToast();
  const s = settingsOf(tour.signup);
  const players = useMemo(() => entriesToPlayers(confirmed, s.gender), [confirmed, s.gender]);
  const [cfg, setCfg] = useState<Config>(tour.config);
  const [roundsTouched, setRoundsTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggested = useMemo(() => suggestRounds(players, cfg), [players, cfg]);
  useEffect(() => { if (open && !roundsTouched && isIndividual(cfg.format)) setCfg((c) => ({ ...c, rounds: suggested })); }, [open, suggested, roundsTouched]);
  const check = useMemo(() => validateSetup(players, cfg, []), [players, cfg]);
  const summary = useMemo(() => summarize(players, cfg), [players, cfg]);
  const teamsFormat = cfg.format === 'duplas' || cfg.format === 'grupos';

  async function start() {
    if (!check.ok || busy) return;
    setBusy(true);
    try {
      const config: Config = { ...cfg, ranking: { ...cfg.ranking, sorteio: cfg.ranking.sorteio ?? randomSeed() } };
      const built = buildInitial(players, config, randomSeed());
      await api.adminStart(code, adminKey, config, { players, teams: built.teams }, built.matches);
      await onStarted();
    } catch (e) {
      toast(fail(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sortear">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[15px]">
          <b>{players.length} jogadores</b>
          {s.askGender && !s.gender && ` · ${players.filter((p) => p.gender === 'M').length} M · ${players.filter((p) => p.gender === 'H').length} H`}
        </p>
        {isIndividual(cfg.format) && (
          <Field label="Rodadas" hint={`Sugestão: ${suggested}`}>
            <Stepper id="sorteio-rodadas" label="rodadas" value={cfg.rounds} min={1} max={60} onChange={(n) => { setRoundsTouched(true); setCfg({ ...cfg, rounds: n }); }} />
          </Field>
        )}
        <Field label="Quadras">
          <Stepper id="sorteio-quadras" label="quadras" value={cfg.courts} min={1} max={30} onChange={(n) => setCfg({ ...cfg, courts: n })} />
        </Field>
        {teamsFormat && (
          <Choices<PairingMethod> name="Duplas" value={cfg.pairing === 'manual' ? 'sorteio' : cfg.pairing} cols={1} compact onChange={(v) => setCfg({ ...cfg, pairing: v })}
            options={[{ value: 'equilibrado', title: 'Equilibradas pelo nível', hint: 'A com D, B com C.' }, { value: 'sorteio', title: 'Sorteio puro' }]} />
        )}
        {cfg.format === 'rodizio' && s.askLevel && <Note kind="ok">Com nível, o rodízio monta cada jogo com duplas de força parecida.</Note>}
        {check.ok && <Note kind="ok"><b>{summary.rounds} rodadas · {summary.matches} jogos.</b> Cada um joga {summary.minGames === summary.maxGames ? summary.minGames : `de ${summary.minGames} a ${summary.maxGames}`} partidas.</Note>}
        {check.issues.map((i) => <Note key={i.text} kind="warn">{i.text}</Note>)}
        <p className="m-0 text-sm text-muted">Depois do sorteio a inscrição fecha e a página vira a tabela de jogos.</p>
        <Button kind="primary" block className="!text-xl" disabled={!check.ok || busy} onClick={start}>{busy ? 'Sorteando…' : 'Sortear e começar'}</Button>
      </div>
    </Sheet>
  );
}

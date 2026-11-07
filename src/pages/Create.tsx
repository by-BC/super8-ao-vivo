import { useEffect, useMemo, useState } from 'react';
import {
  buildInitial, DEFAULT_CONFIG, gamesPerMatch, isIndividual, parsePlayerList, randomSeed, scoringLabel, suggestRounds,
  summarize, validateSetup, type Config, type Format, type Gender, type Modality, type PairingMethod, type Player,
  type RankingBase, type ScoringType, type Tiebreak,
} from '../engine';
import { Button, Choices, cx, Field, Note, Panel, Segmented, Sheet, Stepper, useToast } from '../components/ui';
import { api, ApiFail, errorText } from '../lib/api';
import { loadDraft, saveDraft, upsertSaved } from '../lib/local';
import { go } from '../lib/router';
import { Hero } from './Home';

interface Draft {
  name: string;
  players: Player[];
  config: Config;
  pin: string;
  useLevel: boolean;
  manual: [string, string][];
  roundsTouched: boolean;
}

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pid = () => `p${Math.random().toString(36).slice(2, 8)}`;
const randomPin = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));

const fresh = (): Draft => ({
  name: `Play de ${WEEKDAY[new Date().getDay()]}`,
  players: [],
  config: DEFAULT_CONFIG,
  pin: randomPin(),
  useLevel: false,
  manual: [],
  roundsTouched: false,
});

const MODALITIES = [
  { value: 'mista', title: 'Mista', hint: 'Sempre um homem e uma mulher em cada dupla.' },
  { value: 'mesmo_genero', title: 'Mesmo gênero', hint: 'Masculino contra masculino e feminino contra feminino, com ranking separado.' },
  { value: 'livre', title: 'Livre', hint: 'Qualquer combinação de duplas.' },
] satisfies { value: Modality; title: string; hint: string }[];

const FORMATS = [
  { value: 'rodizio', title: 'Rodízio · Super 8', hint: 'Parceiro novo a cada rodada. Ranking individual.' },
  { value: 'duplas', title: 'Duplas fixas', hint: 'Sorteia as duplas e todas se enfrentam.' },
  { value: 'grupos', title: 'Grupos + mata-mata', hint: 'Duplas fixas em grupos; os melhores vão para a chave.' },
  { value: 'mexicano', title: 'Mexicano', hint: 'Cada rodada é montada pelo ranking: 1º e 4º contra 2º e 3º.' },
] satisfies { value: Format; title: string; hint: string }[];

const PAIRINGS = [
  { value: 'sorteio', title: 'Sorteio', hint: 'Duplas no sorteio.' },
  { value: 'equilibrado', title: 'Equilibrado', hint: 'Quem tem nível mais alto joga com quem tem mais baixo.' },
  { value: 'manual', title: 'Manual', hint: 'Você monta as duplas.' },
] satisfies { value: PairingMethod; title: string; hint: string }[];

const SCORINGS = [
  { value: 'total', title: 'Total de games', hint: 'Joga um total fixo (ex.: 4). 3x1 acaba, 2x2 é empate.' },
  { value: 'corrida', title: 'Primeiro a X', hint: 'Vence quem chegar primeiro. Sem empate.' },
  { value: 'set', title: 'Set com tie-break', hint: 'Set de 4 ou 6 games, 2 de diferença, tie-break no empate.' },
  { value: 'melhor3', title: 'Melhor de 3', hint: 'Sets com tie-break; o 3º vira match tie-break de 10.' },
] satisfies { value: ScoringType; title: string; hint: string }[];

const BASES = [
  { value: 'games', title: 'Games feitos', hint: 'Soma dos games de cada partida.' },
  { value: 'resultado', title: 'Vitória 3 · Empate 1', hint: 'Derrota 0. Games entram no desempate.' },
] satisfies { value: RankingBase; title: string; hint: string }[];

const TIEBREAKS: Record<Tiebreak, string> = {
  vitorias: 'Vitórias',
  saldo: 'Saldo de games',
  confronto: 'Confronto direto',
  games: 'Games feitos',
};

export function CreatePage() {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => {
    const saved = loadDraft<Draft | null>(null);
    return saved?.config ? { ...fresh(), ...saved, config: { ...DEFAULT_CONFIG, ...saved.config }, pin: randomPin(), name: fresh().name } : fresh();
  });
  const [paste, setPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = d.config;

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setC = (patch: Partial<Config>) => setD((x) => ({ ...x, config: { ...x.config, ...patch } }));

  useEffect(() => { saveDraft(d); }, [d]);

  const players = useMemo(() => d.players.map((p) => ({ ...p, name: p.name.trim(), level: d.useLevel ? p.level ?? 2 : undefined })), [d.players, d.useLevel]);
  const suggested = useMemo(() => suggestRounds(players, c), [players, c]);

  useEffect(() => {
    if (!d.roundsTouched && isIndividual(c.format) && suggested !== c.rounds) setC({ rounds: suggested });
  }, [suggested, d.roundsTouched, c.format]);

  const check = useMemo(() => validateSetup(players, c, d.manual), [players, c, d.manual]);
  const summary = useMemo(() => summarize(players, c), [players, c]);
  const pinOk = /^\d{4,8}$/.test(d.pin);
  const nameOk = d.name.trim().length > 0 && d.name.trim().length <= 60;
  const men = players.filter((p) => p.gender === 'H').length;
  const women = players.filter((p) => p.gender === 'M').length;
  const teamsFormat = c.format === 'duplas' || c.format === 'grupos';

  const updatePlayer = (id: string, patch: Partial<Player>) => set({ players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  async function create() {
    if (!check.ok || !pinOk || !nameOk || busy) return;
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

  return (
    <>
      <Hero title="Novo torneio" small />
      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-16 pt-5">
        <Panel title="Nome">
          <input
            id="nome-torneio"
            aria-label="Nome do torneio"
            maxLength={60}
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            className="min-h-[48px] w-full rounded-[10px] border-[1.5px] border-hair bg-bg px-3 text-lg font-semibold text-ink"
          />
        </Panel>

        <Panel
          title="Jogadores"
          aside={
            <div className="flex gap-1.5 text-xs font-bold tabnum">
              <span className="rounded-full border-[1.5px] border-current px-2 py-0.5 text-sea">{men} H</span>
              <span className="rounded-full border-[1.5px] border-current px-2 py-0.5 text-sun">{women} M</span>
            </div>
          }
        >
          <div className="mb-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Button kind="primary" className="!text-lg" onClick={() => setPaste(true)}>Colar lista do Whats</Button>
            <Button kind="ghost" onClick={() => set({ players: [...d.players, { id: pid(), name: '', gender: men <= women ? 'H' : 'M' }] })}>+ Adicionar jogador</Button>
          </div>
          {d.players.length === 0 && (
            <p className="m-0 mb-2 text-[15px] text-muted">Cole a lista do grupo (com “👩 Mulheres” e “👨 Homens”, ou “Bruno homem”) ou adicione os nomes um por um.</p>
          )}
          <ul className="m-0 mb-2 flex list-none flex-col gap-2 p-0">
            {d.players.map((p, i) => (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                <input
                  id={`nome-${p.id}`}
                  aria-label={`Nome do jogador ${i + 1}`}
                  value={p.name}
                  maxLength={40}
                  placeholder="Nome"
                  onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                  className="min-h-[44px] w-full min-w-0 rounded-[9px] border-[1.5px] border-hair bg-bg px-3 font-semibold text-ink"
                />
                <Segmented<Gender>
                  label={`Gênero de ${p.name || 'jogador'}`}
                  value={p.gender}
                  onChange={(g) => updatePlayer(p.id, { gender: g })}
                  options={[{ value: 'H', label: 'H', className: 'bg-sea text-surface' }, { value: 'M', label: 'M', className: 'bg-sun text-surface' }]}
                />
                <button type="button" aria-label={`Remover ${p.name || 'jogador'}`} className="h-11 w-10 text-2xl text-muted"
                  onClick={() => set({ players: d.players.filter((x) => x.id !== p.id), manual: d.manual.filter((m) => !m.includes(p.id)) })}>×</button>
                {d.useLevel && (
                  <div className="col-span-3 -mt-1 flex items-center gap-2 pl-1 text-[13px] text-muted">
                    Nível
                    <Segmented<string>
                      label={`Nível de ${p.name || 'jogador'}`}
                      value={String(p.level ?? 2)}
                      onChange={(v) => updatePlayer(p.id, { level: Number(v) })}
                      options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" checked={d.useLevel} onChange={(e) => set({ useLevel: e.target.checked })} className="h-5 w-5" />
              Usar nível (1 iniciante · 2 intermediário · 3 avançado)
            </label>
            {d.players.length > 0 && <Button kind="quiet" onClick={() => set({ players: [], manual: [] })}>Limpar lista</Button>}
          </div>
        </Panel>

        <Panel title="Modalidade">
          <Choices name="Modalidade" value={c.modality} options={MODALITIES} cols={3} onChange={(v) => { setC({ modality: v }); set({ manual: [] }); }} />
        </Panel>

        <Panel title="Formato">
          <Choices name="Formato" value={c.format} options={FORMATS} onChange={(v) => setC({ format: v })} />
          <div className="mt-4 flex flex-col gap-4">
            {isIndividual(c.format) && (
              <Field label="Rodadas" hint={`Sugestão: ${suggested}${d.roundsTouched && suggested !== c.rounds ? '' : ' (automático)'}`}>
                <div className="flex items-center gap-2">
                  {d.roundsTouched && suggested !== c.rounds && <Button kind="quiet" onClick={() => { setC({ rounds: suggested }); set({ roundsTouched: false }); }}>Usar {suggested}</Button>}
                  <Stepper id="rodadas" label="rodadas" value={c.rounds} min={1} max={60} onChange={(n) => { setC({ rounds: n }); set({ roundsTouched: true }); }} />
                </div>
              </Field>
            )}
            {c.format === 'grupos' && (
              <>
                <Field label="Grupos" hint={c.modality === 'mesmo_genero' ? 'Em cada gênero' : undefined}>
                  <Stepper id="grupos" label="grupos" value={c.groups} min={1} max={8} onChange={(n) => setC({ groups: n })} />
                </Field>
                <Field label="Classificam por grupo">
                  <Stepper id="classificam" label="classificados por grupo" value={c.qualify} min={1} max={4} onChange={(n) => setC({ qualify: n })} />
                </Field>
              </>
            )}
            <Field label="Quadras" hint="Jogos ao mesmo tempo em cada rodada">
              <Stepper id="quadras" label="quadras" value={c.courts} min={1} max={30} onChange={(n) => setC({ courts: n })} />
            </Field>
          </div>
        </Panel>

        {teamsFormat && (
          <Panel title="Duplas">
            <Choices name="Formação das duplas" value={c.pairing} options={PAIRINGS} cols={3} onChange={(v) => { setC({ pairing: v }); if (v === 'equilibrado') set({ useLevel: true }); }} />
            {c.pairing === 'manual' && <ManualPairs players={players} modality={c.modality} pairs={d.manual} onChange={(manual) => set({ manual })} />}
          </Panel>
        )}

        <Panel title="Partida">
          <Choices name="Tipo de partida" value={c.scoring.type} options={SCORINGS} onChange={(t) => setC({ scoring: { type: t, games: t === 'set' || t === 'melhor3' ? (c.scoring.games >= 6 ? 6 : 4) : c.scoring.games } })} />
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
            <p className="m-0 mt-2 text-[13px] text-muted">{scoringLabel(c.scoring)}. Dentro do game vale 15, 30, 40 e ponto decisivo no 40 a 40; o app conta só os games.</p>
          </div>
        </Panel>

        <Panel title="Ranking">
          <Choices name="Critério do ranking" value={c.ranking.base} options={BASES} onChange={(v) => setC({ ranking: { ...c.ranking, base: v } })} />
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex items-start gap-2 text-[15px]">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={c.ranking.media} onChange={(e) => setC({ ranking: { ...c.ranking, media: e.target.checked } })} />
              <span>Usar média por partida <small className="block text-muted">Justo quando nem todo mundo joga o mesmo número de partidas.</small></span>
            </label>
            {isIndividual(c.format) && c.modality !== 'mesmo_genero' && (
              <label className="flex items-start gap-2 text-[15px]">
                <input type="checkbox" className="mt-0.5 h-5 w-5" checked={c.ranking.separarGenero} onChange={(e) => setC({ ranking: { ...c.ranking, separarGenero: e.target.checked } })} />
                <span>Mostrar Rei e Rainha da areia <small className="block text-muted">Ranking dos homens e das mulheres separado, além do geral.</small></span>
              </label>
            )}
            <TiebreakEditor value={c.ranking.desempate} onChange={(desempate) => setC({ ranking: { ...c.ranking, desempate } })} />
          </div>
        </Panel>

        <Panel title="PIN do árbitro">
          <p className="m-0 mb-3 text-[15px] text-muted">Quem tiver esse PIN lança placar. Quem só tiver o código assiste.</p>
          <div className="flex gap-2">
            <input
              id="pin"
              aria-label="PIN do árbitro"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={d.pin}
              onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })}
              className="min-h-[48px] w-full min-w-0 rounded-[10px] border-[1.5px] border-hair bg-bg px-3 font-display text-3xl font-black tracking-[.3em] text-ink"
            />
            <Button onClick={() => set({ pin: randomPin() })}>Gerar outro</Button>
          </div>
          {!pinOk && <p className="m-0 mt-2 text-sm text-danger">Use de 4 a 8 números.</p>}
        </Panel>

        <section className="flex flex-col gap-3">
          {check.ok && players.length > 0 && (
            <Note kind="ok">
              <b>{summary.rounds} rodadas · {summary.matches} jogos</b>
              {summary.extra && <> ({summary.extra})</>}. Cada {isIndividual(c.format) ? 'pessoa' : 'dupla'} joga {summary.minGames === summary.maxGames ? summary.minGames : `de ${summary.minGames} a ${summary.maxGames}`} partidas
              {' '}(≈{gamesPerMatch(c.scoring)} games cada).
            </Note>
          )}
          {check.warnings.map((w) => <Note key={w} kind="ok">{w}</Note>)}
          {check.errors.map((e) => <Note key={e} kind="warn">{e}</Note>)}
          <Button kind="primary" block disabled={!check.ok || !pinOk || !nameOk || busy} onClick={create}>
            {busy ? 'Criando…' : 'Sortear e criar torneio'}
          </Button>
        </section>
      </main>

      <PasteSheet
        open={paste}
        onClose={() => setPaste(false)}
        onApply={(list, mode) => {
          const imported: Player[] = list.map((p) => ({ id: pid(), name: p.name, gender: p.gender }));
          if (mode === 'substituir') set({ players: imported, manual: [] });
          else {
            const have = new Set(d.players.map((p) => p.name.trim().toLocaleLowerCase('pt-BR')));
            set({ players: [...d.players, ...imported.filter((p) => !have.has(p.name.toLocaleLowerCase('pt-BR')))] });
          }
          setPaste(false);
          toast(`${list.length} nomes importados.`);
        }}
      />
    </>
  );
}

function PasteSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (l: { name: string; gender: Gender | null }[], mode: 'substituir' | 'adicionar') => void }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parsePlayerList(text), [text]);
  const h = parsed.players.filter((p) => p.gender === 'H').length;
  const m = parsed.players.filter((p) => p.gender === 'M').length;
  const none = parsed.players.length - h - m;
  return (
    <Sheet open={open} onClose={onClose} title="Colar lista">
      <textarea
        id="lista-whats"
        aria-label="Lista colada do WhatsApp"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'👩 Mulheres\n1. Ana\n2. Paloma\n\n👨 Homens\n1. Bruno\n2. Ruan'}
        className="min-h-[220px] w-full rounded-[9px] border-[1.5px] border-hair bg-bg p-2.5 text-[15px] text-ink"
      />
      <p className="m-0 my-3 text-[15px] tabnum">
        {parsed.players.length ? <><b>{parsed.players.length} nomes:</b> {h} H, {m} M{none ? `, ${none} sem gênero (marque depois)` : ''}.</> : 'Cole o texto do grupo aqui.'}
        {parsed.duplicates.length > 0 && <span className="text-muted"> Repetidos ignorados: {parsed.duplicates.join(', ')}.</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button kind="primary" className="!text-lg" disabled={!parsed.players.length} onClick={() => { onApply(parsed.players, 'substituir'); setText(''); }}>Usar esta lista</Button>
        <Button disabled={!parsed.players.length} onClick={() => { onApply(parsed.players, 'adicionar'); setText(''); }}>Somar à lista</Button>
      </div>
    </Sheet>
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
            <li key={k} className={cx('flex items-center gap-2 rounded-[9px] border-[1.5px] px-2.5 py-1.5', on ? 'border-ink' : 'border-hair text-muted')}>
              <input type="checkbox" aria-label={`Usar ${TIEBREAKS[k]}`} className="h-5 w-5" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
              <span className="flex-1 font-semibold">{on ? `${i + 1}. ` : ''}{TIEBREAKS[k]}</span>
              {on && (
                <>
                  <button type="button" aria-label={`Subir ${TIEBREAKS[k]}`} disabled={i === 0} onClick={() => move(k, -1)} className="h-9 w-9 rounded-lg text-lg disabled:opacity-25">↑</button>
                  <button type="button" aria-label={`Descer ${TIEBREAKS[k]}`} disabled={i === value.length - 1} onClick={() => move(k, 1)} className="h-9 w-9 rounded-lg text-lg disabled:opacity-25">↓</button>
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
  const name = (id: string) => players.find((p) => p.id === id)?.name || '?';
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
    <div className="mt-4 flex flex-col gap-2">
      {pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
          {[0, 1].map((side) => (
            <select
              key={side}
              aria-label={`Dupla ${i + 1}, jogador ${side + 1}`}
              value={p[side as 0 | 1]}
              onChange={(e) => setAt(i, side as 0 | 1, e.target.value)}
              className={cx('min-h-[44px] min-w-0 rounded-[9px] border-[1.5px] border-hair bg-bg px-2 font-semibold text-ink', side === 1 && 'col-start-3')}
            >
              <option value="">Escolha…</option>
              {options(p[side as 0 | 1], p[side === 0 ? 1 : 0]).map((o) => <option key={o.id} value={o.id}>{o.name || '?'} {o.gender ? `(${o.gender})` : ''}</option>)}
            </select>
          ))}
          <span className="col-start-2 row-start-1 text-muted">&amp;</span>
          <button type="button" aria-label={`Remover dupla ${i + 1}`} className="col-start-4 row-start-1 h-11 w-9 text-xl text-muted" onClick={() => onChange(pairs.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button kind="ghost" disabled={free.length < 2} onClick={() => onChange([...pairs, ['', '']])}>+ Dupla</Button>
        {free.length > 0 && <span className="self-center text-sm text-muted">Sem dupla: {free.map((p) => name(p.id)).join(', ')}</span>}
      </div>
    </div>
  );
}

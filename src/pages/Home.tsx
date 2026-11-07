import { useState } from 'react';
import { Button, Note, Panel, Pill } from '../components/ui';
import { listSaved } from '../lib/local';
import { go } from '../lib/router';
import { configured } from '../lib/supabase';

const roleLabel = { organizador: 'Organizador', arbitro: 'Árbitro', publico: 'Assistindo' } as const;

export function Hero({ title, accent, sub, small }: { title: string; accent?: string; sub?: string; small?: boolean }) {
  return (
    <header className="band-lines bg-band text-bandink">
      <div className="gutter relative z-[1] mx-auto flex max-w-[760px] items-center gap-4 py-6">
        <a href="#/" aria-label="Início" className={`ball ball-drop ${small ? 'h-11 w-11' : 'h-[62px] w-[62px]'}`} />
        <div className="min-w-0">
          {!small && <p className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-[.16em] opacity-80">Beach tennis · ao vivo</p>}
          <h1 className={`m-0 font-display font-black uppercase leading-[.88] ${small ? 'text-[34px]' : 'text-[clamp(42px,12vw,68px)]'} [overflow-wrap:anywhere]`}>
            {title} {accent && <span className="text-ball">{accent}</span>}
          </h1>
          {sub && <p className="m-0 mt-2 text-[15px] opacity-85">{sub}</p>}
        </div>
      </div>
    </header>
  );
}

export function HomePage() {
  const [code, setCode] = useState('');
  const saved = listSaved();
  const valid = /^[A-Za-z0-9]{6}$/.test(code.trim());

  return (
    <>
      <Hero title="Super 8" accent="ao vivo" sub="Sorteio, placar e ranking do racha de beach tennis, atualizando no celular de todo mundo." />
      <main className="gutter mx-auto flex max-w-[760px] flex-col gap-4 pb-14 pt-5">
        {!configured && <Note kind="warn">Falta configurar o Supabase: crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</Note>}

        <Button kind="primary" block onClick={() => go('/novo')}>Criar torneio</Button>

        <Panel title="Entrar com código">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) go(`/t/${code.trim().toUpperCase()}`);
            }}
          >
            <input
              id="codigo"
              aria-label="Código do torneio"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={6}
              placeholder="Ex.: AREIA7"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              className="min-h-[48px] w-full min-w-0 rounded-[10px] border-[1.5px] border-hair bg-bg px-3 font-display text-2xl font-extrabold uppercase tracking-[.2em] text-ink"
            />
            <Button kind="line" type="submit" disabled={!valid}>Abrir</Button>
          </form>
        </Panel>

        {saved.length > 0 && (
          <Panel title="Meus torneios">
            <ul className="m-0 flex list-none flex-col p-0">
              {saved.map((s) => (
                <li key={s.code} className="border-b border-hair last:border-0">
                  <a href={`#/t/${s.code}`} className="flex items-center gap-3 py-3 text-ink no-underline">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{s.name || 'Torneio'}</b>
                      <small className="text-muted tabnum">{s.code} · {new Date(s.savedAt).toLocaleDateString('pt-BR')}</small>
                    </span>
                    <Pill className={s.role === 'publico' ? 'bg-hair' : 'bg-ball text-ballink'}>{roleLabel[s.role]}</Pill>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Como funciona">
          <ol className="m-0 flex max-w-[65ch] flex-col gap-2 pl-5 text-[15px]">
            <li>Quem organiza cadastra os nomes (ou cola a lista do WhatsApp), escolhe o formato e cria o torneio.</li>
            <li>A galera abre o link ou digita o código e acompanha jogos e ranking em tempo real, sem login.</li>
            <li>Quem tem o PIN de árbitro lança o placar. Sem internet, o ponto fica guardado e sobe quando a conexão voltar.</li>
          </ol>
        </Panel>
      </main>
    </>
  );
}

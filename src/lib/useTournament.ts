import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyGame, type Match } from '../engine';
import { api, ApiFail, type TournamentRow } from './api';
import { dropToken, getSaved, loadQueue, saveQueue, type Intent } from './local';
import { supabase } from './supabase';

export type LoadState = 'carregando' | 'ok' | 'nao_encontrado' | 'erro';
export type LiveState = 'conectando' | 'ao_vivo' | 'offline';

const stageOrder = { grupo: 0, rodada: 0, mata: 1 } as const;
export function sortMatches(ms: Match[]): Match[] {
  return [...ms].sort((x, y) => stageOrder[x.stage] - stageOrder[y.stage] || x.round - y.round || x.division.localeCompare(y.division) || x.slot - y.slot);
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
const POLL_MS = 15000;

/**
 * Estado ao vivo de um torneio.
 * - Lê pelo RPC s8_get. O canal de broadcast "s8:CÓDIGO" só avisa que algo mudou: quem recebe o aviso
 *   busca de novo no servidor. Assim um aviso falso no canal público não consegue mostrar placar inventado.
 * - Se o canal cair, a tela consulta o servidor a cada 15 segundos.
 * - Cada toque no placar vira uma intenção (+1/-1) numa fila guardada no aparelho. A fila é enviada em ordem,
 *   sempre aplicando a intenção sobre o placar mais recente do servidor com trava de versão:
 *   se dois celulares apertam juntos, nenhum ponto se perde.
 */
export function useTournament(code: string) {
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [server, setServer] = useState<Map<string, Match>>(new Map());
  const [state, setState] = useState<LoadState>('carregando');
  const [live, setLive] = useState<LiveState>('conectando');
  const [queue, setQueue] = useState<Intent[]>(() => loadQueue(code));
  const [inflight, setInflight] = useState<{ id: string; base: number } | null>(null);
  const [authLost, setAuthLost] = useState(false);
  /** O servidor respondeu na última tentativa (independe do canal de tempo real). */
  const [reachable, setReachable] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const serverRef = useRef(server);
  const tRef = useRef(tournament);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const liveRef = useRef(live);
  const flushing = useRef(false);
  const loadTimer = useRef<number | null>(null);
  const retry = useRef<{ timer: number | null; wait: number }>({ timer: null, wait: 2000 });
  tRef.current = tournament;
  liveRef.current = live;

  const mergeMatch = useCallback((m: Match) => {
    const cur = serverRef.current.get(m.id);
    if (cur && cur.version >= m.version) return;
    const next = new Map(serverRef.current);
    next.set(m.id, m);
    serverRef.current = next;
    setServer(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get(code);
      const map = new Map(r.matches.map((m) => [m.id, m]));
      serverRef.current = map;
      setServer(map);
      setTournament(r.tournament);
      setState('ok');
      setReachable(true);
      return true;
    } catch (e) {
      if (e instanceof ApiFail && e.code === 'NAO_ENCONTRADO') setState('nao_encontrado');
      else {
        setState((s) => (s === 'carregando' ? 'erro' : s));
        setReachable(false);
      }
      return false;
    }
  }, [code]);

  /** Agrupa avisos que chegam em sequência numa única leitura. */
  const scheduleLoad = useCallback(() => {
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => { void load(); }, 250);
  }, [load]);

  /** Avisa os outros aparelhos que algo mudou. */
  const notify = useCallback((event: 'match' | 'reload' = 'reload') => {
    void channelRef.current?.send({ type: 'broadcast', event, payload: {} });
  }, []);

  const removeIntent = useCallback((id: string) => {
    const q = loadQueue(code).filter((x) => x.id !== id);
    saveQueue(code, q);
    setQueue(q);
  }, [code]);

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = false;
    try {
      for (;;) {
        const q = loadQueue(code);
        const t = tRef.current;
        if (!q.length || !t) break;
        const saved = getSaved(code);
        const token = saved?.token ?? saved?.adminKey ?? null;
        if (!token) { saveQueue(code, []); setQueue([]); break; }
        const it = q[0];
        let base = serverRef.current.get(it.matchId);
        let finished = false;
        for (let attempt = 0; attempt < 4 && base && !finished; attempt++) {
          const sets = applyGame(base.sets, it.side, it.delta, t.config.scoring, base.stage === 'mata');
          if (!sets) break; // não cabe mais (partida acabou ou já está zerada): descarta
          setInflight({ id: it.id, base: base.version });
          try {
            const r = await api.score(code, token, base.id, base.version, sets);
            removeIntent(it.id);
            mergeMatch(r.match);
            finished = true;
            sent = true;
            setReachable(true);
          } catch (e) {
            const err = e instanceof ApiFail ? e : new ApiFail('SERVIDOR');
            if (err.code === 'CONFLITO' && err.extra?.match) {
              mergeMatch(err.extra.match as Match);
              base = err.extra.match as Match;
              continue;
            }
            if (err.code === 'REDE') {
              setReachable(false);
              const wait = retry.current.wait;
              retry.current.wait = Math.min(wait * 2, 30000);
              if (retry.current.timer) window.clearTimeout(retry.current.timer);
              retry.current.timer = window.setTimeout(() => { void flush(); }, wait);
              return;
            }
            if (err.code === 'SEM_PERMISSAO') {
              dropToken(code);
              saveQueue(code, []);
              setQueue([]);
              setAuthLost(true);
              return;
            }
            setLastError(err.code);
            break;
          } finally {
            setInflight(null);
          }
        }
        if (!finished) removeIntent(it.id);
        retry.current.wait = 2000;
      }
    } finally {
      flushing.current = false;
      if (sent) notify('match');
    }
  }, [code, mergeMatch, removeIntent, notify]);

  useEffect(() => {
    const sync = () => { void load().then((ok) => { if (ok) void flush(); }); };
    sync();

    const channel = supabase
      .channel(`s8:${code}`)
      .on('broadcast', { event: 'match' }, scheduleLoad)
      .on('broadcast', { event: 'reload' }, scheduleLoad)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive('ao_vivo');
          sync(); // ressincroniza o que pode ter passado enquanto o canal estava fora
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive('offline');
        }
      });
    channelRef.current = channel;

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && liveRef.current !== 'ao_vivo') sync();
    }, POLL_MS);
    const wake = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', sync);
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', sync);
      if (retry.current.timer) window.clearTimeout(retry.current.timer);
      if (loadTimer.current) window.clearTimeout(loadTimer.current);
    };
  }, [code, load, flush, scheduleLoad]);

  /** Placar que aparece na tela: servidor + fila local ainda não enviada. */
  const matches = useMemo(() => {
    if (!tournament) return [];
    const map = new Map(server);
    for (const it of queue) {
      const m = map.get(it.matchId);
      if (!m) continue;
      // a intenção em voo pode já ter chegado numa leitura antes da resposta do RPC
      if (inflight && inflight.id === it.id && m.version > inflight.base) continue;
      const sets = applyGame(m.sets, it.side, it.delta, tournament.config.scoring, m.stage === 'mata');
      if (sets) map.set(m.id, { ...m, sets });
    }
    return sortMatches([...map.values()]);
  }, [server, queue, inflight, tournament]);

  const serverMatches = useMemo(() => sortMatches([...server.values()]), [server]);

  const point = useCallback((matchId: string, side: 'a' | 'b', delta: 1 | -1) => {
    const q = [...loadQueue(code), { id: newId(), matchId, side, delta }];
    saveQueue(code, q);
    setQueue(q);
    void flush();
  }, [code, flush]);

  const reload = useCallback(async () => {
    const ok = await load();
    return ok;
  }, [load]);

  return {
    tournament, matches, serverMatches, state, live, reachable, pending: queue.length, authLost, lastError,
    clearError: () => setLastError(null), clearAuthLost: () => setAuthLost(false),
    reload, notify, point,
  };
}

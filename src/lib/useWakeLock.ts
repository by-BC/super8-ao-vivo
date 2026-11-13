import { useEffect } from 'react';

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: 'release', f: () => void) => void };
type WakeNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

/**
 * Mantém a tela acesa enquanto `on` for verdadeiro (árbitro lançando placar, telão).
 * O navegador solta a trava quando a aba some; pedimos de novo quando ela volta.
 * Em navegador sem suporte não faz nada.
 */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    const nav = navigator as WakeNav;
    if (!on || !nav.wakeLock) return;
    let lock: Sentinel | null = null;
    let alive = true;
    const ask = async () => {
      if (!alive || document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await nav.wakeLock!.request('screen');
        lock.addEventListener?.('release', () => { lock = null; });
        if (!alive) void lock.release();
      } catch { /* bateria fraca ou sem permissão: segue sem */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void ask(); };
    void ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, [on]);
}

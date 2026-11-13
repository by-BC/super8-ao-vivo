import { useEffect, useState } from 'react';

export type Route =
  | { name: 'inicio' }
  | { name: 'novo' }
  | { name: 'torneio'; code: string }
  | { name: 'telao'; code: string }
  | { name: 'editar'; code: string };

const CODE = /^[A-Za-z0-9]{6}$/;

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'novo') return { name: 'novo' };
  if (parts[0] === 't' && parts[1] && CODE.test(parts[1])) {
    const code = parts[1].toUpperCase();
    if (parts[2] === 'telao') return { name: 'telao', code };
    if (parts[2] === 'editar') return { name: 'editar', code };
    return { name: 'torneio', code };
  }
  return { name: 'inicio' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path;
};

export const shareLink = (code: string) => `${window.location.origin}${window.location.pathname}#/t/${code}`;

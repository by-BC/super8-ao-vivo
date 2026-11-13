import { CHARACTERS, MEN, WOMEN } from './characters';

/** Avatar de iniciais: cor fixa por nome, igual no app e nas artes. */
const COLORS = ['#4dbbb5', '#e37a63', '#f2c45a', '#1e3557', '#2b7064'];

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';
}
export function avatarColor(name: string): string {
  return COLORS[hashName(name.trim().toLowerCase()) % COLORS.length];
}
export function avatarInk(bg: string): string {
  return bg === '#1e3557' || bg === '#2b7064' ? '#fff6ea' : '#1e3557';
}

/* ------------------------------------------------------------------ */
/* Personagens (as "fotos de perfil" desenhadas)                       */
/* ------------------------------------------------------------------ */

export { MEN, WOMEN };

interface Who { id: string; name: string; gender: 'H' | 'M' | null; avatar?: number }

/**
 * Personagem de cada jogador. Quem o organizador escolheu fica com o escolhido; o resto
 * recebe um do próprio gênero, em rodízio pela lista ordenada (vizinhos não repetem),
 * começando de um ponto que depende do grupo (torneios diferentes não ficam iguais).
 */
export function assignCharacters(players: Who[]): Map<string, number> {
  const out = new Map<string, number>();
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < CHARACTERS.length;
  for (const p of players) if (valid(p.avatar)) out.set(p.id, p.avatar);
  const groups: [Who[], number[]][] = [
    [players.filter((p) => p.gender === 'M'), WOMEN],
    [players.filter((p) => p.gender === 'H'), MEN],
    [players.filter((p) => !p.gender), [...WOMEN, ...MEN]],
  ];
  for (const [list, pool] of groups) {
    const free = list.filter((p) => !out.has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
    const start = hashName(list.map((p) => p.id).sort().join('|')) % pool.length;
    free.forEach((p, i) => out.set(p.id, pool[(start + i) % pool.length]));
  }
  return out;
}

export interface Roster { byId: Map<string, number>; byName: Map<string, number> }
export function characterRoster(players: Who[]): Roster {
  const byId = assignCharacters(players);
  const byName = new Map<string, number>();
  for (const p of players) { const c = byId.get(p.id); if (c !== undefined) byName.set(p.name, c); }
  return { byId, byName };
}

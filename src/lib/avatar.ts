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

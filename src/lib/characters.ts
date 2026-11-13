/**
 * Os 10 personagens que fazem as vezes de foto de perfil (5 mulheres e 5 homens).
 * Desenho próprio, flat, na caixa 64×64, sem fundo: quem usa pinta o círculo atrás
 * (a cor vem do nome, então dois jogadores com o mesmo personagem ainda ficam diferentes).
 * O mesmo SVG serve pro app (<img>) e pras artes (canvas).
 */

export type CharGender = 'M' | 'H';

interface Look {
  id: string;
  gender: CharGender;
  label: string;
  skin: string;
  hair: string;
  shirt: string;
  back?: string; // cabelo atrás da cabeça
  front: string; // cabelo/chapéu na frente
  extra?: string; // acessórios por cima de tudo
}

const INK = '#1e3557';

const L: Look[] = [
  // ---------------- mulheres ----------------
  {
    id: 'm1', gender: 'M', label: 'Cabelo longo com viseira coral', skin: '#c98e6a', hair: '#3b2a24', shirt: '#4dbbb5',
    back: '<path d="M18.5 28c0-9 6-15.5 13.5-15.5S45.5 19 45.5 28v18c-3 2-7 2.5-8 1V36H27v11c-1 1.5-5 1-8.5-1z"/>',
    front: '<path d="M20.6 28.5c.6-8.4 5.6-12.6 11.4-12.6s10.8 4.2 11.4 12.6c-3.6-4.4-8.4-6-11.4-6s-7.8 1.6-11.4 6z"/>',
    extra: '<path d="M17.5 22.6c4.2-2.4 9-3.4 14.5-3.4s10.3 1 14.5 3.4" stroke="#e37a63" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M38.5 21.4c4.5.2 8.6 1.4 10.8 3.3-3.6.4-7.8 0-11.2-1.1z" fill="#e37a63"/>',
  },
  {
    id: 'm2', gender: 'M', label: 'Cabelo cacheado com faixa turquesa', skin: '#8a5a3c', hair: '#2a1d18', shirt: '#f2c45a',
    back: '<circle cx="20" cy="22" r="7"/><circle cx="44" cy="22" r="7"/><circle cx="17.5" cy="31" r="6.5"/><circle cx="46.5" cy="31" r="6.5"/><circle cx="19" cy="40" r="5.5"/><circle cx="45" cy="40" r="5.5"/><circle cx="26" cy="15" r="7"/><circle cx="38" cy="15" r="7"/><circle cx="32" cy="12.5" r="6.5"/>',
    front: '<path d="M21 26c1.5-6 6-9.5 11-9.5s9.5 3.5 11 9.5c-3-2.4-7-3.6-11-3.6s-8 1.2-11 3.6z"/>',
    extra: '<path d="M20.4 22.8c3.4-2.2 7.4-3.2 11.6-3.2s8.2 1 11.6 3.2" stroke="#4dbbb5" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  },
  {
    id: 'm3', gender: 'M', label: 'Rabo de cavalo loiro e óculos escuros', skin: '#f0c7a5', hair: '#e2b24f', shirt: '#e37a63',
    back: '<path d="M41 18c6 1 9.5 6 8.5 13.5-.6 4.6-3 8-5.6 10.2 1-4.5.6-9.6-2-14z"/>',
    front: '<path d="M20.6 30c-.4-9.6 5-15 11.4-15 6.8 0 11.6 5 11.4 13.6-2-3.6-5.4-6.6-9.8-7.6-3.6 3.6-8.4 6.2-13 9z"/><circle cx="40.5" cy="17.5" r="3.4"/>',
    extra: '<rect x="23" y="27.6" width="7.6" height="5" rx="2.3" fill="' + INK + '"/><rect x="33.4" y="27.6" width="7.6" height="5" rx="2.3" fill="' + INK + '"/><path d="M30.6 29.6h2.8" stroke="' + INK + '" stroke-width="1.4"/>',
  },
  {
    id: 'm4', gender: 'M', label: 'Chanel com franja e brincos', skin: '#e0a882', hair: '#1e1a1a', shirt: '#1f5c52',
    back: '<path d="M19 27c0-8.6 5.6-14.6 13-14.6S45 18.4 45 27v12.6c0 1.6-2.4 2.4-4.6 1.6V31H23.6v10.2c-2.2.8-4.6 0-4.6-1.6z"/>',
    front: '<path d="M20.6 28c0-7.8 4.8-12.4 11.4-12.4S43.4 20.2 43.4 28H20.6z"/>',
    extra: '<circle cx="20.6" cy="36" r="1.8" fill="#f2c45a"/><circle cx="43.4" cy="36" r="1.8" fill="#f2c45a"/>',
  },
  {
    id: 'm5', gender: 'M', label: 'Coque alto com tranças', skin: '#6e4530', hair: '#1c1412', shirt: '#f6b8a5',
    back: '<circle cx="32" cy="10.5" r="6.4"/>',
    front: '<path d="M20.6 29c-.2-8.8 5-13.6 11.4-13.6S43.6 20.2 43.4 29c-2.6-4.2-6.8-6.6-11.4-6.6S23.2 24.8 20.6 29z"/><path d="M26 17.6 27.6 22M32 16.6V21.6M38 17.6 36.4 22" stroke="#3a2a24" stroke-width="1.2" fill="none"/>',
    extra: '<path d="M26.4 9.6c3.4-1.6 7.8-1.6 11.2 0" stroke="#e37a63" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  },
  // ---------------- homens ----------------
  {
    id: 'h1', gender: 'H', label: 'Cabelo curto e barba', skin: '#c98e6a', hair: '#2e211c', shirt: '#1e3557',
    front: '<path d="M20.8 27.4c-.6-8 4.6-12.8 11.2-12.8 6.8 0 12 4.6 11.2 12.8-1.2-3.4-3-5-5.4-5.6-3.6 1.8-8.4 2-12.4.8-2.4 1-3.8 2.4-4.6 4.8z"/>',
    extra: '<path d="M21.6 32.6c.6 7 4.8 11 10.4 11s9.8-4 10.4-11c-1.8 2.6-3.6 3.6-5.4 3.8-1.4-1.6-3.2-2.2-5-2.2s-3.6.6-5 2.2c-1.8-.2-3.6-1.2-5.4-3.8z" fill="#2e211c"/>',
  },
  {
    id: 'h2', gender: 'H', label: 'Boné coral e óculos escuros', skin: '#f0c7a5', hair: '#7a5236', shirt: '#4dbbb5',
    front: '<path d="M21.2 29c-.8-3 0-5.4 1.4-6.4h18.8c1.4 1 2.2 3.4 1.4 6.4-1.8-1.4-4.6-2.4-10.8-2.4S23 27.6 21.2 29z"/>',
    extra: '<path d="M19.6 24c0-7.2 5.4-11.6 12.4-11.6S44.4 16.8 44.4 24z" fill="#e37a63"/><path d="M40 23.4c4.8 0 8.6.8 10.4 2.6-3.6 1-8.2.6-11.4-.8z" fill="#bf5440"/><circle cx="32" cy="12.8" r="1.4" fill="#bf5440"/><rect x="23" y="28" width="7.6" height="5" rx="2.3" fill="' + INK + '"/><rect x="33.4" y="28" width="7.6" height="5" rx="2.3" fill="' + INK + '"/><path d="M30.6 30h2.8" stroke="' + INK + '" stroke-width="1.4"/>',
  },
  {
    id: 'h3', gender: 'H', label: 'Black power curto', skin: '#7a4a32', hair: '#1a1210', shirt: '#f2c45a',
    back: '<circle cx="23" cy="20" r="6.4"/><circle cx="41" cy="20" r="6.4"/><circle cx="32" cy="15.5" r="7.6"/><circle cx="20.4" cy="27" r="4.6"/><circle cx="43.6" cy="27" r="4.6"/>',
    front: '<path d="M21.2 27c1-6 5.6-9.4 10.8-9.4s9.8 3.4 10.8 9.4c-3-2-6.8-3-10.8-3s-7.8 1-10.8 3z"/>',
  },
  {
    id: 'h4', gender: 'H', label: 'Chapéu de praia turquesa e bigode', skin: '#d39a74', hair: '#3a2a22', shirt: '#e37a63',
    front: '<path d="M21 30c-.6-3.4 0-6 1.4-7.4h19.2c1.4 1.4 2 4 1.4 7.4-2-1.6-5.2-2.6-11-2.6S23 28.4 21 30z"/>',
    extra: '<path d="M22.6 23.6c.4-6.8 4.2-10.4 9.4-10.4s9 3.6 9.4 10.4z" fill="#4dbbb5"/><path d="M15.6 24.6c4.4-1.8 10-2.6 16.4-2.6s12 .8 16.4 2.6c-4.2 1.4-10.2 2-16.4 2s-12.2-.6-16.4-2z" fill="#3a9f99"/><path d="M27.6 35.2c1.6-1.2 3-1.4 4.4-.6 1.4-.8 2.8-.6 4.4.6" stroke="#3a2a22" stroke-width="2" fill="none" stroke-linecap="round"/>',
  },
  {
    id: 'h5', gender: 'H', label: 'Cabelo de surfista com faixa', skin: '#e8b58e', hair: '#b07a3e', shirt: '#1f5c52',
    back: '<path d="M19.6 26c0-8 5.4-13.4 12.4-13.4S44.4 18 44.4 26v10c-1.6 1.4-3.4 1.6-4.4 1V30H24v7c-1 .6-2.8.4-4.4-1z"/>',
    front: '<path d="M20.6 27.6c.2-7.2 5-11.8 11.4-11.8s11.2 4.6 11.4 11.8c-2.4-2.6-5.2-4-8-4.2-1.2 1.4-3 2.2-5 2-2.6-.2-4.6-.8-6-1.8-1.6 1-2.8 2.2-3.8 4z"/>',
    extra: '<path d="M20.8 21.4c3.2-1.8 7-2.6 11.2-2.6s8 .8 11.2 2.6" stroke="#f2c45a" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
  },
];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function svgOf(c: Look): string {
  const neck = shade(c.skin, 0.88);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<path d="M8 66c1.4-12.6 10.6-19 24-19s22.6 6.4 24 19z" fill="${c.shirt}"/>`
    + `<path d="M26 48c1.6 2.6 3.6 3.8 6 3.8s4.4-1.2 6-3.8" fill="none" stroke="${shade(c.shirt, 0.8)}" stroke-width="1.6" stroke-linecap="round"/>`
    + (c.back ? `<g fill="${c.hair}">${c.back}</g>` : '')
    + `<rect x="27" y="38" width="10" height="11" rx="4" fill="${neck}"/>`
    + `<circle cx="20.6" cy="31" r="2.8" fill="${neck}"/><circle cx="43.4" cy="31" r="2.8" fill="${neck}"/>`
    + `<ellipse cx="32" cy="30" rx="11.6" ry="13.2" fill="${c.skin}"/>`
    + `<g fill="${c.hair}">${c.front}</g>`
    + `<circle cx="27.4" cy="30.6" r="1.5" fill="${INK}"/><circle cx="36.6" cy="30.6" r="1.5" fill="${INK}"/>`
    + `<circle cx="24.6" cy="35" r="2" fill="#e37a63" opacity=".28"/><circle cx="39.4" cy="35" r="2" fill="#e37a63" opacity=".28"/>`
    + `<path d="M28.6 36.6c2 2 4.8 2 6.8 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`
    + (c.extra ?? '')
    + `</svg>`;
}

export const CHARACTERS = L.map((c) => ({ id: c.id, gender: c.gender, label: c.label, svg: svgOf(c) }));
export const CHARACTER_URLS = CHARACTERS.map((c) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}`);

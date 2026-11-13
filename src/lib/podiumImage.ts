import type { Podium } from '../engine';
import { avatarColor, avatarInk, initialsOf } from './avatar';
import { CHARACTER_URLS } from './characters';
import { LOGO, SIMBOLO, SIMBOLO_CLARO } from './brandAssets';

export type ImgFormat = 'story' | 'feed';

export interface PodiumInfo {
  /** personagem de cada nome (o mesmo do app) */
  charOf?: (name: string) => number | undefined;
  name: string;
  date: string;
  site: string;
  code: string;
}

/**
 * Cores da marca "Clube de sol" nas artes. Os nomes antigos ficam como papéis:
 * `cocoa` = fundo escuro (verde coqueiro), `butter` = texto claro (creme), `eletrico` = destaque (coral),
 * `raised` = degrau/realce sobre o fundo escuro.
 */
export const C = {
  butter: '#fff6ea',
  cocoa: '#1f5c52',
  eletrico: '#e37a63',
  raised: '#2b7064',
  white: '#ffffff',
  butterSoft: 'rgba(255,246,234,.8)',
  areia: '#f4e7d3',
  creme: '#fff6ea',
  coral: '#e37a63',
  coralForte: '#bf5440',
  pessego: '#f6b8a5',
  turquesa: '#4dbbb5',
  coqueiro: '#1f5c52',
  profundo: '#1e3557',
  dourado: '#f2c45a',
};
export const DISPLAY = 'Outfit, system-ui, sans-serif';
export const BODY = '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type Ctx = CanvasRenderingContext2D;

export async function fontsReady() {
  await brandReady();
  try {
    await Promise.all([
      document.fonts.load('800 120px Outfit'),
      document.fonts.load('700 30px "DM Sans"'),
      document.fonts.load('600 30px "DM Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* segue com a fonte reserva */
  }
}

export function spacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

export function fit(ctx: Ctx, texts: string[], weight: number, family: string, max: number, maxW: number, min = 22): number {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (texts.every((t) => ctx.measureText(t).width <= maxW)) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function topRounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Pílula com o lado esquerdo em `x`. */
export function pill(ctx: Ctx, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, h / 2);
}

const brandImgs: Partial<Record<'band' | 'claro' | 'logo', HTMLImageElement>> = {};
/** Carrega o símbolo e a logo uma vez, pra desenhar no canvas sem esperar. */
export async function brandReady(): Promise<void> {
  const want = { band: SIMBOLO, claro: SIMBOLO_CLARO, logo: LOGO } as const;
  await Promise.all((Object.keys(want) as (keyof typeof want)[]).map(async (k) => {
    if (brandImgs[k]) return;
    const i = new Image();
    i.src = want[k];
    try { await i.decode(); brandImgs[k] = i; } catch { /* sem a imagem, a arte sai sem o símbolo */ }
  }));
}

/**
 * O símbolo da logo (o S com a bola), centrado em (cx, cy), ocupando 2r.
 * `band`: faixa branca, para fundo escuro. `claro`: faixa azul profundo, para fundo claro.
 */
export function ball(ctx: Ctx, cx: number, cy: number, r: number, tone: 'claro' | 'band' = 'band') {
  const img = brandImgs[tone];
  if (img) ctx.drawImage(img, cx - r, cy - r, 2 * r, 2 * r);
}

let charImgs: HTMLImageElement[] | null = null;
/** Carrega os 10 personagens uma vez, pra desenhar no canvas sem esperar. */
export async function charactersReady(): Promise<void> {
  if (charImgs) return;
  const imgs = CHARACTER_URLS.map((u) => { const i = new Image(); i.src = u; return i; });
  await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
  charImgs = imgs;
}

/** Avatar redondo com borda creme: o personagem (se tiver) ou as iniciais. */
export function avatar(ctx: Ctx, name: string, cx: number, cy: number, r: number, ring = C.creme, character?: number) {
  const bg = avatarColor(name);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const img = character !== undefined ? charImgs?.[character] : undefined;
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(4, r * 0.09);
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.lineWidth = Math.max(4, r * 0.09);
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.fillStyle = avatarInk(bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(r * 0.78)}px ${DISPLAY}`;
  ctx.fillText(initialsOf(name), cx, cy + r * 0.04);
  ctx.restore();
}

/** Confete deterministico (mesmo torneio, mesma arte). */
function confetti(ctx: Ctx, seed: string, W: number, y0: number, y1: number, n: number) {
  let h = hash(seed);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return (h >>> 0) / 4294967296; };
  const colors = [C.dourado, C.coral, C.turquesa, C.creme];
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(rnd() * W, y0 + rnd() * (y1 - y0));
    ctx.rotate(rnd() * Math.PI);
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const w = 10 + rnd() * 14;
    roundRect(ctx, -w / 2, -4, w, 8, 4);
    ctx.fill();
    ctx.restore();
  }
}

/** Onda de areia no pé da arte. */
function sandWave(ctx: Ctx, W: number, H: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(0, y + 30);
  ctx.bezierCurveTo(W * 0.25, y - 30, W * 0.55, y + 60, W, y - 10);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = C.areia;
  ctx.fill();
}

/** Linha da marca no topo das artes: a logo completa e a data embaixo (fundo escuro). */
export function brandRow(ctx: Ctx, x: number, y: number, date: string) {
  const logo = brandImgs.logo;
  const h = 64;
  if (logo) ctx.drawImage(logo, x - 4, y - 6, (logo.naturalWidth / logo.naturalHeight) * h, h);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.butterSoft;
  ctx.font = `600 24px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText(date, x, y + h + 26);
  spacing(ctx, 0);
}

const LAYOUT = {
  feed: { w: 1080, h: 1350, top: 72, base: 1130, steps: [330, 250, 200], stepW: [340, 290, 290], name: 88, head: 150, nameMax: [64, 50], av: [92, 74], foot: 1270, wave: 1090 },
  story: { w: 1080, h: 1920, top: 250, base: 1560, steps: [440, 330, 270], stepW: [350, 300, 300], name: 100, head: 180, nameMax: [72, 54], av: [104, 82], foot: 1640, wave: 1500 },
} as const;

/**
 * Tela de vitória (story 1080x1920 ou post 1080x1350): fundo verde coqueiro, confete, o monograma
 * como marca d'água, o pódio dourado/creme/coral com avatar de iniciais em cima de cada degrau
 * e a onda de areia no pé.
 */
export async function renderPodium(p: Podium, info: PodiumInfo, format: ImgFormat): Promise<Blob> {
  await fontsReady();
  await charactersReady();
  const L = LAYOUT[format];
  const W = L.w;
  const H = L.h;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  const X = 72;

  // fundo: verde com um brilho de sol no alto
  ctx.fillStyle = C.coqueiro;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.82, L.top + 40, 20, W * 0.82, L.top + 40, W * 0.75);
  glow.addColorStop(0, 'rgba(242,196,90,.28)');
  glow.addColorStop(1, 'rgba(242,196,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.09;
  ball(ctx, W - 150, L.top + 170, 260, 'band');
  ctx.restore();
  confetti(ctx, info.code + p.division, W, L.top + 260, L.base - L.steps[0] - 140, format === 'story' ? 34 : 24);

  // ---------- topo: marca, nome do torneio, divisão ----------
  brandRow(ctx, X, L.top, info.date);
  let y = L.top + 128;
  ctx.fillStyle = C.creme;
  ctx.textAlign = 'left';
  const nameSize = fit(ctx, [info.name], 800, DISPLAY, L.name, W - X * 2, 44);
  y += nameSize * 0.8;
  ctx.fillText(info.name, X, y);
  y += 26;
  if (p.label) {
    ctx.font = `700 26px ${BODY}`;
    spacing(ctx, 4);
    const t = p.label.toUpperCase();
    const tw = ctx.measureText(t).width + 48;
    pill(ctx, X, y, tw, 52);
    ctx.fillStyle = 'rgba(255,246,234,.14)';
    ctx.fill();
    ctx.fillStyle = C.creme;
    ctx.fillText(t, X + 26, y + 35);
    spacing(ctx, 0);
    y += 52;
  }

  // ---------- CAMPEÃ(S): dourado, com a final embaixo ----------
  ctx.fillStyle = C.dourado;
  const headSize = fit(ctx, [p.headline], 800, DISPLAY, L.head, W - X * 2, 80);
  const headY = y + 40 + headSize * 0.8;
  ctx.fillText(p.headline, X - 4, headY);
  if (p.final) {
    const fy = headY + 28;
    ctx.font = `700 32px ${BODY}`;
    spacing(ctx, 1);
    const t = `Final ${p.final}`;
    const tw = ctx.measureText(t).width + 56;
    pill(ctx, X, fy, tw, 60);
    ctx.fillStyle = C.raised;
    ctx.fill();
    ctx.fillStyle = C.creme;
    ctx.fillText(t, X + 28, fy + 41);
    spacing(ctx, 0);
  }

  // ---------- onda de areia e pódio 2-1-3 ----------
  sandWave(ctx, W, H, L.wave);
  const base = L.base;
  const n = Math.min(3, p.places.length);
  const order = n === 3 ? [1, 0, 2] : n === 2 ? [1, 0] : [0];
  const gap = 16;
  const widths = order.map((idx) => L.stepW[Math.min(idx, 2)]);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (n - 1);
  const xs: number[] = [];
  order.reduce((x, _idx, col) => { xs.push(x); return x + widths[col] + gap; }, (W - total) / 2);
  const fills = [C.dourado, C.creme, C.pessego];

  order.forEach((idx, col) => {
    const place = p.places[idx];
    const first = idx === 0;
    const h = L.steps[Math.min(idx, 2)];
    const w = widths[col];
    const x = xs[col];
    const top = base - h;

    topRounded(ctx, x, top, w, h, 36);
    ctx.fillStyle = fills[Math.min(idx, 2)];
    ctx.fill();

    // avatar(es) em cima do degrau
    const r = L.av[first ? 0 : 1];
    const cy = top - r * 0.35;
    if (place.names.length > 1) {
      avatar(ctx, place.names[0], x + w / 2 - r * 0.62, cy, r * 0.82, C.creme, info.charOf?.(place.names[0]));
      avatar(ctx, place.names[1], x + w / 2 + r * 0.62, cy, r * 0.82, C.creme, info.charOf?.(place.names[1]));
    } else {
      avatar(ctx, place.names[0] ?? '?', x + w / 2, cy, r, C.creme, info.charOf?.(place.names[0] ?? ''));
    }
    if (first) {
      // raios do sol sobre o campeão
      ctx.save();
      ctx.strokeStyle = C.dourado;
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      for (const a of [-130, -90, -50]) {
        const t = (a * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 + Math.cos(t) * (r + 24), cy + Math.sin(t) * (r + 24));
        ctx.lineTo(x + w / 2 + Math.cos(t) * (r + 52), cy + Math.sin(t) * (r + 52));
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = C.profundo;
    const posSize = first ? 92 : 72;
    const posY = top + r * 0.65 + 14 + posSize * 0.8;
    ctx.font = `800 ${posSize}px ${DISPLAY}`;
    ctx.fillText(`${place.pos}º`, x + w / 2, posY);

    const lines = place.names;
    let size = fit(ctx, lines, 700, DISPLAY, L.nameMax[first ? 0 : 1], w - 40, 26);
    const room = top + h - 30 - (place.pts ? 58 : 0) - (posY + 14);
    if (lines.length * size * 1.04 > room) size = Math.max(24, Math.floor(room / (lines.length * 1.04)));
    ctx.font = `700 ${size}px ${DISPLAY}`;
    const lh = size * 1.04;
    let ny = posY + 14 + size * 0.82;
    lines.forEach((line) => { ctx.fillText(line, x + w / 2, ny); ny += lh; });
    if (place.pts) {
      ctx.font = `700 26px ${BODY}`;
      const t = place.pts;
      const tw = ctx.measureText(t).width + 36;
      const py = ny - lh + 26;
      pill(ctx, x + w / 2 - tw / 2, py, tw, 44);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fill();
      ctx.fillStyle = C.profundo;
      ctx.fillText(t, x + w / 2, py + 31);
    }
  });

  // ---------- rodapé, na areia ----------
  ctx.fillStyle = C.profundo;
  ctx.textAlign = 'center';
  ctx.font = `600 27px ${BODY}`;
  ctx.fillText(`Ao vivo em ${info.site} · código ${info.code}`, W / 2, L.foot);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

export function podiumFileName(p: Podium, tournament: string, format: ImgFormat): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug(tournament) || 'torneio'}${p.label ? `-${slug(p.label)}` : ''}-campeoes-${format}.png`;
}

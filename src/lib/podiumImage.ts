import type { Podium } from '../engine';
import { SYMBOL_R, SYMBOL_SEAM, SYMBOL_STROKE } from './brandPaths';

export type ImgFormat = 'story' | 'feed';

export interface PodiumInfo {
  name: string;
  date: string;
  site: string;
  code: string;
}

/** Cores da marca (guia da marca → Cores). As artes são sempre sobre cacau, como o pódio do app. */
export const C = {
  butter: '#fbe38e',
  cocoa: '#3a2218',
  eletrico: '#2b5bff',
  raised: '#5a3829',
  white: '#ffffff',
  butterSoft: 'rgba(251,227,142,.78)',
};
export const DISPLAY = '"Baloo 2", ui-rounded, system-ui, sans-serif';
export const BODY = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type Ctx = CanvasRenderingContext2D;

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`800 120px "Baloo 2"`),
      document.fonts.load('700 30px Barlow'),
      document.fonts.load('600 30px Barlow'),
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

/**
 * O símbolo: a bola com a costura em 8, o mesmo desenho do app.
 * `claro`: bola azul e costura manteiga (sobre manteiga). `band`: bola manteiga e costura azul (sobre cacau).
 */
export function ball(ctx: Ctx, cx: number, cy: number, r: number, tone: 'claro' | 'band' = 'band') {
  const s = r / SYMBOL_R;
  ctx.save();
  ctx.translate(cx - 32 * s, cy - 32 * s);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(32, 32, SYMBOL_R, 0, Math.PI * 2);
  ctx.fillStyle = tone === 'claro' ? C.eletrico : C.butter;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = tone === 'claro' ? C.butter : C.eletrico;
  ctx.lineWidth = SYMBOL_STROKE;
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(SYMBOL_SEAM));
  ctx.restore();
}

/** Linha da marca no topo das artes: símbolo + SUPER 8 AO VIVO, e a data embaixo. */
export function brandRow(ctx: Ctx, x: number, y: number, date: string) {
  ball(ctx, x + 22, y + 22, 22, 'band');
  ctx.textAlign = 'left';
  ctx.fillStyle = C.butter;
  ctx.font = `700 28px ${BODY}`;
  spacing(ctx, 6);
  ctx.fillText('SUPER 8 AO VIVO', x + 60, y + 32);
  ctx.fillStyle = C.butterSoft;
  ctx.font = `600 26px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText(date, x + 60, y + 72);
  spacing(ctx, 0);
}

/** Bloco azul com o 8 gigante da Baloo 2 vazado em cacau, girado -18° (forma de arte, não é costura). */
function eightBlock(ctx: Ctx, x: number, y: number, w: number, h: number, size: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 32);
  ctx.fillStyle = C.eletrico;
  ctx.fill();
  ctx.clip();
  ctx.translate(x + w * 0.46, y + h * 0.56);
  ctx.rotate((-18 * Math.PI) / 180);
  ctx.fillStyle = C.cocoa;
  ctx.textAlign = 'center';
  ctx.font = `800 ${size}px ${DISPLAY}`;
  ctx.fillText('8', 0, size * 0.36);
  ctx.restore();
}

const LAYOUT = {
  feed: { w: 1080, h: 1350, top: 72, base: 1200, steps: [410, 300, 240], stepW: [380, 300, 290], name: 92, head: 220, nameMax: [72, 54], ball: 58, block: { x: 760, y: -40, w: 380, h: 470 }, eight: 640, foot: 88 },
  story: { w: 1080, h: 1920, top: 250, base: 1590, steps: [520, 370, 290], stepW: [400, 310, 300], name: 104, head: 250, nameMax: [80, 58], ball: 66, block: { x: 740, y: -40, w: 400, h: 700 }, eight: 820, foot: 110 },
} as const;

/** Arte de campeões (story 1080x1920 ou post 1080x1350): fundo cacau, o 8 gigante e o pódio com a bola no 1º. */
export async function renderPodium(p: Podium, info: PodiumInfo, format: ImgFormat): Promise<Blob> {
  await fontsReady();
  const L = LAYOUT[format];
  const W = L.w;
  const H = L.h;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  const X = 72;

  ctx.fillStyle = C.cocoa;
  ctx.fillRect(0, 0, W, H);
  eightBlock(ctx, L.block.x, L.block.y, L.block.w, L.block.h, L.eight);

  // ---------- topo: marca, nome do torneio, divisão ----------
  brandRow(ctx, X, L.top, info.date);
  const leftW = L.block.x - X - 40;
  let y = L.top + 120;
  ctx.fillStyle = C.butter;
  ctx.textAlign = 'left';
  const nameSize = fit(ctx, [info.name], 800, DISPLAY, L.name, leftW, 44);
  y += nameSize * 0.78;
  ctx.fillText(info.name, X, y);
  y += 26;
  if (p.label) {
    ctx.font = `700 28px ${BODY}`;
    spacing(ctx, 5);
    const t = p.label.toUpperCase();
    const tw = ctx.measureText(t).width + 48;
    pill(ctx, X, y, tw, 54);
    ctx.strokeStyle = C.butter;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = C.butter;
    ctx.fillText(t, X + 26, y + 37);
    spacing(ctx, 0);
    y += 54;
  }

  // ---------- CAMPEÃS: embaixo do bloco azul, largura toda ----------
  ctx.fillStyle = C.butter;
  const headSize = fit(ctx, [p.headline], 800, DISPLAY, L.head, W - X * 2, 90);
  const headY = Math.max(y + 24, L.block.y + L.block.h + 24) + headSize * 0.74;
  ctx.fillText(p.headline, X - 6, headY);
  y = headY + 30;
  if (p.final) {
    ctx.font = `700 34px ${BODY}`;
    spacing(ctx, 2);
    const t = `Final ${p.final}`;
    const tw = ctx.measureText(t).width + 56;
    pill(ctx, X, y, tw, 64);
    ctx.fillStyle = C.raised;
    ctx.fill();
    ctx.fillStyle = C.butter;
    ctx.fillText(t, X + 30, y + 44);
    spacing(ctx, 0);
  }

  // ---------- pódio 2-1-3, chapado ----------
  const base = L.base;
  const n = Math.min(3, p.places.length);
  const order = n === 3 ? [1, 0, 2] : n === 2 ? [1, 0] : [0];
  const gap = 20;
  const widths = order.map((idx) => L.stepW[Math.min(idx, 2)]);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (n - 1);
  const xs: number[] = [];
  order.reduce((x, _idx, col) => { xs.push(x); return x + widths[col] + gap; }, (W - total) / 2);

  order.forEach((idx, col) => {
    const place = p.places[idx];
    const first = idx === 0;
    const h = L.steps[Math.min(idx, 2)];
    const w = widths[col];
    const x = xs[col];
    const top = base - h;
    const ink = first ? C.cocoa : C.butter;

    topRounded(ctx, x, top, w, h, 24);
    ctx.fillStyle = first ? C.butter : C.raised;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    const posSize = first ? 112 : 84;
    const posY = top + (first ? L.ball + 18 : 28) + posSize * 0.78;
    ctx.font = `800 ${posSize}px ${DISPLAY}`;
    ctx.fillText(`${place.pos}º`, x + w / 2, posY);

    const lines = place.names;
    let size = fit(ctx, lines, 800, DISPLAY, L.nameMax[first ? 0 : 1], w - 40, 26);
    // cabe na altura do degrau: posição, nomes e pontos
    const room = top + h - 26 - (place.pts ? 46 : 0) - (posY + 18);
    if (lines.length * size * 1.02 > room) size = Math.max(26, Math.floor(room / (lines.length * 1.02)));
    ctx.font = `800 ${size}px ${DISPLAY}`;
    const lh = size * 1.02;
    let ny = posY + 18 + size * 0.8;
    lines.forEach((line) => { ctx.fillText(line, x + w / 2, ny); ny += lh; });
    if (place.pts) {
      ctx.font = `600 28px ${BODY}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(place.pts, x + w / 2, ny - lh + 46);
      ctx.globalAlpha = 1;
    }
    // a bola em cima do 1º lugar: a costura da arte
    if (first) ball(ctx, x + w / 2, top, L.ball, 'claro');
  });

  // ---------- rodapé ----------
  ctx.fillStyle = C.butterSoft;
  ctx.textAlign = 'center';
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`Ao vivo em ${info.site} · código ${info.code}`, W / 2, base + L.foot);
  spacing(ctx, 0);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

export function podiumFileName(p: Podium, tournament: string, format: ImgFormat): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug(tournament) || 'torneio'}${p.label ? `-${slug(p.label)}` : ''}-campeoes-${format}.png`;
}

import { mulberry32, type Podium } from '../engine';

export type ImgFormat = 'story' | 'feed';

export interface PodiumInfo {
  name: string;
  date: string;
  site: string;
  code: string;
}

const C = {
  glow: '#22729a',
  mid: '#123a55',
  deep: '#06141f',
  sand: '#f2e8d3',
  floorA: '#ecdab4',
  floorB: '#d3b985',
  navy: '#12334a',
  ball: '#f2b705',
  ballInk: '#2a2100',
  extrude: '#b5400f',
  silver: '#e4ebef',
  bronze: '#d8914f',
};
const CONFETTI = ['#f2b705', '#ff8f5a', '#62b9de', '#ffffff', '#f2e8d3', '#ffd54a'];
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const BODY = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const LAYOUT = {
  feed: { w: 1080, h: 1350, top: 70, floor: 130, steps: [330, 235, 175], stepW: [400, 320, 290], head: 190, trophy: 240, nameMax: [68, 50], ball: 50, confetti: 70 },
  story: { w: 1080, h: 1920, top: 250, floor: 320, steps: [430, 305, 225], stepW: [420, 330, 300], head: 240, trophy: 310, nameMax: [76, 56], ball: 60, confetti: 95 },
} as const;

type Ctx = CanvasRenderingContext2D;

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('900 120px "Big Shoulders Display"'),
      document.fonts.load('800 60px "Big Shoulders Display"'),
      document.fonts.load('700 30px Barlow'),
      document.fonts.load('600 30px Barlow'),
    ]);
    await document.fonts.ready;
  } catch {
    /* segue com a fonte reserva */
  }
}

function spacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function fit(ctx: Ctx, texts: string[], weight: number, family: string, max: number, maxW: number, min = 22): number {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (texts.every((t) => ctx.measureText(t).width <= maxW)) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function topRounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function pill(ctx: Ctx, cx: number, y: number, w: number, h: number) {
  const x = cx - w / 2;
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

function ball(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(1, '#e0a400');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.arc(cx - r * 1.2, cy, r * 0.9, -Math.PI / 2.5, Math.PI / 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 1.2, cy, r * 0.9, Math.PI - Math.PI / 2.5, Math.PI + Math.PI / 2.5);
  ctx.stroke();
  ctx.restore();
}

function sparkle(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
  ctx.restore();
}

/** Taça desenhada à mão: bojo, alças, haste, base e pedestal. `top` é o topo do bojo, `h` a altura total. */
function trophy(ctx: Ctx, cx: number, top: number, h: number) {
  const w = h * 0.74;
  const bh = h * 0.5;
  const y0 = top + h * 0.03;

  const glow = ctx.createRadialGradient(cx, top + h * 0.35, 0, cx, top + h * 0.35, h * 1.05);
  glow.addColorStop(0, 'rgba(255,214,90,.5)');
  glow.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - h * 1.1, top - h * 0.8, h * 2.2, h * 2.2);

  const gold = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gold.addColorStop(0, '#94650a');
  gold.addColorStop(0.28, '#ffe486');
  gold.addColorStop(0.5, '#f7c21a');
  gold.addColorStop(0.78, '#d29a07');
  gold.addColorStop(1, '#7d5404');

  // alças
  ctx.strokeStyle = gold;
  ctx.lineWidth = w * 0.075;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx - w / 2 + w * 0.02, y0 + bh * 0.34, w * 0.18, bh * 0.25, 0, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + w / 2 - w * 0.02, y0 + bh * 0.34, w * 0.18, bh * 0.25, 0, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  // bojo
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y0);
  ctx.lineTo(cx + w / 2, y0);
  ctx.bezierCurveTo(cx + w / 2, y0 + bh * 0.72, cx + w * 0.2, y0 + bh * 0.95, cx + w * 0.07, y0 + bh);
  ctx.lineTo(cx - w * 0.07, y0 + bh);
  ctx.bezierCurveTo(cx - w * 0.2, y0 + bh * 0.95, cx - w / 2, y0 + bh * 0.72, cx - w / 2, y0);
  ctx.fill();
  // borda
  ctx.beginPath();
  ctx.ellipse(cx, y0, w / 2 + 3, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe9a0';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, y0 + 2, w / 2 - 8, h * 0.018, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#a77406';
  ctx.fill();
  // bolinha no bojo
  ball(ctx, cx, y0 + bh * 0.42, w * 0.13);
  // brilho
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.29, y0 + bh * 0.36, w * 0.04, bh * 0.27, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // haste
  ctx.fillStyle = gold;
  const sy = y0 + bh;
  const sh = h * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.06, sy);
  ctx.lineTo(cx + w * 0.06, sy);
  ctx.lineTo(cx + w * 0.11, sy + sh);
  ctx.lineTo(cx - w * 0.11, sy + sh);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, sy + sh * 0.35, w * 0.1, sh * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // base dourada
  const by = sy + sh;
  const bw = w * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.4, by);
  ctx.lineTo(cx + bw * 0.4, by);
  ctx.lineTo(cx + bw / 2, by + h * 0.09);
  ctx.lineTo(cx - bw / 2, by + h * 0.09);
  ctx.closePath();
  ctx.fill();

  // pedestal escuro com plaquinha
  const py = by + h * 0.09;
  const pw = w * 0.8;
  const ph = top + h - py;
  ctx.fillStyle = '#16232b';
  ctx.fillRect(cx - pw / 2, py, pw, ph);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(cx - pw / 2, py, pw, ph * 0.18);
  ctx.fillStyle = gold;
  ctx.fillRect(cx - pw * 0.3, py + ph * 0.32, pw * 0.6, ph * 0.38);

  sparkle(ctx, cx + w * 0.62, top + h * 0.05, h * 0.06);
  sparkle(ctx, cx - w * 0.7, top + h * 0.3, h * 0.04);
  sparkle(ctx, cx + w * 0.5, top + h * 0.55, h * 0.03);
}

/** Arte de campeões (story 1080x1920 ou post 1080x1350): raios de luz, confete, taça no pódio. */
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
  const rnd = mulberry32(hash(`${info.name}|${p.division}|${format}`));

  // ---------- medidas ----------
  const title = info.name.toUpperCase();
  const head = p.headline.toUpperCase();
  let y = L.top + 66;
  const nameSize = fit(ctx, [title], 900, DISPLAY, format === 'story' ? 112 : 100, W - 120, 48);
  const nameY = y + nameSize * 0.86;
  y = nameY + 20;
  const chipY = y;
  if (p.label) y += 54;
  const headSize = fit(ctx, [head], 900, DISPLAY, L.head, W - 110, 80);
  const depth = Math.round(headSize * 0.05);
  const headY = y + 22 + headSize * 0.8;
  y = headY + depth;
  const pillY = y + 28;
  if (p.final) y = pillY + 66;

  const base = H - L.floor;
  const n = Math.min(3, p.places.length);
  const order = n === 3 ? [1, 0, 2] : n === 2 ? [1, 0] : [0];
  const gap = 22;
  const widths = order.map((idx) => L.stepW[Math.min(idx, 2)]);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (n - 1);
  const xs: number[] = [];
  order.reduce((x, _idx, col) => { xs.push(x); return x + widths[col] + gap; }, (W - total) / 2);
  const firstCol = order.indexOf(0);
  const cx1 = xs[firstCol] + widths[firstCol] / 2;
  const top1 = base - L.steps[0];
  const trophyH = Math.max(140, Math.min(L.trophy, top1 - (y + 30)));
  const trophyTop = top1 - trophyH + 4;

  // ---------- fundo: holofote, raios e confete ----------
  const lx = cx1;
  const ly = trophyTop + trophyH * 0.4;
  const bg = ctx.createRadialGradient(lx, ly, 0, lx, ly, H * 0.95);
  bg.addColorStop(0, C.glow);
  bg.addColorStop(0.45, C.mid);
  bg.addColorStop(1, C.deep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const rays = ctx.createRadialGradient(lx, ly, 0, lx, ly, H * 0.8);
  rays.addColorStop(0, 'rgba(255,222,120,.22)');
  rays.addColorStop(1, 'rgba(255,222,120,0)');
  ctx.fillStyle = rays;
  const nRays = 18;
  for (let i = 0; i < nRays; i++) {
    const a = (i / nRays) * Math.PI * 2 + 0.08;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, H * 1.2, a, a + Math.PI / nRays * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < L.confetti; i++) {
    const x = rnd() * W;
    const cy = L.top - 40 + rnd() * (base - L.top - 20);
    const color = CONFETTI[Math.floor(rnd() * CONFETTI.length)];
    const kind = rnd();
    ctx.save();
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.translate(x, cy);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (kind < 0.6) {
      const w = 10 + rnd() * 14;
      ctx.fillRect(-w / 2, -w / 4, w, w / 2.2);
    } else if (kind < 0.85) {
      ctx.beginPath();
      ctx.arc(0, 0, 3 + rnd() * 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.quadraticCurveTo(-6, -14, 4, 0);
      ctx.quadraticCurveTo(12, 12, 22, -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- topo ----------
  const t0 = L.top;
  ball(ctx, 60 + 22, t0 + 21, 22);
  ctx.fillStyle = C.ball;
  ctx.font = `700 28px ${BODY}`;
  spacing(ctx, 6);
  ctx.textAlign = 'left';
  ctx.fillText('SUPER 8 AO VIVO', 60 + 58, t0 + 31);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(242,232,211,.8)';
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText(info.date, W - 60, t0 + 31);
  spacing(ctx, 0);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.sand;
  ctx.font = `900 ${nameSize}px ${DISPLAY}`;
  ctx.fillText(title, W / 2, nameY);

  if (p.label) {
    ctx.font = `700 30px ${BODY}`;
    spacing(ctx, 6);
    const t = p.label.toUpperCase();
    const tw = ctx.measureText(t).width + 56;
    ctx.fillStyle = 'rgba(6,20,31,.55)';
    pill(ctx, W / 2, chipY, tw, 54);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,232,211,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.sand;
    ctx.fillText(t, W / 2 + 3, chipY + 38);
    spacing(ctx, 0);
  }

  // CAMPEÃS em 3D
  ctx.font = `900 ${headSize}px ${DISPLAY}`;
  ctx.fillStyle = C.extrude;
  for (let i = depth; i >= 1; i--) ctx.fillText(head, W / 2 + i * 0.6, headY + i);
  const hg = ctx.createLinearGradient(0, headY - headSize * 0.8, 0, headY);
  hg.addColorStop(0, '#ffd84d');
  hg.addColorStop(1, '#f2a900');
  ctx.fillStyle = hg;
  ctx.fillText(head, W / 2, headY);

  if (p.final) {
    ctx.font = `700 36px ${BODY}`;
    spacing(ctx, 3);
    const t = `FINAL  ${p.final}`;
    const tw = ctx.measureText(t).width + 64;
    pill(ctx, W / 2, pillY, tw, 66);
    ctx.fillStyle = 'rgba(6,20,31,.75)';
    ctx.fill();
    ctx.strokeStyle = C.ball;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = C.sand;
    ctx.fillText(t, W / 2 + 2, pillY + 46);
    spacing(ctx, 0);
  }

  // ---------- areia ----------
  const fl = ctx.createLinearGradient(0, base, 0, H);
  fl.addColorStop(0, C.floorA);
  fl.addColorStop(1, C.floorB);
  ctx.fillStyle = fl;
  ctx.fillRect(0, base, W, H - base);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,90,40,.22)' : 'rgba(255,255,255,.35)';
    ctx.fillRect(rnd() * W, base + 6 + rnd() * (H - base), 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const sh = ctx.createRadialGradient(W / 2, base + 6, 0, W / 2, base + 6, total * 0.62);
  sh.addColorStop(0, 'rgba(60,40,10,.35)');
  sh.addColorStop(1, 'rgba(60,40,10,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, base, W, 60);

  // ---------- pódio ----------
  const looks = [
    { fill: ['#ffd84d', '#e9a800'], ink: C.ballInk },
    { fill: ['#f4f8fa', '#c9d4da'], ink: C.navy },
    { fill: ['#eaa766', '#b8702f'], ink: '#3b1d07' },
  ];
  order.forEach((idx, col) => {
    const place = p.places[idx];
    const look = looks[Math.min(place.pos, 3) - 1];
    const h = L.steps[Math.min(idx, 2)];
    const w = widths[col];
    const x = xs[col];
    const top = base - h;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 12;
    const sg = ctx.createLinearGradient(0, top, 0, base);
    sg.addColorStop(0, look.fill[0]);
    sg.addColorStop(1, look.fill[1]);
    ctx.fillStyle = sg;
    topRounded(ctx, x, top, w, h, 18);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    topRounded(ctx, x, top, w, 12, 12);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = look.ink;
    ctx.globalAlpha = 0.8;
    ctx.font = `700 24px ${BODY}`;
    spacing(ctx, 5);
    ctx.fillText(`${place.pos}º LUGAR`, x + w / 2 + 2, top + 50);
    spacing(ctx, 0);
    ctx.globalAlpha = 1;

    const lines = place.names.map((s) => s.toUpperCase());
    const size = fit(ctx, lines, 800, DISPLAY, L.nameMax[idx === 0 ? 0 : 1], w - 36, 24);
    const lh = size * 1.0;
    const area = h - 70;
    const blockH = lh * lines.length;
    const startY = top + 70 + Math.max(0, (Math.min(area, size * 3.2) - blockH) / 2) + size * 0.82;
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, startY + i * lh));

    // em cima do 2º degrau, uma bolinha de beach tennis
    if (idx === 1) {
      const r = L.ball;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, top + 2, r * 0.9, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ball(ctx, x + w * 0.5, top - r + 4, r);
    }
  });

  trophy(ctx, cx1, trophyTop, trophyH);

  // ---------- rodapé ----------
  ctx.fillStyle = C.navy;
  ctx.textAlign = 'center';
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`Ao vivo em ${info.site} · código ${info.code}`, W / 2, base + (format === 'story' ? 92 : 78));
  spacing(ctx, 0);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

export function podiumFileName(p: Podium, tournament: string, format: ImgFormat): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug(tournament) || 'torneio'}${p.label ? `-${slug(p.label)}` : ''}-campeoes-${format}.png`;
}

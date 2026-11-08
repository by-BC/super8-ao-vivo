import type { PlayerCard, Podium } from '../engine';
import { ball, BODY, C, DISPLAY, fit, fontsReady, spacing, sparkle, type ImgFormat, type PodiumInfo } from './podiumImage';

type Ctx = CanvasRenderingContext2D;

/** Lê a foto escolhida no celular. Ela fica só no aparelho, não sobe pra lugar nenhum. */
export async function loadPhoto(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; });
  }
  return img;
}

/** Desenha cobrindo a área inteira. `focus` (0 a 1) escolhe que parte da foto fica quando ela sobra. */
function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, focus: number) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const r = w / h;
  let sw = iw;
  let sh = ih;
  let sx = 0;
  let sy = 0;
  if (iw / ih > r) { sw = ih * r; sx = (iw - sw) * focus; } else { sh = iw / r; sy = (ih - sh) * focus; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function canvasFor(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

/** Granulado de filme por cima de tudo. */
function grain(ctx: Ctx, w: number, h: number, alpha = 0.07) {
  const t = document.createElement('canvas');
  t.width = 160;
  t.height = 160;
  const tc = t.getContext('2d')!;
  const data = tc.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tc.putImageData(data, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(t, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function brandRow(ctx: Ctx, W: number, y: number, date: string) {
  ball(ctx, 60 + 22, y + 21, 22);
  ctx.fillStyle = C.ball;
  ctx.font = `700 28px ${BODY}`;
  spacing(ctx, 6);
  ctx.textAlign = 'left';
  ctx.fillText('SUPER 8 AO VIVO', 60 + 58, y + 31);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(242,232,211,.85)';
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText(date, W - 60, y + 31);
  spacing(ctx, 0);
}

/** Pôster estilo capa de revista: foto dos campeões em tela cheia e a tipografia por cima. */
export async function renderPhotoPoster(p: Podium, info: PodiumInfo, format: ImgFormat, photo: HTMLImageElement, focus: number): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const H = format === 'story' ? 1920 : 1350;
  const safeTop = format === 'story' ? 230 : 60;
  const safeBottom = format === 'story' ? 250 : 64;
  const { canvas, ctx } = canvasFor(W, H);

  ctx.fillStyle = C.deep;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = 'contrast(1.06) saturate(1.1)';
  drawCover(ctx, photo, 0, 0, W, H, focus);
  ctx.restore();

  const top = ctx.createLinearGradient(0, 0, 0, H * 0.3);
  top.addColorStop(0, 'rgba(6,20,31,.75)');
  top.addColorStop(1, 'rgba(6,20,31,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.3);
  const bottom = ctx.createLinearGradient(0, H * 0.4, 0, H);
  bottom.addColorStop(0, 'rgba(6,20,31,0)');
  bottom.addColorStop(0.5, 'rgba(6,20,31,.82)');
  bottom.addColorStop(1, 'rgba(6,20,31,.97)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);
  grain(ctx, W, H);

  brandRow(ctx, W, safeTop, info.date);

  // bloco de baixo, montado de baixo pra cima
  const x = 64;
  const maxW = W - 128;
  ctx.textAlign = 'left';
  let y = H - safeBottom;
  ctx.fillStyle = 'rgba(242,232,211,.6)';
  ctx.font = `600 24px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`${info.site} · código ${info.code}`, x, y);
  spacing(ctx, 0);

  const second = p.places[1] ? p.places[1].names.join(' & ') : '';
  const sub = p.final
    ? `Final ${p.final}${second ? ` · vice: ${second}` : ''}`
    : p.places.slice(1).map((pl) => `${pl.pos}º ${pl.names.join(' & ')}`).join(' · ');
  y -= 58;
  ctx.fillStyle = 'rgba(242,232,211,.92)';
  fit(ctx, [sub], 600, BODY, 32, maxW, 20);
  ctx.fillText(sub, x, y);

  y -= 22;
  const names = p.places[0].names.map((s) => s.toUpperCase());
  const joined = names.join(' & ');
  ctx.fillStyle = '#ffffff';
  let nameSize = fit(ctx, [joined], 900, DISPLAY, format === 'story' ? 130 : 112, maxW, 40);
  const lines = nameSize >= 84 || names.length === 1 ? [joined] : names;
  if (lines.length > 1) nameSize = fit(ctx, lines, 900, DISPLAY, format === 'story' ? 130 : 112, maxW, 40);
  y -= 30;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], x - 3, y);
    y -= nameSize * 0.98;
  }

  const head = p.headline.toUpperCase();
  ctx.fillStyle = C.ball;
  const headSize = fit(ctx, [head], 900, DISPLAY, format === 'story' ? 330 : 270, maxW + 10, 80);
  y -= 6;
  ctx.fillText(head, x - 8, y + headSize * 0.06);
  y -= headSize * 0.8;

  const kicker = [info.name, p.label].filter(Boolean).join(' · ').toUpperCase();
  ctx.fillStyle = C.sand;
  ctx.font = `700 30px ${BODY}`;
  spacing(ctx, 5);
  fit(ctx, [kicker], 700, BODY, 30, maxW - 100, 18);
  y -= 26;
  ctx.fillText(kicker, x + 92, y);
  spacing(ctx, 0);
  ctx.fillStyle = C.ball;
  ctx.fillRect(x, y - 13, 72, 8);

  return toPng(canvas);
}

const TIERS = {
  ouro: { stops: ['#fff3b0', '#f7c948', '#e3a700', '#fff0a0', '#c48c00'], ink: '#2a2100', accent: '#6e4a00', trim: '#fff7d1', glow: 'rgba(255,214,90,.55)' },
  prata: { stops: ['#ffffff', '#e1e8ec', '#aebcc4', '#f5f8fa', '#8d9ea8'], ink: '#12334a', accent: '#3f5866', trim: '#ffffff', glow: 'rgba(220,235,245,.45)' },
  azul: { stops: ['#2f8cbf', '#1b6390', '#0f3d5c', '#16557a', '#0a2a40'], ink: '#f2e8d3', accent: '#f2b705', trim: '#f2b705', glow: 'rgba(60,160,220,.45)' },
} as const;

function shield(ctx: Ctx, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - h * 0.14);
  ctx.quadraticCurveTo(x + w, y + h - h * 0.05, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h - h * 0.05, x, y + h - h * 0.14);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}

/** Cartinha do jogador (story 1080x1920), com foto opcional. */
export async function renderPlayerCard(card: PlayerCard, info: PodiumInfo, photo: HTMLImageElement | null, focus: number): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const H = 1920;
  const { canvas, ctx } = canvasFor(W, H);
  const T = TIERS[card.tier];

  // fundo
  ctx.fillStyle = C.deep;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    ctx.save();
    ctx.filter = 'blur(30px) saturate(1.2)';
    drawCover(ctx, photo, -60, -60, W + 120, H + 120, focus);
    ctx.restore();
    ctx.fillStyle = 'rgba(6,20,31,.62)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, H * 0.75);
    bg.addColorStop(0, '#1d5a7e');
    bg.addColorStop(1, C.deep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(242,232,211,.05)';
    ctx.lineWidth = 2;
    for (let i = -H; i < W; i += 46) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }
  }

  // topo
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ball;
  ctx.font = `700 30px ${BODY}`;
  spacing(ctx, 8);
  ctx.fillText('MINHA CARTINHA', W / 2 + 4, 262);
  spacing(ctx, 0);
  ctx.fillStyle = C.sand;
  fit(ctx, [info.name.toUpperCase()], 900, DISPLAY, 88, W - 140, 40);
  ctx.fillText(info.name.toUpperCase(), W / 2, 350);
  ctx.fillStyle = 'rgba(242,232,211,.75)';
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText([card.division, info.date].filter(Boolean).join(' · '), W / 2, 398);
  spacing(ctx, 0);

  // carta
  const cw = 780;
  const ch = 1110;
  const x0 = (W - cw) / 2;
  const y0 = 450;
  const glow = ctx.createRadialGradient(W / 2, y0 + ch * 0.45, 0, W / 2, y0 + ch * 0.45, ch * 0.75);
  glow.addColorStop(0, T.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, y0 - 200, W, ch + 400);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  const g = ctx.createLinearGradient(x0, y0, x0 + cw, y0 + ch);
  T.stops.forEach((s, i) => g.addColorStop(i / (T.stops.length - 1), s));
  ctx.fillStyle = g;
  shield(ctx, x0, y0, cw, ch, 64);
  ctx.fill();
  ctx.restore();

  ctx.save();
  shield(ctx, x0, y0, cw, ch, 64);
  ctx.clip();
  // textura e brilho
  ctx.strokeStyle = card.tier === 'azul' ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.arc(x0 + cw * 1.1, y0 - ch * 0.1, 120 + i * 48, 0, Math.PI * 2);
    ctx.stroke();
  }
  const shine = ctx.createLinearGradient(x0, y0, x0 + cw, y0 + ch * 0.6);
  shine.addColorStop(0.3, 'rgba(255,255,255,0)');
  shine.addColorStop(0.42, 'rgba(255,255,255,.28)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(x0, y0, cw, ch);

  // foto ou iniciais
  const px = x0 + 300;
  const py = y0 + 70;
  const pw = cw - 340;
  const ph = 540;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.lineTo(px, py + pw / 2);
    ctx.arc(px + pw / 2, py + pw / 2, pw / 2, Math.PI, 0);
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    ctx.clip();
    drawCover(ctx, photo, px, py, pw, ph, focus);
    const fade = ctx.createLinearGradient(0, py + ph * 0.6, 0, py + ph);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, T.stops[2]);
    ctx.fillStyle = fade;
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
  } else {
    ctx.fillStyle = card.tier === 'azul' ? 'rgba(242,232,211,.16)' : 'rgba(0,0,0,.13)';
    ctx.textAlign = 'center';
    fit(ctx, [initials(card.name)], 900, DISPLAY, 360, pw - 20, 120);
    ctx.fillText(initials(card.name), px + pw / 2, py + ph * 0.72);
  }
  ctx.restore();

  // moldura
  ctx.strokeStyle = T.trim;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 4;
  shield(ctx, x0 + 18, y0 + 18, cw - 36, ch - 36, 52);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // nota e posição
  const colX = x0 + 160;
  ctx.textAlign = 'center';
  ctx.fillStyle = T.ink;
  ctx.font = `900 200px ${DISPLAY}`;
  ctx.fillText(String(card.rating), colX, y0 + 250);
  ctx.fillStyle = T.accent;
  fit(ctx, [card.tag], 800, DISPLAY, 64, 230, 30);
  ctx.fillText(card.tag, colX, y0 + 322);
  ctx.fillStyle = T.ink;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(colX - 60, y0 + 352, 120, 3);
  ctx.globalAlpha = 1;
  ball(ctx, colX, y0 + 420, 40);
  ctx.fillStyle = T.ink;
  ctx.font = `700 28px ${BODY}`;
  spacing(ctx, 4);
  ctx.fillText(card.scope.toUpperCase(), colX + 2, y0 + 510);
  spacing(ctx, 0);

  // nome
  const name = card.name.toUpperCase();
  ctx.fillStyle = T.ink;
  fit(ctx, [name], 900, DISPLAY, 128, cw - 110, 50);
  ctx.fillText(name, W / 2, y0 + 712);
  ctx.strokeStyle = T.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0 + 90, y0 + 748);
  ctx.lineTo(x0 + cw - 90, y0 + 748);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2, y0 + 775);
  ctx.lineTo(W / 2, y0 + 975);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // atributos
  const sg = card.sg > 0 ? `+${card.sg}` : String(card.sg);
  const stats: [string, string][][] = [
    [[String(card.v), 'VIT'], [String(card.e), 'EMP'], [String(card.d), 'DER']],
    [[sg, 'SAL'], [String(card.gf), 'GAM'], [String(card.pts), 'PTS']],
  ];
  stats.forEach((col, ci) => {
    const cx = x0 + cw * (ci === 0 ? 0.27 : 0.69);
    col.forEach(([val, label], ri) => {
      const by = y0 + 832 + ri * 70;
      ctx.textAlign = 'right';
      ctx.fillStyle = T.ink;
      ctx.font = `900 66px ${DISPLAY}`;
      ctx.fillText(val, cx + 20, by);
      ctx.textAlign = 'left';
      ctx.fillStyle = T.accent;
      ctx.font = `700 30px ${BODY}`;
      spacing(ctx, 3);
      ctx.fillText(label, cx + 38, by - 4);
      spacing(ctx, 0);
    });
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = T.accent;
  ctx.font = `700 24px ${BODY}`;
  spacing(ctx, 3);
  const foot = `${card.pos}º DE ${card.of} · ${card.j} ${card.j === 1 ? 'JOGO' : 'JOGOS'}`;
  ctx.fillText(foot, W / 2 + 2, y0 + 1032);
  spacing(ctx, 0);

  if (card.tier !== 'azul') {
    sparkle(ctx, x0 + cw - 30, y0 + 40, 30);
    sparkle(ctx, x0 + 20, y0 + ch * 0.55, 20);
    sparkle(ctx, x0 + cw + 10, y0 + ch * 0.7, 16);
  }

  // rodapé
  ctx.fillStyle = 'rgba(242,232,211,.75)';
  ctx.font = `600 26px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`Ao vivo em ${info.site} · código ${info.code}`, W / 2, 1650);
  spacing(ctx, 0);

  return toPng(canvas);
}

export function cardFileName(card: PlayerCard, tournament: string): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `cartinha-${slug(card.name)}-${slug(tournament) || 'torneio'}.png`;
}

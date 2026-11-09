import type { PlayerCard, Podium } from '../engine';
import { ball, BODY, brandRow, C, DISPLAY, fit, fontsReady, roundRect, spacing, type ImgFormat, type PodiumInfo } from './podiumImage';

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

/**
 * Pôster com a foto dos campeões: a foto entra inteira, sem filtro, entre duas faixas cacau.
 * O texto fica sempre na faixa, nunca em cima da foto (guia da marca → Artes de compartilhar).
 */
export async function renderPhotoPoster(p: Podium, info: PodiumInfo, format: ImgFormat, photo: HTMLImageElement, focus: number): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const story = format === 'story';
  const H = story ? 1920 : 1350;
  const X = 64;
  const maxW = W - X * 2;
  const { canvas, ctx } = canvasFor(W, H);
  ctx.fillStyle = C.cocoa;
  ctx.fillRect(0, 0, W, H);

  // faixa de cima: marca e o nome do torneio (no story, abaixo da área dos botões do Instagram)
  const top = story ? 230 : 56;
  brandRow(ctx, X, top, info.date);
  const kicker = [info.name, p.label].filter(Boolean).join(' · ');
  ctx.textAlign = 'right';
  ctx.fillStyle = C.butter;
  fit(ctx, [kicker], 700, BODY, 30, maxW * 0.55, 18);
  spacing(ctx, 1);
  ctx.fillText(kicker, W - X, top + 32);
  spacing(ctx, 0);

  // foto
  const py = top + 110;
  const ph = story ? 980 : 760;
  drawCover(ctx, photo, 0, py, W, ph, focus);

  // CAMPEÃS num bloco azul que segura a borda de baixo da foto
  ctx.textAlign = 'left';
  const headSize = fit(ctx, [p.headline], 800, DISPLAY, story ? 210 : 176, maxW - 60, 80);
  const bw = ctx.measureText(p.headline).width + 64;
  const bh = Math.round(headSize * 0.92);
  const by = py + ph - Math.round(bh * 0.55);
  roundRect(ctx, X - 8, by, bw, bh, 20);
  ctx.fillStyle = C.eletrico;
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.fillText(p.headline, X + 24, by + bh * 0.78);

  // nomes, vice/final e rodapé na faixa de baixo
  let y = by + bh + 28;
  const names = p.places[0].names;
  ctx.fillStyle = C.butter;
  let nameSize = fit(ctx, [names.join(' e ')], 800, DISPLAY, story ? 112 : 96, maxW, 44);
  const lines = nameSize >= 72 || names.length === 1 ? [names.join(' e ')] : names;
  if (lines.length > 1) nameSize = fit(ctx, lines, 800, DISPLAY, story ? 112 : 96, maxW, 44);
  for (const line of lines) {
    y += nameSize * 0.86;
    ctx.fillText(line, X, y);
    y += nameSize * 0.1;
  }

  const second = p.places[1] ? p.places[1].names.join(' e ') : '';
  const sub = p.final
    ? `Final ${p.final}${second ? ` · vice: ${second}` : ''}`
    : p.places.slice(1).map((pl) => `${pl.pos}º ${pl.names.join(' e ')}${pl.pts ? ` (${pl.pts})` : ''}`).join(' · ');
  if (sub) {
    ctx.fillStyle = C.butter;
    fit(ctx, [sub], 600, BODY, 32, maxW, 20);
    y += 52;
    ctx.fillText(sub, X, y);
  }

  ctx.fillStyle = C.butterSoft;
  ctx.font = `600 24px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`${info.site} · código ${info.code}`, X, H - (story ? 250 : 56));
  spacing(ctx, 0);

  return toPng(canvas);
}

/** Cores de cada carta: campeão em manteiga (como o 1º do pódio), vice em cacau, o resto em azul. */
const TIERS = {
  ouro: { fill: C.butter, ink: C.cocoa, accent: C.eletrico, ball: 'claro' as const },
  prata: { fill: C.raised, ink: C.butter, accent: C.butter, ball: 'band' as const },
  azul: { fill: C.eletrico, ink: C.white, accent: C.butter, ball: 'band' as const },
};

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

/** Cartinha do jogador (story 1080x1920), com foto opcional. Cor chapada, sem brilho. */
export async function renderPlayerCard(card: PlayerCard, info: PodiumInfo, photo: HTMLImageElement | null, focus: number): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const H = 1920;
  const { canvas, ctx } = canvasFor(W, H);
  const T = TIERS[card.tier];

  ctx.fillStyle = C.cocoa;
  ctx.fillRect(0, 0, W, H);

  // topo
  ctx.textAlign = 'center';
  ctx.fillStyle = C.butter;
  ctx.font = `700 30px ${BODY}`;
  spacing(ctx, 8);
  ctx.fillText('MINHA CARTINHA', W / 2 + 4, 262);
  spacing(ctx, 0);
  fit(ctx, [info.name], 800, DISPLAY, 84, W - 140, 40);
  ctx.fillText(info.name, W / 2, 350);
  ctx.fillStyle = C.butterSoft;
  ctx.font = `600 28px ${BODY}`;
  spacing(ctx, 2);
  ctx.fillText([card.division, info.date].filter(Boolean).join(' · '), W / 2, 400);
  spacing(ctx, 0);

  // carta
  const cw = 780;
  const ch = 1110;
  const x0 = (W - cw) / 2;
  const y0 = 450;
  ctx.fillStyle = T.fill;
  shield(ctx, x0, y0, cw, ch, 64);
  ctx.fill();

  ctx.save();
  shield(ctx, x0, y0, cw, ch, 64);
  ctx.clip();
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
    ctx.restore();
  } else {
    ctx.fillStyle = T.ink;
    ctx.globalAlpha = 0.14;
    ctx.textAlign = 'center';
    fit(ctx, [initials(card.name)], 800, DISPLAY, 340, pw - 20, 120);
    ctx.fillText(initials(card.name), px + pw / 2, py + ph * 0.7);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // moldura
  ctx.strokeStyle = T.ink;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 4;
  shield(ctx, x0 + 18, y0 + 18, cw - 36, ch - 36, 52);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // nota e posição
  const colX = x0 + 160;
  ctx.textAlign = 'center';
  ctx.fillStyle = T.ink;
  ctx.font = `800 190px ${DISPLAY}`;
  ctx.fillText(String(card.rating), colX, y0 + 240);
  ctx.fillStyle = T.accent;
  fit(ctx, [card.tag], 800, DISPLAY, 60, 230, 30);
  ctx.fillText(card.tag, colX, y0 + 312);
  ctx.fillStyle = T.ink;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(colX - 60, y0 + 346, 120, 3);
  ctx.globalAlpha = 1;
  ball(ctx, colX, y0 + 418, 40, T.ball);
  ctx.fillStyle = T.ink;
  ctx.font = `700 28px ${BODY}`;
  spacing(ctx, 4);
  ctx.fillText(card.scope.toUpperCase(), colX + 2, y0 + 510);
  spacing(ctx, 0);

  // nome
  ctx.fillStyle = T.ink;
  fit(ctx, [card.name], 800, DISPLAY, 120, cw - 110, 50);
  ctx.fillText(card.name, W / 2, y0 + 712);
  ctx.strokeStyle = T.ink;
  ctx.globalAlpha = 0.35;
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
      ctx.font = `800 62px ${DISPLAY}`;
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
  ctx.fillStyle = T.ink;
  ctx.font = `700 24px ${BODY}`;
  spacing(ctx, 3);
  const foot = `${card.pos}º DE ${card.of} · ${card.j} ${card.j === 1 ? 'JOGO' : 'JOGOS'}`;
  ctx.fillText(foot, W / 2 + 2, y0 + 1032);
  spacing(ctx, 0);

  // rodapé
  ctx.fillStyle = C.butterSoft;
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

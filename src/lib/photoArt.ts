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

/** Desfoque que funciona em qualquer navegador: encolhe a foto e estica de volta (o ctx.filter falha em Safari antigo). */
function drawBlurred(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, focus: number, scale = 0.035) {
  const small = document.createElement('canvas');
  small.width = Math.max(8, Math.round(w * scale));
  small.height = Math.max(8, Math.round(h * scale));
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  drawCover(sctx, img, 0, 0, small.width, small.height, focus);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, x, y, w, h);
  ctx.restore();
}

/** Foto com as bordas de cima e de baixo dissolvendo em transparência. */
function fadedPhoto(img: HTMLImageElement, w: number, h: number, focus: number, fadeTop: number, fadeBottom: number): HTMLCanvasElement {
  const { canvas, ctx } = canvasFor(w, h);
  drawCover(ctx, img, 0, 0, w, h, focus);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(fadeTop / h, 'rgba(0,0,0,1)');
  g.addColorStop(1 - fadeBottom / h, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Cacau com transparência: rgba a partir do hex da marca. */
function cocoa(a: number) {
  return `rgba(58,34,24,${a})`;
}

/** Painel de vidro fosco: a foto borrada por trás, um véu claro e um fio manteiga na borda. */
function glass(ctx: Ctx, img: HTMLImageElement, focus: number, W: number, H: number, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  drawBlurred(ctx, img, 0, 0, W, H, focus, 0.02);
  ctx.fillStyle = cocoa(0.55);
  ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, 'rgba(255,255,255,.14)');
  sheen.addColorStop(1, 'rgba(255,255,255,.03)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.strokeStyle = 'rgba(251,227,142,.38)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Pôster com a foto dos campeões, estilo capa: a foto ocupa a tela e se dissolve num fundo feito
 * dela mesma (borrado e tingido de cacau). O nome dos campeões entra por cima da parte de baixo,
 * e vice/3º ficam num painel de vidro fosco. A foto fica só no aparelho.
 */
export async function renderPhotoPoster(p: Podium, info: PodiumInfo, format: ImgFormat, photo: HTMLImageElement, focus: number): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const story = format === 'story';
  const H = story ? 1920 : 1350;
  const X = 64;
  const maxW = W - X * 2;
  const safeTop = story ? 230 : 56;
  const safeBottom = story ? 250 : 56;
  const { canvas, ctx } = canvasFor(W, H);

  // 1. fundo: a própria foto, borrada e tingida
  ctx.fillStyle = C.cocoa;
  ctx.fillRect(0, 0, W, H);
  drawBlurred(ctx, photo, -40, -40, W + 80, H + 80, focus);
  ctx.fillStyle = cocoa(0.7);
  ctx.fillRect(0, 0, W, H);

  // 2. a foto nítida, dissolvendo em cima e embaixo
  const ratio = photo.naturalWidth / photo.naturalHeight;
  const py = story ? safeTop + 60 : 0;
  const ph = Math.round(Math.min(story ? 1180 : 960, Math.max(W / ratio, story ? 900 : 760)));
  const fadeTop = story ? 180 : 220;
  ctx.drawImage(fadedPhoto(photo, W, ph, focus, fadeTop, Math.round(ph * 0.42)), 0, py);

  // 3. véu de cacau por baixo, onde entra o texto
  const veil = ctx.createLinearGradient(0, py + ph * 0.45, 0, H);
  veil.addColorStop(0, cocoa(0));
  veil.addColorStop(0.45, cocoa(0.55));
  veil.addColorStop(1, cocoa(0.96));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);
  // véu leve no topo pra marca ler bem
  const topVeil = ctx.createLinearGradient(0, 0, 0, safeTop + 140);
  topVeil.addColorStop(0, cocoa(0.75));
  topVeil.addColorStop(1, cocoa(0));
  ctx.fillStyle = topVeil;
  ctx.fillRect(0, 0, W, safeTop + 140);

  // 4. topo: marca e nome do torneio
  brandRow(ctx, X, safeTop, info.date);
  const kicker = [info.name, p.label].filter(Boolean).join(' · ');
  ctx.textAlign = 'right';
  ctx.fillStyle = C.butter;
  fit(ctx, [kicker], 700, BODY, 30, maxW * 0.55, 18);
  spacing(ctx, 1);
  ctx.fillText(kicker, W - X, safeTop + 32);
  spacing(ctx, 0);

  // 5. de baixo pra cima: rodapé, painel de vidro, nome, selo
  const footY = H - safeBottom;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.butterSoft;
  ctx.font = `600 24px ${BODY}`;
  spacing(ctx, 1);
  ctx.fillText(`${info.site} · código ${info.code}`, X, footY);
  spacing(ctx, 0);

  const rest = p.places.slice(1, 3);
  const second = p.places[1] ? p.places[1].names.join(' e ') : '';
  const panelH = p.final ? 130 : rest.length ? 170 : 0;
  const panelY = footY - 48 - panelH;
  if (panelH) {
    glass(ctx, photo, focus, W, H, X, panelY, maxW, panelH, 28);
    if (p.final) {
      ctx.fillStyle = C.butterSoft;
      ctx.font = `700 22px ${BODY}`;
      spacing(ctx, 5);
      ctx.fillText('FINAL', X + 36, panelY + 50);
      spacing(ctx, 0);
      ctx.fillStyle = C.white;
      fit(ctx, [`${p.final}${second ? ` · vice: ${second}` : ''}`], 700, BODY, 40, maxW - 72, 22);
      ctx.fillText(`${p.final}${second ? ` · vice: ${second}` : ''}`, X + 36, panelY + 100);
    } else {
      const colW = (maxW - 36) / rest.length;
      rest.forEach((pl, i) => {
        const cx = X + 36 + i * colW;
        if (i > 0) {
          ctx.fillStyle = 'rgba(251,227,142,.25)';
          ctx.fillRect(cx - 18, panelY + 34, 2, panelH - 68);
        }
        ctx.fillStyle = C.butter;
        ctx.font = `800 72px ${DISPLAY}`;
        ctx.fillText(`${pl.pos}º`, cx, panelY + 108);
        const numW = ctx.measureText(`${pl.pos}º`).width + 22;
        ctx.fillStyle = C.white;
        const nm = pl.names.join(' e ');
        fit(ctx, [nm], 700, BODY, 40, colW - numW - 40, 20);
        ctx.fillText(nm, cx + numW, panelY + (pl.pts ? 84 : 100));
        if (pl.pts) {
          ctx.fillStyle = C.butterSoft;
          ctx.font = `600 26px ${BODY}`;
          ctx.fillText(pl.pts, cx + numW, panelY + 122);
        }
      });
    }
  }

  // nome dos campeões, grande, com sombra suave sobre a foto
  const names = p.places[0].names;
  const top = panelH ? panelY - 40 : footY - 70;
  let nameSize = fit(ctx, [names.join(' e ')], 800, DISPLAY, story ? 190 : 160, maxW, 60);
  const lines = nameSize >= 110 || names.length === 1 ? [names.join(' e ')] : names;
  if (lines.length > 1) nameSize = fit(ctx, lines, 800, DISPLAY, story ? 150 : 130, maxW, 50);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.butter;
  let y = top;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], X - 4, y);
    y -= nameSize * 0.88;
  }
  ctx.restore();

  // selo CAMPEÃ em azul, translúcido, acima do nome
  const tag = p.headline.toUpperCase();
  ctx.font = `800 40px ${BODY}`;
  spacing(ctx, 10);
  const tw = ctx.measureText(tag).width;
  const pillH = 70;
  const pillY = y - nameSize * 0.62 - pillH + 10;
  roundRect(ctx, X, pillY, tw + 56, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(43,91,255,.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.white;
  ctx.fillText(tag, X + 28 + 5, pillY + pillH / 2 + 14);
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

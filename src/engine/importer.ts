import type { Gender } from './types';

export interface ImportedPlayer {
  name: string;
  gender: Gender | null;
}

export interface ImportResult {
  players: ImportedPlayer[];
  /** nomes repetidos que foram ignorados */
  duplicates: string[];
  /** linhas que não pareciam nome (título, recado, lista de espera) */
  ignored: string[];
}

const INVISIBLE = /[​-‍⁠﻿­]/g;
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️⃣]/gu;
const FEM_EMOJI = /👩|🚺|♀|💃|👧/u;
const MASC_EMOJI = /👨|🚹|♂|🕺|👦/u;

const MARKER = /^(?:\d{1,3}\s*[.)\-–—ºª°:]+|\d{1,3}\s+(?=\D)|[-–—•*·▪◦➤>✓✔]+)\s*/u;

const FEM = 'mulheres|mulher|feminino|feminina|femininas|femininos|meninas|garotas|damas|elas';
const MASC = 'homens|homem|masculino|masculinos|meninos|garotos|eles';
const HEADER = new RegExp(
  `^(?:lista|time|categoria|naipe|chave)?\\s*(?:d[oa]s?\\s+)?(${FEM}|${MASC})\\s*(?:\\(\\s*\\d+\\s*\\))?\\s*(?:[:\\-–—]\\s*(.*))?$`,
  'i',
);
const SKIP_SECTION = /^(?:lista\s+de\s+)?(?:espera|reservas?|suplentes?|desist[eê]ncias?)\b/i;
const TITLE = /\b(lista|play|torneio|confirmad\w*|presen\w*|racha|treino|jogos?|hor[aá]rio|local|quadras?|arena|valor|pix|domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|hoje|amanh[aã]|galera|pessoal|obs\w*)\b|\d{1,2}\s*(?:h\b|:\d{2})|r\$/i;
const SUFFIX = /^(.+?)[\s\-–—,:(\[]+(homem|mulher|masculino|feminino|feminina|masc|fem|h|m|f)\s*[)\]]?\.?$/i;

function genderWord(w: string): Gender {
  return /^(h|homem|homens|masc|masculino|masculinos|meninos|garotos|eles)$/i.test(w) ? 'H' : 'M';
}

function clean(s: string): string {
  return s
    .replace(EMOJI, ' ')
    .replace(/^["'“”‘’(\[]+|["'“”‘’)\].,;:!?]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra uma linha em nomes: vírgula, ponto e vírgula, barra, tab, numeração na mesma linha e "Ana e Bia". */
function splitNames(text: string): string[] {
  const numbered = text.split(/\s+(?=\d{1,3}\s*[.)\-–]\s*\S)/);
  const parts = numbered.flatMap((p) => p.split(/\s*[,;|/\t]+\s*|\s{2,}|\s[•·]\s/));
  return parts.flatMap((p) => {
    const bits = p.split(/\s+e\s+/i);
    return bits.length > 1 && bits.every((b) => b.trim().split(/\s+/).length <= 3) ? bits : [p];
  });
}

function parsePiece(piece: string): ImportedPlayer | null {
  let text = clean(piece.replace(MARKER, ''));
  let gender: Gender | null = null;
  const sfx = SUFFIX.exec(text);
  if (sfx && clean(sfx[1])) {
    text = clean(sfx[1]);
    gender = genderWord(sfx[2]);
  }
  if (!text || /\d/.test(text) || text.split(' ').length > 4 || text.length > 40 || TITLE.test(text)) return null;
  return { name: text, gender };
}

/**
 * Lê uma lista de nomes em quase qualquer formato:
 * - um por linha, separados por vírgula ou ponto e vírgula, ou numerados na mesma linha ("1. Ana 2. Bia");
 * - cabeçalhos com ou sem emoji ("Mulheres", "HOMENS:", "👩 Mulheres (13)", "Mulheres: Ana, Bia e Carla");
 * - gênero no fim do nome ("Bruno homem", "Ana (F)", "Rafa - M"); M e F contam como mulher, H como homem;
 * - ignora título, recados com horário e a lista de espera.
 * `force` marca todos os nomes com um gênero só (ex.: colou só a lista das mulheres).
 */
export function parsePlayerList(text: string, force?: Gender | null): ImportResult {
  const players: ImportedPlayer[] = [];
  const duplicates: string[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();
  let current: Gender | 'skip' | null = null;

  const add = (p: ImportedPlayer | null, fallback: Gender | null, original: string) => {
    if (!p) { if (original.trim()) ignored.push(clean(original) || original.trim()); return; }
    const key = p.name.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) { duplicates.push(p.name); return; }
    seen.add(key);
    players.push({ name: p.name, gender: force ?? p.gender ?? fallback });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.replace(INVISIBLE, '').trim();
    if (!raw) continue;
    const lineGender: Gender | null = FEM_EMOJI.test(raw) ? 'M' : MASC_EMOJI.test(raw) ? 'H' : null;
    const marked = MARKER.test(clean(raw));
    const body = clean(raw).replace(MARKER, '').trim();

    if (!body) { if (lineGender) current = lineGender; continue; }

    if (!marked) {
      const h = HEADER.exec(body);
      if (h) {
        current = genderWord(h[1]);
        if (h[2]?.trim()) for (const piece of splitNames(h[2])) add(parsePiece(piece), current, piece);
        continue;
      }
      if (SKIP_SECTION.test(body)) { current = 'skip'; ignored.push(body); continue; }
      // "Confirmados: Ana, Bia" → aproveita os nomes depois dos dois-pontos
      const colon = /^([^:]{1,40}):\s*(.+)$/.exec(body);
      if (colon && TITLE.test(colon[1]) && current !== 'skip') {
        ignored.push(colon[1]);
        for (const piece of splitNames(colon[2])) add(parsePiece(piece), current, piece);
        continue;
      }
      if (TITLE.test(body)) { ignored.push(body); continue; }
    }
    if (current === 'skip') { ignored.push(body); continue; }

    const pieces = splitNames(body);
    for (const piece of pieces) {
      const fallback = (pieces.length === 1 ? lineGender : null) ?? current;
      add(parsePiece(piece), fallback, piece);
    }
  }
  return { players, duplicates, ignored };
}

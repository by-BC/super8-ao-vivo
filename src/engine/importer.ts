import type { Gender } from './types';

export interface ImportedPlayer {
  name: string;
  gender: Gender | null;
}

export interface ImportResult {
  players: ImportedPlayer[];
  /** linhas repetidas que foram ignoradas */
  duplicates: string[];
}

const INVISIBLE = /[​-‍⁠﻿­]/g;
const EMOJI = /[\p{Extended_Pictographic}️⃣]/gu;
const MARKER = /^(?:\d{1,3}\s*[.)\-–ºª°:]*|[-•*·▪◦➤>])\s*/u;
const SUFFIX = /^(.+?)[\s\-–,:(]+(homem|mulher|masculino|feminino|feminina|masc|fem|h|m)\s*\)?\.?$/iu;
const HEADER_M = /^(mulheres|mulher|feminino|feminina|femininas|meninas|garotas|damas)$/i;
const HEADER_H = /^(homens|homem|masculino|masculinos|meninos|garotos)$/i;

function genderFromWord(w: string): Gender {
  return /^(mulher|feminin|fem|m$)/i.test(w) ? 'M' : 'H';
}

function headerGender(text: string, raw: string): Gender | null {
  const plain = text.replace(/[:\-–]/g, '').trim();
  if (HEADER_M.test(plain) || (plain === '' && /👩|🚺|♀/u.test(raw))) return 'M';
  if (HEADER_H.test(plain) || (plain === '' && /👨|🚹|♂/u.test(raw))) return 'H';
  return null;
}

function cleanName(s: string): string {
  return s.replace(EMOJI, '').replace(/[.,;:!]+$/u, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/**
 * Lê uma lista colada do WhatsApp. Entende cabeçalhos ("👩 Mulheres", "Homens:"),
 * numeração ("1.", "10)"), marcadores, caracteres invisíveis e gênero no fim da linha ("Bruno homem", "Rafa (M)").
 * Linhas sem número antes do primeiro cabeçalho são tratadas como título e ignoradas.
 */
export function parsePlayerList(text: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(INVISIBLE, '').trim()).filter(Boolean);
  const structured = lines.some((l) => MARKER.test(l) || headerGender(l.replace(EMOJI, '').trim(), l));

  let current: Gender | null = null;
  const players: ImportedPlayer[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const marked = MARKER.test(raw);
    const body = raw.replace(MARKER, '').trim();
    const text = body.replace(EMOJI, '').trim();

    if (!marked) {
      const h = headerGender(text, raw);
      if (h) { current = h; continue; }
    }

    let name = text;
    let gender: Gender | null = null;
    const sfx = SUFFIX.exec(text);
    if (sfx && cleanName(sfx[1])) {
      name = sfx[1];
      gender = genderFromWord(sfx[2]);
    } else if (/👩|🚺|♀/u.test(body)) gender = 'M';
    else if (/👨|🚹|♂/u.test(body)) gender = 'H';

    if (!marked && !sfx && structured && current === null) continue; // título da lista
    gender = gender ?? current;

    name = cleanName(name);
    if (!name) continue;
    const key = name.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) { duplicates.push(name); continue; }
    seen.add(key);
    players.push({ name, gender });
  }
  return { players, duplicates };
}

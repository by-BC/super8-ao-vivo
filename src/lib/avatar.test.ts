import { describe, expect, it } from 'vitest';
import { assignCharacters, MEN, WOMEN } from './avatar';

const ps = Array.from({ length: 12 }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, name: `N${i}`, gender: (i % 2 ? 'H' : 'M') as 'H' | 'M' }));

describe('personagens', () => {
  it('cada um recebe um personagem do próprio gênero', () => {
    const m = assignCharacters(ps);
    for (const p of ps) expect((p.gender === 'M' ? WOMEN : MEN)).toContain(m.get(p.id));
  });
  it('até 5 por gênero, ninguém repete', () => {
    const m = assignCharacters(ps.slice(0, 10));
    const women = ps.slice(0, 10).filter((p) => p.gender === 'M').map((p) => m.get(p.id));
    expect(new Set(women).size).toBe(women.length);
  });
  it('a escolha do organizador vale', () => {
    const m = assignCharacters([{ ...ps[0], avatar: 7 }, ...ps.slice(1)]);
    expect(m.get(ps[0].id)).toBe(7);
  });
  it('é sempre igual pra mesma lista, em qualquer ordem', () => {
    const a = assignCharacters(ps);
    const b = assignCharacters([...ps].reverse());
    for (const p of ps) expect(b.get(p.id)).toBe(a.get(p.id));
  });
});

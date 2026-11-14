import { describe, expect, it } from 'vitest';
import { refereeMessage } from './whatsapp';

describe('mensagem pro árbitro', () => {
  const msg = refereeMessage({ name: 'Liga da quinta', link: 'https://exemplo.dev/#/t/ABCDEF', code: 'ABCDEF', pin: '0427' });

  it('leva nome, link, código e o PIN com zero à esquerda', () => {
    expect(msg).toContain('*LIGA DA QUINTA*');
    expect(msg).toContain('https://exemplo.dev/#/t/ABCDEF');
    expect(msg).toContain('Código: ABCDEF');
    expect(msg).toContain('PIN: *0427*');
  });

  it('o PIN nunca entra no link', () => {
    const linkLine = msg.split('\n').find((l) => l.includes('http'))!;
    expect(linkLine).not.toContain('0427');
  });
});

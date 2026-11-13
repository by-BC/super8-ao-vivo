/*
 * Ícones próprios da marca: traço arredondado de 2px, cantos macios, a bola coral como detalhe.
 * Desenhados numa caixa 24×24; a cor do traço vem de currentColor.
 */
type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

/** Raquete de beach tennis com a bola. */
export function IconJogos({ size = 24, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9.6 3.4a5.6 5.6 0 0 1 7.9 7.9l-3.3 3.3a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8z" />
      <path d="M8.2 13.6 4 17.8a1.5 1.5 0 0 0 2.1 2.1l4.2-4.2" />
      <path d="M11.2 7.2h.01M14 7.4h.01M11.4 10h.01" strokeWidth={2.4} />
      <circle cx="19" cy="18.5" r="2.3" fill="var(--coral)" stroke="none" />
    </svg>
  );
}

/** Barras do ranking, a do meio mais alta, com o sol em cima. */
export function IconRanking({ size = 24, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 20v-6M12 20V9M19 20v-8" strokeWidth={3} />
      <path d="M12 3.2v1.6M8.8 4.4l.9 1.2M15.2 4.4l-.9 1.2" stroke="var(--dourado)" />
    </svg>
  );
}

/** Info: o i dentro de uma bola. */
export function IconInfo({ size = 24, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" strokeWidth={2.8} />
    </svg>
  );
}

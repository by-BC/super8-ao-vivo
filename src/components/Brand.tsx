import { useId } from 'react';
import { EIGHT_24, EIGHT_48, SYMBOL_R as R, SYMBOL_SEAM as SEAM, SYMBOL_STROKE } from '../lib/brandPaths';
import { cx } from './ui';

/*
 * Peças da marca (guia da marca → Símbolo e Costura).
 * O 8 da costura é sempre o mesmo desenho, inclinado -18°: não redesenhe à mão.
 */

/**
 * A bola com a costura em 8. Só duas combinações:
 * - `band`: em cima da faixa cacau, bola manteiga e costura azul (`onBand` é atalho);
 * - `claro`: em cima de manteiga ou creme, bola azul e costura manteiga;
 * - `auto` (padrão): segue o tema — `claro` no Dia, `band` na Noite.
 */
export function Simbolo({ size = 40, onBand, tone = 'auto', className, title }: {
  size?: number; onBand?: boolean; tone?: 'auto' | 'band' | 'claro'; className?: string; title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const t = onBand ? 'band' : tone;
  const ball = t === 'band' ? 'var(--band-ink)' : t === 'claro' ? 'var(--accent)' : 'var(--symbol-ball)';
  const seam = t === 'band' ? 'var(--accent)' : t === 'claro' ? 'var(--butter)' : 'var(--symbol-seam)';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={cx('block flex-none', className)}>
      <defs><clipPath id={`b${id}`}><circle cx="32" cy="32" r={R} /></clipPath></defs>
      <circle cx="32" cy="32" r={R} style={{ fill: ball }} />
      <path d={SEAM} clipPath={`url(#b${id})`} strokeWidth={SYMBOL_STROKE} strokeLinejoin="round" style={{ fill: 'none', stroke: seam }} />
    </svg>
  );
}

/** Divisor com o 8 no meio. Uma vez por tela. */
export function Costura({ className }: { className?: string }) {
  return (
    <div className={cx('costura', className)} role="separator">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="mx-2"><path d={EIGHT_24} /></svg>
    </div>
  );
}

/** Carregando: o 8 se costurando, com o que está acontecendo embaixo. */
export function Carregando({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx('carregando flex flex-col items-center gap-2 py-8 text-accent', className)} role="status">
      <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden><path pathLength={100} d={EIGHT_48} /></svg>
      <span className="text-sm font-medium text-muted">{label}</span>
    </div>
  );
}

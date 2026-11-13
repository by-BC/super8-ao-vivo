import { MONO_BALL as B, MONO_EIGHT, MONO_RAYS, MONO_RAY_STROKE, MONO_SEAM, MONO_STROKE, MONO_TRANSFORM } from '../lib/brandPaths';
import { cx } from './ui';

/*
 * Peças da marca "Clube de sol": o monograma é o 8 desenhado como a trajetória da bola,
 * lançando a bola coral com os raios do sol. Sempre o mesmo desenho (src/lib/brandPaths.ts).
 */

/**
 * Monograma. `onBand` (ou tone="band"): traço creme, para cima da faixa verde.
 * `claro`: traço azul profundo. `auto` (padrão) segue o tema.
 */
export function Simbolo({ size = 40, onBand, tone = 'auto', className, title }: {
  size?: number; onBand?: boolean; tone?: 'auto' | 'band' | 'claro'; className?: string; title?: string;
}) {
  const t = onBand ? 'band' : tone;
  const line = t === 'band' ? 'var(--band-ink)' : t === 'claro' ? 'var(--profundo)' : 'var(--mono-line)';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={cx('block flex-none', className)}>
      <g transform={MONO_TRANSFORM}>
        <path d={MONO_RAYS} fill="none" stroke="var(--dourado)" strokeWidth={MONO_RAY_STROKE} strokeLinecap="round" />
        <path d={MONO_EIGHT} fill="none" style={{ stroke: line }} strokeWidth={MONO_STROKE} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={B.x} cy={B.y} r={B.r} fill="var(--coral)" />
        <path d={MONO_SEAM} fill="none" stroke="var(--creme)" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Divisor com o 8 no meio. Uma vez por tela. */
export function Costura({ className }: { className?: string }) {
  return (
    <div className={cx('costura', className)} role="separator">
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden className="mx-2">
        <g transform={MONO_TRANSFORM}>
          <path d={MONO_EIGHT} style={{ strokeWidth: 7 }} />
          <circle cx={B.x} cy={B.y} r={B.r} fill="var(--coral)" stroke="none" />
        </g>
      </svg>
    </div>
  );
}

/** Carregando: o 8 sendo desenhado, com o que está acontecendo embaixo. */
export function Carregando({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx('carregando flex flex-col items-center gap-2 py-8 text-accent', className)} role="status">
      <svg width="44" height="44" viewBox="0 0 64 64" aria-hidden>
        <g transform={MONO_TRANSFORM}><path pathLength={100} d={MONO_EIGHT} style={{ strokeWidth: 6 }} /></g>
      </svg>
      <span className="text-sm font-medium text-muted">{label}</span>
    </div>
  );
}

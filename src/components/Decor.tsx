import { cx } from './ui';

/*
 * Enfeites de praia: sempre decorativos (aria-hidden, sem clique), clarinhos e longe do placar.
 * Nada aqui se mexe, então o "reduzir movimento" do celular não precisa de tratamento.
 */

/** Folha de coqueiro minimalista: uma nervura curva e folíolos em leque. */
export function Folha({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  const leaflets = Array.from({ length: 9 }, (_, i) => {
    const t = 0.12 + i * 0.1;
    // ponto na nervura (curva de 10,110 até 112,8)
    const x = 10 + 102 * t;
    const y = 110 - 102 * t - 26 * Math.sin(Math.PI * t);
    const len = 30 + 22 * Math.sin(Math.PI * t);
    const up = `M${x.toFixed(1)} ${y.toFixed(1)}q${(-len * 0.35).toFixed(1)} ${(-len * 0.55).toFixed(1)} ${(-len * 0.15).toFixed(1)} ${(-len).toFixed(1)}q${(len * 0.3).toFixed(1)} ${(len * 0.45).toFixed(1)} ${(len * 0.15).toFixed(1)} ${len.toFixed(1)}z`;
    const dn = `M${x.toFixed(1)} ${y.toFixed(1)}q${(len * 0.55).toFixed(1)} ${(len * 0.3).toFixed(1)} ${len.toFixed(1)} ${(len * 0.12).toFixed(1)}q${(-len * 0.45).toFixed(1)} ${(-len * 0.32).toFixed(1)} ${(-len).toFixed(1)} ${(-len * 0.12).toFixed(1)}z`;
    return up + dn;
  }).join('');
  return (
    <svg viewBox="0 0 130 130" aria-hidden className={cx('pointer-events-none select-none', className)}>
      <path d="M10 110C38 92 74 70 112 8" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d={leaflets} fill={color} />
    </svg>
  );
}

/** Onda de areia pra assentar no pé de um cartão (o pai precisa de `relative overflow-hidden`). */
export function OndaAreia({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden className={cx('pointer-events-none absolute inset-x-0 bottom-0 h-7 w-full', className)}>
      <path d="M0 24C60 6 120 6 190 20s140 18 210 0V40H0z" fill="var(--pessego)" opacity=".45" />
      <path d="M0 32c70-14 130-12 200-2s130 10 200-4V40H0z" fill="var(--dourado)" opacity=".35" />
    </svg>
  );
}

/** Coroinha dourada do 1º lugar. */
export function Coroa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden className={cx('pointer-events-none', className)}>
      <path d="M2 14 3.4 4l5.2 4.6L12 1.6l3.4 7L20.6 4 22 14z" fill="var(--dourado)" stroke="var(--profundo)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="1.8" r="1.4" fill="var(--coral)" />
    </svg>
  );
}

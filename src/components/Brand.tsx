import { LOGO, SIMBOLO, SIMBOLO_CLARO } from '../lib/brandAssets';
import { cx } from './ui';

/*
 * Logo oficial do Super 8: o S em duas faixas (laranja e branca) segurando a bola.
 * Os arquivos ficam em public/marca; aqui só escolhemos a versão certa pro fundo.
 */

/**
 * Símbolo. `onBand` (ou tone="band"): versão com a faixa branca, pra faixa verde e fundos escuros.
 * `claro`: faixa em azul profundo, pra fundo creme/branco. `auto` (padrão) segue o tema do celular.
 */
export function Simbolo({ size = 40, onBand, tone = 'auto', className, title }: {
  size?: number; onBand?: boolean; tone?: 'auto' | 'band' | 'claro'; className?: string; title?: string;
}) {
  const t = onBand ? 'band' : tone;
  const img = (src: string) => (
    <img src={src} width={size} height={size} alt={title ?? ''} aria-hidden={title ? undefined : true} draggable={false}
      className={cx('block flex-none object-contain', className)} style={{ width: size, height: size }} />
  );
  if (t === 'band') return img(SIMBOLO);
  if (t === 'claro') return img(SIMBOLO_CLARO);
  return (
    <picture className="contents">
      <source srcSet={SIMBOLO} media="(prefers-color-scheme: dark)" />
      {img(SIMBOLO_CLARO)}
    </picture>
  );
}

/** Logo completa (letras brancas): só em cima da faixa ou de fundo escuro. */
export function Logo({ height = 56, className }: { height?: number; className?: string }) {
  return (
    <img src={LOGO} alt="Super 8 · sistema de beach tênis" draggable={false}
      className={cx('block h-auto max-w-full', className)} style={{ height, width: 'auto' }} />
  );
}

/** Divisor com o símbolo no meio. Uma vez por tela. */
export function Costura({ className }: { className?: string }) {
  return (
    <div className={cx('costura', className)} role="separator">
      <span className="mx-2"><Simbolo size={26} /></span>
    </div>
  );
}

/** Carregando: o símbolo quicando, com o que está acontecendo embaixo. */
export function Carregando({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx('carregando flex flex-col items-center gap-2 py-8 text-accent', className)} role="status">
      <span className="quica"><Simbolo size={48} /></span>
      <span className="text-sm font-medium text-muted">{label}</span>
    </div>
  );
}

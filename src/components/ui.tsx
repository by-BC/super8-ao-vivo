import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnKind = 'primary' | 'line' | 'ghost' | 'danger' | 'quiet';
const btnKind: Record<BtnKind, string> = {
  primary: 'bg-accent text-onaccent font-bold text-[17px] active:translate-y-px',
  line: 'border-[1.5px] border-ink text-ink font-bold',
  ghost: 'border-[1.5px] border-dashed border-line text-ink font-bold',
  danger: 'bg-danger text-ondanger font-bold',
  quiet: 'text-ink font-semibold underline underline-offset-4 decoration-line',
};

export function Button({ kind = 'line', block, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; block?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('min-h-[48px] rounded-lg px-4 py-2.5 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0', btnKind[kind], block && 'w-full', className)}
    />
  );
}

export function Panel({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg bg-surface p-4 shadow-card', className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="m-0 font-display text-[26px] font-extrabold leading-none">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider tabnum', className ?? 'bg-hair')}>{children}</span>;
}

export function GenderDot({ g }: { g: 'H' | 'M' | null | undefined }) {
  if (!g) return null;
  return (
    <i aria-hidden className={cx('inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[10px] font-extrabold not-italic', g === 'H' ? 'bg-ink text-bg' : 'bg-accent text-onaccent')}>
      {g}
    </i>
  );
}

export interface Choice<T extends string> {
  value: T;
  title: string;
  hint?: string;
}

/** Cartões de escolha única (radio). */
export function Choices<T extends string>({ name, value, options, onChange, cols = 2, disabled, compact }: {
  name: string; value: T; options: Choice<T>[]; onChange: (v: T) => void; cols?: 1 | 2 | 3; disabled?: boolean; compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cx('grid', compact ? 'gap-1.5' : 'gap-2', cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 min-[420px]:grid-cols-2')}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex min-h-[52px] items-center gap-3 rounded-lg border-[1.5px] text-left disabled:opacity-50',
              compact ? 'px-3 py-2' : 'p-3',
              on ? 'border-ink bg-surface shadow-[inset_0_0_0_1px_var(--ink)]' : 'border-line bg-bg',
            )}
          >
            <span aria-hidden className={cx('grid h-5 w-5 flex-none place-items-center rounded-full border-2', on ? 'border-ink' : 'border-line')}>
              {on && <i className="block h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-base leading-tight">{o.title}</b>
              {o.hint && <small className="text-[13px] leading-snug text-muted">{o.hint}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T | null; options: { value: T; label: string; className?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-lg border-[1.5px] border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-[42px] min-w-[42px] px-2 font-extrabold', value === o.value ? (o.className ?? 'bg-ink text-bg') : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ id, value, min, max, onChange, label }: { id: string; value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border-[1.5px] border-line bg-bg">
      <button type="button" aria-label={`Diminuir ${label}`} className="h-11 w-11 text-2xl disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        aria-label={label}
        className="w-14 border-0 bg-transparent text-center font-body tabnum text-[28px] font-bold text-ink"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
      <button type="button" aria-label={`Aumentar ${label}`} className="h-11 w-11 text-2xl disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <b>{label}</b>
        {hint && <small className="text-[13px] text-muted">{hint}</small>}
      </div>
      {children}
    </div>
  );
}

export function Note({ kind, children }: { kind: 'warn' | 'ok'; children: ReactNode }) {
  return <div className={cx('rounded-lg px-3.5 py-3 text-[15px] leading-snug', kind === 'warn' ? 'bg-tintwarn' : 'bg-tintok')}>{children}</div>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/50 sm:place-items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="gutter max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4 sm:max-w-[520px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 font-display text-2xl font-extrabold">{title}</h2>
          <button type="button" aria-label="Fechar" className="h-10 w-10 text-2xl text-muted" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- avisos rápidos ---------------- */

interface ToastAction { label: string; run: () => void }
interface ToastOpts { action?: ToastAction; ms?: number; /** substitui o aviso anterior com a mesma chave */ key?: string }
interface ToastItem { id: number; text: string; action?: ToastAction; key?: string }
const ToastCtx = createContext<(text: string, opts?: ToastOpts) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const drop = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((text: string, opts?: ToastOpts) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.filter((x) => !opts?.key || x.key !== opts.key).slice(-2), { id, text, action: opts?.action, key: opts?.key }]);
    window.setTimeout(() => drop(id), opts?.ms ?? 3200);
  }, [drop]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-40 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={cx('flex max-w-[min(520px,100%)] items-center gap-3 rounded-lg bg-ink py-3 pl-4 font-semibold text-bg shadow-card', t.action ? 'pointer-events-auto pr-2' : 'pr-4')}>
            <span className="min-w-0">{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.run(); drop(t.id); }}
                className="min-h-[40px] flex-none rounded-lg bg-accent px-3 font-extrabold text-onaccent">{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Copia texto; se o navegador recusar, devolve false para a tela mostrar o texto selecionável. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopySheet({ text, onClose }: { text: string | null; onClose: () => void }) {
  return (
    <Sheet open={text !== null} onClose={onClose} title="Copie o texto">
      <textarea
        readOnly
        value={text ?? ''}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-[260px] w-full rounded-lg border-[1.5px] border-line bg-bg p-2.5 text-base text-ink"
      />
    </Sheet>
  );
}

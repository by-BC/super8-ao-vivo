import { useEffect, useRef, useState } from 'react';
import { loadPhoto } from '../lib/photoArt';
import { cx } from './ui';

export interface Photo {
  img: HTMLImageElement;
  focus: number;
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/** Abre o menu de compartilhar do celular com as imagens. Devolve false se não deu. */
export async function shareFiles(files: File[], title: string): Promise<boolean> {
  try {
    await navigator.share({ files, title });
    return true;
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError';
  }
}

/** Botão que abre a galeria/câmera. A foto fica só no aparelho. */
export function PhotoButton({ has, label, onPick, onError, className }: {
  has: boolean; label: string; onPick: (p: Photo) => void; onError: () => void; className?: string;
}) {
  return (
    <label className={cx('flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-ink px-3 text-center text-sm font-bold', className)}>
      <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { onPick({ img: await loadPhoto(f), focus: 0.45 }); } catch { onError(); }
      }} />
      <span aria-hidden>📷</span> {has ? 'Trocar foto' : label}
    </label>
  );
}

/** Arrasta pra escolher que parte da foto aparece. Só avisa quando o dedo para um instante. */
export function FocusSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(value);
  const timer = useRef<number>();
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center gap-2 text-[13px] font-bold text-muted">
      Enquadrar
      <input type="range" min={0} max={1} step={0.02} value={v} className="min-w-0 flex-1 accent-[var(--sea)]"
        onChange={(e) => {
          const n = Number(e.target.value);
          setV(n);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onChange(n), 140);
        }} />
    </label>
  );
}

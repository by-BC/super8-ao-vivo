import { useEffect, useState } from 'react';
import type { Podium } from '../engine';
import { podiumFileName, renderPodium, type ImgFormat, type PodiumInfo } from '../lib/podiumImage';
import { Button, Segmented, Sheet, useToast } from './ui';

interface Img {
  url: string;
  file: File;
  label: string;
}

/** Gera a arte do pódio (story ou feed) e compartilha direto no Instagram/WhatsApp pelo menu do celular. */
export function PodiumSheet({ open, onClose, podiums, info }: { open: boolean; onClose: () => void; podiums: Podium[]; info: PodiumInfo }) {
  const toast = useToast();
  const [format, setFormat] = useState<ImgFormat>('story');
  const [imgs, setImgs] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(podiums) + format + info.name;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    Promise.all(podiums.map(async (p) => {
      const blob = await renderPodium(p, info, format);
      const file = new File([blob], podiumFileName(p, info.name, format), { type: 'image/png' });
      return { url: URL.createObjectURL(blob), file, label: p.label || 'Campeões' };
    }))
      .then((list) => {
        if (!alive) { list.forEach((i) => URL.revokeObjectURL(i.url)); return; }
        setImgs((old) => { old.forEach((i) => URL.revokeObjectURL(i.url)); return list; });
      })
      .catch(() => alive && toast('Não consegui gerar a imagem neste aparelho.'))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [open, key]);

  const files = imgs.map((i) => i.file);
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });

  async function shareAll() {
    try {
      await navigator.share({ files, title: info.name });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast('Não deu para abrir o compartilhar. Use o botão Baixar.');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pódio pro Instagram">
      <div className="flex flex-col gap-3">
        <Segmented<ImgFormat> label="Formato" value={format} onChange={setFormat}
          options={[{ value: 'story', label: 'Story (9:16)' }, { value: 'feed', label: 'Post (4:5)' }]} />
        <div className={imgs.length > 1 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 justify-items-center'}>
          {imgs.map((i) => (
            <figure key={i.file.name} className="m-0 flex flex-col gap-1.5">
              <img src={i.url} alt={`Arte do pódio · ${i.label}`} className={busy ? 'w-full rounded-lg opacity-50' : 'w-full rounded-lg shadow-card'}
                style={{ maxHeight: imgs.length > 1 ? undefined : '56vh', objectFit: 'contain' }} />
              <a href={i.url} download={i.file.name} className="min-h-[40px] rounded-lg border-[1.5px] border-hair text-center text-sm font-bold leading-[38px] text-ink no-underline">
                Baixar {imgs.length > 1 ? i.label.toLowerCase() : ''}
              </a>
            </figure>
          ))}
        </div>
        {busy && !imgs.length && <p className="m-0 text-muted">Montando a arte…</p>}
        {canShare && (
          <Button kind="primary" block disabled={busy} onClick={shareAll}>
            Compartilhar {imgs.length > 1 ? `as ${imgs.length} imagens` : 'imagem'}
          </Button>
        )}
        <p className="m-0 text-[13px] text-muted">
          {canShare
            ? 'No compartilhar, escolha Instagram (Story ou Feed) ou WhatsApp. Com 2 imagens no Feed vira carrossel.'
            : 'Baixe a imagem e poste pelo Instagram. No iPhone, se abrir numa aba, segure a imagem e toque em Salvar.'}
        </p>
      </div>
    </Sheet>
  );
}

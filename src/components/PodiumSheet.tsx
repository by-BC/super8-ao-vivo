import { useEffect, useState } from 'react';
import type { Podium } from '../engine';
import { renderPhotoPoster } from '../lib/photoArt';
import { podiumFileName, renderPodium, type ImgFormat, type PodiumInfo } from '../lib/podiumImage';
import { canShareFiles, FocusSlider, PhotoButton, shareFiles, type Photo } from './ArtParts';
import { Button, Segmented, Sheet, useToast } from './ui';
import { Carregando } from './Brand';

interface Img {
  division: string;
  url: string;
  file: File;
  label: string;
}

/** Arte dos campeões: com a foto do pódio vira capa de revista; sem foto, o pódio desenhado. */
export function PodiumSheet({ open, onClose, podiums, info }: { open: boolean; onClose: () => void; podiums: Podium[]; info: PodiumInfo }) {
  const toast = useToast();
  const [format, setFormat] = useState<ImgFormat>('story');
  const [photos, setPhotos] = useState<Record<string, Photo>>({});
  const [imgs, setImgs] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false);
  const photoKey = Object.entries(photos).map(([d, p]) => `${d}:${p.img.src}:${p.focus}`).join('|');
  const key = JSON.stringify(podiums) + format + info.name + photoKey;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    Promise.all(podiums.map(async (p) => {
      const ph = photos[p.division];
      const blob = ph ? await renderPhotoPoster(p, info, format, ph.img, ph.focus) : await renderPodium(p, info, format);
      const file = new File([blob], podiumFileName(p, info.name, format), { type: 'image/png' });
      return { division: p.division, url: URL.createObjectURL(blob), file, label: p.label || 'Campeões' };
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
  const canShare = canShareFiles(files);
  const many = imgs.length > 1;
  const anyPhoto = Object.keys(photos).length > 0;

  return (
    <Sheet open={open} onClose={onClose} title="Arte dos campeões">
      <div className="flex flex-col gap-3">
        <Segmented<ImgFormat> label="Formato" value={format} onChange={setFormat}
          options={[{ value: 'story', label: 'Story (9:16)' }, { value: 'feed', label: 'Post (4:5)' }]} />
        {!anyPhoto && (
          <p className="m-0 rounded-lg bg-highlight px-3 py-2.5 text-sm font-semibold text-ink">
            Põe a foto dos campeões no pódio: vira capa de revista e é o que a galera mais compartilha. A foto fica só no seu celular.
          </p>
        )}
        <div className={many ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 justify-items-center gap-2'}>
          {imgs.map((i) => {
            const ph = photos[i.division];
            return (
              <figure key={i.division} className="m-0 flex w-full flex-col gap-1.5">
                <img src={i.url} alt={`Arte dos campeões · ${i.label}`} className={busy ? 'w-full rounded-lg opacity-50' : 'w-full rounded-lg shadow-card'}
                  style={{ maxHeight: many ? undefined : '52vh', objectFit: 'contain' }} />
                <PhotoButton has={!!ph} label={many ? `Foto ${i.label.toLowerCase()}` : 'Pôr foto dos campeões'}
                  onPick={(p) => setPhotos((o) => ({ ...o, [i.division]: p }))} onError={() => toast('Não consegui abrir essa foto.')} />
                {ph && (
                  <>
                    <FocusSlider value={ph.focus} onChange={(f) => setPhotos((o) => ({ ...o, [i.division]: { ...ph, focus: f } }))} />
                    <button type="button" className="text-[13px] font-bold text-muted underline"
                      onClick={() => setPhotos((o) => { const n = { ...o }; delete n[i.division]; return n; })}>Usar sem foto</button>
                  </>
                )}
                <a href={i.url} download={i.file.name} className="min-h-[42px] rounded-lg bg-surface text-center text-sm font-bold leading-[42px] text-ink no-underline shadow-card">
                  Baixar{many ? ` ${i.label.toLowerCase()}` : ''}
                </a>
              </figure>
            );
          })}
        </div>
        {busy && !imgs.length && <Carregando label="Montando a arte…" />}
        {canShare && (
          <Button kind="primary" block disabled={busy} onClick={async () => { if (!(await shareFiles(files, info.name))) toast('Não deu para abrir o compartilhar. Use o Baixar.'); }}>
            Compartilhar {many ? `as ${imgs.length} imagens` : 'imagem'}
          </Button>
        )}
        <p className="m-0 text-[13px] text-muted">
          {canShare
            ? 'No compartilhar, escolha Instagram (Story ou Feed) ou WhatsApp. Com 2 imagens no Feed vira carrossel.'
            : 'Baixe e poste pelo Instagram. No iPhone, se abrir numa aba, segure a imagem e toque em Salvar.'}
        </p>
      </div>
    </Sheet>
  );
}

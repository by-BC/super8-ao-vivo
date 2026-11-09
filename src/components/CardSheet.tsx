import { useEffect, useState } from 'react';
import type { Player, PlayerCard } from '../engine';
import { cardFileName, renderPlayerCard } from '../lib/photoArt';
import type { PodiumInfo } from '../lib/podiumImage';
import { canShareFiles, FocusSlider, PhotoButton, shareFiles, type Photo } from './ArtParts';
import { Button, Sheet, useToast } from './ui';

/** Cartinha de cada jogador: escolhe o nome, põe a foto (opcional) e posta no Story. */
export function CardSheet({ open, onClose, groups, makeCard, info, initialId }: {
  open: boolean; onClose: () => void; groups: { label: string; players: Player[] }[];
  makeCard: (id: string) => PlayerCard | null; info: PodiumInfo; initialId: string | null;
}) {
  const toast = useToast();
  const [id, setId] = useState<string>('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [img, setImg] = useState<{ url: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialId && initialId !== id) { setId(initialId); setPhoto(null); }
  }, [open, initialId]);

  const card = id ? makeCard(id) : null;
  const key = JSON.stringify(card) + (photo ? `${photo.img.src}:${photo.focus}` : '') + info.name;

  useEffect(() => {
    if (!open || !card) return;
    let alive = true;
    setBusy(true);
    renderPlayerCard(card, info, photo?.img ?? null, photo?.focus ?? 0.45)
      .then((blob) => {
        if (!alive) return;
        const next = { url: URL.createObjectURL(blob), file: new File([blob], cardFileName(card, info.name), { type: 'image/png' }) };
        setImg((old) => { if (old) URL.revokeObjectURL(old.url); return next; });
      })
      .catch(() => alive && toast('Não consegui gerar a cartinha neste aparelho.'))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [open, key]);

  const files = img && card ? [img.file] : [];
  const canShare = canShareFiles(files);

  return (
    <Sheet open={open} onClose={onClose} title="Minha cartinha">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Quem é você?
          <select value={id} onChange={(e) => { setId(e.target.value); setPhoto(null); }}
            className="min-h-[46px] w-full rounded-lg border-[1.5px] border-line bg-bg px-3 text-base font-bold text-ink">
            <option value="" disabled>Escolha seu nome</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {[...g.players].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {id && !card && <p className="m-0 text-muted">Essa pessoa ainda não tem jogo encerrado.</p>}
        {card && img && (
          <img src={img.url} alt={`Cartinha de ${card.name}`} className={busy ? 'mx-auto w-full max-w-[300px] rounded-lg opacity-50' : 'mx-auto w-full max-w-[300px] rounded-lg shadow-card'} />
        )}
        {card && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <PhotoButton has={!!photo} label="Pôr minha foto" onPick={setPhoto} onError={() => toast('Não consegui abrir essa foto.')} />
              {img ? (
                <a href={img.url} download={img.file.name} className="flex min-h-[42px] items-center justify-center rounded-lg bg-surface text-sm font-bold text-ink no-underline shadow-card">Baixar</a>
              ) : <span />}
            </div>
            {photo && <FocusSlider value={photo.focus} onChange={(f) => setPhoto({ ...photo, focus: f })} />}
            {canShare && (
              <Button kind="primary" block disabled={busy} onClick={async () => { if (!(await shareFiles(files, `Cartinha de ${card.name}`))) toast('Não deu para abrir o compartilhar. Use o Baixar.'); }}>
                Compartilhar no Story
              </Button>
            )}
            <p className="m-0 text-[13px] text-muted">A foto fica só no seu celular. A nota sai do aproveitamento e do saldo no torneio, com bônus pra quem foi campeão ou vice.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

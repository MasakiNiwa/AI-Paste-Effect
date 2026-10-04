import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { ASSET_IDS, assetPreviewUrl, findAsset, variantsOf } from '../engine/assets';

const GROUP_LABELS: Record<string, string> = {
  shock: '驚き・衝撃',
  gloom: '落ち込み・不穏',
  comedy: 'コミカル',
  love: '恋・ときめき',
  joy: '喜び',
  motion: '勢い・動き',
  calm: '静けさ・余韻',
  texture: '質感・かすれ',
  frame: '縁飾り',
  light: '光',
  paint: 'にじみ',
  manga: '漫画の背景',
};

/** 漫画素材をサムネイルで選ぶ。pack は今選ばれている絵柄のセット */
export function AssetPicker({ value, pack, onChange }: { value: string; pack: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = findAsset(value, pack);
  const groups = [...new Set(ASSET_IDS.map((id) => id.split('/')[0]))];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 p-2 text-left transition hover:border-accent"
      >
        <span className="checker grid size-12 shrink-0 place-items-center overflow-hidden rounded-md">
          {current && <img src={assetPreviewUrl(current)} alt="" className="size-11 object-contain" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current?.label ?? value}</span>
          <span className="block truncate text-[11px] text-muted">
            {value}
            {current && variantsOf(value).length > 1 ? `（${current.pack}）` : ''}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="素材を選ぶ"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-bold">素材を選ぶ</h2>
              <button type="button" aria-label="閉じる" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full hover:bg-surface-2">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-4 pb-4">
              {groups.map((g) => (
                <div key={g}>
                  <h3 className="mb-1.5 text-xs font-bold text-muted">{GROUP_LABELS[g] ?? g}</h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {ASSET_IDS.filter((id) => id.startsWith(`${g}/`)).map((id) => {
                      const a = findAsset(id, pack)!;
                      return (
                        <button
                          key={id}
                          type="button"
                          title={a.label}
                          onClick={() => {
                            onChange(id);
                            setOpen(false);
                          }}
                          className={`checker relative aspect-square overflow-hidden rounded-lg border-2 p-1 transition ${
                            id === value ? 'border-accent' : 'border-transparent hover:border-accent/50'
                          }`}
                        >
                          <img src={assetPreviewUrl(a)} alt={a.label} className="size-full object-contain" />
                          {variantsOf(id).length > 1 && (
                            <span className="absolute right-1 bottom-1 rounded bg-surface/90 px-1 text-[9px] text-muted">{variantsOf(id).length}種</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

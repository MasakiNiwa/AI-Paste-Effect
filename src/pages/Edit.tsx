import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { create } from 'zustand';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, RotateCcw, Trash2, Undo2, X } from 'lucide-react';
import { Viewer } from '../components/Preview';
import { ParamControl } from '../components/ParamControl';
import { Button } from '../components/ui';
import {
  addEffect,
  emptyPlan,
  moveLayer,
  readParams,
  removeLayer,
  setLayerParam,
  toEditable,
  updateBlock,
  updateLayer,
  type EditPlan,
  type LayerRef,
} from '../engine/edit';
import { EFFECTS, findEffect } from '../engine/effects';
import type { ParamSchema, Point } from '../engine/params';
import { BLEND_MODES, CATEGORIES, type BlendMode, type Category } from '../engine/types';
import { pickVariant, useAppliedReply } from '../hooks/usePipeline';
import { useOutput } from '../store/output';
import { useSession } from '../store/session';

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: '通常',
  multiply: '乗算',
  screen: 'スクリーン',
  overlay: 'オーバーレイ',
  'soft-light': 'ソフトライト',
  'hard-light': 'ハードライト',
  'color-dodge': '覆い焼き',
  'color-burn': '焼き込み',
  lighten: '比較（明）',
  darken: '比較（暗）',
  difference: '差の絶対値',
  exclusion: '除外',
  hue: '色相',
  saturation: '彩度',
  color: 'カラー',
  luminosity: '輝度',
  add: '加算',
};

/** 元に戻す用の履歴（タブを移動しても残るようにストアに置く） */
const useHistory = create<{ past: EditPlan[]; key: string }>(() => ({ past: [], key: '' }));

const sameRef = (a: LayerRef | null, b: LayerRef) => !!a && a.block === b.block && a.layer === b.layer;

function AddEffectSheet({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState<Category>('color');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="エフェクトを追加"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-bold">エフェクトを追加</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-surface-2">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          {(Object.entries(CATEGORIES) as [Category, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCat(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
                cat === k ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 overflow-y-auto px-4 pb-4 sm:grid-cols-2">
          {EFFECTS.filter((e) => e.category === cat).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id)}
              className="rounded-xl border border-line p-3 text-left transition hover:border-accent hover:bg-accent/5"
            >
              <span className="block text-sm font-semibold">{e.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted">{e.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Edit() {
  const reply = useAppliedReply();
  const variant = useSession((s) => s.variant);
  const appliedText = useSession((s) => s.appliedText);
  const edit = useSession((s) => s.edits[variant]);
  const setEdit = useSession((s) => s.setEdit);
  const original = useOutput((s) => s.original);

  const aiPlan = pickVariant(reply, variant);
  const plan: EditPlan = useMemo(() => edit ?? (aiPlan.raw !== undefined ? toEditable(aiPlan.raw) : emptyPlan()), [edit, aiPlan.raw]);

  const [open, setOpen] = useState<LayerRef | null>(null);
  const [pick, setPick] = useState<{ ref: LayerRef; key: string } | null>(null);
  const [adding, setAdding] = useState(false);

  // 別の返答・別の案に切り替わったら履歴と開いている項目をリセット
  const historyKey = `${appliedText.length}:${appliedText.slice(0, 64)}:${variant}`;
  const past = useHistory((s) => (s.key === historyKey ? s.past : []));
  useEffect(() => {
    if (useHistory.getState().key !== historyKey) useHistory.setState({ key: historyKey, past: [] });
    setOpen(null);
    setPick(null);
  }, [historyKey]);

  const snapshot = () => {
    const h = useHistory.getState();
    if (h.past[h.past.length - 1] !== plan) useHistory.setState({ past: [...h.past.slice(-40), plan] });
  };
  const commit = (next: EditPlan) => setEdit(variant, next);
  const change = (next: EditPlan) => {
    snapshot();
    commit(next);
  };
  const undo = () => {
    const h = useHistory.getState();
    const prev = h.past[h.past.length - 1];
    if (!prev) return;
    useHistory.setState({ past: h.past.slice(0, -1) });
    commit(prev);
  };
  const resetToAi = () => {
    if (!window.confirm('手動の調整を取り消して、AI の案に戻しますか？')) return;
    useHistory.setState({ past: [] });
    setEdit(variant, null);
    setOpen(null);
  };

  // 画像のタップで位置を指定
  const openLayer = open ? plan.blocks[open.block]?.layers[open.layer] : undefined;
  const openEffect = openLayer ? findEffect(openLayer.effect) : undefined;
  const openValues = openLayer ? readParams(openLayer) : undefined;
  const markers =
    openEffect && openValues
      ? Object.entries(openEffect.params as ParamSchema)
          .filter(([, s]) => s.type === 'point')
          .map(([k]) => ({ ...(openValues[k] as Point), active: pick?.key === k }))
      : [];
  const onPick = pick
    ? (p: { x: number; y: number }) => {
        const spec = (findEffect(plan.blocks[pick.ref.block].layers[pick.ref.layer].effect)!.params as ParamSchema)[pick.key];
        change(setLayerParam(plan, pick.ref, pick.key, spec, p));
        setPick(null);
      }
    : undefined;

  if (!original) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center text-sm text-muted">
        <p>編集するには、まず画像を読み込んでください。</p>
        <Link to="/" className="mt-3 inline-block font-semibold text-accent underline">
          作成タブへ
        </Link>
      </div>
    );
  }

  const layerCount = plan.blocks.reduce((n, b) => n + b.layers.length, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      {/* プレビュー（スマホでは上に固定） */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-bg/95 px-4 pt-3 pb-2 backdrop-blur sm:-mt-6 lg:static lg:m-0 lg:bg-transparent lg:p-0">
        <div className="h-[34dvh] lg:h-[calc(100dvh-9rem)]">
          <Viewer fill onPick={onPick} markers={markers} />
        </div>
        {pick && (
          <p className="mt-2 text-center text-xs font-semibold text-accent">
            画像をタップして位置を指定
            <button type="button" className="ml-2 text-muted underline" onClick={() => setPick(null)}>
              やめる
            </button>
          </p>
        )}
      </div>

      <div className="space-y-3 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold">
              編集{reply.variants.length > 1 && <span className="ml-1.5 text-sm font-normal text-muted">案 {Math.min(variant, reply.variants.length - 1) + 1}</span>}
            </h1>
            <p className="text-xs text-muted">{edit ? '手動で調整中です。修正依頼にもこの内容が入ります。' : 'AI の案を自由に調整できます。'}</p>
          </div>
          <Button variant="ghost" onClick={undo} disabled={past.length === 0} className="px-2.5 py-1.5" title="元に戻す">
            <Undo2 className="size-4" />
            <span className="hidden sm:inline">元に戻す</span>
          </Button>
          {edit && aiPlan.raw !== undefined && (
            <Button variant="ghost" onClick={resetToAi} className="px-2.5 py-1.5" title="AI の案に戻す">
              <RotateCcw className="size-4" />
              <span className="hidden sm:inline">AI の案に戻す</span>
            </Button>
          )}
        </div>

        {layerCount === 0 && (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
            まだエフェクトがありません。AI の返答を貼り付けるか、下の「エフェクトを追加」から始めましょう。
          </p>
        )}

        {plan.blocks.map((block, bi) => (
          <section key={bi} className={`rounded-2xl border border-line bg-surface p-2 ${block.enabled === false ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
              <button
                type="button"
                aria-label={block.enabled === false ? 'ブロックを表示' : 'ブロックを非表示'}
                onClick={() => change(updateBlock(plan, bi, { enabled: block.enabled === false }))}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                {block.enabled === false ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">{block.purpose || block.id}</p>
            </div>
            <div className="space-y-1.5">
              {block.layers.map((layer, li) => {
                const ref = { block: bi, layer: li };
                const effect = findEffect(layer.effect);
                const values = readParams(layer);
                const isOpen = sameRef(open, ref);
                const enabled = layer.enabled !== false;
                const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
                return (
                  <div key={li} className={`rounded-xl border ${isOpen ? 'border-accent/60' : 'border-line'} ${enabled ? '' : 'opacity-60'}`}>
                    <div className="flex items-center gap-1.5 p-1.5">
                      <button
                        type="button"
                        aria-label={enabled ? '非表示にする' : '表示する'}
                        onClick={() => change(updateLayer(plan, ref, { enabled: !enabled }))}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
                      >
                        {enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(isOpen ? null : ref);
                          setPick(null);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{effect?.label ?? `不明なエフェクト（${layer.effect}）`}</span>
                          <span className="block text-[11px] text-muted">
                            {effect ? CATEGORIES[effect.category] : ''} ・ 強さ {Math.round(opacity * 100)}%
                          </span>
                        </span>
                        <ChevronDown className={`size-4 shrink-0 text-muted transition ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isOpen && effect && values && (
                      <div className="space-y-4 border-t border-line p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold">強さ</p>
                            <input
                              type="range"
                              aria-label="強さ"
                              min={0}
                              max={1}
                              step={0.01}
                              value={opacity}
                              onPointerDown={snapshot}
                              onChange={(e) => commit(updateLayer(plan, ref, { opacity: Number(e.target.value) }))}
                              className="h-6 w-full cursor-pointer accent-[var(--accent)]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold">重ね方</p>
                            <select
                              aria-label="重ね方"
                              value={(layer.blend as string) ?? effect.defaultBlend}
                              onChange={(e) => change(updateLayer(plan, ref, { blend: e.target.value }))}
                              className="w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm"
                            >
                              {BLEND_MODES.map((b) => (
                                <option key={b} value={b}>
                                  {BLEND_LABELS[b]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold">
                            顔などの保護<span className="ml-1 font-normal text-muted">AI が決めた保護範囲への効き方</span>
                          </p>
                          <select
                            aria-label="顔などの保護"
                            value={layer.protect === false || layer.protect === 0 ? 'off' : typeof layer.protect === 'number' && layer.protect < 1 ? 'half' : 'on'}
                            onChange={(e) =>
                              change(updateLayer(plan, ref, { protect: e.target.value === 'off' ? false : e.target.value === 'half' ? 0.5 : true }))
                            }
                            className="w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm"
                          >
                            <option value="on">守る（保護範囲には効かせない）</option>
                            <option value="half">半分だけ守る</option>
                            <option value="off">守らない（保護範囲にも効かせる）</option>
                          </select>
                        </div>
                        {Object.entries(effect.params as ParamSchema).map(([key, spec]) => (
                          <ParamControl
                            key={key}
                            name={key}
                            spec={spec}
                            value={values[key]}
                            siblings={values}
                            onStart={snapshot}
                            onChange={(v) => commit(setLayerParam(plan, ref, key, spec, v))}
                            picking={pick?.key === key && sameRef(pick.ref, ref)}
                            onPickPoint={() => setPick(pick?.key === key && sameRef(pick.ref, ref) ? null : { ref, key })}
                          />
                        ))}
                        <div className="flex items-center gap-1.5 border-t border-line pt-3">
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1.5"
                            onClick={() => {
                              const r = moveLayer(plan, ref, -1);
                              change(r.plan);
                              setOpen(r.ref);
                            }}
                          >
                            <ArrowUp className="size-4" />上へ
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1.5"
                            onClick={() => {
                              const r = moveLayer(plan, ref, 1);
                              change(r.plan);
                              setOpen(r.ref);
                            }}
                          >
                            <ArrowDown className="size-4" />下へ
                          </Button>
                          <Button
                            variant="ghost"
                            className="ml-auto px-2.5 py-1.5 text-err hover:text-err"
                            onClick={() => {
                              change(removeLayer(plan, ref));
                              setOpen(null);
                            }}
                          >
                            <Trash2 className="size-4" />
                            削除
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <Button onClick={() => setAdding(true)} className="w-full border-dashed py-3">
          <Plus className="size-4" />
          エフェクトを追加
        </Button>
        <p className="text-center text-[11px] text-muted">リストの下にあるものほど、上に重なって描かれます。</p>
      </div>

      {adding && (
        <AddEffectSheet
          onClose={() => setAdding(false)}
          onPick={(id) => {
            const r = addEffect(plan, id);
            change(r.plan);
            setOpen(r.ref);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

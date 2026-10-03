import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Download, Hand, Loader2, Share2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAppliedParse } from '../hooks/usePipeline';
import { canvasToBlob, downloadBlob, extensionOf } from '../lib/image';
import { useOutput } from '../store/output';
import { useSession } from '../store/session';
import { useSettings, type CompareMode } from '../store/settings';
import { Button } from './ui';

const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator;

/**
 * 結果の表示と比較。元画像を常に下に敷き、結果を上に重ねて
 * 不透明度やクリップだけを切り替える（画像の差し替えによるチラつきを防ぐ）。
 */
function Viewer({ fill }: { fill: boolean }) {
  const original = useOutput((s) => s.original);
  const result = useOutput((s) => s.result);
  const rendering = useOutput((s) => s.rendering);
  const mode = useSettings((s) => s.compareMode);
  const [holding, setHolding] = useState(false);
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // 枠の大きさから、画像を収める表示サイズを計算する
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setAvail({ w: r.width, h: fill ? r.height : window.innerHeight * 0.7 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const aspect = original ? original.canvas.width / original.canvas.height : 1;
  const dispW = Math.max(1, Math.min(avail.w - 16, (avail.h - 16) * aspect));
  const dispH = dispW / aspect;

  const moveTo = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  const handlers =
    mode === 'hold'
      ? {
          onPointerDown: () => result && setHolding(true),
          onPointerUp: () => setHolding(false),
          onPointerLeave: () => setHolding(false),
          onPointerCancel: () => setHolding(false),
        }
      : {
          onPointerDown: (e: PointerEvent) => {
            if (!result) return;
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            moveTo(e);
          },
          onPointerMove: (e: PointerEvent) => dragging.current && moveTo(e),
          onPointerUp: () => (dragging.current = false),
          onPointerCancel: () => (dragging.current = false),
        };

  return (
    <div
      ref={frame}
      className={`checker relative grid place-items-center overflow-hidden rounded-xl select-none ${
        fill ? 'h-full min-h-0' : 'min-h-[300px] sm:min-h-[440px]'
      }`}
    >
      {original ? (
        <div
          ref={box}
          className={`relative ${mode === 'slider' && result ? 'cursor-ew-resize touch-none' : ''}`}
          style={{ width: dispW, height: dispH }}
          onContextMenu={(e) => e.preventDefault()}
          {...handlers}
        >
          <div className="relative h-full w-full">
            <img src={original.url} alt="元画像" className="block h-full w-full object-contain" draggable={false} />
            {result && (
              <img
                src={result.url}
                alt="エフェクト適用結果"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                style={
                  mode === 'hold'
                    ? { opacity: holding ? 0 : 1 }
                    : { clipPath: `inset(0 0 0 ${pos}%)` }
                }
              />
            )}
            {result && mode === 'slider' && (
              <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
                <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,.4)]" />
                <div className="absolute top-1/2 -left-4 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-700 shadow-md">
                  <SlidersHorizontal className="size-4" />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted">
          <Sparkles className="mx-auto mb-3 size-8 text-accent/60" />
          画像を読み込むと、ここに結果が表示されます
        </div>
      )}

      {rendering && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 text-xs shadow">
          <Loader2 className="size-3.5 animate-spin" />
          描画中
        </div>
      )}
      {result && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium shadow">
          {mode === 'hold' ? (holding ? '元画像' : '結果') : '元画像 ｜ 結果'}
        </div>
      )}
    </div>
  );
}

function CompareToggle() {
  const mode = useSettings((s) => s.compareMode);
  const set = useSettings((s) => s.set);
  const opts: { value: CompareMode; label: string; icon: typeof Hand }[] = [
    { value: 'hold', label: '長押し', icon: Hand },
    { value: 'slider', label: 'スライダー', icon: SlidersHorizontal },
  ];
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="比較方法">
      {opts.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => set({ compareMode: value })}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${
            mode === value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function Preview({ fill = false }: { fill?: boolean }) {
  const result = useOutput((s) => s.result);
  const imageName = useSession((s) => s.imageName);
  const format = useSettings((s) => s.exportFormat);
  const plan = useAppliedParse().plan;

  const exportBlob = async () => {
    const blob = await canvasToBlob(result!.canvas, format);
    const base = (imageName.replace(/\.[^.]+$/, '') || 'image').slice(0, 40);
    return { blob, name: `${base}-effect.${extensionOf(blob)}` };
  };
  const save = async () => {
    if (!result) return;
    const { blob, name } = await exportBlob();
    downloadBlob(blob, name);
  };
  const share = async () => {
    if (!result) return;
    const { blob, name } = await exportBlob();
    const file = new File([blob], name, { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'AI Paste Effect' });
      else downloadBlob(blob, name);
    } catch {
      /* キャンセル */
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${fill ? 'h-full min-h-0' : ''}`}>
      <div className={fill ? 'min-h-0 flex-1' : ''}>
        <Viewer fill={fill} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CompareToggle />
        <div className="ml-auto flex gap-2">
          {canShareFiles && (
            <Button onClick={share} disabled={!result} className="px-3 py-2" title="他のアプリ（AI アプリなど）に共有">
              <Share2 className="size-4" />
              <span className="hidden sm:inline">共有</span>
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={!result} className="px-4 py-2">
            <Download className="size-4" />
            保存
          </Button>
        </div>
      </div>
      {plan?.title && result && (
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-sm font-semibold">{plan.title}</p>
          {plan.intent && <p className="mt-0.5 text-xs text-muted">{plan.intent}</p>}
        </div>
      )}
    </div>
  );
}

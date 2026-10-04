import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronDown, Download, Gauge, Hand, Loader2, MessageCircle, RotateCcw, Share2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAppliedParse, useAppliedReply } from '../hooks/usePipeline';
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
export interface PickProps {
  /** 指定すると、画像のタップで位置（正規化座標）を受け取るモードになる */
  onPick?: (p: { x: number; y: number }) => void;
  /** 画像上に表示する目印（正規化座標） */
  markers?: { x: number; y: number; active?: boolean }[];
}

export function Viewer({ fill, onPick, markers = [] }: { fill: boolean } & PickProps) {
  const original = useOutput((s) => s.original);
  const result = useOutput((s) => s.result);
  const rendering = useOutput((s) => s.rendering);
  const compareMode = useSettings((s) => s.compareMode);
  const mode = onPick ? 'hold' : compareMode;
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
  const handlers = onPick
    ? {
        onPointerDown: (e: PointerEvent) => {
          const r = box.current?.getBoundingClientRect();
          if (r) onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        },
      }
    : mode === 'hold'
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
          className={`relative ${onPick ? 'cursor-crosshair touch-none' : mode === 'slider' && result ? 'cursor-ew-resize touch-none' : ''}`}
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
            {markers.map((m, i) => (
              <span
                key={i}
                className={`pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow ${
                  m.active ? 'border-white bg-accent' : 'border-white/90 bg-white/30'
                }`}
                style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
              />
            ))}
            {onPick && (
              <div className="pointer-events-none absolute inset-0 ring-2 ring-accent ring-inset" />
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

/** 複数案の切り替え。結果画像のすぐ下にサムネイル付きで横に並べる */
function VariantPicker() {
  const reply = useAppliedReply();
  const variant = useSession((s) => s.variant);
  const setVariant = useSession((s) => s.setVariant);
  const thumbs = useOutput((s) => s.thumbs);
  const original = useOutput((s) => s.original);
  if (reply.variants.length < 2) return null;
  const current = Math.min(variant, reply.variants.length - 1);
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="演出の案">
      {reply.variants.map((v, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === current}
          onClick={() => setVariant(i)}
          className={`flex w-40 shrink-0 snap-start items-center gap-2 rounded-xl border p-1.5 text-left transition ${
            i === current ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-surface hover:bg-surface-2'
          }`}
        >
          <span className="checker relative size-11 shrink-0 overflow-hidden rounded-lg">
            {(thumbs[i] ?? original?.url) && (
              <img src={thumbs[i] ?? original!.url} alt="" className={`size-full object-cover ${thumbs[i] ? '' : 'opacity-40'}`} />
            )}
            {!thumbs[i] && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-muted" />}
          </span>
          <span className="min-w-0">
            <span className={`block text-[11px] font-bold ${i === current ? 'text-accent' : 'text-muted'}`}>案 {i + 1}</span>
            <span className="line-clamp-2 block text-xs leading-snug">{v.plan?.title ?? '（無題）'}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * 演出の強さ。AI は実際の仕上がりを見られないので、強弱の最終調整はアプリ側で手早くできるようにする。
 */
function StrengthSlider() {
  const strength = useSession((s) => s.strength);
  const setStrength = useSession((s) => s.setStrength);
  const pct = Math.round(strength * 100);
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 shrink-0 text-muted" />
        <span className="shrink-0 text-xs font-semibold">演出の強さ</span>
        <input
          type="range"
          aria-label="演出の強さ"
          min={0}
          max={2}
          step={0.05}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          className="h-6 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
        />
        <span className="w-11 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{pct}%</span>
        <button
          type="button"
          title="AI の案どおり（100%）に戻す"
          aria-label="演出の強さを 100% に戻す"
          disabled={strength === 1}
          onClick={() => setStrength(1)}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      <div className="flex justify-between pr-[4.5rem] pl-[6.5rem] text-[10px] text-muted">
        <span>原画寄り</span>
        <span>AI の案</span>
        <span>強め</span>
      </div>
    </div>
  );
}

/** AI の語りを軽く整形して表示する（見出し記号や強調記号は外す） */
function AiComment({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[-*]\s+/, '・'));
  const long = text.length > 140 || lines.length > 4;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
        <MessageCircle className="size-3.5" />
        AI のコメント
      </p>
      <div className={`space-y-1 text-[13px] leading-relaxed text-ink/90 ${long && !open ? 'line-clamp-4' : ''}`}>
        {lines.map((l, i) =>
          /^\s*#+\s*/.test(l) ? (
            <p key={i} className="pt-1 font-semibold">
              {l.replace(/^\s*#+\s*/, '')}
            </p>
          ) : l.trim() ? (
            <p key={i}>{l}</p>
          ) : null,
        )}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
          {open ? '閉じる' : 'もっと見る'}
        </button>
      )}
    </div>
  );
}

export function Preview({ fill = false }: { fill?: boolean }) {
  const result = useOutput((s) => s.result);
  const imageName = useSession((s) => s.imageName);
  const format = useSettings((s) => s.exportFormat);
  const applied = useAppliedParse();
  const plan = applied.plan;
  const showComment = useSettings((s) => s.showAiComment) && !!applied.comment;

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
      {result && <VariantPicker />}
      {(result || useSession.getState().strength !== 1) && <StrengthSlider />}
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
      {result && (plan?.title || showComment) && (
        <div className={`space-y-3 ${fill ? 'max-h-[35dvh] shrink-0 overflow-y-auto' : ''}`}>
          {plan?.title && (
            <div className="rounded-xl bg-surface-2 px-3 py-2.5">
              <p className="text-sm font-semibold">{plan.title}</p>
              {plan.intent && <p className="mt-0.5 text-xs text-muted">{plan.intent}</p>}
            </div>
          )}
          {showComment && <AiComment text={applied.comment!} />}
        </div>
      )}
    </div>
  );
}

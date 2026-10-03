import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Share2,
  Sparkles,
  Wand2,
  X,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button, Card, StepHeader } from '../components/ui';
import { useToast } from '../components/Toast';
import { parsePlan } from '../engine/plan';
import { buildInitialPrompt, buildRevisionPrompt } from '../engine/prompt';
import { renderPlan } from '../engine/renderer';
import { EXAMPLE_PLAN_TEXT } from '../engine/example';
import { copyText, readText } from '../lib/clipboard';
import { canvasToBlob, downloadBlob, loadImageFile } from '../lib/image';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function useLoadedImage(file: Blob | null, maxSize: number) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    if (!file) {
      setCanvas(null);
      return;
    }
    loadImageFile(file, maxSize)
      .then((c) => alive && setCanvas(c))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [file, maxSize]);
  return { canvas, error };
}

export default function Home() {
  const settings = useSettings();
  const { jsonText, setJsonText, imageFile, imageName, setImageFile } = useSession();
  const toast = useToast((s) => s.show);
  const { canvas: original, error: imageError } = useLoadedImage(imageFile, settings.maxSize);

  // 自動適用ならテキストの変化に追従、手動なら「適用」ボタンで確定
  const debounced = useDebounced(jsonText, 350);
  const [manualText, setManualText] = useState(jsonText);
  const appliedText = settings.autoApply ? debounced : manualText;
  const parsed = useMemo(() => parsePlan(appliedText), [appliedText]);
  const livePreview = useMemo(() => parsePlan(debounced), [debounced]);

  const [result, setResult] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const renderId = useRef(0);

  useEffect(() => {
    const id = ++renderId.current;
    if (!original || !parsed.plan || parsed.errors.length > 0) {
      setResult(null);
      setRenderErrors([]);
      return;
    }
    setRendering(true);
    renderPlan(original, parsed.plan)
      .then(async ({ canvas, errors }) => {
        if (id !== renderId.current) return;
        const blob = await canvasToBlob(canvas, 'png');
        if (id !== renderId.current) return;
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { canvas, url: URL.createObjectURL(blob) };
        });
        setRenderErrors(errors);
      })
      .catch((e: Error) => id === renderId.current && setRenderErrors([e.message]))
      .finally(() => id === renderId.current && setRendering(false));
  }, [original, parsed]);

  // ---- 操作
  const copyPrompt = async () => {
    const ok = await copyText(buildInitialPrompt());
    toast(ok ? 'プロンプトをコピーしました' : 'コピーできませんでした', ok ? 'ok' : 'err');
  };
  const copyRevision = async () => {
    const ok = await copyText(
      buildRevisionPrompt({
        currentPlan: parsed.raw,
        warnings: [...parsed.warnings, ...renderErrors],
        includeSpec: settings.includeSpecInRevision,
      }),
    );
    toast(ok ? '修正依頼をコピーしました' : 'コピーできませんでした', ok ? 'ok' : 'err');
  };
  const pasteJson = async () => {
    const t = await readText();
    if (t === null) toast('クリップボードを読めませんでした。欄に直接貼り付けてください', 'err');
    else {
      setJsonText(t);
      setManualText(t);
    }
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const takeFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('画像ファイルを選んでください', 'err');
    setImageFile(f, f.name);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    takeFile(e.dataTransfer.files?.[0]);
  };

  // 画面のどこでも画像を Ctrl/Cmd+V で貼り付けられる
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        setImageFile(f, 'クリップボードの画像');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [setImageFile]);

  const exportName = () => {
    const base = (imageName.replace(/\.[^.]+$/, '') || 'image').slice(0, 40);
    return `${base}-effect.${settings.exportFormat === 'jpeg' ? 'jpg' : 'png'}`;
  };
  const save = async () => {
    if (!result) return;
    downloadBlob(await canvasToBlob(result.canvas, settings.exportFormat), exportName());
  };
  const shareFile = useMemo(() => typeof navigator !== 'undefined' && 'canShare' in navigator, []);
  const share = async () => {
    if (!result) return;
    const blob = await canvasToBlob(result.canvas, settings.exportFormat);
    const file = new File([blob], exportName(), { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'AI Paste Effect' });
      else downloadBlob(blob, file.name);
    } catch {
      /* キャンセル */
    }
  };

  const status = jsonText.trim() ? livePreview : null;
  const dirty = !settings.autoApply && jsonText !== manualText;
  const previewSrc = showOriginal || !result ? null : result.url;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="space-y-4">
        <div className="px-1 pb-1">
          <h1 className="text-grad text-2xl font-extrabold tracking-tight sm:text-[28px]">AI Paste Effect</h1>
          <p className="mt-1 text-sm text-muted">普段使いのAIからコピペするエフェクトアプリ</p>
        </div>

        {/* ① プロンプト */}
        <Card>
          <StepHeader
            n={1}
            title="AIへのプロンプトをコピー"
            hint="ChatGPT・Gemini・Claude などに貼り付け、画像を添付して、最後に要望を書き足して送信します。"
          />
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={copyPrompt} className="w-full py-3">
              <ClipboardCopy className="size-4" />
              プロンプトをコピー
            </Button>
            {parsed.raw !== undefined && (
              <Button onClick={copyRevision} className="w-full">
                <MessageSquareText className="size-4" />
                修正依頼をコピー
                <span className="text-xs font-normal text-muted">（今のJSON入り）</span>
              </Button>
            )}
          </div>
        </Card>

        {/* ② JSON */}
        <Card>
          <StepHeader n={2} title="AIの返答を貼り付け" hint="返答をまるごと貼り付けて大丈夫です。JSON 部分を自動で読み取ります。" />
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={'```json\n{ "format": "ai-paste-effect", ... }\n```'}
            spellCheck={false}
            className="h-36 w-full resize-y rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted/60 focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button onClick={pasteJson} className="px-3 py-2">
              <ClipboardPaste className="size-4" />
              貼り付け
            </Button>
            {jsonText ? (
              <Button variant="ghost" onClick={() => setJsonText('')} className="px-3 py-2">
                <X className="size-4" />
                クリア
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setJsonText(EXAMPLE_PLAN_TEXT);
                  setManualText(EXAMPLE_PLAN_TEXT);
                }}
                className="px-3 py-2"
              >
                <Sparkles className="size-4" />
                サンプルを試す
              </Button>
            )}
            {!settings.autoApply && (
              <Button variant="primary" onClick={() => setManualText(jsonText)} disabled={!dirty} className="ml-auto px-3 py-2">
                <Wand2 className="size-4" />
                適用
              </Button>
            )}
          </div>
          {status && <PlanStatus result={status} renderErrors={renderErrors} />}
        </Card>

        {/* ③ 画像 */}
        <Card>
          <StepHeader n={3} title="画像を読み込む" hint="クリック・ドラッグ＆ドロップ・貼り付け（Ctrl/⌘+V）で読み込めます。画像は端末の外に送信されません。" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left transition ${
              dragging ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50 hover:bg-surface-2'
            }`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
              <ImagePlus className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{imageFile ? imageName || '読み込んだ画像' : '画像を選ぶ'}</span>
              <span className="block text-xs text-muted">
                {original ? `${original.width} × ${original.height}px で処理` : 'PNG / JPEG / WebP など'}
              </span>
            </span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => takeFile(e.target.files?.[0])} />
          {imageError && <p className="mt-2 text-xs text-err">{imageError}</p>}
        </Card>
      </div>

      {/* プレビュー */}
      <div className="lg:sticky lg:top-20">
        <Card className="p-3 sm:p-3">
          <div
            className="checker relative grid min-h-[260px] place-items-center overflow-hidden rounded-xl select-none sm:min-h-[420px]"
            onPointerDown={() => result && setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onContextMenu={(e) => result && e.preventDefault()}
          >
            {original ? (
              previewSrc ? (
                <img src={previewSrc} alt="エフェクト適用結果" className="max-h-[75dvh] w-auto max-w-full object-contain" draggable={false} />
              ) : (
                <OriginalPreview canvas={original} />
              )
            ) : (
              <div className="p-8 text-center text-sm text-muted">
                <Sparkles className="mx-auto mb-3 size-8 text-accent/60" />
                ここに結果が表示されます
              </div>
            )}
            {rendering && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 text-xs shadow">
                <Loader2 className="size-3.5 animate-spin" />
                描画中
              </div>
            )}
            {result && (
              <div className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium shadow">
                {showOriginal ? '元画像' : '結果'}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              disabled={!result}
              className="px-3 py-2"
              title="押している間、元画像を表示"
            >
              <Eye className="size-4" />
              押して比較
            </Button>
            <div className="ml-auto flex gap-2">
              {shareFile && (
                <Button onClick={share} disabled={!result} className="px-3 py-2" title="他のアプリ（AIアプリなど）に共有">
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
          {parsed.plan?.title && result && (
            <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <p className="text-sm font-semibold">{parsed.plan.title}</p>
              {parsed.plan.intent && <p className="mt-0.5 text-xs text-muted">{parsed.plan.intent}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function OriginalPreview({ canvas }: { canvas: HTMLCanvasElement }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    canvas.toBlob((b) => {
      if (!b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [canvas]);
  return url ? <img src={url} alt="元画像" className="max-h-[75dvh] w-auto max-w-full object-contain" draggable={false} /> : null;
}

function PlanStatus({ result, renderErrors }: { result: ReturnType<typeof parsePlan>; renderErrors: string[] }) {
  const warnings = [...result.warnings, ...renderErrors];
  if (result.errors.length > 0) {
    return (
      <div className="mt-3 rounded-xl border border-err/30 bg-err/5 p-3 text-xs text-err">
        <p className="flex items-center gap-1.5 font-semibold">
          <XCircle className="size-4" />
          読み込めませんでした
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-ok">
        <CheckCircle2 className="size-4" />
        {result.plan?.layers.length} レイヤーを読み込みました
      </p>
      {warnings.length > 0 && (
        <details className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-warn">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" />
            {warnings.length} 件の注意（タップで表示）
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink/80">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">「修正依頼をコピー」に自動で含まれます。</p>
        </details>
      )}
    </div>
  );
}

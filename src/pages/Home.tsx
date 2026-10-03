import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { Button, Card, StepHeader } from '../components/ui';
import { Preview } from '../components/Preview';
import { useToast } from '../components/Toast';
import type { ParseResult } from '../engine/plan';
import { buildInitialPrompt, buildRevisionPrompt } from '../engine/prompt';
import { EXAMPLE_PLAN_TEXT } from '../engine/example';
import { useAppliedParse, useLiveParse } from '../hooks/usePipeline';
import { copyText, readText } from '../lib/clipboard';
import { useOutput } from '../store/output';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';

function PromptStep() {
  const toast = useToast((s) => s.show);
  const applied = useAppliedParse();
  const renderErrors = useOutput((s) => s.renderErrors);
  const includeSpec = useSettings((s) => s.includeSpecInRevision);

  const copyPrompt = async () => {
    const ok = await copyText(buildInitialPrompt());
    toast(ok ? 'プロンプトをコピーしました' : 'コピーできませんでした', ok ? 'ok' : 'err');
  };
  const copyRevision = async () => {
    const ok = await copyText(
      buildRevisionPrompt({ currentPlan: applied.raw, warnings: [...applied.warnings, ...renderErrors], includeSpec }),
    );
    toast(ok ? '修正依頼をコピーしました' : 'コピーできませんでした', ok ? 'ok' : 'err');
  };

  return (
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
        {applied.raw !== undefined && (
          <Button onClick={copyRevision} className="w-full">
            <MessageSquareText className="size-4" />
            修正依頼をコピー
            <span className="text-xs font-normal text-muted">（今のJSON入り）</span>
          </Button>
        )}
      </div>
    </Card>
  );
}

function JsonStep() {
  const toast = useToast((s) => s.show);
  const { jsonText, appliedText, setJsonText, apply } = useSession();
  const autoApply = useSettings((s) => s.autoApply);
  const live = useLiveParse();
  const renderErrors = useOutput((s) => s.renderErrors);

  const paste = async () => {
    const t = await readText();
    if (t === null) toast('クリップボードを読めませんでした。欄に直接貼り付けてください', 'err');
    else setJsonText(t);
  };

  return (
    <Card>
      <StepHeader n={2} title="AIの返答を貼り付け" hint="返答をまるごと貼り付けて大丈夫です。JSON 部分を自動で読み取ります。" />
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={'```json\n{ "format": "ai-paste-effect", ... }\n```'}
        spellCheck={false}
        className="h-32 w-full resize-y rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted/60 focus:border-accent"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={paste} className="px-3 py-2">
          <ClipboardPaste className="size-4" />
          貼り付け
        </Button>
        {jsonText ? (
          <Button variant="ghost" onClick={() => setJsonText('')} className="px-3 py-2">
            <X className="size-4" />
            消す
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setJsonText(EXAMPLE_PLAN_TEXT)} className="px-3 py-2">
            <Sparkles className="size-4" />
            サンプルを試す
          </Button>
        )}
        {!autoApply && (
          <Button variant="primary" onClick={apply} disabled={jsonText === appliedText} className="ml-auto px-3 py-2">
            <Wand2 className="size-4" />
            適用
          </Button>
        )}
      </div>
      {jsonText.trim() && <PlanStatus result={live} renderErrors={jsonText === appliedText ? renderErrors : []} />}
    </Card>
  );
}

function ImageStep() {
  const toast = useToast((s) => s.show);
  const { imageFile, imageName, setImageFile } = useSession();
  const original = useOutput((s) => s.original);
  const imageError = useOutput((s) => s.imageError);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('画像ファイルを選んでください', 'err');
    setImageFile(f, f.name);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files?.[0]);
  };

  return (
    <Card>
      <StepHeader n={3} title="画像を読み込む" hint="タップ・ドラッグ＆ドロップ・貼り付け（Ctrl/⌘+V）で読み込めます。画像は端末の外に送信されません。" />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-3 text-left transition ${
          dragging ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50 hover:bg-surface-2'
        }`}
      >
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-accent">
          {original ? <img src={original.url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{imageFile ? imageName || '読み込んだ画像' : '画像を選ぶ'}</span>
          <span className="block text-xs text-muted">
            {original ? `${original.canvas.width} × ${original.canvas.height}px で処理（タップで変更）` : 'PNG / JPEG / WebP など'}
          </span>
        </span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {imageError && <p className="mt-2 text-xs text-err">{imageError}</p>}
    </Card>
  );
}

/** スマホで結果画面へ誘導するカード */
function GoResult() {
  const result = useOutput((s) => s.result);
  const rendering = useOutput((s) => s.rendering);
  if (!result && !rendering) return null;
  return (
    <Link
      to="/result"
      className="bg-grad flex items-center gap-3 rounded-2xl p-3 text-white shadow-md lg:hidden"
    >
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/20">
        {result ? <img src={result.url} alt="" className="size-full object-cover" /> : <Loader2 className="size-5 animate-spin" />}
      </span>
      <span className="flex-1 text-sm font-semibold">{rendering ? '描画中…' : '結果を見る'}</span>
      <ArrowRight className="size-5" />
    </Link>
  );
}

export default function Home() {
  const setImageFile = useSession((s) => s.setImageFile);

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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="space-y-4">
        <PromptStep />
        <JsonStep />
        <ImageStep />
        <GoResult />
      </div>
      <div className="hidden lg:sticky lg:top-0 lg:block">
        <Card className="p-3 sm:p-3">
          <Preview />
        </Card>
      </div>
    </div>
  );
}

function PlanStatus({ result, renderErrors }: { result: ParseResult; renderErrors: string[] }) {
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

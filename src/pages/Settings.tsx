import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Card, Switch as Toggle } from '../components/ui';
import { useToast } from '../components/Toast';
import { ALL_ASSETS, PACKS, assetPreviewUrl } from '../engine/assets';
import { gpuInfo, type GpuMode } from '../engine/gpu';
import { useOutput } from '../store/output';
import { useSession } from '../store/session';
import { useSettings, type ExportFormat, type Theme } from '../store/settings';

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            value === o.value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProcessingRow() {
  const s = useSettings();
  const info = useOutput((o) => o.renderInfo);
  const gpu = gpuInfo();
  const status = !gpu.available
    ? 'この端末・ブラウザでは GPU（WebGL2）が使えないため、CPU で処理します。'
    : `この端末の GPU: ${gpu.name || '利用できます'}`;
  return (
    <Row
      title="処理モード"
      desc="GPU にすると、水彩・油彩・滲み・写真の質感などの重いエフェクトを GPU で計算して速く描けます。見た目がおかしい時は CPU に切り替えてください。"
    >
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Segmented<GpuMode>
          value={s.processing}
          onChange={(processing) => s.set({ processing })}
          options={[
            { value: 'gpu', label: 'GPU（高速）' },
            { value: 'cpu', label: 'CPU' },
          ]}
        />
        <p className="max-w-64 text-xs text-muted sm:text-right" data-testid="gpu-status">
          {status}
          {info && (
            <>
              <br />
              前回の描画: {(info.ms / 1000).toFixed(2)} 秒（{info.usedGpu ? 'GPU を使用' : 'CPU のみ'}）
            </>
          )}
        </p>
      </div>
    </Row>
  );
}

export default function Settings() {
  const s = useSettings();
  const toast = useToast((t) => t.show);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="px-1 text-xl font-bold">設定</h1>

      <Card>
        <h2 className="mb-3 text-xs font-bold tracking-wider text-muted">表示</h2>
        <div className="divide-y divide-line">
          <Row title="テーマ">
            <Segmented<Theme>
              value={s.theme}
              onChange={(theme) => s.set({ theme })}
              options={[
                { value: 'system', label: '自動' },
                { value: 'light', label: 'ライト' },
                { value: 'dark', label: 'ダーク' },
              ]}
            />
          </Row>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xs font-bold tracking-wider text-muted">結果画面</h2>
        <div className="divide-y divide-line">
          <Row title="AI のコメントを表示" desc="オフにすると結果画面がすっきりして、イラストを大きく表示できます（AI への依頼内容は変わりません）。">
            <Toggle label="AI のコメントを表示" checked={s.showAiComment} onChange={(showAiComment) => s.set({ showAiComment })} />
          </Row>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-xs font-bold tracking-wider text-muted">漫画素材のセット</h2>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          同じ意味の素材（驚き線・汗など）に複数の絵柄がある時、どのセットの絵を使うかを選べます。そのセットに無い素材は標準の絵になります。
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="漫画素材のセット">
          {PACKS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={s.assetPack === p.id}
              onClick={() => s.set({ assetPack: p.id })}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                s.assetPack === p.id ? 'border-accent bg-accent/5' : 'border-line hover:bg-surface-2'
              }`}
            >
              <span className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${s.assetPack === p.id ? 'border-accent' : 'border-line'}`}>
                {s.assetPack === p.id && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className="flex shrink-0 gap-1">
                {ALL_ASSETS.filter((a) => a.pack === p.id)
                  .slice(0, 3)
                  .map((a) => (
                    <img key={a.id} src={assetPreviewUrl(a)} alt="" className="checker size-8 rounded object-contain" />
                  ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted">
                  {p.count} 素材・{p.author}・{p.license}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xs font-bold tracking-wider text-muted">画像処理</h2>
        <div className="divide-y divide-line">
          <Row title="処理解像度（長辺）" desc="大きいほど高精細ですが、処理が重くなります。スマホでは 2048 以下がおすすめです。">
            <Segmented<number>
              value={s.maxSize}
              onChange={(maxSize) => s.set({ maxSize })}
              options={[
                { value: 1024, label: '1024' },
                { value: 2048, label: '2048' },
                { value: 4096, label: '4096' },
              ]}
            />
          </Row>
          <ProcessingRow />
          <Row title="保存形式" desc="WebP はファイルが小さく済みます（非対応のブラウザでは PNG で保存されます）。">
            <Segmented<ExportFormat>
              value={s.exportFormat}
              onChange={(exportFormat) => s.set({ exportFormat })}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPEG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </Row>
          <Row title="貼り付けたら自動で適用" desc="オフにすると「適用」ボタンを押した時だけ描画します。">
            <Toggle
              label="自動で適用"
              checked={s.autoApply}
              onChange={(autoApply) => {
                s.set({ autoApply });
                if (autoApply) useSession.getState().apply();
              }}
            />
          </Row>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xs font-bold tracking-wider text-muted">AI とのやりとり</h2>
        <div className="divide-y divide-line">
          <Row title="AI に作ってもらう案の数" desc="複数にすると、方向性の違う案を一度に作ってもらい、結果画面で切り替えて見比べられます。">
            <Segmented<number>
              value={s.variantCount}
              onChange={(variantCount) => s.set({ variantCount })}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} 案` }))}
            />
          </Row>
          <Row title="AI に自由に語ってもらう" desc="オンだと、AI が感想や演出のねらいを話してから JSON を返します。オフだと JSON だけを返します。">
            <Toggle label="AI に自由に語ってもらう" checked={s.aiTalk} onChange={(aiTalk) => s.set({ aiTalk })} />
          </Row>
          <Row
            title="修正依頼にも仕様を含める"
            desc="新しいチャットで修正を頼む時はオンに。同じチャットで続けるならオフの方が短く済みます。"
          >
            <Toggle
              label="修正依頼にも仕様を含める"
              checked={s.includeSpecInRevision}
              onChange={(includeSpecInRevision) => s.set({ includeSpecInRevision })}
            />
          </Row>
          <Row title="貼り付けた JSON を保存" desc="次に開いた時も前回の JSON を残します（この端末のブラウザ内のみ）。">
            <Toggle label="JSON を保存" checked={s.rememberJson} onChange={(rememberJson) => s.set({ rememberJson })} />
          </Row>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={() => {
            s.reset();
            toast('設定を初期値に戻しました');
          }}
        >
          <RotateCcw className="size-4" />
          初期値に戻す
        </Button>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useToast } from '../components/Toast';
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
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

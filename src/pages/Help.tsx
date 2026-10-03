import type { ReactNode } from 'react';
import { ExternalLink, FolderGit2 } from 'lucide-react';
import { Card } from '../components/ui';
import { EFFECTS } from '../engine/effects';
import { CATEGORIES, type Category } from '../engine/types';
import { APP_NAME, APP_TAGLINE, APP_VERSION, BUILD_DATE, REPO_URL } from '../lib/version';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink/90">{children}</div>
    </Card>
  );
}

const STEPS = [
  ['プロンプトをコピー', 'ホームの ① を押すと、AI への依頼文（エフェクトの仕様入り）がコピーされます。'],
  ['AI に送る', 'ChatGPT・Gemini・Claude など普段使いの AI に貼り付け、画像を添付し、最後の「私の要望」欄にどんな雰囲気にしたいかを書いて送信します。'],
  ['返答を貼り付け', 'AI の返答をまるごと ② に貼り付けます。JSON 部分だけが自動で読み取られます。'],
  ['画像を読み込む', '③ に同じ画像を読み込むと、すぐに結果が表示されます。'],
  ['気に入らなければ AI と相談', '「修正依頼をコピー」で今の JSON 入りの依頼文をコピーし、結果画像も添えて「もっと〇〇に」と頼みます。返ってきた JSON を貼り直せば反映されます。'],
] as const;

const CREDITS = [
  ['PixiJS', 'https://pixijs.com/', 'MIT License'],
  ['pixi-filters', 'https://github.com/pixijs/filters', 'MIT License'],
  ['Rough.js', 'https://roughjs.com/', 'MIT License'],
  ['Google Fonts（描き文字の書体）', 'https://fonts.google.com/', 'SIL Open Font License'],
] as const;

export default function Help() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="px-1 text-xl font-bold">ヘルプ</h1>

      <Section title="使い方">
        <ol className="space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="bg-grad mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="うまく頼むコツ">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            「エモく」「90年代アニメの背景っぽく」「衝撃のシーンみたいに」など、<b>雰囲気や場面</b>で伝えるのがおすすめです。
          </li>
          <li>修正の時は「キラキラを半分に」「顔は暗くしないで」など、<b>何をどうしたいか</b>を具体的に。</li>
          <li>結果画像を AI に添付すると、仕上がりを見ながら直してもらえます（スマホは「結果」タブの「共有」ボタンが便利）。</li>
          <li>「ドーン!」などの描き文字や、汗・怒りマークなどの漫符も頼めます。</li>
          <li>新しいチャットで修正を頼む時は、設定の「修正依頼にも仕様を含める」をオンにしてください。</li>
          <li>JSON が読めない時は、エラー内容ごと AI に伝えると直してもらえます。</li>
        </ul>
      </Section>

      <Section title="できること・できないこと">
        <p>
          このアプリは <b>画像そのものを描き変えません</b>。色調・光・粒子・集中線・トーン・質感・ぼかしなどの「演出」を重ねるだけです。
          顔やポーズを変えたり、物を描き足したりはできません。
        </p>
        <p>画像の処理はすべてお使いの端末のブラウザ内で行われ、画像がどこかに送信されることはありません（描き文字を使う時だけ、その文字の書体を Google Fonts から読み込みます）。</p>
      </Section>

      <Section title={`エフェクト一覧（${EFFECTS.length} 種類）`}>
        <p className="text-muted">AI はこの中から画像に合わせて組み合わせ、座標や強さを決めます。</p>
        {(Object.entries(CATEGORIES) as [Category, string][]).map(([cat, label]) => (
          <div key={cat}>
            <h3 className="mb-1.5 text-xs font-bold tracking-wider text-muted">{label}</h3>
            <div className="flex flex-wrap gap-1.5">
              {EFFECTS.filter((e) => e.category === cat).map((e) => (
                <span key={e.id} title={e.description} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="バージョン情報">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted">アプリ</dt>
          <dd>
            {APP_NAME} — {APP_TAGLINE}
          </dd>
          <dt className="text-muted">バージョン</dt>
          <dd className="font-mono">v{APP_VERSION}</dd>
          <dt className="text-muted">ビルド日</dt>
          <dd className="font-mono">{BUILD_DATE}</dd>
          <dt className="text-muted">ライセンス</dt>
          <dd>MIT License</dd>
        </dl>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-surface-2"
        >
          <FolderGit2 className="size-5" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">GitHub リポジトリ</span>
            <span className="block truncate text-xs text-muted">{REPO_URL.replace('https://', '')}</span>
          </span>
          <ExternalLink className="size-4 text-muted" />
        </a>
        <div className="text-xs text-muted">
          <p className="mb-1">次の公開ライブラリ・フォントを使わせていただいています。</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {CREDITS.map(([name, url, license]) => (
              <li key={name}>
                <a className="underline" href={url} target="_blank" rel="noreferrer">
                  {name}
                </a>
                （{license}）
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}

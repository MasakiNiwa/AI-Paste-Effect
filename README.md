# AI Paste Effect

**普段使いのAIからコピペするエフェクトアプリ**

アニメ・漫画イラスト特化の「AI 対話型 演出アプリ」です。
ユーザーは雰囲気を伝えるだけ。AI が画像を見て演出プラン（JSON）を設計し、アプリがそれを画像に描画します。

🔗 https://masakiniwa.github.io/AI-Paste-Effect/

## 使い方

1. **プロンプトをコピー** — エフェクト仕様入りの依頼文がコピーされます
2. **AI に送る** — ChatGPT / Gemini / Claude などに貼り付け、画像を添付し、要望を書いて送信
3. **返答を貼り付け** — AI の返答をまるごと貼るだけ（JSON 部分を自動抽出）
4. **画像を読み込む** — すぐに結果が表示されます
5. **気に入らなければ AI と相談** — 「修正依頼をコピー」（今の JSON 入り）に結果画像を添えて、「もっと〇〇に」と伝える

画像の処理はすべてブラウザ内で行われ、外部に送信されません。

## 特徴

- エフェクトの選択や数値調整の UI はありません。演出の設計はすべて AI に任せます
- 色調・光・粒子・漫画表現・リアクション/描き文字・質感・写真の質感・ぼかし/歪み・たまにエフェクトの 54 種類のエフェクト
- 「編集」タブで、AI の案を手で調整（表示・強さ・色・位置・追加/削除/並べ替え）。調整内容は修正依頼にも反映
- AI に方向性の違う案を複数作ってもらい、結果画面のサムネイルで切り替えて見比べられる
- AI は演出のねらいを自由に語ったうえで JSON を返し、その語りはアプリ内に「AI のコメント」として表示
- PWA 対応（ホーム画面に追加してアプリとして使える／オフライン起動）
- 多層構造の JSON（plan → blocks → layers）と、座標ベースの領域マスク・顔の保護領域
- AI の返答の揺れ（コードフェンス、前後の文章、末尾カンマ、範囲外の値、未知のキー）を寛容に解釈し、警告は修正依頼に自動で添付

## 開発

```bash
npm install
npm run dev       # 開発サーバー
npm test          # ユニットテスト（Vitest）
npm run build     # 型チェック + 本番ビルド（dist/）
```

技術スタック: Vite / React / TypeScript / Tailwind CSS / Zustand / PixiJS + pixi-filters / Rough.js / Google Fonts / JSON5 / vite-plugin-pwa

`src/vendor/tamani-effect/` には [TaMaNi-Effect](https://github.com/MasakiNiwa/TaMaNi-Effect)（MIT License）のエフェクトを取り込んでいます。

仕様と設計は [docs/SPEC.md](docs/SPEC.md) を参照してください。

## ライセンス

[MIT License](LICENSE)

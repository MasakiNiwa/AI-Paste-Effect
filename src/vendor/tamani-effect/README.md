# たまにエフェクト（TaMaNi-Effect）由来のエフェクト

[MasakiNiwa/TaMaNi-Effect](https://github.com/MasakiNiwa/TaMaNi-Effect)（MIT License）の
エフェクト定義を取り込んだものです（取り込み元コミット: `8de6ebb`）。

- `core/` … エフェクトが使う型とキャンバスのヘルパー（元の `src/core/` から必要なものだけ）
- `effects/defs/` … エフェクト定義（元の `src/effects/defs/` のまま）

ここのファイルは**元のリポジトリと同じ内容のまま**にしておき、AI Paste Effect 側への接続は
`src/engine/effects/tamani.ts` のアダプターで行います。
元のリポジトリでエフェクトが増えたら `effects/defs/` に同じファイルを置くだけで自動的に取り込まれます。

/**
 * AI に渡すプロンプトの生成。エフェクト仕様はすべて登録簿から自動生成する。
 */
import { EFFECTS } from './effects';
import { assetCatalog } from './assets';
import { EXAMPLE_PLAN } from './example';
import { describeParam, type ParamSchema } from './params';
import { PLAN_FORMAT, PLAN_VERSION } from './plan';
import { REGION_SHORTHANDS } from './region';
import { BLEND_MODES, CATEGORIES, type Category } from './types';

const REQUEST_PLACEHOLDER = '（ここに、どんな雰囲気にしたいかを書いてください。例: 夏の終わりっぽく、静かで切ない感じ）';
const REVISION_PLACEHOLDER = '（ここに、どう直してほしいかを書いてください。例: キラキラを減らして、もっと夕方っぽく）';

export function effectCatalog(): string {
  const lines: string[] = [];
  for (const [cat, label] of Object.entries(CATEGORIES) as [Category, string][]) {
    lines.push(`### ${label}`);
    for (const e of EFFECTS.filter((x) => x.category === cat)) {
      lines.push(`- **${e.id}**（${e.label}／既定 blend: ${e.defaultBlend}）${e.description}`);
      for (const [name, spec] of Object.entries(e.params as ParamSchema)) lines.push(`  - ${describeParam(name, spec)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function specText(): string {
  return `## 座標と単位
- 座標は正規化座標: 画像の左上が {"x":0,"y":0}、右下が {"x":1,"y":1}。画面外（負や 1 超）も指定可。
- 「短辺比」= 画像の短辺の長さを 1 とした大きさ。
- 角度は度。0 = 右向き、90 = 下向き。

## JSON の構造
- format: "${PLAN_FORMAT}"（固定）／ version: ${PLAN_VERSION}（固定）
- title: 演出の短い名前 ／ intent: 演出の狙い（1文）
- intensity: 演出全体の強さ（省略で 1）。"subtle"（原画を主役に、演出はほのか）/ "medium" / "strong" か 0〜2 の数値。全レイヤーの opacity にまとめて掛かる。ユーザーはアプリ側でもこの強さをスライダーで調整できる
- analysis: 画像を観察したメモ（自由形式。被写体・顔の位置・光源・空いている背景など）
- protect: 守りたい領域（region の配列）。全レイヤーでここは効きが弱まる。strength で守る強さを段階的に変えられる（例: 顔 1.0 / 首・デコルテ 0.6 / 髪 0.3 / 背景は入れない）
- blocks: 演出ブロックの配列（意味のまとまり。上から順に重なる）
  - id: 英数字の短い名前 ／ purpose: このブロックの狙い
  - region: 配下レイヤーの既定の適用範囲（省略で全体）
  - opacity: 0〜1（配下レイヤー全体に掛かる）／ enabled: false で無効化
  - layers: レイヤーの配列（上から順に重なる）
    - effect: エフェクト ID（下の一覧から）
    - params: エフェクトごとのパラメータ（省略したものは既定値）
    - opacity: 0〜1（既定 1）
    - blend: 合成モード（省略でエフェクトの既定値）
    - region: 適用範囲（省略でブロックの region、それも無ければ全体）
    - protect: false にすると protect 領域にも効く。0〜1 の数値でこのレイヤーへの保護の効き具合（例: トーンは 1、色調の統一は 0.4、フィルムグレインは false）。既定 true（= 1）
    - seed: 整数。粒子などの配置を変えたい時に変える

## 領域 region
次のどれか。配列にすると和集合。すべての形に "strength"（0〜1, 既定 1）と "invert"（true で外側が対象）を付けられる。
- 文字列の省略形: ${Object.entries(REGION_SHORTHANDS)
    .map(([k, v]) => `"${k}"（${v}）`)
    .join(' / ')}
- {"shape":"ellipse","cx":0.5,"cy":0.4,"rx":0.2,"ry":0.25,"angle":0,"feather":0.4} … rx は画像幅比、ry は画像高さ比。feather は縁のぼかし（0〜1, 1 で中心から放射状に薄れる）
- {"shape":"rect","x":0,"y":0,"w":1,"h":0.4,"angle":0,"feather":0.3} … 左上 x,y と幅 w・高さ h
- {"shape":"linear","from":{"x":0.5,"y":0},"to":{"x":0.5,"y":0.6}} … from で最大、to に向かって 0 になるグラデーション
- {"shape":"polygon","points":[{"x":0.1,"y":0.2},…],"feather":0.2} … 多角形（3点以上）

## 合成モード blend
${BLEND_MODES.map((b) => `"${b}"`).join(' / ')}
- 目安: 光を足す → screen / add、影や色を沈める → multiply、色味を馴染ませる → soft-light / overlay / color

## 使えるエフェクト
${effectCatalog()}
## 漫画素材カタログ（illustrationOverlay の asset）
手描きの漫画素材。素材は中心が position に来るように置かれ、size が素材の幅になる。
${assetCatalog()}
`;
}

function jsonBlock(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

/** 返答の形式の指示。talk=true なら JSON の前に自由に語ってもらう */
/** 何案作ってもらうかの指示 */
function variantsText(n: number, revision: boolean): string {
  if (n <= 1) return revision ? '修正版の JSON は 1 つ' : 'JSON は 1 つ';
  return revision
    ? `修正版は ${n} 案。1 案目は要望どおりの修正、残りはそこから少し違う方向に振った案にして、それぞれ別の \`\`\`json コードブロックで（各案の title で違いがわかるように）`
    : `方向性の違う案を ${n} 案。それぞれ別の \`\`\`json コードブロックで（各案の title で違いがわかるように。protect や座標は各案に書く）`;
}

/** 返答の形式の指示。talk=true なら JSON の前に自由に語ってもらう */
function replyFormat(talk: boolean, revision: boolean, n: number): string {
  const what = variantsText(n, revision);
  if (!talk) return `返答は JSON だけにしてください。${what}。説明文は不要です。`;
  const json = n > 1 ? `そのあとに JSON を書いてください。${what}。` : `そのあとに ${what}だけを \`\`\`json コードブロックで書いてください。`;
  return revision
    ? `返答では、まずどこをどう変えたか、そのねらいを自由に語ってください${n > 1 ? '（各案の違いも）' : ''}（さらに良くするアイデアや、別の方向性の提案があれば添えてもかまいません）。${json}`
    : `返答では、まず画像を見た感想や、どんな演出にしたか・そのねらいやこだわりを、演出担当として自由に語ってください${n > 1 ? '（各案の狙いの違いも）' : ''}（さらに良くするアイデアや、別の方向性の提案があれば添えてもかまいません）。${json}`;
}

export interface PromptOptions {
  /** JSON の前に AI に自由に語ってもらうか */
  talk: boolean;
  /** 作ってもらう案の数 */
  variants?: number;
}

export function buildInitialPrompt({ talk, variants = 1 }: PromptOptions = { talk: true }): string {
  return `# AI Paste Effect 演出プランの作成依頼

あなたはアニメ・漫画イラストの「撮影・演出担当」です。
添付した画像を見て、下にある【私の要望】に合う演出を設計し、指定の JSON で返してください。
この JSON は「AI Paste Effect」というアプリが読み込み、画像にエフェクトを重ねて描画します。

## ルール
- 画像そのものは描き変えられません（顔・ポーズの変更や物の追加は不可）。色・光・粒子・線・質感・ぼかしなどの演出だけで雰囲気を作ってください。
- まず画像をよく観察して analysis に書き、被写体・顔・光源・余白の位置に合わせて座標を決めてください。
- 顔は必ず protect に入れ、色や粒子で表情の印象を壊さないでください。トーン・縦線・網点・粒子など質感の強い演出を使う時は、顔（strength 1）に加えて首・デコルテ（0.5〜0.7）、髪（0.2〜0.4）も段階的に protect し、背景だけに強く効かせると完成度が上がります。
- 目安は 3〜6 ブロック、合計 4〜12 レイヤー。やりすぎず、絵の良さを引き立てる方向で。強い効果は opacity で加減してください。
- 描き文字（soundText）・漫符（emotionMark）・漫画素材（illustrationOverlay）・フラッシュ（burst）などの漫画的リアクションは、要望や場面に合う時に使ってください。キャラの顔や体に重ならない位置（頭の横・上、背景の余白）に置きます。
- 集中線（focusLines）やフラッシュ（burst）の中心の空き（innerRx / innerRy）は、キャラの顔と上半身がすっぽり入る大きさにしてください。
- 「びっくり」「気まずい」「大袈裟に」などの定番の感情演出は、演出プリセット（reactionScene）を 1 つ置くだけでも作れます。プリセットが何をどこに描くかは reactionScene の説明にあるので、個別の素材を足す時はそれと重ならない位置にしてください。

## 演出の心得
- 画面の場所に意味を持たせて置き場所を決めてください。例: 広い空や無地の余白 = 感情・描き文字・漫符の場所 / 人物の顔と体 = 守る場所 / 人物のすぐ横・頭上 = リアクション記号 / 水平線・水面・地面 = 環境音や動きの線 / 大きな背景（雲・壁など）= 質感（トーン・網点）を乗せる場所。
- 漫画記号や描き文字を複数置く時は、高さと大きさを段違いにずらし、横一列に並べないでください（UI のアイコンのように見えてしまう）。
- 静かな絵・余白の多い絵ほど、演出は少なく小さく。描き文字 1 つ・線数本で物語が変わることがあります。強くするほど良くなるとは限りません。
- 迷ったら intensity を "subtle" か "medium" にしてください（ユーザーがアプリで強められます）。
- 画像が添付されていない場合は、要望から一般的な構図を想定してください。
- ${replyFormat(talk, false, variants)}

${specText()}
## 記入例
${jsonBlock(EXAMPLE_PLAN)}

## 私の要望
${REQUEST_PLACEHOLDER}
`;
}

export interface RevisionOptions extends PromptOptions {
  currentPlan: unknown;
  /** 複数案から選んだ場合: [選んだ案の番号(1始まり), 全体の案数] */
  picked?: [number, number];
  /** アプリ上で手動調整したものか */
  edited?: boolean;
  /** アプリ側で調整した演出の強さ（1 = そのまま） */
  strength?: number;
  warnings?: string[];
  includeSpec: boolean;
}

export function buildRevisionPrompt({ currentPlan, warnings = [], includeSpec, talk, variants = 1, picked, edited, strength = 1 }: RevisionOptions): string {
  const warn =
    warnings.length > 0
      ? `\n## アプリが出した警告（直せるものは直してください）\n${warnings.slice(0, 20).map((w) => `- ${w}`).join('\n')}\n`
      : '';
  return `# AI Paste Effect 演出プランの修正依頼

あなたが作った演出プラン JSON（下記）をアプリで画像に適用しました。${picked && picked[1] > 1 ? `\n全 ${picked[1]} 案のうち、案 ${picked[0]} を選びました（下記がその案です）。` : ''}${edited ? '\nさらに、アプリ上で私が手動で調整しています（下記は調整後の JSON です。調整の意図をくみ取ってください）。' : ''}${Math.abs(strength - 1) > 0.01 ? `\nアプリの「演出の強さ」を ${Math.round(strength * 100)}% にして見ています（100% が下記 JSON のまま）。この強さの見え方が好みなので、修正版ではこの強さが 100% になるように各 opacity を調整してください。` : ''}
結果画像を添付している場合は、それが現在の仕上がりです。
下の【修正の要望】に合わせて、修正版の JSON を全体を省略せずに返してください（各案とも完全な JSON で）。
画像そのものは描き変えられないので、演出だけで調整してください。
${replyFormat(talk, true, variants)}
${warn}
## 現在の JSON
${jsonBlock(currentPlan)}
${includeSpec ? `\n# 仕様（再掲）\n${specText()}` : ''}
## 修正の要望
${REVISION_PLACEHOLDER}
`;
}

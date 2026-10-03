/**
 * エフェクトの共通型定義。
 *
 * エフェクトは「パラメータのスキーマ」と「描画関数」だけを持つ純粋なモジュールとして定義する。
 * UI（スライダー等）はスキーマから自動生成されるため、新しいエフェクトを追加するときに
 * UI 側のコードを触る必要はない。
 */

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

interface ParamBase {
  /** パラメータのキー（params オブジェクトのキー） */
  key: string;
  /** 表示名 */
  label: string;
  /** 補足説明（ツールチップ等に表示） */
  hint?: string;
  /** 他のパラメータの値に応じて表示/非表示を切り替える */
  visibleWhen?: (params: ParamValues) => boolean;
}

export interface RangeParam extends ParamBase {
  type: 'range';
  min: number;
  max: number;
  step?: number;
  default: number;
  /** 表示用の単位（例: "%", "°"） */
  unit?: string;
}

export interface SelectParam extends ParamBase {
  type: 'select';
  options: { value: string; label: string }[];
  default: string;
}

export interface ColorParam extends ParamBase {
  type: 'color';
  /** #rrggbb 形式 */
  default: string;
}

export interface BooleanParam extends ParamBase {
  type: 'boolean';
  default: boolean;
}

/** 乱数シード。UI では「シャッフル」ボタンとして表示される */
export interface SeedParam extends ParamBase {
  type: 'seed';
  default: number;
}

export type ParamSchema = RangeParam | SelectParam | ColorParam | BooleanParam | SeedParam;

export type EffectCategory = 'pattern' | 'distort' | 'overlay' | 'color';

export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  pattern: 'パターン',
  distort: 'ゆがみ・ずれ',
  overlay: 'オーバーレイ',
  color: 'カラー',
};

/** エフェクト描画時に渡される環境情報 */
export interface EffectEnv {
  width: number;
  height: number;
  /**
   * 相対単位 1 あたりのピクセル数（画像の短辺 / 1000）。
   * サイズ系パラメータはこの単位で扱うことで、プレビュー（縮小）と書き出し（原寸）の見た目が一致する。
   */
  unit: number;
  /** シード付き乱数（0 以上 1 未満） */
  rng: () => number;
}

export interface EffectDefinition {
  /** 一意な ID（保存データのキーにもなるので変更しないこと） */
  id: string;
  name: string;
  description: string;
  category: EffectCategory;
  /** カテゴリ内の並び順（小さいほど先） */
  order?: number;
  params: ParamSchema[];
  /**
   * input を元にエフェクトを適用した画像を返す。
   * input を直接書き換えてはいけない（新しいキャンバスを返す）。
   */
  render: (input: HTMLCanvasElement, params: ParamValues, env: EffectEnv) => HTMLCanvasElement;
}

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  'source-over': '通常',
  multiply: '乗算',
  screen: 'スクリーン',
  overlay: 'オーバーレイ',
  darken: '比較（暗）',
  lighten: '比較（明）',
  'color-dodge': '覆い焼きカラー',
  'color-burn': '焼き込みカラー',
  'hard-light': 'ハードライト',
  'soft-light': 'ソフトライト',
  difference: '差の絶対値',
  exclusion: '除外',
  hue: '色相',
  saturation: '彩度',
  color: 'カラー',
  luminosity: '輝度',
};

/** エフェクトスタックの 1 層 */
export interface Layer {
  uid: string;
  effectId: string;
  params: ParamValues;
  enabled: boolean;
  /** 0〜1。エフェクト結果を下の画像に重ねる強さ */
  opacity: number;
  blendMode: BlendMode;
}

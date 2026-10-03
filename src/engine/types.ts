import type { Filter } from 'pixi.js';
import type { ParamSchema, ParamValues } from './params';
import type { Mask } from './region';
import type { Rng } from './random';

export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'color-dodge',
  'color-burn',
  'lighten',
  'darken',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
  'add',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const CATEGORIES = {
  color: '色調',
  light: '光',
  particle: '粒子・装飾',
  manga: '漫画表現',
  reaction: 'リアクション・描き文字',
  texture: '質感',
  distortion: 'ぼかし・歪み',
} as const;
export type Category = keyof typeof CATEGORIES;

export interface EffectContext {
  width: number;
  height: number;
  /** min(width, height)。相対サイズ指定の基準 */
  short: number;
  /** ここまでのレイヤーを重ねた現在の画像 */
  source: HTMLCanvasElement;
  /** 読み込んだ元画像（処理解像度に縮小済み） */
  original: HTMLCanvasElement;
  rng: Rng;
  /** このレイヤーの適用範囲（null なら全面） */
  mask: Mask | null;
  /** 画像と同サイズの透明キャンバスを作る */
  createCanvas(width?: number, height?: number): HTMLCanvasElement;
  /**
   * applyFilters は画像の周囲にこの幅（px）の余白を足してからフィルタを掛ける。
   * フィルタに画素座標を渡す時はこの値を足すこと。
   */
  filterPad: number;
  /** PixiJS のフィルタを source（または指定キャンバス）に適用した結果を返す */
  applyFilters(filters: Filter[], input?: HTMLCanvasElement): Promise<HTMLCanvasElement>;
  /** pixi-filters を遅延読み込みする */
  filters(): Promise<typeof import('pixi-filters')>;
}

export interface EffectDefinition<S extends ParamSchema = ParamSchema> {
  id: string;
  /** 日本語の表示名 */
  label: string;
  category: Category;
  /** AI 向けの説明。どういう時に使うかも書く */
  description: string;
  /** filter: 現在の画像を加工する / overlay: 新しく描いたものを重ねる */
  kind: 'filter' | 'overlay';
  defaultBlend: BlendMode;
  params: S;
  /** 画像と同じサイズのキャンバス（透明部分は効果なし）を返す */
  render(ctx: EffectContext, params: ParamValues<S>): Promise<HTMLCanvasElement> | HTMLCanvasElement;
}

/** 型推論のためのヘルパー */
export function defineEffect<S extends ParamSchema>(def: EffectDefinition<S>): EffectDefinition<S> {
  return def;
}

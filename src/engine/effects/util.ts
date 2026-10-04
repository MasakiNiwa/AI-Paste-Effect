import type { Gpu } from '../gpu';
import type { EffectContext } from '../types';

export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext('2d', { willReadFrequently: false });
  if (!g) throw new Error('Canvas 2D が使えません');
  return g;
}

/**
 * 縮小キャンバスに描いてから拡大することで、安価にぼかした描画を得る。
 * softness 0 でそのまま、1 で 1/16 まで縮小。
 */
export function drawSoft(
  target: HTMLCanvasElement,
  softness: number,
  create: (w: number, h: number) => HTMLCanvasElement,
  draw: (g: CanvasRenderingContext2D, scale: number) => void,
): void {
  const scale = 1 / (1 + Math.max(0, softness) * 15);
  if (scale > 0.95) {
    draw(ctx2d(target), 1);
    return;
  }
  const small = create(Math.max(1, Math.round(target.width * scale)), Math.max(1, Math.round(target.height * scale)));
  draw(ctx2d(small), scale);
  const g = ctx2d(target);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, target.width, target.height);
}

/** キャンバス全体の不透明度を掛けたコピーを返す */
export function withAlpha(ctx: EffectContext, canvas: HTMLCanvasElement, alpha: number): HTMLCanvasElement {
  if (alpha >= 1) return canvas;
  const out = ctx.createCanvas(canvas.width, canvas.height);
  const g = ctx2d(out);
  g.globalAlpha = Math.max(0, alpha);
  g.drawImage(canvas, 0, 0);
  return out;
}

/**
 * GPU モードなら GPU 版の処理を試し、その結果を返す。CPU モード・GPU 非対応・失敗した時は null
 * （呼び出し側はそのまま CPU 版の処理に進む）。同じ見た目になるよう、両方とも同じ計算で書くこと。
 *
 *   const done = await tryGpu(ctx, (gpu) => gpu.run({ ... }));
 *   if (done) return done;
 *   // ↓ CPU 版
 */
export async function tryGpu<T>(ctx: EffectContext, onGpu: (gpu: Gpu) => T | Promise<T>): Promise<T | null> {
  if (!ctx.gpu) return null;
  try {
    return await onGpu(ctx.gpu);
  } catch (e) {
    console.warn('GPU での処理に失敗したため CPU で処理します', e);
    return null;
  }
}

/** RGBA（0〜255）を GPU に渡す 0〜1 の配列にする */
export const rgb = (c: { r: number; g: number; b: number }): number[] => [c.r / 255, c.g / 255, c.b / 255];

/** 色の配列を GPU のグラデーション用 uniform（uColors[6] / uCount）にする。GLSL は GLSL_STOPS を使う */
export function stopsUniforms(colors: { r: number; g: number; b: number }[]): Record<string, number | number[]> {
  const list = colors.slice(0, 6);
  const flat = list.flatMap(rgb);
  while (flat.length < 18) flat.push(0);
  return { uColors: flat, uCount: list.length };
}

/** sampleStops（color.ts）の GPU 版 */
export const GLSL_STOPS = `
uniform vec3 uColors[6];
uniform int uCount;
vec3 stops(float t) {
  if (uCount <= 1) return uColors[0];
  float x = clamp(t, 0.0, 1.0) * float(uCount - 1);
  int i = min(uCount - 2, int(floor(x)));
  return mix(uColors[i], uColors[i + 1], x - float(i));
}
`;

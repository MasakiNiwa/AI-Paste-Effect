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

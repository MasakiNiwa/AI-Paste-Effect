/**
 * キャンバス生成まわりのヘルパー。
 * 将来 Web Worker / OffscreenCanvas に移行する場合はこのモジュールを差し替える。
 */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');
  return ctx;
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  get2d(c).drawImage(src, 0, 0);
  return c;
}

export function getPixels(canvas: HTMLCanvasElement): ImageData {
  return get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

export function canvasFromPixels(data: ImageData): HTMLCanvasElement {
  const c = createCanvas(data.width, data.height);
  get2d(c).putImageData(data, 0, 0);
  return c;
}

/** 画像ソースを指定サイズに収まるよう縮小してキャンバス化する */
export function drawSourceFitted(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxSize: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxSize / Math.max(srcWidth, srcHeight));
  const c = createCanvas(srcWidth * scale, srcHeight * scale);
  const ctx = get2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** 知覚輝度（0〜255） */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

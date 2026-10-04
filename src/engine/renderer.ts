/**
 * 描画パイプライン。
 * レイヤーの描画は各エフェクト（Canvas 2D / PixiJS フィルタ）に任せ、
 * マスクと合成は Canvas 2D の globalCompositeOperation で行う（全ブラウザで安定）。
 */
import type { Filter, Renderer } from 'pixi.js';
import { scaleOpacity, type CompiledPlan } from './plan';
import { buildMask, type Mask } from './region';
import { mulberry32 } from './random';
import type { BlendMode, EffectContext } from './types';
import { ctx2d } from './effects/util';
import { activeGpu, type Gpu } from './gpu';

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

// ---------------------------------------------------------------------------
// PixiJS（WebGL）— 必要になった時だけ読み込む

let rendererPromise: Promise<Renderer> | null = null;

function getRenderer(): Promise<Renderer> {
  rendererPromise ??= import('pixi.js').then(({ autoDetectRenderer }) =>
    autoDetectRenderer({ preference: 'webgl', width: 1, height: 1, backgroundAlpha: 0, antialias: false }),
  );
  return rendererPromise;
}

/**
 * 端の画素を引き伸ばして周囲に余白を足す。
 * フィルタ（特にぼかし系）が画像の端で透明を拾って縁が欠けるのを防ぐ。
 */
function padEdges(src: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const c = createCanvas(w + pad * 2, h + pad * 2);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, pad, pad);
  g.drawImage(src, 0, 0, w, 1, pad, 0, w, pad); // 上
  g.drawImage(src, 0, h - 1, w, 1, pad, h + pad, w, pad); // 下
  g.drawImage(c, pad, 0, 1, h + pad * 2, 0, 0, pad, h + pad * 2); // 左（上下の余白込み）
  g.drawImage(c, w + pad - 1, 0, 1, h + pad * 2, w + pad, 0, pad, h + pad * 2); // 右
  return c;
}

// 複数の描画が並行しても WebGL の操作が混ざらないよう直列化する
let queue: Promise<unknown> = Promise.resolve();

function applyFilters(input: HTMLCanvasElement, filters: Filter[], pad: number): Promise<HTMLCanvasElement> {
  const job = queue.then(() => runFilters(input, filters, pad));
  queue = job.catch(() => {});
  return job;
}

async function runFilters(input: HTMLCanvasElement, filters: Filter[], pad: number): Promise<HTMLCanvasElement> {
  const [{ Sprite, Texture, RenderTexture, CanvasSource }, renderer] = await Promise.all([import('pixi.js'), getRenderer()]);
  const padded = pad > 0 ? padEdges(input, pad) : input;
  const texture = new Texture({ source: new CanvasSource({ resource: padded }) });
  const sprite = new Sprite(texture);
  for (const f of filters) f.resolution = 1;
  sprite.filters = filters;
  const target = RenderTexture.create({ width: padded.width, height: padded.height });
  try {
    renderer.render({ container: sprite, target, clear: true });
    const out = renderer.extract.canvas(target) as HTMLCanvasElement;
    // 余白を切り落としつつ、WebGL に紐づかない通常のキャンバスに写す
    const copy = createCanvas(input.width, input.height);
    ctx2d(copy).drawImage(out, pad, pad, input.width, input.height, 0, 0, input.width, input.height);
    return copy;
  } finally {
    sprite.destroy();
    texture.destroy(true);
    target.destroy(true);
    for (const f of filters) f.destroy();
  }
}

// ---------------------------------------------------------------------------

const COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
  'hard-light': 'hard-light',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  lighten: 'lighten',
  darken: 'darken',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
  add: 'lighter',
};

function maskToCanvas(mask: Mask): HTMLCanvasElement {
  const c = createCanvas(mask.width, mask.height);
  const g = ctx2d(c);
  const img = g.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(mask.data[i] * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 画像を処理解像度に収めたキャンバスにする */
export function fitImage(image: CanvasImageSource & { width: number; height: number }, maxSize: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const c = createCanvas(image.width * scale, image.height * scale);
  const g = ctx2d(c);
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, c.width, c.height);
  return c;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** 個別レイヤーの描画失敗（全体は続行する） */
  errors: string[];
  /** 描画にかかった時間（ミリ秒） */
  ms: number;
  /** GPU で計算したレイヤーがあったか */
  usedGpu: boolean;
}

/**
 * strength はアプリ側で調整する演出の強さ（1 = そのまま）。プランの intensity と掛け合わせる。
 */
export async function renderPlan(original: HTMLCanvasElement, plan: CompiledPlan, strength = 1): Promise<RenderResult> {
  const t0 = performance.now();
  const s = plan.intensity * strength;
  const base = activeGpu();
  let usedGpu = false;
  const gpu: Gpu | null = base && {
    run: (pass) => {
      const r = base.run(pass);
      usedGpu = true;
      return r;
    },
  };
  const { width, height } = original;
  const acc = createCanvas(width, height);
  const g = ctx2d(acc);
  g.drawImage(original, 0, 0);
  const errors: string[] = [];

  for (const layer of plan.layers) {
    if (scaleOpacity(layer.opacity, s) <= 0.002) continue; // 見えないレイヤーは描かない
    try {
      const mask = buildMask(width, height, layer.regions, layer.protect);
      const filterPad = Math.round(Math.min(width, height) * 0.08);
      const ctx: EffectContext = {
        filterPad,
        width,
        height,
        short: Math.min(width, height),
        source: acc,
        original,
        rng: mulberry32(layer.seed),
        gpu,
        mask,
        createCanvas: (w = width, h = height) => createCanvas(w, h),
        applyFilters: (filters, input = acc) => applyFilters(input, filters, filterPad),
        filters: () => import('pixi-filters'),
      };
      const out = await layer.effect.render(ctx, layer.params);
      if (mask) {
        const og = ctx2d(out);
        // エフェクトが座標変換や不透明度を残したままのことがあるので、必ず初期状態に戻してから掛ける
        og.setTransform(1, 0, 0, 1, 0, 0);
        og.globalAlpha = 1;
        og.filter = 'none';
        og.globalCompositeOperation = 'destination-in';
        og.imageSmoothingEnabled = true;
        og.drawImage(maskToCanvas(mask), 0, 0, width, height);
      }
      g.save();
      g.globalAlpha = scaleOpacity(layer.opacity, s);
      g.globalCompositeOperation = COMPOSITE[layer.blend];
      g.drawImage(out, 0, 0);
      g.restore();
    } catch (e) {
      errors.push(`${layer.path}（${layer.effect.id}）の描画に失敗: ${(e as Error).message}`);
    }
  }
  return { canvas: acc, errors, ms: performance.now() - t0, usedGpu };
}

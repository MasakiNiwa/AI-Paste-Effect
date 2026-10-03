import { css } from '../color';
import { p } from '../params';
import type { Rng } from '../random';
import { defineEffect, type EffectContext } from '../types';
import { ctx2d } from './util';

/** w×h のランダムなグレー画素を作る */
function noiseCanvas(ctx: EffectContext, w: number, h: number, rng: Rng, amount: number, mono: boolean) {
  const c = ctx.createCanvas(w, h);
  const g = ctx2d(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 2 * amount * 127;
    d[i] = 128 + n;
    d[i + 1] = mono ? 128 + n : 128 + (rng() - 0.5) * 2 * amount * 127;
    d[i + 2] = mono ? 128 + n : 128 + (rng() - 0.5) * 2 * amount * 127;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export const filmGrain = defineEffect({
  id: 'filmGrain',
  label: 'フィルムグレイン',
  category: 'texture',
  kind: 'overlay',
  defaultBlend: 'overlay',
  description: 'フィルム写真のような粒状ノイズ。アニメの撮影処理っぽさ・ざらつき・レトロ感。amount 0.05〜0.3 が自然。',
  params: {
    amount: p.num(0, 1, 0.15, 'ノイズの強さ'),
    size: p.num(1, 6, 1.5, '粒の大きさ（画素）'),
    monochrome: p.bool(true, 'モノクロノイズか'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const w = Math.max(1, Math.round(ctx.width / v.size));
    const h = Math.max(1, Math.round(ctx.height / v.size));
    const n = noiseCanvas(ctx, w, h, ctx.rng, v.amount, v.monochrome);
    const g = ctx2d(out);
    g.imageSmoothingEnabled = v.size > 1.5;
    g.drawImage(n, 0, 0, ctx.width, ctx.height);
    return out;
  },
});

export const paperTexture = defineEffect({
  id: 'paperTexture',
  label: '紙の質感',
  category: 'texture',
  kind: 'overlay',
  defaultBlend: 'multiply',
  description: '紙・水彩紙のようなムラと繊維感を加える。手描き感・ノスタルジー・絵本っぽさに。',
  params: {
    color: p.color('#f3e9d6', '紙の色'),
    roughness: p.num(0, 1, 0.4, 'ムラの強さ'),
    fibers: p.num(0, 1, 0.3, '繊維の量'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    g.fillStyle = css(v.color);
    g.fillRect(0, 0, W, H);
    // 大小のムラを重ねる（低解像度ノイズの拡大＝バリューノイズ風）
    g.globalCompositeOperation = 'soft-light';
    g.imageSmoothingEnabled = true;
    for (const div of [6, 24, 96, 384]) {
      const w = Math.max(2, Math.round((W / ctx.short) * div));
      const h = Math.max(2, Math.round((H / ctx.short) * div));
      g.globalAlpha = v.roughness * (div > 100 ? 0.6 : 1);
      g.drawImage(noiseCanvas(ctx, w, h, ctx.rng, 0.6, true), 0, 0, W, H);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'multiply';
    const fibers = Math.round(v.fibers * 400);
    g.lineWidth = Math.max(0.5, ctx.short / 1200);
    for (let i = 0; i < fibers; i++) {
      const x = ctx.rng() * W;
      const y = ctx.rng() * H;
      const len = (0.01 + ctx.rng() * 0.04) * ctx.short;
      const a = ctx.rng() * Math.PI * 2;
      g.strokeStyle = `rgba(120,100,80,${0.08 + ctx.rng() * 0.12})`;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.5, y + Math.sin(a + 0.5) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    return out;
  },
});

export const oldFilm = defineEffect({
  id: 'oldFilm',
  label: '古いフィルム',
  category: 'texture',
  kind: 'filter',
  defaultBlend: 'normal',
  description: 'セピア・ノイズ・傷・周辺減光で古いフィルム風に（OldFilmFilter）。回想シーン・昔話風に。',
  params: {
    sepia: p.num(0, 1, 0.3, 'セピアの強さ'),
    noise: p.num(0, 1, 0.3, 'ノイズ'),
    scratch: p.num(-1, 1, 0.5, '傷の量'),
    vignetting: p.num(0, 0.5, 0.3, '周辺減光'),
  },
  async render(ctx, v) {
    const { OldFilmFilter } = await ctx.filters();
    return ctx.applyFilters([
      new OldFilmFilter({
        sepia: v.sepia,
        noise: v.noise,
        scratch: v.scratch,
        vignetting: v.vignetting,
        seed: ctx.rng(),
      }),
    ]);
  },
});

export const crt = defineEffect({
  id: 'crt',
  label: 'ブラウン管',
  category: 'texture',
  kind: 'filter',
  defaultBlend: 'normal',
  description: 'ブラウン管テレビ風の走査線・歪み・ノイズ（CRTFilter）。レトロゲーム・90年代アニメ・モニター越し演出に。',
  params: {
    curvature: p.num(0, 10, 1, '画面の湾曲'),
    lineWidth: p.num(0, 5, 1, '走査線の太さ'),
    lineContrast: p.num(0, 1, 0.25, '走査線の濃さ'),
    noise: p.num(0, 1, 0.2, 'ノイズ'),
    vignetting: p.num(0, 1, 0.3, '周辺減光'),
  },
  async render(ctx, v) {
    const { CRTFilter } = await ctx.filters();
    return ctx.applyFilters([
      new CRTFilter({ ...v, lineWidth: v.lineWidth * (ctx.short / 800), seed: ctx.rng() }),
    ]);
  },
});

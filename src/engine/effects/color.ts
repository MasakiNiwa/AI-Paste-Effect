import { css, sampleStops } from '../color';
import { p } from '../params';
import { defineEffect } from '../types';
import { ctx2d } from './util';

export const colorAdjust = defineEffect({
  id: 'colorAdjust',
  label: '明るさ・コントラスト',
  category: 'color',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    '明るさ・コントラスト・彩度・ガンマ・RGB バランスの基本補正。全体の空気感の土台作りや、region と組み合わせた部分的な明暗調整に。',
  params: {
    brightness: p.num(0, 2, 1, '明るさ（1 で変化なし）'),
    contrast: p.num(0, 2, 1, 'コントラスト（1 で変化なし）'),
    saturation: p.num(0, 2, 1, '彩度（0 でモノクロ）'),
    gamma: p.num(0.3, 3, 1, 'ガンマ（>1 で中間調が明るい）'),
    red: p.num(0, 2, 1, '赤の倍率'),
    green: p.num(0, 2, 1, '緑の倍率'),
    blue: p.num(0, 2, 1, '青の倍率'),
  },
  async render(ctx, v) {
    const { AdjustmentFilter } = await ctx.filters();
    return ctx.applyFilters([new AdjustmentFilter({ ...v })]);
  },
});

export const hsl = defineEffect({
  id: 'hsl',
  label: '色相・彩度・明度',
  category: 'color',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '色相の回転と彩度・明度の調整。colorize=true で単色化（セピア風・青一色など）。',
  params: {
    hue: p.num(-180, 180, 0, '色相の回転角（度）'),
    saturation: p.num(-1, 1, 0, '彩度の増減'),
    lightness: p.num(-1, 1, 0, '明度の増減'),
    colorize: p.bool(false, 'true で hue の色一色に染める'),
  },
  async render(ctx, v) {
    const { HslAdjustmentFilter } = await ctx.filters();
    return ctx.applyFilters([new HslAdjustmentFilter({ ...v, alpha: 1 })]);
  },
});

export const gradientMap = defineEffect({
  id: 'gradientMap',
  label: 'グラデーションマップ',
  category: 'color',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    '明るさに応じて色を置き換える（暗部→明部の順に色を並べる）。2 色ならデュオトーン。opacity 0.15〜0.5 や blend "soft-light"/"color" で色調の統一感（夕暮れ・青春・ノスタルジー等）を出すのに最適。',
  params: {
    colors: p.colors(['#1d1b3a', '#c86b98', '#ffe6c7'], '暗部→明部の色', 2, 6),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    g.drawImage(ctx.source, 0, 0);
    const img = g.getImageData(0, 0, ctx.width, ctx.height);
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const c = sampleStops(v.colors, i / 255);
      lut[i * 3] = c.r;
      lut[i * 3 + 1] = c.g;
      lut[i * 3 + 2] = c.b;
    }
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      d[i] = lut[l * 3];
      d[i + 1] = lut[l * 3 + 1];
      d[i + 2] = lut[l * 3 + 2];
    }
    g.putImageData(img, 0, 0);
    return out;
  },
});

export const gradient = defineEffect({
  id: 'gradient',
  label: 'グラデーション',
  category: 'color',
  kind: 'overlay',
  defaultBlend: 'soft-light',
  description:
    '色のグラデーションを重ねる。空側だけ夕焼け色・下から青み・中心から暖色など、方向性のある色付けに。blend は soft-light / overlay / screen / multiply / color がよく合う。',
  params: {
    type: p.enum(['linear', 'radial'] as const, 'linear', '直線か放射状か'),
    from: p.point(0.5, 0, 'linear: 開始点 / radial: 中心'),
    to: p.point(0.5, 1, 'linear: 終了点 / radial: この点までが半径'),
    colors: p.colors(['#ff9a6b', '#7b6cff00'], '開始→終了の色（"#rrggbbaa" で透明度も可）', 2, 6),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const fx = v.from.x * W;
    const fy = v.from.y * H;
    const tx = v.to.x * W;
    const ty = v.to.y * H;
    const grad =
      v.type === 'linear'
        ? g.createLinearGradient(fx, fy, tx, ty)
        : g.createRadialGradient(fx, fy, 0, fx, fy, Math.max(1, Math.hypot(tx - fx, ty - fy)));
    v.colors.forEach((c, i) => grad.addColorStop(i / (v.colors.length - 1), css(c)));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return out;
  },
});

export const colorFill = defineEffect({
  id: 'colorFill',
  label: '単色',
  category: 'color',
  kind: 'overlay',
  defaultBlend: 'soft-light',
  description:
    '単色を重ねる。region と組み合わせて「背景だけ青く」「影色を紫に」などに。blend "multiply" で影色、"screen" で明るい霞、"color" で色だけ置換。',
  params: {
    color: p.color('#6a7bff', '重ねる色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    g.fillStyle = css(v.color);
    g.fillRect(0, 0, ctx.width, ctx.height);
    return out;
  },
});

export const vignette = defineEffect({
  id: 'vignette',
  label: '周辺減光',
  category: 'color',
  kind: 'overlay',
  defaultBlend: 'multiply',
  description:
    '画面の周辺を暗く（または色付け）して視線を中央へ誘導する。center を顔やキャラに合わせると効果的。白や淡色＋screen で周辺を明るく飛ばす表現も可。',
  params: {
    center: p.point(0.5, 0.5, '明るく残す中心'),
    size: p.num(0, 1.5, 0.6, '影響を受けない中心部の大きさ（短辺比）'),
    softness: p.num(0.05, 1.5, 0.6, '境目のなめらかさ'),
    strength: p.num(0, 1, 0.6, '周辺の濃さ'),
    color: p.color('#000000', '周辺の色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const cx = v.center.x * W;
    const cy = v.center.y * H;
    const inner = (v.size * ctx.short) / 2;
    const outer = inner + v.softness * Math.max(W, H);
    const grad = g.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, css({ ...v.color, a: 0 }));
    grad.addColorStop(1, css(v.color, v.strength));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return out;
  },
});

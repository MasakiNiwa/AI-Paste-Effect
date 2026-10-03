import { p } from '../params';
import { defineEffect } from '../types';

export const blur = defineEffect({
  id: 'blur',
  label: 'ぼかし',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    '画像をぼかす。region で背景だけ・画面端だけをぼかし、被写界深度（ピント）や奥行きを出すのに使う。protect と併用してキャラを守る。',
  params: {
    radius: p.num(0, 0.05, 0.008, 'ぼかし半径（短辺比）'),
  },
  async render(ctx, v) {
    const { KawaseBlurFilter } = await ctx.filters();
    return ctx.applyFilters([new KawaseBlurFilter({ strength: Math.max(0.5, (v.radius * ctx.short) / 2), quality: 5, clamp: true })]);
  },
});

export const zoomBlur = defineEffect({
  id: 'zoomBlur',
  label: 'ズームブラー',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '中心から放射状に流れるぼかし。突進・衝撃・スピード感・吸い込まれる感覚に。center を注目点に。',
  params: {
    center: p.point(0.5, 0.5, '中心'),
    strength: p.num(0, 0.5, 0.1, '強さ'),
    innerRadius: p.num(0, 1, 0.25, 'ぼけない中心部の半径（短辺比）'),
  },
  async render(ctx, v) {
    const { ZoomBlurFilter } = await ctx.filters();
    return ctx.applyFilters([
      new ZoomBlurFilter({
        center: { x: v.center.x * ctx.width + ctx.filterPad, y: v.center.y * ctx.height + ctx.filterPad },
        strength: v.strength,
        innerRadius: v.innerRadius * ctx.short,
      }),
    ]);
  },
});

export const motionBlur = defineEffect({
  id: 'motionBlur',
  label: 'モーションブラー',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '一方向へのぶれ。高速移動・手ぶれ感。region で背景だけにかけると被写体が際立つ。',
  params: {
    angle: p.num(-180, 180, 0, '方向（度）'),
    distance: p.num(0, 0.1, 0.03, 'ぶれ幅（短辺比）'),
  },
  async render(ctx, v) {
    const { MotionBlurFilter } = await ctx.filters();
    const d = v.distance * ctx.short;
    const a = (v.angle * Math.PI) / 180;
    return ctx.applyFilters([
      new MotionBlurFilter({ velocity: { x: Math.cos(a) * d, y: Math.sin(a) * d }, kernelSize: 15 }),
    ]);
  },
});

export const rgbShift = defineEffect({
  id: 'rgbShift',
  label: 'RGB ずらし',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '色収差（RGB のずれ）。サイバー感・不穏・動揺・レンズ感に。amount は 0.002〜0.01 程度が上品。',
  params: {
    amount: p.num(0, 0.05, 0.004, 'ずれ幅（短辺比）'),
    angle: p.num(-180, 180, 0, 'ずれる方向（度）'),
  },
  async render(ctx, v) {
    const { RGBSplitFilter } = await ctx.filters();
    const d = v.amount * ctx.short;
    const a = (v.angle * Math.PI) / 180;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    return ctx.applyFilters([new RGBSplitFilter({ red: { x: dx, y: dy }, green: { x: 0, y: 0 }, blue: { x: -dx, y: -dy } })]);
  },
});

export const glitch = defineEffect({
  id: 'glitch',
  label: 'グリッチ',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '画面が横にずれて裂けるデジタルノイズ（GlitchFilter）。電脳・異常事態・ホラー・不安定な心理に。',
  params: {
    slices: p.int(2, 60, 10, '分割数'),
    offset: p.num(0, 0.2, 0.03, 'ずれ幅（短辺比）'),
    direction: p.num(-180, 180, 0, 'ずれる方向（度）'),
    rgb: p.num(0, 0.03, 0.004, '色ずれ幅（短辺比）'),
  },
  async render(ctx, v) {
    const { GlitchFilter } = await ctx.filters();
    const c = v.rgb * ctx.short;
    return ctx.applyFilters([
      new GlitchFilter({
        slices: v.slices,
        offset: v.offset * ctx.short,
        direction: v.direction,
        fillMode: 2,
        seed: ctx.rng(),
        red: { x: c, y: 0 },
        green: { x: 0, y: 0 },
        blue: { x: -c, y: 0 },
      }),
    ]);
  },
});

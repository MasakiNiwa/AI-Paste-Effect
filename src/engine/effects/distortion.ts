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

/** 余白付きキャンバス上での 0〜1 座標に変換する（中心を正規化座標で受け取るフィルタ用） */
const padded = (ctx: { width: number; height: number; filterPad: number }, x: number, y: number) => ({
  x: (x * ctx.width + ctx.filterPad) / (ctx.width + ctx.filterPad * 2),
  y: (y * ctx.height + ctx.filterPad) / (ctx.height + ctx.filterPad * 2),
});

export const shockwave = defineEffect({
  id: 'shockwave',
  label: '衝撃波',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '中心から広がるリング状の空間の歪み（ShockwaveFilter）。パンチ・着地・爆発・魔法の発動の瞬間に。',
  params: {
    center: p.point(0.5, 0.5, '衝撃の中心'),
    radius: p.num(0.05, 1.5, 0.35, 'リングの半径（短辺比）'),
    amplitude: p.num(0, 1, 0.4, '歪みの強さ'),
    wavelength: p.num(0.01, 0.3, 0.08, 'リングの幅（短辺比）'),
    brightness: p.num(0.5, 2, 1.15, 'リング部分の明るさ'),
  },
  async render(ctx, v) {
    const { ShockwaveFilter } = await ctx.filters();
    const r = v.radius * ctx.short;
    return ctx.applyFilters([
      new ShockwaveFilter({
        center: { x: v.center.x * ctx.width + ctx.filterPad, y: v.center.y * ctx.height + ctx.filterPad },
        // time × speed がリングの位置になる
        speed: r,
        time: 1,
        radius: -1,
        amplitude: v.amplitude * ctx.short * 0.08,
        wavelength: v.wavelength * ctx.short,
        brightness: v.brightness,
      }),
    ]);
  },
});

export const bulgePinch = defineEffect({
  id: 'bulgePinch',
  label: '膨張・収縮',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '円形に膨らませる（魚眼・迫力）またはすぼめる（BulgePinchFilter）。strength が正で膨張、負で収縮。顔に使うと絵が崩れるので背景や手前の物向き。',
  params: {
    center: p.point(0.5, 0.5, '中心'),
    radius: p.num(0.05, 1.5, 0.5, '効果の半径（短辺比）'),
    strength: p.num(-1, 1, 0.4, '強さ（正=膨張 / 負=収縮）'),
  },
  async render(ctx, v) {
    const { BulgePinchFilter } = await ctx.filters();
    return ctx.applyFilters([
      new BulgePinchFilter({ center: padded(ctx, v.center.x, v.center.y), radius: v.radius * ctx.short, strength: v.strength }),
    ]);
  },
});

export const twist = defineEffect({
  id: 'twist',
  label: 'うず巻き',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '中心の周りを渦状にねじる（TwistFilter）。めまい・混乱・催眠・異空間・回想への入り口に。',
  params: {
    center: p.point(0.5, 0.5, '中心'),
    radius: p.num(0.05, 1.5, 0.45, '効果の半径（短辺比）'),
    angle: p.num(-720, 720, 120, 'ねじる角度（度）'),
  },
  async render(ctx, v) {
    const { TwistFilter } = await ctx.filters();
    return ctx.applyFilters([
      new TwistFilter({
        offset: { x: v.center.x * ctx.width + ctx.filterPad, y: v.center.y * ctx.height + ctx.filterPad },
        radius: v.radius * ctx.short,
        angle: (v.angle * Math.PI) / 180,
      }),
    ]);
  },
});

export const pixelate = defineEffect({
  id: 'pixelate',
  label: 'モザイク・ドット絵',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '画像を粗いドットにする（PixelateFilter）。レトロゲーム風・電脳世界・伏せ字的な演出に。region で一部だけにも。',
  params: {
    size: p.num(0.003, 0.08, 0.012, 'ドットの大きさ（短辺比）'),
  },
  async render(ctx, v) {
    const { PixelateFilter } = await ctx.filters();
    return ctx.applyFilters([new PixelateFilter(Math.max(2, Math.round(v.size * ctx.short)))]);
  },
});

export const reflection = defineEffect({
  id: 'reflection',
  label: '水面反射',
  category: 'distortion',
  kind: 'filter',
  defaultBlend: 'normal',
  description: 'boundary より下を水面のように揺らす（ReflectionFilter）。mirror=true で上の景色を映し込む。水辺・夏・幻想的な場面に。',
  params: {
    boundary: p.num(0, 1, 0.7, '水面の高さ（画像高さ比）'),
    mirror: p.bool(false, '上の景色を鏡のように映すか'),
    amplitude: p.num(0, 0.05, 0.006, '揺れの大きさ（短辺比）'),
    wavelength: p.num(0.01, 0.3, 0.1, '波の間隔（短辺比）'),
  },
  async render(ctx, v) {
    const { ReflectionFilter } = await ctx.filters();
    const a = v.amplitude * ctx.short;
    const w = v.wavelength * ctx.short;
    return ctx.applyFilters([
      new ReflectionFilter({
        boundary: padded(ctx, 0, v.boundary).y,
        mirror: v.mirror,
        amplitude: [a * 0.3, a],
        waveLength: [w * 0.5, w],
        alpha: [1, 1],
        time: ctx.rng() * 10,
      }),
    ]);
  },
});

import { css, parseColor } from '../color';
import { p } from '../params';
import { range } from '../random';
import { defineEffect } from '../types';
import { ctx2d, drawSoft, rgb, tryGpu, withAlpha } from './util';

export const bloom = defineEffect({
  id: 'bloom',
  label: 'ブルーム',
  category: 'light',
  kind: 'filter',
  defaultBlend: 'screen',
  description:
    '明るい部分だけを光らせてにじませる。逆光・ハイライト・キラッとした空気感に。threshold を下げると光る範囲が広がる。color で光に色を付けられる。',
  params: {
    threshold: p.num(0, 1, 0.7, 'この明るさ以上が光る'),
    intensity: p.num(0, 2, 0.7, '光の強さ'),
    radius: p.num(0.002, 0.08, 0.02, '光のにじみ幅（短辺比）'),
    color: p.color('#ffffff', '光の色（白で元の色のまま）'),
  },
  async render(ctx, v) {
    const { KawaseBlurFilter } = await ctx.filters();
    const blur = (input: HTMLCanvasElement) =>
      ctx.applyFilters([new KawaseBlurFilter({ strength: Math.max(1, (v.radius * ctx.short) / 2), quality: 6, clamp: true })], input);
    // 明部の抽出（ソフトニー付きのしきい値）
    const brightGpu = await tryGpu(ctx, (gpu) =>
      gpu.run({
        width: ctx.width,
        height: ctx.height,
        textures: { uSrc: ctx.source },
        uniforms: { uThreshold: v.threshold, uIntensity: v.intensity, uTint: rgb(v.color) },
        fragment: `
uniform sampler2D uSrc;
uniform float uThreshold, uIntensity;
uniform vec3 uTint;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float k = clamp((luma(c) - uThreshold + 0.15) / 0.3, 0.0, 1.0);
  outColor = vec4(min(vec3(1.0), c * (k * k * (3.0 - 2.0 * k) * uIntensity) * uTint), 1.0);
}`,
      }),
    );
    if (brightGpu) return blur(brightGpu);
    const bright = ctx.createCanvas();
    const g = ctx2d(bright);
    g.drawImage(ctx.source, 0, 0);
    const img = g.getImageData(0, 0, ctx.width, ctx.height);
    const d = img.data;
    const knee = 0.15;
    const tint = [v.color.r / 255, v.color.g / 255, v.color.b / 255];
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const k = Math.min(1, Math.max(0, (l - v.threshold + knee) / (2 * knee)));
      const w = k * k * (3 - 2 * k) * v.intensity;
      d[i] = Math.min(255, d[i] * w * tint[0]);
      d[i + 1] = Math.min(255, d[i + 1] * w * tint[1]);
      d[i + 2] = Math.min(255, d[i + 2] * w * tint[2]);
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return blur(bright);
  },
});

export const softGlow = defineEffect({
  id: 'softGlow',
  label: 'ソフトグロー',
  category: 'light',
  kind: 'filter',
  defaultBlend: 'screen',
  description:
    '画像をぼかして重ね、ふんわり柔らかく光らせる（ソフトフォーカス／紗）。blend "screen" で明るく、"soft-light" で柔らかくしっとり、"lighten" で控えめに。',
  params: {
    radius: p.num(0, 0.08, 0.02, 'ぼかし半径（短辺比）'),
    intensity: p.num(0, 1, 0.45, '重ねる強さ'),
    brightness: p.num(0.5, 2, 1, 'ぼかした光の明るさ'),
  },
  async render(ctx, v) {
    const { KawaseBlurFilter, AdjustmentFilter } = await ctx.filters();
    const out = await ctx.applyFilters([
      new KawaseBlurFilter({ strength: Math.max(1, (v.radius * ctx.short) / 2), quality: 5, clamp: true }),
      new AdjustmentFilter({ brightness: v.brightness }),
    ]);
    return withAlpha(ctx, out, v.intensity);
  },
});

export const godRays = defineEffect({
  id: 'godRays',
  label: 'ゴッドレイ',
  category: 'light',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    'ノイズ状の揺らぐ光の筋を全体に重ねる（GodrayFilter）。parallel=true で平行光（angle で傾き）、false で center から放射。神々しさ・木漏れ日・水中感に。',
  params: {
    parallel: p.bool(true, '平行光か'),
    angle: p.num(-60, 60, 30, '平行光の傾き（度）'),
    center: p.point(0.8, -0.1, '放射の中心（parallel=false の時）'),
    gain: p.num(0, 1, 0.4, '光の筋のコントラスト'),
    lacunarity: p.num(0.5, 5, 2.5, '筋の細かさ'),
    intensity: p.num(0, 1, 0.5, '光の強さ'),
  },
  async render(ctx, v) {
    const { GodrayFilter } = await ctx.filters();
    return ctx.applyFilters([
      new GodrayFilter({
        parallel: v.parallel,
        angle: v.angle,
        center: { x: v.center.x * ctx.width + ctx.filterPad, y: v.center.y * ctx.height + ctx.filterPad },
        gain: v.gain,
        alpha: v.intensity,
        lacunarity: v.lacunarity,
        time: ctx.rng() * 100,
      }),
    ]);
  },
});

export const lightRays = defineEffect({
  id: 'lightRays',
  label: '光芒',
  category: 'light',
  kind: 'overlay',
  defaultBlend: 'screen',
  description:
    '光源から伸びる柔らかい光の帯（薄明光線・スポットライト）。origin を窓や空の光源位置に、direction を光の進む向きに。',
  params: {
    origin: p.point(0.85, -0.05, '光源の位置（画面外も可）'),
    direction: p.num(-180, 180, 120, '光の進む向き（度。0=右, 90=下）'),
    spread: p.num(5, 180, 50, '光の広がり角（度）'),
    count: p.int(1, 30, 7, '光の帯の本数'),
    length: p.num(0.2, 3, 1.4, '長さ（短辺比）'),
    color: p.color('#fff2c8', '光の色'),
    intensity: p.num(0, 1, 0.6, '強さ'),
    softness: p.num(0, 1, 0.5, 'ぼけ具合'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    drawSoft(out, v.softness, (w, h) => ctx.createCanvas(w, h), (g, s) => {
      const ox = v.origin.x * ctx.width * s;
      const oy = v.origin.y * ctx.height * s;
      const len = v.length * ctx.short * s;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < v.count; i++) {
        const t = v.count === 1 ? 0.5 : i / (v.count - 1);
        const center = v.direction - v.spread / 2 + v.spread * t + range(ctx.rng, -0.3, 0.3) * (v.spread / v.count);
        const width = range(ctx.rng, 0.3, 1) * (v.spread / v.count) * 0.6;
        const a0 = ((center - width / 2) * Math.PI) / 180;
        const a1 = ((center + width / 2) * Math.PI) / 180;
        const l = len * range(ctx.rng, 0.6, 1);
        const grad = g.createRadialGradient(ox, oy, 0, ox, oy, l);
        const alpha = v.intensity * range(ctx.rng, 0.4, 1);
        grad.addColorStop(0, css(v.color, alpha));
        grad.addColorStop(0.6, css(v.color, alpha * 0.4));
        grad.addColorStop(1, css(v.color, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(ox, oy);
        g.arc(ox, oy, l, a0, a1);
        g.closePath();
        g.fill();
      }
    });
    return out;
  },
});

export const lightLeak = defineEffect({
  id: 'lightLeak',
  label: '光漏れ',
  category: 'light',
  kind: 'overlay',
  defaultBlend: 'screen',
  description:
    'フィルム写真のような色付きの光漏れ。画面の端（anchor）から柔らかい色の光がにじむ。エモさ・ノスタルジー・夏っぽさに。',
  params: {
    anchor: p.point(1, 0, '光が入ってくる位置（通常は画面の端や角）'),
    size: p.num(0.1, 2, 0.8, '大きさ（短辺比）'),
    colors: p.colors(['#ff6a3d', '#ffb36b', '#ff3d7f'], '光の色', 1, 5),
    intensity: p.num(0, 1, 0.7, '強さ'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    g.globalCompositeOperation = 'lighter';
    const ax = v.anchor.x * ctx.width;
    const ay = v.anchor.y * ctx.height;
    const R = v.size * ctx.short;
    const blobs = 3 + Math.floor(ctx.rng() * 3);
    for (let i = 0; i < blobs; i++) {
      const c = v.colors[i % v.colors.length];
      const x = ax + range(ctx.rng, -0.4, 0.4) * R;
      const y = ay + range(ctx.rng, -0.4, 0.4) * R;
      const r = R * range(ctx.rng, 0.4, 1);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, css(c, v.intensity * 0.8));
      grad.addColorStop(0.5, css(c, v.intensity * 0.35));
      grad.addColorStop(1, css(c, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, ctx.width, ctx.height);
    }
    return out;
  },
});

export const lightSpot = defineEffect({
  id: 'lightSpot',
  label: '光源グロー',
  category: 'light',
  kind: 'overlay',
  defaultBlend: 'screen',
  description: '指定位置に丸い光のにじみを置く。太陽・街灯・ランプ・魔法の光・逆光の光源位置の強調に。',
  params: {
    center: p.point(0.8, 0.2, '光の中心'),
    radius: p.num(0.02, 2, 0.4, '光の半径（短辺比）'),
    color: p.color('#fff0c0', '光の色'),
    intensity: p.num(0, 1, 0.8, '強さ'),
    core: p.num(0, 1, 0.2, '中心の芯の大きさ（0〜1）'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const x = v.center.x * ctx.width;
    const y = v.center.y * ctx.height;
    const r = v.radius * ctx.short;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, css(v.color, v.intensity));
    grad.addColorStop(Math.min(0.95, v.core * 0.9), css(v.color, v.intensity * 0.85));
    grad.addColorStop(Math.min(0.98, v.core * 0.9 + 0.3), css(v.color, v.intensity * 0.3));
    grad.addColorStop(1, css(v.color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, ctx.width, ctx.height);
    return out;
  },
});

const GHOST_TINTS = ['#8fd6ff', '#b69bff', '#8dffc2', '#ffd58f', '#ff9fbf'];

export const lensFlare = defineEffect({
  id: 'lensFlare',
  label: 'レンズフレア',
  category: 'light',
  kind: 'overlay',
  defaultBlend: 'screen',
  description:
    'カメラのレンズに光源が入った時のフレア。光源の芯・光条（スターバースト）・横に伸びる光の筋・光の輪・反対側に並ぶゴースト（丸い光）で構成。source を太陽やライトなどの光源位置に。夏・逆光・エモい青春・SF に。',
  params: {
    source: p.point(0.8, 0.18, '光源の位置'),
    size: p.num(0.03, 1, 0.22, '光源の芯の大きさ（短辺比）'),
    intensity: p.num(0, 1, 0.85, '全体の強さ'),
    color: p.color('#ffe6bf', '光の色'),
    rays: p.num(0, 1, 0.5, '光条（放射状の細い光）の強さ'),
    streak: p.num(0, 1, 0.5, '横に伸びる光の筋（アナモルフィック）の強さ'),
    streakAngle: p.num(-90, 90, 0, '光の筋の角度（度）'),
    halo: p.num(0, 1, 0.4, '光源を囲む光の輪の強さ'),
    ghosts: p.int(0, 12, 5, 'ゴースト（光源の反対側に並ぶ丸い光）の数'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H, short } = ctx;
    const sx = v.source.x * W;
    const sy = v.source.y * H;
    const R = v.size * short;
    const I = v.intensity;
    g.globalCompositeOperation = 'lighter';

    const blob = (x: number, y: number, r: number, c: typeof v.color, a: number, inner = 0) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
      grad.addColorStop(0, css(c, inner ? a * 0.2 : a));
      if (inner) grad.addColorStop(inner, css(c, a));
      grad.addColorStop(1, css(c, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
      g.fill();
    };

    // 芯（白に近い中心 + 色のにじみ）
    blob(sx, sy, R * 2.2, v.color, 0.55 * I);
    blob(sx, sy, R * 0.55, { r: 255, g: 255, b: 255, a: 1 }, I);

    // 光条
    if (v.rays > 0) {
      const n = 14 + Math.floor(ctx.rng() * 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + range(ctx.rng, -0.1, 0.1);
        const len = R * range(ctx.rng, 1.5, 4.5);
        const w = R * range(ctx.rng, 0.015, 0.04);
        const grad = g.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        grad.addColorStop(0, css(v.color, v.rays * I * 0.9));
        grad.addColorStop(1, css(v.color, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(sx - Math.sin(a) * w, sy + Math.cos(a) * w);
        g.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g.lineTo(sx + Math.sin(a) * w, sy - Math.cos(a) * w);
        g.closePath();
        g.fill();
      }
    }

    // 横に伸びる光の筋
    if (v.streak > 0) {
      g.save();
      g.translate(sx, sy);
      g.rotate((v.streakAngle * Math.PI) / 180);
      g.scale(1, 0.025);
      const len = Math.max(W, H) * 0.9;
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, len);
      grad.addColorStop(0, css({ r: 255, g: 255, b: 255, a: 1 }, v.streak * I));
      grad.addColorStop(0.15, css(v.color, v.streak * I * 0.6));
      grad.addColorStop(1, css(v.color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, len, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // 光の輪
    if (v.halo > 0) {
      const r = R * 3.2;
      const grad = g.createRadialGradient(sx, sy, r * 0.82, sx, sy, r);
      grad.addColorStop(0, css(v.color, 0));
      grad.addColorStop(0.55, css({ r: 170, g: 210, b: 255, a: 1 }, v.halo * I * 0.25));
      grad.addColorStop(0.8, css(v.color, v.halo * I * 0.3));
      grad.addColorStop(1, css(v.color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
    }

    // ゴースト: 光源と画面中心を結ぶ線上、中心の反対側に並ぶ
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < v.ghosts; i++) {
      const k = range(ctx.rng, -1.3, 0.6);
      const x = cx + (sx - cx) * k;
      const y = cy + (sy - cy) * k;
      const r = R * range(ctx.rng, 0.15, 1.1);
      const tint = parseColor(GHOST_TINTS[Math.floor(ctx.rng() * GHOST_TINTS.length)])!;
      blob(x, y, r, tint, I * range(ctx.rng, 0.12, 0.3), ctx.rng() < 0.5 ? 0.85 : 0);
    }
    return out;
  },
});

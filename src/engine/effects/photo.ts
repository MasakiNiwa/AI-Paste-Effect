/**
 * 写真の質感。アニメ・漫画のフラットな絵に「カメラで撮ったような」実写的な質感を足す。
 */
import type { Filter } from 'pixi.js';
import { css } from '../color';
import { p } from '../params';
import { defineEffect } from '../types';
import { ctx2d } from './util';

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const photoLook = defineEffect({
  id: 'photoLook',
  label: '写真の質感',
  category: 'photo',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    'フラットなアニメ・漫画の絵に、実写カメラで撮ったような質感をまとめて足す: レンズの色にじみ（周辺ほど強い色収差）・明部の赤いにじみ（フィルムのハレーション）・周辺光量落ち・明るさで変わるセンサーノイズ・フィルムの階調（黒の浮き・S 字カーブ）・シャープネス。「アニメ絵なのに写真っぽい」「スマホで撮ったような」「フィルムカメラ風」の要望に。depthOfField と組み合わせるとさらに写真らしくなる。',
  params: {
    grain: p.num(0, 1, 0.35, 'センサーノイズ（暗部ほど強く出る）'),
    chroma: p.num(0, 1, 0.3, 'ノイズの色付き具合（0 で白黒ノイズ）'),
    aberration: p.num(0, 0.02, 0.004, '周辺の色にじみ・色収差（短辺比）'),
    halation: p.num(0, 1, 0.35, '明部のまわりのにじみ（フィルムのハレーション）'),
    halationColor: p.color('#ff6a3a', 'ハレーションの色'),
    vignette: p.num(0, 1, 0.35, 'レンズの周辺光量落ち'),
    contrast: p.num(0, 1, 0.25, 'フィルムらしい S 字の階調'),
    fade: p.num(0, 1, 0.2, '黒の浮き（フィルムの褪色感）'),
    warmth: p.num(-1, 1, 0.1, '色温度（正で暖かく、負で青く）'),
    sharpen: p.num(0, 1, 0.35, 'シャープネス（輪郭のくっきり感）'),
  },
  async render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const { KawaseBlurFilter } = await ctx.filters();

    // ハレーション: 明部だけを取り出して色を付け、大きくぼかす
    let halo: Uint8ClampedArray | null = null;
    if (v.halation > 0) {
      const bright = ctx.createCanvas();
      const bg = ctx2d(bright);
      bg.drawImage(ctx.source, 0, 0);
      const img = bg.getImageData(0, 0, W, H);
      const d = img.data;
      const hc = v.halationColor;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        const k = smooth(0.62, 0.95, l);
        d[i] = hc.r * k;
        d[i + 1] = hc.g * k;
        d[i + 2] = hc.b * k;
        d[i + 3] = 255;
      }
      bg.putImageData(img, 0, 0);
      const blurred = await ctx.applyFilters(
        [new KawaseBlurFilter({ strength: Math.max(2, short * 0.012), quality: 6, clamp: true })],
        bright,
      );
      halo = ctx2d(blurred).getImageData(0, 0, W, H).data;
    }

    // シャープネス用の少しぼかした画像
    let soft: Uint8ClampedArray | null = null;
    if (v.sharpen > 0) {
      const b = await ctx.applyFilters([new KawaseBlurFilter({ strength: Math.max(1, short / 900), quality: 2, clamp: true })]);
      soft = ctx2d(b).getImageData(0, 0, W, H).data;
    }

    const src = ctx2d(ctx.source).getImageData(0, 0, W, H).data;
    const out = ctx.createCanvas();
    const og = ctx2d(out);
    const img = og.createImageData(W, H);
    const d = img.data;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.hypot(cx, cy);
    const ab = v.aberration * short;
    const rng = ctx.rng;
    const lift = v.fade * 0.14;
    const warmR = 1 + v.warmth * 0.07;
    const warmB = 1 - v.warmth * 0.07;
    const sample = (x: number, y: number, c: number) => {
      const xi = Math.min(W - 1, Math.max(0, Math.round(x)));
      const yi = Math.min(H - 1, Math.max(0, Math.round(y)));
      return src[(yi * W + xi) * 4 + c];
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const rn = Math.hypot(dx, dy) / maxR; // 0（中心）〜1（角）
        // 色収差: 中心から外へ、R と B を逆向きにずらす（周辺ほど強い）
        const k = ab * rn * rn;
        const ux = rn > 0 ? dx / (rn * maxR) : 0;
        const uy = rn > 0 ? dy / (rn * maxR) : 0;
        let r = k > 0.3 ? sample(x + ux * k, y + uy * k, 0) : src[i];
        let g = src[i + 1];
        let b = k > 0.3 ? sample(x - ux * k, y - uy * k, 2) : src[i + 2];

        if (soft) {
          r += (r - soft[i]) * v.sharpen * 1.5;
          g += (g - soft[i + 1]) * v.sharpen * 1.5;
          b += (b - soft[i + 2]) * v.sharpen * 1.5;
        }

        // 階調: S 字カーブ → 黒の浮き
        let rr = r / 255;
        let gg = g / 255;
        let bb = b / 255;
        if (v.contrast > 0) {
          rr += (smooth(0, 1, rr) - rr) * v.contrast;
          gg += (smooth(0, 1, gg) - gg) * v.contrast;
          bb += (smooth(0, 1, bb) - bb) * v.contrast;
        }
        rr = lift + rr * (1 - lift * 1.3) * warmR;
        gg = lift + gg * (1 - lift * 1.3);
        bb = lift * 1.15 + bb * (1 - lift * 1.3) * warmB;

        // ハレーション（スクリーン合成）
        if (halo) {
          const hk = v.halation;
          rr = 1 - (1 - rr) * (1 - (halo[i] / 255) * hk);
          gg = 1 - (1 - gg) * (1 - (halo[i + 1] / 255) * hk);
          bb = 1 - (1 - bb) * (1 - (halo[i + 2] / 255) * hk);
        }

        // 周辺光量落ち
        const vig = 1 - v.vignette * 0.75 * Math.pow(rn, 2.4);
        rr *= vig;
        gg *= vig;
        bb *= vig;

        // センサーノイズ: 暗部ほど強く、色ノイズを少し混ぜる
        if (v.grain > 0) {
          const l = rr * 0.3 + gg * 0.59 + bb * 0.11;
          const amp = v.grain * 0.11 * (1.25 - Math.min(1, l) * 0.85);
          const n = (rng() + rng() - 1) * amp;
          const c = v.chroma;
          rr += n + (rng() - 0.5) * amp * c;
          gg += n + (rng() - 0.5) * amp * c * 0.7;
          bb += n + (rng() - 0.5) * amp * c * 1.2;
        }

        d[i] = rr * 255;
        d[i + 1] = gg * 255;
        d[i + 2] = bb * 255;
        d[i + 3] = src[i + 3];
      }
    }
    og.putImageData(img, 0, 0);
    return out;
  },
});

export const depthOfField = defineEffect({
  id: 'depthOfField',
  label: '被写界深度',
  category: 'photo',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    'カメラのピントのように、focus の周りはくっきり、離れるほどぼかす（背景ボケ・前ボケ）。mode "radial" は円形のピント、"band" は横帯状のピント（ミニチュア風・ティルトシフト）。顔やキャラに focus を合わせると写真らしさが一気に出る。',
  params: {
    mode: p.enum(['radial', 'band'] as const, 'radial', 'ピントの形'),
    focus: p.point(0.5, 0.45, 'ピントを合わせる位置'),
    range: p.num(0.02, 1.5, 0.3, 'くっきり見える範囲（短辺比。band では帯の半分の幅）'),
    falloff: p.num(0.02, 1.5, 0.35, 'ぼけ始めてから最大になるまでの距離（短辺比）'),
    blur: p.num(0, 0.05, 0.014, '最大のぼけ量（短辺比）'),
    bokehGlow: p.num(0, 1, 0.25, 'ボケた明部をふんわり明るくする'),
  },
  async render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const { KawaseBlurFilter, AdjustmentFilter } = await ctx.filters();
    const filters: Filter[] = [new KawaseBlurFilter({ strength: Math.max(1, (v.blur * short) / 2), quality: 6, clamp: true })];
    if (v.bokehGlow > 0) filters.push(new AdjustmentFilter({ brightness: 1 + v.bokehGlow * 0.12, gamma: 1 + v.bokehGlow * 0.15 }));
    const blurred = await ctx.applyFilters(filters);
    // ピントの合う部分を消し、ぼけた画像だけを残す
    const g = ctx2d(blurred);
    g.globalCompositeOperation = 'destination-out';
    const fx = v.focus.x * W;
    const fy = v.focus.y * H;
    const inner = v.range * short;
    const outer = inner + v.falloff * short;
    const grad =
      v.mode === 'radial'
        ? g.createRadialGradient(fx, fy, inner, fx, fy, outer)
        : g.createLinearGradient(0, fy - outer, 0, fy + outer);
    const solid = css({ r: 0, g: 0, b: 0, a: 1 });
    const clear = css({ r: 0, g: 0, b: 0, a: 0 });
    if (v.mode === 'radial') {
      grad.addColorStop(0, solid);
      grad.addColorStop(1, clear);
      g.fillStyle = solid;
      g.beginPath();
      g.arc(fx, fy, inner, 0, Math.PI * 2);
      g.fill();
    } else {
      const span = outer * 2;
      const a = (outer - inner) / span;
      grad.addColorStop(0, clear);
      grad.addColorStop(Math.max(0, Math.min(0.5, a)), solid);
      grad.addColorStop(Math.min(1, Math.max(0.5, 1 - a)), solid);
      grad.addColorStop(1, clear);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return blurred;
  },
});

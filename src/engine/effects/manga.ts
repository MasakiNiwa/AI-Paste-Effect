import { css } from '../color';
import { p } from '../params';
import { range } from '../random';
import { defineEffect } from '../types';
import { ctx2d } from './util';

export const focusLines = defineEffect({
  id: 'focusLines',
  label: '集中線',
  category: 'manga',
  kind: 'overlay',
  defaultBlend: 'normal',
  description:
    '漫画の集中線。center に向かって画面外から線が集まる。center は顔や注目させたい物に、innerRx/innerRy はキャラが隠れない大きさに。驚き・衝撃・決意・注目の演出に。',
  params: {
    center: p.point(0.5, 0.45, '集中する中心'),
    innerRx: p.num(0.02, 1, 0.3, '線が届かない内側の楕円の横半径（画像幅比）'),
    innerRy: p.num(0.02, 1, 0.3, '同・縦半径（画像高さ比）'),
    count: p.int(10, 600, 160, '線の本数'),
    thickness: p.num(0.001, 0.04, 0.008, '線の太さ（短辺比）'),
    jitter: p.num(0, 1, 0.5, '線の長さのばらつき'),
    color: p.color('#000000', '線の色（白線も可）'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const cx = v.center.x * W;
    const cy = v.center.y * H;
    const far = Math.hypot(W, H) * 1.5;
    g.fillStyle = css(v.color);
    for (let i = 0; i < v.count; i++) {
      const a = ((i + range(ctx.rng, -0.5, 0.5)) / v.count) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // 内側の楕円上の点から外側へ
      const k = 1 + v.jitter * ctx.rng() * 0.8;
      const sx = cx + cos * v.innerRx * W * k;
      const sy = cy + sin * v.innerRy * H * k;
      const half = (v.thickness * ctx.short * range(ctx.rng, 0.3, 1.2)) / 2;
      const ex = cx + cos * far;
      const ey = cy + sin * far;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(ex - sin * half * 6, ey + cos * half * 6);
      g.lineTo(ex + sin * half * 6, ey - cos * half * 6);
      g.closePath();
      g.fill();
    }
    return out;
  },
});

export const speedLines = defineEffect({
  id: 'speedLines',
  label: '流線（スピード線）',
  category: 'manga',
  kind: 'overlay',
  defaultBlend: 'normal',
  description: '一方向に流れる平行な線。疾走感・動き・風・背景の勢いに。region で背景側だけに入れるのがおすすめ。',
  params: {
    angle: p.num(-180, 180, 0, '線の向き（度。0=水平, 90=垂直）'),
    count: p.int(5, 500, 90, '本数'),
    length: p.num(0.05, 1.5, 0.5, '平均の長さ（短辺比）'),
    thickness: p.num(0.0005, 0.02, 0.003, '太さ（短辺比）'),
    color: p.color('#000000', '線の色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const diag = Math.hypot(W, H);
    g.translate(W / 2, H / 2);
    g.rotate((v.angle * Math.PI) / 180);
    g.fillStyle = css(v.color);
    for (let i = 0; i < v.count; i++) {
      const y = range(ctx.rng, -diag / 2, diag / 2);
      const len = v.length * ctx.short * range(ctx.rng, 0.4, 1.6);
      const x = range(ctx.rng, -diag / 2 - len / 2, diag / 2 - len / 2);
      const t = (v.thickness * ctx.short * range(ctx.rng, 0.4, 1.4)) / 2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - t, x + len, y);
      g.quadraticCurveTo(x + len / 2, y + t, x, y);
      g.fill();
    }
    return out;
  },
});

export const screentone = defineEffect({
  id: 'screentone',
  label: 'スクリーントーン',
  category: 'manga',
  kind: 'overlay',
  defaultBlend: 'multiply',
  description:
    '網点のスクリーントーンを貼る。region と組み合わせて背景・影・空だけにトーンを貼る使い方が基本。linear の region でグラデトーン風にもなる。',
  params: {
    cell: p.num(0.002, 0.04, 0.008, '網点の間隔（短辺比）'),
    dot: p.num(0.05, 0.7, 0.35, '点の半径（間隔に対する比）'),
    angle: p.num(0, 90, 45, '網の角度（度）'),
    color: p.color('#000000', '点の色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const cell = Math.max(2, v.cell * ctx.short);
    const r = Math.max(0.5, cell * v.dot);
    const diag = Math.hypot(W, H);
    g.translate(W / 2, H / 2);
    g.rotate((v.angle * Math.PI) / 180);
    g.fillStyle = css(v.color);
    g.beginPath();
    for (let y = -diag / 2; y < diag / 2; y += cell) {
      for (let x = -diag / 2; x < diag / 2; x += cell) {
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    g.fill();
    return out;
  },
});

export const halftone = defineEffect({
  id: 'halftone',
  label: '網点印刷',
  category: 'manga',
  kind: 'filter',
  defaultBlend: 'normal',
  description: '画像そのものを網点印刷風にする（DotFilter）。古い漫画・新聞・ポップアート風。opacity を下げて重ねると質感だけ足せる。',
  params: {
    scale: p.num(0.3, 10, 1.2, '網点の細かさ（大きいほど粗い）'),
    angle: p.num(0, 10, 5, '網の角度（ラジアン）'),
    grayscale: p.bool(true, 'モノクロにするか'),
  },
  async render(ctx, v) {
    const { DotFilter } = await ctx.filters();
    return ctx.applyFilters([new DotFilter({ scale: v.scale * (ctx.short / 800), angle: v.angle, grayscale: v.grayscale })]);
  },
});

export const frame = defineEffect({
  id: 'frame',
  label: 'コマ枠',
  category: 'manga',
  kind: 'overlay',
  defaultBlend: 'normal',
  description: '漫画のコマのような枠線を付ける。inset を付けると周囲に余白（paper 色）ができる。最後のレイヤーに置くのが基本。',
  params: {
    thickness: p.num(0, 0.05, 0.012, '枠線の太さ（短辺比）'),
    inset: p.num(0, 0.15, 0.03, '外側の余白（短辺比）'),
    radius: p.num(0, 0.1, 0, '角丸（短辺比）'),
    color: p.color('#111111', '枠線の色'),
    paper: p.color('#ffffff', '余白の色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const inset = v.inset * ctx.short;
    const t = v.thickness * ctx.short;
    const r = v.radius * ctx.short;
    const path = () => {
      g.beginPath();
      g.roundRect(inset + t / 2, inset + t / 2, W - 2 * inset - t, H - 2 * inset - t, r);
    };
    if (inset > 0) {
      g.fillStyle = css(v.paper);
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      path();
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    if (t > 0) {
      g.lineWidth = t;
      g.strokeStyle = css(v.color);
      path();
      g.stroke();
    }
    return out;
  },
});

export const crossHatch = defineEffect({
  id: 'crossHatch',
  label: 'ハッチング',
  category: 'manga',
  kind: 'filter',
  defaultBlend: 'multiply',
  description:
    '暗い部分を斜線の重なり（カケアミ・ハッチング）で表現する（CrossHatchFilter）。ペン画・劇画調・影の強調に。blend "multiply" と region で影や背景にだけ入れるのが自然。',
  params: {},
  async render(ctx) {
    const { CrossHatchFilter } = await ctx.filters();
    return ctx.applyFilters([new CrossHatchFilter()]);
  },
});

export const inkLines = defineEffect({
  id: 'inkLines',
  label: '輪郭線強調',
  category: 'manga',
  kind: 'filter',
  defaultBlend: 'multiply',
  description: '画像の輪郭を検出してペン入れのような線を重ねる（Sobel）。線画のメリハリ・漫画原稿風・スケッチ風に。',
  params: {
    threshold: p.num(0, 1, 0.15, 'この強さ以上の輪郭だけを線にする'),
    strength: p.num(0, 3, 1.2, '線の濃さ'),
    color: p.color('#1a1a1a', '線の色'),
  },
  render(ctx, v) {
    const { width: W, height: H } = ctx;
    const src = ctx2d(ctx.source).getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1];
        const gy = lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1];
        const e = Math.hypot(gx, gy);
        const a = Math.min(1, Math.max(0, (e - v.threshold) * v.strength * 2));
        d[i * 4] = v.color.r;
        d[i * 4 + 1] = v.color.g;
        d[i * 4 + 2] = v.color.b;
        d[i * 4 + 3] = a * 255 * v.color.a;
      }
    }
    g.putImageData(img, 0, 0);
    return out;
  },
});

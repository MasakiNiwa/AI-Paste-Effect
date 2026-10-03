import { css, type RGBA } from '../color';
import { p } from '../params';
import { samplePoint } from '../region';
import { range, type Rng } from '../random';
import { defineEffect } from '../types';
import { ctx2d } from './util';

const pick = <T,>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length) % list.length];

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: RGBA, alpha: number, rot: number) {
  // 柔らかい光の芯
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 0.6);
  halo.addColorStop(0, css(color, alpha));
  halo.addColorStop(1, css(color, 0));
  g.fillStyle = halo;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  // 4 方向のきらめき
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = css(color, alpha);
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    g.moveTo(-r, 0);
    g.quadraticCurveTo(0, -r * 0.1, r, 0);
    g.quadraticCurveTo(0, r * 0.1, -r, 0);
    g.fill();
    g.rotate(Math.PI / 2);
  }
  g.restore();
}

export const sparkle = defineEffect({
  id: 'sparkle',
  label: 'キラキラ',
  category: 'particle',
  kind: 'overlay',
  defaultBlend: 'screen',
  description:
    '十字にきらめく星の光を散らす。region を指定すると、その範囲に集中して配置される（例: 髪のハイライト付近、空、キャラの周囲）。',
  params: {
    count: p.int(1, 400, 40, '個数'),
    size: p.num(0.003, 0.15, 0.035, '大きさ（短辺比）'),
    sizeVariance: p.num(0, 1, 0.7, '大きさのばらつき'),
    colors: p.colors(['#ffffff', '#fff3b0'], '色', 1, 6),
    rotation: p.num(0, 90, 0, '基本の傾き（度）'),
    intensity: p.num(0, 1, 0.9, '明るさ'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < v.count; i++) {
      const pt = samplePoint(ctx.mask, ctx.rng);
      const r = v.size * ctx.short * (1 - v.sizeVariance * ctx.rng());
      const rot = ((v.rotation + range(ctx.rng, -8, 8)) * Math.PI) / 180;
      drawStar(g, pt.x * ctx.width, pt.y * ctx.height, r, pick(ctx.rng, v.colors), v.intensity * range(ctx.rng, 0.5, 1), rot);
    }
    return out;
  },
});

export const bokeh = defineEffect({
  id: 'bokeh',
  label: '玉ボケ',
  category: 'particle',
  kind: 'overlay',
  defaultBlend: 'screen',
  description: '丸いボケ光を散らす。夜景・イルミネーション・夢っぽさ・前景の奥行き感に。',
  params: {
    count: p.int(1, 200, 25, '個数'),
    size: p.num(0.01, 0.3, 0.06, '大きさ（短辺比）'),
    sizeVariance: p.num(0, 1, 0.6, '大きさのばらつき'),
    colors: p.colors(['#ffd27a', '#ff9ec4', '#9ad7ff'], '色', 1, 6),
    softness: p.num(0, 1, 0.5, '縁のぼけ具合'),
    intensity: p.num(0, 1, 0.5, '明るさ'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < v.count; i++) {
      const pt = samplePoint(ctx.mask, ctx.rng);
      const x = pt.x * ctx.width;
      const y = pt.y * ctx.height;
      const r = v.size * ctx.short * (1 - v.sizeVariance * ctx.rng());
      const c = pick(ctx.rng, v.colors);
      const a = v.intensity * range(ctx.rng, 0.4, 1);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, css(c, a * 0.75));
      grad.addColorStop(Math.max(0.01, 1 - v.softness * 0.9 - 0.05), css(c, a));
      grad.addColorStop(1, css(c, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return out;
  },
});

type Shape = 'dot' | 'snow' | 'petal' | 'heart' | 'star' | 'bubble' | 'leaf';

function drawShape(g: CanvasRenderingContext2D, shape: Shape, r: number, color: RGBA, alpha: number) {
  g.fillStyle = css(color, alpha);
  g.strokeStyle = css(color, alpha);
  g.beginPath();
  switch (shape) {
    case 'dot':
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      break;
    case 'snow': {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, css(color, alpha));
      grad.addColorStop(0.5, css(color, alpha * 0.8));
      grad.addColorStop(1, css(color, 0));
      g.fillStyle = grad;
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'petal':
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 0.9, -r * 0.6, r * 0.7, r * 0.6, 0, r);
      g.bezierCurveTo(-r * 0.7, r * 0.6, -r * 0.9, -r * 0.6, -r * 0.15, -r * 0.85);
      g.lineTo(0, -r * 0.7);
      g.closePath();
      g.fill();
      break;
    case 'leaf':
      g.moveTo(0, -r);
      g.quadraticCurveTo(r * 0.8, 0, 0, r);
      g.quadraticCurveTo(-r * 0.8, 0, 0, -r);
      g.fill();
      break;
    case 'heart':
      g.moveTo(0, r * 0.9);
      g.bezierCurveTo(-r * 1.2, 0, -r * 0.6, -r, 0, -r * 0.35);
      g.bezierCurveTo(r * 0.6, -r, r * 1.2, 0, 0, r * 0.9);
      g.fill();
      break;
    case 'star':
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 === 0 ? r : r * 0.45;
        const a = (k * Math.PI) / 5 - Math.PI / 2;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      break;
    case 'bubble':
      g.lineWidth = Math.max(1, r * 0.12);
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.fillStyle = css(color, alpha * 0.8);
      g.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2);
      g.fill();
      break;
  }
}

export const particles = defineEffect({
  id: 'particles',
  label: 'パーティクル',
  category: 'particle',
  kind: 'overlay',
  defaultBlend: 'normal',
  description:
    '形のある粒を散らす。shape: dot(ほこり・光の粒) / snow(雪) / petal(花びら・桜) / leaf(葉) / heart / star / bubble(泡)。region でまとまって配置できる。',
  params: {
    shape: p.enum(['dot', 'snow', 'petal', 'leaf', 'heart', 'star', 'bubble'] as const, 'dot', '粒の形'),
    count: p.int(1, 600, 60, '個数'),
    size: p.num(0.002, 0.1, 0.012, '大きさ（短辺比）'),
    sizeVariance: p.num(0, 1, 0.6, '大きさのばらつき'),
    colors: p.colors(['#ffffff'], '色', 1, 6),
    opacity: p.num(0, 1, 0.85, '粒の不透明度'),
    opacityVariance: p.num(0, 1, 0.5, '不透明度のばらつき'),
    rotation: p.num(0, 360, 360, '回転のばらつき（度）'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    for (let i = 0; i < v.count; i++) {
      const pt = samplePoint(ctx.mask, ctx.rng);
      const r = v.size * ctx.short * (1 - v.sizeVariance * ctx.rng());
      g.save();
      g.translate(pt.x * ctx.width, pt.y * ctx.height);
      g.rotate(((ctx.rng() - 0.5) * v.rotation * Math.PI) / 180);
      g.scale(1, v.shape === 'petal' || v.shape === 'leaf' ? range(ctx.rng, 0.5, 1) : 1);
      drawShape(g, v.shape, r, pick(ctx.rng, v.colors), v.opacity * (1 - v.opacityVariance * ctx.rng()));
      g.restore();
    }
    return out;
  },
});

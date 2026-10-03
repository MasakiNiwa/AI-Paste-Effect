import type { EffectDefinition } from '../../core/types';
import { cloneCanvas, get2d } from '../../core/canvas';

const focusLines: EffectDefinition = {
  id: 'focusLines',
  name: '集中線',
  description: 'マンガの集中線を描き込みます。中心の位置や空白の大きさを調整できます。',
  category: 'overlay',
  order: 1,
  params: [
    { key: 'count', label: '線の本数', type: 'range', min: 10, max: 400, step: 1, default: 140 },
    { key: 'centerX', label: '中心（横）', type: 'range', min: 0, max: 100, step: 1, default: 50, unit: '%' },
    { key: 'centerY', label: '中心（縦）', type: 'range', min: 0, max: 100, step: 1, default: 50, unit: '%' },
    { key: 'inner', label: '中心の空白', type: 'range', min: 0, max: 100, step: 1, default: 45, unit: '%' },
    { key: 'lineWidth', label: '線の太さ', type: 'range', min: 1, max: 60, step: 1, default: 10 },
    { key: 'randomness', label: '長さのばらつき', type: 'range', min: 0, max: 100, step: 1, default: 50, unit: '%' },
    { key: 'color', label: '線の色', type: 'color', default: '#111111' },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const out = cloneCanvas(input);
    const ctx = get2d(out);
    const cx = ((p.centerX as number) / 100) * w;
    const cy = ((p.centerY as number) / 100) * h;
    const outer = Math.hypot(w, h) * 1.2;
    const inner = ((p.inner as number) / 100) * (Math.hypot(w, h) / 2);
    const count = p.count as number;
    const rand = (p.randomness as number) / 100;
    const baseWidth = (p.lineWidth as number) * unit;

    ctx.fillStyle = p.color as string;
    for (let i = 0; i < count; i++) {
      const angle = ((i + (rng() - 0.5) * 0.9) / count) * Math.PI * 2;
      const start = inner * (1 + rng() * rand * 0.8);
      const half = (baseWidth * (0.3 + rng() * 0.9)) / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // 外側が太く、中心側が尖った三角形
      ctx.beginPath();
      ctx.moveTo(cx + cos * start, cy + sin * start);
      ctx.lineTo(cx + cos * outer - sin * half, cy + sin * outer + cos * half);
      ctx.lineTo(cx + cos * outer + sin * half, cy + sin * outer - cos * half);
      ctx.closePath();
      ctx.fill();
    }
    return out;
  },
};

export default focusLines;

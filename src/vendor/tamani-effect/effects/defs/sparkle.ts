import type { EffectDefinition } from '../../core/types';
import { clamp, cloneCanvas, get2d, getPixels, luminance } from '../../core/canvas';

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  const k = r * 0.18; // くびれの強さ
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.fill();
  ctx.restore();
}

const sparkle: EffectDefinition = {
  id: 'sparkle',
  name: 'キラキラ',
  description: 'きらめきを散りばめます。明るい所にだけ置くこともできます。',
  category: 'overlay',
  order: 2,
  params: [
    { key: 'count', label: '数', type: 'range', min: 1, max: 300, step: 1, default: 40 },
    { key: 'size', label: '大きさ', type: 'range', min: 5, max: 150, step: 1, default: 30 },
    { key: 'variance', label: '大きさのばらつき', type: 'range', min: 0, max: 100, step: 1, default: 70, unit: '%' },
    {
      key: 'placement',
      label: '置く場所',
      type: 'select',
      default: 'anywhere',
      options: [
        { value: 'anywhere', label: 'どこでも' },
        { value: 'bright', label: '明るい所' },
        { value: 'opaque', label: '絵の上だけ（透明部分を除く）' },
      ],
    },
    { key: 'color', label: '色', type: 'color', default: '#ffffff' },
    { key: 'glow', label: '光らせる', type: 'boolean', default: true },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const out = cloneCanvas(input);
    const ctx = get2d(out);
    const src = p.placement === 'anywhere' ? null : getPixels(input).data;
    const baseR = ((p.size as number) * unit) / 2;
    const variance = (p.variance as number) / 100;

    ctx.fillStyle = p.color as string;
    if (p.glow) {
      ctx.shadowColor = p.color as string;
      ctx.shadowBlur = baseR * 0.8;
    }
    const count = p.count as number;
    let placed = 0;
    // 条件に合う場所が見つからない場合に備えて試行回数に上限を設ける
    for (let tries = 0; placed < count && tries < count * 30; tries++) {
      const x = rng() * w;
      const y = rng() * h;
      const s = 1 - rng() * variance;
      const rot = (rng() - 0.5) * 0.4;
      if (src) {
        const i = (clamp(Math.floor(y), 0, h - 1) * w + clamp(Math.floor(x), 0, w - 1)) * 4;
        if (src[i + 3] < 128) continue;
        if (p.placement === 'bright' && luminance(src[i], src[i + 1], src[i + 2]) < 170) continue;
      }
      drawSparkle(ctx, x, y, Math.max(1, baseR * s), rot);
      placed++;
    }
    return out;
  },
};

export default sparkle;

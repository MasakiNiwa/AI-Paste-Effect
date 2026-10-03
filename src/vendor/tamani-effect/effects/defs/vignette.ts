import type { EffectDefinition } from '../../core/types';
import { cloneCanvas, get2d, hexToRgb } from '../../core/canvas';

const vignette: EffectDefinition = {
  id: 'vignette',
  name: '周辺減光',
  description: '画像のふちを暗く（または任意の色に）して、中心に視線を集めます。',
  category: 'overlay',
  order: 4,
  params: [
    { key: 'strength', label: '強さ', type: 'range', min: 0, max: 100, step: 1, default: 60, unit: '%' },
    { key: 'size', label: '明るい範囲', type: 'range', min: 0, max: 100, step: 1, default: 55, unit: '%' },
    { key: 'softness', label: 'ぼかし', type: 'range', min: 1, max: 100, step: 1, default: 60, unit: '%' },
    { key: 'color', label: '色', type: 'color', default: '#000000' },
  ],
  render(input, p, env) {
    const { width: w, height: h } = env;
    const out = cloneCanvas(input);
    const ctx = get2d(out);
    const [r, g, b] = hexToRgb(p.color as string);
    const alpha = (p.strength as number) / 100;
    const inner = ((p.size as number) / 100) * 0.9;
    const outer = Math.min(1.42, inner + ((p.softness as number) / 100) * 0.9 + 0.01);

    // 単位円で描いて楕円に引き伸ばす
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.translate(w / 2, h / 2);
    ctx.scale(w / 2, h / 2);
    const grad = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    return out;
  },
};

export default vignette;

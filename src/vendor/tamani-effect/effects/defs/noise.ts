import type { EffectDefinition } from '../../core/types';
import { canvasFromPixels, getPixels } from '../../core/canvas';

const noise: EffectDefinition = {
  id: 'noise',
  name: 'ノイズ',
  description: 'ざらざらした粒子を加えて、フィルム写真や紙のような質感にします。',
  category: 'overlay',
  order: 3,
  params: [
    { key: 'amount', label: '強さ', type: 'range', min: 0, max: 100, step: 1, default: 30, unit: '%' },
    { key: 'grain', label: '粒の大きさ', type: 'range', min: 1, max: 20, step: 1, default: 2 },
    { key: 'mono', label: 'モノクロのノイズ', type: 'boolean', default: true },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const data = getPixels(input);
    const d = data.data;
    const grain = Math.max(1, (p.grain as number) * unit);
    const gw = Math.ceil(w / grain);
    const gh = Math.ceil(h / grain);
    const channels = p.mono ? 1 : 3;
    const field = new Float32Array(gw * gh * channels);
    const amp = (p.amount as number) * 2.55;
    for (let i = 0; i < field.length; i++) field[i] = (rng() - 0.5) * amp;

    for (let y = 0; y < h; y++) {
      const gy = Math.floor(y / grain) * gw;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const g = (gy + Math.floor(x / grain)) * channels;
        const color = channels === 3;
        d[o] += field[g];
        d[o + 1] += field[color ? g + 1 : g];
        d[o + 2] += field[color ? g + 2 : g];
      }
    }
    return canvasFromPixels(data);
  },
};

export default noise;

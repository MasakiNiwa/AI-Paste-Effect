import type { EffectDefinition } from '../../core/types';
import { canvasFromPixels, getPixels, hexToRgb, luminance } from '../../core/canvas';

const duotone: EffectDefinition = {
  id: 'duotone',
  name: '2色カラー',
  description: '暗い所と明るい所をそれぞれ好きな色に置き換えて、ポスター風の2色刷りにします。',
  category: 'color',
  order: 1,
  params: [
    { key: 'dark', label: '暗い所の色', type: 'color', default: '#2b1e6b' },
    { key: 'light', label: '明るい所の色', type: 'color', default: '#ffb3c7' },
    { key: 'contrast', label: 'コントラスト', type: 'range', min: -50, max: 100, step: 1, default: 0, unit: '%' },
  ],
  render(input, p) {
    const data = getPixels(input);
    const d = data.data;
    const [dr, dg, db] = hexToRgb(p.dark as string);
    const [lr, lg, lb] = hexToRgb(p.light as string);
    const c = 1 + (p.contrast as number) / 100;
    for (let i = 0; i < d.length; i += 4) {
      let t = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      t = Math.min(1, Math.max(0, (t - 0.5) * c + 0.5));
      d[i] = dr + (lr - dr) * t;
      d[i + 1] = dg + (lg - dg) * t;
      d[i + 2] = db + (lb - db) * t;
    }
    return canvasFromPixels(data);
  },
};

export default duotone;

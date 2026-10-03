import type { EffectDefinition } from '../../core/types';
import { createCanvas, get2d } from '../../core/canvas';

const pixelate: EffectDefinition = {
  id: 'pixelate',
  name: 'ドット絵',
  description: 'ブロック状に粗くして、ドット絵やモザイクのようにします。',
  category: 'distort',
  order: 3,
  params: [
    { key: 'blockSize', label: 'ブロックの大きさ', type: 'range', min: 2, max: 100, step: 1, default: 10 },
    { key: 'levels', label: '色数の制限', type: 'range', min: 0, max: 16, step: 1, default: 0, hint: '0 で制限なし。小さいほどレトロな色合いに' },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit } = env;
    const block = Math.max(1, (p.blockSize as number) * unit);
    const small = createCanvas(Math.max(1, Math.round(w / block)), Math.max(1, Math.round(h / block)));
    const sctx = get2d(small);
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(input, 0, 0, small.width, small.height);

    const levels = p.levels as number;
    if (levels >= 2) {
      const img = sctx.getImageData(0, 0, small.width, small.height);
      const d = img.data;
      const step = 255 / (levels - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / step) * step;
        d[i + 1] = Math.round(d[i + 1] / step) * step;
        d[i + 2] = Math.round(d[i + 2] / step) * step;
      }
      sctx.putImageData(img, 0, 0);
    }

    const out = createCanvas(w, h);
    const ctx = get2d(out);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h);
    return out;
  },
};

export default pixelate;

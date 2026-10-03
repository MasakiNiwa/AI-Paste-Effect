import type { EffectDefinition } from '../../core/types';
import { canvasFromPixels, getPixels } from '../../core/canvas';

const glitch: EffectDefinition = {
  id: 'glitch',
  name: 'グリッチ',
  description: '画像の一部を横にずらしたり、色をずらしたりして、デジタルの乱れを表現します。',
  category: 'distort',
  order: 1,
  params: [
    { key: 'slices', label: 'ずれる帯の数', type: 'range', min: 0, max: 60, step: 1, default: 10 },
    { key: 'shift', label: '横ずれの大きさ', type: 'range', min: 0, max: 300, step: 1, default: 60 },
    { key: 'sliceHeight', label: '帯の太さ', type: 'range', min: 2, max: 200, step: 1, default: 40 },
    { key: 'rgbSplit', label: '色ずれ', type: 'range', min: 0, max: 100, step: 1, default: 15 },
    { key: 'scanNoise', label: 'ノイズ線', type: 'range', min: 0, max: 100, step: 1, default: 0, unit: '%' },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const srcData = getPixels(input);
    const src = srcData.data;
    const outData = new ImageData(new Uint8ClampedArray(src), w, h);
    const out = outData.data;

    const wrap = (x: number) => ((x % w) + w) % w;
    const count = p.slices as number;
    for (let s = 0; s < count; s++) {
      const y0 = Math.floor(rng() * h);
      const sh = Math.max(1, Math.round(rng() * (p.sliceHeight as number) * unit));
      const dx = Math.round((rng() * 2 - 1) * (p.shift as number) * unit);
      const cs = Math.round((rng() * 2 - 1) * (p.rgbSplit as number) * unit);
      for (let y = y0; y < Math.min(h, y0 + sh); y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const sx = wrap(x - dx);
          const o = (row + x) * 4;
          const iR = (row + wrap(sx - cs)) * 4;
          const iG = (row + sx) * 4;
          const iB = (row + wrap(sx + cs)) * 4;
          out[o] = src[iR];
          out[o + 1] = src[iG + 1];
          out[o + 2] = src[iB + 2];
          out[o + 3] = Math.max(src[iR + 3], src[iG + 3], src[iB + 3]);
        }
      }
    }

    // ノイズ線（細い横線を明るくざらつかせる）
    const lines = Math.round(((p.scanNoise as number) / 100) * h * 0.08);
    for (let l = 0; l < lines; l++) {
      const y = Math.floor(rng() * h);
      const len = Math.floor(w * (0.2 + rng() * 0.8));
      const x0 = Math.floor(rng() * (w - len + 1));
      const strength = 60 + rng() * 140;
      for (let x = x0; x < x0 + len; x++) {
        const o = (y * w + x) * 4;
        if (out[o + 3] === 0) continue;
        const n = (rng() - 0.3) * strength;
        out[o] += n;
        out[o + 1] += n;
        out[o + 2] += n;
      }
    }
    return canvasFromPixels(outData);
  },
};

export default glitch;

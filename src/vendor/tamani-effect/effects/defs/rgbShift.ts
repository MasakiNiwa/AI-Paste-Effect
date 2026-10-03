import type { EffectDefinition } from '../../core/types';
import { canvasFromPixels, clamp, getPixels } from '../../core/canvas';

const rgbShift: EffectDefinition = {
  id: 'rgbShift',
  name: 'RGBずれ',
  description: '赤・緑・青の色をずらして、色収差や印刷ずれのような効果を出します。',
  category: 'distort',
  order: 2,
  params: [
    { key: 'amount', label: 'ずれ幅', type: 'range', min: 0, max: 100, step: 1, default: 8 },
    { key: 'angle', label: '角度', type: 'range', min: 0, max: 360, step: 1, default: 0, unit: '°' },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit } = env;
    const src = getPixels(input).data;
    const outData = new ImageData(w, h);
    const out = outData.data;
    const rad = ((p.angle as number) * Math.PI) / 180;
    const d = (p.amount as number) * unit;
    const dx = Math.round(Math.cos(rad) * d);
    const dy = Math.round(Math.sin(rad) * d);

    for (let y = 0; y < h; y++) {
      const yr = clamp(y - dy, 0, h - 1) * w;
      const yb = clamp(y + dy, 0, h - 1) * w;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const iR = (yr + clamp(x - dx, 0, w - 1)) * 4;
        const iB = (yb + clamp(x + dx, 0, w - 1)) * 4;
        const aR = src[iR + 3], aG = src[o + 3], aB = src[iB + 3];
        // 透明部分との境界で色が黒ずまないよう、アルファを考慮して合成する
        out[o] = (src[iR] * aR) / 255;
        out[o + 1] = (src[o + 1] * aG) / 255;
        out[o + 2] = (src[iB + 2] * aB) / 255;
        const a = Math.max(aR, aG, aB);
        out[o + 3] = a;
        if (a > 0) {
          const k = 255 / a;
          out[o] *= k;
          out[o + 1] *= k;
          out[o + 2] *= k;
        }
      }
    }
    return canvasFromPixels(outData);
  },
};

export default rgbShift;

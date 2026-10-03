import type { EffectDefinition } from '../../core/types';
import { clamp, createCanvas, get2d, getPixels, luminance } from '../../core/canvas';

const dots: EffectDefinition = {
  id: 'dots',
  name: '水玉点描',
  description: '画像を水玉（ドット）で描き直します。網点風にも点描風にもできます。',
  category: 'pattern',
  order: 1,
  params: [
    {
      key: 'mode',
      label: 'スタイル',
      type: 'select',
      default: 'halftone',
      options: [
        { value: 'halftone', label: '網点（暗い所ほど大きく）' },
        { value: 'pointillism', label: '点描（同じ大きさ）' },
      ],
    },
    { key: 'spacing', label: '密度（間隔）', type: 'range', min: 3, max: 80, step: 1, default: 14, hint: '小さいほど細かく密になります' },
    { key: 'dotSize', label: 'ドットサイズ', type: 'range', min: 10, max: 160, step: 1, default: 100, unit: '%' },
    { key: 'jitter', label: '不揃いさ', type: 'range', min: 0, max: 100, step: 1, default: 0, unit: '%', hint: '位置と大きさをランダムにずらします' },
    {
      key: 'grid',
      label: '並び方',
      type: 'select',
      default: 'hex',
      options: [
        { value: 'hex', label: '互い違い' },
        { value: 'square', label: '格子' },
      ],
    },
    {
      key: 'colorMode',
      label: 'ドットの色',
      type: 'select',
      default: 'original',
      options: [
        { value: 'original', label: '元の色' },
        { value: 'ink', label: '単色' },
      ],
    },
    { key: 'ink', label: 'インク色', type: 'color', default: '#222222', visibleWhen: (p) => p.colorMode === 'ink' },
    {
      key: 'background',
      label: '背景',
      type: 'select',
      default: 'white',
      options: [
        { value: 'white', label: '白' },
        { value: 'black', label: '黒' },
        { value: 'transparent', label: '透明' },
        { value: 'original', label: '元画像' },
      ],
    },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const src = getPixels(input).data;
    const out = createCanvas(w, h);
    const ctx = get2d(out);

    if (p.background === 'white' || p.background === 'black') {
      ctx.fillStyle = p.background === 'white' ? '#fff' : '#000';
      ctx.fillRect(0, 0, w, h);
    } else if (p.background === 'original') {
      ctx.drawImage(input, 0, 0);
    }

    const spacing = Math.max(1.5, (p.spacing as number) * unit);
    const hex = p.grid === 'hex';
    const rowStep = hex ? spacing * 0.866 : spacing;
    const sizeRatio = (p.dotSize as number) / 100;
    const jitter = (p.jitter as number) / 100;
    const halftone = p.mode === 'halftone';
    const brightOnDark = p.background === 'black';
    const ink = p.ink as string;
    const maxR = (spacing / 2) * sizeRatio * (hex ? 1.08 : 1.15);

    let row = 0;
    for (let y = spacing / 2; y < h + spacing; y += rowStep, row++) {
      const offset = hex && row % 2 === 1 ? spacing / 2 : 0;
      for (let x = spacing / 2 - offset; x < w + spacing; x += spacing) {
        // 乱数は毎セル同じ回数消費する（結果の再現性のため）
        const jx = (rng() - 0.5) * jitter * spacing;
        const jy = (rng() - 0.5) * jitter * spacing;
        const js = 1 + (rng() - 0.5) * jitter * 1.2;

        const sx = clamp(Math.round(x), 0, w - 1);
        const sy = clamp(Math.round(y), 0, h - 1);
        const i = (sy * w + sx) * 4;
        const a = src[i + 3] / 255;
        if (a < 0.03) continue;
        const r = src[i], g = src[i + 1], b = src[i + 2];

        let radius = maxR;
        if (halftone) {
          const l = luminance(r, g, b) / 255;
          // 面積が濃さに比例するよう平方根を取る
          radius *= Math.sqrt(brightOnDark ? l : 1 - l);
        }
        radius *= js;
        if (radius < 0.3) continue;

        ctx.globalAlpha = a;
        ctx.fillStyle = p.colorMode === 'ink' ? ink : `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(x + jx, y + jy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return out;
  },
};

export default dots;

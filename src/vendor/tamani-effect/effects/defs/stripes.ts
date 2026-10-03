import type { EffectDefinition } from '../../core/types';
import { cloneCanvas, createCanvas, get2d } from '../../core/canvas';

const stripes: EffectDefinition = {
  id: 'stripes',
  name: '縦縞・横縞',
  description: '線を等間隔に重ねます。間隔や太さをランダムにすると手描き風になります。',
  category: 'pattern',
  order: 2,
  params: [
    {
      key: 'direction',
      label: '向き',
      type: 'select',
      default: 'vertical',
      options: [
        { value: 'vertical', label: '縦縞' },
        { value: 'horizontal', label: '横縞' },
        { value: 'cross', label: 'チェック（縦＋横）' },
      ],
    },
    {
      key: 'lineColor',
      label: '線の色',
      type: 'select',
      default: 'black',
      options: [
        { value: 'black', label: '黒線' },
        { value: 'white', label: '白線' },
        { value: 'custom', label: 'カスタム' },
      ],
    },
    { key: 'color', label: 'カスタム色', type: 'color', default: '#ff6fa5', visibleWhen: (p) => p.lineColor === 'custom' },
    { key: 'interval', label: '間隔', type: 'range', min: 4, max: 200, step: 1, default: 24 },
    { key: 'thickness', label: '太さ', type: 'range', min: 1, max: 100, step: 1, default: 4 },
    { key: 'randomness', label: 'ランダム性', type: 'range', min: 0, max: 100, step: 1, default: 0, unit: '%', hint: '間隔と太さをばらつかせます' },
    { key: 'clip', label: '透明部分には描かない', type: 'boolean', default: true },
    { key: 'seed', label: 'ランダム', type: 'seed', default: 1 },
  ],
  render(input, p, env) {
    const { width: w, height: h, unit, rng } = env;
    const lines = createCanvas(w, h);
    const lctx = get2d(lines);
    lctx.fillStyle = p.lineColor === 'black' ? '#000' : p.lineColor === 'white' ? '#fff' : (p.color as string);

    const interval = Math.max(1, (p.interval as number) * unit);
    const thickness = Math.max(0.5, (p.thickness as number) * unit);
    const rand = (p.randomness as number) / 100;

    const drawSet = (vertical: boolean) => {
      const length = vertical ? w : h;
      let pos = (rng() - 0.5) * interval * rand;
      while (pos < length) {
        const t = Math.max(0.3, thickness * (1 + (rng() - 0.5) * rand * 1.6));
        if (vertical) lctx.fillRect(pos, 0, t, h);
        else lctx.fillRect(0, pos, w, t);
        pos += Math.max(t + 0.5, interval * (1 + (rng() - 0.5) * rand * 1.6));
      }
    };
    if (p.direction === 'vertical' || p.direction === 'cross') drawSet(true);
    if (p.direction === 'horizontal' || p.direction === 'cross') drawSet(false);

    if (p.clip) {
      lctx.globalCompositeOperation = 'destination-in';
      lctx.drawImage(input, 0, 0);
    }
    const out = cloneCanvas(input);
    get2d(out).drawImage(lines, 0, 0);
    return out;
  },
};

export default stripes;

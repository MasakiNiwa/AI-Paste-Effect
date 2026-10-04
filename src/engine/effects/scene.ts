/**
 * 演出プリセット（複合エフェクト）。
 * 「びっくり」「どんより」などの感情を 1 つ置くだけで、既存のエフェクトと漫画素材を組み合わせて描く。
 * 位置は顔の中心と顔の大きさを基準にした「顔単位」で決めるので、画像の大きさに依らず収まりがよい。
 */
import { normalizeParams, p, type ParamSchema, type Point } from '../params';
import { defineEffect, type EffectContext, type EffectDefinition } from '../types';
import { illustrationOverlay } from './illustration';
import { focusLines } from './manga';
import { bokeh, sparkle } from './particle';
import { burst, gloomLines, soundText } from './reaction';
import { gradient } from './color';
import { ctx2d } from './util';

type Step = {
  // 型の違うエフェクトをまとめて扱うため any で受ける
  effect: EffectDefinition<any>;
  params: Record<string, unknown>;
  alpha?: number;
  blend?: GlobalCompositeOperation;
};

const KINDS = ['surprise', 'shock', 'gloom', 'awkward', 'love', 'joy', 'comedy', 'anger', 'drama', 'confused'] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABELS: Record<Kind, string> = {
  surprise: 'びっくり',
  shock: 'ガーン（ショック）',
  gloom: 'どんより（落ち込み）',
  awkward: '静かな気まずさ',
  love: '恋・ときめき',
  joy: '喜び・わーい',
  comedy: 'コミカル',
  anger: '怒り・ぷんすか',
  drama: '大袈裟なドラマ',
  confused: '混乱・目が回る',
};

/** AI 向けに、各プリセットが何をどこに描くかを書いておく（個別素材と重ならないように） */
const KIND_CONTENTS: Record<Kind, string> = {
  surprise: '顔の周りの黒い集中線、頭上に驚き線 3 本、印側の斜め上に「!!」',
  shock: '上から暗い青のグラデーションと青い縦線、印側の頭の横に稲妻',
  gloom: '上から垂れる縦線、体のあたりに黒いモヤ、頭上に雨雲',
  awkward: '上から薄い縦線、印側の頭の横に大きな汗、その斜め上に「…」',
  love: '顔の周りに花の輪、全体に淡い玉ボケ、印側の斜め上にハート 3 つ',
  joy: '全体にキラキラ、印側の斜め上に星の集まり、反対側の斜め上に花',
  comedy: '印側の斜め上にポンッの星、反対側に汗 3 つ、反対側の下にヒュッの線',
  anger: '顔の周りの赤い集中線、印側の頭の上に怒りマーク、頭上に湯気',
  drama: '周囲を黒く塗るベタフラッシュ、白い集中線、体の周りに衝撃の輪',
  confused: '頭上を回る星、印側の頭の横に「?」、反対側に汗',
};

interface Geo {
  /** 顔の中心から、顔単位 (dx, dy) ずらした正規化座標 */
  at(dx: number, dy: number): Point;
  /** 顔単位 → 短辺比 */
  u(k: number): number;
  /** 顔単位 → 画像幅比・高さ比（楕円の半径用） */
  rx(k: number): number;
  ry(k: number): number;
  /** 印を置く側（+1 = 右, -1 = 左） */
  side: number;
}

const asset = (id: string, pos: Point, size: number, extra: Record<string, unknown> = {}): Step => ({
  effect: illustrationOverlay,
  params: { asset: id, position: pos, size, ...extra },
});

function recipe(kind: Kind, g: Geo, I: number): Step[] {
  const s = g.side;
  switch (kind) {
    case 'surprise':
      return [
        { effect: focusLines, params: { center: g.at(0, 0), innerRx: g.rx(1.5), innerRy: g.ry(1.7), count: 150, thickness: 0.006 }, alpha: 0.75 * I },
        asset('shock/lines3', g.at(0.15 * s, -1.3), g.u(0.9), { angle: s * 8 }),
        asset('shock/exclaim', g.at(1.4 * s, -0.7), g.u(0.75), { angle: s * 14 }),
      ];
    case 'shock':
      return [
        { effect: gradient, params: { type: 'linear', from: g.at(0, -2.2), to: g.at(0, 0.6), colors: ['#1b2550cc', '#1b255000'] }, alpha: 0.55 * I, blend: 'multiply' as const },
        asset('gloom/blueLines', g.at(0, -0.8), g.u(3.2)),
        asset('shock/crack', g.at(1.15 * s, -0.95), g.u(0.85), { angle: s * 10, flipX: s < 0 }),
      ];
    case 'gloom':
      return [
        { effect: gloomLines, params: { count: 50, length: 0.55, color: '#1d1f3a', shade: 0.4 }, alpha: 0.8 * I, blend: 'multiply' as const },
        asset('gloom/darkAura', g.at(0, 0.4), g.u(2.6)),
        asset('gloom/rainCloud', g.at(0.1 * s, -1.45), g.u(1.1)),
      ].map((x, i) => (i === 1 ? { ...x, alpha: 0.5 * I, blend: 'multiply' as const } : x));
    case 'awkward':
      return [
        { effect: gloomLines, params: { count: 26, length: 0.35, color: '#4a5170', shade: 0.15, thickness: 0.003 }, alpha: 0.4 * I, blend: 'multiply' as const },
        asset('comedy/sweatBig', g.at(1.0 * s, -0.5), g.u(0.6), { angle: s * -12, flipX: s < 0 }),
        { effect: soundText, params: { text: '…', font: 'pop', position: g.at(1.5 * s, -1.05), size: g.u(0.5), angle: 0, jitter: 0.2, color: '#3a3f55' } },
      ];
    case 'love':
      return [
        asset('love/flowerRing', g.at(0, 0.1), g.u(2.8)),
        { effect: bokeh, params: { count: 18, size: g.u(0.12), colors: ['#ffb3c9', '#ffe1ea', '#fff3b0'], intensity: 0.55 }, alpha: 0.8 * I, blend: 'screen' as const },
        asset('love/heartsTrio', g.at(1.2 * s, -0.9), g.u(0.85), { flipX: s < 0 }),
      ];
    case 'joy':
      return [
        { effect: sparkle, params: { count: 26, size: g.u(0.1), colors: ['#ffffff', '#fff3b0'] }, alpha: 0.9 * I, blend: 'screen' as const },
        asset('joy/sparkleStars', g.at(1.25 * s, -0.95), g.u(0.9)),
        asset('joy/flowerPop', g.at(-1.2 * s, -0.75), g.u(0.75)),
      ];
    case 'comedy':
      return [
        asset('shock/starPop', g.at(1.25 * s, -0.85), g.u(0.75), { angle: s * 15 }),
        asset('comedy/sweatTrio', g.at(-1.05 * s, -0.55), g.u(0.6), { flipX: s > 0 }),
        asset('motion/whoosh', g.at(-1.6 * s, 0.5), g.u(0.9), { flipX: s > 0, angle: s * -10 }),
      ];
    case 'anger':
      return [
        { effect: focusLines, params: { center: g.at(0, 0), innerRx: g.rx(1.6), innerRy: g.ry(1.8), count: 110, thickness: 0.007, color: '#b8202a' }, alpha: 0.55 * I },
        asset('comedy/angerBig', g.at(0.9 * s, -0.85), g.u(0.65)),
        asset('comedy/steam', g.at(0, -1.45), g.u(1)),
      ];
    case 'drama':
      return [
        { effect: burst, params: { style: 'beta', center: g.at(0, 0.2), innerRx: g.rx(1.6), innerRy: g.ry(1.9), spikes: 140, length: g.u(1.8) }, alpha: 0.85 * I },
        { effect: focusLines, params: { center: g.at(0, 0.2), innerRx: g.rx(1.75), innerRy: g.ry(2), count: 180, thickness: 0.008, color: '#ffffff' }, alpha: 0.7 * I },
        asset('motion/impactRing', g.at(0, 0.3), g.u(4.4), { color: '#ffffff', accent: '#ffffff' }),
      ].map((x, i) => (i === 2 ? { ...x, alpha: 0.3 * I } : x));
    case 'confused':
      return [
        asset('comedy/dizzy', g.at(0, -0.95), g.u(1.7)),
        asset('comedy/questionBig', g.at(1.35 * s, -0.75), g.u(0.7), { angle: s * 12 }),
        asset('comedy/sweatTrio', g.at(-1.1 * s, -0.4), g.u(0.45)),
      ];
  }
}

async function renderStep(ctx: EffectContext, step: Step): Promise<HTMLCanvasElement> {
  const values = normalizeParams(step.effect.params as ParamSchema, step.params, '', () => {});
  return step.effect.render(ctx, values);
}

export const reactionScene = defineEffect({
  id: 'reactionScene',
  label: '演出プリセット',
  category: 'illustration',
  kind: 'overlay',
  defaultBlend: 'normal',
  description: `感情や場面を 1 つ選ぶだけで、集中線・縦線・漫画素材・描き文字などを組み合わせた定番の漫画演出を描く。kind ごとの中身（顔単位 = faceSize。「印側」は side の側）: ${KINDS.map((k) => `${k}（${KIND_LABELS[k]}）= ${KIND_CONTENTS[k]}`).join(' / ')}。face は顔の中心、faceSize は顔の大きさ（短辺比）。印は side の側（auto なら余白の広い側）に置く。細かく作り込みたい時は、これを使わずに個別のエフェクトを組み合わせてもよい。`,
  params: {
    kind: p.enum(KINDS, 'surprise', '演出の種類'),
    face: p.point(0.5, 0.35, '顔の中心'),
    faceSize: p.num(0.05, 0.8, 0.22, '顔の大きさ（短辺比。顔の幅くらい）'),
    side: p.enum(['auto', 'left', 'right'] as const, 'auto', '漫画の印を置く側'),
    intensity: p.num(0, 1, 0.8, '強さ'),
  },
  async render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const side = v.side === 'left' ? -1 : v.side === 'right' ? 1 : v.face.x <= 0.5 ? 1 : -1;
    const k = v.faceSize; // 顔単位（短辺比）
    const geo: Geo = {
      at: (dx, dy) => ({ x: v.face.x + (dx * k * short) / W, y: v.face.y + (dy * k * short) / H }),
      u: (n) => n * k,
      rx: (n) => (n * k * short) / W,
      ry: (n) => (n * k * short) / H,
      side,
    };
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    for (const step of recipe(v.kind, geo, v.intensity)) {
      const c = await renderStep(ctx, step);
      g.globalAlpha = Math.max(0, Math.min(1, step.alpha ?? v.intensity));
      g.globalCompositeOperation = step.blend ?? 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(c, 0, 0);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return out;
  },
});

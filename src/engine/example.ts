/** プロンプト内の記入例、およびアプリの「サンプルを試す」に使う演出プラン */
export const EXAMPLE_PLAN = {
  format: 'ai-paste-effect',
  version: 1,
  title: '夏の終わりの静かな逆光',
  intent: 'キャラクターの表情は保ったまま、背景と光でセンチメンタルさを足す',
  analysis: {
    subject: '画面中央やや左に少女が1人',
    faces: [{ x: 0.46, y: 0.32 }],
    light: '右上からの逆光',
    openArea: '右上の空',
  },
  protect: [{ shape: 'ellipse', cx: 0.46, cy: 0.32, rx: 0.12, ry: 0.1, feather: 0.5, strength: 0.8 }],
  blocks: [
    {
      id: 'mood-color',
      purpose: '全体を夕方寄りの柔らかい色に統一',
      layers: [
        { effect: 'gradientMap', opacity: 0.3, blend: 'soft-light', params: { colors: ['#2b2350', '#d9788f', '#ffe3c2'] } },
        { effect: 'gradient', opacity: 0.6, blend: 'soft-light', params: { type: 'linear', from: { x: 0.9, y: 0 }, to: { x: 0.2, y: 0.9 }, colors: ['#ffb36b', '#6b7cff00'] } },
      ],
    },
    {
      id: 'backlight',
      purpose: '右上からの逆光と空気の光',
      layers: [
        { effect: 'lightSpot', opacity: 0.8, params: { center: { x: 0.92, y: 0.05 }, radius: 0.7, color: '#ffe2b0', intensity: 0.7 } },
        { effect: 'lightRays', opacity: 0.6, params: { origin: { x: 0.95, y: -0.05 }, direction: 125, spread: 40, count: 6, color: '#fff1d0' } },
        { effect: 'bloom', params: { threshold: 0.6, intensity: 0.8 } },
      ],
    },
    {
      id: 'air',
      purpose: '光の粒で空気感',
      region: { shape: 'ellipse', cx: 0.75, cy: 0.3, rx: 0.4, ry: 0.4, feather: 0.8 },
      layers: [{ effect: 'particles', params: { shape: 'dot', count: 80, size: 0.006, colors: ['#fff6dd'], opacity: 0.7 } }],
    },
    {
      id: 'finish',
      purpose: '仕上げの質感と視線誘導',
      layers: [
        { effect: 'vignette', opacity: 0.6, params: { center: { x: 0.46, y: 0.4 }, size: 0.7, strength: 0.5, color: '#2a1a3a' } },
        { effect: 'filmGrain', protect: false, params: { amount: 0.12 } },
      ],
    },
  ],
} as const;

export const EXAMPLE_PLAN_TEXT = JSON.stringify(EXAMPLE_PLAN, null, 2);

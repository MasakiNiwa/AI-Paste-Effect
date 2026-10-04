#!/usr/bin/env node
/**
 * 漫画素材パック v1 の SVG を生成するスクリプト。
 *
 *   node scripts/gen-manga-assets.mjs
 *
 * src/assets/manga/svg/*.svg と src/assets/manga/manifest.json を書き出す。
 * 手描きらしさは、シード付き乱数で線を揺らしたブラシ形状で出している。
 * 生成物は普通の SVG ファイルなので、将来イラストレーターが描いた SVG に差し替えてもよい
 * （その場合は manifest.json の author / license を更新すること）。
 *
 * 色の差し替え用に、主色は "__C1__"、副色は "__C2__" と書いておく（アプリ側で置換する）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/assets/manga/', import.meta.url);
mkdirSync(new URL('svg/', OUT), { recursive: true });

// ---- 乱数と幾何ヘルパー -----------------------------------------------------

let seed = 1;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const J = (a) => (rnd() - 0.5) * 2 * a;
const f = (n) => Math.round(n * 10) / 10;
const C1 = '__C1__';
const C2 = '__C2__';

/** 点列を通るなめらかな閉じた/開いたパス（Catmull-Rom → 3 次ベジェ） */
function smooth(pts, closed = true) {
  const n = pts.length;
  const at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

/** 折れ線（尖った角を残す） */
const poly = (pts) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

/** 入り抜きのあるブラシの一筆（a → b、bend で弓なり、w が最大の太さ） */
function brush(a, b, w, bend = 0, taperIn = 1, taperOut = 1) {
  const [x0, y0] = a, [x1, y1] = b;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = (x0 + x1) / 2 + nx * bend, cy = (y0 + y1) / 2 + ny * bend;
  const left = [], right = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const tx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const px = -ty / tl, py = tx / tl;
    const env = Math.min(1, t / (0.35 * taperIn + 1e-6), (1 - t) / (0.35 * taperOut + 1e-6));
    const hw = (w / 2) * Math.max(0.04, Math.sqrt(Math.max(0, env))) * (1 + J(0.035));
    left.push([x + px * hw, y + py * hw]);
    right.push([x - px * hw, y - py * hw]);
  }
  return smooth([...left, ...right.reverse()]);
}

/** ギザギザの星形（爆発・吹き出し） */
function spiky(cx, cy, n, rOut, rIn, jit = 0.12) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + J(0.06);
    const r = (i % 2 === 0 ? rOut : rIn) * (1 + J(jit));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

/** もこもこ（雲・煙）。円周上にこぶを並べた輪郭 */
function puffy(cx, cy, rx, ry, bumps = 9, depth = 0.18) {
  const pts = [];
  const N = bumps * 6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const k = 1 + depth * Math.abs(Math.sin((a * bumps) / 2)) + J(0.025);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts);
}

/** しずく */
function drop(cx, cy, s) {
  const pts = [
    [cx + J(1), cy - 1.0 * s],
    [cx + 0.35 * s, cy - 0.35 * s],
    [cx + 0.62 * s, cy + 0.25 * s],
    [cx + 0.45 * s, cy + 0.72 * s],
    [cx, cy + 0.9 * s],
    [cx - 0.45 * s, cy + 0.72 * s],
    [cx - 0.62 * s, cy + 0.25 * s],
    [cx - 0.35 * s, cy - 0.35 * s],
  ].map(([x, y], i) => (i === 0 ? [x, y] : [x + J(s * 0.03), y + J(s * 0.03)]));
  return smooth(pts);
}

/** ハート */
function heart(cx, cy, s) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x / 17) * s + J(s * 0.02), cy + (y / 17) * s + J(s * 0.02)]);
  }
  return smooth(pts);
}

/** 4 方向のきらめき */
function sparkle(cx, cy, s) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? s : s * 0.22;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return smooth(pts);
}

/** 5 枚花びらの花 */
function flower(cx, cy, s, petals = 5) {
  const pts = [];
  const N = petals * 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = s * (0.55 + 0.45 * Math.abs(Math.cos((a * petals) / 2))) * (1 + J(0.03));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return smooth(pts);
}

const fill = (d, c, extra = '') => `<path d="${d}" fill="${c}"${extra}/>`;
const outlined = (d, fc, sc, sw = 5) =>
  `<path d="${d}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke"/>`;
const stroked = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---- 素材定義 ----------------------------------------------------------------

/**
 * label: 一言説明（AI 向けカタログにもそのまま載る）
 * colors: [主色, 副色] の既定値
 * size: 推奨の大きさ（短辺比）
 */
const ASSETS = [
  // 驚き・衝撃
  { id: 'shock/burstWhite', label: '白いギザギザの爆発形（衝撃・叫びの背景。キャラの後ろに大きく）', tags: ['shock', 'surprise'], colors: ['#111111', '#ffffff'], size: 0.6,
    draw: () => outlined(spiky(100, 100, 17, 92, 62, 0.14), C2, C1, 4) },
  { id: 'shock/lines3', label: '頭の上に置く 3 本の太い驚き線', tags: ['shock', 'surprise'], colors: ['#111111', '#ffffff'], size: 0.18,
    draw: () => [brush([62, 170], [28, 52], 20, 6), brush([100, 160], [100, 28], 22, J(4)), brush([138, 170], [172, 52], 20, -6)].map((d) => outlined(d, C1, C2, 6)).join('') },
  { id: 'shock/exclaim', label: '手描きの「!!」', tags: ['shock', 'surprise'], colors: ['#111111', '#ffffff'], size: 0.16,
    draw: () => [brush([72, 28], [62, 130], 30, 0, 0.2, 1), brush([132, 28], [122, 130], 30, 0, 0.2, 1)].map((d) => outlined(d, C1, C2, 8)).join('') +
      outlined(smooth([[58, 152], [70, 148], [72, 166], [58, 170]]), C1, C2, 8) + outlined(smooth([[118, 152], [130, 148], [132, 166], [118, 170]]), C1, C2, 8) },
  { id: 'shock/spikyBalloon', label: 'トゲトゲの叫び吹き出し（中は空。描き文字と重ねる）', tags: ['shock', 'shout'], colors: ['#111111', '#ffffff'], size: 0.35,
    draw: () => outlined(spiky(100, 100, 24, 94, 76, 0.07), C2, C1, 4) },
  { id: 'shock/crack', label: '「ガーン」の稲妻・ひび（頭の上や横）', tags: ['shock', 'gloom'], colors: ['#ffe14d', '#222222'], size: 0.25,
    draw: () => outlined(poly([[92, 6], [130, 6], [104, 70], [138, 70], [64, 194], [86, 104], [56, 104]].map(([x, y]) => [x + J(3), y + J(3)])), C1, C2, 6) },
  { id: 'shock/starPop', label: 'コミカルな衝撃の星（ポンッ・ぶつかった時）', tags: ['shock', 'comedy'], colors: ['#ffd23f', '#222222'], size: 0.2,
    draw: () => outlined(spiky(100, 100, 5, 70, 32, 0.1), C1, C2, 6) +
      [[100, 10, 100, 0], [178, 70, 194, 64], [160, 168, 172, 182], [40, 168, 28, 182], [22, 70, 6, 64]].map(([x0, y0, x1, y1]) => stroked(`M${x0} ${y0}L${x1} ${y1}`, C2, 6)).join('') },

  // 落ち込み・不穏
  { id: 'gloom/darkAura', label: '黒いモヤ・どす黒いオーラ（キャラの後ろや周り）', tags: ['gloom', 'dark'], colors: ['#241c38', '#4b3d6e'], size: 0.6,
    draw: () => `<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs><g filter="url(#b)">` +
      Array.from({ length: 7 }, (_, i) => fill(brush([40 + i * 20 + J(6), 190], [30 + i * 22 + J(14), 30 + J(20)], 34 + J(8), J(30)), i % 2 ? C2 : C1, ' opacity="0.85"')).join('') + '</g>' },
  { id: 'gloom/spiritWisp', label: '口から抜ける魂（脱力・放心）', tags: ['gloom', 'comedy'], colors: ['#6a7ea8', '#ffffff'], size: 0.22,
    draw: () => outlined(smooth([[60, 150], [40, 110], [60, 70], [100, 55], [140, 70], [150, 110], [130, 140], [160, 175], [175, 195], [120, 170]]), C2, C1, 5) +
      fill(smooth([[78, 100], [86, 96], [88, 108], [80, 110]]), C1) + fill(smooth([[112, 100], [120, 96], [122, 108], [114, 110]]), C1) },
  { id: 'gloom/rainCloud', label: '頭上の小さな雨雲（しょんぼり）', tags: ['gloom', 'sad'], colors: ['#5d6678', '#7fa6d8'], size: 0.25,
    draw: () => outlined(puffy(100, 70, 72, 38, 7, 0.22), C1, '#3d4452', 4) +
      Array.from({ length: 6 }, (_, i) => fill(brush([48 + i * 21, 122], [40 + i * 21 + J(3), 178 + J(10)], 6), C2)).join('') },
  { id: 'gloom/blueLines', label: '青い縦線の「ガーン」背景（キャラの頭上〜背景に幅広く大きく置く。上下の端は自然に消える）', tags: ['gloom', 'shock'], colors: ['#25305a', '#25305a'], size: 0.6,
    draw: () => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C1}" stop-opacity="0"/><stop offset="0.22" stop-color="${C1}" stop-opacity="1"/><stop offset="0.5" stop-color="${C1}" stop-opacity="0.85"/><stop offset="1" stop-color="${C1}" stop-opacity="0"/></linearGradient></defs>` +
      Array.from({ length: 34 }, (_, i) => fill(brush([3 + i * 5.8 + J(1.5), 0], [3 + i * 5.8 + J(2), 120 + J(70)], 2.6 + J(1), 0, 0.01, 1), 'url(#g)')).join('') },

  // コミカル
  { id: 'comedy/sweatBig', label: '大きな汗（焦り・気まずさ。頭の横に）', tags: ['comedy', 'awkward'], colors: ['#bfe6ff', '#2f6db0'], size: 0.2,
    draw: () => outlined(drop(100, 98, 88), C1, C2, 6) + fill(smooth([[70, 118], [76, 112], [82, 140], [74, 150]]), '#ffffff', ' opacity="0.9"') },
  { id: 'comedy/sweatTrio', label: '小さな汗が 3 つ（あせあせ）', tags: ['comedy', 'awkward'], colors: ['#bfe6ff', '#2f6db0'], size: 0.18,
    draw: () => [[60, 110, 34], [110, 70, 40], [150, 130, 28]].map(([x, y, s]) => outlined(drop(x, y, s), C1, C2, 4)).join('') },
  { id: 'comedy/angerBig', label: '大きな怒りマーク（ムカッ）', tags: ['comedy', 'anger'], colors: ['#e43b3b', '#ffffff'], size: 0.18,
    draw: () => [0, 90, 180, 270].map((deg) => `<g transform="rotate(${deg + J(5)} 100 100)">${outlined(brush([114, 38], [162, 86], 22, 20, 0.5, 0.5), C1, C2, 6)}</g>`).join('') },
  { id: 'comedy/steam', label: '頭から出る湯気（ぷんすか・照れ）', tags: ['comedy', 'anger', 'love'], colors: ['#444444', '#ffffff'], size: 0.22,
    draw: () => [[60, 120, 34], [104, 76, 40], [148, 118, 30]].map(([x, y, r]) => outlined(puffy(x, y, r, r * 0.8, 6, 0.25), C2, C1, 4)).join('') +
      [[60, 180, 64, 160], [100, 186, 104, 160], [140, 180, 144, 160]].map(([x0, y0, x1, y1]) => stroked(`M${x0} ${y0}L${x1} ${y1}`, C1, 5)).join('') },
  { id: 'comedy/dizzy', label: '頭の周りを回る星（目が回る・ぐるぐる）', tags: ['comedy', 'confused'], colors: ['#ffcf3a', '#333333'], size: 0.3,
    draw: () => stroked(smooth(Array.from({ length: 16 }, (_, i) => [100 + Math.cos((i / 16) * Math.PI * 2) * 86, 100 + Math.sin((i / 16) * Math.PI * 2) * 32])), C2, 3) +
      [[20, 100], [100, 132], [176, 96]].map(([x, y]) => outlined(spiky(x, y, 5, 20, 9, 0.05), C1, C2, 3)).join('') },
  { id: 'comedy/questionBig', label: '大きな「?」（困惑・はてな）', tags: ['comedy', 'confused'], colors: ['#111111', '#ffffff'], size: 0.18,
    draw: () => {
      const q = smooth([[62, 66], [70, 30], [110, 20], [140, 44], [134, 80], [104, 100], [100, 126]], false);
      return stroked(q, C2, 36) + stroked(q, C1, 22) + outlined(smooth([[92, 150], [108, 148], [110, 168], [92, 170]]), C1, C2, 8);
    } },

  // 恋・ときめき
  { id: 'love/heartsTrio', label: 'ハートが 3 つ（好き・ときめき）', tags: ['love'], colors: ['#ff6f9c', '#ffffff'], size: 0.25,
    draw: () => [[64, 112, 46], [130, 76, 36], [146, 150, 26]].map(([x, y, s]) => outlined(heart(x, y, s), C1, C2, 5)).join('') },
  { id: 'love/heartPound', label: 'ドキッとするハートと衝撃線', tags: ['love', 'surprise'], colors: ['#ff4f86', '#ffffff'], size: 0.22,
    draw: () => outlined(heart(100, 108, 58), C1, C2, 6) +
      [[-60, 150], [-20, 120], [20, 120], [60, 150]].map(([dx, deg]) => fill(brush([100 + dx * 0.9, 60 - Math.abs(dx) * 0.4], [100 + dx * 1.45, 20 - Math.abs(dx) * 0.1], 9), C1)).join('') },
  { id: 'love/flowerRing', label: '少女漫画の花の輪（キャラの後ろに。恋・幸せ・美化）', tags: ['love', 'joy'], colors: ['#ffc9da', '#e27c9e'], size: 0.6,
    draw: () => Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + J(0.08);
      const x = 100 + Math.cos(a) * 74, y = 100 + Math.sin(a) * 74, s = 18 + J(5);
      return outlined(flower(x, y, s), C1, C2, 3) + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.25)}" fill="#ffe27a"/>`;
    }).join('') },
  { id: 'love/bubbles', label: 'ふわふわ浮かぶ泡（夢見心地）', tags: ['love', 'joy', 'calm'], colors: ['#ffffff', '#ffffff'], size: 0.4,
    draw: () => Array.from({ length: 9 }, () => {
      const x = 20 + rnd() * 160, y = 20 + rnd() * 160, r = 8 + rnd() * 18;
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${C1}" stroke-width="3" opacity="0.9"/><circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.18)}" fill="${C2}"/>`;
    }).join('') },

  // 喜び
  { id: 'joy/sparkleStars', label: 'キラキラした星の集まり（嬉しい・輝く）', tags: ['joy'], colors: ['#fff3a6', '#ffbf2e'], size: 0.3,
    draw: () => [[60, 70, 44], [140, 60, 30], [120, 140, 36], [50, 150, 20], [170, 120, 16]].map(([x, y, s]) => outlined(sparkle(x, y, s), C1, C2, 3)).join('') },
  { id: 'joy/flowerPop', label: 'ポンポン咲く花（わーい・うれしい）', tags: ['joy', 'comedy'], colors: ['#ffd84d', '#ff8a3d'], size: 0.3,
    draw: () => [[60, 80, 30], [140, 70, 24], [110, 146, 28]].map(([x, y, s]) => outlined(flower(x, y, s, 6), C1, C2, 4) + `<circle cx="${x}" cy="${y}" r="${f(s * 0.3)}" fill="${C2}"/>`).join('') +
      [[30, 140], [170, 150], [100, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C2}"/>`).join('') },
  { id: 'joy/notes', label: '音符（ご機嫌・歌う）', tags: ['joy'], colors: ['#222222', '#ffffff'], size: 0.25,
    draw: () => [[60, 130, -10], [130, 100, 8], [100, 170, -4]].map(([x, y, r]) =>
      `<g transform="rotate(${r} ${x} ${y})">${outlined(smooth([[x - 22, y + 2], [x - 6, y - 12], [x + 8, y - 2], [x - 8, y + 12]]), C1, C2, 4)}${outlined(brush([x + 4, y - 2], [x + 4, y - 70], 8, 0, 0.1, 0.1), C1, C2, 4)}${outlined(brush([x + 4, y - 70], [x + 30, y - 46], 9, -8), C1, C2, 4)}</g>`).join('') },

  // 勢い・動き
  { id: 'motion/whoosh', label: 'ヒュッと動く弧の線（振り向き・素早い動き）', tags: ['motion'], colors: ['#222222', '#ffffff'], size: 0.35,
    draw: () => [[20, 60, 180, 40, -30], [30, 110, 175, 100, -24], [45, 155, 165, 150, -18]].map(([x0, y0, x1, y1, b]) => outlined(brush([x0, y0], [x1, y1], 12, b, 1, 0.3), C1, C2, 4)).join('') },
  { id: 'motion/impactRing', label: 'ドンッという衝撃の輪と破片（着地・パンチ）', tags: ['motion', 'shock'], colors: ['#222222', '#ffffff'], size: 0.4,
    draw: () => stroked(spiky(100, 100, 14, 86, 74, 0.05), C1, 6) + stroked(spiky(100, 100, 10, 54, 44, 0.06), C1, 4) +
      Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + J(0.2); return outlined(poly([[100 + Math.cos(a) * 92, 100 + Math.sin(a) * 92], [100 + Math.cos(a + 0.08) * 99, 100 + Math.sin(a + 0.08) * 99], [100 + Math.cos(a) * 106, 100 + Math.sin(a) * 106]]), C1, C2, 2); }).join('') },
  { id: 'motion/dustCloud', label: '足元の土煙（ズザーッ・急停止・ダッシュ）', tags: ['motion', 'comedy'], colors: ['#8a7f70', '#efe8dc'], size: 0.35,
    draw: () => [[50, 140, 36], [100, 128, 44], [150, 142, 32], [76, 104, 24], [128, 100, 22]].map(([x, y, r]) => outlined(puffy(x, y, r, r * 0.8, 6, 0.2), C2, C1, 4)).join('') },
];

// ---- 線画セット（同じ意味の別の絵の見本） --------------------------------
// 素材セットの切り替えを試せるよう、いくつかの素材を「細い線だけ」の絵柄でも用意する。
const line = (d, c, w = 4) => stroked(d, c, w);
const LINE_ASSETS = [
  { id: 'shock/lines3', label: '頭の上の驚き線 3 本（細い線画）', colors: ['#222222', '#ffffff'], size: 0.18,
    draw: () => [[62, 170, 32, 56], [100, 160, 100, 30], [138, 170, 168, 56]].map(([a, b, c, d]) => line(`M${a} ${b}Q${(a + c) / 2 + J(6)} ${(b + d) / 2} ${c} ${d}`, C1, 6)).join('') },
  { id: 'shock/exclaim', label: '「!!」（細い線画）', colors: ['#222222', '#ffffff'], size: 0.16,
    draw: () => [[72, 62], [132, 122]].map(([x0, x1]) => line(`M${x0} 26L${x0 - 6} 128`, C1, 9) + `<circle cx="${x0 - 8}" cy="160" r="7" fill="${C1}"/>`).join('') },
  { id: 'comedy/sweatBig', label: '大きな汗（細い線画）', colors: ['#2f6db0', '#ffffff'], size: 0.2,
    draw: () => line(drop(100, 98, 86), C1, 5) + line('M72 120Q70 140 84 150', C1, 4) },
  { id: 'comedy/angerBig', label: '怒りマーク（細い線画）', colors: ['#e43b3b', '#ffffff'], size: 0.18,
    draw: () => [0, 90, 180, 270].map((deg) => `<g transform="rotate(${deg} 100 100)">${line('M116 40Q122 80 160 86', C1, 9)}</g>`).join('') },
  { id: 'love/heartsTrio', label: 'ハートが 3 つ（細い線画）', colors: ['#ff4f86', '#ffffff'], size: 0.25,
    draw: () => [[64, 112, 46], [130, 76, 36], [146, 150, 26]].map(([x, y, s]) => line(heart(x, y, s), C1, 5)).join('') },
  { id: 'joy/sparkleStars', label: 'キラキラ（細い線画）', colors: ['#ffbf2e', '#ffffff'], size: 0.3,
    draw: () => [[60, 70, 44], [140, 60, 30], [120, 140, 36], [50, 150, 20]].map(([x, y, s]) => line(sparkle(x, y, s), C1, 4)).join('') },
];

// ---- 出力 ------------------------------------------------------------------

function writePack(dir, packInfo, list, seedBase) {
  const out = new URL(`../${dir}/`, OUT);
  mkdirSync(new URL('svg/', out), { recursive: true });
  const manifest = [];
  list.forEach((a, i) => {
    seed = seedBase + i * 7919;
    const file = a.id.replace('/', '-') + '.svg';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">\n<!-- ${a.id} | ${packInfo.name} | ${packInfo.license} License | generated by scripts/gen-manga-assets.mjs -->\n${a.draw()}\n</svg>\n`;
    writeFileSync(new URL(`svg/${file}`, out), svg);
    manifest.push({ id: a.id, file, label: a.label, tags: a.tags ?? [a.id.split('/')[0]], colors: a.colors, size: a.size, license: packInfo.license, author: packInfo.author });
  });
  writeFileSync(new URL('manifest.json', out), JSON.stringify({ assets: manifest }, null, 2) + '\n');
  writeFileSync(new URL('pack.json', out), JSON.stringify(packInfo, null, 2) + '\n');
  console.log(`${dir}: wrote ${manifest.length} assets`);
}

writePack('manga', { name: '漫画素材パック v1', author: 'AI Paste Effect', license: 'MIT' }, ASSETS, 1000);
writePack('manga-line', { name: '線画セット', author: 'AI Paste Effect', license: 'MIT' }, LINE_ASSETS, 5000);

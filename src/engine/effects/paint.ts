/**
 * 絵の具・滲み。線や色がにじむ・絵の具で描いたような質感にする。
 */
import { css, sampleStops, type RGBA } from '../color';
import { p } from '../params';
import type { Rng } from '../random';
import { defineEffect, type EffectContext } from '../types';
import { ctx2d } from './util';

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** なめらかなノイズ（低解像度の乱数を拡大）。cells は短辺あたりのムラの数 */
function smoothNoise(ctx: EffectContext, rng: Rng, cells: number): Float32Array {
  const { width: W, height: H, short } = ctx;
  const w = Math.max(2, Math.round((W / short) * cells));
  const h = Math.max(2, Math.round((H / short) * cells));
  const small = ctx.createCanvas(w, h);
  const sg = ctx2d(small);
  const img = sg.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  const big = ctx.createCanvas();
  const bg = ctx2d(big);
  bg.imageSmoothingEnabled = true;
  bg.imageSmoothingQuality = 'high';
  bg.drawImage(small, 0, 0, W, H);
  const d = bg.getImageData(0, 0, W, H).data;
  const out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

async function blurCanvas(ctx: EffectContext, input: HTMLCanvasElement, radiusPx: number): Promise<Uint8ClampedArray> {
  const { KawaseBlurFilter } = await ctx.filters();
  const b = await ctx.applyFilters([new KawaseBlurFilter({ strength: Math.max(1, radiusPx / 2), quality: 6, clamp: true })], input);
  return ctx2d(b).getImageData(0, 0, ctx.width, ctx.height).data;
}

const lum = (d: Uint8ClampedArray, i: number) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;

export const inkBleed = defineEffect({
  id: 'inkBleed',
  label: 'インクの滲み',
  category: 'paint',
  kind: 'overlay',
  defaultBlend: 'multiply',
  description:
    '線や暗い部分から、絵の具が紙ににじみ広がったような滲みを足す。style: "ink"（墨・インク。縁が濃くたまる）/ "watercolor"（水彩。絵の色がにじみ、縁に色だまり）/ "oil"（油性。濃い芯の周りに黄ばんだ油の輪）/ "colorful"（虹色・カラフルなインク）。手描き感・余韻・アート感に。顔の線がにじみすぎないよう protect を使う。',
  params: {
    style: p.enum(['ink', 'watercolor', 'oil', 'colorful'] as const, 'ink', '滲みの種類'),
    threshold: p.num(0, 1, 0.35, 'この暗さより暗い部分（線）からにじむ（大きいほど広い範囲から）'),
    spread: p.num(0.002, 0.06, 0.012, 'にじむ距離（短辺比）'),
    roughness: p.num(0, 1, 0.6, '縁の不規則さ'),
    amount: p.num(0, 1, 0.7, '濃さ'),
    color: p.color('#1b1d33', 'インクの色（ink / oil）'),
    colors: p.colors(['#ff5e8a', '#ffb340', '#47c7ff', '#9b6bff'], 'カラフルの色（colorful）', 2, 6),
  },
  async render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const src = ctx2d(ctx.source).getImageData(0, 0, W, H).data;
    const n = W * H;

    // 1. にじみの元になる部分（暗い線。水彩では色の濃い部分も）
    const seed = ctx.createCanvas();
    const sg = ctx2d(seed);
    const si = sg.createImageData(W, H);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      const l = lum(src, k);
      let a = smooth(v.threshold, v.threshold - 0.25, l);
      if (v.style === 'watercolor') {
        const mx = Math.max(src[k], src[k + 1], src[k + 2]);
        const mn = Math.min(src[k], src[k + 1], src[k + 2]);
        a = Math.max(a, smooth(0.25, 0.7, (mx - mn) / 255) * 0.8);
      }
      si.data[k] = si.data[k + 1] = si.data[k + 2] = 255;
      si.data[k + 3] = a * 255;
    }
    sg.putImageData(si, 0, 0);

    // 2. ぼかして広げ、3. ノイズで縁を不規則にする
    const spreadPx = v.spread * short;
    const blurred = await blurCanvas(ctx, seed, spreadPx);
    const wide = v.style === 'oil' ? await blurCanvas(ctx, seed, spreadPx * 2.2) : null;
    const colorBlur = v.style === 'watercolor' ? await blurCanvas(ctx, ctx.source, spreadPx * 0.8) : null;
    const noise = smoothNoise(ctx, ctx.rng, Math.max(6, 0.25 / v.spread));
    const hueNoise = v.style === 'colorful' ? smoothNoise(ctx, ctx.rng, 3) : null;

    const out = ctx.createCanvas();
    const og = ctx2d(out);
    const img = og.createImageData(W, H);
    const d = img.data;
    const ink = v.color;
    const oilHalo: RGBA = { r: 205, g: 168, b: 92, a: 1 };
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      const b = blurred[k + 3] / 255;
      const core = si.data[k + 3] / 255;
      const edgeT = 0.12 + (noise[i] - 0.5) * v.roughness * 0.35;
      let a = smooth(edgeT, edgeT + 0.12, b);
      // 縁に絵の具がたまって濃くなる（にじみの外周ほど濃い）
      const rim = a * (1 - smooth(edgeT + 0.12, edgeT + 0.45, b));
      // 外側に薄く広がる「にじみの水たまり」（紙に染みていく部分）
      const wash = smooth(edgeT * 0.15, edgeT * 0.9, b) * (v.style === 'watercolor' ? 0.75 : 0.3);
      a = Math.max(core * 0.6, a * (0.55 + rim * 0.9), wash);
      let c: RGBA;
      if (v.style === 'ink') c = ink;
      else if (v.style === 'colorful') c = sampleStops(v.colors, hueNoise![i]);
      else if (v.style === 'watercolor') {
        // 絵の色を少し濃く・鮮やかにした色でにじむ
        const r = colorBlur![k], g = colorBlur![k + 1], bb = colorBlur![k + 2];
        const m = (r + g + bb) / 3;
        c = { r: Math.max(0, m + (r - m) * 1.6 - 10), g: Math.max(0, m + (g - m) * 1.6 - 10), b: Math.max(0, m + (bb - m) * 1.6 - 10), a: 1 };
      } else {
        // 油: 濃い芯 + 外側に黄ばんだ油の輪
        const halo = smooth(0.04, 0.2, wide![k + 3] / 255) * (1 - a);
        const t = a / Math.max(0.001, a + halo * 0.5);
        c = { r: ink.r * t + oilHalo.r * (1 - t), g: ink.g * t + oilHalo.g * (1 - t), b: ink.b * t + oilHalo.b * (1 - t), a: 1 };
        a = Math.max(a, halo * 0.45);
      }
      d[k] = c.r;
      d[k + 1] = c.g;
      d[k + 2] = c.b;
      d[k + 3] = Math.min(1, a * v.amount) * 255;
    }
    og.putImageData(img, 0, 0);
    return out;
  },
});

export const watercolor = defineEffect({
  id: 'watercolor',
  label: '水彩画',
  category: 'paint',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    '画像全体を水彩画のようにする: 色の境目をやわらかく、色ムラ（ブルーム）・縁の色だまり・紙の粒状感を足し、線画は残す。絵本・回想・やさしい雰囲気に。opacity を下げると質感だけ足せる。',
  params: {
    softness: p.num(0, 0.03, 0.006, '色のにじみ（短辺比）'),
    bloom: p.num(0, 1, 0.5, '色ムラ（絵の具のたまり・抜け）'),
    edgeDarken: p.num(0, 1, 0.5, '色の境目の色だまり'),
    granulation: p.num(0, 1, 0.25, '紙の粒状感'),
    keepLines: p.num(0, 1, 0.7, '元の線画を残す強さ'),
    paper: p.color('#f8f1e2', '紙の色'),
  },
  async render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const n = W * H;
    const src = ctx2d(ctx.source).getImageData(0, 0, W, H).data;
    const soft = await blurCanvas(ctx, ctx.source, Math.max(1, v.softness * short));
    const softer = await blurCanvas(ctx, ctx.source, Math.max(2, v.softness * short * 3 + short * 0.004));
    const blooms = smoothNoise(ctx, ctx.rng, 5);
    const fine = smoothNoise(ctx, ctx.rng, 55);
    const out = ctx.createCanvas();
    const og = ctx2d(out);
    const img = og.createImageData(W, H);
    const d = img.data;
    const pr = v.paper.r / 255, pg = v.paper.g / 255, pb = v.paper.b / 255;
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      // 絵の具の濃さを（1 - 色）として扱い、ムラ・色だまり・粒状感で変化させる
      const edge = Math.min(1, (Math.abs(soft[k] - softer[k]) + Math.abs(soft[k + 1] - softer[k + 1]) + Math.abs(soft[k + 2] - softer[k + 2])) / 120);
      const base = 1 - lum(soft, k);
      // 粒状感は中間調だけに（暗部に乗ると砂嵐のように見えるため）
      const grain = (fine[i] - 0.5) * v.granulation * 0.6 * Math.min(1, base * (1 - base) * 4);
      const density = (1 + (blooms[i] - 0.5) * v.bloom * 0.9) * (1 + edge * v.edgeDarken * 0.8) * (1 + grain);
      const line = smooth(0.45, 0.15, lum(src, k)) * v.keepLines;
      for (let c = 0; c < 3; c++) {
        const paperC = c === 0 ? pr : c === 1 ? pg : pb;
        let pig = (1 - soft[k + c] / 255) * density;
        pig = Math.min(1, Math.max(0, pig));
        let val = paperC * (1 - pig);
        // 線画を乗算で戻す
        val *= 1 - line * (1 - src[k + c] / 255);
        d[k + c] = val * 255;
      }
      d[k + 3] = src[k + 3];
    }
    og.putImageData(img, 0, 0);
    return out;
  },
});

/** クワハラフィルタ（4 つの小領域のうち、色のばらつきが一番小さい領域の平均色を使う）。積分画像で高速化 */
function kuwahara(data: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const W1 = w + 1;
  const S = [new Float32Array(W1 * (h + 1)), new Float32Array(W1 * (h + 1)), new Float32Array(W1 * (h + 1))];
  const Q = new Float32Array(W1 * (h + 1)); // 明るさの二乗和
  const L = new Float32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0, sl = 0, sq = 0;
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const l = data[k] * 0.299 + data[k + 1] * 0.587 + data[k + 2] * 0.114;
      sr += data[k]; sg += data[k + 1]; sb += data[k + 2]; sl += l; sq += l * l;
      const o = (y + 1) * W1 + x + 1, up = y * W1 + x + 1;
      S[0][o] = S[0][up] + sr; S[1][o] = S[1][up] + sg; S[2][o] = S[2][up] + sb;
      L[o] = L[up] + sl; Q[o] = Q[up] + sq;
    }
  }
  const sum = (A: Float32Array, x0: number, y0: number, x1: number, y1: number) => A[y1 * W1 + x1] - A[y0 * W1 + x1] - A[y1 * W1 + x0] + A[y0 * W1 + x0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity, br = 0, bg = 0, bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w, (q & 1 ? x + r : x) + 1);
        const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h, (q & 2 ? y + r : y) + 1);
        const cnt = (x1 - x0) * (y1 - y0);
        const m = sum(L, x0, y0, x1, y1) / cnt;
        const varc = sum(Q, x0, y0, x1, y1) / cnt - m * m;
        if (varc < best) {
          best = varc;
          br = sum(S[0], x0, y0, x1, y1) / cnt;
          bg = sum(S[1], x0, y0, x1, y1) / cnt;
          bb = sum(S[2], x0, y0, x1, y1) / cnt;
        }
      }
      const k = (y * w + x) * 4;
      out[k] = br; out[k + 1] = bg; out[k + 2] = bb; out[k + 3] = data[k + 3];
    }
  }
  return out;
}

export const oilPaint = defineEffect({
  id: 'oilPaint',
  label: '油彩画',
  category: 'paint',
  kind: 'filter',
  defaultBlend: 'normal',
  description:
    '画像全体を油絵のように、筆で塗った色面にする（クワハラフィルタ）。impasto で絵の具の盛り上がりの陰影を足す。重厚・クラシック・劇的な雰囲気に。顔は protect で守ると絵柄を保てる。',
  params: {
    brush: p.num(0.002, 0.03, 0.008, '筆の大きさ（短辺比）'),
    impasto: p.num(0, 1, 0.45, '絵の具の盛り上がり（陰影）'),
    saturation: p.num(0, 1, 0.2, '色の鮮やかさを足す'),
  },
  render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    // 重い処理なので、長辺 1200px 程度で計算して拡大する（筆の跡なので細部は不要）
    const scale = Math.min(1, 1200 / Math.max(W, H));
    const w = Math.max(8, Math.round(W * scale));
    const h = Math.max(8, Math.round(H * scale));
    const work = ctx.createCanvas(w, h);
    const wg = ctx2d(work);
    wg.imageSmoothingQuality = 'high';
    wg.drawImage(ctx.source, 0, 0, w, h);
    const img = wg.getImageData(0, 0, w, h);
    const r = Math.max(1, Math.round(v.brush * short * scale));
    const k = kuwahara(img.data, w, h, r);
    // 盛り上がり: 明るさの勾配から左上の光を当てたような陰影
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const iL = (y * w + Math.max(0, x - 1)) * 4;
        const iU = (Math.max(0, y - 1) * w + x) * 4;
        const lc = k[i] + k[i + 1] + k[i + 2];
        const shade = ((lc - (k[iL] + k[iL + 1] + k[iL + 2])) + (lc - (k[iU] + k[iU + 1] + k[iU + 2]))) / 765;
        const m = (k[i] + k[i + 1] + k[i + 2]) / 3;
        for (let c = 0; c < 3; c++) {
          const sat = m + (k[i + c] - m) * (1 + v.saturation);
          d[i + c] = sat + shade * v.impasto * 180;
        }
        d[i + 3] = k[i + 3];
      }
    }
    wg.putImageData(img, 0, 0);
    const out = ctx.createCanvas();
    const og = ctx2d(out);
    og.imageSmoothingQuality = 'high';
    og.drawImage(work, 0, 0, W, H);
    return out;
  },
});

export const prism = defineEffect({
  id: 'prism',
  label: 'プリズム',
  category: 'light',
  kind: 'overlay',
  defaultBlend: 'screen',
  description:
    'プリズムやガラスを通った光のような、虹色の光の帯を差し込ませる。origin を光の入る位置（画面の端・窓など）に、direction を光の進む向きに。透明感・夢・青春・SF に。rgbShift と合わせると分光感が増す。',
  params: {
    origin: p.point(1, 0.05, '光の入る位置'),
    direction: p.num(-180, 180, 140, '光の進む向き（度。0=右, 90=下）'),
    spread: p.num(3, 90, 22, '虹の帯の広がり角（度）'),
    bands: p.int(1, 5, 2, '虹の帯の数'),
    length: p.num(0.2, 2.5, 1.3, '長さ（短辺比）'),
    intensity: p.num(0, 1, 0.55, '強さ'),
    softness: p.num(0, 1, 0.45, 'ぼけ具合'),
  },
  render(ctx, v) {
    const { width: W, height: H, short } = ctx;
    const out = ctx.createCanvas();
    const scale = 1 / (1 + v.softness * 6);
    const small = ctx.createCanvas(Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)));
    const g = ctx2d(small);
    const ox = v.origin.x * W * scale;
    const oy = v.origin.y * H * scale;
    const len = v.length * short * scale;
    const RAINBOW = ['#ff3b3b', '#ff9a2e', '#ffe53b', '#4cff7a', '#3bc8ff', '#5b5bff', '#c03bff'];
    g.globalCompositeOperation = 'lighter';
    for (let b = 0; b < v.bands; b++) {
      const centerDeg = v.direction + (b - (v.bands - 1) / 2) * v.spread * 1.6 + (ctx.rng() - 0.5) * v.spread * 0.4;
      const a0 = ((centerDeg - v.spread / 2) * Math.PI) / 180;
      const span = (v.spread * Math.PI) / 180;
      // 円錐グラデーションで、角度に沿って虹色を並べる
      const cg = g.createConicGradient(a0, ox, oy);
      const frac = span / (Math.PI * 2);
      cg.addColorStop(0, 'rgba(0,0,0,0)');
      RAINBOW.forEach((c, i) => cg.addColorStop(Math.min(0.999, (frac * (i + 0.5)) / RAINBOW.length), c));
      cg.addColorStop(Math.min(1, frac), 'rgba(0,0,0,0)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      const layer = ctx.createCanvas(small.width, small.height);
      const lg = ctx2d(layer);
      lg.fillStyle = cg;
      lg.fillRect(0, 0, layer.width, layer.height);
      // 光源から離れるほど薄く
      lg.globalCompositeOperation = 'destination-in';
      const rg = lg.createRadialGradient(ox, oy, 0, ox, oy, len * (0.7 + ctx.rng() * 0.3));
      rg.addColorStop(0, css({ r: 0, g: 0, b: 0, a: 1 }, v.intensity));
      rg.addColorStop(0.5, css({ r: 0, g: 0, b: 0, a: 1 }, v.intensity * 0.55));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = rg;
      lg.fillRect(0, 0, layer.width, layer.height);
      g.drawImage(layer, 0, 0);
    }
    const og = ctx2d(out);
    og.imageSmoothingEnabled = true;
    og.imageSmoothingQuality = 'high';
    og.drawImage(small, 0, 0, W, H);
    return out;
  },
});

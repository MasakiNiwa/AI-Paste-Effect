/**
 * 領域（マスク）の定義と生成。
 *
 * 座標は画像の左上を (0,0)、右下を (1,1) とする正規化座標。
 * マスクは純粋な数値計算で作るので DOM なしでテストできる。
 */

import { normalizePoint, type Point, type Warn } from './params';
import type { Rng } from './random';

interface RegionBase {
  /** 0-1。この領域での効き具合 */
  strength: number;
  /** true なら領域の外側が対象になる */
  invert: boolean;
}

export type Region = RegionBase &
  (
    | { shape: 'full' }
    | { shape: 'ellipse'; cx: number; cy: number; rx: number; ry: number; angle: number; feather: number }
    | { shape: 'rect'; x: number; y: number; w: number; h: number; angle: number; feather: number }
    | { shape: 'linear'; from: Point; to: Point }
    | { shape: 'polygon'; points: Point[]; feather: number }
  );

export const REGION_SHORTHANDS = {
  full: '画像全体',
  top: '上側ほど強い（下に向かって消える）',
  bottom: '下側ほど強い',
  left: '左側ほど強い',
  right: '右側ほど強い',
  center: '中央付近（外へ向かって消える）',
  edges: '画面の周辺部（中央は効かない）',
} as const;

type Shorthand = keyof typeof REGION_SHORTHANDS;

const SHORTHAND_REGIONS: Record<Shorthand, Record<string, unknown>> = {
  full: { shape: 'full' },
  top: { shape: 'linear', from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 0.6 } },
  bottom: { shape: 'linear', from: { x: 0.5, y: 1 }, to: { x: 0.5, y: 0.4 } },
  left: { shape: 'linear', from: { x: 0, y: 0.5 }, to: { x: 0.6, y: 0.5 } },
  right: { shape: 'linear', from: { x: 1, y: 0.5 }, to: { x: 0.4, y: 0.5 } },
  center: { shape: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.4, ry: 0.4, feather: 0.7 },
  edges: { shape: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.55, ry: 0.55, feather: 0.6, invert: true },
};

const num = (v: unknown, def: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

function normalizeOne(raw: unknown, path: string, warn: Warn): Region | undefined {
  if (typeof raw === 'string') {
    if (raw in SHORTHAND_REGIONS) return normalizeOne(SHORTHAND_REGIONS[raw as Shorthand], path, warn);
    warn(`${path}: 不明な領域 "${raw}" を無視しました`);
    return undefined;
  }
  if (!raw || typeof raw !== 'object') {
    warn(`${path}: 領域として読めないので無視しました`);
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const base: RegionBase = {
    strength: num(o.strength, 1, 0, 1),
    invert: o.invert === true,
  };
  const feather = num(o.feather, 0.3, 0, 1);
  const angle = num(o.angle, 0);

  switch (o.shape) {
    case 'full':
    case undefined:
      if (o.shape === undefined && Object.keys(o).some((k) => ['cx', 'x', 'from', 'points'].includes(k))) {
        warn(`${path}: shape がありません`);
        return undefined;
      }
      return { ...base, shape: 'full' };
    case 'ellipse':
    case 'circle': {
      const r = num(o.r, 0.25, 0.001, 3);
      return {
        ...base,
        shape: 'ellipse',
        cx: num(o.cx, 0.5),
        cy: num(o.cy, 0.5),
        rx: num(o.rx, r, 0.001, 3),
        ry: num(o.ry, r, 0.001, 3),
        angle,
        feather,
      };
    }
    case 'rect':
      return {
        ...base,
        shape: 'rect',
        x: num(o.x, 0),
        y: num(o.y, 0),
        w: num(o.w, 1, 0.001, 3),
        h: num(o.h, 1, 0.001, 3),
        angle,
        feather,
      };
    case 'linear': {
      const from = normalizePoint(o.from);
      const to = normalizePoint(o.to);
      if (!from || !to) {
        warn(`${path}: linear には from と to の座標が必要です`);
        return undefined;
      }
      return { ...base, shape: 'linear', from, to };
    }
    case 'polygon': {
      const points = Array.isArray(o.points)
        ? o.points.map(normalizePoint).filter((pt): pt is Point => !!pt)
        : [];
      if (points.length < 3) {
        warn(`${path}: polygon には 3 点以上の points が必要です`);
        return undefined;
      }
      return { ...base, shape: 'polygon', points, feather };
    }
    default:
      warn(`${path}: 不明な shape "${String(o.shape)}" を無視しました`);
      return undefined;
  }
}

/** 単体・配列・ショートハンド文字列のいずれも受け付けて Region[] にする */
export function normalizeRegions(raw: unknown, path: string, warn: Warn): Region[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((r, i) => normalizeOne(r, Array.isArray(raw) ? `${path}[${i}]` : path, warn))
    .filter((r): r is Region => !!r);
}

// ---------------------------------------------------------------------------
// ラスタライズ

export interface Mask {
  width: number;
  height: number;
  /** 0-1 の値。行優先 */
  data: Float32Array;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function boxBlur(src: Float32Array<ArrayBuffer>, w: number, h: number, radius: number): Float32Array<ArrayBuffer> {
  const r = Math.round(radius);
  if (r < 1) return src;
  let a = src;
  let b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    // 横
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    // 縦
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

function pointInPolygon(x: number, y: number, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * 1 つの領域をマスクにする。
 * imageAspect = 画像の幅 / 高さ（回転や円形を画素空間で正しく扱うため）
 */
function rasterize(region: Region, w: number, h: number, imageAspect: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(w * h);
  // 画素空間に近い座標系: X は aspect 倍、Y はそのまま
  const A = imageAspect;

  if (region.shape === 'full') {
    out.fill(1);
  } else if (region.shape === 'linear') {
    const fx = region.from.x * A;
    const fy = region.from.y;
    const dx = region.to.x * A - fx;
    const dy = region.to.y - fy;
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let j = 0; j < h; j++) {
      const ny = (j + 0.5) / h;
      for (let i = 0; i < w; i++) {
        const nx = ((i + 0.5) / w) * A;
        const t = ((nx - fx) * dx + (ny - fy) * dy) / len2;
        out[j * w + i] = 1 - smoothstep(0, 1, t);
      }
    }
  } else if (region.shape === 'ellipse' || region.shape === 'rect') {
    const isEllipse = region.shape === 'ellipse';
    const cx = (isEllipse ? region.cx : region.x + region.w / 2) * A;
    const cy = isEllipse ? region.cy : region.y + region.h / 2;
    const hw = (isEllipse ? region.rx : region.w / 2) * A;
    const hh = isEllipse ? region.ry : region.h / 2;
    const rad = (-region.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const inner = 1 - region.feather;
    for (let j = 0; j < h; j++) {
      const py = (j + 0.5) / h - cy;
      for (let i = 0; i < w; i++) {
        const px = ((i + 0.5) / w) * A - cx;
        const lx = (px * cos - py * sin) / hw;
        const ly = (px * sin + py * cos) / hh;
        const d = isEllipse ? Math.sqrt(lx * lx + ly * ly) : Math.max(Math.abs(lx), Math.abs(ly));
        out[j * w + i] = 1 - smoothstep(inner, 1, d);
      }
    }
  } else {
    const pts = region.points;
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const pt of pts) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    for (let j = 0; j < h; j++) {
      const ny = (j + 0.5) / h;
      for (let i = 0; i < w; i++) {
        out[j * w + i] = pointInPolygon((i + 0.5) / w, ny, pts) ? 1 : 0;
      }
    }
    const size = Math.min((maxX - minX) * w, (maxY - minY) * h);
    return boxBlur(out, w, h, region.feather * 0.25 * size);
  }
  return out;
}

const MASK_MAX = 384;

/**
 * 適用範囲マスクを作る。regions は和集合、protect は除外。
 * 全面に均一に効く場合は null（マスク不要）を返す。
 */
export function buildMask(
  imageWidth: number,
  imageHeight: number,
  regions: Region[] | undefined,
  protect: Region[],
): Mask | null {
  const trivial =
    (!regions || regions.length === 0 || regions.some((r) => r.shape === 'full' && !r.invert && r.strength >= 1)) &&
    protect.length === 0;
  if (trivial) return null;

  const scale = MASK_MAX / Math.max(imageWidth, imageHeight);
  const w = Math.max(8, Math.round(imageWidth * Math.min(1, scale)));
  const h = Math.max(8, Math.round(imageHeight * Math.min(1, scale)));
  const aspect = imageWidth / imageHeight;

  const data = new Float32Array(w * h);
  const include = regions && regions.length > 0 ? regions : [{ shape: 'full', strength: 1, invert: false } as Region];
  for (const r of include) {
    const m = rasterize(r, w, h, aspect);
    for (let k = 0; k < data.length; k++) {
      const v = (r.invert ? 1 - m[k] : m[k]) * r.strength;
      if (v > data[k]) data[k] = v;
    }
  }
  for (const r of protect) {
    const m = rasterize(r, w, h, aspect);
    for (let k = 0; k < data.length; k++) {
      const v = (r.invert ? 1 - m[k] : m[k]) * r.strength;
      data[k] *= 1 - v;
    }
  }
  return { width: w, height: h, data };
}

/** マスクの値に比例した確率で点を選ぶ（パーティクル配置用）。正規化座標を返す。 */
export function samplePoint(mask: Mask | null, rng: Rng): Point {
  if (!mask) return { x: rng(), y: rng() };
  let best: Point = { x: rng(), y: rng() };
  let bestV = -1;
  for (let tries = 0; tries < 40; tries++) {
    const x = rng();
    const y = rng();
    const v = mask.data[Math.min(mask.height - 1, Math.floor(y * mask.height)) * mask.width + Math.min(mask.width - 1, Math.floor(x * mask.width))];
    if (rng() < v) return { x, y };
    if (v > bestV) {
      bestV = v;
      best = { x, y };
    }
  }
  return best;
}

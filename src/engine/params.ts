/**
 * エフェクトパラメータの宣言と正規化。
 *
 * 各エフェクトはここにあるヘルパーでパラメータを宣言する。宣言は
 *  - AI 向けプロンプトのエフェクト仕様書
 *  - ヘルプページのエフェクト一覧
 *  - AI が返した JSON の寛容な正規化（範囲外は丸め、型違いは既定値＋警告）
 * の単一の情報源になる。
 */

import { parseColor, type RGBA } from './color';

export interface Point {
  x: number;
  y: number;
}

interface BaseSpec<T> {
  desc: string;
  default: T;
}

export interface NumberSpec extends BaseSpec<number> {
  type: 'number';
  min: number;
  max: number;
  integer?: boolean;
}
export interface ColorSpec extends BaseSpec<string> {
  type: 'color';
}
export interface ColorsSpec extends BaseSpec<string[]> {
  type: 'colors';
  minItems: number;
  maxItems: number;
}
export interface PointSpec extends BaseSpec<Point> {
  type: 'point';
}
export interface EnumSpec<O extends string = string> extends BaseSpec<O> {
  type: 'enum';
  options: readonly O[];
}
export interface BooleanSpec extends BaseSpec<boolean> {
  type: 'boolean';
}
export interface TextSpec extends BaseSpec<string> {
  type: 'text';
  maxLength: number;
}

export type ParamSpec = NumberSpec | ColorSpec | ColorsSpec | PointSpec | EnumSpec | BooleanSpec | TextSpec;
export type ParamSchema = Record<string, ParamSpec>;

type ValueOf<S extends ParamSpec> = S extends NumberSpec
  ? number
  : S extends ColorSpec
    ? RGBA
    : S extends ColorsSpec
      ? RGBA[]
      : S extends PointSpec
        ? Point
        : S extends EnumSpec<infer O>
          ? O
          : S extends BooleanSpec
            ? boolean
            : S extends TextSpec
              ? string
              : never;

export type ParamValues<S extends ParamSchema> = { [K in keyof S]: ValueOf<S[K]> };

export const p = {
  num: (min: number, max: number, def: number, desc: string): NumberSpec => ({
    type: 'number',
    min,
    max,
    default: def,
    desc,
  }),
  int: (min: number, max: number, def: number, desc: string): NumberSpec => ({
    type: 'number',
    min,
    max,
    default: def,
    desc,
    integer: true,
  }),
  color: (def: string, desc: string): ColorSpec => ({ type: 'color', default: def, desc }),
  colors: (def: string[], desc: string, minItems = 1, maxItems = 8): ColorsSpec => ({
    type: 'colors',
    default: def,
    desc,
    minItems,
    maxItems,
  }),
  point: (x: number, y: number, desc: string): PointSpec => ({
    type: 'point',
    default: { x, y },
    desc,
  }),
  enum: <const O extends string>(options: readonly O[], def: O, desc: string): EnumSpec<O> => ({
    type: 'enum',
    options,
    default: def,
    desc,
  }),
  bool: (def: boolean, desc: string): BooleanSpec => ({ type: 'boolean', default: def, desc }),
  text: (def: string, desc: string, maxLength = 40): TextSpec => ({ type: 'text', default: def, desc, maxLength }),
};

export type Warn = (message: string) => void;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

export function normalizePoint(v: unknown): Point | undefined {
  if (Array.isArray(v) && v.length >= 2) {
    const x = toNumber(v[0]);
    const y = toNumber(v[1]);
    if (x !== undefined && y !== undefined) return { x, y };
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const x = toNumber(o.x);
    const y = toNumber(o.y);
    if (x !== undefined && y !== undefined) return { x, y };
  }
  return undefined;
}

function normalizeOne(spec: ParamSpec, raw: unknown, path: string, warn: Warn): unknown {
  const fallback = (why: string) => {
    warn(`${path}: ${why}のため既定値 ${JSON.stringify(spec.default)} を使います`);
    return normalizeOne(spec, spec.default, path, () => {});
  };

  switch (spec.type) {
    case 'number': {
      const n = toNumber(raw);
      if (n === undefined) return fallback('数値ではない');
      const v = clamp(n, spec.min, spec.max);
      if (v !== n) warn(`${path}: ${n} は範囲 ${spec.min}〜${spec.max} の外なので ${v} に丸めました`);
      return spec.integer ? Math.round(v) : v;
    }
    case 'color': {
      const c = typeof raw === 'string' ? parseColor(raw) : undefined;
      return c ?? fallback('色として読めない');
    }
    case 'colors': {
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : undefined;
      if (!list) return fallback('色の配列ではない');
      const colors = list
        .map((c) => (typeof c === 'string' ? parseColor(c) : undefined))
        .filter((c): c is RGBA => !!c)
        .slice(0, spec.maxItems);
      if (colors.length < spec.minItems) return fallback(`色が${spec.minItems}個未満`);
      if (colors.length !== list.length) warn(`${path}: 読めない色や多すぎる色を除外しました`);
      return colors;
    }
    case 'point': {
      const pt = normalizePoint(raw);
      if (!pt) return fallback('座標 {"x","y"} として読めない');
      return { x: clamp(pt.x, -1, 2), y: clamp(pt.y, -1, 2) };
    }
    case 'enum': {
      if (typeof raw === 'string' && spec.options.includes(raw)) return raw;
      return fallback(`${spec.options.join(' / ')} のいずれでもない`);
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 1) return true;
      if (raw === 'false' || raw === 0) return false;
      return fallback('true/false ではない');
    }
    case 'text': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return fallback('文字列ではない');
      const t = String(raw).slice(0, spec.maxLength);
      if (String(raw).length > spec.maxLength) warn(`${path}: ${spec.maxLength} 文字までに切り詰めました`);
      return t;
    }
  }
}

/** AI から来たパラメータを宣言に沿って正規化する。未知のキーは警告して無視する。 */
export function normalizeParams<S extends ParamSchema>(
  schema: S,
  raw: unknown,
  path: string,
  warn: Warn,
): ParamValues<S> {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && input !== raw) warn(`${path}: params はオブジェクトである必要があります`);

  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) {
    out[key] =
      input[key] === undefined
        ? normalizeOne(spec, spec.default, `${path}.${key}`, () => {})
        : normalizeOne(spec, input[key], `${path}.${key}`, warn);
  }
  for (const key of Object.keys(input)) {
    if (!(key in schema)) warn(`${path}.${key}: 未知のパラメータなので無視しました`);
  }
  return out as ParamValues<S>;
}

/** プロンプト／ヘルプ用に 1 パラメータの説明を 1 行で表す */
export function describeParam(name: string, spec: ParamSpec): string {
  const d = JSON.stringify(spec.default);
  switch (spec.type) {
    case 'number':
      return `${name}: ${spec.integer ? '整数' : '数値'} ${spec.min}〜${spec.max}（既定 ${d}）${spec.desc}`;
    case 'color':
      return `${name}: 色 "#rrggbb" か "#rrggbbaa"（既定 ${d}）${spec.desc}`;
    case 'colors':
      return `${name}: 色の配列 ${spec.minItems}〜${spec.maxItems}個（既定 ${d}）${spec.desc}`;
    case 'point':
      return `${name}: 座標 {"x","y"}（既定 ${d}）${spec.desc}`;
    case 'enum':
      return `${name}: ${spec.options.map((o) => `"${o}"`).join(' | ')}（既定 ${d}）${spec.desc}`;
    case 'boolean':
      return `${name}: true/false（既定 ${d}）${spec.desc}`;
    case 'text':
      return `${name}: 文字列 ${spec.maxLength}文字まで（既定 ${d}）${spec.desc}`;
  }
}

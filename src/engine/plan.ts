/**
 * 演出プラン JSON の解析・正規化・コンパイル。
 *
 * AI の返答は揺れるので、ここでは「できるだけ読み取って警告を出す」方針を取る。
 *
 * 構造（多層）:
 *   plan
 *    ├─ title / intent / analysis   … AI の意図と画像解析メモ（描画には使わない）
 *    ├─ protect[]                   … 顔など、守りたい領域（全レイヤー共通の除外マスク）
 *    └─ blocks[]                    … 演出の意味単位（例: 「夕景の色」「逆光」「空気の粒」）
 *         ├─ region / opacity / enabled（配下レイヤーの既定値）
 *         └─ layers[]               … 実際に描画するエフェクト
 *              └─ effect / params / blend / opacity / region / protect / seed
 */

import JSON5 from 'json5';
import { findEffect, type AnyEffect } from './effects';
import { normalizeParams } from './params';
import { hashString } from './random';
import { normalizeRegions, type Region } from './region';
import { BLEND_MODES, type BlendMode } from './types';

export const PLAN_FORMAT = 'ai-paste-effect';
export const PLAN_VERSION = 1;

export interface RenderLayer {
  /** "blocks[0].layers[1]" のような位置 */
  path: string;
  blockId: string;
  effect: AnyEffect;
  params: any;
  blend: BlendMode;
  opacity: number;
  regions?: Region[];
  protect: Region[];
  seed: number;
}

export interface CompiledPlan {
  title?: string;
  intent?: string;
  layers: RenderLayer[];
}

export interface ParseResult {
  plan?: CompiledPlan;
  /** 元の JSON オブジェクト（AI への修正依頼に添える） */
  raw?: unknown;
  /** JSON の外に書かれていた AI の語り */
  comment?: string;
  /** アプリ上で手動編集されたものか */
  edited?: boolean;
  errors: string[];
  warnings: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

interface Candidate {
  json: string;
  /** 返答全体の中での範囲（コメント抽出時に取り除く。コードフェンスも含む） */
  from: number;
  to: number;
}

/** start の { に対応する } の位置を返す（見つからなければ -1） */
function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

/** JSON らしき部分の候補を、優先度の高い順に挙げる（```json ブロック → 本文中の { … }） */
function candidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const fence = /```[a-zA-Z0-9]*[ \t]*\r?\n?([\s\S]*?)```/g;
  const fenced: [number, number][] = [];
  for (let m; (m = fence.exec(text)); ) {
    fenced.push([m.index, m.index + m[0].length]);
    const body = m[1];
    const b = body.indexOf('{');
    if (b < 0) continue;
    const e = matchBrace(body, b);
    out.push({ json: e < 0 ? body.slice(b) : body.slice(b, e + 1), from: m.index, to: m.index + m[0].length });
  }
  for (let i = text.indexOf('{'); i >= 0; i = text.indexOf('{', i + 1)) {
    if (fenced.some(([a, b]) => i >= a && i < b)) continue;
    const e = matchBrace(text, i);
    out.push({ json: e < 0 ? text.slice(i) : text.slice(i, e + 1), from: i, to: e < 0 ? text.length : e + 1 });
    if (e >= 0) i = e; // 入れ子の内側は候補にしない
  }
  return out;
}

function tryParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    // 末尾カンマやコメントなど、AI が出しがちな崩れを許容する
    return JSON5.parse(json);
  }
}

const isPlanLike = (v: unknown): v is Record<string, unknown> =>
  isObj(v) && (Array.isArray(v.blocks) || Array.isArray(v.layers) || Array.isArray(v.variations));

interface Extraction {
  /** 見つかった演出プラン（複数案の場合は複数） */
  values: unknown[];
  /** JSON 以外の部分（AI の語り） */
  comment?: string;
  error?: string;
  json?: string;
}

/** AI の返答から演出プランの JSON（複数可）と、それ以外の語りを取り出す */
export function extractPlans(text: string): Extraction {
  const list = candidates(text);
  if (list.length === 0) return { values: [], error: 'JSON（{ … }）が見つかりません' };
  const found: { c: Candidate; v: unknown }[] = [];
  let firstObj: { c: Candidate; v: unknown } | undefined;
  let firstError: string | undefined;
  for (const c of list) {
    try {
      const v = tryParse(c.json);
      if (!isObj(v)) continue;
      firstObj ??= { c, v };
      if (isPlanLike(v)) found.push({ c, v });
    } catch (e) {
      firstError ??= `JSON として読めません: ${(e as Error).message}`;
    }
  }
  const use = found.length > 0 ? found : firstObj ? [firstObj] : [];
  if (use.length === 0) return { values: [], error: firstError ?? 'JSON（{ … }）が見つかりません' };
  // 使った JSON 部分を取り除いた残りが語り
  let comment = '';
  let pos = 0;
  for (const { c } of [...use].sort((x, y) => x.c.from - y.c.from)) {
    comment += text.slice(pos, c.from) + '\n\n';
    pos = c.to;
  }
  comment = (comment + text.slice(pos)).replace(/\n{3,}/g, '\n\n').trim();
  return { values: use.map((u) => u.v), json: use[0].c.json, comment: comment || undefined };
}

/** 文章やコードフェンスに囲まれていても、演出プランの JSON 部分を取り出す */
export function extractJsonText(text: string): string | undefined {
  return extractPlans(text).json;
}

const num01 = (v: unknown, def: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : def;
};

function normalizeBlend(v: unknown, def: BlendMode, path: string, warn: (m: string) => void): BlendMode {
  if (v === undefined) return def;
  if (typeof v === 'string') {
    const key = v.trim().toLowerCase().replace(/[_\s]/g, '-');
    const alias: Record<string, BlendMode> = {
      'source-over': 'normal',
      lighter: 'add',
      'linear-dodge': 'add',
      softlight: 'soft-light',
      hardlight: 'hard-light',
      colordodge: 'color-dodge',
      colorburn: 'color-burn',
    };
    const m = (BLEND_MODES as readonly string[]).includes(key) ? (key as BlendMode) : alias[key];
    if (m) return m;
  }
  warn(`${path}.blend: 不明な合成モード ${JSON.stringify(v)} なので "${def}" を使います`);
  return def;
}

export interface ReplyResult {
  /** 読み込めた案（1 案のみの返答なら 1 つ）。各案の comment は返答全体の語り */
  variants: ParseResult[];
  comment?: string;
  /** 1 案も読めなかった時のエラー */
  errors: string[];
}

/** 複数案のまとめ形式 {"variations": [plan, …]} を展開する。外側の共通項目は各案に引き継ぐ */
function expandVariations(v: unknown): unknown[] {
  if (!isObj(v) || !Array.isArray(v.variations)) return [v];
  const { variations, ...common } = v;
  return (variations as unknown[]).map((x) => (isObj(x) ? { ...common, ...x } : x));
}

/** AI の返答全体を解析する（複数案対応） */
export function parseReply(text: string): ReplyResult {
  if (!text.trim()) return { variants: [], errors: ['JSON が空です'] };
  const { values, error, comment } = extractPlans(text);
  if (error) return { variants: [], errors: [error], comment };
  const all = values.flatMap(expandVariations).map((root) => ({ ...compileRoot(root), comment }));
  const ok = all.filter((r) => r.errors.length === 0);
  if (ok.length === 0) return { variants: [], errors: all[0]?.errors ?? ['描画できる案がありません'], comment };
  if (ok.length < all.length) {
    const skipped = all.map((r, i) => (r.errors.length ? i + 1 : 0)).filter(Boolean);
    ok[0].warnings.unshift(`案 ${skipped.join('・')} は読み込めなかったので除外しました`);
  }
  return { variants: ok, errors: [], comment };
}

/** 1 案目だけを解析する（単一案として扱う場合） */
export function parsePlan(text: string): ParseResult {
  const r = parseReply(text);
  return r.variants[0] ?? { errors: r.errors, warnings: [], comment: r.comment };
}

/** 演出プランのオブジェクト 1 つを解析する（手動編集の結果などに使う） */
export function compilePlan(value: unknown): ParseResult {
  return compileRoot(value);
}

function compileRoot(value: unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  if (!isObj(value)) return { errors: ['JSON の一番外側はオブジェクト { … } である必要があります'], warnings };

  const root = value;
  if (root.format !== undefined && root.format !== PLAN_FORMAT) {
    warn(`format が "${String(root.format)}" です（想定は "${PLAN_FORMAT}"）`);
  }
  if (typeof root.version === 'number' && root.version > PLAN_VERSION) {
    warn(`version ${root.version} はこのアプリ（${PLAN_VERSION}）より新しい形式です`);
  }

  const protect = normalizeRegions(root.protect, 'protect', warn) ?? [];

  // blocks が無く layers だけ、という簡略形も受け付ける
  let blocks: unknown[];
  if (Array.isArray(root.blocks)) blocks = root.blocks;
  else if (Array.isArray(root.layers)) blocks = [{ id: 'main', layers: root.layers }];
  else return { errors: ['blocks（演出ブロックの配列）がありません'], warnings, raw: root };

  const layers: RenderLayer[] = [];
  blocks.forEach((b, bi) => {
    const bpath = `blocks[${bi}]`;
    if (!isObj(b)) return warn(`${bpath}: オブジェクトではないので無視しました`);
    if (b.enabled === false) return;
    const blockId = typeof b.id === 'string' ? b.id : `block${bi + 1}`;
    const blockRegions = normalizeRegions(b.region, `${bpath}.region`, warn);
    const blockOpacity = num01(b.opacity, 1);
    // ブロック自体に effect が書かれていたら 1 レイヤーのブロックとして扱う
    const rawLayers = Array.isArray(b.layers) ? b.layers : typeof b.effect === 'string' ? [b] : [];
    if (rawLayers.length === 0) warn(`${bpath}: layers が空です`);

    rawLayers.forEach((l, li) => {
      const path = rawLayers === b.layers ? `${bpath}.layers[${li}]` : bpath;
      if (!isObj(l)) return warn(`${path}: オブジェクトではないので無視しました`);
      if (l.enabled === false) return;
      if (typeof l.effect !== 'string') return warn(`${path}: effect がないので無視しました`);
      const effect = findEffect(l.effect);
      if (!effect) return warn(`${path}: 未知のエフェクト "${l.effect}" は無視しました`);

      const regions = normalizeRegions(l.region, `${path}.region`, warn) ?? blockRegions;
      layers.push({
        path,
        blockId,
        effect,
        params: normalizeParams(effect.params, l.params, `${path}.params`, warn),
        blend: normalizeBlend(l.blend, effect.defaultBlend, path, warn),
        opacity: num01(l.opacity, 1) * blockOpacity,
        regions,
        protect: l.protect === false ? [] : protect,
        seed: typeof l.seed === 'number' ? Math.floor(l.seed) : hashString(`${blockId}/${path}/${effect.id}`),
      });
    });
  });

  if (layers.length === 0) errors.push('描画できるレイヤーが 1 つもありません');

  return {
    plan: {
      title: typeof root.title === 'string' ? root.title : undefined,
      intent: typeof root.intent === 'string' ? root.intent : undefined,
      layers,
    },
    raw: root,
    errors,
    warnings,
  };
}

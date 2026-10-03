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
  errors: string[];
  warnings: string[];
}

/** 文章やコードフェンスに囲まれていても、最初の JSON オブジェクトを取り出す */
export function extractJsonText(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString: string | null = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") inString = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start); // 閉じていない → パーサにエラーを出させる
}

function parseJson(text: string): { value?: unknown; error?: string } {
  const body = extractJsonText(text);
  if (body === undefined) return { error: 'JSON（{ … }）が見つかりません' };
  try {
    return { value: JSON.parse(body) };
  } catch {
    try {
      // 末尾カンマやコメントなど、AI が出しがちな崩れを許容する
      return { value: JSON5.parse(body) };
    } catch (e) {
      return { error: `JSON として読めません: ${(e as Error).message}` };
    }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

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

export function parsePlan(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);

  if (!text.trim()) return { errors: ['JSON が空です'], warnings };
  const { value, error } = parseJson(text);
  if (error) return { errors: [error], warnings };
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

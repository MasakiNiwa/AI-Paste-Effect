/**
 * 手動編集用のヘルパー。演出プラン JSON をそのまま編集できる形（常に blocks 形式）に整え、
 * パラメータを JSON 向けの値と相互変換する。DOM に依存しない。
 */
import type { RGBA } from './color';
import { findEffect } from './effects';
import { normalizeParams, type ParamSchema, type ParamSpec, type Point } from './params';
import { PLAN_FORMAT, PLAN_VERSION } from './plan';

export interface EditLayer {
  effect: string;
  enabled?: boolean;
  opacity?: number;
  blend?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EditBlock {
  id: string;
  purpose?: string;
  enabled?: boolean;
  opacity?: number;
  layers: EditLayer[];
  [key: string]: unknown;
}

export interface EditPlan {
  format: string;
  version: number;
  title?: string;
  blocks: EditBlock[];
  [key: string]: unknown;
}

/** 手動で追加したエフェクトを入れるブロック */
export const MANUAL_BLOCK_ID = 'my-edits';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export function emptyPlan(): EditPlan {
  return { format: PLAN_FORMAT, version: PLAN_VERSION, title: '手動の演出', blocks: [] };
}

/** AI の JSON（形式の揺れを含む）を、編集しやすい blocks 形式の複製にする */
export function toEditable(raw: unknown): EditPlan {
  if (!isObj(raw)) return emptyPlan();
  const plan = clone(raw) as Record<string, unknown>;
  let blocks: unknown[] = Array.isArray(plan.blocks) ? plan.blocks : Array.isArray(plan.layers) ? [{ id: 'main', layers: plan.layers }] : [];
  delete plan.layers;
  blocks = blocks.filter(isObj).map((b, i) => {
    const block = b as Record<string, unknown>;
    // ブロック自体に effect が書かれた簡略形 → 1 レイヤーのブロック
    const layers = Array.isArray(block.layers) ? block.layers.filter(isObj) : typeof block.effect === 'string' ? [block] : [];
    return { ...(Array.isArray(block.layers) ? block : {}), id: typeof block.id === 'string' ? block.id : `block${i + 1}`, layers };
  });
  return { ...plan, format: PLAN_FORMAT, version: PLAN_VERSION, blocks } as EditPlan;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

export function colorToJson(c: RGBA): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(c.a * 255) : ''}`;
}

/** 正規化済みのパラメータ値を、JSON に書き戻す値に変換する */
export function paramToJson(spec: ParamSpec, value: unknown): unknown {
  switch (spec.type) {
    case 'number':
      return round(value as number);
    case 'color':
      return colorToJson(value as RGBA);
    case 'colors':
      return (value as RGBA[]).map(colorToJson);
    case 'point': {
      const p = value as Point;
      return { x: round(p.x), y: round(p.y) };
    }
    default:
      return value;
  }
}

/** レイヤーのパラメータを、既定値で補った正規化済みの値として読む（警告は出さない） */
export function readParams(layer: EditLayer): Record<string, unknown> | undefined {
  const effect = findEffect(layer.effect);
  if (!effect) return undefined;
  return normalizeParams(effect.params as ParamSchema, layer.params, '', () => {});
}

/** エフェクトの既定値で新しいレイヤーを作る */
export function newLayer(effectId: string): EditLayer {
  const effect = findEffect(effectId);
  if (!effect) throw new Error(`unknown effect: ${effectId}`);
  const params: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(effect.params as ParamSchema)) params[key] = clone(spec.default);
  return { effect: effect.id, opacity: 1, blend: effect.defaultBlend, params };
}

// ---- 不変更新のヘルパー（React の状態として扱うため、常に新しいオブジェクトを返す）

export type LayerRef = { block: number; layer: number };

export function updateLayer(plan: EditPlan, ref: LayerRef, patch: Partial<EditLayer>): EditPlan {
  return {
    ...plan,
    blocks: plan.blocks.map((b, bi) =>
      bi !== ref.block ? b : { ...b, layers: b.layers.map((l, li) => (li !== ref.layer ? l : { ...l, ...patch })) },
    ),
  };
}

export function setLayerParam(plan: EditPlan, ref: LayerRef, key: string, spec: ParamSpec, value: unknown): EditPlan {
  const layer = plan.blocks[ref.block].layers[ref.layer];
  return updateLayer(plan, ref, { params: { ...(layer.params ?? {}), [key]: paramToJson(spec, value) } });
}

export function updateBlock(plan: EditPlan, block: number, patch: Partial<EditBlock>): EditPlan {
  return { ...plan, blocks: plan.blocks.map((b, bi) => (bi === block ? { ...b, ...patch } : b)) };
}

export function removeLayer(plan: EditPlan, ref: LayerRef): EditPlan {
  const blocks = plan.blocks
    .map((b, bi) => (bi === ref.block ? { ...b, layers: b.layers.filter((_, li) => li !== ref.layer) } : b))
    .filter((b) => b.layers.length > 0);
  return { ...plan, blocks };
}

/** レイヤーを上下に動かす（ブロックの端ではとなりのブロックへ移る）。移動後の位置を返す */
export function moveLayer(plan: EditPlan, ref: LayerRef, dir: -1 | 1): { plan: EditPlan; ref: LayerRef } {
  const blocks = plan.blocks.map((b) => ({ ...b, layers: [...b.layers] }));
  const from = blocks[ref.block];
  const [layer] = from.layers.splice(ref.layer, 1);
  let to: LayerRef;
  const target = ref.layer + dir;
  if (target >= 0 && target <= from.layers.length) {
    from.layers.splice(target, 0, layer);
    to = { block: ref.block, layer: target };
  } else if (blocks[ref.block + dir]) {
    const nb = blocks[ref.block + dir];
    if (dir < 0) nb.layers.push(layer);
    else nb.layers.unshift(layer);
    to = { block: ref.block + dir, layer: dir < 0 ? nb.layers.length - 1 : 0 };
  } else {
    from.layers.splice(ref.layer, 0, layer); // 端なので動かさない
    to = ref;
  }
  return { plan: { ...plan, blocks }, ref: to };
}

/** 手動ブロック（なければ末尾に作る）にエフェクトを追加する。追加した位置を返す */
export function addEffect(plan: EditPlan, effectId: string): { plan: EditPlan; ref: LayerRef } {
  const layer = newLayer(effectId);
  let bi = plan.blocks.findIndex((b) => b.id === MANUAL_BLOCK_ID);
  const blocks = [...plan.blocks];
  if (bi < 0) {
    blocks.push({ id: MANUAL_BLOCK_ID, purpose: '手動で追加したエフェクト', layers: [] });
    bi = blocks.length - 1;
  }
  blocks[bi] = { ...blocks[bi], layers: [...blocks[bi].layers, layer] };
  return { plan: { ...plan, blocks }, ref: { block: bi, layer: blocks[bi].layers.length - 1 } };
}

import { describe, expect, it } from 'vitest';
import { addEffect, colorToJson, moveLayer, readParams, removeLayer, setLayerParam, toEditable, updateLayer } from '../src/engine/edit';
import { findEffect } from '../src/engine/effects';
import { EXAMPLE_PLAN } from '../src/engine/example';
import { compilePlan } from '../src/engine/plan';
import type { ParamSchema } from '../src/engine/params';

describe('edit helpers', () => {
  it('normalizes the layers shorthand into blocks and does not mutate the input', () => {
    const raw = { layers: [{ effect: 'blur' }] };
    const p = toEditable(raw);
    expect(p.blocks[0].layers[0].effect).toBe('blur');
    expect(raw).toEqual({ layers: [{ effect: 'blur' }] });
  });

  it('edits params and writes JSON-friendly values that compile back', () => {
    let p = toEditable(EXAMPLE_PLAN);
    const ref = { block: 3, layer: 0 }; // vignette
    const spec = (findEffect('vignette')!.params as ParamSchema).color;
    p = setLayerParam(p, ref, 'color', spec, { r: 255, g: 0, b: 0, a: 1 });
    p = setLayerParam(p, ref, 'center', (findEffect('vignette')!.params as ParamSchema).center, { x: 0.123456, y: 0.9 });
    expect(p.blocks[3].layers[0].params?.color).toBe('#ff0000');
    expect(p.blocks[3].layers[0].params?.center).toEqual({ x: 0.1235, y: 0.9 });
    const r = compilePlan(p);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(readParams(p.blocks[3].layers[0])?.color).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('hides, moves, removes and adds layers', () => {
    let p = toEditable(EXAMPLE_PLAN);
    p = updateLayer(p, { block: 0, layer: 0 }, { enabled: false });
    expect(compilePlan(p).plan?.layers.length).toBe(7);
    const moved = moveLayer(p, { block: 0, layer: 1 }, 1); // ブロック末尾 → 次のブロックの先頭へ
    expect(moved.ref).toEqual({ block: 1, layer: 0 });
    expect(moved.plan.blocks[1].layers[0].effect).toBe('gradient');
    p = removeLayer(moved.plan, { block: 2, layer: 0 }); // air ブロックの唯一のレイヤー → ブロックごと消える
    expect(p.blocks.some((b) => b.id === 'air')).toBe(false);
    const added = addEffect(p, 'lensFlare');
    expect(added.plan.blocks[added.ref.block].id).toBe('my-edits');
    expect(compilePlan(added.plan).plan?.layers.at(-1)?.effect.id).toBe('lensFlare');
  });

  it('keeps alpha when converting colors', () => {
    expect(colorToJson({ r: 16, g: 32, b: 48, a: 0.5 })).toBe('#10203080');
  });
});

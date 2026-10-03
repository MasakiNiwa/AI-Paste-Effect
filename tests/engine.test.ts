import { describe, expect, it } from 'vitest';
import { parseColor } from '../src/engine/color';
import { EFFECTS, findEffect } from '../src/engine/effects';
import { EXAMPLE_PLAN_TEXT } from '../src/engine/example';
import { extractJsonText, parsePlan } from '../src/engine/plan';
import { buildInitialPrompt, buildRevisionPrompt } from '../src/engine/prompt';
import { buildMask, normalizeRegions } from '../src/engine/region';

describe('color', () => {
  it('parses hex and rgb', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 1);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('nope')).toBeUndefined();
  });
});

describe('effects registry', () => {
  it('has unique ids and valid defaults', () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EFFECTS) {
      for (const [name, spec] of Object.entries(e.params)) {
        if (spec.type === 'number') {
          expect(spec.default, `${e.id}.${name}`).toBeGreaterThanOrEqual(spec.min);
          expect(spec.default, `${e.id}.${name}`).toBeLessThanOrEqual(spec.max);
        }
        if (spec.type === 'enum') expect(spec.options).toContain(spec.default);
      }
    }
  });
  it('finds effects loosely', () => {
    expect(findEffect('FocusLines')?.id).toBe('focusLines');
    expect(findEffect('focus-lines')?.id).toBe('focusLines');
  });
});

describe('plan parsing', () => {
  it('parses the example without warnings', () => {
    const r = parsePlan(EXAMPLE_PLAN_TEXT);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.plan?.layers.length).toBe(8);
    // block の region が layer に継承される
    const air = r.plan!.layers.find((l) => l.blockId === 'air')!;
    expect(air.regions?.[0].shape).toBe('ellipse');
  });

  it('extracts JSON from chatty markdown and tolerates trailing commas', () => {
    const text = 'はい、どうぞ！\n```json\n{"layers":[{"effect":"vignette","params":{"strength":0.4,},},],}\n```\nいかがでしょう';
    expect(extractJsonText(text)?.startsWith('{"layers"')).toBe(true);
    const r = parsePlan(text);
    expect(r.errors).toEqual([]);
    expect(r.plan?.layers[0].effect.id).toBe('vignette');
  });

  it('clamps and warns instead of failing', () => {
    const r = parsePlan(
      JSON.stringify({
        blocks: [
          {
            id: 'a',
            layers: [
              { effect: 'sparkle', blend: 'Soft Light', params: { count: 99999, colors: ['#fff', 'bad'], foo: 1 } },
              { effect: 'unknownEffect' },
              { effect: 'blur', enabled: false },
            ],
          },
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.plan?.layers.length).toBe(1);
    const l = r.plan!.layers[0];
    expect(l.params.count).toBe(400);
    expect(l.blend).toBe('soft-light');
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('finds the plan among free-form prose and keeps the prose as a comment', () => {
    const text = [
      '素敵なイラストですね！ {夕方} の空気感を足しました。',
      '',
      '```json',
      '{"title":"夕暮れ","blocks":[{"id":"a","layers":[{"effect":"vignette"}]}]}',
      '```',
      '',
      "もう少し強めがよければ言ってください。It's easy!",
    ].join('\n');
    const r = parsePlan(text);
    expect(r.errors).toEqual([]);
    expect(r.plan?.title).toBe('夕暮れ');
    expect(r.comment).toContain('素敵なイラスト');
    expect(r.comment).toContain('もう少し強め');
    expect(r.comment).not.toContain('blocks');
  });

  it('works without code fences and picks the object that has blocks/layers', () => {
    const r = parsePlan('設定例 {"a": 1} です。本番→ {"layers":[{"effect":"blur"}]} 以上');
    expect(r.errors).toEqual([]);
    expect(r.plan?.layers[0].effect.id).toBe('blur');
  });

  it('loads TaMaNi-Effect effects through the adapter', () => {
    const r = parsePlan(JSON.stringify({ layers: [{ effect: 'tamani.dots', params: { spacing: 999, mode: 'pointillism', ink: '#ff0000' } }] }));
    expect(r.errors).toEqual([]);
    const l = r.plan!.layers[0];
    expect(l.effect.category).toBe('tamani');
    expect(l.params.spacing).toBe(80);
    expect(l.params.mode).toBe('pointillism');
  });

  it('reports errors for broken input', () => {
    expect(parsePlan('').errors.length).toBe(1);
    expect(parsePlan('hello').errors[0]).toContain('見つかりません');
    expect(parsePlan('{"blocks": []}').errors[0]).toContain('レイヤー');
  });
});

describe('text params', () => {
  it('accepts strings, truncates long text and warns', () => {
    const r = parsePlan(JSON.stringify({ layers: [{ effect: 'soundText', params: { text: 'ドドドドドドドドドドドドドドド', font: 'nope' } }] }));
    const l = r.plan!.layers[0];
    expect(l.params.text).toBe('ドドドドドドドドドドドド');
    expect(l.params.font).toBe('impact');
    expect(r.warnings.length).toBe(2);
  });
});

describe('regions and masks', () => {
  it('normalizes shorthands', () => {
    const warns: string[] = [];
    const r = normalizeRegions(['top', { shape: 'circle', cx: 0.5, cy: 0.5, r: 0.2 }, 'zzz'], 'region', (m) => warns.push(m));
    expect(r?.map((x) => x.shape)).toEqual(['linear', 'ellipse']);
    expect(warns.length).toBe(1);
  });
  it('returns null for full masks and computes ellipse masks', () => {
    expect(buildMask(100, 100, undefined, [])).toBeNull();
    const m = buildMask(100, 100, normalizeRegions({ shape: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.25, feather: 0 }, 'r', () => {}), [])!;
    const at = (x: number, y: number) => m.data[Math.floor(y * m.height) * m.width + Math.floor(x * m.width)];
    expect(at(0.5, 0.5)).toBe(1);
    expect(at(0.05, 0.05)).toBe(0);
  });
  it('protect reduces the mask', () => {
    const protect = normalizeRegions({ shape: 'rect', x: 0, y: 0, w: 0.5, h: 1, feather: 0 }, 'p', () => {})!;
    const m = buildMask(100, 50, undefined, protect)!;
    expect(m.data[Math.floor(m.height / 2) * m.width + 2]).toBe(0);
    expect(m.data[Math.floor(m.height / 2) * m.width + m.width - 2]).toBe(1);
  });
});

describe('prompt', () => {
  it('mentions every effect id', () => {
    const p = buildInitialPrompt();
    for (const e of EFFECTS) expect(p).toContain(`**${e.id}**`);
  });
  it('asks the AI to talk freely only when enabled', () => {
    expect(buildInitialPrompt({ talk: true })).toContain('自由に語って');
    expect(buildInitialPrompt({ talk: false })).not.toContain('自由に語って');
  });
  it('includes current plan and warnings in revision prompt', () => {
    const p = buildRevisionPrompt({ currentPlan: { a: 1 }, warnings: ['W1'], includeSpec: false, talk: true });
    expect(p).toContain('"a": 1');
    expect(p).toContain('W1');
    expect(p).not.toContain('使えるエフェクト');
  });
});

import { describe, expect, it } from 'vitest';
import { parseColor } from '../src/engine/color';
import { EFFECTS, findEffect } from '../src/engine/effects';
import { EXAMPLE_PLAN_TEXT } from '../src/engine/example';
import { extractJsonText, parsePlan, parseReply, scaleOpacity } from '../src/engine/plan';
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

describe('multiple variants', () => {
  const plan = (title: string, effect = 'vignette') => JSON.stringify({ title, layers: [{ effect }] });
  it('reads every ```json block as a variant and keeps the prose', () => {
    const text = `3 案です。\n\n案1\n\`\`\`json\n${plan('静か')}\n\`\`\`\n案2\n\`\`\`json\n${plan('派手', 'burst')}\n\`\`\`\n案3\n\`\`\`json\n${plan('レトロ', 'oldFilm')}\n\`\`\`\nお好みでどうぞ`;
    const r = parseReply(text);
    expect(r.variants.map((v) => v.plan?.title)).toEqual(['静か', '派手', 'レトロ']);
    expect(r.variants[1].plan?.layers[0].effect.id).toBe('burst');
    expect(r.comment).toContain('3 案です');
    expect(r.comment).toContain('お好みでどうぞ');
    expect(r.comment).not.toContain('layers');
  });
  it('expands {"variations": [...]} and inherits shared fields', () => {
    const r = parseReply(
      JSON.stringify({
        format: 'ai-paste-effect',
        protect: [{ shape: 'ellipse', cx: 0.5, cy: 0.3, rx: 0.1, ry: 0.1 }],
        variations: [{ title: 'A', layers: [{ effect: 'blur' }] }, { title: 'B', layers: [{ effect: 'bloom' }] }],
      }),
    );
    expect(r.variants.length).toBe(2);
    expect(r.variants[1].plan?.layers[0].protect.length).toBe(1);
  });
  it('drops unreadable variants with a warning', () => {
    const r = parseReply(`\`\`\`json\n${plan('ok')}\n\`\`\`\n\`\`\`json\n{"layers": [{"effect": "nope"}]}\n\`\`\``);
    expect(r.variants.length).toBe(1);
    expect(r.variants[0].warnings[0]).toContain('案 2');
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
  it('asks for several variants when configured', () => {
    expect(buildInitialPrompt({ talk: true, variants: 3 })).toContain('3 案');
    expect(buildRevisionPrompt({ currentPlan: {}, includeSpec: false, talk: false, variants: 2, picked: [2, 3] })).toContain('全 3 案のうち、案 2');
  });
  it('includes current plan and warnings in revision prompt', () => {
    const p = buildRevisionPrompt({ currentPlan: { a: 1 }, warnings: ['W1'], includeSpec: false, talk: true });
    expect(p).toContain('"a": 1');
    expect(p).toContain('W1');
    expect(p).not.toContain('使えるエフェクト');
  });
});

describe('manga assets and presets', async () => {
  const { ALL_ASSETS, PACKS, ASSET_IDS, assetSvg, assetCatalog, findAsset, idFromFileName, svgDataAttrs, setPreferredPack } = await import(
    '../src/engine/assets'
  );
  it('discovers asset files and derives IDs and metadata', () => {
    expect(idFromFileName('comedy-sweatBig.svg')).toBe('comedy/sweatBig');
    expect(idFromFileName('sparkle.png')).toBe('misc/sparkle');
    expect(svgDataAttrs('<svg xmlns="x" data-label="大きな汗" data-size="0.2">')).toEqual({ label: '大きな汗', size: '0.2' });
    expect(PACKS.map((p) => p.id)).toEqual(expect.arrayContaining(['manga', 'manga-line']));
    expect(PACKS[0].id).toBe('manga');
    // 同じ ID は 1 つにまとめて AI に伝える
    expect(new Set(ASSET_IDS).size).toBe(ASSET_IDS.length);
  });
  it('switches between packs for the same asset ID', () => {
    expect(findAsset('comedy/sweatBig')?.pack).toBe('manga');
    setPreferredPack('manga-line');
    expect(findAsset('comedy/sweatBig')?.pack).toBe('manga-line');
    // 線画セットに無い素材は標準の絵
    expect(findAsset('gloom/rainCloud')?.pack).toBe('manga');
    expect(findAsset('comedy/sweatBig', 'manga')?.pack).toBe('manga');
    setPreferredPack('manga');
  });
  it('every asset in the manifest has an SVG with colour placeholders and a license', () => {
    expect(ALL_ASSETS.length).toBeGreaterThanOrEqual(20);
    for (const a of ALL_ASSETS) {
      const svg = assetSvg(a, '#123456', '#abcdef')!;
      expect(svg, a.id).toContain('<svg');
      expect(svg, a.id).not.toContain('__C1__');
      expect(a.license, a.id).toBeTruthy();
    }
    expect(assetCatalog()).toContain('shock/lines3');
  });
  it('parses illustrationOverlay and reactionScene layers', () => {
    const r = parsePlan(
      JSON.stringify({
        layers: [
          { effect: 'illustrationOverlay', params: { asset: 'comedy/sweatBig', position: { x: 0.7, y: 0.2 } } },
          { effect: 'reactionScene', params: { kind: 'awkward', face: { x: 0.4, y: 0.3 } } },
          { effect: 'illustrationOverlay', params: { asset: 'no/such' } },
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.plan?.layers.map((l) => l.effect.id)).toEqual(['illustrationOverlay', 'reactionScene', 'illustrationOverlay']);
    expect(r.plan?.layers[2].params.asset).toBe('shock/lines3');
    expect(r.warnings.some((w) => w.includes('asset'))).toBe(true);
  });
  it('lists the asset catalog in the prompt', () => {
    expect(buildInitialPrompt()).toContain('漫画素材カタログ');
  });
});

describe('intensity', () => {
  it('reads words and numbers, defaults to 1', () => {
    const at = (v: unknown) => parsePlan(JSON.stringify({ intensity: v, layers: [{ effect: 'blur' }] })).plan?.intensity;
    expect(at(undefined)).toBe(1);
    expect(at('subtle')).toBeLessThan(0.6);
    expect(at('strong')).toBe(1);
    expect(at(5)).toBe(2);
  });
  it('scales opacity down linearly and up toward 1', () => {
    expect(scaleOpacity(0.6, 1)).toBeCloseTo(0.6);
    expect(scaleOpacity(0.6, 0.5)).toBeCloseTo(0.3);
    expect(scaleOpacity(0.6, 0)).toBe(0);
    expect(scaleOpacity(0.6, 1.5)).toBeCloseTo(0.8);
    expect(scaleOpacity(0.6, 2)).toBeCloseTo(1);
  });
  it('tells the AI about the app-side strength and the directing guidelines', () => {
    const p = buildRevisionPrompt({ currentPlan: {}, includeSpec: false, talk: true, strength: 0.4 });
    expect(p).toContain('40%');
    const init = buildInitialPrompt();
    expect(init).toContain('演出の心得');
    expect(init).toContain('intensity');
    expect(init).toContain('awkward（静かな気まずさ）= ');
  });
});

describe('v0.8 details', async () => {
  const { exportFileName } = await import('../src/lib/image');
  it('makes unique, safe export names with the variant and title', () => {
    const at = new Date(2026, 9, 4, 13, 5, 9);
    expect(exportFileName('My Pic.png', 2, '夏の終わり/逆光', 'webp', at)).toBe('My_Pic_案2_夏の終わり_逆光_20261004-130509.webp');
    expect(exportFileName('', 0, undefined, 'png', at)).toBe('image_20261004-130509.png');
  });
  it('scales protect per layer with a number', () => {
    const r = parsePlan(
      JSON.stringify({
        protect: [{ shape: 'ellipse', cx: 0.5, cy: 0.3, rx: 0.1, ry: 0.1, strength: 0.8 }],
        layers: [{ effect: 'blur' }, { effect: 'blur', protect: 0.5 }, { effect: 'blur', protect: false }],
      }),
    );
    const ps = r.plan!.layers.map((l) => l.protect.map((x) => x.strength));
    expect(ps).toEqual([[0.8], [0.4], []]);
  });
});

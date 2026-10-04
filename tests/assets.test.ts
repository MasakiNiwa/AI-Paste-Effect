import { describe, expect, it } from 'vitest';
import { ALL_ASSETS, assetCatalog, assetSvg, findAsset, variantsOf } from '../src/engine/assets';
import { parsePlan } from '../src/engine/plan';

describe('delicate illustration pack integration', () => {
  const pack = ALL_ASSETS.filter((a) => a.pack === 'manga-delicate');
  it('discovers 12 compatible variants and 12 new meanings', () => {
    expect(pack).toHaveLength(24);
    expect(new Set(pack.map((a) => a.id)).size).toBe(24);
    expect(pack.filter((a) => variantsOf(a.id).some((v) => v.pack === 'manga'))).toHaveLength(12);
    for (const a of pack) {
      expect(findAsset(a.id, 'manga-delicate')?.pack).toBe('manga-delicate');
      expect(a.license).toBe('MIT');
      expect(a.label.length).toBeGreaterThan(15);
    }
  });
  it('publishes new meanings to the AI catalog and accepts all IDs in plans', () => {
    const catalog = assetCatalog();
    for (const a of pack) {
      expect(catalog).toContain(`"${a.id}"`);
      const result = parsePlan(JSON.stringify({ layers: [{ effect: 'illustrationOverlay', params: { asset: a.id, pack: 'manga-delicate' } }] }));
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.plan?.layers[0].params.asset).toBe(a.id);
    }
  });
  it('replaces both color tokens without external resources', () => {
    for (const a of pack) {
      const svg = assetSvg(a, '#123456', '#abcdef')!;
      expect(svg).toContain('viewBox="0 0 200 200"');
      expect(svg).toContain('#123456');
      expect(svg).not.toMatch(/__C[12]__|<script|href\s*=/i);
    }
  });
});

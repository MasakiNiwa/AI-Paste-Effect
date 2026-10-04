import { describe, expect, it } from 'vitest';
import { activeGpu, getGpuMode, gpuInfo, setGpuMode } from '../src/engine/gpu';
import { tryGpu } from '../src/engine/effects/util';
import type { EffectContext } from '../src/engine/types';

describe('GPU モード', () => {
  it('WebGL2 が無い環境では GPU なし（CPU で処理）になる', () => {
    setGpuMode('gpu');
    expect(getGpuMode()).toBe('gpu');
    expect(gpuInfo().available).toBe(false);
    expect(activeGpu()).toBeNull();
  });

  it('tryGpu は CPU モードでは何もしない', async () => {
    let called = false;
    const r = await tryGpu({ gpu: null } as EffectContext, () => {
      called = true;
      return 1;
    });
    expect(r).toBeNull();
    expect(called).toBe(false);
  });

  it('tryGpu は GPU 版が失敗したら null を返し、CPU 版に任せる', async () => {
    const ctx = { gpu: { run: () => { throw new Error('lost'); } } } as unknown as EffectContext;
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await tryGpu(ctx, (gpu) => gpu.run({ fragment: '', width: 1, height: 1 }))).toBeNull();
      expect(await tryGpu(ctx, () => 'ok')).toBe('ok');
    } finally {
      console.warn = warn;
    }
  });
});

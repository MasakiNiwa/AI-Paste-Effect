import { useEffect, useRef } from 'react';
import { parsePlan, type ParseResult } from '../engine/plan';
import { renderPlan } from '../engine/renderer';
import { canvasToDecodedUrl, loadImageFile } from '../lib/image';
import { useOutput, type Picture } from '../store/output';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';

// 同じテキストを何度も解析しないよう、直近の結果を覚えておく
const cache = new Map<string, ParseResult>();
export function parseCached(text: string): ParseResult {
  let r = cache.get(text);
  if (!r) {
    r = parsePlan(text);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    cache.set(text, r);
  }
  return r;
}

/** 入力中のテキストの解析結果（即時。表示用） */
export const useLiveParse = () => parseCached(useSession((s) => s.jsonText));
/** 適用中のテキストの解析結果（描画・修正依頼用） */
export const useAppliedParse = () => parseCached(useSession((s) => s.appliedText));

const swap = (prev: Picture | null, next: Picture | null) => {
  if (prev && prev.url !== next?.url) setTimeout(() => URL.revokeObjectURL(prev.url), 1000);
  return next;
};

/** 画像の読み込みと描画を行う。アプリ全体で 1 回だけマウントする。 */
export function usePipeline() {
  const imageFile = useSession((s) => s.imageFile);
  const maxSize = useSettings((s) => s.maxSize);
  const parsed = useAppliedParse();
  const original = useOutput((s) => s.original);
  const out = useOutput((s) => s.set);

  // 画像の読み込み
  useEffect(() => {
    let alive = true;
    out({ imageError: null });
    if (!imageFile) {
      out({ original: swap(useOutput.getState().original, null) });
      return;
    }
    loadImageFile(imageFile, maxSize)
      .then(async (canvas) => {
        const url = await canvasToDecodedUrl(canvas);
        if (alive) out({ original: swap(useOutput.getState().original, { canvas, url }) });
        else URL.revokeObjectURL(url);
      })
      .catch((e: Error) => alive && out({ imageError: e.message }));
    return () => {
      alive = false;
    };
  }, [imageFile, maxSize, out]);

  // 描画（入力が落ち着いてから）
  const renderId = useRef(0);
  useEffect(() => {
    const id = ++renderId.current;
    if (!original || !parsed.plan || parsed.errors.length > 0) {
      out({ result: swap(useOutput.getState().result, null), renderErrors: [], rendering: false, unseen: false });
      return;
    }
    out({ rendering: true });
    const timer = setTimeout(() => {
      renderPlan(original.canvas, parsed.plan!)
        .then(async ({ canvas, errors }) => {
          if (id !== renderId.current) return;
          // デコードし終えてから差し替える（白いチラつき防止）
          const url = await canvasToDecodedUrl(canvas);
          if (id !== renderId.current) return URL.revokeObjectURL(url);
          out({ result: swap(useOutput.getState().result, { canvas, url }), renderErrors: errors, unseen: true });
        })
        .catch((e: Error) => id === renderId.current && out({ renderErrors: [e.message] }))
        .finally(() => id === renderId.current && out({ rendering: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [original, parsed, out]);
}

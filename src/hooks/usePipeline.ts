import { useEffect, useRef } from 'react';
import { compilePlan, parseReply, type ParseResult, type ReplyResult } from '../engine/plan';
import { fitImage, renderPlan } from '../engine/renderer';
import { canvasToDecodedUrl, loadImageFile } from '../lib/image';
import { useOutput, type Picture } from '../store/output';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';

// 同じテキストを何度も解析しないよう、直近の結果を覚えておく
const cache = new Map<string, ReplyResult>();
export function parseCached(text: string): ReplyResult {
  let r = cache.get(text);
  if (!r) {
    r = parseReply(text);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    cache.set(text, r);
  }
  return r;
}

const EMPTY: ParseResult = { errors: [], warnings: [] };

/** 返答の中から 1 案を選ぶ（範囲外なら 1 案目、案が無ければエラーだけの結果） */
const failed = new WeakMap<ReplyResult, ParseResult>();
export function pickVariant(reply: ReplyResult, index: number): ParseResult {
  const v = reply.variants[index] ?? reply.variants[0];
  if (v) return v;
  // 毎回新しいオブジェクトを返すと描画の useEffect が回り続けるので、返答ごとに同じものを返す
  let f = failed.get(reply);
  if (!f) failed.set(reply, (f = { ...EMPTY, errors: reply.errors, comment: reply.comment }));
  return f;
}

/** 入力中のテキストの解析結果（即時。表示用） */
export const useLiveReply = () => parseCached(useSession((s) => s.jsonText));
/** 適用中の返答（全案） */
export const useAppliedReply = () => parseCached(useSession((s) => s.appliedText));
const compiledEdits = new WeakMap<object, ParseResult>();

/** 適用中の、選んでいる案（描画・修正依頼用）。手動編集があればそちらを使う */
export function useAppliedParse(): ParseResult {
  const reply = useAppliedReply();
  const variant = useSession((s) => s.variant);
  const edit = useSession((s) => s.edits[variant]);
  if (!edit) return pickVariant(reply, variant);
  let r = compiledEdits.get(edit);
  if (!r) compiledEdits.set(edit, (r = { ...compilePlan(edit), comment: reply.comment, edited: true }));
  return r;
}

const swap = (prev: Picture | null, next: Picture | null) => {
  if (prev && prev.url !== next?.url) setTimeout(() => URL.revokeObjectURL(prev.url), 1000);
  return next;
};

/** 画像の読み込みと描画を行う。アプリ全体で 1 回だけマウントする。 */
export function usePipeline() {
  const imageFile = useSession((s) => s.imageFile);
  const maxSize = useSettings((s) => s.maxSize);
  const parsed = useAppliedParse();
  const reply = useAppliedReply();
  const strength = useSession((s) => s.strength);
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
      renderPlan(original.canvas, parsed.plan!, strength)
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
  }, [original, parsed, strength, out]);

  // 複数案のサムネイル（小さく描いて切り替え用に並べる）
  const thumbId = useRef(0);
  useEffect(() => {
    const id = ++thumbId.current;
    const prev = useOutput.getState().thumbs;
    out({ thumbs: {} });
    Object.values(prev).forEach((u) => setTimeout(() => URL.revokeObjectURL(u), 1000));
    if (!original || reply.variants.length < 2) return;
    const small = fitImage(original.canvas, 360);
    (async () => {
      for (let i = 0; i < reply.variants.length; i++) {
        // 本番の描画を優先させる
        while (useOutput.getState().rendering) await new Promise((r) => setTimeout(r, 150));
        if (id !== thumbId.current) return;
        try {
          const { canvas } = await renderPlan(small, reply.variants[i].plan!);
          const url = await canvasToDecodedUrl(canvas);
          if (id !== thumbId.current) return URL.revokeObjectURL(url);
          out({ thumbs: { ...useOutput.getState().thumbs, [i]: url } });
        } catch {
          /* サムネイルは無くても切り替えはできる */
        }
      }
    })();
  }, [original, reply, out]);
}

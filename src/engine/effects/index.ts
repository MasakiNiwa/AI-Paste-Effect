/**
 * エフェクト登録簿。
 * 新しいエフェクトはファイルに defineEffect で定義し、ここの EFFECTS に加えるだけで
 * プロンプト・ヘルプ・JSON 解釈のすべてに反映される。
 */
import type { ParamSchema } from '../params';
import type { EffectDefinition } from '../types';
import * as color from './color';
import * as light from './light';
import * as particle from './particle';
import * as manga from './manga';
import * as texture from './texture';
import * as distortion from './distortion';

export type AnyEffect = EffectDefinition<any>;

export const EFFECTS: AnyEffect[] = [
  ...Object.values(color),
  ...Object.values(light),
  ...Object.values(particle),
  ...Object.values(manga),
  ...Object.values(texture),
  ...Object.values(distortion),
] as EffectDefinition<ParamSchema>[] as AnyEffect[];

const byId = new Map(EFFECTS.map((e) => [e.id.toLowerCase(), e]));

/** AI が大文字小文字やハイフンを揺らしても拾えるように緩く引く */
export function findEffect(id: string): AnyEffect | undefined {
  const key = id.trim().toLowerCase().replace(/[-_\s]/g, '');
  return byId.get(id.trim().toLowerCase()) ?? EFFECTS.find((e) => e.id.toLowerCase() === key);
}

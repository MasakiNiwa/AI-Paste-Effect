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
import * as reaction from './reaction';
import * as illustration from './illustration';
import * as scene from './scene';
import * as texture from './texture';
import * as photo from './photo';
import * as paint from './paint';
import * as distortion from './distortion';
import { TAMANI_EFFECTS } from './tamani';

export type AnyEffect = EffectDefinition<any>;

export const EFFECTS: AnyEffect[] = [
  ...Object.values(color),
  ...Object.values(light),
  ...Object.values(particle),
  ...Object.values(manga),
  ...Object.values(reaction),
  ...Object.values(illustration),
  ...Object.values(scene),
  ...Object.values(texture),
  ...Object.values(photo),
  ...Object.values(paint),
  ...Object.values(distortion),
  ...TAMANI_EFFECTS,
] as EffectDefinition<ParamSchema>[] as AnyEffect[];

const byId = new Map(EFFECTS.map((e) => [e.id.toLowerCase(), e]));

/** AI が大文字小文字やハイフンを揺らしても拾えるように緩く引く */
export function findEffect(id: string): AnyEffect | undefined {
  const key = id.trim().toLowerCase().replace(/[-_\s]/g, '');
  return byId.get(id.trim().toLowerCase()) ?? EFFECTS.find((e) => e.id.toLowerCase() === key);
}

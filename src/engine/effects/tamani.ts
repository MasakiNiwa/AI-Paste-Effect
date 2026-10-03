/**
 * 「たまにエフェクト」（TaMaNi-Effect）のエフェクトを AI Paste Effect の形式に変換するアダプター。
 *
 * src/vendor/tamani-effect/effects/defs/ に置かれた定義を自動で読み込み、
 * パラメータ宣言を相互変換して登録する。ID は "tamani.<元の ID>"。
 */
import type { EffectDefinition as TamaniEffect, ParamSchema as TamaniParam, ParamValues } from '../../vendor/tamani-effect/core/types';
import type { RGBA } from '../color';
import { p, type ParamSchema, type ParamSpec } from '../params';
import { mulberry32 } from '../random';
import { defineEffect, type EffectDefinition } from '../types';

const modules = import.meta.glob<TamaniEffect>('../../vendor/tamani-effect/effects/defs/*.ts', {
  eager: true,
  import: 'default',
});

const hex = (c: RGBA) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function describe(t: TamaniParam): string {
  const unit = 'unit' in t && t.unit ? `（単位: ${t.unit}）` : '';
  return `${t.label}${unit}${t.hint ? `。${t.hint}` : ''}`;
}

function convertParam(t: TamaniParam): ParamSpec {
  switch (t.type) {
    case 'range':
      return (t.step ?? 1) >= 1 && Number.isInteger(t.default)
        ? p.int(t.min, t.max, t.default, describe(t))
        : p.num(t.min, t.max, t.default, describe(t));
    case 'select':
      return p.enum(
        t.options.map((o) => o.value),
        t.default,
        `${describe(t)}（${t.options.map((o) => `${o.value}=${o.label}`).join(', ')}）`,
      );
    case 'color':
      return p.color(t.default, describe(t));
    case 'boolean':
      return p.bool(t.default, describe(t));
    case 'seed':
      return p.int(0, 999999, t.default, 'ランダムの種（変えると配置などが変わる）');
  }
}

/** 元の値（色は #rrggbb 文字列）に戻す */
function toTamaniValues(defs: TamaniParam[], v: Record<string, unknown>): ParamValues {
  const out: ParamValues = {};
  for (const t of defs) {
    const value = v[t.key];
    out[t.key] = t.type === 'color' ? hex(value as RGBA) : (value as number | string | boolean);
  }
  return out;
}

function adapt(t: TamaniEffect): EffectDefinition<ParamSchema> {
  const params: ParamSchema = Object.fromEntries(t.params.map((x) => [x.key, convertParam(x)]));
  return defineEffect({
    id: `tamani.${t.id}`,
    label: t.name,
    category: 'tamani',
    kind: 'filter',
    defaultBlend: 'normal',
    description: `${t.description}（たまにエフェクト由来。画像全体を加工するので、opacity・blend・region で加減して使う）`,
    params,
    render(ctx, v) {
      const values = toTamaniValues(t.params, v);
      const seed = typeof values.seed === 'number' ? values.seed : Math.floor(ctx.rng() * 1e6);
      return t.render(ctx.source, values, {
        width: ctx.width,
        height: ctx.height,
        unit: ctx.short / 1000,
        rng: mulberry32(seed),
      });
    },
  });
}

export const TAMANI_EFFECTS = Object.values(modules)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
  .map(adapt);

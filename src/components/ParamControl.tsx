import { MapPin, Minus, Plus } from 'lucide-react';
import { colorToJson } from '../engine/edit';
import { parseColor, type RGBA } from '../engine/color';
import type { ParamSpec, Point } from '../engine/params';
import { Switch } from './ui';

/** パラメータ説明を「見出し」と「補足」に分ける（例: "大きさ（短辺比）" → ["大きさ", "短辺比"]） */
export function splitLabel(desc: string): [string, string] {
  const m = /^(.*?)[（(](.+)[）)]\s*$/.exec(desc);
  return m ? [m[1], m[2]] : [desc, ''];
}

const fmt = (n: number, step: number) => (step >= 1 ? String(Math.round(n)) : n.toFixed(step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3));

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onStart,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** 操作の開始（元に戻す用の記録） */
  onStart?: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-12 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{fmt(value, step)}</span>
    </div>
  );
}

function ColorInput({ value, onChange, label }: { value: RGBA; onChange: (c: RGBA) => void; label: string }) {
  const hex = colorToJson({ ...value, a: 1 });
  return (
    <label className="relative inline-flex size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line" title={label}>
      <span className="checker absolute inset-0" />
      <span className="absolute inset-0" style={{ background: `rgba(${value.r},${value.g},${value.b},${value.a})` }} />
      <input
        type="color"
        aria-label={label}
        value={hex}
        onChange={(e) => onChange({ ...(parseColor(e.target.value) ?? value), a: value.a })}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

export interface ParamControlProps {
  name: string;
  spec: ParamSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  onStart: () => void;
  /** 位置パラメータを画像のタップで指定するモードにする */
  onPickPoint?: () => void;
  picking?: boolean;
}

/** パラメータ宣言から自動で作る操作部品 */
export function ParamControl({ name, spec, value, onChange, onStart, onPickPoint, picking }: ParamControlProps) {
  const [title, note] = splitLabel(spec.desc);
  const change = (v: unknown) => {
    onStart();
    onChange(v);
  };

  let control: React.ReactNode;
  switch (spec.type) {
    case 'number': {
      const step = spec.integer ? 1 : (spec.max - spec.min) / 200;
      control = (
        <Slider label={title} value={value as number} min={spec.min} max={spec.max} step={step} onStart={onStart} onChange={onChange} />
      );
      break;
    }
    case 'boolean':
      control = <Switch label={title} checked={value as boolean} onChange={change} />;
      break;
    case 'enum':
      control = (
        <select
          aria-label={title}
          value={value as string}
          onChange={(e) => change(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm"
        >
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case 'text':
      control = (
        <input
          aria-label={title}
          value={value as string}
          maxLength={spec.maxLength}
          onFocus={onStart}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm"
        />
      );
      break;
    case 'color':
      control = <ColorInput label={title} value={value as RGBA} onChange={change} />;
      break;
    case 'colors': {
      const list = value as RGBA[];
      control = (
        <div className="flex flex-wrap items-center gap-1.5">
          {list.map((c, i) => (
            <ColorInput key={i} label={`${title} ${i + 1}`} value={c} onChange={(nc) => change(list.map((x, j) => (j === i ? nc : x)))} />
          ))}
          {list.length > spec.minItems && (
            <button type="button" aria-label="色を減らす" onClick={() => change(list.slice(0, -1))} className="grid size-9 place-items-center rounded-lg border border-line text-muted">
              <Minus className="size-4" />
            </button>
          )}
          {list.length < spec.maxItems && (
            <button type="button" aria-label="色を増やす" onClick={() => change([...list, list[list.length - 1]])} className="grid size-9 place-items-center rounded-lg border border-line text-muted">
              <Plus className="size-4" />
            </button>
          )}
        </div>
      );
      break;
    }
    case 'point': {
      const p = value as Point;
      control = (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onPickPoint}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
              picking ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:bg-surface-2'
            }`}
          >
            <MapPin className="size-4" />
            {picking ? '画像をタップして位置を指定…' : '画像をタップして指定'}
          </button>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 text-xs text-muted">
            <span>横</span>
            <Slider label={`${title} 横`} value={p.x} min={-0.2} max={1.2} step={0.005} onStart={onStart} onChange={(x) => onChange({ ...p, x })} />
            <span>縦</span>
            <Slider label={`${title} 縦`} value={p.y} min={-0.2} max={1.2} step={0.005} onStart={onStart} onChange={(y) => onChange({ ...p, y })} />
          </div>
        </div>
      );
      break;
    }
  }

  return (
    <div className="space-y-1.5" data-param={name}>
      <p className="text-xs">
        <span className="font-semibold">{title}</span>
        {note && <span className="ml-1 text-muted">{note}</span>}
      </p>
      {control}
    </div>
  );
}

/** 色の解析と変換。DOM に依存しない（テスト可能）。 */

export interface RGBA {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  pink: '#ffc0cb',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  gold: '#ffd700',
  transparent: '#00000000',
};

export function parseColor(input: string): RGBA | undefined {
  const s = input.trim().toLowerCase();
  if (NAMED[s]) return parseColor(NAMED[s]);

  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let hex = m[1];
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
  }

  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const c = (v: string) => Math.min(255, Math.max(0, Math.round(Number(v))));
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
    return { r: c(m[1]), g: c(m[2]), b: c(m[3]), a: Math.min(1, Math.max(0, a)) };
  }
  return undefined;
}

export function css(c: RGBA, alphaMul = 1): string {
  return `rgba(${c.r},${c.g},${c.b},${Math.min(1, Math.max(0, c.a * alphaMul))})`;
}

/** 0xRRGGBB（PixiJS 用） */
export function toHexNumber(c: RGBA): number {
  return (c.r << 16) | (c.g << 8) | c.b;
}

export function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

/** 色リストを 0..1 の位置で補間（グラデーションマップ等） */
export function sampleStops(colors: RGBA[], t: number): RGBA {
  if (colors.length === 1) return colors[0];
  const x = Math.min(1, Math.max(0, t)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  return lerpColor(colors[i], colors[i + 1], x - i);
}

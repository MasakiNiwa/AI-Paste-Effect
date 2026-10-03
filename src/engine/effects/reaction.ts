import rough from 'roughjs';
import { css, type RGBA } from '../color';
import { loadMangaFont, MANGA_FONTS, type MangaFont } from '../fonts';
import { p } from '../params';
import { range } from '../random';
import { defineEffect } from '../types';
import { ctx2d } from './util';

const FONT_KEYS = Object.keys(MANGA_FONTS) as MangaFont[];

export const burst = defineEffect({
  id: 'burst',
  label: 'フラッシュ・爆発',
  category: 'reaction',
  kind: 'overlay',
  defaultBlend: 'normal',
  description:
    '漫画の衝撃演出。style: "uni"（ウニフラッシュ。中心の周りにトゲ状の細い線が密集＝驚き・ひらめき・ときめき）/ "beta"（ベタフラッシュ。周囲を塗りつぶしてトゲで中心を抜く＝衝撃・ショック・決めシーン）/ "explosion"（ギザギザの爆発形＝爆発・叫び・ドカン）。',
  params: {
    style: p.enum(['uni', 'beta', 'explosion'] as const, 'uni', '種類'),
    center: p.point(0.5, 0.45, '中心'),
    innerRx: p.num(0.02, 1, 0.28, '中心の空き（explosion では爆発の大きさ）の横半径（画像幅比）'),
    innerRy: p.num(0.02, 1, 0.3, '同・縦半径（画像高さ比）'),
    spikes: p.int(8, 400, 120, 'トゲの数（explosion は 8〜30 程度）'),
    length: p.num(0.05, 1.5, 0.35, 'トゲの長さ（短辺比）'),
    color: p.color('#000000', '線・塗りの色'),
    fill: p.color('#ffffff', 'explosion の塗り色'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    const cx = v.center.x * W;
    const cy = v.center.y * H;
    const rx = v.innerRx * W;
    const ry = v.innerRy * H;
    const len = v.length * ctx.short;
    const at = (a: number, k: number, extra = 0) =>
      [cx + Math.cos(a) * (rx * k + extra), cy + Math.sin(a) * (ry * k + extra)] as const;

    if (v.style === 'uni') {
      // 内側の楕円から外向きに伸びる、両端が細い針
      g.fillStyle = css(v.color);
      for (let i = 0; i < v.spikes; i++) {
        const a = ((i + range(ctx.rng, -0.5, 0.5)) / v.spikes) * Math.PI * 2;
        const k = range(ctx.rng, 0.95, 1.15);
        const l = len * range(ctx.rng, 0.35, 1);
        const w = ctx.short * range(ctx.rng, 0.002, 0.006);
        const [sx, sy] = at(a, k);
        const [ex, ey] = at(a, k, l);
        const [mx, my] = at(a, k, l * 0.25);
        const nx = -Math.sin(a) * w;
        const ny = Math.cos(a) * w;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(mx + nx, my + ny);
        g.lineTo(ex, ey);
        g.lineTo(mx - nx, my - ny);
        g.closePath();
        g.fill();
      }
    } else if (v.style === 'beta') {
      // 全面を塗り、中心からトゲ状に抜く
      g.fillStyle = css(v.color);
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      for (let i = 0; i < v.spikes; i++) {
        const a0 = (i / v.spikes) * Math.PI * 2;
        const a1 = ((i + 0.5) / v.spikes) * Math.PI * 2;
        const [ix, iy] = at(a0, range(ctx.rng, 1, 1.15));
        const [ox, oy] = at(a1, 1, len * range(ctx.rng, 0.4, 1.3));
        if (i === 0) g.moveTo(ix, iy);
        else g.lineTo(ix, iy);
        g.lineTo(ox, oy);
      }
      g.closePath();
      g.fill();
    } else {
      const n = Math.min(60, v.spikes);
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + range(ctx.rng, -0.08, 0.08);
        const k = i % 2 === 0 ? range(ctx.rng, 1, 1.35) : range(ctx.rng, 0.6, 0.78);
        const [x, y] = at(a, k);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = css(v.fill);
      g.fill();
      g.lineJoin = 'miter';
      g.lineWidth = Math.max(2, ctx.short * 0.008);
      g.strokeStyle = css(v.color);
      g.stroke();
    }
    return out;
  },
});

export const gloomLines = defineEffect({
  id: 'gloomLines',
  label: '縦線（どんより）',
  category: 'reaction',
  kind: 'overlay',
  defaultBlend: 'multiply',
  description:
    '上から垂れ下がる縦線。落ち込み・ガーン・青ざめ・気まずさの演出。region でキャラの頭上〜顔の範囲に限定し、色は黒か暗い青紫が定番。',
  params: {
    count: p.int(3, 300, 40, '線の本数'),
    length: p.num(0.05, 1, 0.45, '線の長さ（画像高さ比）'),
    thickness: p.num(0.001, 0.02, 0.004, '太さ（短辺比）'),
    color: p.color('#1d1f3a', '線の色'),
    shade: p.num(0, 1, 0.35, '線の後ろの影の濃さ'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const { width: W, height: H } = ctx;
    if (v.shade > 0) {
      const grad = g.createLinearGradient(0, 0, 0, H * v.length);
      grad.addColorStop(0, css(v.color, v.shade));
      grad.addColorStop(1, css(v.color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H * v.length);
    }
    for (let i = 0; i < v.count; i++) {
      const x = ((i + range(ctx.rng, 0.1, 0.9)) / v.count) * W;
      const l = H * v.length * range(ctx.rng, 0.5, 1);
      const grad = g.createLinearGradient(0, 0, 0, l);
      grad.addColorStop(0, css(v.color));
      grad.addColorStop(1, css(v.color, 0));
      g.fillStyle = grad;
      g.fillRect(x, 0, Math.max(1, v.thickness * ctx.short * range(ctx.rng, 0.6, 1.3)), l);
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// 漫符（roughjs で手描き風に描く）

type MarkKind = 'anger' | 'sweat' | 'exclamation' | 'question' | 'heart' | 'note' | 'shock' | 'blush' | 'tangle' | 'sleep';

const MARK_COLORS: Record<MarkKind, [string, string]> = {
  // [線, 塗り]
  anger: ['#e0302c', 'transparent'],
  sweat: ['#3a6fa8', '#bfe3ff'],
  exclamation: ['#111111', '#111111'],
  question: ['#111111', 'transparent'],
  heart: ['#d23a6a', '#ff7aa2'],
  note: ['#111111', '#111111'],
  shock: ['#111111', 'transparent'],
  blush: ['#e8506a', 'transparent'],
  tangle: ['#222222', 'transparent'],
  sleep: ['#3a4a6a', 'transparent'],
};

/** 100×100（中心原点）の座標で漫符を描く */
function drawMark(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, kind: MarkKind, stroke: string, fill: string, roughness: number, seed: number) {
  const rc = rough.canvas(canvas);
  const o = { stroke, strokeWidth: 7, roughness, seed, fill: fill === 'transparent' ? undefined : fill, fillStyle: 'solid', bowing: 1.2 };
  const line = { ...o, fill: undefined };
  switch (kind) {
    case 'anger':
      for (let k = 0; k < 4; k++) {
        g.save();
        g.rotate((k * Math.PI) / 2);
        rc.path('M 12 -42 Q 12 -12 42 -12', { ...line, strokeWidth: 10 });
        g.restore();
      }
      break;
    case 'sweat':
      rc.path('M 0 -48 C 18 -18 32 0 32 20 C 32 38 18 48 0 48 C -18 48 -32 38 -32 20 C -32 0 -18 -18 0 -48 Z', o);
      rc.path('M -14 14 Q -16 28 -6 34', { ...line, stroke: '#ffffff', strokeWidth: 5 });
      break;
    case 'exclamation':
      rc.path('M -11 -48 L 11 -48 L 5 18 L -5 18 Z', o);
      rc.circle(0, 38, 18, o);
      break;
    case 'question':
      rc.path('M -24 -22 C -24 -52 24 -52 24 -24 C 24 -6 2 -6 2 16', { ...line, strokeWidth: 11 });
      rc.circle(2, 38, 16, { ...o, fill: stroke });
      break;
    case 'heart':
      rc.path('M 0 40 C -62 0 -40 -52 0 -20 C 40 -52 62 0 0 40 Z', o);
      break;
    case 'note':
      rc.ellipse(-14, 30, 32, 22, o);
      rc.line(1, 28, 1, -46, line);
      rc.path('M 1 -46 Q 22 -36 26 -12', line);
      break;
    case 'shock':
      rc.line(-26, -8, -46, -46, line);
      rc.line(0, -16, 0, -56, line);
      rc.line(26, -8, 46, -46, line);
      break;
    case 'blush':
      for (let i = -2; i <= 2; i++) rc.line(i * 16 - 6, 14, i * 16 + 6, -14, { ...line, strokeWidth: 5 });
      break;
    case 'tangle':
      for (let i = 0; i < 4; i++) rc.ellipse(0, 0, 80 - i * 12, 60 - i * 8, { ...line, strokeWidth: 3, roughness: Math.max(2, roughness * 2.5), seed: seed + i });
      break;
    case 'sleep':
      g.font = '700 40px sans-serif';
      g.fillStyle = stroke;
      g.fillText('Z', -30, 30);
      g.font = '700 28px sans-serif';
      g.fillText('z', 6, -2);
      g.font = '700 20px sans-serif';
      g.fillText('z', 28, -26);
      break;
  }
}

export const emotionMark = defineEffect({
  id: 'emotionMark',
  label: '漫符',
  category: 'reaction',
  kind: 'overlay',
  defaultBlend: 'normal',
  description:
    '感情を表す漫画記号（手描き風）。kind: anger(怒りマーク) / sweat(汗) / exclamation(!) / question(?) / heart / note(♪) / shock(驚きの線) / blush(頬の斜線) / tangle(もやもや) / sleep(Zzz)。position は頭の横や頬など、キャラに合わせて置く。',
  params: {
    kind: p.enum(['anger', 'sweat', 'exclamation', 'question', 'heart', 'note', 'shock', 'blush', 'tangle', 'sleep'] as const, 'sweat', '種類'),
    position: p.point(0.65, 0.25, '置く位置（記号の中心）'),
    size: p.num(0.02, 0.5, 0.12, '大きさ（短辺比）'),
    angle: p.num(-180, 180, 0, '傾き（度）'),
    count: p.int(1, 5, 1, '並べる数（少しずつずらして置く）'),
    color: p.color('#00000000', '線の色（省略で種類ごとの標準色）'),
    fill: p.color('#00000000', '塗りの色（省略で種類ごとの標準色）'),
    roughness: p.num(0, 3, 1, '手描きっぽさ（0 できれいな線）'),
  },
  render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const [defStroke, defFill] = MARK_COLORS[v.kind];
    const pick = (c: RGBA, def: string) => (c.a === 0 ? def : css(c));
    const scale = (v.size * ctx.short) / 100;
    for (let i = 0; i < v.count; i++) {
      g.save();
      const dx = i * 0.9 * v.size * ctx.short;
      const dy = (i % 2 === 0 ? 0 : -0.4) * v.size * ctx.short;
      g.translate(v.position.x * ctx.width + dx, v.position.y * ctx.height + dy);
      g.rotate(((v.angle + (i > 0 ? range(ctx.rng, -15, 15) : 0)) * Math.PI) / 180);
      const s = scale * (i > 0 ? range(ctx.rng, 0.6, 0.85) : 1);
      g.scale(s, s);
      drawMark(out, g, v.kind, pick(v.color, defStroke), pick(v.fill, defFill), v.roughness, Math.floor(ctx.rng() * 1e6) + 1);
      g.restore();
    }
    return out;
  },
});

// ---------------------------------------------------------------------------

export const soundText = defineEffect({
  id: 'soundText',
  label: '描き文字（擬音）',
  category: 'reaction',
  kind: 'overlay',
  defaultBlend: 'normal',
  description: `漫画の描き文字・擬音語（ドーン!、ゴゴゴ、キラーン、しーん など）。font: ${FONT_KEYS.map((k) => `${k}（${MANGA_FONTS[k].note}）`).join(' / ')}。キャラや顔に重ならない余白に置く。`,
  params: {
    text: p.text('ドーン!', '文字（短く。改行は不可）', 12),
    font: p.enum(FONT_KEYS, 'impact', '書体'),
    position: p.point(0.75, 0.2, '文字の中心'),
    size: p.num(0.03, 0.5, 0.14, '1 文字の大きさ（短辺比）'),
    angle: p.num(-90, 90, -8, '全体の傾き（度）'),
    vertical: p.bool(false, '縦書きにする'),
    jitter: p.num(0, 1, 0.35, '文字ごとの傾き・大きさの揺らぎ（勢い）'),
    color: p.color('#111111', '文字の色'),
    stroke: p.color('#ffffff', '縁取りの色'),
    strokeWidth: p.num(0, 0.4, 0.14, '縁取りの太さ（文字サイズ比）'),
  },
  async render(ctx, v) {
    const out = ctx.createCanvas();
    const g = ctx2d(out);
    const chars = [...v.text];
    if (chars.length === 0) return out;
    const px = v.size * ctx.short;
    const { weight, family } = await loadMangaFont(v.font, v.text);
    g.font = `${weight} ${px}px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';

    // 各文字の位置（中心からの相対）
    const step = px * 0.92;
    const total = step * (chars.length - 1);
    g.translate(v.position.x * ctx.width, v.position.y * ctx.height);
    g.rotate((v.angle * Math.PI) / 180);
    const glyphs = chars.map((ch, i) => {
      const t = i * step - total / 2;
      // 縦書きで横向きになるべき記号（ー・〜）は回転させる
      const turn = v.vertical && /[ー〜～\-]/.test(ch) ? Math.PI / 2 : 0;
      return {
        ch,
        x: v.vertical ? 0 : t,
        y: v.vertical ? t : 0,
        rot: turn + range(ctx.rng, -0.35, 0.35) * v.jitter,
        scale: 1 + range(ctx.rng, -0.2, 0.25) * v.jitter,
        dy: range(ctx.rng, -0.12, 0.12) * px * v.jitter,
      };
    });
    const each = (draw: (ch: string) => void) => {
      for (const gl of glyphs) {
        g.save();
        g.translate(gl.x, gl.y + gl.dy);
        g.rotate(gl.rot);
        g.scale(gl.scale, gl.scale);
        draw(gl.ch);
        g.restore();
      }
    };
    if (v.strokeWidth > 0) {
      g.lineWidth = px * v.strokeWidth * 2;
      g.strokeStyle = css(v.stroke);
      each((ch) => g.strokeText(ch, 0, 0));
    }
    g.fillStyle = css(v.color);
    each((ch) => g.fillText(ch, 0, 0));
    return out;
  },
});

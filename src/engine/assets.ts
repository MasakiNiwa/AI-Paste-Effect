/**
 * イラスト素材の台帳と読み込み。
 *
 * ■ ファイルを置くだけで認識する
 *   src/assets/<パック名>/svg/<グループ>-<名前>.svg   → 素材 ID "<グループ>/<名前>"
 *   src/assets/<パック名>/img/<グループ>-<名前>.png|webp（色の差し替えはできない）
 *   例: src/assets/my-pack/svg/comedy-sweatBig.svg → "comedy/sweatBig"
 *
 * ■ 説明などの情報（どれも省略可。上にあるものが優先）
 *   1. パックの manifest.json の assets 配列（file 名で対応）
 *   2. SVG の <svg> 要素の data-label / data-tags / data-size / data-colors / data-license / data-author 属性
 *   3. ファイル名から自動で作る
 *   パック全体の名前・作者・ライセンスは pack.json（{ "name", "author", "license" }）に書ける。
 *
 * ■ 素材セット（同じ意味の別の絵）
 *   複数のパックに同じ素材 ID のファイルがあれば、それらは「同じ意味の別の絵」として扱い、
 *   ユーザーが設定や編集タブでどのパックの絵を使うかを選べる。AI には素材 ID（意味）だけを伝える。
 *
 * SVG の中の "__C1__"（主色）と "__C2__"（副色）は描画時に指定色へ置き換える。
 */

export interface AssetMeta {
  /** 素材 ID（意味）。例: "comedy/sweatBig" */
  id: string;
  /** パック名（フォルダ名） */
  pack: string;
  file: string;
  kind: 'svg' | 'image';
  label: string;
  tags: string[];
  /** [主色, 副色] の既定値 */
  colors: [string, string];
  /** 推奨の大きさ（短辺比） */
  size: number;
  license: string;
  author: string;
}

export interface PackMeta {
  id: string;
  name: string;
  author: string;
  license: string;
  count: number;
}

interface ManifestEntry {
  id?: string;
  file: string;
  label?: string;
  tags?: string[];
  colors?: [string, string];
  size?: number;
  license?: string;
  author?: string;
}

const svgFiles = import.meta.glob<string>('../assets/*/svg/*.svg', { query: '?raw', import: 'default', eager: true });
const imageFiles = import.meta.glob<string>('../assets/*/img/*.{png,webp}', { query: '?url', import: 'default', eager: true });
const manifests = import.meta.glob<{ assets?: ManifestEntry[] }>('../assets/*/manifest.json', { import: 'default', eager: true });
const packJsons = import.meta.glob<Partial<PackMeta>>('../assets/*/pack.json', { import: 'default', eager: true });

const packOf = (path: string) => path.split('/').at(-3)!;
const fileOf = (path: string) => path.split('/').at(-1)!;

/** "comedy-sweatBig.svg" → "comedy/sweatBig"（最初の "-" でグループと名前に分ける） */
export function idFromFileName(file: string): string {
  const stem = file.replace(/\.[^.]+$/, '');
  const i = stem.indexOf('-');
  return i > 0 ? `${stem.slice(0, i)}/${stem.slice(i + 1)}` : `misc/${stem}`;
}

/** SVG のルート要素の data-* 属性を読む */
export function svgDataAttrs(svg: string): Record<string, string> {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const out: Record<string, string> = {};
  for (const m of root.matchAll(/\bdata-([a-z-]+)\s*=\s*"([^"]*)"/gi)) out[m[1].toLowerCase()] = m[2];
  return out;
}

function buildAsset(path: string, kind: AssetMeta['kind'], svg?: string): AssetMeta {
  const pack = packOf(path);
  const file = fileOf(path);
  const packMeta = packJsons[`../assets/${pack}/pack.json`] ?? {};
  const m = manifests[`../assets/${pack}/manifest.json`]?.assets?.find((a) => a.file === file) ?? ({} as Partial<ManifestEntry>);
  const d = svg ? svgDataAttrs(svg) : {};
  const id = m.id ?? d.id ?? idFromFileName(file);
  const colors = (m.colors ?? (d.colors ? (d.colors.split(',').map((c) => c.trim()) as [string, string]) : undefined)) ?? ['#111111', '#ffffff'];
  return {
    id,
    pack,
    file,
    kind,
    label: m.label ?? d.label ?? id.split('/')[1],
    tags: m.tags ?? (d.tags ? d.tags.split(',').map((t) => t.trim()) : [id.split('/')[0]]),
    colors: [colors[0] ?? '#111111', colors[1] ?? colors[0] ?? '#ffffff'],
    size: m.size ?? (d.size ? Number(d.size) || 0.25 : 0.25),
    license: m.license ?? d.license ?? packMeta.license ?? '不明',
    author: m.author ?? d.author ?? packMeta.author ?? '不明',
  };
}

/** 標準のパック（同じ ID が複数ある時、ユーザーが選んでいなければこれを使う） */
export const DEFAULT_PACK = 'manga';

/** すべての素材（同じ ID の別の絵も含む） */
export const ALL_ASSETS: AssetMeta[] = [
  ...Object.entries(svgFiles).map(([p, svg]) => buildAsset(p, 'svg', svg)),
  ...Object.keys(imageFiles).map((p) => buildAsset(p, 'image')),
].sort((a, b) => a.id.localeCompare(b.id) || (a.pack === DEFAULT_PACK ? -1 : b.pack === DEFAULT_PACK ? 1 : a.pack.localeCompare(b.pack)));

export const PACKS: PackMeta[] = [...new Set(ALL_ASSETS.map((a) => a.pack))]
  .map((id) => {
    const meta = packJsons[`../assets/${id}/pack.json`] ?? {};
    const any = ALL_ASSETS.find((a) => a.pack === id)!;
    return {
      id,
      name: meta.name ?? id,
      author: meta.author ?? any.author,
      license: meta.license ?? any.license,
      count: ALL_ASSETS.filter((a) => a.pack === id).length,
    };
  })
  .sort((a, b) => (a.id === DEFAULT_PACK ? -1 : b.id === DEFAULT_PACK ? 1 : a.id.localeCompare(b.id)));

/** 素材 ID（意味）の一覧。AI にはこれだけを伝える */
export const ASSET_IDS = [...new Set(ALL_ASSETS.map((a) => a.id))];

/** 同じ素材 ID の別の絵（パックごと） */
export const variantsOf = (id: string) => ALL_ASSETS.filter((a) => a.id.toLowerCase() === id.trim().toLowerCase());

let preferredPack: string = DEFAULT_PACK;
/** ユーザーが選んだ素材セット（パック）。その絵があれば優先して使う */
export function setPreferredPack(pack: string) {
  preferredPack = pack;
}
export const getPreferredPack = () => preferredPack;

/**
 * 素材 ID から実際に使う絵を決める。pack を指定すればそのパック、
 * なければユーザーの選んだパック → 標準のパック → 見つかったもの の順。
 */
export function findAsset(id: string, pack?: string): AssetMeta | undefined {
  const list = variantsOf(id);
  if (list.length === 0) return undefined;
  for (const p of [pack, preferredPack, DEFAULT_PACK]) {
    const hit = p && p !== 'auto' ? list.find((a) => a.pack === p) : undefined;
    if (hit) return hit;
  }
  return list[0];
}

const svgPath = (a: AssetMeta) => `../assets/${a.pack}/svg/${a.file}`;
const imagePath = (a: AssetMeta) => `../assets/${a.pack}/img/${a.file}`;

/** 色を差し替えた SVG 文字列（画像素材では undefined） */
export function assetSvg(a: AssetMeta, c1: string, c2: string): string | undefined {
  if (a.kind !== 'svg') return undefined;
  return svgFiles[svgPath(a)].replaceAll('__C1__', c1).replaceAll('__C2__', c2);
}

/** 一覧表示用の URL（既定色の SVG はデータ URL、画像はそのまま） */
export function assetPreviewUrl(a: AssetMeta): string {
  if (a.kind === 'image') return imageFiles[imagePath(a)];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(assetSvg(a, a.colors[0], a.colors[1])!)}`;
}

/** SVG の viewBox（優先）または寸法から縦横比を求める。旧素材は正方形。 */
export function svgAspectRatio(svg: string): number {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];
  if (viewBox) {
    const values = viewBox.trim().split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) return values[2] / values[3];
  }
  const dimension = (name: string) => {
    const value = new RegExp(`\\b${name}\\s*=\\s*["']([0-9.]+)(?:px)?["']`, 'i').exec(root)?.[1];
    return value ? Number(value) : 0;
  };
  const w = dimension('width'), h = dimension('height');
  return w > 0 && h > 0 && Number.isFinite(w / h) ? w / h : 1;
}

const images = new Map<string, Promise<HTMLImageElement>>();

/** 色を差し替えた素材を、指定ピクセルサイズで描ける画像として読み込む */
export function loadAssetImage(a: AssetMeta, c1: string, c2: string, px: number): Promise<HTMLImageElement> {
  // 大きく描く時にぼやけないよう、SVG 自体の幅・高さを描画サイズに合わせる
  const size = Math.max(16, Math.ceil(px / 64) * 64);
  const key = a.kind === 'svg' ? `${a.pack}:${a.id}|${c1}|${c2}|${size}` : `${a.pack}:${a.id}`;
  if (!images.has(key)) {
    let url: string;
    let blobUrl = false;
    if (a.kind === 'svg') {
      // 幅・高さの指定を描画サイズに置き換える（無ければ足す）
      const raw = assetSvg(a, c1, c2)!;
      const height = Math.max(1, Math.round(size / svgAspectRatio(raw)));
      let svg = raw.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
        const rest = attrs.replace(/\s(width|height)=["'][^"']*["']/gi, '');
        return `<svg${rest} width="${size}" height="${height}">`;
      });
      if (!/viewBox=/i.test(svg)) svg = svg.replace('<svg', '<svg viewBox="0 0 200 200"');
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      blobUrl = true;
    } else {
      url = imageFiles[imagePath(a)];
    }
    const img = new Image();
    img.src = url;
    images.set(
      key,
      img.decode().then(
        () => img,
        (e) => {
          images.delete(key);
          throw e;
        },
      ).finally(() => { if (blobUrl) URL.revokeObjectURL(url); }),
    );
    if (images.size > 160) images.delete(images.keys().next().value!);
  }
  return images.get(key)!;
}

/** AI 向けの軽い素材カタログ（素材 ID と一言説明だけ。絵柄の選択はユーザーに任せる） */
export function assetCatalog(): string {
  const groups = new Map<string, AssetMeta[]>();
  for (const id of ASSET_IDS) {
    const a = findAsset(id, DEFAULT_PACK)!;
    const g = id.split('/')[0];
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }
  return [...groups.entries()]
    .map(([g, list]) => `- ${g}: ${list.map((a) => `"${a.id}"（${a.label}。目安 size ${a.size}）`).join(' / ')}`)
    .join('\n');
}

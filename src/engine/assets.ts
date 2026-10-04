/**
 * イラスト素材（SVG）の台帳と読み込み。
 *
 * 素材は src/assets/<パック>/svg/*.svg に置き、manifest.json に ID・説明・タグ・既定色・ライセンスを書く。
 * SVG の中の "__C1__"（主色）と "__C2__"（副色）は描画時に指定色へ置き換える。
 */
import manifest from '../assets/manga/manifest.json';

export interface AssetMeta {
  id: string;
  file: string;
  label: string;
  tags: string[];
  /** [主色, 副色] の既定値 */
  colors: [string, string];
  /** 推奨の大きさ（短辺比） */
  size: number;
  defaultBlend: string;
  license: string;
  author: string;
}

const svgFiles = import.meta.glob<string>('../assets/*/svg/*.svg', { query: '?raw', import: 'default', eager: true });

export const ASSETS: AssetMeta[] = (manifest.assets as AssetMeta[]).filter((a) =>
  Object.keys(svgFiles).some((k) => k.endsWith(`/svg/${a.file}`)),
);

export const ASSET_IDS = ASSETS.map((a) => a.id);

const byId = new Map(ASSETS.map((a) => [a.id.toLowerCase(), a]));
export const findAsset = (id: string) => byId.get(id.trim().toLowerCase());

function svgSource(a: AssetMeta): string {
  const key = Object.keys(svgFiles).find((k) => k.endsWith(`/svg/${a.file}`))!;
  return svgFiles[key];
}

/** 色を差し替えた SVG 文字列 */
export function assetSvg(a: AssetMeta, c1: string, c2: string): string {
  return svgSource(a).replaceAll('__C1__', c1).replaceAll('__C2__', c2);
}

const images = new Map<string, Promise<HTMLImageElement>>();

/** 色を差し替えた SVG を、指定ピクセルサイズでラスタライズできる画像として読み込む */
export function loadAssetImage(a: AssetMeta, c1: string, c2: string, px: number): Promise<HTMLImageElement> {
  // 大きく描く時にぼやけないよう、SVG 自体の幅・高さを描画サイズに合わせる
  const size = Math.max(16, Math.ceil(px / 64) * 64);
  const key = `${a.id}|${c1}|${c2}|${size}`;
  if (!images.has(key)) {
    const svg = assetSvg(a, c1, c2).replace(/width="200" height="200"/, `width="${size}" height="${size}"`);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
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
      ),
    );
    if (images.size > 120) images.delete(images.keys().next().value!);
  }
  return images.get(key)!;
}

/** AI 向けの軽い素材カタログ（ID と一言説明だけ） */
export function assetCatalog(): string {
  const groups = new Map<string, AssetMeta[]>();
  for (const a of ASSETS) {
    const g = a.id.split('/')[0];
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }
  return [...groups.entries()]
    .map(([g, list]) => `- ${g}: ${list.map((a) => `"${a.id}"（${a.label}。目安 size ${a.size}）`).join(' / ')}`)
    .join('\n');
}

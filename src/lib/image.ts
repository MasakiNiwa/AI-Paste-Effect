import { fitImage } from '../engine/renderer';

export async function loadImageFile(file: Blob, maxSize: number): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルではありません');
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = fitImage(bmp, maxSize);
    bmp.close();
    return c;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return fitImage(img, maxSize);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpeg' | 'webp'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の書き出しに失敗しました'))), `image/${format}`, 0.92),
  );
}

/** 実際に書き出された形式の拡張子（WebP 非対応のブラウザは PNG になる） */
export function extensionOf(blob: Blob): string {
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/webp') return 'webp';
  return 'png';
}

/** キャンバスを表示用の URL にし、デコード完了まで待つ（差し替え時のチラつき防止） */
export async function canvasToDecodedUrl(canvas: HTMLCanvasElement): Promise<string> {
  const url = URL.createObjectURL(await canvasToBlob(canvas, 'png'));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    /* デコードできなくても URL は使える */
  }
  return url;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ファイル名に使えない文字を除く */
const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * 保存するファイル名。「元の名前_案2_タイトル_時刻.png」のようにして、
 * 複数の案や何度かの保存で同じ名前にならないようにする。
 */
export function exportFileName(imageName: string, variantNo: number, title: string | undefined, ext: string, now = new Date()): string {
  const base = safe(imageName.replace(/\.[^.]+$/, '')).slice(0, 30) || 'image';
  const parts = [base];
  if (variantNo > 0) parts.push(`案${variantNo}`);
  if (title) parts.push(safe(title).slice(0, 20));
  const p2 = (n: number) => String(n).padStart(2, '0');
  parts.push(`${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`);
  return `${parts.filter(Boolean).join('_')}.${ext}`;
}

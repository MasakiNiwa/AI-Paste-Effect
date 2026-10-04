/**
 * 描き文字用の Google Fonts（すべて SIL Open Font License）。
 * 使う文字だけを text= で指定して読み込むので、日本語フォントでも数 KB で済む。
 * オフライン等で読み込めない時は太字のゴシックで代用する。
 */
export const MANGA_FONTS = {
  impact: { family: 'Dela Gothic One', note: '極太ゴシック。ドーン!・バーン!などの衝撃音' },
  pop: { family: 'Mochiy Pop One', note: '丸くて太いポップ体。ワクワク・ポン' },
  rock: { family: 'RocknRoll One', note: '勢いのある太字。ゴゴゴ・ザッ' },
  brush: { family: 'Yuji Boku', note: '筆文字。ズーン・しーん・和風' },
  cute: { family: 'Hachi Maru Pop', note: '丸文字の手書き。きゅん・ドキドキ。全角の「！」「？」は点がハートになるので、甘い場面以外では半角の ! ? を使う' },
  outline: { family: 'Rampart One', note: '立体的な袋文字。タイトル・強調' },
  retro: { family: 'Reggae One', note: 'レトロで個性的。ギャグ・ドヤァ' },
  dot: { family: 'DotGothic16', note: 'ドット文字。ゲーム・電子音' },
} as const;

export type MangaFont = keyof typeof MANGA_FONTS;

const FALLBACK = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';

const loaded = new Map<string, Promise<boolean>>();

/** フォントを読み込み、canvas の font 指定に使う weight と family を返す */
export async function loadMangaFont(font: MangaFont, text: string): Promise<{ weight: string; family: string }> {
  const { family } = MANGA_FONTS[font];
  const chars = [...new Set(text)].sort().join('');
  const key = `${family}:${chars}`;
  if (!loaded.has(key)) {
    loaded.set(
      key,
      (async () => {
        const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(chars)}&display=block`;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        const css = new Promise<void>((resolve, reject) => {
          link.onload = () => resolve();
          link.onerror = () => reject(new Error('font css'));
        });
        document.head.appendChild(link);
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        try {
          await Promise.race([css.then(() => document.fonts.load(`64px "${family}"`, chars)), timeout]);
          return document.fonts.check(`64px "${family}"`, chars);
        } catch {
          return false;
        }
      })(),
    );
  }
  const ok = await loaded.get(key)!;
  return ok ? { weight: '400', family: `"${family}", ${FALLBACK}` } : { weight: '900', family: FALLBACK };
}

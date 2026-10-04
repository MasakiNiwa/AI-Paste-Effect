import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettings } from './settings';

/** 作業中の入力。JSON テキストだけは設定に応じて保存する。 */
interface SessionStore {
  jsonText: string;
  /** 自動適用オフの時に「適用」で確定したテキスト */
  appliedText: string;
  setJsonText: (text: string) => void;
  apply: () => void;
  imageFile: Blob | null;
  imageName: string;
  setImageFile: (file: Blob | null, name?: string) => void;
  /** 複数案のうち選んでいる案（0 始まり） */
  variant: number;
  setVariant: (i: number) => void;
  /** 新しいイラストで始め直す */
  clear: () => void;
}

export const useSession = create<SessionStore>()(
  persist(
    (set, get) => ({
      jsonText: '',
      appliedText: '',
      setJsonText: (jsonText) =>
        set(useSettings.getState().autoApply && jsonText !== get().appliedText ? { jsonText, appliedText: jsonText, variant: 0 } : { jsonText }),
      apply: () => set({ appliedText: get().jsonText, variant: 0 }),
      variant: 0,
      setVariant: (variant) => set({ variant }),
      imageFile: null,
      imageName: '',
      setImageFile: (imageFile, imageName = '') => set({ imageFile, imageName }),
      clear: () => set({ jsonText: '', appliedText: '', imageFile: null, imageName: '', variant: 0 }),
    }),
    {
      name: 'ai-paste-effect:session',
      partialize: (s) => {
        const keep = useSettings.getState().rememberJson;
        return { jsonText: keep ? s.jsonText : '', appliedText: keep ? s.appliedText : '', variant: keep ? s.variant : 0 };
      },
    },
  ),
);

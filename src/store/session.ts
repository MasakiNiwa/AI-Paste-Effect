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
  /** 新しいイラストで始め直す */
  clear: () => void;
}

export const useSession = create<SessionStore>()(
  persist(
    (set, get) => ({
      jsonText: '',
      appliedText: '',
      setJsonText: (jsonText) => set(useSettings.getState().autoApply ? { jsonText, appliedText: jsonText } : { jsonText }),
      apply: () => set({ appliedText: get().jsonText }),
      imageFile: null,
      imageName: '',
      setImageFile: (imageFile, imageName = '') => set({ imageFile, imageName }),
      clear: () => set({ jsonText: '', appliedText: '', imageFile: null, imageName: '' }),
    }),
    {
      name: 'ai-paste-effect:session',
      partialize: (s) => {
        const keep = useSettings.getState().rememberJson;
        return { jsonText: keep ? s.jsonText : '', appliedText: keep ? s.appliedText : '' };
      },
    },
  ),
);

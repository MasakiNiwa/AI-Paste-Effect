import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettings } from './settings';

/** ホーム画面の作業状態。JSON テキストだけは設定に応じて保存する。 */
interface SessionStore {
  jsonText: string;
  setJsonText: (text: string) => void;
  imageFile: Blob | null;
  imageName: string;
  setImageFile: (file: Blob | null, name?: string) => void;
}

export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      jsonText: '',
      setJsonText: (jsonText) => set({ jsonText }),
      imageFile: null,
      imageName: '',
      setImageFile: (imageFile, imageName = '') => set({ imageFile, imageName }),
    }),
    {
      name: 'ai-paste-effect:session',
      partialize: (s) => ({ jsonText: useSettings.getState().rememberJson ? s.jsonText : '' }),
    },
  ),
);

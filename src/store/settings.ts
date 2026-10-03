import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type ExportFormat = 'png' | 'jpeg';

export interface Settings {
  theme: Theme;
  /** 処理解像度（長辺の最大ピクセル） */
  maxSize: number;
  exportFormat: ExportFormat;
  /** 貼り付けたら自動で適用する */
  autoApply: boolean;
  /** 修正依頼プロンプトにも仕様を含める（新しいチャットで頼む時用） */
  includeSpecInRevision: boolean;
  /** 最後に貼った JSON を次回も残す */
  rememberJson: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  maxSize: 2048,
  exportFormat: 'png',
  autoApply: true,
  includeSpecInRevision: false,
  rememberJson: true,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'ai-paste-effect:settings', version: 1 },
  ),
);

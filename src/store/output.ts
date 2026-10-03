import { create } from 'zustand';

export interface Picture {
  canvas: HTMLCanvasElement;
  /** 表示用の object URL（デコード済み） */
  url: string;
}

/** 描画パイプラインの出力。画面をまたいで共有する（永続化しない）。 */
interface OutputStore {
  original: Picture | null;
  result: Picture | null;
  rendering: boolean;
  renderErrors: string[];
  imageError: string | null;
  /** 結果タブを見ていない新しい結果があるか（スマホのバッジ用） */
  unseen: boolean;
  set: (patch: Partial<Omit<OutputStore, 'set'>>) => void;
}

export const useOutput = create<OutputStore>((set) => ({
  original: null,
  result: null,
  rendering: false,
  renderErrors: [],
  imageError: null,
  unseen: false,
  set: (patch) => set(patch),
}));

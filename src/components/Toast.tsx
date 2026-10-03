import { create } from 'zustand';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastState {
  message: string | null;
  tone: 'ok' | 'err';
  id: number;
  show: (message: string, tone?: 'ok' | 'err') => void;
}

export const useToast = create<ToastState>((set, get) => ({
  message: null,
  tone: 'ok',
  id: 0,
  show: (message, tone = 'ok') => {
    const id = get().id + 1;
    set({ message, tone, id });
    setTimeout(() => {
      if (get().id === id) set({ message: null });
    }, 2600);
  },
}));

export function ToastHost() {
  const { message, tone } = useToast();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-50 flex justify-center px-4"
    >
      {message && (
        <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg">
          {tone === 'ok' ? <CheckCircle2 className="size-4 text-ok" /> : <AlertCircle className="size-4 text-err" />}
          {message}
        </div>
      )}
    </div>
  );
}

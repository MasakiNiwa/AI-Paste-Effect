import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CircleHelp, Image as ImageIcon, PenLine, RotateCcw, Settings } from 'lucide-react';
import { usePipeline } from '../hooks/usePipeline';
import { useOutput } from '../store/output';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { APP_NAME } from '../lib/version';
import { ToastHost, useToast } from './Toast';

function useApplyTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

const NAV = [
  { to: '/', label: '作成', icon: PenLine },
  { to: '/result', label: '結果', icon: ImageIcon, mobileOnly: true },
  { to: '/settings', label: '設定', icon: Settings },
  { to: '/help', label: 'ヘルプ', icon: CircleHelp },
];

function ClearButton() {
  const { jsonText, imageFile, clear } = useSession();
  const toast = useToast((s) => s.show);
  const empty = !jsonText && !imageFile;
  return (
    <button
      type="button"
      disabled={empty}
      onClick={() => {
        if (!window.confirm('JSON と画像をクリアして、新しく始めますか？')) return;
        clear();
        toast('クリアしました');
      }}
      className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
    >
      <RotateCcw className="size-4" />
      クリア
    </button>
  );
}

export function Layout() {
  useApplyTheme();
  usePipeline();
  const unseen = useOutput((s) => s.unseen);
  const { pathname } = useLocation();
  const isResult = pathname === '/result';

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-40 shrink-0 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-2">
            <img src="./favicon.svg" alt="" className="size-7" />
            <span className="truncate text-[15px] font-bold tracking-tight">{APP_NAME}</span>
          </NavLink>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.filter((n) => !n.mobileOnly).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto lg:ml-2">
            <ClearButton />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={`mx-auto w-full max-w-6xl px-4 py-4 sm:py-6 ${isResult ? 'h-full' : ''}`}>
          <Outlet />
        </div>
      </main>

      {/* スマホ用の下部ナビゲーション */}
      <nav className="z-40 shrink-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 text-[11px] transition ${
                  isActive ? 'font-semibold text-accent' : 'text-muted'
                }`
              }
            >
              <span className="relative">
                <Icon className="size-[22px]" />
                {to === '/result' && unseen && !isResult && (
                  <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-surface bg-accent" />
                )}
              </span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <ToastHost />
    </div>
  );
}

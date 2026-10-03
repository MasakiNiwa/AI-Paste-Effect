import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CircleHelp, House, Settings } from 'lucide-react';
import { useSettings } from '../store/settings';
import { APP_NAME } from '../lib/version';
import { ToastHost } from './Toast';

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
  { to: '/', label: 'ホーム', icon: House },
  { to: '/settings', label: '設定', icon: Settings },
  { to: '/help', label: 'ヘルプ', icon: CircleHelp },
];

export function Layout() {
  useApplyTheme();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="./favicon.svg" alt="" className="size-7" />
            <span className="text-[15px] font-bold tracking-tight">{APP_NAME}</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                aria-label={label}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}
